// ============================================
// Gestão CCE — Módulo de Tutores (PMMB)
// ============================================

window.tutoresData = [];

// Carrega lista de tutores
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar tutores.</td></tr>';
  }
}

// Renderiza tabela de tutores
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
    let badgeClass = 'badge-pending';
    let badgeText = escapeHTML(tutor.situacao || 'Desconhecido');
    
    if (badgeText.toLowerCase().includes('ativo') || badgeText.toLowerCase().includes('validado')) {
      badgeClass = 'badge-approved';
    } else if (badgeText.toLowerCase().includes('inativo') || badgeText.toLowerCase().includes('desligado')) {
      badgeClass = 'badge-rejected';
    }

    tr.innerHTML = `
      <td>
        <div style="font-weight:600; color:var(--text-primary)">${escapeHTML(tutor.nome_tutor || '-')}</div>
        <div style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(tutor.email || '-')}</div>
      </td>
      <td>
        <div style="font-weight:500">${escapeHTML(tutor.sigla_inst || tutor.inst_supervisora || '-')}</div>
        <div style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(tutor.municipio || '')}</div>
      </td>
      <td><div style="font-weight:500; color:var(--accent-secondary)">${escapeHTML(tutor.tipo_tutor || '-')}</div></td>
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

// Popula dropdowns de filtros de tutores
function populateTutorFilters(data) {
  if (!data) return;
  const sI = document.getElementById('filterInstTutores');
  const sT = document.getElementById('filterTipoTutores');
  const sS = document.getElementById('filterSituacaoTutores');

  if (sI && sI.options.length <= 1) {
    [...new Set(data.map(d => d.inst_supervisora || d.sigla_inst).filter(Boolean))].sort().forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sI.appendChild(o);
    });
  }

  if (sT && sT.options.length <= 1) {
    [...new Set(data.map(d => d.tipo_tutor).filter(Boolean))].sort().forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sT.appendChild(o);
    });
  }

  if (sS && sS.options.length <= 1) {
    [...new Set(data.map(d => d.situacao).filter(Boolean))].sort().forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sS.appendChild(o);
    });
  }
}

// Configura eventos dos filtros de tutores
function setupTutoresLogic() {
  const si = document.getElementById('searchTutores');
  const fI = document.getElementById('filterInstTutores');
  const fT = document.getElementById('filterTipoTutores');
  const fS = document.getElementById('filterSituacaoTutores');
  const bL = document.getElementById('btnLimparFiltrosTutores');
  const bR = document.getElementById('btnRefreshTutores');

  if (si) si.addEventListener('input', filterTutores);
  if (fI) fI.addEventListener('change', filterTutores);
  if (fT) fT.addEventListener('change', filterTutores);
  if (fS) fS.addEventListener('change', filterTutores);

  if (bL) {
    bL.addEventListener('click', () => {
      if (si) si.value = '';
      if (fI) fI.value = '';
      if (fT) fT.value = '';
      if (fS) fS.value = '';
      renderTutoresTable(window.tutoresData);
    });
  }

  if (bR) {
    bR.addEventListener('click', () => {
      const ic = bR.querySelector('i');
      if (ic) ic.classList.add('fa-spin');
      loadTutores().then(() => {
        if (ic) ic.classList.remove('fa-spin');
      });
    });
  }
}

// Filtra tutores em memória
function filterTutores() {
  const q = normStr(document.getElementById('searchTutores')?.value || '');
  const inst = document.getElementById('filterInstTutores')?.value || '';
  const tipo = document.getElementById('filterTipoTutores')?.value || '';
  const sit = document.getElementById('filterSituacaoTutores')?.value || '';

  const filtered = (window.tutoresData || []).filter(t => {
    const txt = normStr((t.nome_tutor || '') + ' ' + (t.email || '') + ' ' + (t.municipio || '') + ' ' + (t.inst_supervisora || '') + ' ' + (t.sigla_inst || ''));
    if (q && !txt.includes(q)) return false;
    if (inst && t.inst_supervisora !== inst && t.sigla_inst !== inst) return false;
    if (tipo && t.tipo_tutor !== tipo) return false;
    if (sit && t.situacao !== sit) return false;
    return true;
  });

  renderTutoresTable(filtered);
}

// Modal de detalhes do tutor
window.showTutorDetails = function(id) {
  const t = (window.tutoresData || []).find(x => x.id === id);
  if (!t) return;

  const mb = document.getElementById('modalTutorBody');
  const m = document.getElementById('modalTutor');
  if (!mb || !m) return;

  const e = escapeHTML;
  mb.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:1.5rem">
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Informações Pessoais</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Nome:</span> <span style="color:var(--text-primary); font-weight:500">${e(t.nome_tutor || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Mãe:</span> <span style="color:var(--text-primary)">${e(t.nome_mae || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Data Nasc.:</span> <span style="color:var(--text-primary)">${e(t.data_nascimento || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">E-mail:</span> <span style="color:var(--text-primary)">${e(t.email || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Tel 1:</span> ${e(t.telefone_1 || '-')} <small style="color:var(--text-muted)">(${e(t.tipo_tel_1 || '-')})</small></div>
          <div><span style="color:var(--text-secondary)">Tel 2:</span> ${e(t.telefone_2 || '-')} <small style="color:var(--text-muted)">(${e(t.tipo_tel_2 || '-')})</small></div>
          <div><span style="color:var(--text-secondary)">Tel 3:</span> ${e(t.telefone_3 || '-')} <small style="color:var(--text-muted)">(${e(t.tipo_tel_3 || '-')})</small></div>
        </div>
      </div>

      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Instituição e Função</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Inst. Supervisora:</span> <span style="color:var(--text-primary); font-weight:500">${e(t.inst_supervisora || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Sigla Inst.:</span> ${e(t.sigla_inst || '-')}</div>
          <div><span style="color:var(--text-secondary)">Tipo Tutor:</span> <span style="font-weight:500">${e(t.tipo_tutor || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Responsável IS:</span> ${e(t.responsavel_is || '-')}</div>
          <div><span style="color:var(--text-secondary)">Validado:</span> ${e(t.validado || '-')}</div>
          <div><span style="color:var(--text-secondary)">Situação:</span> <span style="font-weight:500">${e(t.situacao || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Data Cadastro:</span> ${e(t.data_cadastro || '-')}</div>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Endereço</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Logradouro:</span> ${e(t.logradouro || '-')}</div>
          <div><span style="color:var(--text-secondary)">Município:</span> ${e(t.municipio || '-')}</div>
          <div><span style="color:var(--text-secondary)">CEP:</span> ${e(t.cep || '-')}</div>
        </div>
      </div>

      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-secondary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Dados Profissionais</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Formação:</span> ${e(t.formacao_profissional || '-')}</div>
          <div><span style="color:var(--text-secondary)">Titulação:</span> ${e(t.titulacao || '-')}</div>
          <div><span style="color:var(--text-secondary)">Especialidade:</span> ${e(t.especialidade_medica || '-')}</div>
          <div><span style="color:var(--text-secondary)">Órgão de Classe:</span> ${e(t.orgao_classe || '-')} (${e(t.uf_conselho || '-')})</div>
          <div><span style="color:var(--text-secondary)">Número Reg.:</span> <span style="font-family:monospace">${e(t.numero_registro || '-')}</span></div>
        </div>
      </div>
    </div>
  `;

  m.classList.add('active');
};
