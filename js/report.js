export function initReport(wars) {
  const container = document.getElementById('report-list');

  const warsWithData = wars.filter(w =>
    w.sixHourNonAttackers && w.sixHourNonAttackers.length >= 0 && w.startTime
  );

  if (!warsWithData.length) {
    container.innerHTML = `<div class="no-data" style="padding:60px">Nenhum dado de relatório disponível ainda.</div>`;
    return;
  }

  container.innerHTML = warsWithData.map(war => {
    const date = new Date(war.startTime).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const resultClass = war.result === 'win' ? 'res-win' : war.result === 'loss' ? 'res-loss' : 'res-tie';
    const resultLabel = war.result === 'win' ? 'Vitória' : war.result === 'loss' ? 'Derrota' : war.result === 'tie' ? 'Empate' : 'Em andamento';
    const lazy = war.sixHourNonAttackers;

    const isLive = war.result === 'inProgress';
    const membersHtml = lazy.length === 0
      ? `<span class="report-all-ok">✅ ${isLive ? 'Todos já atacaram!' : 'Todos atacaram nas primeiras 6 horas'}</span>`
      : lazy.map(m => `
          <div class="report-member">
            <span class="th-badge">CV${m.townhallLevel}</span>
            <span class="report-member-name">${m.name}</span>
          </div>`).join('');

    return `
      <div class="report-card${lazy.length > 0 ? ' report-card-bad' : ''}">
        <div class="report-header">
          <div class="report-date">📅 ${date}</div>
          <div class="report-vs">vs <strong>${war.opponent.name}</strong></div>
          <span class="report-result ${resultClass}">${resultLabel}</span>
          ${isLive ? '<span class="report-live">🔴 Ao vivo</span>' : ''}
          ${lazy.length > 0 ? `<span class="report-lazy-count">⚠️ ${lazy.length} sem ataque${isLive ? '' : ' nas 6h'}</span>` : ''}
        </div>
        <div class="report-members">${membersHtml}</div>
      </div>`;
  }).join('');
}
