// ============================================
// Gestão CCE — Módulo de Documentos e Materiais
// ============================================

window.materiaisData = [];

// Carrega lista de materiais
async function loadMateriais() {
  const container = document.getElementById('materiaisGrid');
  if (!container) return;

  try {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 1rem;">Carregando documentos...</p></div>';

    const { data: materiais, error } = await supabaseClient
      .from('materiais')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    window.materiaisData = materiais || [];
    renderMateriais(window.materiaisData);

  } catch (error) {
    console.error('Erro ao carregar materiais:', error);
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--accent-danger); padding: 3rem;">Erro ao carregar os documentos.</div>';
  }
}

// Renderiza cards de materiais
function renderMateriais(materiais) {
  const container = document.getElementById('materiaisGrid');
  if (!container) return;

  if (!materiais || materiais.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum documento cadastrado.</div>';
    return;
  }

  container.innerHTML = '';

  materiais.forEach(mat => {
    const card = document.createElement('div');
    card.className = 'stat-card stat-card--primary';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';

    let iconClass = 'fa-file-alt';
    const cat = (mat.categoria || '').toUpperCase();
    if (cat.includes('PORTARIA') || cat.includes('LEGISLAÇÃO')) iconClass = 'fa-balance-scale';
    else if (cat.includes('MANUAL') || cat.includes('GUIA')) iconClass = 'fa-book';
    else if (cat.includes('FORMULÁRIO') || cat.includes('MODELO')) iconClass = 'fa-file-signature';

    card.innerHTML = `
      <div>
        <div style="display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.75rem;">
          <div class="stat-icon" style="background: rgba(124, 58, 237, 0.1); color: var(--accent-primary); width: 36px; height: 36px; border-radius: var(--radius-sm); font-size: 1rem;">
            <i class="fas ${iconClass}"></i>
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); line-height: 1.3;">
              ${escapeHTML(mat.titulo || 'Documento')}
            </div>
            <span class="badge badge-approved" style="font-size: 0.7rem; margin-top: 0.25rem;">
              ${escapeHTML(mat.categoria || 'Geral')}
            </span>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.4;">
          ${escapeHTML(mat.descricao || 'Sem descrição informada.')}
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
        <a href="${escapeHTML(mat.url || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="flex: 1; text-align: center; text-decoration: none;">
          <i class="fas fa-external-link-alt" style="margin-right: 0.25rem;"></i> Acessar
        </a>
      </div>
    `;
    container.appendChild(card);
  });
}

// Configura busca e filtros de materiais
function setupMateriaisLogic() {
  const searchInput = document.getElementById('searchMateriais');
  const btnRefresh = document.getElementById('btnRefreshMateriais');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = normStr(searchInput.value);
      const filtered = (window.materiaisData || []).filter(m => {
        return !q || normStr(m.titulo).includes(q) || normStr(m.descricao).includes(q) || normStr(m.categoria).includes(q);
      });
      renderMateriais(filtered);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadMateriais();
    });
  }
}
