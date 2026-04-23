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
  let attacksUsedCompleted = 0;
  let attacksAvailableCompleted = 0;
  let warsInRosterCompleted = 0;
  let totalDestruction = 0;
  let totalAttacks = 0;
  let totalStars = 0;
  let count3Stars = 0;
  let totalMissed = 0;
  let hasAnyDefense = false;
  let hadTh17 = false;

  wars.forEach((war, warIdx) => {
    const member = (war.members || []).find(m => m.tag === player.tag);
    if (!member) return;

    const isLive = war.state === 'inWar';
    const attacksPerMember = war.teamSize <= 15 ? 1 : 2;
    const attacks = member.attacks || [];

    warsInRoster++;
    attacksUsed += attacks.length;
    attacksAvailable += attacksPerMember;

    if (!isLive) {
      warsInRosterCompleted++;
      attacksUsedCompleted += attacks.length;
      attacksAvailableCompleted += attacksPerMember;
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
      totalStars += stars;
      if (stars === 3) count3Stars++;
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
      totalMissed += missed;
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
  const reliability = attacksAvailableCompleted > 0
    ? 0.6 * (attacksUsedCompleted / attacksAvailableCompleted) + 0.4 * (warsInRosterCompleted / totalWarsWindow)
    : 0;
  const formScore = recentAttackScores.length > 0
    ? recentAttackScores.reduce((s, x) => s + x, 0) / recentAttackScores.length
    : 0;

  const weights = hasAnyDefense ? WEIGHTS_FULL : WEIGHTS_NO_DEFENSE;
  const rawScore = weights.attack * attackScore
    + weights.defense * defenseScore
    + weights.reliability * reliability * 3
    + weights.form * formScore;

  let confidence;
  if (warsInRoster >= 6)      confidence = 1.0;
  else if (warsInRoster >= 4) confidence = 0.85;
  else if (warsInRoster >= 2) confidence = 0.7;
  else if (warsInRoster >= 1) confidence = 0.5;
  else                        confidence = 0;

  const finalScore = rawScore * confidence;

  const avgStars = totalAttacks > 0 ? totalStars / totalAttacks : 0;
  const threeStarRate = totalAttacks > 0 ? count3Stars / totalAttacks : 0;

  let tier;
  if (totalAttacks === 0) {
    tier = 'F';
  } else {
    const tierScore = avgStars * 0.5 + threeStarRate * 3 * 0.3 + reliability * 3 * 0.2;
    if (tierScore >= 2.8)      tier = 'S';
    else if (tierScore >= 2.5) tier = 'A';
    else if (tierScore >= 2.2) tier = 'B';
    else                       tier = 'C';
    if (confidence < 0.7 && tier === 'S') tier = 'A';
    if (confidence < 0.5 && (tier === 'S' || tier === 'A')) tier = 'B';
  }

  return {
    score: finalScore,
    rawScore,
    confidence,
    tier,
    attackScore,
    defenseScore,
    reliability,
    formScore,
    warsInRoster,
    attacksUsed,
    attacksAvailable,
    avgDestruction: totalAttacks > 0 ? totalDestruction / totalAttacks : 0,
    totalAttacks,
    totalStars,
    count3Stars,
    avgStars,
    threeStarRate,
    totalMissed,
    avgPositionDiff: positionDiffs.length > 0
      ? positionDiffs.reduce((s, d) => s + d, 0) / positionDiffs.length
      : 0,
    hasAnyDefense,
    hadTh17,
    weights,
  };
}

export function capTierByTh(tier, th) {
  if (tier === 'F') return 'F';
  const order = ['S', 'A', 'B', 'C'];
  const cur = order.indexOf(tier);
  if (cur === -1) return tier;
  const min = th >= 18 ? 0 : th >= 15 ? 1 : 2;
  return order[Math.max(cur, min)];
}

function assignPercentileTiers(entries) {
  const withAttacks = entries.filter(e => e.data.totalAttacks > 0);
  withAttacks.sort((a, b) => b.data.score - a.data.score);
  withAttacks.forEach((entry, i) => {
    let tier;
    if (i < 4)       tier = 'S';
    else if (i < 12) tier = 'A';
    else if (i < 28) tier = 'B';
    else             tier = 'C';
    entry.tier = capTierByTh(tier, entry.th);
  });
  entries.filter(e => e.data.totalAttacks === 0).forEach(e => { e.tier = 'F'; });
}

export function computeAllTiers(wars, players) {
  const relevantWars = wars.filter(w => w.state === 'warEnded' || w.state === 'inWar');
  const entries = players.map(p => ({ tag: p.tag, th: p.townhallLevel, data: computePlayerScore(p, relevantWars) }));
  assignPercentileTiers(entries);
  return Object.fromEntries(entries.map(e => [e.tag, e.tier]));
}

export function computeAllStats(wars, players) {
  const relevantWars = wars.filter(w => w.state === 'warEnded' || w.state === 'inWar');
  const entries = players.map(p => ({ tag: p.tag, th: p.townhallLevel, data: computePlayerScore(p, relevantWars) }));
  assignPercentileTiers(entries);
  const map = {};
  entries.forEach(({ tag, data, tier }) => {
    map[tag] = {
      tier,
      score: data.score,
      avgStars: data.avgStars,
      totalStars: data.totalStars,
      totalAttacks: data.totalAttacks,
      warsInRoster: data.warsInRoster,
      totalMissed: data.totalMissed,
    };
  });
  return map;
}

export function computeCwlRanking(wars, players) {
  const relevantWars = wars.filter(w => w.state === 'warEnded' || w.state === 'inWar');
  const completedWars = relevantWars.filter(w => w.state === 'warEnded');
  const eligible = players.filter(p => p.townhallLevel === 18);

  const entries = eligible.map(player => ({
    player,
    data: computePlayerScore(player, relevantWars),
  }));

  entries.sort((a, b) => {
    const aHas = a.data.totalAttacks > 0;
    const bHas = b.data.totalAttacks > 0;
    if (aHas !== bHas) return bHas - aHas;
    if (b.data.score !== a.data.score) return b.data.score - a.data.score;
    if (b.data.totalStars !== a.data.totalStars) return b.data.totalStars - a.data.totalStars;
    if (b.data.avgStars !== a.data.avgStars) return b.data.avgStars - a.data.avgStars;
    return a.data.totalMissed - b.data.totalMissed;
  });

  const ranking = entries;
  const noDataList = entries.filter(e => e.data.totalAttacks === 0);

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
