export const DECAY = 0.85;
export const UNUSED_PENALTY = -1.5;
export const DIVE_THRESHOLD = 5;
export const WEIGHTS_FULL = { attack: 0.42, defense: 0.25, reliability: 0.23, form: 0.10 };
export const WEIGHTS_NO_DEFENSE = { attack: 0.56, defense: 0, reliability: 0.3067, form: 0.1333 };

export function attackBasePoints(stars, dest) {
  if (stars === 3) return 3.5;
  const bands = [0, 50, 50];
  const band = bands[stars];
  const bonus = Math.max(0, Math.min(0.5, ((dest - band) / 50) * 0.5));
  return stars + bonus;
}

export function weightedMean(arr) {
  if (arr.length === 0) return 0;
  const wSum = arr.reduce((s, x) => s + x.weight, 0);
  if (wSum === 0) return 0;
  return arr.reduce((s, x) => s + x.score * x.weight, 0) / wSum;
}

export function computePlayerScore(player, wars) {
  const attackScores = [];
  const defenseScores = [];
  const recentAttackScores = [];
  const positionDiffs = [];

  let attacksUsed = 0;
  let attacksAvailable = 0;
  let warsInRoster = 0;
  let totalDestruction = 0;
  let totalAttacks = 0;
  let hasAnyDefense = false;
  let hadTh17 = false;

  wars.forEach((war, warIdx) => {
    const member = (war.members || []).find(m => m.tag === player.tag);
    if (!member) return;

    const isLive = war.state === 'inWar';
    const attacksPerMember = war.teamSize <= 15 ? 1 : 2;
    const attacks = member.attacks || [];

    if (!isLive) {
      warsInRoster++;
      attacksUsed += attacks.length;
      attacksAvailable += attacksPerMember;
    }

    const isTh17Adjusted = member.townhallLevel === 17 && player.townhallLevel === 18;
    if (isTh17Adjusted) hadTh17 = true;
    const th17Factor = isTh17Adjusted ? 0.4 : 1;
    const decay = Math.pow(DECAY, warIdx);
    const weight = decay * th17Factor;

    let warAttackTotal = 0;

    attacks.forEach(a => {
      const stars = Math.max(0, Math.min(3, a.stars));
      const dest = a.destructionPercentage ?? 0;
      const base = attackBasePoints(stars, dest);

      let posMult = 1;
      const attackerPos = member.mapPosition;
      let defenderPos = null;
      if (a.defenderTag && war.opponent && Array.isArray(war.opponent.members)) {
        const opp = war.opponent.members.find(x => x.tag === a.defenderTag);
        if (opp && opp.mapPosition != null) defenderPos = opp.mapPosition;
      }
      if (attackerPos != null && defenderPos != null) {
        const diff = defenderPos - attackerPos;
        positionDiffs.push(diff);
        if (diff <= 0) {
          posMult = 1 + Math.abs(diff) * 0.005;
        } else if (diff <= DIVE_THRESHOLD) {
          posMult = 1;
        } else {
          posMult = 1 - (diff - DIVE_THRESHOLD) * 0.005;
        }
      }

      warAttackTotal += base * posMult;
      totalDestruction += dest;
      totalAttacks++;
    });

    let warAttackAvg;
    if (isLive) {
      if (attacks.length === 0) {
        warAttackAvg = null;
      } else {
        warAttackAvg = warAttackTotal / attacks.length;
      }
    } else {
      const missed = Math.max(0, attacksPerMember - attacks.length);
      warAttackTotal += missed * UNUSED_PENALTY;
      warAttackAvg = warAttackTotal / attacksPerMember;
    }

    if (warAttackAvg !== null) {
      attackScores.push({ score: warAttackAvg, weight });
    }

    if (warIdx < 2 && attacks.length > 0) {
      const recentAvg = attacks.reduce((s, a) => {
        const stars = Math.max(0, Math.min(3, a.stars));
        const dest = a.destructionPercentage ?? 0;
        return s + attackBasePoints(stars, dest);
      }, 0) / attacks.length;
      recentAttackScores.push(recentAvg);
    }

    const defenses = member.defensesReceived;
    if (defenses && defenses.length > 0) {
      hasAnyDefense = true;
      const worst = defenses.reduce((w, d) => {
        if (d.stars > w.stars) return d;
        if (d.stars === w.stars && d.destructionPercentage > w.destructionPercentage) return d;
        return w;
      });
      const scoreWorst = (3 - worst.stars) + (1 - (worst.destructionPercentage ?? 0) / 100);
      const avgStars = defenses.reduce((s, d) => s + d.stars, 0) / defenses.length;
      const scoreAvg = 3 - avgStars;
      const defScore = 0.7 * scoreWorst + 0.3 * scoreAvg;
      defenseScores.push({ score: defScore, weight });
    }
  });

  const attackScore = weightedMean(attackScores);
  const defenseScore = weightedMean(defenseScores);
  const completedWars = wars.filter(w => w.state !== 'inWar');
  const totalWarsWindow = completedWars.length || 1;
  const reliability = attacksAvailable > 0
    ? 0.6 * (attacksUsed / attacksAvailable) + 0.4 * (warsInRoster / totalWarsWindow)
    : 0;
  const formScore = recentAttackScores.length > 0
    ? recentAttackScores.reduce((s, x) => s + x, 0) / recentAttackScores.length
    : 0;

  const weights = hasAnyDefense ? WEIGHTS_FULL : WEIGHTS_NO_DEFENSE;
  const finalScore = weights.attack * attackScore
    + weights.defense * defenseScore
    + weights.reliability * reliability * 3
    + weights.form * formScore;

  return {
    score: finalScore,
    attackScore,
    defenseScore,
    reliability,
    formScore,
    warsInRoster,
    attacksUsed,
    attacksAvailable,
    avgDestruction: totalAttacks > 0 ? totalDestruction / totalAttacks : 0,
    totalAttacks,
    avgPositionDiff: positionDiffs.length > 0
      ? positionDiffs.reduce((s, d) => s + d, 0) / positionDiffs.length
      : 0,
    hasAnyDefense,
    hadTh17,
    weights,
  };
}

export function computeCwlRanking(wars, players) {
  const relevantWars = wars.filter(w => w.state === 'warEnded' || w.state === 'inWar');
  const completedWars = relevantWars.filter(w => w.state === 'warEnded');
  const eligible = players.filter(p => p.townhallLevel === 18);

  const ranking = [];
  const noDataList = [];

  eligible.forEach(player => {
    const data = computePlayerScore(player, relevantWars);
    if (data.totalAttacks === 0) {
      noDataList.push({ player, data });
    } else {
      ranking.push({ player, data });
    }
  });

  ranking.sort((a, b) => {
    if (b.data.score !== a.data.score) return b.data.score - a.data.score;
    if (b.data.avgDestruction !== a.data.avgDestruction) return b.data.avgDestruction - a.data.avgDestruction;
    if (b.data.attacksUsed !== a.data.attacksUsed) return b.data.attacksUsed - a.data.attacksUsed;
    return a.data.avgPositionDiff - b.data.avgPositionDiff;
  });

  const live = relevantWars.find(w => w.state === 'inWar');
  let liveWar = null;
  if (live) {
    const totalAttacksDone = (live.members || []).reduce((s, m) => s + ((m.attacks || []).length), 0);
    const attacksPerMember = live.teamSize <= 15 ? 1 : 2;
    const totalAttacksExpected = live.teamSize * attacksPerMember;
    liveWar = {
      opponentName: live.opponent?.name ?? '',
      totalAttacksDone,
      totalAttacksExpected,
    };
  }

  return {
    ranking,
    noDataList,
    totalWars: completedWars.length,
    liveWar,
  };
}
