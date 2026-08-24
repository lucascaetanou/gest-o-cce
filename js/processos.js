// ============================================
// Gestão CCE — Módulo de Processos Administrativos
// ============================================

window.processosData = [];

// Fuzzy Match entre demandas do processo e nomes de médicos
function matchMedicoProcesso(docName, processo) {
  if (!docName || !processo) return false;
  const d = normStr(docName);
  if (!d || d === 'vaga sem profissional' || d.length < 3) return false;

  const desc = normStr(processo.descricao_demanda || '');
  const sei = normStr(processo.numero_sei || '');
  const equipe = normStr(processo.equipe_responsavel || '');

  if (desc.includes(d) || sei.includes(d) || equipe.includes(d)) return true;

  const parts = d.split(' ').filter(p => p.length > 2);
  if (parts.length >= 2) {
    const firstTwo = parts[0] + ' ' + parts[1];
    const firstLast = parts[0] + ' ' + parts[parts.length - 1];
    if (desc.includes(firstTwo) || desc.includes(firstLast)) return true;
  }
  return false;
}

// Carrega lista principal de processos administrativos
async function loadProcessos() {
  const tbody = document.getElementById('processosTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:3rem"><i class="fas fa-spinner fa-spin"></i> Carregando processos...</td></tr>';

    const { data: processos, error } = await supabaseClient
      .from('processos_administrativos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    window.processosData = processos || [];

    updateProcessosDashboard(window.processosData);
    populateEquipesFilter(window.processosData);
    renderProcessosTable(window.processosData);

  } catch (error) {
    console.error('Erro ao carregar processos:', error);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar processos administrativos.</td></tr>';
  }
}

// Atualiza o Dashboard de Processos (Cards de Métricas e Gráficos)
function updateProcessosDashboard(data) {
  const total = data.length;
  let emAndamento = 0;
  let concluidos = 0;
  let pendentes = 0;

  const statusCounts = {};
  const interessadosCounts = {};
  const equipesCounts = {};

  data.forEach(p => {
    const st = (p.status || 'NÃO INFORMADO').toUpperCase();
    const inte = p.interessado || 'NÃO INFORMADO';
    const eq = p.equipe_responsavel || 'NÃO INFORMADA';

    statusCounts[st] = (statusCounts[st] || 0) + 1;
    interessadosCounts[inte] = (interessadosCounts[inte] || 0) + 1;
    equipesCounts[eq] = (equipesCounts[eq] || 0) + 1;

    if (st.includes('ANDAMENTO') || st.includes('ANÁLISE')) emAndamento++;
    else if (st.includes('CONCLUÍDO') || st.includes('ARQUIVADO')) concluidos++;
    else pendentes++;
  });

  animateCounter('statProcTotal', total);
  animateCounter('statProcAndamento', emAndamento);
  animateCounter('statProcConcluidos', concluidos);
  animateCounter('statProcPendentes', pendentes);

  updateProcStatusChart(statusCounts);
  updateProcInteressadosChart(interessadosCounts);
  updateProcEquipesChart(equipesCounts);
}

// Gráficos de Processos
let procStatusChart = null;
let procInteressadosChart = null;
let procEquipesChart = null;

function updateProcStatusChart(statusCounts) {
  const ctx = document.getElementById('chartProcStatus');
  if (!ctx) return;

  const labels = Object.keys(statusCounts);
  const data = Object.values(statusCounts);
  const colors = ['#f59e0b', '#06b6d4', '#10b981', '#ef4444', '#8b5cf6', '#6b7280'];

  if (procStatusChart) {
    procStatusChart.data.labels = labels;
    procStatusChart.data.datasets[0].data = data;
    procStatusChart.update();
  } else {
    procStatusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#8b8fa3', font: { size: 10 } } } },
        cutout: '65%'
      }
    });
  }
}

function updateProcInteressadosChart(interessadosCounts) {
  const ctx = document.getElementById('chartProcInteressados');
  if (!ctx) return;

  const entries = Object.entries(interessadosCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const labels = entries.map(e => e[0].length > 15 ? e[0].substring(0, 15) + '...' : e[0]);
  const data = entries.map(e => e[1]);

  if (procInteressadosChart) {
    procInteressadosChart.data.labels = labels;
    procInteressadosChart.data.datasets[0].data = data;
    procInteressadosChart.update();
  } else {
    procInteressadosChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: 'Demandas', data: data, backgroundColor: 'rgba(6, 182, 212, 0.6)', borderColor: 'rgba(6, 182, 212, 1)', borderWidth: 1, borderRadius: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8b8fa3', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }
}

function updateProcEquipesChart(equipesCounts) {
  const ctx = document.getElementById('chartProcEquipes');
  if (!ctx) return;

  const entries = Object.entries(equipesCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const labels = entries.map(e => e[0].length > 15 ? e[0].substring(0, 15) + '...' : e[0]);
  const data = entries.map(e => e[1]);

  if (procEquipesChart) {
    procEquipesChart.data.labels = labels;
    procEquipesChart.data.datasets[0].data = data;
    procEquipesChart.update();
  } else {
    procEquipesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: 'Processos', data: data, backgroundColor: 'rgba(16, 185, 129, 0.6)', borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 1, borderRadius: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8b8fa3', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }
}

// Renderiza tabela de processos administrativos
function renderProcessosTable(data) {
  const tbody = document.getElementById('processosTableBody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:3rem">Nenhum processo encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = '';

  data.forEach(proc => {
    const tr = document.createElement('tr');
    
    let badgeClass = 'badge-pending';
    const st = (proc.status || '').toUpperCase();
    if (st.includes('CONCLUÍDO') || st.includes('ARQUIVADO')) badgeClass = 'badge-approved';
    else if (st.includes('ANDAMENTO') || st.includes('ANÁLISE')) badgeClass = 'badge-pending';
    else if (st.includes('PENDENTE') || st.includes('SOBRESTADO')) badgeClass = 'badge-rejected';

    const descResumo = (proc.descricao_demanda || '-').length > 50 
      ? proc.descricao_demanda.substring(0, 50) + '...' 
      : proc.descricao_demanda || '-';

    tr.innerHTML = `
      <td>
        <div style="font-weight:600; color:var(--text-primary); font-family:monospace">${escapeHTML(proc.numero_sei || '-')}</div>
      </td>
      <td>
        <div style="font-weight:500">${escapeHTML(proc.interessado || '-')}</div>
        <div style="font-size:0.75rem; color:var(--text-muted)">${escapeHTML(proc.municipio || '')} ${proc.uf ? ' - ' + proc.uf : ''}</div>
      </td>
      <td><span style="font-size:0.85rem">${escapeHTML(proc.equipe_responsavel || '-')}</span></td>
      <td><span style="font-size:0.85rem; color:var(--text-secondary)">${escapeHTML(descResumo)}</span></td>
      <td><span style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(proc.data_recebimento || '-')}</span></td>
      <td><span class="badge ${badgeClass}">${escapeHTML(proc.status || 'Em Análise')}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="viewProcessoDetails('${escapeHTML(proc.id)}')" title="Ver Ficha Completa">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Visualização detalhada do processo
window.viewProcessoDetails = function(id) {
  const proc = (window.processosData || []).find(p => p.id === id);
  if (!proc) return;

  const modal = document.getElementById('modalProcesso');
  const modalBody = document.getElementById('modalProcessoBody');
  if (!modal || !modalBody) return;

  modalBody.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem">
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">
          Identificação do Processo
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Nº Processo SEI:</span> <strong style="font-family:monospace; color:var(--text-primary)">${escapeHTML(proc.numero_sei || '-')}</strong></div>
          <div><span style="color:var(--text-secondary)">Equipe Responsável:</span> <span>${escapeHTML(proc.equipe_responsavel || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Data Recebimento:</span> <span>${escapeHTML(proc.data_recebimento || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Localidade:</span> <span>${escapeHTML(proc.municipio || '-')} / ${escapeHTML(proc.uf || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Vínculo Médico:</span> <span>${escapeHTML(proc.vinculo_medico || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Status:</span> <span class="badge badge-approved">${escapeHTML(proc.status || '-')}</span></div>
        </div>
      </div>

      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">
          Interessado e Demanda
        </h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Interessado:</span> <strong style="color:var(--text-primary)">${escapeHTML(proc.interessado || '-')}</strong></div>
          <div><span style="color:var(--text-secondary)">Última Movimentação:</span> <span>${escapeHTML(proc.data_ultima_movimentacao || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Descrição da Demanda:</span>
            <div style="margin-top:0.5rem; padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:var(--radius-sm); color:var(--text-primary); line-height:1.4">
              ${escapeHTML(proc.descricao_demanda || 'Nenhuma descrição fornecida.')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
};

// Popula filtro de equipes
function populateEquipesFilter(data) {
  const select = document.getElementById('filterEquipeProcessos');
  if (!select || select.options.length > 1) return;

  const equipes = [...new Set(data.map(d => d.equipe_responsavel).filter(Boolean))].sort();
  equipes.forEach(eq => {
    const opt = document.createElement('option');
    opt.value = eq;
    opt.textContent = eq;
    select.appendChild(opt);
  });
}

// Configura eventos dos filtros de processos
function setupProcessosLogic() {
  const searchInput = document.getElementById('searchProcessos');
  const filterStatus = document.getElementById('filterStatusProcessos');
  const filterEquipe = document.getElementById('filterEquipeProcessos');
  const btnLimpar = document.getElementById('btnLimparFiltrosProcessos');
  const btnRefresh = document.getElementById('btnRefreshProcessos');
  const btnExport = document.getElementById('btnExportProcessosExcel');

  if (searchInput) searchInput.addEventListener('input', filterProcessos);
  if (filterStatus) filterStatus.addEventListener('change', filterProcessos);
  if (filterEquipe) filterEquipe.addEventListener('change', filterProcessos);

  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (filterStatus) filterStatus.value = '';
      if (filterEquipe) filterEquipe.value = '';
      renderProcessosTable(window.processosData);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => loadProcessos());
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => exportProcessosExcel());
  }
}

// Filtra processos em memória
function filterProcessos() {
  const query = normStr(document.getElementById('searchProcessos')?.value || '');
  const status = document.getElementById('filterStatusProcessos')?.value || '';
  const equipe = document.getElementById('filterEquipeProcessos')?.value || '';

  const filtered = (window.processosData || []).filter(p => {
    const matchQuery = !query || 
      normStr(p.numero_sei).includes(query) || 
      normStr(p.interessado).includes(query) || 
      normStr(p.municipio).includes(query) || 
      normStr(p.descricao_demanda).includes(query);

    const matchStatus = !status || p.status === status;
    const matchEquipe = !equipe || p.equipe_responsavel === equipe;

    return matchQuery && matchStatus && matchEquipe;
  });

  renderProcessosTable(filtered);
}

// Exporta processos para arquivo CSV
function exportProcessosExcel() {
  const fields = [
    { key: 'numero_sei', label: 'Nº Processo SEI' },
    { key: 'interessado', label: 'Interessado' },
    { key: 'municipio', label: 'Município' },
    { key: 'uf', label: 'UF' },
    { key: 'equipe_responsavel', label: 'Equipe Responsável' },
    { key: 'status', label: 'Status' },
    { key: 'data_recebimento', label: 'Data Recebimento' },
    { key: 'data_ultima_movimentacao', label: 'Última Movimentação' },
    { key: 'vinculo_medico', label: 'Vínculo Médico' },
    { key: 'descricao_demanda', label: 'Descrição da Demanda' }
  ];

  const csv = convertToCSV(window.processosData, fields);
  downloadCSV(csv, `processos_administrativos_${new Date().toISOString().slice(0, 10)}.csv`);
}
