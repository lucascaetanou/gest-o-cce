// ============================================
// Gestão CCE — Módulo de Tutores (PMMB)
// ============================================

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
    populateTutorFilters(window.tutoresData);
    renderTutoresTable(window.tutoresData);
    
  } catch (err) {
    console.error('Erro ao buscar tutores:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar tutores: ${escapeHTML(err.message)}</td></tr>`;
  }
}


function renderTutoresTable(data) {
  const tbody = document.getElementById('tutoresTableBody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:3rem">Nenhum tutor encontrado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  data.forEach(tutor => {
    const tr = document.createElement('tr');
    
    // badges status
    let badgeClass = 'badge-pending';
    let badgeText = escapeHTML(tutor.situacao || 'Desconhecido');
    if (badgeText.toLowerCase().includes('ativo') || badgeText.toLowerCase().includes('validado')) badgeClass = 'badge-approved';
    else if (badgeText.toLowerCase().includes('inativo') || badgeText.toLowerCase().includes('desligado')) badgeClass = 'badge-rejected';
    
    tr.innerHTML = `
      <td>
        <div style="font-weight:600; color:var(--text-primary)">${escapeHTML(tutor.nome_tutor || '-')}</div>
        <div style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(tutor.email || '-')}</div>
      </td>
      <td>
        <div style="font-weight:500">${escapeHTML(tutor.sigla_inst || tutor.inst_supervisora || '-')}</div>
        <div style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(tutor.municipio || '')}</div>
      </td>
      <td>
        <div style="font-weight:500; color:var(--accent-secondary)">${escapeHTML(tutor.tipo_tutor || '-')}</div>
      </td>
      <td>
        <div>${escapeHTML(tutor.telefone_1 || '-')}</div>
        <div style="font-size:0.75rem; color:var(--text-muted)">${escapeHTML(tutor.tipo_tel_1 || '')}</div>
      </td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="showTutorDetails('${escapeHTML(tutor.id)}')" title="Ver Detalhes">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}


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
  const tutor = (window.tutoresData || []).find(t => t.id === id);
  if (!tutor) return;
  
  const modalBody = document.getElementById('modalTutorBody');
  const modal = document.getElementById('modalTutor');
  if (!modalBody || !modal) return;
  
  modalBody.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:1.5rem">
      <!-- INFO BÁSICA -->
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Informações Pessoais</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Nome:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(tutor.nome_tutor || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Mãe:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.nome_mae || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Data Nasc.:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.data_nascimento || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">E-mail:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.email || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Tel 1:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.telefone_1 || '-')}</span> <small style="color:var(--text-muted)">(${escapeHTML(tutor.tipo_tel_1 || '-')})</small></div>
          <div><span style="color:var(--text-secondary)">Tel 2:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.telefone_2 || '-')}</span> <small style="color:var(--text-muted)">(${escapeHTML(tutor.tipo_tel_2 || '-')})</small></div>
          <div><span style="color:var(--text-secondary)">Tel 3:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.telefone_3 || '-')}</span> <small style="color:var(--text-muted)">(${escapeHTML(tutor.tipo_tel_3 || '-')})</small></div>
        </div>
      </div>
      
      <!-- INSTITUIÇÃO E SITUAÇÃO -->
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Instituição e Função</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Inst. Supervisora:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(tutor.inst_supervisora || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Sigla Inst.:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.sigla_inst || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Tipo Tutor:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(tutor.tipo_tutor || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Responsável IS:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.responsavel_is || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Validado:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.validado || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Situação:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(tutor.situacao || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Data Cadastro:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.data_cadastro || '-')}</span></div>
        </div>
      </div>
    </div>
    
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
      <!-- ENDEREÇO -->
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Endereço</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Logradouro:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.logradouro || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Município:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.municipio || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">CEP:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.cep || '-')}</span></div>
        </div>
      </div>
      
      <!-- DADOS PROFISSIONAIS -->
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Dados Profissionais</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Formação:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.formacao_profissional || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Titulação:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.titulacao || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Especialidade:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.especialidade_medica || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Órgão de Classe:</span> <span style="color:var(--text-primary)">${escapeHTML(tutor.orgao_classe || '-')} (${escapeHTML(tutor.uf_conselho || '-')})</span></div>
          <div><span style="color:var(--text-secondary)">Número Reg.:</span> <span style="color:var(--text-primary); font-family:monospace">${escapeHTML(tutor.numero_registro || '-')}</span></div>
        </div>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
};

