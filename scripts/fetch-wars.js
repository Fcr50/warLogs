import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH     = join(__dirname, '../data/wars.json');
const ARCHIVE_PATH  = join(__dirname, '../data/wars-archive.json');
const ABSENCES_PATH = join(__dirname, '../data/absences.json');
const CLAN_TAG  = '%232GYGRQPG2';
const API_BASE  = 'https://api.clashofclans.com/v1';
const TOKEN     = process.env.COC_TOKEN;

const headers = { Authorization: `Bearer ${TOKEN}` };

async function fetchCurrentWar() {
  const res = await fetch(`${API_BASE}/clans/${CLAN_TAG}/currentwar`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchClanMembers() {
  const res = await fetch(`${API_BASE}/clans/${CLAN_TAG}/members`, { headers });
  if (!res.ok) throw new Error(`API error (members): ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

function loadData() {
  if (!existsSync(DATA_PATH)) return { wars: [] };
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
}

function loadAbsences() {
  if (!existsSync(ABSENCES_PATH)) return { absent: [] };
  return JSON.parse(readFileSync(ABSENCES_PATH, 'utf-8'));
}

function saveData(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function saveAbsences(data) {
  writeFileSync(ABSENCES_PATH, JSON.stringify(data, null, 2));
}

function parseWarTime(timeStr) {
  return new Date(timeStr.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
    '$1-$2-$3T$4:$5:$6'
  ));
}

function getSixHourNonAttackers(war) {
  return war.clan.members
    .filter(m => !m.attacks || m.attacks.length === 0)
    .map(m => ({ tag: m.tag, name: m.name, townhallLevel: m.townhallLevel }));
}

async function updateAbsences(war) {
  const clanMembers  = await fetchClanMembers();
  const warMemberTags = new Set(war.clan.members.map(m => m.tag));

  const absences = loadAbsences();
  const absentMap = {};
  for (const a of absences.absent) absentMap[a.tag] = a;

  const newAbsent = [];

  for (const member of clanMembers) {
    if (warMemberTags.has(member.tag)) continue; // in war → skip

    const prev = absentMap[member.tag];
    newAbsent.push({
      tag:                  member.tag,
      name:                 member.name,
      townhallLevel:        member.townHallLevel,
      consecutiveAbsences:  prev ? prev.consecutiveAbsences + 1 : 1,
    });
  }

  saveAbsences({ updatedAt: new Date().toISOString(), absent: newAbsent });

  const names = newAbsent.map(m => `${m.name}(${m.consecutiveAbsences})`).join(', ');
  console.log(`Absences updated: ${names || 'none'}`);
}

function buildWarRecord(war, existingRecord) {
  const clanStars = war.clan.stars ?? 0;
  const oppStars  = war.opponent.stars ?? 0;
  const result    = war.state === 'warEnded'
    ? (clanStars > oppStars ? 'win' : clanStars < oppStars ? 'loss' : 'tie')
    : 'inProgress';

  const endTime        = parseWarTime(war.endTime);
  const startTime      = new Date(endTime - 24 * 60 * 60 * 1000);
  const sixHourTenMark = new Date(startTime.getTime() + (6 * 60 + 10) * 60 * 1000);
  const now            = new Date();

  let sixHourNonAttackers;
  if (now >= sixHourTenMark && existingRecord?.sixHourNonAttackers != null) {
    sixHourNonAttackers = existingRecord.sixHourNonAttackers;
  } else if (war.state === 'inWar' || war.state === 'warEnded') {
    sixHourNonAttackers = getSixHourNonAttackers(war);
  } else {
    sixHourNonAttackers = null;
  }

  // Build a lookup of opponent positions so we can attach defender mapPosition
  // and compute defenses received per clan member.
  const opponentPositions = {};
  (war.opponent.members || []).forEach(o => {
    opponentPositions[o.tag] = o.mapPosition;
  });

  const defensesByClanTag = {};
  (war.opponent.members || []).forEach(o => {
    (o.attacks || []).forEach(a => {
      if (!defensesByClanTag[a.defenderTag]) defensesByClanTag[a.defenderTag] = [];
      defensesByClanTag[a.defenderTag].push({
        stars: a.stars,
        destructionPercentage: a.destructionPercentage,
        attackerTag: a.attackerTag,
        attackerMapPosition: opponentPositions[a.attackerTag] ?? null,
      });
    });
  });

  return {
    endTime: war.endTime,
    startTime: startTime.toISOString(),
    state: war.state,
    result,
    teamSize: war.teamSize,
    absencesRecorded: existingRecord?.absencesRecorded ?? false,
    opponent: {
      name: war.opponent.name,
      tag:  war.opponent.tag,
      stars: oppStars,
      destructionPercentage: war.opponent.destructionPercentage,
      members: (war.opponent.members || []).map(o => ({
        tag: o.tag,
        mapPosition: o.mapPosition,
      })),
    },
    clan: {
      stars: clanStars,
      destructionPercentage: war.clan.destructionPercentage,
    },
    sixHourNonAttackers,
    members: war.clan.members.map(m => ({
      tag:  m.tag,
      name: m.name,
      townhallLevel: m.townhallLevel,
      mapPosition: m.mapPosition,
      attacks: (m.attacks || []).map(a => ({
        stars: a.stars,
        destructionPercentage: a.destructionPercentage,
        order: a.order,
        defenderTag: a.defenderTag,
      })),
      defensesReceived: defensesByClanTag[m.tag] || [],
      missedAttacks: war.state === 'warEnded'
        ? (war.teamSize <= 15 ? 1 : 2) - (m.attacks || []).length
        : 0,
    })),
  };
}

async function main() {
  const war = await fetchCurrentWar();

  if (war.state === 'notInWar') {
    console.log('Clan not in war.');
    return;
  }

  const data = loadData();
  const existingIndex  = data.wars.findIndex(w => w.endTime === war.endTime);
  const existingRecord = existingIndex !== -1 ? data.wars[existingIndex] : null;
  const warRecord      = buildWarRecord(war, existingRecord);

  // Record absences once when war starts (inWar state, first detection)
  if (war.state === 'inWar' && !warRecord.absencesRecorded) {
    await updateAbsences(war);
    warRecord.absencesRecorded = true;
  }

  if (existingIndex !== -1) {
    if (existingRecord.state === 'warEnded' && war.state !== 'warEnded') {
      console.log('Already saved as finished, skipping.');
      return;
    }
    data.wars[existingIndex] = warRecord;
    console.log(`Updated war vs ${war.opponent.name} (${warRecord.result})`);
  } else {
    data.wars.unshift(warRecord);
    if (data.wars.length > 50) {
      const overflow = data.wars.slice(50);
      const archive = existsSync(ARCHIVE_PATH)
        ? JSON.parse(readFileSync(ARCHIVE_PATH, 'utf-8'))
        : { wars: [] };
      archive.wars.unshift(...overflow);
      writeFileSync(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
      data.wars = data.wars.slice(0, 50);
      console.log(`Archived ${overflow.length} war(s) to wars-archive.json`);
    }
    console.log(`Saved war vs ${war.opponent.name} (${warRecord.result})`);
  }

  if (warRecord.sixHourNonAttackers) {
    console.log(`6h non-attackers: ${warRecord.sixHourNonAttackers.map(m => m.name).join(', ') || 'none'}`);
  }

  saveData(data);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
