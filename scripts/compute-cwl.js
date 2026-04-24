import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { computeCwlRanking, computeAllStats } from '../js/cwl-score.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WARS_PATH    = join(__dirname, '../data/wars.json');
const PLAYERS_PATH = join(__dirname, '../data/players.json');
const OUT_PATH     = join(__dirname, '../data/cwl-ranking.json');

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function main() {
  const warsData    = loadJson(WARS_PATH,    { wars: [] });
  const playersData = loadJson(PLAYERS_PATH, { players: [] });
  const prevData    = loadJson(OUT_PATH,     { statsByTag: {} });
  const prevTiers   = Object.fromEntries(
    Object.entries(prevData.statsByTag || {}).map(([tag, e]) => [tag, e.tier])
  );

  const wars    = warsData.wars    || [];
  const players = playersData.players || [];

  const { ranking, noDataList, totalWars, liveWar } = computeCwlRanking(wars, players);
  const statsByTag = computeAllStats(wars, players);

  for (const [tag, entry] of Object.entries(statsByTag)) {
    const prev = prevTiers[tag];
    if (prev && prev !== entry.tier) entry.prevTier = prev;
  }

  const slimPlayer = p => ({ tag: p.tag, name: p.name, townhallLevel: p.townhallLevel });

  const output = {
    generatedAt: new Date().toISOString(),
    totalWars,
    liveWar,
    ranking: ranking.map(({ player, data }) => ({ player: slimPlayer(player), data })),
    noDataList: noDataList.map(({ player }) => ({ player: slimPlayer(player) })),
    statsByTag,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`CWL ranking computed: ${ranking.length} players, ${totalWars} completed wars, liveWar=${liveWar ? `vs ${liveWar.opponentName} (${liveWar.totalAttacksDone}/${liveWar.totalAttacksExpected})` : 'none'}`);
}

main();
