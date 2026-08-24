// ============================================
// Gestão CCE — Módulo de Dashboard
// ============================================

window.dashboardReferencias = [];

// Carrega as estatísticas consolidadas do Dashboard
async function loadDashboardStats() {
  if (!supabaseClient) return;

  try {
    const { data: totalRecords, count, error: errCount } = await supabaseClient
      .from('medicos_municipios')
      .select('*', { count: 'exact', head: true });

    const totalVagas = (!errCount && count !== null) ? count : 1838;

    const { data: medicos, error } = await supabaseClient
      .from('medicos_municipios')
      .select('situacao_profissional, tipo_profissional, municipio, regiao_saude');

    if (error) throw error;

    const total = medicos.length;
    let ativos = 0;
    let desocupadas = 0;
    let profExtra = 0;

    const medicosPorRegiao = {};
    const tipoProfissionalCounts = {};
    const vagasAbertasPorMunicipio = {};
    const totalVagasPorMunicipio = {};

    medicos.forEach(m => {
      const sit = (m.situacao_profissional || '').toUpperCase();
      const mun = m.municipio || 'NÃO INFORMADO';
      const reg = m.regiao_saude || 'OUTRAS';
      const tipo = m.tipo_profissional || 'NÃO INFORMADO';

      totalVagasPorMunicipio[mun] = (totalVagasPorMunicipio[mun] || 0) + 1;

      if (sit.includes('ATIVO')) {
        ativos++;
        medicosPorRegiao[reg] = (medicosPorRegiao[reg] || 0) + 1;
        tipoProfissionalCounts[tipo] = (tipoProfissionalCounts[tipo] || 0) + 1;
      } else if (sit.includes('DESOCUPADA') || sit.includes('VAGA')) {
        desocupadas++;
        vagasAbertasPorMunicipio[mun] = (vagasAbertasPorMunicipio[mun] || 0) + 1;
      } else if (sit.includes('EXTRA')) {
        profExtra++;
      } else {
        if (sit) {
          ativos++;
          medicosPorRegiao[reg] = (medicosPorRegiao[reg] || 0) + 1;
          tipoProfissionalCounts[tipo] = (tipoProfissionalCounts[tipo] || 0) + 1;
        } else {
          desocupadas++;
          vagasAbertasPorMunicipio[mun] = (vagasAbertasPorMunicipio[mun] || 0) + 1;
        }
      }
    });

    const taxaOcupacao = totalVagas > 0 ? Math.round((ativos / totalVagas) * 100) : 0;

    animateCounter('statMedicosAtivos', ativos);
    animateCounter('statVagasDesocupadas', desocupadas);
    animateCounter('statProfExtra', profExtra);

    const elTotal = document.getElementById('statTotalVagas');
    if (elTotal) elTotal.textContent = totalVagas;

    const elTaxa = document.getElementById('statTaxaOcupacao');
    if (elTaxa) elTaxa.textContent = `${taxaOcupacao}%`;

    const elSub = document.getElementById('subTaxaOcupacao');
    if (elSub) elSub.textContent = `${ativos} de ${totalVagas}`;

    updateAlertas(vagasAbertasPorMunicipio, totalVagasPorMunicipio);
    updateMedicosRegiaoChart(medicosPorRegiao);
    updateTipoProfissionalChart(tipoProfissionalCounts);

  } catch (error) {
    console.error('Erro ao carregar estatísticas do dashboard:', error);
  }
}

// Atualiza alertas de desocupação
function updateAlertas(vagasAbertas, totalVagas) {
  const container = document.getElementById('alertasDesocupacao');
  if (!container) return;

  const totalMunicipiosComVagas = Object.keys(vagasAbertas).length;
  const countEl = document.getElementById('alertaMunicipiosCount');
  if (countEl) countEl.textContent = `${totalMunicipiosComVagas} municípios com vagas abertas`;

  if (window.dashboardReferencias && window.dashboardReferencias.length > 0) {
    renderAlertasList(vagasAbertas, 'desc');
  } else {
    supabaseClient
      .from('referencias_regionais')
      .select('municipio, regiao_saude')
      .then(({ data }) => {
        window.dashboardReferencias = data || [];
        renderAlertasList(vagasAbertas, 'desc');
      });
  }
}

// Renderiza lista de alertas de desocupação
function renderAlertasList(vagasAbertas, order = 'desc') {
  const listEl = document.getElementById('listaAlertasDesocupacao');
  if (!listEl) return;

  const regiaoMap = {};
  if (window.dashboardReferencias) {
    window.dashboardReferencias.forEach(r => {
      if (r.municipio) regiaoMap[r.municipio.toUpperCase().trim()] = r.regiao_saude;
    });
  }

  let entries = Object.entries(vagasAbertas);
  if (order === 'desc') {
    entries.sort((a, b) => b[1] - a[1]);
  } else {
    entries.sort((a, b) => a[1] - b[1]);
  }

  listEl.innerHTML = '';
  entries.forEach(([mun, count]) => {
    const reg = regiaoMap[mun.toUpperCase().trim()] || 'Região não identificada';
    const item = document.createElement('div');
    item.className = 'alerta-item';
    item.innerHTML = `
      <div class="alerta-mun-info">
        <div class="alerta-mun-nome">${escapeHTML(mun)}</div>
        <div class="alerta-mun-regiao">${escapeHTML(reg)}</div>
      </div>
      <div class="alerta-mun-stats">
        <span class="alerta-mun-vagas">${count} desocupadas</span>
      </div>
    `;
    listEl.appendChild(item);
  });
}

// Gráfico de Médicos por Região
let medicosRegiaoChart = null;
function updateMedicosRegiaoChart(countsByRegiao) {
  const ctx = document.getElementById('chartMedicosRegiao');
  if (!ctx) return;

  const labels = Object.keys(countsByRegiao);
  const data = Object.values(countsByRegiao);

  if (medicosRegiaoChart) {
    medicosRegiaoChart.data.labels = labels;
    medicosRegiaoChart.data.datasets[0].data = data;
    medicosRegiaoChart.update();
  } else {
    medicosRegiaoChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Médicos Ativos',
          data: data,
          backgroundColor: 'rgba(124, 58, 237, 0.6)',
          borderColor: 'rgba(124, 58, 237, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8b8fa3', font: { family: 'Inter', size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }
}

// Gráfico de Tipos Profissionais
let tipoProfissionalChart = null;
function updateTipoProfissionalChart(tipoCounts) {
  const ctx = document.getElementById('chartTipoProfissional');
  if (!ctx) return;

  const labels = Object.keys(tipoCounts);
  const data = Object.values(tipoCounts);
  const colors = [
    '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6'
  ];

  if (tipoProfissionalChart) {
    tipoProfissionalChart.data.labels = labels;
    tipoProfissionalChart.data.datasets[0].data = data;
    tipoProfissionalChart.update();
  } else {
    tipoProfissionalChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#8b8fa3', font: { family: 'Inter', size: 11 }, boxWidth: 12 }
          }
        },
        cutout: '70%'
      }
    });
  }
}
