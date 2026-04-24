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

  // Capture previous ranks from last run
  const prevRanks = {};
  Object.entries(prevData.statsByTag || {})
    .filter(([, e]) => e.rank != null)
    .forEach(([tag, e]) => { prevRanks[tag] = e.rank; });

  const wars    = warsData.wars    || [];
  const players = playersData.players || [];

  const { ranking, noDataList, totalWars, liveWar } = computeCwlRanking(wars, players);
  const statsByTag = computeAllStats(wars, players);

  // Assign rank and prevRank
  const sorted = Object.entries(statsByTag)
    .filter(([, e]) => e.totalAttacks > 0)
    .sort((a, b) => b[1].score - a[1].score);
  sorted.forEach(([tag], i) => {
    statsByTag[tag].rank = i + 1;
    if (prevRanks[tag] != null) statsByTag[tag].prevRank = prevRanks[tag];
  });

  // Normalized score 0-100 (min-max among players with attacks)
  const scores = sorted.map(([, e]) => e.score);
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 1;
  const range = maxScore - minScore || 1;
  for (const [tag, entry] of Object.entries(statsByTag)) {
    entry.normalizedScore = entry.totalAttacks > 0
      ? Math.round(((entry.score - minScore) / range) * 10000) / 100
      : 0;
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
