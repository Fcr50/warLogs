const CWL_PASS = 'bs50cwl';
const DECAY = 0.85;
const UNUSED_PENALTY = -1.5;
const DIVE_THRESHOLD = 5;
const WEIGHTS_FULL = { attack: 0.42, defense: 0.25, reliability: 0.23, form: 0.10 };
const WEIGHTS_NO_DEFENSE = { attack: 0.56, defense: 0, reliability: 0.3067, form: 0.1333 };

let cachedWars = [];
let cachedPlayers = [];

export function initCwl(wars, players) {
  cachedWars = wars || [];
  cachedPlayers = players || [];
  if (sessionStorage.getItem('cwl_auth') === '1') {
    renderCwl();
  } else {
    renderPasswordGate();
  }
}

function renderPasswordGate() {
  const container = document.getElementById('cwl-content');
  container.innerHTML = `
    <div class="password-gate">
      <div class="password-gate-card">
        <div class="password-gate-lock">🔒</div>
        <div class="password-gate-title">Área restrita</div>
        <div class="password-gate-desc">Digite a senha para acessar o ranking Top 20 CWL.</div>
        <form id="cwl-password-form" autocomplete="off">
          <input type="password" id="cwl-password-input" placeholder="Senha" autocomplete="new-password" spellcheck="false" />
          <button type="submit">Entrar</button>
        </form>
        <div class="password-error" id="cwl-password-error" hidden>Senha incorreta</div>
      </div>
    </div>
  `;

  const form = container.querySelector('#cwl-password-form');
  const input = container.querySelector('#cwl-password-input');
  const error = container.querySelector('#cwl-password-error');
  const card = container.querySelector('.password-gate-card');

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value === CWL_PASS) {
      sessionStorage.setItem('cwl_auth', '1');
      renderCwl();
    } else {
      error.hidden = false;
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      input.value = '';
      input.focus();
    }
  });

  setTimeout(() => input.focus(), 80);
}

function renderCwl() {
  const container = document.getElementById('cwl-content');
  const { ranking, noDataList, totalWars } = computeCwlRanking(cachedWars, cachedPlayers);

  let html = '';

  html += `
    <div class="cwl-header">
      <h2 class="cwl-title">🏅 Top 20 CWL — Ranking de performance</h2>
      <div class="cwl-meta">${totalWars} guerra${totalWars !== 1 ? 's' : ''} completa${totalWars !== 1 ? 's' : ''} analisada${totalWars !== 1 ? 's' : ''} · ${ranking.length} TH18 com dados</div>
    </div>
  `;

  if (totalWars < 3) {
    html += `<div class="cwl-small-sample-warning">⚠️ Amostra pequena (${totalWars} guerra${totalWars !== 1 ? 's' : ''}) — o ranking vai se estabilizar conforme mais guerras forem concluídas.</div>`;
  }

  if (ranking.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">Ainda não há dados suficientes</div>
        <div class="empty-state-desc">Nenhum TH18 com ataques registrados no histórico disponível.</div>
      </div>
    `;
  } else {
    const top20 = ranking.slice(0, 20);
    html += `
      <div class="table-wrapper">
        <table class="cwl-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Membro</th>
              <th>Score</th>
              <th>Ataque</th>
              <th>Defesa</th>
              <th>Confiab.</th>
              <th>Forma</th>
              <th>Guerras</th>
              <th>Atks usados</th>
              <th>%Destr</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${top20.map((entry, i) => renderRow(entry, i)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (noDataList.length > 0) {
    html += `
      <div class="cwl-no-data-section">
        <h3 class="cwl-subtitle">TH18 sem dados suficientes</h3>
        <div class="cwl-no-data-list">
          ${noDataList.map(({ player }) => `
            <div class="cwl-no-data-item">
              <span class="member-name">${player.name}</span>
              <span class="member-tag">${player.tag}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const obs = buildObservations(ranking, cachedWars);
  if (obs.length > 0) {
    html += `
      <div class="cwl-observations">
        <strong>Observações:</strong>
        <ul>${obs.map(o => `<li>${o}</li>`).join('')}</ul>
      </div>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.cwl-row').forEach(row => {
    row.addEventListener('click', () => {
      const tag = row.dataset.tag;
      const entry = ranking.find(r => r.player.tag === tag);
      if (entry) openBreakdownModal(entry.player, entry.data);
    });
  });
}

function renderRow(entry, index) {
  const { player, data } = entry;
  const status = index < 15 ? 'convocado' : 'reserva';
  const statusLabel = index < 15 ? 'Convocado' : 'Reserva';
  const defenseCell = data.hasAnyDefense ? data.defenseScore.toFixed(2) : '—';
  const th17Tag = data.hadTh17 ? ' <span class="cwl-th17-tag" title="Recém-TH18: guerras em TH17 com peso 0.4">↑17→18</span>' : '';

  return `
    <tr class="cwl-row cwl-row-${status}" data-tag="${player.tag}">
      <td class="cwl-pos">${index + 1}</td>
      <td>
        <div class="member-name">${player.name}${th17Tag}</div>
        <div class="member-tag">${player.tag}</div>
      </td>
      <td class="cwl-score-cell"><strong>${data.score.toFixed(2)}</strong></td>
      <td>${data.attackScore.toFixed(2)}</td>
      <td>${defenseCell}</td>
      <td>${(data.reliability * 3).toFixed(2)}</td>
      <td>${data.formScore.toFixed(2)}</td>
      <td>${data.warsInRoster}</td>
      <td>${data.attacksUsed}/${data.attacksAvailable}</td>
      <td>${data.avgDestruction.toFixed(1)}%</td>
      <td><span class="cwl-status-badge cwl-status-${status}">${statusLabel}</span></td>
    </tr>
  `;
}

function buildObservations(ranking, wars) {
  const obs = [];
  const lowSample = ranking.filter(r => r.data.warsInRoster < 3);
  if (lowSample.length > 0) {
    const names = lowSample.map(r => r.player.name).join(', ');
    obs.push(`Amostra pequena (&lt;3 guerras): ${names}. Scores podem oscilar conforme novas guerras.`);
  }
  const newTh18 = ranking.filter(r => r.data.hadTh17);
  if (newTh18.length > 0) {
    const names = newTh18.map(r => r.player.name).join(', ');
    obs.push(`Recém-TH18 (guerras em TH17 contam com peso 0.4): ${names}.`);
  }
  const noDefenseData = ranking.filter(r => !r.data.hasAnyDefense);
  if (noDefenseData.length > 0 && noDefenseData.length === ranking.length) {
    obs.push(`Histórico ainda sem dados de defesa — peso de defesa (25%) foi redistribuído. A coluna Defesa ficará preenchida conforme novas guerras forem sincronizadas.`);
  } else if (noDefenseData.length > 0) {
    obs.push(`Alguns membros sem dados de defesa no histórico — peso redistribuído apenas para eles.`);
  }
  return obs;
}

function computeCwlRanking(wars, players) {
  const completedWars = wars.filter(w => w.state === 'warEnded');
  const eligible = players.filter(p => p.townhallLevel === 18);

  const ranking = [];
  const noDataList = [];

  eligible.forEach(player => {
    const data = computePlayerScore(player, completedWars);
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

  return { ranking, noDataList, totalWars: completedWars.length };
}

function computePlayerScore(player, wars) {
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

    warsInRoster++;
    const attacksPerMember = war.teamSize <= 15 ? 1 : 2;
    const attacks = member.attacks || [];
    attacksUsed += attacks.length;
    attacksAvailable += attacksPerMember;

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
        // Convenção CoC: mapPosition 1 = topo/mais forte. diff > 0 = mergulho
        // (defensor está abaixo do atacante no mapa). Mergulho até DIVE_THRESHOLD
        // posições conta como espelho; acima disso, penaliza só o excesso.
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

    const missed = Math.max(0, attacksPerMember - attacks.length);
    warAttackTotal += missed * UNUSED_PENALTY;

    const warAttackAvg = warAttackTotal / attacksPerMember;
    attackScores.push({ score: warAttackAvg, weight });

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
  const totalWarsWindow = wars.length || 1;
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

function attackBasePoints(stars, dest) {
  if (stars === 3) return 3.5;
  const bands = [0, 50, 50];
  const band = bands[stars];
  const bonus = Math.max(0, Math.min(0.5, ((dest - band) / 50) * 0.5));
  return stars + bonus;
}

function weightedMean(arr) {
  if (arr.length === 0) return 0;
  const wSum = arr.reduce((s, x) => s + x.weight, 0);
  if (wSum === 0) return 0;
  return arr.reduce((s, x) => s + x.score * x.weight, 0) / wSum;
}

function openBreakdownModal(player, data) {
  document.getElementById('cwl-breakdown-modal')?.remove();
  const backdrop = document.createElement('div');
  backdrop.id = 'cwl-breakdown-modal';
  backdrop.className = 'modal-backdrop';
  const defenseVal = data.hasAnyDefense ? data.defenseScore.toFixed(2) : '<em>sem dados</em>';
  backdrop.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="Fechar">×</button>
      <div class="modal-header">
        <div class="modal-title">${player.name}</div>
        <div class="modal-subtitle">
          <span class="th-badge">CV${player.townhallLevel}</span>
          <span class="modal-tag">${player.tag}</span>
        </div>
      </div>
      <div class="modal-meta">Score final: <strong>${data.score.toFixed(2)}</strong></div>
      <div class="score-breakdown">
        <div class="breakdown-row"><span>Ataque <em>(${(data.weights.attack * 100).toFixed(1)}%)</em></span><span>${data.attackScore.toFixed(2)}</span></div>
        <div class="breakdown-row"><span>Defesa <em>(${(data.weights.defense * 100).toFixed(1)}%)</em></span><span>${defenseVal}</span></div>
        <div class="breakdown-row"><span>Confiabilidade ×3 <em>(${(data.weights.reliability * 100).toFixed(1)}%)</em></span><span>${(data.reliability * 3).toFixed(2)}</span></div>
        <div class="breakdown-row"><span>Forma recente <em>(${(data.weights.form * 100).toFixed(1)}%)</em></span><span>${data.formScore.toFixed(2)}</span></div>
        <div class="breakdown-sep"></div>
        <div class="breakdown-row"><span>Guerras no roster</span><span>${data.warsInRoster}</span></div>
        <div class="breakdown-row"><span>Ataques usados</span><span>${data.attacksUsed} / ${data.attacksAvailable}</span></div>
        <div class="breakdown-row"><span>%Destruição média</span><span>${data.avgDestruction.toFixed(1)}%</span></div>
        <div class="breakdown-row"><span>Diferença posicional média</span><span>${data.avgPositionDiff > 0 ? '+' : ''}${data.avgPositionDiff.toFixed(1)}</span></div>
        ${data.hadTh17 ? '<div class="breakdown-note">↑ Inclui guerras em TH17 com peso 0.4</div>' : ''}
        ${!data.hasAnyDefense ? '<div class="breakdown-note">Peso de defesa redistribuído (dados indisponíveis no histórico).</div>' : ''}
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });
}
