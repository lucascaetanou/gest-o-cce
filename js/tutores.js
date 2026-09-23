// ============================================
// Gestão CCE — Módulo de Tutores (PMMB)
// ============================================

window.tutoresData = [];

window.tutoresData = []; // Cache para a tabela e o modal

async function loadTutores() {
  const tbody = document.getElementById('tutoresTableBody');
  if (!tbody) return;
  
  try {
    const { data, error } = await supabaseClient
      .from('tutores')
      .select('*')
      .order('nome_tutor', { ascending: true });
      
    if (error) throw error;
    
    window.tutoresData = data || [];
    setNavCount('navCountTutores', window.tutoresData.length);
    populateTutorFilters(window.tutoresData);
    renderTutoresTable(window.tutoresData);
    
  } catch (err) {
    console.error('Erro ao buscar tutores:', err);
    tbody.innerHTML = emptyRow(5, 'Erro ao carregar tutores', err.message);
  }
}


function renderTutoresTable(data) {
  const tbody = document.getElementById('tutoresTableBody');
  const count = document.getElementById('tutoresCountBadge');
  if (!tbody) return;
  if (count) count.textContent = `${fmtNum((data || []).length)} de ${fmtNum((window.tutoresData || []).length)} tutores`;

  if (!data || data.length === 0) {
    tbody.innerHTML = emptyRow(5, 'Nenhum tutor encontrado', 'Ajuste ou limpe os filtros.');
    return;
  }

  tbody.innerHTML = data.map(tutor => `
    <tr class="click" data-id="${escapeHTML(String(tutor.id))}">
      <td><div class="cell-main">${escapeHTML(tutor.nome_tutor || '—')}</div><div class="cell-sub">${escapeHTML(tutor.email || '')}</div></td>
      <td>${escapeHTML(tutor.sigla_inst || tutor.inst_supervisora || '—')}<div class="cell-sub">${escapeHTML(titleCase(tutor.municipio || ''))}</div></td>
      <td>${escapeHTML(titleCase(tutor.tipo_tutor || '—'))}</td>
      <td style="white-space:nowrap">${escapeHTML(tutor.telefone_1 || '—')}<div class="cell-sub">${escapeHTML(tutor.tipo_tel_1 || '')}</div></td>
      <td>${statusTag(tutor.situacao)}</td>
    </tr>`).join('');
}

document.addEventListener('click', (e) => {
  const tr = e.target.closest('#tutoresTableBody tr[data-id]');
  if (tr) window.showTutorDetails(tr.dataset.id);
});

function populateTutorFilters(data) {
  if (!data) return;

  const selectInst = document.getElementById('filterInstTutores');
  const selectTipo = document.getElementById('filterTipoTutores');
  const selectSituacao = document.getElementById('filterSituacaoTutores');

  if (selectInst && selectInst.options.length <= 1) {
    const insts = [...new Set(data.map(d => d.inst_supervisora || d.sigla_inst).filter(Boolean))].sort();
    insts.forEach(inst => {
      const opt = document.createElement('option');
      opt.value = inst;
      opt.textContent = inst;
      selectInst.appendChild(opt);
    });
  }

  if (selectTipo && selectTipo.options.length <= 1) {
    const tipos = [...new Set(data.map(d => d.tipo_tutor).filter(Boolean))].sort();
    tipos.forEach(tipo => {
      const opt = document.createElement('option');
      opt.value = tipo;
      opt.textContent = tipo;
      selectTipo.appendChild(opt);
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


function setupTutoresLogic() {
  const searchInput = document.getElementById('searchTutores');
  const selectInst = document.getElementById('filterInstTutores');
  const selectTipo = document.getElementById('filterTipoTutores');
  const selectSituacao = document.getElementById('filterSituacaoTutores');
  const btnLimpar = document.getElementById('btnLimparFiltrosTutores');
  const btnRefresh = document.getElementById('btnRefreshTutores');

  if (searchInput) searchInput.addEventListener('input', filterTutores);
  if (selectInst) selectInst.addEventListener('change', filterTutores);
  if (selectTipo) selectTipo.addEventListener('change', filterTutores);
  if (selectSituacao) selectSituacao.addEventListener('change', filterTutores);

  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (selectInst) selectInst.value = '';
      if (selectTipo) selectTipo.value = '';
      if (selectSituacao) selectSituacao.value = '';
      renderTutoresTable(window.tutoresData);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      const icon = btnRefresh.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      loadTutores().then(() => {
        if (icon) icon.classList.remove('fa-spin');
      });
    });
  }
}


function filterTutores() {
  const q = normStr(document.getElementById('searchTutores')?.value || '');
  const inst = document.getElementById('filterInstTutores')?.value || '';
  const tipo = document.getElementById('filterTipoTutores')?.value || '';
  const situacao = document.getElementById('filterSituacaoTutores')?.value || '';

  const filtered = (window.tutoresData || []).filter(t => {
    // Busca texto
    const txtSearch = normStr(`${t.nome_tutor || ''} ${t.email || ''} ${t.municipio || ''} ${t.inst_supervisora || ''} ${t.sigla_inst || ''}`);
    if (q && !txtSearch.includes(q)) return false;

    // Filtro Inst.
    if (inst && (t.inst_supervisora !== inst && t.sigla_inst !== inst)) return false;

    // Filtro Tipo
    if (tipo && t.tipo_tutor !== tipo) return false;

    // Filtro Situação
    if (situacao && t.situacao !== situacao) return false;

    return true;
  });

  renderTutoresTable(filtered);
}


window.showTutorDetails = function(id) {
  const tutor = (window.tutoresData || []).find(t => String(t.id) === String(id));
  if (!tutor) return;

  const modalBody = document.getElementById('modalTutorBody');
  const modal = document.getElementById('modalTutor');
  const title = document.getElementById('modalTutorTitle');
  if (!modalBody || !modal) return;

  const tel = (n, t) => n ? `${n}${t ? ` (${t})` : ''}` : '';
  if (title) title.textContent = tutor.nome_tutor || 'Tutor';
  modalBody.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 4px">${statusTag(tutor.situacao)}${tutor.tipo_tutor ? `<span class="tag plain">${escapeHTML(titleCase(tutor.tipo_tutor))}</span>` : ''}</div>
    <div class="dsec">Contato</div>
    ${detailsList([
      ['E-mail', tutor.email ? `<a href="mailto:${escapeHTML(tutor.email)}">${escapeHTML(tutor.email)}</a>` : '', true],
      ['Telefone 1', tel(tutor.telefone_1, tutor.tipo_tel_1)],
      ['Telefone 2', tel(tutor.telefone_2, tutor.tipo_tel_2)],
      ['Telefone 3', tel(tutor.telefone_3, tutor.tipo_tel_3)]
    ])}
    <div class="dsec">Instituição e função</div>
    ${detailsList([
      ['Instituição supervisora', tutor.inst_supervisora],
      ['Sigla', tutor.sigla_inst],
      ['Tipo de tutor', tutor.tipo_tutor],
      ['Responsável IS', tutor.responsavel_is],
      ['Validado', tutor.validado],
      ['Cadastrado em', tutor.data_cadastro]
    ])}
    <div class="dsec">Dados profissionais</div>
    ${detailsList([
      ['Formação', tutor.formacao_profissional],
      ['Titulação', tutor.titulacao],
      ['Especialidade', tutor.especialidade_medica],
      ['Órgão de classe', [tutor.orgao_classe, tutor.uf_conselho].filter(Boolean).join(' · ')],
      ['Nº de registro', tutor.numero_registro ? `<span class="mono">${escapeHTML(tutor.numero_registro)}</span>` : '', true]
    ])}
    <div class="dsec">Dados pessoais e endereço</div>
    ${detailsList([
      ['Nome da mãe', tutor.nome_mae],
      ['Data de nascimento', tutor.data_nascimento],
      ['Logradouro', tutor.logradouro],
      ['Município', tutor.municipio],
      ['CEP', tutor.cep]
    ])}
  `;

  modal.classList.add('active');
};
