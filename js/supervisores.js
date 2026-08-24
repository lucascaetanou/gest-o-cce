// ============================================
// Gestão CCE — Módulo de Supervisores (PMMB)
// ============================================

window.supervisoresData = []; // Cache para o modal

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
    
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:3rem">Nenhum supervisor cadastrado.</td></tr>';
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
          <div style="font-weight:500">${escapeHTML(sup.sigla_inst || '-')}</div>
          <div style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(sup.uf_inst || '')}</div>
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
    
  } catch (err) {
    console.error('Erro ao buscar supervisores:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar supervisores: ${escapeHTML(err.message)}</td></tr>`;
  }
}


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
    
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
      <!-- ENDEREÇO -->
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-info); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Endereço</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Logradouro:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.logradouro || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Município:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.municipio || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">CEP:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.cep || '-')}</span></div>
        </div>
      </div>
      
      <!-- DADOS PROFISSIONAIS -->
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-info); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Dados Profissionais</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Formação:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.formacao_profissional || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Titulação:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.titulacao || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Especialidade:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.especialidade_medica || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Órgão de Classe:</span> <span style="color:var(--text-primary)">${escapeHTML(sup.orgao_classe || '-')} (${escapeHTML(sup.uf_conselho || '-')})</span></div>
          <div><span style="color:var(--text-secondary)">Número Reg.:</span> <span style="color:var(--text-primary); font-family:monospace">${escapeHTML(sup.numero_registro || '-')}</span></div>
        </div>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
};

