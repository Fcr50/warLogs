import { HERO_IMAGES, HERO_COLORS, HERO_SHORT, EQUIPMENT_IMAGES } from './assets.js';

const PLAYERS_URL = './data/players.json';

const HERO_ORDER = [
  'Barbarian King',
  'Archer Queen',
  'Grand Warden',
  'Royal Champion',
  'Minion Prince',
  'Dragon Duke',
];

let allPlayers = [];
let playerSortKey = 'townhallLevel';
let playerSortDir = 'desc';

async function loadPlayers() {
  const res = await fetch(PLAYERS_URL);
  return res.json();
}

function heroLvClass(hero) {
  if (!hero) return '';
  const pct = hero.level / hero.maxLevel;
  if (pct >= 1)    return 'hlv-max';
  if (pct >= 0.75) return 'hlv-high';
  if (pct >= 0.5)  return 'hlv-mid';
  return 'hlv-low';
}

function eqLvClass(eq) {
  const pct = eq.level / eq.maxLevel;
  if (pct >= 1)    return 'elv-max';
  if (pct >= 0.75) return 'elv-high';
  return 'elv-low';
}

function heroFallback(heroName) {
  const color = HERO_COLORS[heroName] || '#555';
  const short = HERO_SHORT[heroName] || '?';
  return `data-hero-fallback="${short}" data-hero-color="${color}"`;
}

function heroCell(player, heroName) {
  const hero = player.heroes.find(h => h.name === heroName);
  const color = HERO_COLORS[heroName] || '#555';
  const short = HERO_SHORT[heroName] || '?';

  if (!hero) {
    return `
      <td class="hero-cell">
        <div class="hero-col hero-absent">
          <div class="hero-placeholder" style="background:${color}22;border:2px dashed ${color}44">
            <span style="color:${color}66">${short}</span>
          </div>
          <span class="hero-lv-none">—</span>
        </div>
      </td>`;
  }

  const imgUrl = HERO_IMAGES[heroName];
  const lvCls  = heroLvClass(hero);

  const imgHtml = imgUrl
    ? `<img class="hero-img" src="${imgUrl}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          alt="${heroName}" />
       <div class="hero-placeholder" style="display:none;background:${color}33;border:2px solid ${color}66">
         <span style="color:${color}">${short}</span>
       </div>`
    : `<div class="hero-placeholder" style="background:${color}33;border:2px solid ${color}66">
         <span style="color:${color}">${short}</span>
       </div>`;

  const eqHtml = (hero.equipment || []).map(eq => {
    const eqImg = EQUIPMENT_IMAGES[eq.name];
    const elv   = eqLvClass(eq);
    const imgEl = eqImg
      ? `<img class="eq-img" src="${eqImg}" alt="${eq.name}" title="${eq.name}"
              onerror="this.style.display='none'" />`
      : `<div class="eq-img-placeholder" title="${eq.name}">⚙️</div>`;
    return `
      <div class="eq-slot" title="${eq.name} Lv${eq.level}/${eq.maxLevel}">
        ${imgEl}
        <span class="eq-lv ${elv}">${eq.level}</span>
      </div>`;
  }).join('');

  return `
    <td class="hero-cell">
      <div class="hero-col">
        ${imgHtml}
        <span class="hero-lv ${lvCls}">Lv ${hero.level}</span>
        <div class="hero-eq-row">${eqHtml}</div>
      </div>
    </td>`;
}

function renderPlayersTable(players) {
  const tbody = document.getElementById('players-tbody');
  if (players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${2 + HERO_ORDER.length}" class="no-data">Nenhum jogador encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = players.map(p => `
    <tr>
      <td class="player-info-cell">
        <div class="member-name">${p.name}</div>
        <div class="member-tag">${p.tag}</div>
        <span class="th-badge">CV${p.townhallLevel}</span>
      </td>
      ${HERO_ORDER.map(h => heroCell(p, h)).join('')}
    </tr>
  `).join('');
}

function filterPlayers(players, th, search) {
  return players.filter(p => {
    const thMatch = th === 'all' || p.townhallLevel === parseInt(th);
    const searchMatch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return thMatch && searchMatch;
  });
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    let va, vb;
    if (HERO_ORDER.includes(playerSortKey)) {
      va = (a.heroes.find(h => h.name === playerSortKey)?.level) ?? -1;
      vb = (b.heroes.find(h => h.name === playerSortKey)?.level) ?? -1;
    } else {
      va = a[playerSortKey];
      vb = b[playerSortKey];
    }
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return playerSortDir === 'asc' ? -1 : 1;
    if (va > vb) return playerSortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderPlayersStats(players) {
  const withBK = players.filter(p => p.heroes.find(h => h.name === 'Barbarian King'));
  const withAQ = players.filter(p => p.heroes.find(h => h.name === 'Archer Queen'));
  const avgBK  = withBK.length
    ? (withBK.reduce((s, p) => s + p.heroes.find(h => h.name === 'Barbarian King').level, 0) / withBK.length).toFixed(1)
    : '—';
  const avgAQ  = withAQ.length
    ? (withAQ.reduce((s, p) => s + p.heroes.find(h => h.name === 'Archer Queen').level, 0) / withAQ.length).toFixed(1)
    : '—';
  document.getElementById('stat-p-members').textContent = players.length;
  document.getElementById('stat-p-bk').textContent = avgBK;
  document.getElementById('stat-p-aq').textContent = avgAQ;
}

function renderPlayersThFilter(players) {
  const select  = document.getElementById('filter-p-th');
  const levels  = [...new Set(players.map(p => p.townhallLevel))].sort((a, b) => b - a);
  const current = select.value;
  select.innerHTML = `<option value="all">Todos os CVs</option>` +
    levels.map(lv => `<option value="${lv}" ${current == lv ? 'selected' : ''}>CV ${lv}</option>`).join('');
}

function renderPlayers() {
  const th     = document.getElementById('filter-p-th').value;
  const search = document.getElementById('filter-p-search').value;
  const filtered = filterPlayers(allPlayers, th, search);
  const sorted   = sortPlayers(filtered);
  renderPlayersStats(sorted);
  renderPlayersTable(sorted);
}

function setupPlayersSort() {
  document.querySelectorAll('#players-tab thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (playerSortKey === key) {
        playerSortDir = playerSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        playerSortKey = key;
        playerSortDir = 'desc';
      }
      document.querySelectorAll('#players-tab thead th').forEach(t => t.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(playerSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      renderPlayers();
    });
  });
}

export async function initPlayers() {
  const data = await loadPlayers();
  allPlayers = data.players || [];

  if (data.updatedAt) {
    document.getElementById('players-updated').textContent =
      `Atualizado em: ${new Date(data.updatedAt).toLocaleString('pt-BR')}`;
  }

  if (!allPlayers.length) {
    document.getElementById('players-tbody').innerHTML =
      `<tr><td colspan="${2 + HERO_ORDER.length}" class="no-data">Nenhum dado disponível ainda.</td></tr>`;
    return;
  }

  renderPlayersThFilter(allPlayers);
  renderPlayers();
  setupPlayersSort();

  document.getElementById('filter-p-th').addEventListener('change', renderPlayers);
  document.getElementById('filter-p-search').addEventListener('input', renderPlayers);
}
