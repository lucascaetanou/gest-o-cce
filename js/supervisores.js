// ============================================
// Gestão CCE — Módulo de Supervisores (PMMB)
// ============================================

window.supervisoresData = [];

// Carrega a tabela de supervisores
async function loadSupervisores() {
  const tbody = document.getElementById('supervisoresTableBody');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:3rem">Carregando supervisores...</td></tr>';

    const { data: supervisores, error } = await supabaseClient
      .from('supervisores')
      .select('*')
      .order('nome_supervisor', { ascending: true });

    if (error) throw error;

    window.supervisoresData = supervisores || [];

    if (!window.supervisoresData || window.supervisoresData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:3rem">Nenhum supervisor encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    window.supervisoresData.forEach(sup => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; color: var(--text-primary)">${escapeHTML(sup.nome_supervisor || '-')}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">${escapeHTML(sup.email || '-')}</div>
        </td>
        <td>
          <div style="font-weight: 500">${escapeHTML(sup.sigla_inst || sup.inst_supervisora || '-')}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">${escapeHTML(sup.municipio || '')}</div>
        </td>
        <td><span style="font-size: 0.85rem; color: var(--accent-secondary)">${escapeHTML(sup.tipo_supervisor || '-')}</span></td>
        <td>
          <div>${escapeHTML(sup.telefone_1 || '-')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted)">${escapeHTML(sup.tipo_tel_1 || '')}</div>
        </td>
        <td><span class="badge badge-approved">${escapeHTML(sup.situacao || 'Ativo')}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="showSupervisorDetails('${escapeHTML(sup.id)}')" title="Ver Detalhes">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('Erro ao carregar supervisores:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar supervisores.</td></tr>';
  }
}

// Modal de detalhes do supervisor
window.showSupervisorDetails = function(id) {
  const sup = (window.supervisoresData || []).find(s => s.id === id);
  if (!sup) return;

  const modalBody = document.getElementById('modalSupervisorBody');
  const modal = document.getElementById('modalSupervisor');
  if (!modalBody || !modal) return;

  modalBody.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:1.5rem">
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-primary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Informações Pessoais</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Nome:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(sup.nome_supervisor || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Mãe:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.nome_mae || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Data Nasc.:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.data_nascimento || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">E-mail:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.email || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Telefone 1:</span> ${escapeHTML(sup.telefone_1 || '-')} <small style="color:var(--text-muted)">(${escapeHTML(sup.tipo_tel_1 || '-')})</small></div>
          <div><span style="color:var(--text-secondary)">Telefone 2:</span> ${escapeHTML(sup.telefone_2 || '-')} <small style="color:var(--text-muted)">(${escapeHTML(sup.tipo_tel_2 || '-')})</small></div>
        </div>
      </div>

      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-primary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Instituição e Função</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Inst. Supervisora:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(sup.inst_supervisora || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Sigla Inst.:</span> ${escapeHTML(sup.sigla_inst || '-')}</div>
          <div><span style="color:var(--text-secondary)">Tipo Supervisor:</span> <span style="font-weight:500">${escapeHTML(sup.tipo_supervisor || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Responsável IS:</span> ${escapeHTML(sup.responsavel_is || '-')}</div>
          <div><span style="color:var(--text-secondary)">Situação:</span> <span class="badge badge-approved">${escapeHTML(sup.situacao || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Data Cadastro:</span> ${escapeHTML(sup.data_cadastro || '-')}</div>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-primary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Endereço</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Logradouro:</span> ${escapeHTML(sup.logradouro || '-')}</div>
          <div><span style="color:var(--text-secondary)">Município:</span> ${escapeHTML(sup.municipio || '-')}</div>
          <div><span style="color:var(--text-secondary)">CEP:</span> ${escapeHTML(sup.cep || '-')}</div>
        </div>
      </div>

      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-primary); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Dados Profissionais</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Formação:</span> ${escapeHTML(sup.formacao_profissional || '-')}</div>
          <div><span style="color:var(--text-secondary)">Titulação:</span> ${escapeHTML(sup.titulacao || '-')}</div>
          <div><span style="color:var(--text-secondary)">Especialidade:</span> ${escapeHTML(sup.especialidade_medica || '-')}</div>
          <div><span style="color:var(--text-secondary)">Órgão de Classe:</span> ${escapeHTML(sup.orgao_classe || '-')} (${escapeHTML(sup.uf_conselho || '-')})</div>
          <div><span style="color:var(--text-secondary)">Nº Registro:</span> <span style="font-family:monospace">${escapeHTML(sup.numero_registro || '-')}</span></div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
};
