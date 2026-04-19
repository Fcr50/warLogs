import { HERO_IMAGES, HERO_COLORS, HERO_SHORT, EQUIPMENT_IMAGES, HERO_EQUIPMENT_MAP } from './assets.js';

const PLAYERS_URL = './data/players.json';

const HERO_ORDER = [
  'Barbarian King', 'Archer Queen', 'Grand Warden',
  'Royal Champion', 'Minion Prince', 'Dragon Duke',
];

let allPlayers = [];
let playerSortKey = 'townhallLevel';
let playerSortDir = 'desc';

async function loadPlayers() {
  const res = await fetch(PLAYERS_URL);
  return res.json();
}

function heroLvClass(hero) {
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

function buildEqMap(player) {
  const map = {};
  for (const e of (player.allEquipment || [])) map[e.name] = e;
  return map;
}

function heroCard(player, heroName) {
  const hero   = player.heroes.find(h => h.name === heroName);
  const color  = HERO_COLORS[heroName] || '#555';
  const short  = HERO_SHORT[heroName]  || '?';
  const imgUrl = HERO_IMAGES[heroName];
  const eqMap  = buildEqMap(player);
  const equippedNames = new Set(hero?.equipped || []);
  const staticList    = HERO_EQUIPMENT_MAP[heroName] || [];

  // Build display list: equipped items first (always correct), then static map items not already shown
  const shown = new Set();
  const displayList = [];
  for (const name of equippedNames) {
    shown.add(name);
    displayList.push({ name, isEquipped: true });
  }
  for (const name of staticList) {
    if (!shown.has(name)) {
      shown.add(name);
      displayList.push({ name, isEquipped: false });
    }
  }

  const heroImgHtml = imgUrl
    ? `<img class="hc-hero-img" src="${imgUrl}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           alt="${heroName}" />
       <div class="hc-hero-placeholder" style="display:none;background:${color}33;border:2px solid ${color}">
         <span>${short}</span>
       </div>`
    : `<div class="hc-hero-placeholder" style="background:${color}33;border:2px solid ${color}">
         <span>${short}</span>
       </div>`;

  const lvHtml = hero
    ? `<span class="hc-hero-lv ${heroLvClass(hero)}">Lv ${hero.level}</span>`
    : `<span class="hc-hero-lv hlv-none">—</span>`;

  const eqHtml = displayList.map(({ name: eqName, isEquipped }) => {
    const owned  = eqMap[eqName];
    const eqImg  = EQUIPMENT_IMAGES[eqName];
    const imgEl  = eqImg
      ? `<img class="hc-eq-img" src="${eqImg}" alt="${eqName}"
              onerror="this.style.display='none'" />`
      : `<div class="hc-eq-img hc-eq-missing">?</div>`;

    if (!owned) {
      return `<div class="hc-eq-slot hc-eq-unowned" title="${eqName} (não possui)">
        ${imgEl}
        <span class="hc-eq-lv elv-none">—</span>
      </div>`;
    }

    const lvCls = eqLvClass(owned);
    return `<div class="hc-eq-slot${isEquipped ? ' hc-eq-equipped' : ''}"
                 title="${eqName} Lv${owned.level}/${owned.maxLevel}${isEquipped ? ' ✦ Equipado' : ''}">
      ${imgEl}
      <span class="hc-eq-lv ${lvCls}">${owned.level}</span>
    </div>`;
  }).join('');

  const absent = !hero;
  return `
    <div class="hero-card${absent ? ' hero-card-absent' : ''}">
      <div class="hc-header">
        ${heroImgHtml}
        <div class="hc-info">
          <span class="hc-name">${short}</span>
          ${lvHtml}
        </div>
      </div>
      <div class="hc-eq-grid">${eqHtml}</div>
    </div>`;
}

function renderPlayersTable(players) {
  const tbody = document.getElementById('players-tbody');
  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="no-data">Nenhum jogador encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = players.map(p => `
    <tr>
      <td class="player-info-cell">
        <div class="member-name">${p.name}</div>
        <div class="member-tag">${p.tag}</div>
        <span class="th-badge">CV${p.townhallLevel}</span>
      </td>
      <td class="heroes-cell">
        <div class="heroes-row">
          ${HERO_ORDER.map(h => heroCard(p, h)).join('')}
        </div>
      </td>
    </tr>
  `).join('');
}

function filterPlayers(players, th, search) {
  return players.filter(p => {
    const thMatch  = th === 'all' || p.townhallLevel === parseInt(th);
    const nameMatch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return thMatch && nameMatch;
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
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return playerSortDir === 'asc' ? -1 : 1;
    if (va > vb) return playerSortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderPlayersStats(players) {
  const avg = (heroName) => {
    const with_ = players.filter(p => p.heroes.find(h => h.name === heroName));
    if (!with_.length) return '—';
    const sum = with_.reduce((s, p) => s + p.heroes.find(h => h.name === heroName).level, 0);
    return (sum / with_.length).toFixed(1);
  };
  document.getElementById('stat-p-members').textContent = players.length;
  document.getElementById('stat-p-bk').textContent = avg('Barbarian King');
  document.getElementById('stat-p-aq').textContent = avg('Archer Queen');
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
  renderPlayersStats(filtered);
  renderPlayersTable(sortPlayers(filtered));
}

function setupPlayersSort() {
  document.querySelectorAll('#players-tab thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      playerSortDir = (playerSortKey === key && playerSortDir === 'desc') ? 'asc' : 'desc';
      playerSortKey = key;
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
      `<tr><td colspan="2" class="no-data">Nenhum dado disponível ainda.</td></tr>`;
    return;
  }

  renderPlayersThFilter(allPlayers);
  renderPlayers();
  setupPlayersSort();
  document.getElementById('filter-p-th').addEventListener('change', renderPlayers);
  document.getElementById('filter-p-search').addEventListener('input', renderPlayers);
}
