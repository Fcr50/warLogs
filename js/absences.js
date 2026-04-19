export async function initAbsences() {
  const container = document.getElementById('absences-list');

  let data;
  try {
    const res = await fetch('./data/absences.json');
    data = await res.json();
  } catch {
    container.innerHTML = `<div class="no-data" style="padding:60px">Erro ao carregar dados.</div>`;
    return;
  }

  const absent = data.absent || [];

  if (absent.length === 0) {
    container.innerHTML = `<div class="no-data" style="padding:60px">Nenhum membro ausente nas últimas guerras.</div>`;
    return;
  }

  const sorted = [...absent].sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences);

  const updatedAt = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : null;

  container.innerHTML = `
    ${updatedAt ? `<div class="absences-updated">Atualizado no início da última guerra: ${updatedAt}</div>` : ''}
    <div class="absences-grid">
      ${sorted.map((m, i) => {
        const streak = m.consecutiveAbsences;
        const cls = streak >= 5 ? 'streak-critical' : streak >= 3 ? 'streak-high' : streak >= 2 ? 'streak-mid' : 'streak-low';
        return `
          <div class="absence-card ${cls}">
            <div class="absence-rank">#${i + 1}</div>
            <div class="absence-info">
              <div class="absence-name">${m.name}</div>
              <span class="th-badge">CV${m.townhallLevel}</span>
            </div>
            <div class="absence-streak">
              <span class="streak-count">${streak}</span>
              <span class="streak-label">guerra${streak > 1 ? 's' : ''} seguida${streak > 1 ? 's' : ''}</span>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}
