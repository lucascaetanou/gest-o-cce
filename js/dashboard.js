// ============================================
// Gestão CCE — Módulo de Dashboard
// Com Filtro Global por Região & Navegação Rápida
// ============================================

window.dashboardAllDoctors = [];
window.dashboardReferencias = [];
window.dashboardSelectedRegion = 'TODAS';

// Instâncias dos gráficos
let chartRegiao = null;
let chartTipoProf = null;

async function loadDashboardStats() {
  if (!supabaseClient) return;

  try {
    // 1. Carregar dados (apenas se ainda não estiver em memória)
    if (window.dashboardAllDoctors.length === 0) {
      window.dashboardAllDoctors = await fetchAllDoctors(
        'perfil_profissional,ativo_inativo,status,regiao_saude,municipio_atuacao,modalidade'
      );
    }

    if (window.dashboardReferencias.length === 0) {
      const { data: referencias } = await supabaseClient
        .from('referencias_regionalizadas')
        .select('*');
      window.dashboardReferencias = referencias || [];
    }

    // Configurar listener do filtro de região
    setupDashboardRegionFilter();

    // Renderizar métricas e gráficos com o filtro atual
    renderDashboardWithCurrentFilter();

  } catch (error) {
    console.error('Erro ao carregar métricas do dashboard:', error);
  }
}

function setupDashboardRegionFilter() {
  const select = document.getElementById('selectRegiaoDashboard');
  if (select && !select.dataset.listenerAttached) {
    select.dataset.listenerAttached = 'true';
    select.addEventListener('change', () => {
      window.dashboardSelectedRegion = select.value;
      renderDashboardWithCurrentFilter();
    });
  }
}

function renderDashboardWithCurrentFilter() {
  const allDoctors = window.dashboardAllDoctors || [];
  const selectedRegion = window.dashboardSelectedRegion;

  // Filtrar médicos conforme a região selecionada
  let filteredDoctors = allDoctors;
  if (selectedRegion && selectedRegion !== 'TODAS') {
    filteredDoctors = allDoctors.filter(d => normStr(d.regiao_saude).includes(normStr(selectedRegion)));
  }

  // Cálculos
  const ativas = filteredDoctors.filter(d => d.ativo_inativo === 'ATIVA');
  const ocupadas = ativas.filter(d => d.status === 'OCUPADA');
  const desocupadas = ativas.filter(d => d.status === 'DESOCUPADA');
  const emProcesso = ativas.filter(d => d.status === 'EM PROCESSO DE OCUPACAO');
  const federal = ativas.filter(d => d.modalidade && !d.modalidade.toUpperCase().includes('COPARTICIPACAO'));
  const copart = ativas.filter(d => d.modalidade && d.modalidade.toUpperCase().includes('COPARTICIPACAO'));
  const municipios = new Set(filteredDoctors.map(d => d.municipio_atuacao).filter(Boolean));

  const txOcupacao = ativas.length > 0 ? ((ocupadas.length / ativas.length) * 100).toFixed(0) : 0;

  // Atualizar DOM
  const elMed = document.getElementById('statMedicosAtivos'); if (elMed) elMed.textContent = ocupadas.length;
  const elVag = document.getElementById('statTotalVagas'); if (elVag) elVag.textContent = ativas.length;
  const elVagDet = document.getElementById('statVagasDet'); if (elVagDet) elVagDet.textContent = `${federal.length} fed. + ${copart.length} copart.`;
  const elTx = document.getElementById('statTaxaOcupacao'); if (elTx) elTx.textContent = `${txOcupacao}%`;
  const elTxDet = document.getElementById('statTaxaDet'); if (elTxDet) elTxDet.textContent = `${ocupadas.length} de ${ativas.length}`;
  const elDesoc = document.getElementById('statVagasDesocupadas'); if (elDesoc) elDesoc.textContent = desocupadas.length;
  const elExtra = document.getElementById('statProfissionalExtra'); if (elExtra) elExtra.textContent = emProcesso.length;
  const elSec = document.getElementById('statSecretarios'); if (elSec) elSec.textContent = municipios.size;
  const elSecDet = document.getElementById('statSecretariosDet'); if (elSecDet) elSecDet.textContent = `${municipios.size} municípios`;

  const d = new Date();
  const subTitle = document.getElementById('dashSubtitle');
  if (subTitle) {
    const regiaoTexto = selectedRegion === 'TODAS' ? 'Ceará (Todas as Regiões)' : selectedRegion;
    subTitle.textContent = `Lista atualizada em ${d.toLocaleDateString('pt-BR')} • ${municipios.size} municípios ativos (${regiaoTexto})`;
  }

  // 2. Alertas de Desocupação
  renderAlertasList();

  // 3. Gráfico por Região (se TODAS estiver selecionada, mostra todas; senão mostra foco)
  updateMedicosRegiaoChart(filteredDoctors, selectedRegion === 'TODAS');

  // 4. Gráfico Tipo Profissional
  updateTipoProfissionalChart(filteredDoctors);
}

function renderAlertasList() {
  const container = document.getElementById('alertasList');
  const countEl = document.getElementById('alertasCount');
  const sortSelect = document.getElementById('alertasSort');
  const referencias = window.dashboardReferencias || [];
  const selectedRegion = window.dashboardSelectedRegion;

  if (!container) return;

  if (sortSelect && !sortSelect.dataset.listener) {
    sortSelect.addEventListener('change', renderAlertasList);
    sortSelect.dataset.listener = 'true';
  }

  // Filtrar referências por região se aplicável
  let alertas = referencias.filter(r => r.vagas_desocupadas > 0);
  if (selectedRegion && selectedRegion !== 'TODAS') {
    alertas = alertas.filter(r => normStr(r.macro_regiao).includes(normStr(selectedRegion)) || normStr(r.regiao_saude).includes(normStr(selectedRegion)));
  }

  const sortMethod = sortSelect ? sortSelect.value : 'desc';

  alertas.sort((a, b) => {
    if (sortMethod === 'asc') {
      return (a.vagas_desocupadas || 0) - (b.vagas_desocupadas || 0);
    } else if (sortMethod === 'alpha') {
      return (a.municipio_dsei || '').localeCompare(b.municipio_dsei || '');
    } else {
      return (b.vagas_desocupadas || 0) - (a.vagas_desocupadas || 0);
    }
  });

  if (countEl) countEl.textContent = `${alertas.length} municípios com vagas abertas`;
  container.innerHTML = '';

  if (alertas.length === 0) {
    container.innerHTML = '<div style="padding:2.5rem; text-align:center; color:var(--text-muted);"><i class="fas fa-check-circle" style="color:var(--accent-success); margin-bottom:0.5rem; display:block; font-size:1.5rem;"></i>Nenhuma vaga desocupada nesta região.</div>';
    return;
  }

  alertas.forEach(a => {
    const total = a.total_vagas || 0;
    const desc = a.vagas_desocupadas || 0;
    const munName = a.municipio_dsei || '-';

    const item = document.createElement('div');
    item.className = 'alerta-item';
    item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1rem; border-bottom:1px solid var(--border); transition:background 0.2s;';
    item.onmouseover = () => item.style.background = 'var(--surface-hover)';
    item.onmouseout = () => item.style.background = 'transparent';

    item.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:600; color:var(--text-primary); font-size:0.92rem;">${escapeHTML(munName)}</div>
        <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHTML(a.macro_regiao || a.regiao_saude || '-')}</div>
      </div>
      <div style="display:flex; align-items:center; gap:1.25rem;">
        <div style="text-align:right">
          <div style="font-size:1.1rem; font-weight:700; color:var(--accent-danger)">${desc} <span style="font-size:0.75rem; font-weight:400; color:var(--text-muted)">abertas</span></div>
          <div style="font-size:0.75rem; color:var(--text-muted)">de ${total} vagas</div>
        </div>
        <button class="btn btn-ghost btn-xs" style="background:var(--surface); border:1px solid var(--border); font-size:0.75rem; padding:0.35rem 0.65rem;" onclick="window.filtrarMedicosPorMunicipio('${escapeHTML(munName)}')">
          <i class="fas fa-user-md" style="color:var(--accent-primary)"></i> Ver Médicos
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

// Ação Rápida: Ir para aba de médicos filtrada por município
window.filtrarMedicosPorMunicipio = function(municipio) {
  const navMedicos = document.getElementById('navMedicos');
  if (navMedicos) {
    navMedicos.click();
    setTimeout(() => {
      const searchInput = document.getElementById('searchMedico');
      if (searchInput) {
        searchInput.value = municipio;
        searchInput.dispatchEvent(new Event('input'));
        if (window.showToast) {
          window.showToast(`Filtrando médicos de ${municipio}`, 'info');
        }
      }
    }, 150);
  }
};

function updateMedicosRegiaoChart(doctors, showAllRegions) {
  const ctx = document.getElementById('chartMedicosRegiao');
  if (!ctx) return;

  const dataMap = {};
  const source = doctors || [];
  source.filter(d => d.ativo_inativo === 'ATIVA' && d.status === 'OCUPADA').forEach(d => {
    const regiao = d.regiao_saude || 'Não Informado';
    dataMap[regiao] = (dataMap[regiao] || 0) + 1;
  });

  const labels = Object.keys(dataMap).sort((a,b) => dataMap[b] - dataMap[a]);
  const data = labels.map(l => dataMap[l]);

  if (chartRegiao) chartRegiao.destroy();

  chartRegiao = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Médicos Ativos',
        data: data,
        backgroundColor: 'rgba(124, 58, 237, 0.75)',
        borderColor: '#7c3aed',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b8fa3' } },
        x: { grid: { display: false }, ticks: { color: '#8b8fa3', maxRotation: 35, minRotation: 0, font: { size: 10 } } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function updateTipoProfissionalChart(doctors) {
  const ctx = document.getElementById('chartTipoProfissional');
  if (!ctx || !doctors) return;

  const dataMap = {};
  doctors.forEach(d => {
    const perfil = d.perfil_profissional || 'Não Informado';
    dataMap[perfil] = (dataMap[perfil] || 0) + 1;
  });

  const labels = Object.keys(dataMap);
  const data = labels.map(l => dataMap[l]);

  if (chartTipoProf) chartTipoProf.destroy();

  chartTipoProf = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#10b981', '#7c3aed', '#f59e0b', '#ec4899', '#06b6d4', '#3b82f6'],
        borderWidth: 2,
        borderColor: '#111638'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { color: '#f0f0ff', padding: 14, font: { family: 'Inter', size: 11 } } }
      }
    }
  });
}
