// ============================================
// Gestão CCE — Módulo de Supervisores (PMMB)
// ============================================

window.supervisoresData = [];
window.currentFilteredSupervisores = [];

async function loadSupervisores() {
  const tbody = document.getElementById('supervisoresTableBody');
  if (!tbody) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('supervisores')
      .select('*')
      .order('nome_supervisor', { ascending: true });
      
    if (error) throw error;
    
    window.supervisoresData = data || [];
    setNavCount('navCountSupervisores', window.supervisoresData.length);
    window.currentFilteredSupervisores = window.supervisoresData;
    populateSupervisorFilters(window.supervisoresData);
    setupSupervisorFilters();
    renderSupervisoresTable(window.supervisoresData);
    
  } catch (err) {
    console.error('Erro ao buscar supervisores:', err);
    tbody.innerHTML = emptyRow(4, 'Erro ao carregar supervisores', err.message);
  }
}

function renderSupervisoresTable(data) {
  const tbody = document.getElementById('supervisoresTableBody');
  const countBadge = document.getElementById('supervisoresCountBadge');
  if (!tbody) return;

  if (countBadge) countBadge.textContent = `${fmtNum(data.length)} de ${fmtNum(window.supervisoresData.length)} supervisores`;

  if (!data || data.length === 0) {
    tbody.innerHTML = emptyRow(4, 'Nenhum supervisor encontrado', 'Ajuste ou limpe os filtros. ',
      '<div style="margin-top:10px"><button class="btn btn-sm" onclick="limparFiltrosSupervisores()">Limpar filtros</button></div>');
    return;
  }

  tbody.innerHTML = data.map(sup => `
    <tr class="click" data-id="${escapeHTML(String(sup.id))}">
      <td><div class="cell-main">${escapeHTML(sup.nome_supervisor || '—')}</div><div class="cell-sub">${escapeHTML(sup.email || '')}</div></td>
      <td>${escapeHTML(sup.sigla_inst || sup.inst_supervisora || '—')}<div class="cell-sub">${escapeHTML(sup.uf_inst || sup.regiao_inst || '')}</div></td>
      <td style="white-space:nowrap">${escapeHTML(sup.telefone_1 || '—')}<div class="cell-sub">${escapeHTML(sup.tipo_tel_1 || '')}</div></td>
      <td>${statusTag(sup.situacao)}</td>
    </tr>`).join('');
}

document.addEventListener('click', (e) => {
  const tr = e.target.closest('#supervisoresTableBody tr[data-id]');
  if (tr) window.showSupervisorDetails(tr.dataset.id);
});

function populateSupervisorFilters(data) {
  if (!data) return;

  const selectInst = document.getElementById('filterInstSupervisores');
  const selectRegiao = document.getElementById('filterRegiaoSupervisores');
  const selectSituacao = document.getElementById('filterSituacaoSupervisores');

  if (selectInst && selectInst.options.length <= 1) {
    const insts = [...new Set(data.map(d => d.inst_supervisora || d.sigla_inst).filter(Boolean))].sort();
    insts.forEach(inst => {
      const opt = document.createElement('option');
      opt.value = inst;
      opt.textContent = inst;
      selectInst.appendChild(opt);
    });
  }

  if (selectRegiao && selectRegiao.options.length <= 1) {
    const regioes = [...new Set(data.map(d => d.regiao_inst || d.uf_inst).filter(Boolean))].sort();
    regioes.forEach(reg => {
      const opt = document.createElement('option');
      opt.value = reg;
      opt.textContent = reg;
      selectRegiao.appendChild(opt);
    });
  }

  if (selectSituacao && selectSituacao.options.length <= 1) {
    const situacoes = [...new Set(data.map(d => d.situacao).filter(Boolean))].sort();
    situacoes.forEach(sit => {
      const opt = document.createElement('option');
      opt.value = sit;
      opt.textContent = sit;
      selectSituacao.appendChild(opt);
    });
  }
}

function setupSupervisorFilters() {
  const searchInput = document.getElementById('searchSupervisores');
  const selectInst = document.getElementById('filterInstSupervisores');
  const selectRegiao = document.getElementById('filterRegiaoSupervisores');
  const selectSituacao = document.getElementById('filterSituacaoSupervisores');
  const btnLimpar = document.getElementById('btnLimparFiltrosSupervisores');
  const btnRefresh = document.getElementById('btnRefreshSupervisores');

  if (searchInput && !searchInput.dataset.listenerAttached) {
    searchInput.dataset.listenerAttached = 'true';
    searchInput.addEventListener('input', filterSupervisores);
  }

  if (selectInst && !selectInst.dataset.listenerAttached) {
    selectInst.dataset.listenerAttached = 'true';
    selectInst.addEventListener('change', filterSupervisores);
  }

  if (selectRegiao && !selectRegiao.dataset.listenerAttached) {
    selectRegiao.dataset.listenerAttached = 'true';
    selectRegiao.addEventListener('change', filterSupervisores);
  }

  if (selectSituacao && !selectSituacao.dataset.listenerAttached) {
    selectSituacao.dataset.listenerAttached = 'true';
    selectSituacao.addEventListener('change', filterSupervisores);
  }

  if (btnLimpar && !btnLimpar.dataset.listenerAttached) {
    btnLimpar.dataset.listenerAttached = 'true';
    btnLimpar.addEventListener('click', limparFiltrosSupervisores);
  }

  if (btnRefresh && !btnRefresh.dataset.listenerAttached) {
    btnRefresh.dataset.listenerAttached = 'true';
    btnRefresh.addEventListener('click', () => loadSupervisores());
  }

  const btnExport = document.getElementById('btnExportSupervisores');
  if (btnExport && !btnExport.dataset.listenerAttached) {
    btnExport.dataset.listenerAttached = 'true';
    btnExport.addEventListener('click', exportSupervisoresToCSV);
  }
}

function filterSupervisores() {
  const searchVal = normStr(document.getElementById('searchSupervisores')?.value || '');
  const instVal = document.getElementById('filterInstSupervisores')?.value || '';
  const regVal = document.getElementById('filterRegiaoSupervisores')?.value || '';
  const sitVal = document.getElementById('filterSituacaoSupervisores')?.value || '';

  const filtered = (window.supervisoresData || []).filter(s => {
    // Busca textual
    if (searchVal) {
      const matchName = normStr(s.nome_supervisor).includes(searchVal);
      const matchEmail = normStr(s.email).includes(searchVal);
      const matchTel = normStr(s.telefone_1).includes(searchVal) || normStr(s.telefone_2).includes(searchVal);
      const matchInst = normStr(s.sigla_inst).includes(searchVal) || normStr(s.inst_supervisora).includes(searchVal);
      const matchUF = normStr(s.uf_inst).includes(searchVal) || normStr(s.regiao_inst).includes(searchVal);
      if (!matchName && !matchEmail && !matchTel && !matchInst && !matchUF) return false;
    }

    // Filtro por Instituição
    if (instVal) {
      const sInst = s.inst_supervisora || s.sigla_inst;
      if (sInst !== instVal) return false;
    }

    // Filtro por Região / UF
    if (regVal) {
      const sReg = s.regiao_inst || s.uf_inst;
      if (sReg !== regVal) return false;
    }

    // Filtro por Situação
    if (sitVal) {
      if (s.situacao !== sitVal) return false;
    }

    return true;
  });

  window.currentFilteredSupervisores = filtered;
  renderSupervisoresTable(filtered);
}

function exportSupervisoresToCSV() {
  const dataToExport = (window.currentFilteredSupervisores && window.currentFilteredSupervisores.length > 0)
    ? window.currentFilteredSupervisores
    : (window.supervisoresData || []);

  if (!dataToExport || dataToExport.length === 0) {
    if (window.showToast) window.showToast('Nenhum dado de supervisor disponível para exportar.', 'warning');
    else alert('Nenhum dado de supervisor disponível para exportar.');
    return;
  }

  const btn = document.getElementById('btnExportSupervisores');
  let origHtml = '';
  if (btn) {
    origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';
    btn.disabled = true;
  }

  try {
    const exportRows = dataToExport.map(s => ({
      'Nome do Supervisor': s.nome_supervisor || '',
      'E-mail': s.email || '',
      'Telefone 1': s.telefone_1 || '',
      'Tipo Tel 1': s.tipo_tel_1 || '',
      'Telefone 2': s.telefone_2 || '',
      'Tipo Tel 2': s.tipo_tel_2 || '',
      'Telefone 3': s.telefone_3 || '',
      'Tipo Tel 3': s.tipo_tel_3 || '',
      'Instituição Supervisora': s.inst_supervisora || '',
      'Sigla Instituição': s.sigla_inst || '',
      'UF': s.uf_inst || '',
      'Região Instituição': s.regiao_inst || '',
      'Validado': s.validado || '',
      'Situação': s.situacao || '',
      'Atualizado': s.atualizado || '',
      'Data de Atualização': s.data_atualizacao || ''
    }));

    const headers = Object.keys(exportRows[0]);
    const csvContent = convertToCSV(exportRows, headers);
    const d = new Date();
    const dateStr = d.toLocaleDateString('pt-BR').replace(/\//g, '-');
    downloadCSV(csvContent, `supervisores_pmmb_${dateStr}.csv`);

    if (window.showToast) {
      window.showToast(`${exportRows.length} supervisores exportados com sucesso!`, 'success');
    }
  } catch (err) {
    console.error('Erro ao exportar supervisores para CSV:', err);
    if (window.showToast) window.showToast('Erro ao exportar CSV: ' + err.message, 'error');
    else alert('Erro ao exportar CSV: ' + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }
  }
}

window.exportSupervisoresToCSV = exportSupervisoresToCSV;

window.limparFiltrosSupervisores = function() {
  const searchInput = document.getElementById('searchSupervisores');
  const selectInst = document.getElementById('filterInstSupervisores');
  const selectRegiao = document.getElementById('filterRegiaoSupervisores');
  const selectSituacao = document.getElementById('filterSituacaoSupervisores');

  if (searchInput) searchInput.value = '';
  if (selectInst) selectInst.value = '';
  if (selectRegiao) selectRegiao.value = '';
  if (selectSituacao) selectSituacao.value = '';

  filterSupervisores();
};

window.showSupervisorDetails = function(id) {
  const sup = window.supervisoresData.find(s => String(s.id) === String(id));
  if (!sup) return;

  const modalBody = document.getElementById('modalSupervisorBody');
  const modal = document.getElementById('modalSupervisor');
  const title = document.getElementById('modalSupervisorTitle');
  if (!modalBody || !modal) return;

  const tel = (n, t) => n ? `${n}${t ? ` (${t})` : ''}` : '';
  if (title) title.textContent = sup.nome_supervisor || 'Supervisor';
  modalBody.innerHTML = `
    <div style="margin:12px 0 4px">${statusTag(sup.situacao)}</div>
    <div class="dsec">Contato</div>
    ${detailsList([
      ['E-mail', sup.email ? `<a href="mailto:${escapeHTML(sup.email)}">${escapeHTML(sup.email)}</a>` : '', true],
      ['Telefone 1', tel(sup.telefone_1, sup.tipo_tel_1)],
      ['Telefone 2', tel(sup.telefone_2, sup.tipo_tel_2)],
      ['Telefone 3', tel(sup.telefone_3, sup.tipo_tel_3)]
    ])}
    <div class="dsec">Instituição</div>
    ${detailsList([
      ['Instituição supervisora', sup.inst_supervisora],
      ['Sigla / UF', [sup.sigla_inst, sup.uf_inst].filter(Boolean).join(' · ')],
      ['Região', sup.regiao_inst],
      ['Validado', sup.validado],
      ['Atualizado', [sup.atualizado, sup.data_atualizacao].filter(Boolean).join(' · ')]
    ])}
  `;

  modal.classList.add('active');
};
