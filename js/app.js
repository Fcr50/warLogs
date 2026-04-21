import { openAttackStatsModal } from './attack-modal.js';

const DATA_URL = './data/wars.json';
const STATS_URL = './data/cwl-ranking.json';
const MAX_WARS = 10;
const TIER_ICONS = { S: '🟣', A: '🔵', B: '🟢', C: '🔴', F: '⚫' };

export function tierBadgeHtml(tag) {
  const entry = (window._statsByTag || {})[tag];
  const tier = entry && entry.tier;
  if (!tier) return '';
  const icon = TIER_ICONS[tier] || '';
  return `<span class="tier-badge tier-${tier.toLowerCase()}">${icon} ${tier}</span>`;
}

let allMembers = [];
let sortKey = 'totalStars';
let sortDir = 'desc';

async function loadData() {
  const res = await fetch(DATA_URL);
  const data = await res.json();
  return data.wars || [];
}

async function loadStats() {
  try {
    const res = await fetch(STATS_URL, { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return data.statsByTag || {};
  } catch {
    return {};
  }
}

function buildMembers(wars) {
  const map = {};

  wars.slice(0, MAX_WARS).forEach((war, warIndex) => {
    const lazyTags = new Set((war.sixHourNonAttackers || []).map(x => x.tag));
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
        lazy: lazyTags.has(m.tag),
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

    const lazyCount = participated.filter(w => w.lazy).length;
    return { ...m, totalStars, totalAttacks, totalMissed, avgStars, lazyCount, slots, warsParticipated: participated.length };
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
    // Tiebreakers when sorting by stars
    if (sortKey === 'totalStars') {
      if (b.avgStars !== a.avgStars) return b.avgStars - a.avgStars;
      return a.lazyCount - b.lazyCount;
    }
    return 0;
  });
}

function dotClass(slot) {
  if (!slot) return 'dot-nowar';
  if (slot.attacks.length === 0) return 'dot-missed';
  const stars = slot.stars;
  let base;
  if (stars >= 3) base = 'dot-3';
  else if (stars === 2) base = 'dot-2';
  else if (stars === 1) base = 'dot-1';
  else base = 'dot-0';
  if (slot.lazy) base += ' dot-recovered';
  return base;
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
  const suffix = slot.lazy ? ' · atacou após as 6h' : '';
  return `${slot.stars}⭐ ${result}${suffix}`;
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
    const currentSlot = m.slots[0];
    const recoveredCurrent = isLazy && currentSlot && currentSlot.attacks.length > 0;
    const lazyBadge = isLazy
      ? (recoveredCurrent
          ? '<span class="lazy-badge lazy-badge-recovered">✅ Atacou após as 6h</span>'
          : '<span class="lazy-badge">⚠️ Sem ataque nas 6h</span>')
      : '';
    const rowCls = isLazy && !recoveredCurrent ? ' row-lazy' : '';

    return `
      <tr class="war-row${rowCls}" data-tag="${m.tag}">
        <td>
          <div class="member-cell">
            <div class="member-info">
              <div class="member-name">${m.name}</div>
              <div class="member-tag">${m.tag}</div>
              ${lazyBadge}
            </div>
            ${tierBadgeHtml(m.tag)}
          </div>
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

  tbody.querySelectorAll('.war-row').forEach(row => {
    row.addEventListener('click', () => {
      const tag = row.dataset.tag;
      const member = members.find(x => x.tag === tag);
      if (member) openAttackStatsModal(member, wars);
    });
  });
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
  const attacksByTag = new Map((current.members || []).map(m => [m.tag, (m.attacks || []).length]));
  const names = current.sixHourNonAttackers.map(m => {
    const recovered = (attacksByTag.get(m.tag) || 0) > 0;
    const cls = recovered ? 'alert-member alert-member-recovered' : 'alert-member';
    const check = recovered ? ' <span class="alert-member-check">✓</span>' : '';
    const title = recovered ? 'Atacou após as 6h iniciais' : 'Sem ataque registrado';
    return `<span class="${cls}" title="${title}"><span class="th-badge">CV${m.townhallLevel}</span> ${m.name}${check}</span>`;
  }).join('');
  alert.style.display = 'block';
  alert.innerHTML = `
    <div class="six-hour-alert">
      <div class="alert-title">⚠️ Sem ataque nas primeiras 6 horas — Guerra vs ${current.opponent.name}</div>
      <div class="alert-members">${names}</div>
    </div>`;
}

function setupTabs(onPlayersFirst, onRankingFirst, onReportFirst, onAbsencesFirst, onCwlFirst) {
  const loaded = { players: false, ranking: false, report: false, absences: false, cwl: false };
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
      if (btn.dataset.tab === 'absences' && !loaded.absences) {
        loaded.absences = true;
        onAbsencesFirst();
      }
      if (btn.dataset.tab === 'cwl' && !loaded.cwl) {
        loaded.cwl = true;
        onCwlFirst();
      }
    });
  });
}

function setupSecretTrigger() {
  const trigger = document.getElementById('secret-trigger');
  const tabBtn = document.getElementById('cwl-tab-btn');
  if (!trigger || !tabBtn) return;

  if (sessionStorage.getItem('cwl_revealed') === '1') {
    tabBtn.hidden = false;
  }

  const reveal = () => {
    if (!tabBtn.hidden) return;
    tabBtn.hidden = false;
    sessionStorage.setItem('cwl_revealed', '1');
    tabBtn.classList.add('tab-reveal');
    setTimeout(() => tabBtn.classList.remove('tab-reveal'), 1200);
  };

  let count = 0;
  let countTimer;
  trigger.addEventListener('click', () => {
    if (!tabBtn.hidden) return;
    count++;
    clearTimeout(countTimer);
    countTimer = setTimeout(() => { count = 0; }, 3000);
    if (count >= 10) {
      count = 0;
      reveal();
    }
  });

  let holdTimer = null;
  const startHold = e => {
    if (!tabBtn.hidden) return;
    if (e.type === 'touchstart') e.preventDefault();
    clearTimeout(holdTimer);
    holdTimer = setTimeout(reveal, 1200);
  };
  const cancelHold = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
  };
  trigger.addEventListener('touchstart', startHold, { passive: false });
  trigger.addEventListener('touchend', cancelHold);
  trigger.addEventListener('touchcancel', cancelHold);
  trigger.addEventListener('mousedown', startHold);
  trigger.addEventListener('mouseup', cancelHold);
  trigger.addEventListener('mouseleave', cancelHold);
}

async function init() {
  const { initPlayers }   = await import('./players.js');
  const { initRanking }   = await import('./ranking.js');
  const { initReport }    = await import('./report.js');
  const { initAbsences }  = await import('./absences.js');

  const playersDataPromise = fetch('./data/players.json').then(r => r.json());
  window._playersData = playersDataPromise;
  const [wars, statsByTag, playersData] = await Promise.all([loadData(), loadStats(), playersDataPromise]);
  window._wars = wars;
  window._statsByTag = statsByTag;
  allMembers = buildMembers(wars);

  const { initOverview } = await import('./overview.js');
  initOverview(playersData.players || [], statsByTag);

  renderThFilter(allMembers);

  if (wars[0]?.result === 'inProgress') {
    document.getElementById('live-war-badge').hidden = false;
  }

  if (wars.length === 0) {
    document.getElementById('tbody').innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-state-icon">⚔️</div>
          <div class="empty-state-title">Nenhuma guerra registrada ainda</div>
          <div class="empty-state-desc">Os dados serão coletados automaticamente assim que a primeira guerra do clã for sincronizada.</div>
        </div>
      </td></tr>`;
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

  setupSecretTrigger();

  const onCwlFirst = async () => {
    const { initCwl } = await import('./cwl.js');
    initCwl();
  };

  setupTabs(initPlayers, initRanking, () => initReport(wars), initAbsences, onCwlFirst);
}

init();
