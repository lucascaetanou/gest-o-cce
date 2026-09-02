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
    window.currentFilteredSupervisores = window.supervisoresData;
    populateSupervisorFilters(window.supervisoresData);
    setupSupervisorFilters();
    renderSupervisoresTable(window.supervisoresData);
    
  } catch (err) {
    console.error('Erro ao buscar supervisores:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar supervisores: ${escapeHTML(err.message)}</td></tr>`;
  }
}

function renderSupervisoresTable(data) {
  const tbody = document.getElementById('supervisoresTableBody');
  const countBadge = document.getElementById('supervisoresCountBadge');
  if (!tbody) return;

  if (countBadge) {
    const total = window.supervisoresData.length;
    countBadge.textContent = `${data.length} de ${total} registros`;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:3.5rem 1rem;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
            <i class="fas fa-search" style="font-size:2rem; color:var(--text-muted); opacity:0.5;"></i>
            <div style="font-weight:600; color:var(--text-primary); font-size:1rem;">Nenhum supervisor encontrado</div>
            <div style="font-size:0.85rem; color:var(--text-muted); max-width:350px;">Tente ajustar ou limpar os termos de busca e filtros selecionados.</div>
            <button class="btn btn-ghost btn-sm" style="margin-top:0.5rem; border:1px solid var(--border);" onclick="limparFiltrosSupervisores()">
              <i class="fas fa-undo" style="margin-right:0.35rem;"></i> Limpar Filtros
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = '';
  data.forEach(sup => {
    const tr = document.createElement('tr');
    
    // badges status
    let badgeClass = 'badge-pending';
    let badgeText = escapeHTML(sup.situacao || 'Desconhecido');
    if (badgeText.toLowerCase().includes('ativo') || badgeText.toLowerCase().includes('validado')) badgeClass = 'badge-approved';
    else if (badgeText.toLowerCase().includes('inativo') || badgeText.toLowerCase().includes('desligado')) badgeClass = 'badge-rejected';
    
    tr.innerHTML = `
      <td>
        <div style="font-weight:600; color:var(--text-primary)">${escapeHTML(sup.nome_supervisor || '-')}</div>
        <div style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(sup.email || '-')}</div>
      </td>
      <td>
        <div style="font-weight:500">${escapeHTML(sup.sigla_inst || sup.inst_supervisora || '-')}</div>
        <div style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(sup.uf_inst || sup.regiao_inst || '')}</div>
      </td>
      <td>
        <div>${escapeHTML(sup.telefone_1 || '-')}</div>
        <div style="font-size:0.75rem; color:var(--text-muted)">${escapeHTML(sup.tipo_tel_1 || '')}</div>
      </td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="showSupervisorDetails('${escapeHTML(sup.id)}')" title="Ver Detalhes">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

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
  if (window.showToast) window.showToast('Filtros de supervisores limpos', 'info');
};

window.showSupervisorDetails = function(id) {
  const sup = window.supervisoresData.find(s => s.id === id);
  if (!sup) return;
  
  const modalBody = document.getElementById('modalSupervisorBody');
  const modal = document.getElementById('modalSupervisor');
  if (!modalBody || !modal) return;
  
  modalBody.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:1.5rem">
      <!-- INFO BÁSICA -->
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-info); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Informações Pessoais</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Nome:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(sup.nome_supervisor || '-')}</span></div>

          <div><span style="color:var(--text-secondary)">E-mail:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.email || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Tel 1:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.telefone_1 || '-')}</span> <small style="color:var(--text-muted)">(${escapeHTML(sup.tipo_tel_1 || '-')})</small></div>
          <div><span style="color:var(--text-secondary)">Tel 2:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.telefone_2 || '-')}</span> <small style="color:var(--text-muted)">(${escapeHTML(sup.tipo_tel_2 || '-')})</small></div>
          <div><span style="color:var(--text-secondary)">Tel 3:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.telefone_3 || '-')}</span> <small style="color:var(--text-muted)">(${escapeHTML(sup.tipo_tel_3 || '-')})</small></div>
        </div>
      </div>
      
      <!-- INSTITUIÇÃO E SITUAÇÃO -->
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-info); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Instituição e Situação</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Inst. Supervisora:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(sup.inst_supervisora || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Sigla / UF:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.sigla_inst || '-')} / ${escapeHTML(sup.uf_inst || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Região Inst.:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.regiao_inst || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Validado:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.validado || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Situação:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(sup.situacao || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Atualizado:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.atualizado || '-')} (${escapeHTML(sup.data_atualizacao || '-')})</span></div>
        </div>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
};
