// ============================================
// Gestão CCE — Módulo de Médicos (PMMB)
// ============================================

window.medicosData = [];

// Busca completa de médicos com paginação automática
async function fetchAllDoctors(selectCols = '*') {
  let allData = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from('medicos_municipios')
      .select(selectCols)
      .range(from, from + step - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < step) hasMore = false;
      else from += step;
    } else {
      hasMore = false;
    }
  }
  return allData;
}

// Carrega lista principal de médicos
async function loadMedicos() {
  const tbody = document.getElementById('medicosTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:3rem">Carregando médicos (1.800+ registros)...</td></tr>';

    const data = await fetchAllDoctors('id, medico_ou_vaga, municipio, regiao_saude, perfil, situacao_profissional, tipo_profissional, crm_completo');
    window.medicosData = data || [];
    
    populateMedicoFilters(window.medicosData);
    renderMedicosTable(window.medicosData);

  } catch (error) {
    console.error('Erro ao carregar médicos:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar os dados dos médicos.</td></tr>';
  }
}

// Renderiza tabela de médicos
function renderMedicosTable(data) {
  const tbody = document.getElementById('medicosTableBody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:3rem">Nenhum registro encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  const displayLimit = 300;
  const slice = data.slice(0, displayLimit);

  slice.forEach(medico => {
    const tr = document.createElement('tr');
    
    const isVaga = (medico.medico_ou_vaga || '').toUpperCase().includes('VAGA') || 
                   (medico.situacao_profissional || '').toUpperCase().includes('DESOCUPADA');
    
    let badgeClass = 'badge-approved';
    let sit = medico.situacao_profissional || 'Ativo';
    if (isVaga) {
      badgeClass = 'badge-rejected';
    } else if (sit.toUpperCase().includes('EXTRA') || sit.toUpperCase().includes('PENDENTE')) {
      badgeClass = 'badge-pending';
    }

    tr.innerHTML = `
      <td>
        <div style="font-weight: 600; color: ${isVaga ? 'var(--text-muted)' : 'var(--text-primary)'}">
          ${escapeHTML(medico.medico_ou_vaga || 'Vaga Sem Profissional')}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted)">
          ${medico.crm_completo ? 'CRM: ' + escapeHTML(medico.crm_completo) : (isVaga ? 'Desocupada' : 'Sem CRM')}
        </div>
      </td>
      <td>
        <div style="font-weight: 500">${escapeHTML(medico.municipio || '-')}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted)">${escapeHTML(medico.regiao_saude || '-')}</div>
      </td>
      <td><span class="badge ${badgeClass}">${escapeHTML(sit)}</span></td>
      <td><span style="font-size: 0.85rem">${escapeHTML(medico.perfil || '-')}</span></td>
      <td><span style="font-size: 0.85rem; color: var(--accent-secondary)">${escapeHTML(medico.tipo_profissional || '-')}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="viewMedicoDetails('${escapeHTML(medico.id)}')" title="Ver Ficha Completa">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (data.length > displayLimit) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="6" style="text-align:center; color:var(--text-secondary); padding:1rem; font-size:0.85rem; background:rgba(255,255,255,0.01)">
        Exibindo os primeiros ${displayLimit} de ${data.length} registros. Utilize a busca e os filtros acima para refinar.
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// Popula dropdowns de filtros de médicos
function populateMedicoFilters(data) {
  if (!data) return;
  const selectRegiao = document.getElementById('filterRegiaoMedicos');
  const selectPerfil = document.getElementById('filterPerfilMedicos');
  const selectSituacao = document.getElementById('filterSituacaoMedicos');
  const selectTipo = document.getElementById('filterTipoMedicos');

  if (selectRegiao && selectRegiao.options.length <= 1) {
    const regioes = [...new Set(data.map(d => d.regiao_saude).filter(Boolean))].sort();
    regioes.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      selectRegiao.appendChild(opt);
    });
  }

  if (selectPerfil && selectPerfil.options.length <= 1) {
    const perfis = [...new Set(data.map(d => d.perfil).filter(Boolean))].sort();
    perfis.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      selectPerfil.appendChild(opt);
    });
  }

  if (selectSituacao && selectSituacao.options.length <= 1) {
    const situacoes = [...new Set(data.map(d => d.situacao_profissional).filter(Boolean))].sort();
    situacoes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      selectSituacao.appendChild(opt);
    });
  }

  if (selectTipo && selectTipo.options.length <= 1) {
    const tipos = [...new Set(data.map(d => d.tipo_profissional).filter(Boolean))].sort();
    tipos.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      selectTipo.appendChild(opt);
    });
  }
}

// Configura eventos dos filtros de médicos
function setupMedicoFilters() {
  const searchInput = document.getElementById('searchMedicos');
  const filterRegiao = document.getElementById('filterRegiaoMedicos');
  const filterPerfil = document.getElementById('filterPerfilMedicos');
  const filterSituacao = document.getElementById('filterSituacaoMedicos');
  const filterTipo = document.getElementById('filterTipoMedicos');
  const btnLimpar = document.getElementById('btnLimparFiltrosMedicos');
  const btnRefresh = document.getElementById('btnRefreshMedicos');

  if (searchInput) searchInput.addEventListener('input', filterMedicos);
  if (filterRegiao) filterRegiao.addEventListener('change', filterMedicos);
  if (filterPerfil) filterPerfil.addEventListener('change', filterMedicos);
  if (filterSituacao) filterSituacao.addEventListener('change', filterMedicos);
  if (filterTipo) filterTipo.addEventListener('change', filterMedicos);

  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (filterRegiao) filterRegiao.value = '';
      if (filterPerfil) filterPerfil.value = '';
      if (filterSituacao) filterSituacao.value = '';
      if (filterTipo) filterTipo.value = '';
      renderMedicosTable(window.medicosData);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadMedicos();
    });
  }
}

// Filtra registros de médicos em memória
function filterMedicos() {
  const query = normStr(document.getElementById('searchMedicos')?.value || '');
  const regiao = document.getElementById('filterRegiaoMedicos')?.value || '';
  const perfil = document.getElementById('filterPerfilMedicos')?.value || '';
  const situacao = document.getElementById('filterSituacaoMedicos')?.value || '';
  const tipo = document.getElementById('filterTipoMedicos')?.value || '';

  const filtered = (window.medicosData || []).filter(m => {
    const matchQuery = !query || 
      normStr(m.medico_ou_vaga).includes(query) || 
      normStr(m.municipio).includes(query) || 
      normStr(m.crm_completo).includes(query);
    
    const matchRegiao = !regiao || m.regiao_saude === regiao;
    const matchPerfil = !perfil || m.perfil === perfil;
    const matchSituacao = !situacao || m.situacao_profissional === situacao;
    const matchTipo = !tipo || m.tipo_profissional === tipo;

    return matchQuery && matchRegiao && matchPerfil && matchSituacao && matchTipo;
  });

  renderMedicosTable(filtered);
}

// Abre modal com a ficha completa do médico
window.viewMedicoDetails = async function(id) {
  const modal = document.getElementById('modalMedico');
  const modalBody = document.getElementById('modalMedicoBody');
  if (!modal || !modalBody) return;

  modalBody.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted)"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:1rem">Carregando dados completos...</p></div>';
  modal.classList.add('active');

  try {
    const { data: medico, error } = await supabaseClient
      .from('medicos_municipios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    let processosHTML = '<p style="color:var(--text-muted); font-size:0.85rem">Nenhum processo vinculado.</p>';
    if (window.processosData && window.processosData.length > 0 && medico.medico_ou_vaga) {
      const matchProc = window.processosData.filter(p => matchMedicoProcesso(medico.medico_ou_vaga, p));
      if (matchProc.length > 0) {
        processosHTML = matchProc.map(p => `
          <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.75rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600; color:var(--text-primary); font-size:0.85rem">${escapeHTML(p.numero_sei || '-')}</div>
              <div style="font-size:0.75rem; color:var(--text-muted)">Status: ${escapeHTML(p.status || '-')} | Equipe: ${escapeHTML(p.equipe_responsavel || '-')}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="goToProcessoDetails('${escapeHTML(p.id)}')" title="Ver Processo" style="font-size:0.75rem">
              <i class="fas fa-external-link-alt"></i> Ver
            </button>
          </div>
        `).join('');
      }
    }

    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
        <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <h3 style="color: var(--accent-primary); font-size: 0.95rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">
            <i class="fas fa-user-md" style="margin-right: 0.5rem;"></i> Dados do Profissional
          </h3>
          <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.85rem;">
            <div><span style="color: var(--text-muted)">Nome / Vaga:</span> <strong style="color: var(--text-primary)">${escapeHTML(medico.medico_ou_vaga || '-')}</strong></div>
            <div><span style="color: var(--text-muted)">CPF:</span> <span>${maskCPF(medico.cpf)}</span></div>
            <div><span style="color: var(--text-muted)">CRM / UF:</span> <span>${escapeHTML(medico.crm_completo || '-')} (${escapeHTML(medico.uf_crm || '-')})</span></div>
            <div><span style="color: var(--text-muted)">E-mail:</span> <span>${escapeHTML(medico.email || '-')}</span></div>
            <div><span style="color: var(--text-muted)">Telefone:</span> <span>${escapeHTML(medico.telefone || '-')}</span></div>
            <div><span style="color: var(--text-muted)">Sexo / Raça:</span> <span>${escapeHTML(medico.sexo || '-')} / ${escapeHTML(medico.raca_cor || '-')}</span></div>
          </div>
        </div>

        <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <h3 style="color: var(--accent-secondary); font-size: 0.95rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">
            <i class="fas fa-hospital" style="margin-right: 0.5rem;"></i> Lotação e Programa
          </h3>
          <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.85rem;">
            <div><span style="color: var(--text-muted)">Município:</span> <strong style="color: var(--text-primary)">${escapeHTML(medico.municipio || '-')}</strong></div>
            <div><span style="color: var(--text-muted)">Região de Saúde:</span> <span>${escapeHTML(medico.regiao_saude || '-')}</span></div>
            <div><span style="color: var(--text-muted)">CNES Unidade:</span> <span>${escapeHTML(medico.cnes || '-')} - ${escapeHTML(medico.nome_estabelecimento || '-')}</span></div>
            <div><span style="color: var(--text-muted)">Situação:</span> <span class="badge badge-approved">${escapeHTML(medico.situacao_profissional || '-')}</span></div>
            <div><span style="color: var(--text-muted)">Perfil / Tipo:</span> <span>${escapeHTML(medico.perfil || '-')} (${escapeHTML(medico.tipo_profissional || '-')})</span></div>
            <div><span style="color: var(--text-muted)">Data Início:</span> <span>${escapeHTML(medico.data_inicio_atuacao || '-')}</span></div>
          </div>
        </div>
      </div>

      <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 1rem;">
        <h3 style="color: var(--accent-warning); font-size: 0.95rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">
          <i class="fas fa-gavel" style="margin-right: 0.5rem;"></i> Processos Administrativos Vinculados
        </h3>
        ${processosHTML}
      </div>
    `;

  } catch (error) {
    console.error('Erro ao buscar detalhes do médico:', error);
    modalBody.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--accent-danger)">Erro ao carregar os detalhes do profissional.</div>';
  }
};

// Integração de navegação para processos a partir do médico
window.goToProcessoDetails = function(procId) {
  const modalMedico = document.getElementById('modalMedico');
  if (modalMedico) modalMedico.classList.remove('active');

  const navProc = document.getElementById('navProcessos');
  if (navProc) navProc.click();

  setTimeout(() => {
    if (typeof window.viewProcessoDetails === 'function') {
      window.viewProcessoDetails(procId);
    }
  }, 250);
};

// Busca dados customizados para exportação CSV
async function fetchCustomDoctorsData(selectedFields) {
  const keys = selectedFields.map(f => f.key);
  const selectQuery = keys.join(',');
  return await fetchAllDoctors(selectQuery);
}

// Configura o modal e a lógica de exportação CSV de médicos
function setupExportLogic() {
  const btnExport = document.getElementById('btnExportMedicos');
  const modalExport = document.getElementById('modalExport');
  const btnCloseExportModal = document.getElementById('btnCloseExportModal');
  const btnConfirmExport = document.getElementById('btnConfirmExport');
  const chkAll = document.getElementById('chkExportAll');

  if (btnExport && modalExport) {
    btnExport.addEventListener('click', () => {
      modalExport.classList.add('active');
    });
  }

  if (btnCloseExportModal && modalExport) {
    btnCloseExportModal.addEventListener('click', () => {
      modalExport.classList.remove('active');
    });
  }

  if (chkAll) {
    chkAll.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('#modalExport input[type="checkbox"]:not(#chkExportAll)');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
  }

  if (btnConfirmExport) {
    btnConfirmExport.addEventListener('click', async () => {
      const selectedFields = [];
      const checkboxes = document.querySelectorAll('#modalExport input[type="checkbox"]:not(#chkExportAll):checked');
      
      checkboxes.forEach(cb => {
        selectedFields.push({ key: cb.value, label: cb.dataset.label || cb.value });
      });

      if (selectedFields.length === 0) {
        alert('Por favor, selecione ao menos um campo para exportar.');
        return;
      }

      btnConfirmExport.disabled = true;
      btnConfirmExport.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando CSV...';

      try {
        const data = await fetchCustomDoctorsData(selectedFields);
        const csvContent = convertToCSV(data, selectedFields);
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadCSV(csvContent, `relatorio_medicos_${dateStr}.csv`);
        if (modalExport) modalExport.classList.remove('active');
      } catch (err) {
        console.error('Erro na exportação CSV:', err);
        alert('Erro ao exportar dados. Tente novamente.');
      } finally {
        btnConfirmExport.disabled = false;
        btnConfirmExport.innerHTML = '<i class="fas fa-download"></i> Baixar CSV';
      }
    });
  }
}
