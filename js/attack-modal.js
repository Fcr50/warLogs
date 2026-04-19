export function computeAttackStats(playerTag, wars) {
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

export function openAttackStatsModal(player, wars) {
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
