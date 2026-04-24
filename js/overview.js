import { tierBadgeHtml } from './app.js';

let allPlayers = [];
let statsMap = {};

export function initOverview(players, statsByTag) {
  allPlayers = players;
  statsMap = statsByTag || {};

  renderThFilter();
  renderTable();

  document.getElementById('filter-o-th').addEventListener('change', renderTable);
  document.getElementById('filter-o-search').addEventListener('input', renderTable);
}

function getStats(tag) {
  return statsMap[tag] || { tier: 'F', score: 0, avgStars: 0, totalStars: 0, totalAttacks: 0, warsInRoster: 0, totalMissed: 0 };
}

function rankChangeBadge(s) {
  if (s.prevRank == null || s.rank == null) return '';
  if (s.prevRank > s.rank)  return `<span class="rank-change rank-up"   title="era #${s.prevRank}">🔺</span>`;
  if (s.prevRank < s.rank)  return `<span class="rank-change rank-down"  title="era #${s.prevRank}">🔻</span>`;
  return `<span class="rank-change rank-same" title="mesma posição">➖</span>`;
}

function renderThFilter() {
  const select = document.getElementById('filter-o-th');
  const levels = [...new Set(allPlayers.map(p => p.townhallLevel))].sort((a, b) => b - a);
  const current = select.value;
  select.innerHTML = `<option value="all">Todos os CVs</option>` +
    levels.map(lv => `<option value="${lv}" ${current == lv ? 'selected' : ''}>CV ${lv}</option>`).join('');
}

function filterPlayers() {
  const th = document.getElementById('filter-o-th').value;
  const search = document.getElementById('filter-o-search').value.toLowerCase();
  return allPlayers.filter(p => {
    const thMatch = th === 'all' || p.townhallLevel === parseInt(th);
    const searchMatch = !search || p.name.toLowerCase().includes(search);
    return thMatch && searchMatch;
  });
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const sa = getStats(a.tag);
    const sb = getStats(b.tag);
    const aHas = sa.totalAttacks > 0;
    const bHas = sb.totalAttacks > 0;
    if (aHas !== bHas) return bHas - aHas;
    if (sb.score !== sa.score) return sb.score - sa.score;
    if (sb.totalStars !== sa.totalStars) return sb.totalStars - sa.totalStars;
    if (sb.avgStars !== sa.avgStars) return sb.avgStars - sa.avgStars;
    return sa.totalMissed - sb.totalMissed;
  });
}

function renderTable() {
  const tbody = document.getElementById('overview-tbody');
  const filtered = filterPlayers();
  const sorted = sortPlayers(filtered);

  renderStats(filtered);

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Nenhum membro encontrado</div>
          <div class="empty-state-desc">Ajuste o filtro de CV ou a busca para ver resultados.</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((p, i) => {
    const s = getStats(p.tag);
    const scoreDisplay = s.totalAttacks > 0 ? s.normalizedScore.toFixed(1) : '—';
    const trophies = (p.trophies ?? 0).toLocaleString('pt-BR');
    return `
      <tr class="overview-row" data-tag="${p.tag}">
        <td class="overview-pos">${i + 1}</td>
        <td>
          <div class="member-name">${escapeHtml(p.name)}</div>
          <div class="member-tag">${escapeHtml(p.tag)}</div>
        </td>
        <td>${tierBadgeHtml(p.tag)}${rankChangeBadge(s)}</td>
        <td><span class="th-badge">CV${p.townhallLevel}</span></td>
        <td>${scoreDisplay}</td>
        <td>${s.warsInRoster}</td>
        <td>🏆 ${trophies}</td>
      </tr>
    `;
  }).join('');
}

function renderStats(players) {
  const total = players.length;
  const withAttacks = players.filter(p => getStats(p.tag).totalAttacks > 0).length;
  const avgTrophies = total > 0
    ? Math.round(players.reduce((s, p) => s + (p.trophies ?? 0), 0) / total)
    : 0;
  document.getElementById('stat-o-members').textContent = total;
  document.getElementById('stat-o-active').textContent = withAttacks;
  document.getElementById('stat-o-trophies').textContent = avgTrophies.toLocaleString('pt-BR');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
