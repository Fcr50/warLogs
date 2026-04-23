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

    const decay = Math.pow(DECAY, warIdx);
    const weight = decay;

    let warAttackTotal = 0;

    attacks.forEach(a => {
      const stars = Math.max(0, Math.min(3, a.stars));
      const dest = a.destructionPercentage ?? 0;
      const base = attackBasePoints(stars, dest);

      warAttackTotal += base;
      totalDestruction += dest;
      totalStars += stars;
      if (stars === 3) count3Stars++;
      totalAttacks++;
    });

    let warAttackAvg;
    if (isLive) {
      warAttackAvg = attacks.length > 0 ? warAttackTotal / attacks.length : null;
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
        return s + attackBasePoints(a.stars, a.destructionPercentage ?? 0);
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

  const reliability = attacksAvailableCompleted > 0
    ? 0.6 * (attacksUsedCompleted / attacksAvailableCompleted) +
      0.4 * (warsInRosterCompleted / (wars.length || 1))
    : 0;

  const formScore = recentAttackScores.length > 0
    ? recentAttackScores.reduce((s, x) => s + x, 0) / recentAttackScores.length
    : 0;

  const weights = hasAnyDefense ? WEIGHTS_FULL : WEIGHTS_NO_DEFENSE;

  const rawScore =
    weights.attack * attackScore +
    weights.defense * defenseScore +
    weights.reliability * reliability * 3 +
    weights.form * formScore;

  let confidence = warsInRoster >= 6 ? 1 :
                   warsInRoster >= 4 ? 0.85 :
                   warsInRoster >= 2 ? 0.7 :
                   warsInRoster >= 1 ? 0.5 : 0;

  const finalScore = rawScore * confidence;

  return {
    score: finalScore,
    avgStars: totalAttacks > 0 ? totalStars / totalAttacks : 0,
    totalStars,
    totalAttacks,
    warsInRoster,
    totalMissed
  };
}

export function capTierByTh(tier, th) {
  if (tier === 'F') return 'F';
  const order = ['S', 'A', 'B', 'C'];
  const cur = order.indexOf(tier);
  const min = th >= 18 ? 0 : th >= 15 ? 1 : 2;
  return order[Math.max(cur, min)];
}

export function computeAllStats(wars, players) {
  const relevantWars = wars.filter(w => w.state === 'warEnded' || w.state === 'inWar');

  const temp = [];

  // 1. Calcula score para TODOS os players do clã
  players.forEach(p => {
    const d = computePlayerScore(p, relevantWars);

    temp.push({
      tag: p.tag,
      th: p.townhallLevel,
      score: d.score,
      data: d
    });
  });

  // 2. Ordena por score (maior → menor)
  temp.sort((a, b) => b.score - a.score);

  const total = temp.length;

  // 3. Aplica percentil com base no TOTAL DO CLÃ
  temp.forEach((entry, index) => {
    const percentile = (index + 1) / total;

    let tier;

    // 🔴 Regra absoluta: sem ataque = F
    if (entry.data.totalAttacks === 0) {
      tier = 'F';
    } else if (percentile <= 0.10) {
      tier = 'S';
    } else if (percentile <= 0.30) {
      tier = 'A';
    } else if (percentile <= 0.60) {
      tier = 'B';
    } else {
      tier = 'C';
    }

    // mantém limite por TH
    entry.tier = capTierByTh(tier, entry.th);
  });

  // 4. Retorna no formato esperado
  const map = {};

  temp.forEach(entry => {
    const d = entry.data;

    map[entry.tag] = {
      tier: entry.tier,
      score: d.score,
      avgStars: d.avgStars,
      totalStars: d.totalStars,
      totalAttacks: d.totalAttacks,
      warsInRoster: d.warsInRoster,
      totalMissed: d.totalMissed,
    };
  });

  return map;
}