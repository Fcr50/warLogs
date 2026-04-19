let allRanking = [];
let rankSortKey = 'trophies';
let rankSortDir = 'desc';

const ROLE_LABEL = {
  leader: '👑 Líder',
  coLeader: '⚡ Co-líder',
  admin: '🔧 Ancião',
  member: 'Membro',
};

function leagueIcon(player) {
  if (!player.league) return '<span class="league-none">—</span>';
  const icon = player.league.iconUrl
    ? `<img src="${player.league.iconUrl}" class="league-icon" alt="${player.league.name}" title="${player.league.name}" />`
    : '';
  return `<span class="league-name">${icon}${player.league.name}</span>`;
}

function trophyBar(value, max) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return `
    <div class="trophy-bar-wrap">
      <div class="trophy-bar" style="width:${pct}%"></div>
    </div>
  `;
}

function renderRankingTable(players) {
  const tbody = document.getElementById('ranking-tbody');
  if (players.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Nenhum jogador encontrado</div>
          <div class="empty-state-desc">Ajuste o filtro de CV ou a busca para ver resultados.</div>
        </div>
      </td></tr>`;
    return;
  }

  const maxTrophies = Math.max(...players.map(p => p.trophies), 1);
  const maxBB = Math.max(...players.map(p => p.builderBaseTrophies), 1);

  tbody.innerHTML = players.map((p, i) => `
    <tr class="rank-row" data-tag="${p.tag}">
      <td class="rank-pos">${i + 1}</td>
      <td>
        <div class="member-name">${p.name}</div>
        <div class="member-tag">${ROLE_LABEL[p.role] || p.role}</div>
      </td>
      <td><span class="th-badge">CV${p.townhallLevel}</span></td>
      <td><span class="exp-badge">Lv ${p.expLevel}</span></td>
      <td>
        <div class="trophy-cell">
          <span class="trophy-value">🏆 ${p.trophies.toLocaleString('pt-BR')}</span>
          ${trophyBar(p.trophies, maxTrophies)}
          <span class="league-wrap">${leagueIcon(p)}</span>
        </div>
      </td>
      <td>
        <div class="trophy-cell">
          <span class="trophy-value">⚙️ ${p.builderBaseTrophies.toLocaleString('pt-BR')}</span>
          ${trophyBar(p.builderBaseTrophies, maxBB)}
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.rank-row').forEach(row => {
    row.addEventListener('click', () => {
      const tag = row.dataset.tag;
      const player = players.find(p => p.tag === tag);
      if (player) openAttackStatsModal(player);
    });
  });
}

function computeAttackStats(playerTag, wars) {
  const counts = { 3: 0, 2: 0, 1: 0, 0: 0 };
  let totalAttacks = 0;
  let warsParticipated = 0;

  (wars || []).forEach(war => {
    const m = (war.members || []).find(x => x.tag === playerTag);
    if (!m) return;
    warsParticipated++;
    (m.attacks || []).forEach(a => {
      const s = Math.max(0, Math.min(3, a.stars));
      counts[s]++;
      totalAttacks++;
    });
  });

  return { counts, totalAttacks, warsParticipated };
}

function openAttackStatsModal(player) {
  const wars = window._wars || [];
  const { counts, totalAttacks, warsParticipated } = computeAttackStats(player.tag, wars);

  document.getElementById('attack-modal')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'attack-modal';
  backdrop.className = 'modal-backdrop';
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
      <div class="modal-meta">
        ${warsParticipated} guerra${warsParticipated === 1 ? '' : 's'} · ${totalAttacks} ataque${totalAttacks === 1 ? '' : 's'}
      </div>
      <div class="modal-stars-grid">
        <div class="star-stat star-3"><div class="star-label">⭐⭐⭐</div><div class="star-count">${counts[3]}</div></div>
        <div class="star-stat star-2"><div class="star-label">⭐⭐</div><div class="star-count">${counts[2]}</div></div>
        <div class="star-stat star-1"><div class="star-label">⭐</div><div class="star-count">${counts[1]}</div></div>
        <div class="star-stat star-0"><div class="star-label">0 ⭐</div><div class="star-count">${counts[0]}</div></div>
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

function filterRanking(players, th, search) {
  return players.filter(p => {
    const thMatch = th === 'all' || p.townhallLevel === parseInt(th);
    const searchMatch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return thMatch && searchMatch;
  });
}

function sortRanking(players) {
  return [...players].sort((a, b) => {
    let va = a[rankSortKey], vb = b[rankSortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return rankSortDir === 'asc' ? -1 : 1;
    if (va > vb) return rankSortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderRankingStats(players) {
  const maxTrophies = Math.max(...players.map(p => p.trophies), 0);
  const avgTrophies = players.length
    ? Math.round(players.reduce((s, p) => s + p.trophies, 0) / players.length)
    : 0;
  document.getElementById('stat-r-members').textContent = players.length;
  document.getElementById('stat-r-max').textContent = maxTrophies.toLocaleString('pt-BR');
  document.getElementById('stat-r-avg').textContent = avgTrophies.toLocaleString('pt-BR');
}

function renderRankingThFilter(players) {
  const select = document.getElementById('filter-r-th');
  const levels = [...new Set(players.map(p => p.townhallLevel))].sort((a, b) => b - a);
  const current = select.value;
  select.innerHTML = `<option value="all">Todos os CVs</option>` +
    levels.map(lv => `<option value="${lv}" ${current == lv ? 'selected' : ''}>CV ${lv}</option>`).join('');
}

function renderRanking() {
  const th = document.getElementById('filter-r-th').value;
  const search = document.getElementById('filter-r-search').value;
  const filtered = filterRanking(allRanking, th, search);
  const sorted = sortRanking(filtered);
  renderRankingStats(filtered);
  renderRankingTable(sorted);
}

function setupRankingSort() {
  document.querySelectorAll('#ranking-tab thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (rankSortKey === key) {
        rankSortDir = rankSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        rankSortKey = key;
        rankSortDir = 'desc';
      }
      document.querySelectorAll('#ranking-tab thead th').forEach(t => t.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(rankSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      renderRanking();
    });
  });
}

export async function initRanking(players) {
  allRanking = players;

  if (!allRanking.length) {
    document.getElementById('ranking-tbody').innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-state-icon">🏆</div>
          <div class="empty-state-title">Nenhum dado disponível ainda</div>
          <div class="empty-state-desc">O ranking será exibido assim que os jogadores forem sincronizados.</div>
        </div>
      </td></tr>`;
    return;
  }

  renderRankingThFilter(allRanking);
  renderRanking();
  setupRankingSort();

  document.getElementById('filter-r-th').addEventListener('change', renderRanking);
  document.getElementById('filter-r-search').addEventListener('input', renderRanking);
}
