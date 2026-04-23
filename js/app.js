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
    if (sortKey === 'totalStars') {
      if (b.avgStars !== a.avgStars) return b.avgStars - a.avgStars;
      return a.lazyCount - b.lazyCount;
    }
    return 0;
  });
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

  tbody.innerHTML = members.map(m => `
    <tr class="war-row" data-tag="${m.tag}">
      <td>
        <div class="member-cell">
          <div class="member-info">
            <div class="member-name">${m.name}</div>
            <div class="member-tag">${m.tag}</div>
          </div>
          ${tierBadgeHtml(m.tag)}
        </div>
      </td>
      <td><span class="th-badge">CV${m.townhallLevel}</span></td>
      <td>⭐ ${m.totalStars}</td>
      <td>${m.avgStars.toFixed(2)}</td>
      <td>${m.totalAttacks}</td>
      <td>${m.totalMissed}</td>
    </tr>
  `).join('');
}

function render(members, wars) {
  const th = document.getElementById('filter-th').value;
  const search = document.getElementById('filter-search').value;
  const filtered = filterMembers(members, th, search);
  const sorted = sortMembers(filtered);
  renderStats(filtered, wars);
  renderTable(sorted, wars);
}

async function init() {
  const playersDataPromise = fetch('./data/players.json').then(r => r.json());
  window._playersData = playersDataPromise;

  const [wars, statsByTag, playersData] = await Promise.all([
    loadData(),
    loadStats(),
    playersDataPromise
  ]);

  window._wars = wars;
  window._statsByTag = statsByTag;

  allMembers = buildMembers(wars);

  render(allMembers, wars);
}

init();