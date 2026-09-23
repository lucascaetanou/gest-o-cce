// ============================================
// Gestão CCE — Módulo de Documentos e Materiais
// ============================================

window.materiaisData = [];

async function loadMateriais() {
  const grid = document.getElementById('materiaisGrid');
  if (!grid) return;
  
  grid.innerHTML = '<div class="empty-state">Carregando materiais…</div>';
  
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
    grid.innerHTML = `<div class="empty-state alert-num">Erro ao carregar materiais: ${escapeHTML(err.message)}</div>`;
  }
}


function renderMateriais() {
  const grid = document.getElementById('materiaisGrid');
  if (!grid || !window.materiaisData) return;

  // Contagem em cada aba
  document.querySelectorAll('#sectionMateriais [data-count]').forEach(el => {
    el.textContent = window.materiaisData.filter(m => m.categoria === el.dataset.count).length;
  });

  const activeTabBtn = document.querySelector('#sectionMateriais .tab-btn.active');
  const activeTab = activeTabBtn ? activeTabBtn.dataset.tab.toUpperCase() : 'TUTORIAIS';
  const categoria = activeTab === 'TUTORIAIS' ? 'TUTORIAL' : (activeTab === 'DOCUMENTOS' ? 'DOCUMENTO' : 'INFORMATIVO');

  const filtered = window.materiaisData.filter(m => m.categoria === categoria);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state">Nenhum material nesta categoria.</div>';
    return;
  }

  grid.innerHTML = filtered.map(m => {
    const isVideo = m.link_url && (m.link_url.includes('youtube') || m.link_url.includes('drive.google.com/file'));
    const href = /^https?:\/\//i.test(m.link_url || '') ? escapeHTML(m.link_url) : '#';
    return `<div class="doc">
      <div class="ic"><i class="fas ${isVideo ? 'fa-circle-play' : 'fa-file-lines'}"></i></div>
      <div>
        <div class="cell-main">${escapeHTML(m.titulo)}</div>
        ${m.descricao ? `<div class="cell-sub">${escapeHTML(m.descricao)}</div>` : ''}
        <div class="cell-sub">${isVideo ? 'Vídeo' : 'Link'} · ${fmtDate(m.created_at)}</div>
      </div>
      <a href="${href}" target="_blank" rel="noopener noreferrer" class="btn btn-sm">${isVideo ? 'Assistir' : 'Abrir'}</a>
    </div>`;
  }).join('');
}


function setupMateriaisLogic() {
  const tabBtns = document.querySelectorAll('#sectionMateriais .tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.toggle('active', b === btn));
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


