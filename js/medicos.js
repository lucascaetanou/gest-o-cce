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
      .select('id, nome_profissional, perfil_profissional, status, ativo_inativo, municipio_atuacao, regiao_saude, status_prof_egestor, eixo_vaga, gestao, instituicao, tutor, supervisor, cpf, secretario_saude, email_secretario')
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
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:3.5rem 1rem;">
          <div style="max-width:320px; margin:0 auto; color:var(--text-muted);">
            <i class="fas fa-search" style="font-size:2.2rem; opacity:0.4; margin-bottom:0.75rem; display:block;"></i>
            <div style="font-weight:600; color:var(--text-primary); font-size:1rem; margin-bottom:0.25rem;">Nenhum médico encontrado</div>
            <div style="font-size:0.85rem; margin-bottom:1rem;">Nenhum profissional corresponde aos filtros pesquisados.</div>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('btnLimparFiltrosMedicos')?.click()"><i class="fas fa-undo"></i> Limpar filtros</button>
          </div>
        </td>
      </tr>
    `;
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
          ${m.instituicao ? `<div style="font-size:0.75rem; color:var(--accent-primary); margin-top:3px; display:flex; align-items:center; gap:4px;"><i class="fas fa-university" style="font-size:0.7rem"></i> ${escapeHTML(m.instituicao)}</div>` : ''}
          ${m.supervisor ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;"><span style="color:var(--text-muted)">Sup:</span> ${escapeHTML(m.supervisor)}${m.tutor ? ` <span style="color:var(--text-muted); margin:0 3px;">•</span> <span style="color:var(--text-muted)">Tut:</span> ${escapeHTML(m.tutor)}` : ''}</div>` : ''}
          ${m.secretario_saude ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;"><i class="fas fa-hospital-user" style="font-size:0.7rem; color:var(--accent-warning); margin-right:3px;"></i><span style="color:var(--text-muted)">Sec:</span> ${escapeHTML(m.secretario_saude)}</div>` : ''}
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
  const selectInst = document.getElementById('filterMedicoInstituicao');
  const selectTutor = document.getElementById('filterMedicoTutor');

  if (selectEixo && data) {
    const currentVal = selectEixo.value;
    const eixos = new Set();
    data.forEach(m => { if (m.eixo_vaga && m.eixo_vaga.trim()) eixos.add(m.eixo_vaga.trim()); });
    const sorted = Array.from(eixos).sort();
    selectEixo.innerHTML = '<option value="" style="background: #0b2236; color: #fff;">Todos os Eixos</option>' +
      sorted.map(v => `<option value="${escapeHTML(v)}" style="background: #0b2236; color: #fff;">${escapeHTML(v)}</option>`).join('');
    if (currentVal && eixos.has(currentVal)) selectEixo.value = currentVal;
  }

  if (selectGestao && data) {
    const currentVal = selectGestao.value;
    const gestoes = new Set();
    data.forEach(m => { if (m.gestao && m.gestao.trim()) gestoes.add(m.gestao.trim()); });
    const sorted = Array.from(gestoes).sort();
    selectGestao.innerHTML = '<option value="" style="background: #0b2236; color: #fff;">Todas as Gestões</option>' +
      sorted.map(v => `<option value="${escapeHTML(v)}" style="background: #0b2236; color: #fff;">${escapeHTML(v)}</option>`).join('');
    if (currentVal && gestoes.has(currentVal)) selectGestao.value = currentVal;
  }

  if (selectInst && data) {
    const currentVal = selectInst.value;
    const insts = new Set();
    data.forEach(m => { if (m.instituicao && m.instituicao.trim()) insts.add(m.instituicao.trim()); });
    const sorted = Array.from(insts).sort();
    selectInst.innerHTML = '<option value="" style="background: #0b2236; color: #fff;">Todas as Instituições</option>' +
      sorted.map(v => `<option value="${escapeHTML(v)}" style="background: #0b2236; color: #fff;">${escapeHTML(v)}</option>`).join('');
    if (currentVal && insts.has(currentVal)) selectInst.value = currentVal;
  }

  if (selectTutor && data) {
    const currentVal = selectTutor.value;
    const tutores = new Set();
    data.forEach(m => { if (m.tutor && m.tutor.trim()) tutores.add(m.tutor.trim()); });
    const sorted = Array.from(tutores).sort();
    selectTutor.innerHTML = '<option value="" style="background: #0b2236; color: #fff;">Todos os Tutores</option>' +
      sorted.map(v => `<option value="${escapeHTML(v)}" style="background: #0b2236; color: #fff;">${escapeHTML(v)}</option>`).join('');
    if (currentVal && tutores.has(currentVal)) selectTutor.value = currentVal;
  }
}


function setupMedicoFilters() {
  const elementIds = [
    'searchMedicoName',
    'searchMedicoCity',
    'filterMedicoInstituicao',
    'filterMedicoTutor',
    'searchMedicoSupervisor',
    'searchMedicoSecretario',
    'filterMedicoEixo',
    'filterMedicoGestao'
  ];
  
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
  const instVal = normStr(document.getElementById('filterMedicoInstituicao')?.value);
  const tutorVal = normStr(document.getElementById('filterMedicoTutor')?.value);
  const supVal = normStr(document.getElementById('searchMedicoSupervisor')?.value);
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

    // 3. Instituição
    if (instVal) {
      const mInst = normStr(m.instituicao);
      if (!mInst.includes(instVal)) return false;
    }

    // 4. Tutor
    if (tutorVal) {
      const mTutor = normStr(m.tutor);
      if (!mTutor.includes(tutorVal)) return false;
    }

    // 5. Supervisor
    if (supVal) {
      const mSup = normStr(m.supervisor);
      if (!mSup.includes(supVal)) return false;
    }

    // 5.1 Secretário de Saúde
    const secVal = normStr(document.getElementById('searchMedicoSecretario')?.value);
    if (secVal) {
      const mSec = normStr(m.secretario_saude);
      if (!mSec.includes(secVal)) return false;
    }

    // 6. Eixo da Vaga
    if (eixoVal) {
      const mEixo = (m.eixo_vaga || '').trim().toUpperCase();
      if (mEixo !== eixoVal) return false;
    }

    // 7. Gestão
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
        <div class="detail-group" style="grid-column: 1 / -1; background: rgba(124,58,237,0.06); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid rgba(124,58,237,0.18);">
          <div style="font-weight: 700; color: var(--accent-primary); font-size: 0.85rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
            <i class="fas fa-university"></i> Vinculação Acadêmica & Tutoria (PMMB)
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; font-size: 0.85rem;">
            <div><span style="color: var(--text-muted);">Instituição:</span> <strong style="color: var(--text-primary);">${escapeHTML(medico.instituicao || 'Não vinculado')}</strong></div>
            <div><span style="color: var(--text-muted);">Supervisor:</span> <strong style="color: var(--text-primary);">${escapeHTML(medico.supervisor || 'Não informado')}</strong></div>
            <div><span style="color: var(--text-muted);">Tutor:</span> <strong style="color: var(--text-primary);">${escapeHTML(medico.tutor || 'Não informado')}</strong></div>
          </div>
        </div>
        <div class="detail-group" style="grid-column: 1 / -1; background: rgba(6,182,212,0.06); padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid rgba(6,182,212,0.18);">
          <div style="font-weight: 700; color: var(--accent-secondary); font-size: 0.85rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
            <i class="fas fa-hospital-user"></i> Gestão Municipal de Saúde (SMS)
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.5rem; font-size: 0.85rem;">
            <div><span style="color: var(--text-muted);">Secretário(a):</span> <strong style="color: var(--text-primary);">${escapeHTML(medico.secretario_saude || 'Não informado')}</strong></div>
            <div><span style="color: var(--text-muted);">E-mail / Contato:</span> <strong style="color: var(--text-primary);">${medico.email_secretario ? `<a href="mailto:${escapeHTML(medico.email_secretario)}" style="color:var(--accent-secondary); text-decoration:underline;"><i class="fas fa-envelope" style="margin-right:4px;"></i>${escapeHTML(medico.email_secretario)}</a>` : 'Não informado'}</strong></div>
          </div>
        </div>
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


