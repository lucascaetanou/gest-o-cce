// ============================================
// Gestão CCE — Módulo de Dashboard
// Com Filtro Global por Região & Navegação Rápida
// ============================================

window.dashboardAllDoctors = [];
window.dashboardReferencias = [];
window.dashboardProcessos = [];
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
        'perfil_profissional,ativo_inativo,status,regiao_saude,municipio_atuacao,modalidade,eixo_vaga'
      );
    }

    if (window.dashboardReferencias.length === 0) {
      const { data: referencias } = await supabaseClient
        .from('referencias_regionalizadas')
        .select('*');
      window.dashboardReferencias = referencias || [];
    }

    if (window.dashboardProcessos.length === 0) {
      const { data: processos, error: processosError } = await supabaseClient
        .from('processos_administrativos')
        .select('id,municipio,tipo_demanda,descricao_demanda,interessado,status_processo,equipe_responsavel,data_recebimento,data_ultima_movimentacao,created_at');
      if (processosError) throw processosError;
      window.dashboardProcessos = processos || [];
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

// Helper: Mapa de Município -> Macro Região
function getCityToMacroMap() {
  const map = {};
  (window.dashboardReferencias || []).forEach(r => {
    if (r.municipio_dsei) {
      map[normStr(r.municipio_dsei)] = normStr(r.macro_regiao || '');
    }
  });
  return map;
}

// Helper: Checagem inteligente de vínculo do médico com a macrorregião
function doctorMatchesRegion(d, selectedRegion, cityToMacroMap) {
  if (!selectedRegion || selectedRegion === 'TODAS') return true;

  const selNorm = normStr(selectedRegion);
  const cityNorm = normStr(d.municipio_atuacao);
  const cirNorm = normStr(d.regiao_saude);

  // 1. Checar mapeamento de município da tabela de referências
  if (cityNorm && cityToMacroMap[cityNorm]) {
    const macro = cityToMacroMap[cityNorm];
    if (macro.includes(selNorm) || selNorm.includes(macro)) return true;
    if (selNorm.includes('norte') && (macro.includes('sobral') || macro.includes('norte'))) return true;
    if (selNorm.includes('sobral') && (macro.includes('sobral') || macro.includes('norte'))) return true;
  }

  // 2. Checar correspondência direta
  if (cirNorm.includes(selNorm) || cityNorm.includes(selNorm)) return true;

  // 3. Regiões e CIRs conhecidas do Ceará
  if (selNorm.includes('cariri')) {
    const caririKeywords = ['crato', 'juazeiro', 'barbalha', 'brejo santo', 'iguatu', 'ico', 'cariri', '16', '17', '18', '19', '20'];
    return caririKeywords.some(kw => cirNorm.includes(kw) || cityNorm.includes(kw));
  }
  if (selNorm.includes('sertao') || selNorm.includes('central')) {
    const sertaoKeywords = ['quixada', 'quixeramobim', 'caninde', 'taua', 'sertao', '5', '12', '13'];
    return sertaoKeywords.some(kw => cirNorm.includes(kw) || cityNorm.includes(kw));
  }
  if (selNorm.includes('sobral') || selNorm.includes('norte')) {
    const sobralKeywords = ['sobral', 'acarau', 'camocim', 'crateus', 'tiangua', '7', '8', '9', '10', '11'];
    return sobralKeywords.some(kw => cirNorm.includes(kw) || cityNorm.includes(kw));
  }
  if (selNorm.includes('litoral') || selNorm.includes('jaguaribe')) {
    const litoralKeywords = ['limoeiro', 'russas', 'aracati', 'jaguaribe', 'litoral', '14', '15'];
    return litoralKeywords.some(kw => cirNorm.includes(kw) || cityNorm.includes(kw));
  }
  if (selNorm.includes('fortaleza')) {
    const fortKeywords = ['fortaleza', 'caucaia', 'maracanau', 'baturite', 'cascavel', '1', '2', '3', '4'];
    return fortKeywords.some(kw => cirNorm.includes(kw) || cityNorm.includes(kw));
  }

  return false;
}

// Helper: Checagem inteligente para a lista de alertas
function referenceMatchesRegion(r, selectedRegion) {
  if (!selectedRegion || selectedRegion === 'TODAS') return true;
  const selNorm = normStr(selectedRegion);
  const macroNorm = normStr(r.macro_regiao || '');
  const cirNorm = normStr(r.regiao_saude || '');
  const munNorm = normStr(r.municipio_dsei || '');

  if (macroNorm.includes(selNorm) || selNorm.includes(macroNorm)) return true;
  if (cirNorm.includes(selNorm) || munNorm.includes(selNorm)) return true;

  if (selNorm.includes('cariri')) {
    const caririKeywords = ['crato', 'juazeiro', 'barbalha', 'brejo santo', 'iguatu', 'ico', 'cariri', '16', '17', '18', '19', '20'];
    return caririKeywords.some(kw => macroNorm.includes(kw) || cirNorm.includes(kw) || munNorm.includes(kw));
  }
  if (selNorm.includes('sertao') || selNorm.includes('central')) {
    const sertaoKeywords = ['quixada', 'quixeramobim', 'caninde', 'taua', 'sertao', '5', '12', '13'];
    return sertaoKeywords.some(kw => macroNorm.includes(kw) || cirNorm.includes(kw) || munNorm.includes(kw));
  }
  if (selNorm.includes('sobral') || selNorm.includes('norte')) {
    const sobralKeywords = ['sobral', 'acarau', 'camocim', 'crateus', 'tiangua', '7', '8', '9', '10', '11'];
    return sobralKeywords.some(kw => macroNorm.includes(kw) || cirNorm.includes(kw) || munNorm.includes(kw));
  }
  if (selNorm.includes('litoral') || selNorm.includes('jaguaribe')) {
    const litoralKeywords = ['limoeiro', 'russas', 'aracati', 'jaguaribe', 'litoral', '14', '15'];
    return litoralKeywords.some(kw => macroNorm.includes(kw) || cirNorm.includes(kw) || munNorm.includes(kw));
  }
  if (selNorm.includes('fortaleza')) {
    const fortKeywords = ['fortaleza', 'caucaia', 'maracanau', 'baturite', 'cascavel', '1', '2', '3', '4'];
    return fortKeywords.some(kw => macroNorm.includes(kw) || cirNorm.includes(kw) || munNorm.includes(kw));
  }
  return false;
}

function renderDashboardWithCurrentFilter() {
  const allDoctors = window.dashboardAllDoctors || [];
  const selectedRegion = window.dashboardSelectedRegion;
  const cityToMacroMap = getCityToMacroMap();

  // Filtrar médicos com mapeamento inteligente
  let filteredDoctors = allDoctors;
  if (selectedRegion && selectedRegion !== 'TODAS') {
    filteredDoctors = allDoctors.filter(d => doctorMatchesRegion(d, selectedRegion, cityToMacroMap));
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

  // 5. Panorama de processos administrativos
  renderProcessInsights();
}

function getProcessDemandType(processo) {
  const explicitType = (processo.tipo_demanda || '').trim().toUpperCase();
  if (explicitType && explicitType !== 'OUTROS') return explicitType;

  const text = normStr(`${processo.descricao_demanda || ''} ${processo.interessado || ''}`);
  const categories = [
    ['DESLIGAMENTO', ['deslig', 'descredenc', 'encerramento de vinculo']],
    ['TRANSFERÊNCIA', ['transfer', 'remanej', 'mudanca de municipio']],
    ['AFASTAMENTO', ['afast', 'licenca', 'licenciamento']],
    ['PAGAMENTO', ['pagament', 'bolsa', 'financeir', 'ressarcimento']],
    ['LOTAÇÃO', ['lotacao', 'alocacao', 'provimento', 'vaga']],
    ['DOCUMENTAÇÃO', ['document', 'certidao', 'declaracao', 'cadastro']],
    ['SUBSTITUIÇÃO', ['substitu', 'reposicao']],
    ['SOLICITAÇÃO MUNICIPAL', ['prefeitura', 'secretaria municipal', 'solicitacao municipal']]
  ];
  const inferred = categories.find(([, keywords]) => keywords.some(keyword => text.includes(keyword)));
  return inferred ? inferred[0] : (explicitType || 'OUTROS');
}

function processMatchesDashboardRegion(processo, selectedRegion, cityToMacroMap) {
  if (!selectedRegion || selectedRegion === 'TODAS') return true;
  const city = normStr(processo.municipio || '');
  const macro = cityToMacroMap[city] || '';
  return referenceMatchesRegion({ macro_regiao: macro, municipio_dsei: processo.municipio || '' }, selectedRegion);
}

function isClosedProcess(processo) {
  const status = normStr(processo.status_processo || '');
  return status.includes('concluido') || status.includes('arquivado');
}

function isStaleProcess(processo) {
  if (isClosedProcess(processo)) return false;
  const rawDate = processo.data_ultima_movimentacao || processo.data_recebimento || processo.created_at;
  if (!rawDate) return true;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return true;
  return (Date.now() - date.getTime()) / 86400000 > 30;
}

function updateProcessMetric(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderProcessRanking(containerId, entries, total, filterType) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (entries.length === 0) {
    container.innerHTML = '<div class="process-ranking-empty">Nenhum processo nesta região.</div>';
    return;
  }

  const max = entries[0][1] || 1;
  entries.forEach(([label, count]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'process-ranking-row';
    button.title = `Ver processos: ${label}`;
    button.innerHTML = `
      <span class="process-ranking-name">${escapeHTML(label)}</span>
      <span class="process-ranking-track"><span class="process-ranking-fill" style="width:${Math.max(7, (count / max) * 100)}%"></span></span>
      <span class="process-ranking-value">${count}</span>
    `;
    button.addEventListener('click', () => window.openProcessosFilter(filterType, label));
    container.appendChild(button);
  });
}

function renderProcessInsights() {
  const selectedRegion = window.dashboardSelectedRegion;
  const cityToMacroMap = getCityToMacroMap();
  const all = window.dashboardProcessos || [];
  const processos = all.filter(p => processMatchesDashboardRegion(p, selectedRegion, cityToMacroMap));
  const open = processos.filter(p => !isClosedProcess(p));
  const analysis = processos.filter(p => normStr(p.status_processo || '').includes('analise'));
  const stale = processos.filter(isStaleProcess);
  const concluded = processos.filter(isClosedProcess);
  const cities = new Set(processos.map(p => (p.municipio || '').trim()).filter(Boolean));
  const completionRate = processos.length ? Math.round((concluded.length / processos.length) * 100) : 0;

  updateProcessMetric('dashProcTotal', processos.length.toLocaleString('pt-BR'));
  updateProcessMetric('dashProcAbertos', open.length.toLocaleString('pt-BR'));
  updateProcessMetric('dashProcAnalise', analysis.length.toLocaleString('pt-BR'));
  updateProcessMetric('dashProcParados', stale.length.toLocaleString('pt-BR'));
  updateProcessMetric('dashProcMunicipios', cities.size.toLocaleString('pt-BR'));
  updateProcessMetric('dashProcConclusao', `${completionRate}%`);
  updateProcessMetric('dashDemandTotal', `${processos.length.toLocaleString('pt-BR')} classificadas`);
  const mapSummary = document.getElementById('mapProcessSummary');
  if (mapSummary) mapSummary.textContent = `• ${processos.length.toLocaleString('pt-BR')} processos na seleção`;

  const demandMap = {};
  const cityMap = {};
  processos.forEach(p => {
    const demand = getProcessDemandType(p);
    const city = (p.municipio || 'NÃO INFORMADO').trim().toUpperCase();
    demandMap[demand] = (demandMap[demand] || 0) + 1;
    cityMap[city] = (cityMap[city] || 0) + 1;
  });

  const topDemands = Object.entries(demandMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
  renderProcessRanking('dashboardDemandRanking', topDemands, processos.length, 'demanda');
  renderProcessRanking('dashboardCityRanking', topCities, processos.length, 'municipio');
}

window.openProcessosFilter = function(filterType, value) {
  document.getElementById('navProcessos')?.click();
  window.setTimeout(() => {
    if (filterType === 'municipio') {
      const cityInput = document.getElementById('filterProcMunicipio');
      if (cityInput) cityInput.value = value;
    } else {
      const searchInput = document.getElementById('searchProcesso');
      if (searchInput) searchInput.value = value;
    }
    if (typeof filterProcessos === 'function') filterProcessos();
  }, 120);
};

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
    alertas = alertas.filter(r => referenceMatchesRegion(r, selectedRegion));
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
      const searchInput = document.getElementById('searchMedicoCity') || document.getElementById('searchMedico');
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

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const textColor = isLight ? '#475569' : '#8b8fa3';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

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
        backgroundColor: isLight ? 'rgba(124, 58, 237, 0.85)' : 'rgba(124, 58, 237, 0.75)',
        borderColor: '#7c3aed',
        borderWidth: 1.5,
        borderRadius: 8,
        hoverBackgroundColor: '#6d28d9'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor, maxRotation: 25, minRotation: 0, font: { family: 'Inter', size: 10 } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(17, 22, 56, 0.95)',
          titleColor: isLight ? '#0f172a' : '#f0f0ff',
          bodyColor: isLight ? '#475569' : '#8b8fa3',
          borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          titleFont: { family: 'Inter', weight: '700' },
          bodyFont: { family: 'Inter' }
        }
      }
    }
  });
}

function updateTipoProfissionalChart(doctors) {
  const ctx = document.getElementById('chartTipoProfissional');
  const legendContainer = document.getElementById('donutCustomLegend');
  const centerVal = document.getElementById('donutCenterVal');
  const badgeTotal = document.getElementById('badgeTotalProfissionais');
  if (!ctx || !doctors) return;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const borderColor = isLight ? '#ffffff' : '#111638';

  // Cores distintas por Eixo da Vaga
  const colorPalette = {
    'VÍNCULO': '#10b981',        // Emerald Green
    'ESTRATÉGICO': '#8b5cf6',    // Violet / Purple
    'FORMAÇÃO': '#06b6d4',       // Cyan Blue
    'NÃO INFORMADO': '#64748b',  // Slate Gray
    'OUTROS': '#f59e0b'          // Amber
  };

  const dataMap = {
    'VÍNCULO': 0,
    'ESTRATÉGICO': 0,
    'FORMAÇÃO': 0
  };
  let totalAtivos = 0;

  doctors.filter(d => d.ativo_inativo === 'ATIVA' && d.status === 'OCUPADA').forEach(d => {
    let rawEixo = (d.eixo_vaga || '').trim().toUpperCase();
    let eixo = 'NÃO INFORMADO';

    if (rawEixo.includes('VINCULO') || rawEixo.includes('VÍNCULO')) eixo = 'VÍNCULO';
    else if (rawEixo.includes('ESTRATEGICO') || rawEixo.includes('ESTRATÉGICO')) eixo = 'ESTRATÉGICO';
    else if (rawEixo.includes('FORMACAO') || rawEixo.includes('FORMAÇÃO')) eixo = 'FORMAÇÃO';
    else if (rawEixo) eixo = rawEixo;

    dataMap[eixo] = (dataMap[eixo] || 0) + 1;
    totalAtivos++;
  });

  // Remover categorias com 0 para exibição limpa
  const sortedEixos = Object.entries(dataMap)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const labels = sortedEixos.map(p => p[0]);
  const data = sortedEixos.map(p => p[1]);
  const backgroundColors = labels.map(l => colorPalette[l] || '#64748b');

  if (centerVal) centerVal.textContent = totalAtivos.toLocaleString('pt-BR');
  if (badgeTotal) badgeTotal.textContent = `${totalAtivos.toLocaleString('pt-BR')} ativos`;

  // Renderizar Donut Chart
  if (chartTipoProf) chartTipoProf.destroy();

  chartTipoProf = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 2.5,
        borderColor: borderColor,
        hoverOffset: 8,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(17, 22, 56, 0.95)',
          titleColor: isLight ? '#0f172a' : '#f0f0ff',
          bodyColor: isLight ? '#475569' : '#8b8fa3',
          borderColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: function(context) {
              const val = context.parsed || 0;
              const pct = totalAtivos > 0 ? ((val / totalAtivos) * 100).toFixed(1) : 0;
              return ` ${val.toLocaleString('pt-BR')} médicos (${pct}%)`;
            }
          }
        }
      }
    }
  });

  // Renderizar Legenda Rica Customizada (HTML)
  if (legendContainer) {
    legendContainer.innerHTML = '';
    sortedEixos.forEach(([eixo, count], idx) => {
      const color = backgroundColors[idx];
      const pct = totalAtivos > 0 ? ((count / totalAtivos) * 100).toFixed(1) : 0;

      const row = document.createElement('div');
      row.className = 'donut-legend-row';
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.45rem 0.65rem;
        border-radius: var(--radius-sm);
        transition: all 0.2s ease;
        cursor: pointer;
        font-size: 0.85rem;
      `;
      row.onmouseover = () => {
        row.style.background = 'var(--surface-hover)';
        if (chartTipoProf) chartTipoProf.setActiveElements([{ datasetIndex: 0, index: idx }]);
        if (chartTipoProf) chartTipoProf.update();
      };
      row.onmouseout = () => {
        row.style.background = 'transparent';
        if (chartTipoProf) chartTipoProf.setActiveElements([]);
        if (chartTipoProf) chartTipoProf.update();
      };

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0; box-shadow: 0 0 8px ${color}80;"></span>
          <span style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(eixo)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem; flex-shrink: 0; margin-left: 0.75rem;">
          <span style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${count.toLocaleString('pt-BR')}</span>
          <span style="color: var(--text-muted); font-size: 0.78rem; min-width: 42px; text-align: right; font-weight: 500;">${pct}%</span>
        </div>
      `;
      legendContainer.appendChild(row);
    });
  }
}

// Exportações Globais e Redimensionamento Seguro para SPA Mobile
window.renderDashboardWithCurrentFilter = renderDashboardWithCurrentFilter;
window.renderProcessInsights = renderProcessInsights;
window.getProcessDemandType = getProcessDemandType;
window.loadDashboardStats = loadDashboardStats;
window.resizeDashboardCharts = function() {
  if (chartRegiao) {
    try {
      chartRegiao.resize();
      chartRegiao.update('none');
    } catch (e) {
      console.warn('Erro ao redimensionar chartRegiao:', e);
    }
  }
  if (chartTipoProf) {
    try {
      chartTipoProf.resize();
      chartTipoProf.update('none');
    } catch (e) {
      console.warn('Erro ao redimensionar chartTipoProf:', e);
    }
  }
};
