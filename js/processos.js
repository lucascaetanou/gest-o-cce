// ============================================
// Gestão CCE — Módulo de Processos Administrativos
// ============================================

window.processosData = [];


function matchMedicoProcesso(docName, processo) {
  if (!docName || !processo) return false;
  const d = normStr(docName);
  if (!d || d === 'vaga sem profissional' || d.length < 3) return false;

  const intStr = normStr(processo.interessado);
  const descStr = normStr(processo.descricao_demanda);

  // 1. Checa 'interessado' somente se houver conteúdo válido (minimo 3 caracteres)
  if (intStr && intStr.length >= 3) {
    // Nome completo do médico contido no interessado
    if (intStr.includes(d)) return true;
    // Interessado contido no nome do médico (apenas se interessado tiver tamanho relevante >= 6)
    if (d.includes(intStr) && intStr.length >= 6) return true;

    // Match palavra a palavra (primeiro nome + ao menos 1 sobrenome com no minimo 3 letras)
    const dWords = d.split(/\s+/).filter(w => w.length >= 3);
    const intWords = intStr.split(/\s+/).filter(w => w.length >= 3);
    if (dWords.length >= 2 && intWords.length >= 2) {
      const firstMatch = (dWords[0] === intWords[0]);
      const secondMatch = dWords.slice(1).some(w => intWords.includes(w));
      if (firstMatch && secondMatch) return true;
    }
  }

  // 2. Checa 'descricao_demanda' somente se nome do médico estiver presente nela
  if (descStr && descStr.length >= 6 && descStr.includes(d)) {
    return true;
  }

  return false;
}




window.processosData = [];

async function loadProcessos() {
  const tbody = document.getElementById('processosTableBody');
  if (!tbody) return;

  try {
    const { data, error } = await supabaseClient
      .from('processos_administrativos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    window.processosData = data || [];
    window.dashboardProcessos = data || [];
    renderProcessosTable(window.processosData);
    updateProcessosDashboard(window.processosData);
    populateEquipesFilter(window.processosData);
    if (typeof window.renderProcessInsights === 'function') window.renderProcessInsights();
    if (typeof window.refreshRegionReport === 'function') window.refreshRegionReport();
  } catch (err) {
    console.error('Erro ao buscar processos:', err);
    tbody.innerHTML = emptyRow(7, 'Erro ao carregar processos', err.message);
  }
}


function updateProcessosDashboard(data) {
  if (!data) return;

  const total = data.length;
  let analise = 0;
  let sobrestado = 0;
  let concluido = 0;
  let outros = 0;
  let medicosCount = 0;
  let orgaosCount = 0;

  const statusMap = {};
  const equipeMap = {};

  const keywordsOrgao = [
    'SECRETARIA', 'SMS', 'PREFEITURA', 'CONSELHO', 'COSEMS', 'PROCURADORIA', 
    'VARA', 'UNIVERSIDADE', 'UFC', 'DISTRITO', 'DSEI', 'POLICIA', 'POLÍCIA', 
    'SINDICATO', 'UNIAO', 'UNIÃO', 'MINISTERIO', 'MINISTÉRIO', 'GOVERNO'
  ];

  data.forEach(p => {
    // Status
    const st = (p.status_processo || 'NÃO INFORMADO').toUpperCase().trim();
    statusMap[st] = (statusMap[st] || 0) + 1;

    if (st.includes('ANÁLISE') || st.includes('ANALISE')) analise++;
    else if (st.includes('SOBRESTADO')) sobrestado++;
    else if (st.includes('CONCLUÍDO') || st.includes('CONCLUIDO')) concluido++;
    else outros++;

    // Equipes
    const eq = (p.equipe_responsavel || 'NÃO INFORMADA').toUpperCase().trim();
    equipeMap[eq] = (equipeMap[eq] || 0) + 1;

    // Interessados (Médico vs Órgão Público/Secretaria)
    const intStr = (p.interessado || '').toUpperCase().trim();
    const vinculoStr = (p.vinculo_medico || '').toUpperCase().trim();
    const isOrgao = keywordsOrgao.some(kw => intStr.includes(kw));

    if (vinculoStr.includes('CRM') || vinculoStr.includes('RMS')) {
      if (isOrgao) orgaosCount++;
      else medicosCount++;
    } else if (isOrgao) {
      orgaosCount++;
    } else if (intStr) {
      medicosCount++;
    } else {
      orgaosCount++;
    }
  });

  // Atualiza Cards
  const elTotal = document.getElementById('statProcTotal');
  const elAnalise = document.getElementById('statProcAnalise');
  const elSobrestado = document.getElementById('statProcSobrestado');
  const elConcluido = document.getElementById('statProcConcluido');
  const elMedicos = document.getElementById('statProcMedicos');
  const elOrgaos = document.getElementById('statProcOrgaos');

  if (elTotal) elTotal.textContent = total;
  if (elAnalise) elAnalise.textContent = analise;
  if (elSobrestado) elSobrestado.textContent = sobrestado;
  if (elConcluido) elConcluido.textContent = concluido;
  if (elMedicos) elMedicos.textContent = medicosCount;
  if (elOrgaos) elOrgaos.textContent = orgaosCount;
  setNavCount('navCountProcessos', sobrestado);

  // Gráfico 1: Status
  updateProcStatusChart(statusMap);

  // Gráfico 2: Tipo de Interessado (Médicos vs Órgãos Públicos)
  updateProcInteressadosChart(medicosCount, orgaosCount);

  // Gráfico 3: Equipes Responsáveis
  updateProcEquipesChart(equipeMap);
}


function renderStack(stackId, legendId, entries) {
  const stack = document.getElementById(stackId);
  const legend = document.getElementById(legendId);
  const total = entries.reduce((s, e) => s + e[1], 0);
  if (stack) stack.innerHTML = total ? entries.filter(e => e[1] > 0).map(([label, n, color]) => `<i style="flex:${n};background:${color}" title="${escapeHTML(label)}: ${fmtNum(n)}"></i>`).join('') : '';
  if (legend) legend.innerHTML = entries.map(([label, n, color]) => `<span><i class="sw" style="background:${color}"></i>${escapeHTML(label)} <b>${fmtNum(n)}</b></span>`).join('');
}

// Situação dos processos (barra empilhada)
function updateProcStatusChart(statusMap) {
  const palette = s => {
    const n = normStr(s);
    if (n.includes('analise')) return 'var(--warn)';
    if (n.includes('sobrestado')) return 'var(--danger)';
    if (n.includes('concluido')) return 'var(--brand)';
    if (n.includes('andamento')) return 'var(--brand-2)';
    return 'var(--m-e)';
  };
  const entries = Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([s, n]) => [titleCase(s), n, palette(s)]);
  renderStack('procStatusStack', 'procStatusLegend', entries);
}

// Tipo de interessado (médicos x órgãos)
function updateProcInteressadosChart(medicosCount, orgaosCount) {
  renderStack('procIntStack', 'procIntLegend', [
    ['Médicos', medicosCount, 'var(--brand-2)'],
    ['Órgãos / secretarias', orgaosCount, 'var(--m-c)']
  ]);
}

// Equipes responsáveis (barras horizontais, top 7)
function updateProcEquipesChart(equipeMap) {
  const sorted = Object.entries(equipeMap).sort((a, b) => b[1] - a[1]).slice(0, 7);
  if (typeof renderRankList === 'function') {
    renderRankList('procEquipesRank', sorted, label => {
      const sel = document.getElementById('filterProcEquipe');
      if (sel) { sel.value = label; filterProcessos(); sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 'Nenhum processo cadastrado.');
  }
}


function staleCell(p) {
  const closed = normStr(p.status_processo || '').match(/concluido|arquivado/);
  const days = daysSince(p.data_ultima_movimentacao || p.data_recebimento);
  const date = p.data_ultima_movimentacao ? fmtDate(p.data_ultima_movimentacao) : '—';
  if (days === null || closed) return `<span class="muted">${date}</span>`;
  const style = days > 90 ? 'color:var(--danger);font-weight:600' : days > 30 ? 'color:var(--warn);font-weight:600' : 'color:var(--ink-3)';
  return `${date}<div class="cell-sub" style="${style}">há ${plural(days, 'dia', 'dias')}</div>`;
}

function renderProcessosTable(data) {
  const tbody = document.getElementById('processosTableBody');
  const count = document.getElementById('processosCount');
  if (!tbody) return;
  if (count) count.textContent = `${fmtNum((data || []).length)} de ${fmtNum((window.processosData || []).length)} processos`;

  if (!data || data.length === 0) {
    tbody.innerHTML = emptyRow(7, 'Nenhum processo encontrado', 'Nenhum processo corresponde à busca. ',
      '<div style="margin-top:10px"><button class="btn btn-sm" onclick="document.getElementById(\'btnLimparFiltrosProc\')?.click()">Limpar filtros</button></div>');
    return;
  }

  tbody.innerHTML = data.map(p => {
    const demanda = typeof window.getProcessDemandType === 'function' ? window.getProcessDemandType(p) : (p.tipo_demanda || 'OUTROS');
    return `<tr class="click" data-id="${escapeHTML(String(p.id))}">
      <td class="mono" style="white-space:nowrap">${escapeHTML(p.numero_sei || '—')}</td>
      <td>${escapeHTML(p.equipe_responsavel || '—')}</td>
      <td>${escapeHTML(titleCase(p.municipio || '—'))}</td>
      <td style="max-width:240px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHTML(p.interessado || '')}">${escapeHTML(p.interessado || '—')}</div>${p.vinculo_medico ? `<div class="cell-sub">${escapeHTML(p.vinculo_medico)}</div>` : ''}</td>
      <td class="muted">${escapeHTML(titleCase(demanda))}</td>
      <td class="r" style="white-space:nowrap">${staleCell(p)}</td>
      <td>${statusTag(p.status_processo)}</td>
    </tr>`;
  }).join('');
}

document.addEventListener('click', (e) => {
  const tr = e.target.closest('#processosTableBody tr[data-id]');
  if (tr) window.viewProcessoDetails(tr.dataset.id);
});


window.viewProcessoDetails = function(id) {
  const p = (window.processosData || []).find(x => String(x.id) === String(id));
  if (!p) return;

  const modalBody = document.getElementById('modalProcessoBody');
  const modal = document.getElementById('modalProcesso');
  const title = document.getElementById('modalProcessoTitle');
  if (!modalBody || !modal) return;

  if (title) title.innerHTML = `<span class="mono" style="font-size:16px">${escapeHTML(p.numero_sei || 'Processo')}</span>`;
  const days = daysSince(p.data_ultima_movimentacao);

  modalBody.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px">${statusTag(p.status_processo)}<span class="tag info">${escapeHTML(titleCase(p.tipo_demanda || 'Outros'))}</span></div>
    <div class="dsec">Identificação</div>
    ${detailsList([
      ['Nº processo SEI', p.numero_sei ? `<span class="mono">${escapeHTML(p.numero_sei)}</span>` : '', true],
      ['Equipe responsável', p.equipe_responsavel],
      ['Recebido em', fmtDate(p.data_recebimento)],
      ['Município', p.municipio ? `${titleCase(p.municipio)} · ${p.uf || ''}` : '']
    ])}
    <div class="dsec">Andamento</div>
    ${detailsList([
      ['Interessado', p.interessado],
      ['Vínculo do médico', p.vinculo_medico],
      ['Última movimentação', p.data_ultima_movimentacao ? `${fmtDate(p.data_ultima_movimentacao)}${days !== null ? ` (há ${plural(days, 'dia', 'dias')})` : ''}` : ''],
      ['Situação', p.status_processo]
    ])}
    <div class="dsec">Descrição da demanda</div>
    <div class="desc-box">${escapeHTML(p.descricao_demanda || 'Sem descrição registrada.')}</div>
  `;

  modal.classList.add('active');
};


function populateEquipesFilter(data) {
  const select = document.getElementById('filterProcEquipe');
  if (!select || !data) return;

  const currentVal = select.value;
  const equipes = new Set();
  data.forEach(p => {
    if (p.equipe_responsavel) {
      const eq = p.equipe_responsavel.trim().toUpperCase();
      if (eq) equipes.add(eq);
    }
  });

  const sortedEquipes = Array.from(equipes).sort();
  select.innerHTML = '<option value="">Todas as equipes</option>' +
    sortedEquipes.map(eq => `<option value="${escapeHTML(eq)}">${escapeHTML(eq)}</option>`).join('');

  if (currentVal && equipes.has(currentVal)) {
    select.value = currentVal;
  }
}


function setupProcessosLogic() {
  // Configurar ouvintes em TODOS os elementos de filtro
  const filterElementIds = [
    'searchProcesso',
    'filterProcVinculo',
    'filterProcEquipe',
    'filterProcMunicipio',
    'filterProcStatus'
  ];

  filterElementIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', filterProcessos);
      el.addEventListener('change', filterProcessos);
    }
  });

  // Botão Limpar Filtros
  const btnLimpar = document.getElementById('btnLimparFiltrosProc');
  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      filterElementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      filterProcessos();
    });
  }

  // Modal Detalhes — close
  const btnCloseProcesso = document.getElementById('btnCloseProcessoModal');
  const modalProcesso = document.getElementById('modalProcesso');
  if (btnCloseProcesso && modalProcesso) {
    btnCloseProcesso.addEventListener('click', () => modalProcesso.classList.remove('active'));
    modalProcesso.addEventListener('click', (e) => {
      if (e.target === modalProcesso) modalProcesso.classList.remove('active');
    });
  }

  // Modal Novo Processo — open/close
  const modalNovo = document.getElementById('modalNovoProcesso');
  const btnNovoProcesso = document.getElementById('btnNovoProcesso');
  const btnCloseNovo = document.getElementById('btnCloseNovoProcessoModal');
  const btnCancelProcesso = document.getElementById('btnCancelProcesso');

  const closeNovo = () => { if (modalNovo) modalNovo.classList.remove('active'); };

  if (btnNovoProcesso) btnNovoProcesso.addEventListener('click', () => { if (modalNovo) modalNovo.classList.add('active'); });
  if (btnCloseNovo) btnCloseNovo.addEventListener('click', closeNovo);
  if (btnCancelProcesso) btnCancelProcesso.addEventListener('click', closeNovo);

  // Form submit
  const form = document.getElementById('processoForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById('btnSubmitProcesso');
      const origHtml = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      btnSubmit.disabled = true;

      const payload = {
        numero_sei: document.getElementById('procSei').value,
        equipe_responsavel: document.getElementById('procEquipe').value,
        data_recebimento: document.getElementById('procDataReceb').value || null,
        uf: document.getElementById('procUf').value || 'CE',
        municipio: document.getElementById('procMunicipio').value,
        tipo_demanda: document.getElementById('procTipoDemanda').value,
        descricao_demanda: document.getElementById('procDescricao').value,
        interessado: document.getElementById('procInteressado').value,
        vinculo_medico: document.getElementById('procVinculo').value,
        data_ultima_movimentacao: document.getElementById('procDataMov').value || null,
        status_processo: document.getElementById('procStatus').value
      };

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) payload.autor_id = session.user.id;

        const { error } = await supabaseClient.from('processos_administrativos').insert([payload]);
        if (error) throw error;

        form.reset();
        document.getElementById('procUf').value = 'CE';
        closeNovo();
        showAlert('Processo cadastrado com sucesso!', 'success');
        loadProcessos();
      } catch (err) {
        console.error(err);
        showAlert('Erro ao salvar processo: ' + err.message, 'error');
      } finally {
        btnSubmit.innerHTML = origHtml;
        btnSubmit.disabled = false;
      }
    });
  }

  // Export Excel
  const btnExport = document.getElementById('btnExportProcessos');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      if (!window.processosData || window.processosData.length === 0) {
        showAlert('Nenhum processo para exportar.', 'error');
        return;
      }
      exportProcessosExcel(window.processosData);
    });
  }
}


function filterProcessos() {
  if (!window.processosData) return;

  const q = normStr(document.getElementById('searchProcesso')?.value);
  const vinculo = (document.getElementById('filterProcVinculo')?.value || '').trim().toUpperCase();
  const equipe = (document.getElementById('filterProcEquipe')?.value || '').trim().toUpperCase();
  const municipio = normStr(document.getElementById('filterProcMunicipio')?.value);
  const status = normStr(document.getElementById('filterProcStatus')?.value);

  const filtered = window.processosData.filter(p => {
    // 1. Busca textual geral
    if (q) {
      const matchText = normStr(p.interessado).includes(q) ||
                        normStr(p.numero_sei).includes(q) ||
                        normStr(p.tipo_demanda).includes(q) ||
                        normStr(p.descricao_demanda).includes(q) ||
                        normStr(p.municipio).includes(q);
      if (!matchText) return false;
    }

    // 2. Vínculo Médico
    if (vinculo) {
      const pVinculo = (p.vinculo_medico || '').toUpperCase().trim();
      if (vinculo === 'NENHUM') {
        if (pVinculo !== '' && pVinculo !== 'NULL') return false;
      } else {
        if (!pVinculo.includes(vinculo)) return false;
      }
    }

    // 3. Equipe Responsável
    if (equipe) {
      const pEquipe = (p.equipe_responsavel || '').toUpperCase().trim();
      if (pEquipe !== equipe) return false;
    }

    // 4. Município
    if (municipio) {
      if (!normStr(p.municipio).includes(municipio)) return false;
    }

    // 5. Status do Processo
    if (status) {
      const pStatus = normStr(p.status_processo);
      if (!pStatus.includes(status)) return false;
    }

    return true;
  });

  renderProcessosTable(filtered);
}


function exportProcessosExcel(data) {
  // CSV export (opens as Excel)
  const headers = ['Nº', 'Nº PROCESSO SEI', 'EQUIPE RESPONSÁVEL', 'DATA DE RECEBIMENTO DE PROCESSO', 'UF', 'MUNICÍPIO', 'TIPO DE DEMANDA', 'DESCRIÇÃO DA DEMANDA', 'INTERESSADO', 'VÍNCULO DO(A) MÉDICO(A) COM O PROGRAMA', 'DATA DA ÚLTIMA MOVIMENTAÇÃO', 'STATUS DO PROCESSO'];

  let csv = '\uFEFF'; // BOM for UTF-8
  csv += headers.join(';') + '\n';

  data.forEach((p, i) => {
    const dataReceb = p.data_recebimento ? new Date(p.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
    const dataMov = p.data_ultima_movimentacao ? new Date(p.data_ultima_movimentacao + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

    const row = [
      i + 1,
      (p.numero_sei || '-').replace(/;/g, ','),
      (p.equipe_responsavel || '-').replace(/;/g, ','),
      dataReceb,
      p.uf || '-',
      (p.municipio || '-').replace(/;/g, ','),
      (p.tipo_demanda || 'OUTROS').replace(/;/g, ','),
      (p.descricao_demanda || '-').replace(/;/g, ',').replace(/\n/g, ' '),
      (p.interessado || '-').replace(/;/g, ','),
      (p.vinculo_medico || '-').replace(/;/g, ','),
      dataMov,
      p.status_processo || '-'
    ];
    csv += row.join(';') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'processos_administrativos_' + new Date().toISOString().slice(0,10) + '.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  showAlert('Exportação realizada com sucesso!', 'success');
}
