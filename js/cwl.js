const CWL_PASS = 'bs50cwl';

export function initCwl() {
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

async function loadRanking() {
  try {
    const res = await fetch('./data/cwl-ranking.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[cwl] pre-computed ranking unavailable, falling back to runtime compute', err);
    const [{ computeCwlRanking }, warsRes, playersRes] = await Promise.all([
      import('./cwl-score.js'),
      fetch('./data/wars.json').then(r => r.json()),
      fetch('./data/players.json').then(r => r.json()),
    ]);
    const result = computeCwlRanking(warsRes.wars || [], playersRes.players || []);
    return {
      generatedAt: null,
      totalWars: result.totalWars,
      liveWar: result.liveWar,
      ranking: result.ranking,
      noDataList: result.noDataList.map(({ player }) => ({ player })),
    };
  }
}

export async function renderCwl() {
  const container = document.getElementById('cwl-content');
  container.innerHTML = `
    <div class="cwl-loading">
      <div class="skeleton-card"><div class="skeleton-box skel-md"></div><div class="skeleton-box skel-lg"></div></div>
      <div class="skeleton-card"><div class="skeleton-box skel-md"></div><div class="skeleton-box skel-lg"></div></div>
    </div>
  `;

  const { generatedAt, totalWars, liveWar, ranking, noDataList } = await loadRanking();

  let html = '';

  if (liveWar) {
    html += `
      <div class="cwl-live-banner">
        <span class="cwl-live-dot">🔴</span>
        <span>Inclui guerra em andamento vs <strong>${escapeHtml(liveWar.opponentName || '?')}</strong> — ${liveWar.totalAttacksDone}/${liveWar.totalAttacksExpected} ataques feitos</span>
      </div>
    `;
  }

  html += `
    <div class="cwl-header">
      <h2 class="cwl-title">🏅 Top CV18 — Ranking de performance</h2>
      <div class="cwl-meta">${totalWars} guerra${totalWars !== 1 ? 's' : ''} completa${totalWars !== 1 ? 's' : ''} analisada${totalWars !== 1 ? 's' : ''} · ${ranking.length} CV18 listados</div>
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
    html += `
      <div class="table-wrapper">
        <table class="cwl-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Membro</th>
              <th>Tier</th>
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
            ${ranking.map((entry, i) => renderRow(entry, i)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const obs = buildObservations(ranking);
  if (obs.length > 0) {
    html += `
      <div class="cwl-observations">
        <strong>Observações:</strong>
        <ul>${obs.map(o => `<li>${o}</li>`).join('')}</ul>
      </div>
    `;
  }

  if (generatedAt) {
    const d = new Date(generatedAt);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    html += `<div class="last-updated">Atualizado em ${hh}:${mm}</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.cwl-row:not(.cwl-row-no-data)').forEach(row => {
    row.addEventListener('click', () => {
      const tag = row.dataset.tag;
      const entry = ranking.find(r => r.player.tag === tag);
      if (entry && entry.data && entry.data.totalAttacks > 0) openBreakdownModal(entry.player, entry.data);
    });
  });
}

const TIER_ICONS = { S: '🟣', A: '🔵', B: '🟢', C: '🔴', F: '⚫' };

function tierBadge(tier) {
  const icon = TIER_ICONS[tier] || '';
  return `<span class="tier-badge tier-${tier.toLowerCase()}">${icon} ${tier}</span>`;
}

function renderRow(entry, index) {
  const { player, data } = entry;
  const status = index < 15 ? 'convocado' : 'reserva';
  const statusLabel = index < 15 ? 'Convocado' : 'Reserva';
  const noData = !data || data.totalAttacks === 0;
  const th17Tag = !noData && data.hadTh17 ? ' <span class="cwl-th17-tag" title="Recém-TH18: guerras em TH17 com peso 0.4">↑17→18</span>' : '';
  const tier = data?.tier || 'F';

  if (noData) {
    return `
      <tr class="cwl-row cwl-row-${status} cwl-row-no-data" data-tag="${escapeHtml(player.tag)}">
        <td class="cwl-pos">${index + 1}</td>
        <td>
          <div class="member-name">${escapeHtml(player.name)}</div>
          <div class="member-tag">${escapeHtml(player.tag)}</div>
        </td>
        <td>${tierBadge(tier)}</td>
        <td class="cwl-score-cell">—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td><span class="cwl-status-badge cwl-status-${status}">${statusLabel}</span></td>
      </tr>
    `;
  }

  const defenseCell = data.hasAnyDefense ? data.defenseScore.toFixed(2) : '—';

  return `
    <tr class="cwl-row cwl-row-${status}" data-tag="${escapeHtml(player.tag)}">
      <td class="cwl-pos">${index + 1}</td>
      <td>
        <div class="member-name">${escapeHtml(player.name)}${th17Tag}</div>
        <div class="member-tag">${escapeHtml(player.tag)}</div>
      </td>
      <td>${tierBadge(tier)}</td>
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

function buildObservations(ranking) {
  const obs = [];
  const lowSample = ranking.filter(r => r.data.warsInRoster < 3);
  if (lowSample.length > 0) {
    const names = lowSample.map(r => escapeHtml(r.player.name)).join(', ');
    obs.push(`Amostra pequena (&lt;3 guerras): ${names}. Scores podem oscilar conforme novas guerras.`);
  }
  const newTh18 = ranking.filter(r => r.data.hadTh17);
  if (newTh18.length > 0) {
    const names = newTh18.map(r => escapeHtml(r.player.name)).join(', ');
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function openBreakdownModal(player, data) {
  document.getElementById('cwl-breakdown-modal')?.remove();
  const backdrop = document.createElement('div');
  backdrop.id = 'cwl-breakdown-modal';
  backdrop.className = 'modal-backdrop';
  const defenseVal = data.hasAnyDefense ? data.defenseScore.toFixed(2) : '<em>sem dados</em>';
  const tier = data.tier || 'F';
  const rawScore = typeof data.rawScore === 'number' ? data.rawScore : data.score;
  const confidence = typeof data.confidence === 'number' ? data.confidence : 1;
  backdrop.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="Fechar">×</button>
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(player.name)}</div>
        <div class="modal-subtitle">
          <span class="th-badge">CV${player.townhallLevel}</span>
          <span class="modal-tag">${escapeHtml(player.tag)}</span>
        </div>
      </div>
      <div class="modal-meta">Score final: <strong>${data.score.toFixed(2)}</strong></div>
      <div class="score-breakdown">
        <div class="breakdown-row"><span>Tier</span><span>${tierBadge(tier)}</span></div>
        <div class="breakdown-row"><span>Score bruto</span><span>${rawScore.toFixed(2)}</span></div>
        <div class="breakdown-row"><span>Confiança</span><span>${confidence.toFixed(2)} <em>(${data.warsInRoster} guerra${data.warsInRoster !== 1 ? 's' : ''})</em></span></div>
        <div class="breakdown-sep"></div>
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
