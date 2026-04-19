import fetch from 'node-fetch';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/players.json');
const CLAN_TAG = '%232GYGRQPG2';
const API_BASE = 'https://api.clashofclans.com/v1';
const TOKEN = process.env.COC_TOKEN;
const headers = { Authorization: `Bearer ${TOKEN}` };

const HOME_HEROES = new Set([
  'Barbarian King', 'Archer Queen', 'Grand Warden',
  'Royal Champion', 'Minion Prince', 'Dragon Duke',
]);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchMembers() {
  const res = await fetch(`${API_BASE}/clans/${CLAN_TAG}/members?limit=50`, { headers });
  if (!res.ok) throw new Error(`Members API error: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

async function fetchPlayer(tag) {
  const encoded = encodeURIComponent(tag);
  const res = await fetch(`${API_BASE}/players/${encoded}`, { headers });
  if (!res.ok) throw new Error(`Player API error for ${tag}: ${res.status}`);
  return res.json();
}

async function main() {
  const members = await fetchMembers();
  console.log(`Fetching data for ${members.length} members...`);

  const players = [];

  for (const member of members) {
    try {
      const player = await fetchPlayer(member.tag);
      players.push({
        tag: player.tag,
        name: player.name,
        townhallLevel: player.townHallLevel,
        expLevel: player.expLevel,
        trophies: player.trophies,
        heroes: (player.heroes || [])
          .filter(h => HOME_HEROES.has(h.name))
          .map(h => ({ name: h.name, level: h.level, maxLevel: h.maxLevel })),
        equipment: (player.heroEquipment || [])
          .map(e => ({ name: e.name, level: e.level, maxLevel: e.maxLevel })),
      });
      process.stdout.write(`  ✓ ${player.name}\n`);
    } catch (err) {
      console.error(`  ✗ ${member.tag}: ${err.message}`);
    }
    await sleep(100);
  }

  players.sort((a, b) => b.townhallLevel - a.townhallLevel || b.trophies - a.trophies);

  writeFileSync(DATA_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), players }, null, 2));
  console.log(`\nSaved ${players.length} players to players.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
