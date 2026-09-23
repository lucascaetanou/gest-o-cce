// ============================================
// Gestão CCE — Módulo de Dashboard
// Com Filtro Global por Região & Navegação Rápida
// ============================================

window.dashboardAllDoctors = [];
window.dashboardReferencias = [];
window.dashboardProcessos = [];
window.dashboardSelectedRegion = 'TODAS';

let rankRegioesShowAll = false;
let alertasShowAll = false;

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

    // Mapa usa as mesmas referências
    if (typeof window.initCearaMap === 'function') window.initCearaMap(window.dashboardReferencias);

  } catch (error) {
    console.error('Erro ao carregar métricas do dashboard:', error);
  }
}

// Opções do filtro saem das macrorregiões cadastradas em referencias_regionalizadas
function setupDashboardRegionFilter() {
  const select = document.getElementById('selectRegiaoDashboard');
  if (!select) return;

  const macros = [...new Set((window.dashboardReferencias || [])
    .map(r => (r.macro_regiao || '').trim())
    .filter(m => m && normStr(m) !== 'nao informado'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  if (macros.length && select.options.length <= 1) {
    macros.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      select.appendChild(opt);
    });
  }

  if (!select.dataset.listenerAttached) {
    select.dataset.listenerAttached = 'true';
    select.addEventListener('change', () => {
      window.dashboardSelectedRegion = select.value;
      renderDashboardWithCurrentFilter();
      if (typeof window.ceMapSelectFromFilter === 'function') window.ceMapSelectFromFilter(select.value);
    });
  }
}

// Chamado pelo mapa ao clicar numa região: mantém o filtro do painel em sincronia
window.setDashboardRegion = function(macro) {
  const select = document.getElementById('selectRegiaoDashboard');
  const value = macro || 'TODAS';
  if (select) {
    if (![...select.options].some(o => o.value === value)) {
      const opt = document.createElement('option');
      opt.value = value; opt.textContent = value;
      select.appendChild(opt);
    }
    select.value = value;
  }
  window.dashboardSelectedRegion = value;
  renderDashboardWithCurrentFilter();
};

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

  // 1. Checar mapeamento de município da tabela de referências.
  //    Se o município tem macrorregião cadastrada, ela decide sozinha (as palavras-chave abaixo
  //    são só reserva para municípios sem cadastro e confundiam números como "1" e "12").
  if (cityNorm && cityToMacroMap[cityNorm] && cityToMacroMap[cityNorm] !== 'nao informado') {
    const macro = cityToMacroMap[cityNorm];
    if (macro.includes(selNorm) || selNorm.includes(macro)) return true;
    if (selNorm.includes('norte') && (macro.includes('sobral') || macro.includes('norte'))) return true;
    if (selNorm.includes('sobral') && (macro.includes('sobral') || macro.includes('norte'))) return true;
    return false;
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

  // Com macrorregião cadastrada, ela decide sozinha
  if (macroNorm && macroNorm !== 'nao informado') {
    if (macroNorm.includes(selNorm) || selNorm.includes(macroNorm)) return true;
    return (selNorm.includes('norte') || selNorm.includes('sobral')) && (macroNorm.includes('norte') || macroNorm.includes('sobral'));
  }
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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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

  const taxa = ativas.length > 0 ? (ocupadas.length / ativas.length) * 100 : 0;

  // Indicadores
  setText('statTaxaOcupacao', `${taxa.toFixed(1).replace('.', ',')}%`);
  const bar = document.getElementById('statTaxaBar'); if (bar) bar.style.width = `${taxa}%`;
  setText('statTaxaDet', `${fmtNum(ocupadas.length)} de ${fmtNum(ativas.length)} vagas preenchidas`);
  setText('statVagasDesocupadas', fmtNum(desocupadas.length));
  setText('statMedicosAtivos', fmtNum(ocupadas.length));
  setText('statTotalVagas', fmtNum(ativas.length));
  setText('statVagasDet', (federal.length + copart.length > 0) ? `${fmtNum(federal.length)} fed. + ${fmtNum(copart.length)} copart.` : '');
  setText('statProfissionalExtra', fmtNum(emProcesso.length));
  setText('statSecretarios', fmtNum(municipios.size));
  setText('statSecretariosDet', 'com vagas do programa');

  const refsNaRegiao = (window.dashboardReferencias || []).filter(r => referenceMatchesRegion(r, selectedRegion));
  const munDesoc = refsNaRegiao.filter(r => (r.vagas_desocupadas || 0) > 0).length;
  setText('statMunDesoc', `em ${plural(munDesoc, 'município', 'municípios')}`);

  const regiaoTexto = (!selectedRegion || selectedRegion === 'TODAS') ? 'todo o estado' : `macrorregião ${selectedRegion}`;
  setText('dashSubtitle', `Atualizado em ${new Date().toLocaleDateString('pt-BR')} · ${plural(municipios.size, 'município', 'municípios')} com vagas · ${regiaoTexto}`);

  renderAlertasList();
  renderRegioesRank(filteredDoctors);
  renderEixo(filteredDoctors);
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

// Lista de barras horizontais; cada linha pode abrir a tela de processos filtrada
function renderRankList(containerId, entries, onClick, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!entries.length) {
    container.innerHTML = `<div class="hint">${escapeHTML(emptyText || 'Nenhum dado nesta seleção.')}</div>`;
    return;
  }

  const max = entries[0][1] || 1;
  entries.forEach(([label, count]) => {
    const row = document.createElement(onClick ? 'button' : 'div');
    row.className = 'rank-row';
    if (onClick) {
      row.type = 'button';
      row.title = `Ver processos: ${label}`;
      row.addEventListener('click', () => onClick(label));
    }
    row.innerHTML = `
      <span>${escapeHTML(titleCase(label))}</span>
      <span class="bar"><i style="width:${Math.max(3, (count / max) * 100)}%"></i></span>
      <span class="n">${fmtNum(count)}</span>`;
    container.appendChild(row);
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

  setText('dashProcTotal', fmtNum(processos.length));
  setText('dashProcAbertos', fmtNum(open.length));
  setText('dashProcAnalise', fmtNum(analysis.length));
  setText('dashProcParados', fmtNum(stale.length));
  setText('dashProcMunicipios', fmtNum(cities.size));
  setText('dashProcConclusao', `${completionRate}%`);
  setText('dashDemandTotal', `· ${plural(processos.length, 'processo', 'processos')}`);
  setText('mapProcessSummary', `· ${plural(processos.length, 'processo', 'processos')} na seleção`);

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
  renderRankList('dashboardDemandRanking', topDemands, label => window.openProcessosFilter('demanda', label), 'Nenhum processo nesta região.');
  renderRankList('dashboardCityRanking', topCities, label => window.openProcessosFilter('municipio', label), 'Nenhum processo nesta região.');
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

// Tabela de municípios com vagas abertas
function occCell(ocupadas, total) {
  const p = total > 0 ? (ocupadas / total) * 100 : 0;
  return `<div class="occ ${p < 60 ? 'low' : ''}"><span class="bar"><i style="width:${p}%"></i></span><span class="num">${fmtNum(ocupadas)}/${fmtNum(total)}</span></div>`;
}
window.occCell = occCell;

function renderAlertasList() {
  const container = document.getElementById('alertasList');
  const sortSelect = document.getElementById('alertasSort');
  const foot = document.getElementById('alertasFoot');
  const more = document.getElementById('alertasMore');
  const referencias = window.dashboardReferencias || [];
  const selectedRegion = window.dashboardSelectedRegion;

  if (!container) return;

  if (sortSelect && !sortSelect.dataset.listener) {
    sortSelect.addEventListener('change', renderAlertasList);
    sortSelect.dataset.listener = 'true';
  }
  if (more && !more.dataset.listener) {
    more.dataset.listener = 'true';
    more.addEventListener('click', () => { alertasShowAll = !alertasShowAll; renderAlertasList(); });
  }

  let alertas = referencias.filter(r => r.vagas_desocupadas > 0);
  if (selectedRegion && selectedRegion !== 'TODAS') {
    alertas = alertas.filter(r => referenceMatchesRegion(r, selectedRegion));
  }

  const sortMethod = sortSelect ? sortSelect.value : 'desc';
  alertas.sort((a, b) => {
    if (sortMethod === 'asc') return (a.vagas_desocupadas || 0) - (b.vagas_desocupadas || 0);
    if (sortMethod === 'alpha') return (a.municipio_dsei || '').localeCompare(b.municipio_dsei || '');
    return (b.vagas_desocupadas || 0) - (a.vagas_desocupadas || 0) || (a.municipio_dsei || '').localeCompare(b.municipio_dsei || '');
  });

  const totalAbertas = alertas.reduce((s, a) => s + (a.vagas_desocupadas || 0), 0);
  setText('alertasCount', `${plural(alertas.length, 'município', 'municípios')} · ${plural(totalAbertas, 'vaga', 'vagas')}`);

  if (alertas.length === 0) {
    container.innerHTML = emptyRow(6, 'Nenhuma vaga desocupada nesta região.', '');
    if (foot) foot.hidden = true;
    return;
  }

  const LIMIT = 10;
  const visible = alertasShowAll ? alertas : alertas.slice(0, LIMIT);
  container.innerHTML = visible.map(a => {
    const total = a.total_vagas || 0;
    const desoc = a.vagas_desocupadas || 0;
    const ocup = a.total_medicos_ativos_pmmb != null ? a.total_medicos_ativos_pmmb : Math.max(0, total - desoc);
    const mun = a.municipio_dsei || '-';
    return `<tr>
      <td class="cell-main">${escapeHTML(titleCase(mun))}</td>
      <td class="muted">${escapeHTML(titleCase(a.regiao_saude || a.macro_regiao || '-'))}</td>
      <td class="r">${fmtNum(total)}</td>
      <td>${occCell(ocup, total)}</td>
      <td class="r"><b class="alert-num">${fmtNum(desoc)}</b></td>
      <td class="r"><button class="lnk" type="button" onclick="window.filtrarMedicosPorMunicipio(decodeURIComponent('${encodeURIComponent(mun)}'))">Ver médicos</button></td>
    </tr>`;
  }).join('');

  if (foot) {
    foot.hidden = alertas.length <= LIMIT;
    setText('alertasFootText', alertasShowAll ? `Mostrando todos os ${alertas.length}` : `Mostrando ${LIMIT} de ${alertas.length}`);
    if (more) more.textContent = alertasShowAll ? 'Mostrar menos' : 'Ver todos';
  }
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
      }
    }, 150);
  }
};

// Médicos ativos por região de saúde (barras horizontais, 8 primeiras + "ver todas")
function renderRegioesRank(doctors) {
  const list = document.getElementById('rankRegioes');
  const toggle = document.getElementById('rankRegioesToggle');
  if (!list) return;

  const dataMap = {};
  (doctors || []).filter(d => d.ativo_inativo === 'ATIVA' && d.status === 'OCUPADA').forEach(d => {
    const regiao = d.regiao_saude || 'Não informado';
    dataMap[regiao] = (dataMap[regiao] || 0) + 1;
  });
  const entries = Object.entries(dataMap).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    list.innerHTML = '<li class="hint">Nenhum médico ativo nesta seleção.</li>';
    if (toggle) toggle.hidden = true;
    return;
  }

  const max = entries[0][1] || 1;
  const visible = rankRegioesShowAll ? entries : entries.slice(0, 8);
  list.innerHTML = visible.map(([label, count]) => `
    <li><span title="${escapeHTML(label)}">${escapeHTML(titleCase(label).replace(/ Regiao /i, ' ').replace(/ Região /i, ' '))}</span>
    <span class="bar"><i style="width:${Math.max(3, (count / max) * 100)}%"></i></span>
    <span class="n">${fmtNum(count)}</span></li>`).join('');

  if (toggle) {
    toggle.hidden = entries.length <= 8;
    toggle.textContent = rankRegioesShowAll ? 'Mostrar menos' : `Ver as ${entries.length} regiões`;
    if (!toggle.dataset.listener) {
      toggle.dataset.listener = 'true';
      toggle.addEventListener('click', () => { rankRegioesShowAll = !rankRegioesShowAll; renderDashboardWithCurrentFilter(); });
    }
  }
}

// Médicos por eixo da vaga: barra empilhada + tabela
function renderEixo(doctors) {
  const stack = document.getElementById('eixoStack');
  const table = document.getElementById('eixoTable');
  if (!stack || !table) return;

  const colors = { 'FORMAÇÃO': 'var(--brand)', 'VÍNCULO': 'var(--brand-2)', 'ESTRATÉGICO': 'var(--m-c)' };
  const dataMap = {};
  let total = 0;
  (doctors || []).filter(d => d.ativo_inativo === 'ATIVA' && d.status === 'OCUPADA').forEach(d => {
    const raw = (d.eixo_vaga || '').trim().toUpperCase();
    let eixo = 'NÃO INFORMADO';
    if (raw.includes('VINCULO') || raw.includes('VÍNCULO')) eixo = 'VÍNCULO';
    else if (raw.includes('ESTRATEGICO') || raw.includes('ESTRATÉGICO')) eixo = 'ESTRATÉGICO';
    else if (raw.includes('FORMACAO') || raw.includes('FORMAÇÃO')) eixo = 'FORMAÇÃO';
    else if (raw) eixo = raw;
    dataMap[eixo] = (dataMap[eixo] || 0) + 1;
    total++;
  });

  const entries = Object.entries(dataMap).sort((a, b) => b[1] - a[1]);
  setText('badgeTotalProfissionais', `· ${fmtNum(total)} ativos`);
  const color = e => colors[e] || 'var(--m-e)';
  stack.innerHTML = entries.map(([e, n]) => `<i style="flex:${n};background:${color(e)}" title="${escapeHTML(e)}: ${fmtNum(n)}"></i>`).join('');
  table.innerHTML = entries.map(([e, n]) => `
    <tr><td><span class="sw" style="background:${color(e)}"></span>&nbsp; ${escapeHTML(titleCase(e))}</td>
    <td class="r">${fmtNum(n)}</td>
    <td class="r muted" style="width:64px">${total ? ((n / total) * 100).toFixed(1).replace('.', ',') : 0}%</td></tr>`).join('')
    || '<tr><td class="hint">Nenhum médico ativo nesta seleção.</td></tr>';
}

// Exportações Globais
window.renderDashboardWithCurrentFilter = renderDashboardWithCurrentFilter;
window.renderProcessInsights = renderProcessInsights;
window.getProcessDemandType = getProcessDemandType;
window.isClosedProcess = isClosedProcess;
window.isStaleProcess = isStaleProcess;
window.loadDashboardStats = loadDashboardStats;
window.resizeDashboardCharts = function() {
  if (typeof window.invalidateCearaMap === 'function') window.invalidateCearaMap();
};
