import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const LIGA_PATH    = join(__dirname, '../data/liga.json');
const CLAN_TAG     = '#2GYGRQPG2';
const CLAN_ENCODED = '%232GYGRQPG2';
const API_BASE     = 'https://api.clashofclans.com/v1';
const TOKEN        = process.env.COC_TOKEN;
const headers      = { Authorization: `Bearer ${TOKEN}` };

async function fetchLeagueGroup() {
  const res = await fetch(`${API_BASE}/clans/${CLAN_ENCODED}/currentwar/leaguegroup`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchLeagueWar(warTag) {
  const encoded = warTag.replace('#', '%23');
  const res = await fetch(`${API_BASE}/clanwarleagues/wars/${encoded}`, { headers });
  if (!res.ok) throw new Error(`API error (war ${warTag}): ${res.status}`);
  return res.json();
}

async function main() {
  const group = await fetchLeagueGroup();

  if (!group) {
    if (!existsSync(LIGA_PATH)) {
      writeFileSync(LIGA_PATH, JSON.stringify({ state: 'notFound', generatedAt: new Date().toISOString() }, null, 2));
      console.log('No CWL data (404). Wrote notFound state.');
    } else {
      const existing = JSON.parse(readFileSync(LIGA_PATH, 'utf-8'));
      console.log(existing.season
        ? `No active CWL. Preserving existing liga.json (season ${existing.season}).`
        : 'Still no CWL data.');
    }
    return;
  }

  const { season, state, rounds = [] } = group;
  console.log(`CWL season ${season}, state: ${state}, ${rounds.length} round(s)`);

  const processedRounds = [];

  for (let i = 0; i < rounds.length; i++) {
    const warTags = rounds[i].warTags || [];
    let ourWar = null;

    for (const warTag of warTags) {
      if (warTag === '#0') continue;
      try {
        const war = await fetchLeagueWar(warTag);
        const isClan     = war.clan?.tag     === CLAN_TAG;
        const isOpponent = war.opponent?.tag === CLAN_TAG;
        if (!isClan && !isOpponent) continue;

        const clan     = isClan ? war.clan     : war.opponent;
        const opponent = isClan ? war.opponent : war.clan;

        const clanStars = clan.stars ?? 0;
        const oppStars  = opponent.stars ?? 0;
        const result    = war.state === 'warEnded'
          ? (clanStars > oppStars ? 'win' : clanStars < oppStars ? 'loss' : 'tie')
          : 'inProgress';

        const opponentPositions = {};
        (opponent.members || []).forEach(o => { opponentPositions[o.tag] = o.mapPosition; });

        ourWar = {
          round: i + 1,
          warTag,
          state: war.state,
          result,
          opponentName: opponent.name,
          opponentTag:  opponent.tag,
          clanStars,
          opponentStars: oppStars,
          clanDestructionPct: clan.destructionPercentage ?? 0,
          teamSize: war.teamSize,
          members: (clan.members || []).map(m => {
            const atk = m.attacks?.[0] ?? null;
            return {
              tag:            m.tag,
              name:           m.name,
              townhallLevel:  m.townhallLevel,
              mapPosition:    m.mapPosition,
              attack: atk ? {
                defenderTag:           atk.defenderTag,
                defenderMapPosition:   opponentPositions[atk.defenderTag] ?? null,
                stars:                 atk.stars,
                destructionPercentage: atk.destructionPercentage,
              } : null,
            };
          }),
        };
        break;
      } catch (err) {
        console.warn(`Round ${i + 1} war ${warTag}: ${err.message}`);
      }
    }

    processedRounds.push(ourWar ?? null);
    if (ourWar) {
      console.log(`  Round ${i + 1}: vs ${ourWar.opponentName} — ${ourWar.result} (${ourWar.clanStars}⭐ vs ${ourWar.opponentStars}⭐)`);
    } else {
      console.log(`  Round ${i + 1}: not yet scheduled or clan not found`);
    }
  }

  writeFileSync(LIGA_PATH, JSON.stringify({
    season,
    generatedAt: new Date().toISOString(),
    state,
    rounds: processedRounds,
  }, null, 2));

  console.log(`Liga saved: ${processedRounds.filter(Boolean).length} round(s) processed.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
