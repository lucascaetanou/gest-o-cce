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

  tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Carregando médicos…</td></tr>';

  try {
    // Leitura paginada: o Supabase devolve no máximo 1.000 linhas por consulta
    const cols = 'id, nome_profissional, perfil_profissional, status, ativo_inativo, municipio_atuacao, regiao_saude, status_prof_egestor, eixo_vaga, gestao, instituicao, tutor, supervisor, cpf, secretario_saude, email_secretario';
    const pageSize = 1000;
    let medicos = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseClient
        .from('doctors')
        .select(cols)
        .order('nome_profissional', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      medicos = medicos.concat(data || []);
      if (!data || data.length < pageSize) break;
    }

    if (!medicos.length) {
      tbody.innerHTML = emptyRow(5, 'Nenhum médico encontrado.', '');
      return;
    }

    window.medicosData = medicos;
    const ocupadas = medicos.filter(m => m.ativo_inativo !== 'INATIVA' && m.status === 'OCUPADA').length;
    setNavCount('navCountMedicos', ocupadas);
    const sub = document.getElementById('medicosSubtitle');
    if (sub) sub.textContent = `${fmtNum(ocupadas)} médicos em atividade · ${fmtNum(medicos.length)} vagas cadastradas`;

    populateMedicoFilters(medicos);
    setupMedicoFilters();
    filterMedicos();
    if (typeof window.refreshRegionReport === 'function') window.refreshRegionReport();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = emptyRow(5, 'Erro ao carregar médicos.', '');
  }
}


function renderMedicosTable(data) {
  const tbody = document.getElementById('medicosTableBody');
  const foot = document.getElementById('medicosFoot');
  if (!tbody) return;
  if (foot) foot.textContent = `${fmtNum((data || []).length)} de ${fmtNum((window.medicosData || []).length)} vagas`;

  if (!data || data.length === 0) {
    tbody.innerHTML = emptyRow(5, 'Nenhum médico encontrado', 'Nenhum profissional corresponde aos filtros. ',
      '<div style="margin-top:10px"><button class="btn btn-sm" onclick="document.getElementById(\'btnLimparFiltrosMedicos\')?.click()">Limpar filtros</button></div>');
    return;
  }

  tbody.innerHTML = data.map(m => {
    const inativa = m.ativo_inativo === 'INATIVA';
    const vaga = m.status === 'EM PROCESSO DE OCUPACAO' ? 'Em processo' : (m.status || 'Vaga');
    const sup = [m.supervisor ? `Sup.: ${escapeHTML(m.supervisor)}` : '', m.tutor ? `Tutor: ${escapeHTML(m.tutor)}` : ''].filter(Boolean).join(' · ');
    return `<tr class="click${inativa ? ' inactive' : ''}" data-id="${escapeHTML(String(m.id))}">
      <td>
        <div class="cell-main">${m.nome_profissional ? escapeHTML(m.nome_profissional) : '<span class="muted">Vaga sem profissional</span>'}</div>
        <div class="cell-sub">${escapeHTML(m.perfil_profissional || '')}${m.eixo_vaga ? ` · ${escapeHTML(titleCase(m.eixo_vaga))}` : ''}</div>
      </td>
      <td>${statusTag(vaga)}${inativa ? '<div class="cell-sub alert-num">Inativa</div>' : ''}</td>
      <td>${escapeHTML(titleCase(m.municipio_atuacao || '—'))}<div class="cell-sub">${escapeHTML(titleCase(m.regiao_saude || ''))}</div></td>
      <td>${escapeHTML(m.instituicao || '—')}${sup ? `<div class="cell-sub">${sup}</div>` : ''}</td>
      <td class="muted">${escapeHTML(titleCase(m.status_prof_egestor || '—'))}</td>
    </tr>`;
  }).join('');
}

// Clique na linha abre a gaveta de detalhes
document.addEventListener('click', (e) => {
  const tr = e.target.closest('#medicosTableBody tr[data-id]');
  if (tr && !e.target.closest('a, button')) viewMedicoDetails(tr.dataset.id);
});


function populateMedicoFilters(data) {
  const fill = (id, label, field) => {
    const select = document.getElementById(id);
    if (!select || !data) return;
    const currentVal = select.value;
    const values = new Set();
    data.forEach(m => { if (m[field] && String(m[field]).trim()) values.add(String(m[field]).trim()); });
    const sorted = Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    select.innerHTML = `<option value="">${label}</option>` + sorted.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join('');
    if (currentVal && values.has(currentVal)) select.value = currentVal;
  };
  fill('filterMedicoEixo', 'Todos os eixos', 'eixo_vaga');
  fill('filterMedicoGestao', 'Todas as gestões', 'gestao');
  fill('filterMedicoInstituicao', 'Todas as instituições', 'instituicao');
  fill('filterMedicoTutor', 'Todos os tutores', 'tutor');
}


function setupMedicoFilters() {
  if (window.__medicoFiltersBound) return;
  window.__medicoFiltersBound = true;
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
  const title = document.getElementById('modalMedicoTitle');
  if (!modal || !modalBody) return;

  if (title) title.textContent = 'Carregando…';
  modalBody.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Carregando detalhes…</div>';
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
    const processosRelacionados = (window.processosData || []).filter(p => matchMedicoProcesso(docName, p));

    if (title) title.textContent = medico.nome_profissional || 'Vaga sem profissional';
    const vaga = medico.status === 'EM PROCESSO DE OCUPACAO' ? 'Em processo' : medico.status;

    const processosHtml = processosRelacionados.length
      ? processosRelacionados.map(p => `
          <div class="linked">
            <div>
              <div class="mono" style="font-weight:500">${escapeHTML(p.numero_sei || '-')}</div>
              <div class="cell-sub">${escapeHTML(p.equipe_responsavel || '—')} · ${escapeHTML(titleCase(p.tipo_demanda || p.descricao_demanda || '—'))}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">${statusTag(p.status_processo)}
              <button class="btn btn-sm" onclick="goToProcessoDetails('${escapeHTML(String(p.id))}')">Abrir</button></div>
          </div>`).join('')
      : '<div class="hint" style="padding:8px 0">Nenhum processo administrativo vinculado a este profissional.</div>';

    const email = medico.email_secretario
      ? `<a href="mailto:${escapeHTML(medico.email_secretario)}">${escapeHTML(medico.email_secretario)}</a>` : '';

    modalBody.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px">${statusTag(vaga)}${medico.ativo_inativo === 'INATIVA' ? statusTag('Inativa') : ''}${medico.eixo_vaga ? `<span class="tag plain">${escapeHTML(titleCase(medico.eixo_vaga))}</span>` : ''}</div>
      <div class="dsec">Lotação</div>
      ${detailsList([
        ['Município', titleCase(medico.municipio_atuacao || '')],
        ['UF', medico.estado_atuacao],
        ['Região de saúde (CIR)', titleCase(medico.regiao_saude || '')],
        ['Categoria IVS', medico.categoria_ivs]
      ])}
      <div class="dsec">Vaga e vínculo</div>
      ${detailsList([
        ['Perfil profissional', medico.perfil_profissional],
        ['Nº inscrição', medico.nu_inscricao],
        ['Situação e-Gestor', medico.status_prof_egestor],
        ['Modalidade', medico.modalidade],
        ['Origem da vaga', medico.origem_vaga],
        ['Gestão', medico.gestao],
        ['Eixo integração', medico.eixo_integracao],
        ['Início da atividade', medico.inicio_atividade],
        ['Encerramento', medico.encerramento_atividade]
      ])}
      <div class="dsec">Supervisão acadêmica</div>
      ${detailsList([
        ['Instituição', medico.instituicao],
        ['Supervisor', medico.supervisor],
        ['Tutor', medico.tutor]
      ])}
      <div class="dsec">Gestão municipal</div>
      ${detailsList([
        ['Secretário(a) de saúde', medico.secretario_saude],
        ['Contato', email, true]
      ])}
      <div class="dsec">Dados pessoais</div>
      ${detailsList([
        ['País de origem', medico.pais_origem],
        ['Nacionalidade', medico.nacionalidade],
        ['Sexo', medico.sexo],
        ['Raça/cor', medico.raca_cor],
        ['CPF', maskCPF(medico.cpf)],
        ['E-mail', medico.email],
        ['Telefone', medico.telefone],
        ['Banco', `${medico.banco || '—'} · Ag. ${maskBankAccount(medico.agencia_bancaria)} · Cc. ${maskBankAccount(medico.conta_bancaria)}`]
      ])}
      <div class="dsec">Processos administrativos relacionados <span class="tag plain">${processosRelacionados.length}</span></div>
      ${processosHtml}
    `;
  } catch (err) {
    console.error(err);
    if (title) title.textContent = 'Detalhes';
    modalBody.innerHTML = '<div class="empty-state alert-num">Erro ao carregar detalhes do médico.</div>';
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


