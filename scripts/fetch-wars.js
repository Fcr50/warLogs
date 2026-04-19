import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/wars.json');
const CLAN_TAG = '%232GYGRQPG2';
const API_BASE = 'https://api.clashofclans.com/v1';
const TOKEN = process.env.COC_TOKEN;

const headers = { Authorization: `Bearer ${TOKEN}` };

async function fetchCurrentWar() {
  const res = await fetch(`${API_BASE}/clans/${CLAN_TAG}/currentwar`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  return res.json();
}

function loadData() {
  if (!existsSync(DATA_PATH)) return { wars: [] };
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
}

function saveData(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function parseWarTime(timeStr) {
  // Format: 20260419T190928.000Z
  return new Date(timeStr.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
    '$1-$2-$3T$4:$5:$6'
  ));
}

function getSixHourNonAttackers(war) {
  const endTime   = parseWarTime(war.endTime);
  const startTime = new Date(endTime - 24 * 60 * 60 * 1000);
  const sixHourMark = new Date(startTime.getTime() + 6 * 60 * 60 * 1000);
  const now = new Date();

  if (now < sixHourMark) return null; // 6h mark not reached yet

  return war.clan.members
    .filter(m => !m.attacks || m.attacks.length === 0)
    .map(m => ({ tag: m.tag, name: m.name, townhallLevel: m.townhallLevel }));
}

function buildWarRecord(war, existingRecord) {
  const clanStars = war.clan.stars ?? 0;
  const oppStars  = war.opponent.stars ?? 0;
  const result    = war.state === 'warEnded'
    ? (clanStars > oppStars ? 'win' : clanStars < oppStars ? 'loss' : 'tie')
    : 'inProgress';

  // Preserve existing sixHourNonAttackers if already captured
  let sixHourNonAttackers = existingRecord?.sixHourNonAttackers ?? null;
  if (!sixHourNonAttackers) {
    sixHourNonAttackers = getSixHourNonAttackers(war);
  }

  const endTime   = parseWarTime(war.endTime);
  const startTime = new Date(endTime - 24 * 60 * 60 * 1000);

  return {
    endTime: war.endTime,
    startTime: startTime.toISOString(),
    state: war.state,
    result,
    teamSize: war.teamSize,
    opponent: {
      name: war.opponent.name,
      tag: war.opponent.tag,
      stars: oppStars,
      destructionPercentage: war.opponent.destructionPercentage,
    },
    clan: {
      stars: clanStars,
      destructionPercentage: war.clan.destructionPercentage,
    },
    sixHourNonAttackers,
    members: war.clan.members.map(m => ({
      tag: m.tag,
      name: m.name,
      townhallLevel: m.townhallLevel,
      attacks: (m.attacks || []).map(a => ({
        stars: a.stars,
        destructionPercentage: a.destructionPercentage,
        order: a.order,
      })),
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
  const existingIndex = data.wars.findIndex(w => w.endTime === war.endTime);
  const existingRecord = existingIndex !== -1 ? data.wars[existingIndex] : null;
  const warRecord = buildWarRecord(war, existingRecord);

  if (existingIndex !== -1) {
    if (existingRecord.state === 'warEnded' && war.state !== 'warEnded') {
      console.log('Already saved as finished, skipping.');
      return;
    }
    data.wars[existingIndex] = warRecord;
    console.log(`Updated war vs ${war.opponent.name} (${warRecord.result})`);
  } else {
    data.wars.unshift(warRecord);
    data.wars = data.wars.slice(0, 50);
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
