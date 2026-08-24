// ============================================
// Gestão CCE — Módulo de Documentos e Materiais
// ============================================

window.materiaisData = [];

async function loadMateriais() {
  const grid = document.getElementById('materiaisGrid');
  if (!grid) return;
  
  grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">Carregando materiais...</div>';
  
  try {
    const { data, error } = await supabaseClient
      .from('materiais')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    window.materiaisData = data || [];
    renderMateriais();
  } catch (err) {
    console.error('Erro ao buscar materiais:', err);
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--accent-danger); padding: 3rem;">Erro ao carregar materiais: ${err.message}</div>`;
  }
}


function renderMateriais() {
  const grid = document.getElementById('materiaisGrid');
  if (!grid || !window.materiaisData) return;
  
  const activeTabBtn = document.querySelector('#sectionMateriais .tab-btn.active');
  const activeTab = activeTabBtn ? activeTabBtn.dataset.tab.toUpperCase() : 'TUTORIAIS';
  const categoria = activeTab === 'TUTORIAIS' ? 'TUTORIAL' : (activeTab === 'DOCUMENTOS' ? 'DOCUMENTO' : 'INFORMATIVO');
  
  const filtered = window.materiaisData.filter(m => m.categoria === categoria);
  
  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum material encontrado nesta categoria.</div>';
    return;
  }
  
  grid.innerHTML = '';
  filtered.forEach(m => {
    const isVideo = m.link_url && (m.link_url.includes('youtube') || m.link_url.includes('drive.google.com/file'));
    const icon = isVideo ? 'fa-play-circle' : 'fa-file-pdf';
    const color = isVideo ? '#ef4444' : '#3b82f6';
    
    grid.innerHTML += `
      <div style="background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: 1.5rem; transition: var(--transition); display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: flex; gap: 1rem; align-items: flex-start;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: ${color}; flex-shrink: 0;">
            <i class="fas ${icon}"></i>
          </div>
          <div>
            <h4 style="color: var(--text-primary); font-weight: 600; margin-bottom: 0.25rem;">${escapeHTML(m.titulo)}</h4>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(m.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; flex-grow: 1;">${escapeHTML(m.descricao || '')}</p>
        <a href="${/^https?:\/\//i.test(m.link_url || '') ? escapeHTML(m.link_url) : '#'}" target="_blank" class="btn btn-primary" style="width: 100%; text-align: center; justify-content: center; text-decoration: none;">
          ${isVideo ? '<i class="fas fa-play"></i> Assistir' : '<i class="fas fa-external-link-alt"></i> Acessar Documento'}
        </a>
      </div>
    `;
  });
}


function setupMateriaisLogic() {
  const tabBtns = document.querySelectorAll('#sectionMateriais .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.style.borderBottom = 'none';
        b.style.color = 'var(--text-secondary)';
      });
      btn.classList.add('active');
      btn.style.borderBottom = '2px solid var(--accent-primary)';
      btn.style.color = 'var(--text-primary)';
      renderMateriais();
    });
  });
  
  const modal = document.getElementById('modalMaterial');
  const btnOpen = document.getElementById('btnNovoMaterial');
  const btnClose = document.getElementById('btnCloseMaterialModal');
  const btnCancel = document.getElementById('btnCancelMaterial');
  
  const closeModal = () => { if(modal) modal.classList.remove('active'); };
  
  if (btnOpen) btnOpen.addEventListener('click', () => { if(modal) modal.classList.add('active'); });
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  
  const form = document.getElementById('materialForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById('btnSubmitMaterial');
      const origHtml = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      btnSubmit.disabled = true;
      
      const payload = {
        categoria: document.getElementById('matCategoria').value,
        titulo: document.getElementById('matTitulo').value,
        descricao: document.getElementById('matDescricao').value,
        link_url: document.getElementById('matLink').value
      };
      
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          payload.autor_id = session.user.id;
        }
        
        const { error } = await supabaseClient.from('materiais').insert([payload]);
        if (error) throw error;
        
        form.reset();
        closeModal();
        showAlert('Material cadastrado com sucesso!', 'success');
        loadMateriais();
      } catch (err) {
        console.error(err);
        showAlert('Erro ao salvar material: ' + err.message, 'error');
      } finally {
        btnSubmit.innerHTML = origHtml;
        btnSubmit.disabled = false;
      }
    });
  }
}


