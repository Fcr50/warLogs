const DATA_URL = './data/wars.json';
const MAX_WARS = 10;

let allMembers = [];
let sortKey = 'totalStars';
let sortDir = 'desc';

async function loadData() {
  const res = await fetch(DATA_URL);
  const data = await res.json();
  return data.wars || [];
}

function buildMembers(wars) {
  const map = {};

  wars.slice(0, MAX_WARS).forEach((war, warIndex) => {
    war.members.forEach(m => {
      if (!map[m.tag]) {
        map[m.tag] = {
          tag: m.tag,
          name: m.name,
          townhallLevel: m.townhallLevel,
          warSlots: [],
        };
      }
      const member = map[m.tag];
      const attacks = m.attacks || [];
      const stars = attacks.reduce((s, a) => s + a.stars, 0);
      member.warSlots.push({
        warIndex,
        participated: true,
        attacks,
        stars,
        missed: m.missedAttacks || 0,
      });
    });
  });

  return Object.values(map).map(m => {
    const participated = m.warSlots.filter(w => w.participated);
    const totalStars = participated.reduce((s, w) => s + w.stars, 0);
    const totalAttacks = participated.reduce((s, w) => s + w.attacks.length, 0);
    const totalMissed = participated.reduce((s, w) => s + w.missed, 0);
    const avgStars = totalAttacks > 0 ? totalStars / totalAttacks : 0;

    const slots = Array.from({ length: Math.min(wars.length, MAX_WARS) }, (_, i) => {
      return m.warSlots.find(w => w.warIndex === i) || null;
    });

    return { ...m, totalStars, totalAttacks, totalMissed, avgStars, slots, warsParticipated: participated.length };
  });
}

function getThLevels(members) {
  return [...new Set(members.map(m => m.townhallLevel))].sort((a, b) => b - a);
}

function filterMembers(members, th, search) {
  return members.filter(m => {
    const thMatch = th === 'all' || m.townhallLevel === parseInt(th);
    const searchMatch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    return thMatch && searchMatch;
  });
}

function sortMembers(members) {
  return [...members].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function dotClass(slot) {
  if (!slot) return 'dot-nowar';
  if (slot.attacks.length === 0) return 'dot-missed';
  const stars = slot.stars;
  if (stars >= 3) return 'dot-3';
  if (stars === 2) return 'dot-2';
  if (stars === 1) return 'dot-1';
  return 'dot-0';
}

function dotLabel(slot) {
  if (!slot) return '-';
  if (slot.attacks.length === 0) return '✗';
  return slot.stars;
}

function dotTitle(slot, warIndex, wars) {
  if (!slot) return 'Não participou';
  if (slot.attacks.length === 0) return 'Ataque perdido';
  const war = wars[warIndex];
  const result = war ? `vs ${war.opponent.name} (${war.result})` : '';
  return `${slot.stars}⭐ ${result}`;
}

function avgClass(avg) {
  if (avg >= 2.5) return 'avg-high';
  if (avg >= 1.5) return 'avg-mid';
  return 'avg-low';
}

function renderStats(members, wars) {
  const totalWars = Math.min(wars.length, MAX_WARS);
  const totalStars = members.reduce((s, m) => s + m.totalStars, 0);
  const totalMissed = members.reduce((s, m) => s + m.totalMissed, 0);
  const wins = wars.slice(0, MAX_WARS).filter(w => w.result === 'win').length;

  document.getElementById('stat-wars').textContent = totalWars;
  document.getElementById('stat-wins').textContent = wins;
  document.getElementById('stat-stars').textContent = totalStars;
  document.getElementById('stat-missed').textContent = totalMissed;
  document.getElementById('stat-members').textContent = members.length;
}

function renderTable(members, wars) {
  const tbody = document.getElementById('tbody');
  const totalWars = Math.min(wars.length, MAX_WARS);

  if (members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="no-data">Nenhum membro encontrado.</td></tr>`;
    return;
  }

  const lazySet = new Set(
    (wars[0]?.sixHourNonAttackers || []).map(m => m.tag)
  );

  tbody.innerHTML = members.map(m => {
    const dots = m.slots.slice(0, totalWars).map((slot, i) => {
      const cls = dotClass(slot);
      const label = dotLabel(slot);
      const title = dotTitle(slot, i, wars);
      return `<div class="war-dot ${cls}" title="${title}">${label}</div>`;
    }).join('');

    const avg    = m.avgStars.toFixed(2);
    const avgCls = avgClass(m.avgStars);
    const isLazy = lazySet.has(m.tag);

    return `
      <tr class="${isLazy ? 'row-lazy' : ''}">
        <td>
          <div class="member-name">${m.name}</div>
          <div class="member-tag">${m.tag}</div>
          ${isLazy ? '<span class="lazy-badge">⚠️ Sem ataque nas 6h</span>' : ''}
        </td>
        <td><span class="th-badge">CV${m.townhallLevel}</span></td>
        <td>
          <div class="stars-cell">
            <span class="stars-count">⭐ ${m.totalStars}</span>
            <span class="wars-count">(${m.warsParticipated} guerras)</span>
          </div>
        </td>
        <td><span class="avg-badge ${avgCls}">${avg}</span></td>
        <td>${m.totalAttacks}</td>
        <td class="${m.totalMissed > 0 ? 'missed-badge' : ''}">${m.totalMissed}</td>
        <td><div class="war-dots">${dots}</div></td>
      </tr>
    `;
  }).join('');
}

function renderThFilter(members) {
  const select = document.getElementById('filter-th');
  const levels = getThLevels(members);
  const current = select.value;
  select.innerHTML = `<option value="all">Todos os CVs</option>` +
    levels.map(lv => `<option value="${lv}" ${current == lv ? 'selected' : ''}>CV ${lv}</option>`).join('');
}

function render(members, wars) {
  const th = document.getElementById('filter-th').value;
  const search = document.getElementById('filter-search').value;
  const filtered = filterMembers(members, th, search);
  const sorted = sortMembers(filtered);
  renderStats(filtered, wars);
  renderTable(sorted, wars);
}

function setupSort() {
  document.querySelectorAll('#wars-tab thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) {
        sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sortKey = key;
        sortDir = 'desc';
      }
      document.querySelectorAll('#wars-tab thead th').forEach(t => t.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      render(allMembers, window._wars);
    });
  });
}

function renderSixHourAlert(wars) {
  const alert = document.getElementById('six-hour-alert');
  const current = wars[0];
  if (!current || !current.sixHourNonAttackers || current.sixHourNonAttackers.length === 0) {
    alert.style.display = 'none';
    return;
  }
  const names = current.sixHourNonAttackers.map(m =>
    `<span class="alert-member"><span class="th-badge">CV${m.townhallLevel}</span> ${m.name}</span>`
  ).join('');
  alert.style.display = 'block';
  alert.innerHTML = `
    <div class="six-hour-alert">
      <div class="alert-title">⚠️ Sem ataque nas primeiras 6 horas — Guerra vs ${current.opponent.name}</div>
      <div class="alert-members">${names}</div>
    </div>`;
}

function setupTabs(onPlayersFirst, onRankingFirst, onReportFirst) {
  const loaded = { players: false, ranking: false, report: false };
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
      if (btn.dataset.tab === 'players' && !loaded.players) {
        loaded.players = true;
        onPlayersFirst();
      }
      if (btn.dataset.tab === 'ranking' && !loaded.ranking) {
        loaded.ranking = true;
        window._playersData.then(data => onRankingFirst(data.players || []));
      }
      if (btn.dataset.tab === 'report' && !loaded.report) {
        loaded.report = true;
        onReportFirst();
      }
    });
  });
}

async function init() {
  const { initPlayers } = await import('./players.js');
  const { initRanking }  = await import('./ranking.js');
  const { initReport }   = await import('./report.js');

  const wars = await loadData();
  window._wars = wars;
  allMembers = buildMembers(wars);

  renderThFilter(allMembers);

  if (wars.length === 0) {
    document.getElementById('tbody').innerHTML =
      `<tr><td colspan="7" class="no-data">Nenhuma guerra registrada ainda. O GitHub Actions irá coletar os dados automaticamente.</td></tr>`;
  } else {
    const lastWar = wars[0];
    document.getElementById('last-updated').textContent =
      `Última guerra registrada: ${lastWar.endTime?.replace('T', ' ').slice(0, 16)} UTC`;
    renderSixHourAlert(wars);
    render(allMembers, wars);
    document.getElementById('filter-th').addEventListener('change', () => render(allMembers, wars));
    document.getElementById('filter-search').addEventListener('input', () => render(allMembers, wars));
    setupSort();
  }

  window._playersData = fetch('./data/players.json').then(r => r.json());
  setupTabs(initPlayers, initRanking, () => initReport(wars));
}

init();
