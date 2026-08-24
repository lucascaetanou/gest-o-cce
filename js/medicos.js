// ============================================
// Gestão CCE — Módulo de Médicos (PMMB)
// ============================================

window.medicosData = [];

async function fetchAllDoctors(selectCols) {
  let allData = [];
  let from = 0;
  const size = 1000;
  let fetchMore = true;
  const cols = selectCols || 'perfil_profissional,ativo_inativo,status,regiao_saude,municipio_atuacao';

  while (fetchMore) {
    const { data, error } = await supabaseClient
      .from('doctors')
      .select(cols)
      .range(from, from + size - 1);
    
    if (error) {
      console.error(error);
      break;
    }
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += size;
    } else {
      fetchMore = false;
    }
  }
  return allData;
}


async function loadMedicos() {
  const tbody = document.getElementById('medicosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Carregando médicos...</td></tr>';

  try {
    const { data: medicos, error } = await supabaseClient
      .from('doctors')
      .select('id, nome_profissional, perfil_profissional, status, ativo_inativo, municipio_atuacao, regiao_saude, status_prof_egestor, eixo_vaga, gestao')
      .order('nome_profissional', { ascending: true });

    if (error) throw error;

    if (!medicos || medicos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Nenhum médico encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    
    window.medicosData = medicos;
    populateMedicoFilters(medicos);
    renderMedicosTable(window.medicosData);
    setupMedicoFilters();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ef4444; padding: 3rem;">Erro ao carregar médicos.</td></tr>';
  }
}


function renderMedicosTable(data) {
  const tbody = document.getElementById('medicosTableBody');
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Nenhum médico encontrado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  
  data.forEach(m => {
      const tr = document.createElement('tr');
      
      let statusBadge = `<span class="badge badge-pending">${escapeHTML(m.status || 'Vaga')}</span>`;
      if (m.status === 'OCUPADA') statusBadge = `<span class="badge badge-approved">OCUPADA</span>`;
      else if (m.status === 'DESOCUPADA') statusBadge = `<span class="badge badge-rejected">DESOCUPADA</span>`;
      else if (m.status === 'EM PROCESSO DE OCUPACAO') statusBadge = `<span class="badge badge-pending">EM PROCESSO</span>`;

      const isInativa = m.ativo_inativo === 'INATIVA';
      const rowStyle = isInativa ? 'opacity: 0.5;' : '';

      tr.style.cssText = rowStyle;
      tr.innerHTML = `
        <td>
          <div style="font-weight: 500; color: var(--text-primary)">${m.nome_profissional ? escapeHTML(m.nome_profissional) : '<em style="color:var(--text-muted)">Vaga sem profissional</em>'}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">${escapeHTML(m.perfil_profissional || '-')}</div>
        </td>
        <td>${statusBadge}${isInativa ? '<div style="font-size:0.7rem;color:var(--accent-danger);margin-top:2px">INATIVA</div>' : ''}</td>
        <td>
          <div>${escapeHTML(m.municipio_atuacao || '-')}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">${escapeHTML(m.regiao_saude || '-')}</div>
        </td>
        <td style="font-size:0.8rem; color: var(--text-secondary)">${escapeHTML(m.status_prof_egestor || '-')}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" onclick="viewMedicoDetails('${escapeHTML(m.id)}')">Ver</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}


function populateMedicoFilters(data) {
  const selectEixo = document.getElementById('filterMedicoEixo');
  const selectGestao = document.getElementById('filterMedicoGestao');

  if (selectEixo && data) {
    const currentVal = selectEixo.value;
    const eixos = new Set();
    data.forEach(m => {
      if (m.eixo_vaga) {
        const val = m.eixo_vaga.trim();
        if (val) eixos.add(val);
      }
    });
    const sorted = Array.from(eixos).sort();
    selectEixo.innerHTML = '<option value="" style="background: #1e293b; color: #fff;">Todos os Eixos</option>' +
      sorted.map(v => `<option value="${escapeHTML(v)}" style="background: #1e293b; color: #fff;">${escapeHTML(v)}</option>`).join('');
    if (currentVal && eixos.has(currentVal)) selectEixo.value = currentVal;
  }

  if (selectGestao && data) {
    const currentVal = selectGestao.value;
    const gestoes = new Set();
    data.forEach(m => {
      if (m.gestao) {
        const val = m.gestao.trim();
        if (val) gestoes.add(val);
      }
    });
    const sorted = Array.from(gestoes).sort();
    selectGestao.innerHTML = '<option value="" style="background: #1e293b; color: #fff;">Todas as Gestões</option>' +
      sorted.map(v => `<option value="${escapeHTML(v)}" style="background: #1e293b; color: #fff;">${escapeHTML(v)}</option>`).join('');
    if (currentVal && gestoes.has(currentVal)) selectGestao.value = currentVal;
  }
}


function setupMedicoFilters() {
  const elementIds = ['searchMedicoName', 'searchMedicoCity', 'filterMedicoEixo', 'filterMedicoGestao'];
  
  elementIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', filterMedicos);
      el.addEventListener('change', filterMedicos);
    }
  });

  const btnLimpar = document.getElementById('btnLimparFiltrosMedicos');
  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      elementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      filterMedicos();
    });
  }
}


function filterMedicos() {
  if (!window.medicosData) return;

  const nameVal = normStr(document.getElementById('searchMedicoName')?.value);
  const cityVal = normStr(document.getElementById('searchMedicoCity')?.value);
  const eixoVal = (document.getElementById('filterMedicoEixo')?.value || '').trim().toUpperCase();
  const gestaoVal = (document.getElementById('filterMedicoGestao')?.value || '').trim().toUpperCase();

  const filtered = window.medicosData.filter(m => {
    // 1. Nome
    if (nameVal) {
      const nome = normStr(m.nome_profissional || 'vaga sem profissional');
      if (!nome.includes(nameVal)) return false;
    }

    // 2. Município / Região
    if (cityVal) {
      const city = normStr(m.municipio_atuacao);
      const regiao = normStr(m.regiao_saude);
      if (!city.includes(cityVal) && !regiao.includes(cityVal)) return false;
    }

    // 3. Eixo da Vaga
    if (eixoVal) {
      const mEixo = (m.eixo_vaga || '').trim().toUpperCase();
      if (mEixo !== eixoVal) return false;
    }

    // 4. Gestão
    if (gestaoVal) {
      const mGestao = (m.gestao || '').trim().toUpperCase();
      if (mGestao !== gestaoVal) return false;
    }

    return true;
  });

  renderMedicosTable(filtered);
}


async function viewMedicoDetails(id) {
  const modal = document.getElementById('modalMedico');
  const modalBody = document.getElementById('modalMedicoBody');
  if (!modal || !modalBody) return;
  
  modalBody.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted)"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:1rem">Carregando detalhes...</p></div>';
  modal.classList.add('active');

  try {
    const { data: medico, error } = await supabaseClient
      .from('doctors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Garantir que temos processosData carregado
    if (!window.processosData || window.processosData.length === 0) {
      try {
        const { data: pData } = await supabaseClient.from('processos_administrativos').select('*').order('created_at', { ascending: false });
        window.processosData = pData || [];
      } catch (e) {
        console.error('Erro ao buscar processos para vinculo:', e);
      }
    }

    // Buscar processos relacionados por nome do médico (insensível a acentos)
    const docName = (medico.nome_profissional || '').trim();
    let processosRelacionados = (window.processosData || []).filter(p => matchMedicoProcesso(docName, p));

    let processosHtml = '';
    if (processosRelacionados.length > 0) {
      processosHtml = processosRelacionados.map(p => {
        let badgeClass = 'badge-pending';
        const st = (p.status_processo || '').toUpperCase();
        if (st.includes('CONCLUÍDO') || st.includes('CONCLUIDO')) badgeClass = 'badge-approved';
        else if (st.includes('ARQUIVADO') || st.includes('SOBRESTADO')) badgeClass = 'badge-rejected';

        return `
          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.85rem; margin-top:0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem">
                <span style="font-weight:600; color:var(--text-primary); font-family:monospace; font-size:0.85rem">${escapeHTML(p.numero_sei || '-')}</span>
                <span class="badge ${badgeClass}">${escapeHTML(p.status_processo || '-')}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Equipe: <strong>${escapeHTML(p.equipe_responsavel || '-')}</strong> | Demanda: ${escapeHTML(p.descricao_demanda || '-')}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="goToProcessoDetails('${escapeHTML(p.id)}')" style="font-size:0.8rem">
              <i class="fas fa-external-link-alt"></i> Ver Processo
            </button>
          </div>
        `;
      }).join('');
    } else {
      processosHtml = '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0">Nenhum processo administrativo vinculado a este(a) profissional.</div>';
    }

    modalBody.innerHTML = `
      <div class="modal-grid">
        <div class="detail-group"><div class="detail-label">Nome Completo</div><div class="detail-value">${escapeHTML(medico.nome_profissional || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Nº Inscrição</div><div class="detail-value">${escapeHTML(medico.nu_inscricao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Perfil Profissional</div><div class="detail-value">${escapeHTML(medico.perfil_profissional || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Status da Vaga</div><div class="detail-value">${escapeHTML(medico.status || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Ativo/Inativo</div><div class="detail-value">${escapeHTML(medico.ativo_inativo || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Status e-Gestor</div><div class="detail-value">${escapeHTML(medico.status_prof_egestor || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Município</div><div class="detail-value">${escapeHTML(medico.municipio_atuacao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Região de Saúde (CIR)</div><div class="detail-value">${escapeHTML(medico.regiao_saude || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">UF</div><div class="detail-value">${escapeHTML(medico.estado_atuacao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Categoria IVS</div><div class="detail-value">${escapeHTML(medico.categoria_ivs || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Modalidade</div><div class="detail-value">${escapeHTML(medico.modalidade || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Eixo da Vaga</div><div class="detail-value">${escapeHTML(medico.eixo_vaga || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Origem da Vaga</div><div class="detail-value">${escapeHTML(medico.origem_vaga || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Gestão</div><div class="detail-value">${escapeHTML(medico.gestao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Eixo Integração</div><div class="detail-value">${escapeHTML(medico.eixo_integracao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">País de Origem</div><div class="detail-value">${escapeHTML(medico.pais_origem || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Nacionalidade</div><div class="detail-value">${escapeHTML(medico.nacionalidade || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Sexo</div><div class="detail-value">${escapeHTML(medico.sexo || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Raça/Cor</div><div class="detail-value">${escapeHTML(medico.raca_cor || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Início Atividade</div><div class="detail-value">${escapeHTML(medico.inicio_atividade || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Encerramento</div><div class="detail-value">${escapeHTML(medico.encerramento_atividade || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">CPF</div><div class="detail-value">${maskCPF(medico.cpf)}</div></div>
        <div class="detail-group"><div class="detail-label">Email</div><div class="detail-value">${escapeHTML(medico.email || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Telefone</div><div class="detail-value">${escapeHTML(medico.telefone || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Banco</div><div class="detail-value">${escapeHTML(medico.banco || '-')} / Ag: ${maskBankAccount(medico.agencia_bancaria)} / Cc: ${maskBankAccount(medico.conta_bancaria)}</div></div>
      </div>

      <!-- Seção de Processos Administrativos Vinculados -->
      <div style="margin-top:1.5rem; background:var(--bg-secondary); padding:1.25rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-info); font-size:0.95rem; font-weight:600; display:flex; align-items:center; justify-content:space-between">
          <span><i class="fas fa-gavel" style="margin-right:0.5rem"></i> Processos Administrativos Relacionados</span>
          <span class="badge badge-info" style="font-size:0.8rem">${processosRelacionados.length}</span>
        </h4>
        ${processosHtml}
      </div>
    `;
  } catch (err) {
    console.error(err);
    modalBody.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--accent-danger)">Erro ao carregar detalhes do médico.</div>';
  }
}



window.goToProcessoDetails = function(processoId) {
  // 1. Fechar modal do médico
  const modalMedico = document.getElementById('modalMedico');
  if (modalMedico) modalMedico.classList.remove('active');

  // 2. Mudar para a aba de Processos
  const navProc = document.getElementById('navProcessos');
  if (navProc) navProc.click();

  // 3. Abrir o modal do processo específico
  setTimeout(() => {
    if (typeof window.viewProcessoDetails === 'function') {
      window.viewProcessoDetails(processoId);
    }
  }, 250);
};



function setupExportLogic() {
  const modalExport = document.getElementById('modalExport');
  const btnOpenExportModal = document.getElementById('btnOpenExportModal');
  const btnCloseExportModal = document.getElementById('btnCloseExportModal');
  const btnCancelExport = document.getElementById('btnCancelExport');
  const exportForm = document.getElementById('exportForm');
  const btnSelectAllCols = document.getElementById('btnSelectAllCols');
  const btnClearAllCols = document.getElementById('btnClearAllCols');

  if (btnOpenExportModal) {
    btnOpenExportModal.addEventListener('click', () => {
      if (modalExport) modalExport.classList.add('active');
    });
  }

  const closeExport = () => { if (modalExport) modalExport.classList.remove('active'); };
  if (btnCloseExportModal) btnCloseExportModal.addEventListener('click', closeExport);
  if (btnCancelExport) btnCancelExport.addEventListener('click', closeExport);

  // Close on outside click
  if (modalExport) {
    modalExport.addEventListener('click', (e) => {
      if (e.target === modalExport) closeExport();
    });
  }

  if (btnSelectAllCols) {
    btnSelectAllCols.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('#exportForm input[name="cols"]').forEach(cb => cb.checked = true);
    });
  }

  if (btnClearAllCols) {
    btnClearAllCols.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('#exportForm input[name="cols"]').forEach(cb => cb.checked = false);
    });
  }

  if (exportForm) {
    exportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const checkedBoxes = document.querySelectorAll('#exportForm input[name="cols"]:checked');
      if (checkedBoxes.length === 0) {
        alert('Selecione pelo menos uma coluna para exportar.');
        return;
      }

      const selectedCols = Array.from(checkedBoxes).map(cb => cb.value);
      
      const btnSubmit = document.getElementById('btnRunExport');
      const originalHtml = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Gerando...';
      btnSubmit.disabled = true;

      try {
        const allData = await fetchCustomDoctorsData(selectedCols);
        if (!allData || allData.length === 0) {
          alert('Nenhum dado encontrado para exportar.');
          return;
        }
        const csvString = convertToCSV(allData, selectedCols);
        downloadCSV(csvString, 'relatorio_medicos_pmmb.csv');
        closeExport();
      } catch (err) {
        console.error(err);
        alert('Erro ao gerar relatório: ' + err.message);
      } finally {
        btnSubmit.innerHTML = originalHtml;
        btnSubmit.disabled = false;
      }
    });
  }
}



async function fetchCustomDoctorsData(columns) {
  let allData = [];
  let from = 0;
  const size = 1000;
  let fetchMore = true;
  const colsString = columns.join(',');

  while (fetchMore) {
    const { data, error } = await supabaseClient
      .from('doctors')
      .select(colsString)
      .range(from, from + size - 1);
    
    if (error) {
      throw error;
    }
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += size;
    } else {
      fetchMore = false;
    }
  }
  return allData;
}


