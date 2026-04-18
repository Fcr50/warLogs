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

async function main() {
  const war = await fetchCurrentWar();

  if (war.state === 'notInWar') {
    console.log('Clan not in war.');
    return;
  }

  if (war.state !== 'warEnded') {
    console.log(`War state is "${war.state}", skipping save.`);
    return;
  }

  const data = loadData();

  const alreadySaved = data.wars.some(w => w.endTime === war.endTime);
  if (alreadySaved) {
    console.log('War already saved.');
    return;
  }

  const warRecord = {
    endTime: war.endTime,
    result: war.clan.stars > war.opponent.stars ? 'win'
          : war.clan.stars < war.opponent.stars ? 'loss' : 'tie',
    opponent: {
      name: war.opponent.name,
      tag: war.opponent.tag,
      stars: war.opponent.stars,
      destructionPercentage: war.opponent.destructionPercentage,
    },
    clan: {
      stars: war.clan.stars,
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
      missedAttacks: (war.teamSize <= 15 ? 1 : 2) - (m.attacks || []).length,
    })),
  };

  data.wars.unshift(warRecord);
  data.wars = data.wars.slice(0, 50);

  saveData(data);
  console.log(`Saved war vs ${war.opponent.name} (${warRecord.result})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
