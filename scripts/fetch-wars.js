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

function buildWarRecord(war) {
  const clanStars = war.clan.stars ?? 0;
  const oppStars = war.opponent.stars ?? 0;
  const result = war.state === 'warEnded'
    ? (clanStars > oppStars ? 'win' : clanStars < oppStars ? 'loss' : 'tie')
    : 'inProgress';

  return {
    endTime: war.endTime,
    state: war.state,
    result,
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
  const warRecord = buildWarRecord(war);

  if (existingIndex !== -1) {
    if (data.wars[existingIndex].state === 'warEnded' && war.state !== 'warEnded') {
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

  saveData(data);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
