const PLAYERS_URL = './data/players.json';

const HERO_ORDER = [
  'Barbarian King',
  'Archer Queen',
  'Grand Warden',
  'Royal Champion',
  'Minion Prince',
  'Dragon Duke',
];

const HERO_SHORT = {
  'Barbarian King': 'BK',
  'Archer Queen': 'AQ',
  'Grand Warden': 'GW',
  'Royal Champion': 'RC',
  'Minion Prince': 'MP',
  'Dragon Duke': 'DD',
};

let allPlayers = [];
let playerSortKey = 'townhallLevel';
let playerSortDir = 'desc';

async function loadPlayers() {
  const res = await fetch(PLAYERS_URL);
  return res.json();
}

function getHeroLevel(player, heroName) {
  const h = player.heroes.find(h => h.name === heroName);
  return h || null;
}

function heroBadge(hero) {
  if (!hero) return `<span class="hero-badge hero-none">—</span>`;
  const pct = hero.level / hero.maxLevel;
  const cls = pct >= 1 ? 'hero-max' : pct >= 0.75 ? 'hero-high' : pct >= 0.5 ? 'hero-mid' : 'hero-low';
  return `<span class="hero-badge ${cls}" title="${hero.name} lv${hero.level}/${hero.maxLevel}">${hero.level}</span>`;
}

function equipmentBar(eq) {
  const pct = Math.round((eq.level / eq.maxLevel) * 100);
  const cls = pct >= 100 ? 'eq-max' : pct >= 75 ? 'eq-high' : pct >= 50 ? 'eq-mid' : 'eq-low';
  return `
    <div class="eq-item" title="${eq.name} lv${eq.level}/${eq.maxLevel}">
      <div class="eq-name">${eq.name}</div>
      <div class="eq-bar-wrap">
        <div class="eq-bar ${cls}" style="width:${pct}%"></div>
      </div>
      <div class="eq-level">${eq.level}/${eq.maxLevel}</div>
    </div>
  `;
}

function renderPlayersTable(players) {
  const tbody = document.getElementById('players-tbody');

  if (players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="no-data">Nenhum jogador encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = players.map(p => {
    const heroes = HERO_ORDER.map(h => heroBadge(getHeroLevel(p, h))).join('');
    const equipment = p.equipment.map(e => equipmentBar(e)).join('');

    return `
      <tr>
        <td>
          <div class="member-name">${p.name}</div>
          <div class="member-tag">${p.tag}</div>
        </td>
        <td><span class="th-badge">CV${p.townhallLevel}</span></td>
        ${HERO_ORDER.map(h => `<td>${heroBadge(getHeroLevel(p, h))}</td>`).join('')}
        <td><div class="eq-grid">${equipment}</div></td>
      </tr>
    `;
  }).join('');
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
  const avgBK = avg(players, 'Barbarian King');
  const avgAQ = avg(players, 'Archer Queen');
  document.getElementById('stat-p-members').textContent = players.length;
  document.getElementById('stat-p-bk').textContent = avgBK;
  document.getElementById('stat-p-aq').textContent = avgAQ;
}

function avg(players, heroName) {
  const withHero = players.filter(p => p.heroes.find(h => h.name === heroName));
  if (!withHero.length) return '—';
  const sum = withHero.reduce((s, p) => s + p.heroes.find(h => h.name === heroName).level, 0);
  return (sum / withHero.length).toFixed(1);
}

function renderPlayersThFilter(players) {
  const select = document.getElementById('filter-p-th');
  const levels = [...new Set(players.map(p => p.townhallLevel))].sort((a, b) => b - a);
  const current = select.value;
  select.innerHTML = `<option value="all">Todos os CVs</option>` +
    levels.map(lv => `<option value="${lv}" ${current == lv ? 'selected' : ''}>CV ${lv}</option>`).join('');
}

function renderPlayers() {
  const th = document.getElementById('filter-p-th').value;
  const search = document.getElementById('filter-p-search').value;
  const filtered = filterPlayers(allPlayers, th, search);
  const sorted = sortPlayers(filtered);
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

  if (allPlayers.length === 0) {
    document.getElementById('players-tbody').innerHTML =
      `<tr><td colspan="9" class="no-data">Nenhum dado disponível ainda.</td></tr>`;
    return;
  }

  renderPlayersThFilter(allPlayers);
  renderPlayers();
  setupPlayersSort();

  document.getElementById('filter-p-th').addEventListener('change', renderPlayers);
  document.getElementById('filter-p-search').addEventListener('input', renderPlayers);
}
