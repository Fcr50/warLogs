import { openAttackStatsModal } from './attack-modal.js';
import { computeAllStats } from './cwl-score.js';

const DATA_URL = './data/wars.json';
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

// 🔥 NOVO: stats calculado dinamicamente
async function loadStats(wars, players) {
  try {
    return computeAllStats(wars, players);
  } catch (e) {
    console.error('Erro ao calcular stats:', e);
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

    const slots = Array.from({ length: Math.min(wars.length, MAX_WARS) }, (_, i) =>
      m.warSlots.find(w => w.warIndex === i) || null
    );

    const lazyCount = participated.filter(w => w.lazy).length;

    return {
      ...m,
      totalStars,
      totalAttacks,
      totalMissed,
      avgStars,
      lazyCount,
      slots,
      warsParticipated: participated.length
    };
  });
}

function renderTable(members, wars) {
  const tbody = document.getElementById('tbody');

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
  const sorted = [...members].sort((a, b) => b.totalStars - a.totalStars);
  renderTable(sorted, wars);
}

const POLL_INTERVAL_MS = 3 * 60 * 1000;

function startWarPolling() {
  const interval = setInterval(async () => {
    if (document.visibilityState === 'hidden') return;

    try {
      const freshWars = await loadData();
      const players = (await window._playersData).players || [];

      const freshStats = await loadStats(freshWars, players);

      window._wars = freshWars;
      window._statsByTag = freshStats;

      allMembers = buildMembers(freshWars);
      render(allMembers, freshWars);

    } catch (e) {
      console.error('War poll error:', e);
    }
  }, POLL_INTERVAL_MS);
}

async function init() {
  const playersDataPromise = fetch('./data/players.json').then(r => r.json());
  window._playersData = playersDataPromise;

  const [wars, playersData] = await Promise.all([loadData(), playersDataPromise]);

  window._wars = wars;

  // 🔥 CALCULO REAL
  const statsByTag = await loadStats(wars, playersData.players || []);
  window._statsByTag = statsByTag;

  allMembers = buildMembers(wars);

  render(allMembers, wars);

  if (wars[0]?.result === 'inProgress') {
    startWarPolling();
  }
}

init();