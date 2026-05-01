const LIGA_PASS = 'bs50cwl';

let ligaSortKey = 'totalStars';
let ligaSortDir = 'desc';
let ligaPlayers = [];
let ligaRounds  = [];

export function initLiga() {
  if (sessionStorage.getItem('liga_auth') === '1') {
    renderLiga();
  } else {
    renderPasswordGate();
  }
}

function renderPasswordGate() {
  const container = document.getElementById('liga-content');
  container.innerHTML = `
    <div class="password-gate">
      <div class="password-gate-card">
        <div class="password-gate-lock">🔒</div>
        <div class="password-gate-title">Área restrita</div>
        <div class="password-gate-desc">Digite a senha para acessar os resultados da última liga.</div>
        <form id="liga-password-form" autocomplete="off">
          <input type="password" id="liga-password-input" placeholder="Senha" autocomplete="new-password" spellcheck="false" />
          <button type="submit">Entrar</button>
        </form>
        <div class="password-error" id="liga-password-error" hidden>Senha incorreta</div>
      </div>
    </div>
  `;
  const form  = container.querySelector('#liga-password-form');
  const input = container.querySelector('#liga-password-input');
  const error = container.querySelector('#liga-password-error');
  const card  = container.querySelector('.password-gate-card');
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value === LIGA_PASS) {
      sessionStorage.setItem('liga_auth', '1');
      renderLiga();
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function starDotClass(stars) {
  return stars === 3 ? 'dot-3' : stars === 2 ? 'dot-2' : stars === 1 ? 'dot-1' : 'dot-0';
}

function resultBadge(result) {
  if (result === 'win')        return '<span class="liga-result-badge liga-badge-win">V</span>';
  if (result === 'loss')       return '<span class="liga-result-badge liga-badge-loss">D</span>';
  if (result === 'tie')        return '<span class="liga-result-badge liga-badge-tie">E</span>';
  if (result === 'inProgress') return '<span class="liga-result-badge liga-badge-live">🔴</span>';
  return '';
}

function seasonLabel(season) {
  if (!season) return 'Liga';
  const [year, month] = season.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `Liga ${months[parseInt(month, 10) - 1] || month} ${year}`;
}

function buildPlayers(rounds) {
  const playerMap = {};
  const valid = rounds.filter(Boolean);
  for (const r of valid) {
    for (const m of r.members || []) {
      if (!playerMap[m.tag]) {
        playerMap[m.tag] = { tag: m.tag, name: m.name, townhallLevel: m.townhallLevel, roundAttacks: {} };
      }
      // null = in roster but missed, undefined = not in this round
      playerMap[m.tag].roundAttacks[r.round] = m.attack;
    }
  }
  return Object.values(playerMap).map(p => {
    let totalStars = 0, attacksUsed = 0, attacksMissed = 0, attacksAvailable = 0;
    for (const r of valid) {
      if (!(r.round in p.roundAttacks)) continue;
      attacksAvailable++;
      const atk = p.roundAttacks[r.round];
      if (atk != null) { totalStars += atk.stars; attacksUsed++; }
      else { attacksMissed++; }
    }
    return { ...p, totalStars, attacksUsed, attacksMissed, attacksAvailable };
  });
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    if (ligaSortKey === 'name') {
      const cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      return ligaSortDir === 'asc' ? cmp : -cmp;
    }
    if (ligaSortKey === 'townhallLevel') {
      const cmp = a.townhallLevel - b.townhallLevel;
      return ligaSortDir === 'asc' ? cmp : -cmp;
    }
    const cmp = b.totalStars - a.totalStars || b.attacksUsed - a.attacksUsed;
    return ligaSortDir === 'asc' ? -cmp : cmp;
  });
}

function renderRow(player, rounds) {
  const cells = rounds.map(r => {
    if (!r) return '<td class="liga-cell liga-cell-nowar">—</td>';
    if (!(r.round in player.roundAttacks)) {
      return '<td class="liga-cell liga-cell-nowar" title="Não escalado">—</td>';
    }
    const atk = player.roundAttacks[r.round];
    if (atk == null) {
      return '<td class="liga-cell liga-cell-missed" title="Ataque perdido">✗</td>';
    }
    const cls = starDotClass(atk.stars);
    const pct = atk.destructionPercentage != null ? atk.destructionPercentage.toFixed(0) : '?';
    const pos = atk.defenderMapPosition ? ` · pos ${atk.defenderMapPosition}` : '';
    return `<td class="liga-cell"><div class="war-dot ${cls}" title="${atk.stars}⭐ ${pct}%${pos}">${atk.stars}</div></td>`;
  }).join('');

  const missedCls = player.attacksMissed > 0 ? 'missed-badge' : '';
  return `
    <tr class="liga-row" data-tag="${escapeHtml(player.tag)}">
      <td>
        <div class="member-name">${escapeHtml(player.name)}</div>
        <div class="member-tag">${escapeHtml(player.tag)}</div>
      </td>
      <td><span class="th-badge">CV${player.townhallLevel}</span></td>
      ${cells}
      <td class="liga-total-stars">⭐ ${player.totalStars}</td>
      <td>${player.attacksUsed}/${player.attacksAvailable}</td>
      <td class="${missedCls}">${player.attacksMissed || '—'}</td>
    </tr>
  `;
}

export async function renderLiga() {
  const container = document.getElementById('liga-content');
  container.innerHTML = `
    <div class="cwl-loading">
      <div class="skeleton-card"><div class="skeleton-box skel-md"></div><div class="skeleton-box skel-lg"></div></div>
      <div class="skeleton-card"><div class="skeleton-box skel-md"></div><div class="skeleton-box skel-lg"></div></div>
    </div>
  `;

  let data;
  try {
    const res = await fetch('./data/liga.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.warn('[liga] Failed to load liga.json', err);
  }

  if (!data || data.state === 'notFound' || data.state === 'notInWar') {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚔️</div>
        <div class="empty-state-title">Sem dados de liga disponíveis</div>
        <div class="empty-state-desc">A Liga de Guerras de Clã não está em andamento ou ainda não foi registrada.</div>
      </div>
    `;
    return;
  }

  const { season, rounds, generatedAt } = data;
  ligaRounds  = rounds || [];
  ligaPlayers = buildPlayers(ligaRounds);

  const valid  = ligaRounds.filter(Boolean);
  const wins   = valid.filter(r => r.result === 'win').length;
  const losses = valid.filter(r => r.result === 'loss').length;
  const ties   = valid.filter(r => r.result === 'tie').length;
  const live   = valid.find(r => r.result === 'inProgress');

  let html = '';

  if (live) {
    html += `
      <div class="cwl-live-banner">
        <span class="cwl-live-dot">🔴</span>
        <span>Rodada ${live.round} em andamento vs <strong>${escapeHtml(live.opponentName)}</strong> — ${live.clanStars}⭐ vs ${live.opponentStars}⭐</span>
      </div>
    `;
  }

  html += `
    <div class="cwl-header">
      <h2 class="cwl-title">⚔️ ${escapeHtml(seasonLabel(season))}</h2>
      <div class="cwl-meta">
        ${valid.length} rodada${valid.length !== 1 ? 's' : ''} ·
        <span class="liga-win-count">${wins}V</span>
        <span class="liga-loss-count"> ${losses}D</span>
        ${ties > 0 ? `<span class="liga-tie-count"> ${ties}E</span>` : ''}
        · ${ligaPlayers.length} jogadores
      </div>
    </div>
    <div class="liga-sort-bar">
      <button class="cwl-mode-btn ${ligaSortKey === 'totalStars'    ? 'active' : ''}" data-sort="totalStars">⭐ Estrelas</button>
      <button class="cwl-mode-btn ${ligaSortKey === 'townhallLevel' ? 'active' : ''}" data-sort="townhallLevel">🏛️ CV</button>
      <button class="cwl-mode-btn ${ligaSortKey === 'name'          ? 'active' : ''}" data-sort="name">🔤 Nome</button>
    </div>
  `;

  const roundHeaders = ligaRounds.map((r, i) => {
    if (!r) {
      return `<th class="liga-round-header">R${i + 1}<br><small class="liga-rh-opp">—</small></th>`;
    }
    const opp = r.opponentName.length > 12 ? r.opponentName.slice(0, 12) + '…' : r.opponentName;
    return `
      <th class="liga-round-header" title="vs ${escapeHtml(r.opponentName)} · ${r.clanStars}⭐ vs ${r.opponentStars}⭐">
        R${r.round} ${resultBadge(r.result)}<br>
        <small class="liga-rh-opp">${escapeHtml(opp)}</small>
      </th>
    `;
  }).join('');

  html += `
    <div class="table-wrapper">
      <table class="liga-table">
        <thead>
          <tr>
            <th>Jogador</th>
            <th>CV</th>
            ${roundHeaders}
            <th>⭐ Total</th>
            <th>Ataques</th>
            <th>Falhou</th>
          </tr>
        </thead>
        <tbody id="liga-tbody">
          ${sortPlayers(ligaPlayers).map(p => renderRow(p, ligaRounds)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (generatedAt) {
    const d = new Date(generatedAt);
    html += `<div class="last-updated">Atualizado em ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.liga-sort-bar .cwl-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      if (ligaSortKey === key) {
        ligaSortDir = ligaSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        ligaSortKey = key;
        ligaSortDir = key === 'name' ? 'asc' : 'desc';
      }
      container.querySelectorAll('.liga-sort-bar .cwl-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('liga-tbody').innerHTML =
        sortPlayers(ligaPlayers).map(p => renderRow(p, ligaRounds)).join('');
    });
  });
}
