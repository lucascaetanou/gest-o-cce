// ============================================
// Gestão CCE — Orquestrador Principal do Painel
// ============================================

// Referência global segura ao cliente Supabase
var supabaseClient = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

// Mapeamento Central de Rotas SPA
const ROUTE_MAP = {
  'dashboard': { navId: 'navDashboard', section: 'sectionDashboard', title: 'Dashboard', subtitle: 'Visão geral do sistema' },
  'referencias': { navId: 'navReferencias', section: 'sectionReferencias', title: 'Referências Regionais', subtitle: 'Superintendências e regiões de saúde' },
  'medicos': { navId: 'navMedicos', section: 'sectionMedicos', title: 'Médicos (PMMB)', subtitle: 'Consulta e filtros de profissionais' },
  'supervisores': { navId: 'navSupervisores', section: 'sectionSupervisores', title: 'Supervisores (PMMB)', subtitle: 'Gerenciamento de Supervisores' },
  'tutores': { navId: 'navTutores', section: 'sectionTutores', title: 'Tutores (PMMB)', subtitle: 'Gerenciamento de Tutores' },
  'processos': { navId: 'navProcessos', section: 'sectionProcessos', title: 'Processos Administrativos', subtitle: 'Demandas e Acompanhamento de Processos SEI' },
  'materiais': { navId: 'navMateriais', section: 'sectionMateriais', title: 'Documentos e Materiais', subtitle: 'Repositório de apoio e normativas' },
  'users': { navId: 'navUsers', section: 'sectionUsers', title: 'Contas de Acesso', subtitle: 'Gerenciar permissões de usuários' }
};

let currentActiveRoute = 'dashboard';

// Função Universal de Navegação SPA com Histórico do Navegador
function navigateToRoute(routeKey, updateHistory = true) {
  const normalizedKey = (routeKey || '').replace(/^#\/?/, '').toLowerCase().trim();
  const config = ROUTE_MAP[normalizedKey] || ROUTE_MAP['dashboard'];
  const actualKey = ROUTE_MAP[normalizedKey] ? normalizedKey : 'dashboard';

  currentActiveRoute = actualKey;

  // 1. Atualizar Abas na Sidebar
  document.querySelectorAll('.sidebar .nav-item').forEach(item => item.classList.remove('active'));
  const navEl = document.getElementById(config.navId);
  if (navEl) navEl.classList.add('active');

  // 2. Alternar Seções Visíveis
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  const section = document.getElementById(config.section);
  if (section) section.classList.add('active');

  // 3. Atualizar Título e Subtítulo da Página
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  if (pageTitle) pageTitle.textContent = config.title;
  if (pageSubtitle) pageSubtitle.textContent = config.subtitle;

  // 4. Atualizar Histórico do Navegador (Sem recarregar a página)
  if (updateHistory) {
    const targetHash = '#' + actualKey;
    if (window.location.hash !== targetHash) {
      window.history.pushState({ route: actualKey }, config.title, targetHash);
    }
  }

  // 5. Scroll para o topo ao trocar de aba
  window.scrollTo({ top: 0, behavior: 'instant' });
  const mainEl = document.querySelector('.main-content');
  if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'instant' });

  // 6. Ciclo de Vida da Seção Ativada (Tratamento Mobile e Re-renderização)
  onSectionActivated(actualKey);
}

// Hook de Ativação de Seção (Resolve o congelamento de gráficos e tabelas no mobile)
function onSectionActivated(routeKey) {
  switch (routeKey) {
    case 'dashboard':
      // Se os dados dos médicos já foram carregados, re-renderizar métricas e forçar resize dos gráficos
      if (typeof window.renderDashboardWithCurrentFilter === 'function') {
        window.renderDashboardWithCurrentFilter();
      }
      // Reajuste de tamanho dos gráficos no canvas após o display: block
      setTimeout(() => {
        if (typeof window.resizeDashboardCharts === 'function') {
          window.resizeDashboardCharts();
        }
        window.dispatchEvent(new Event('resize'));
      }, 50);
      break;

    case 'medicos':
      if (typeof filterMedicos === 'function') {
        filterMedicos();
      }
      break;

    case 'referencias':
      // Se houver mapa ou tabela
      break;

    case 'supervisores':
      if (typeof filterSupervisores === 'function') {
        filterSupervisores();
      }
      break;

    case 'tutores':
      if (typeof filterTutores === 'function') {
        filterTutores();
      }
      break;

    case 'processos':
      if (typeof filterProcessos === 'function') {
        filterProcessos();
      }
      break;

    case 'materiais':
      if (typeof filterMateriais === 'function') {
        filterMateriais();
      }
      break;

    case 'users':
      if (typeof loadUsers === 'function') {
        loadUsers();
      }
      break;
  }
}

// Configuração de Navegação e Ouvintes de Histórico
function setupNavigation() {
  // 1. Cliques nos itens do menu
  Object.entries(ROUTE_MAP).forEach(([routeKey, config]) => {
    const navEl = document.getElementById(config.navId);
    if (navEl) {
      navEl.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToRoute(routeKey, true);
      });
    }
  });

  // 2. Ouvinte de Botão Voltar/Avançar do Celular ou Navegador (popstate / hashchange)
  window.addEventListener('popstate', () => {
    const currentHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const route = ROUTE_MAP[currentHash] ? currentHash : 'dashboard';
    navigateToRoute(route, false);
  });

  window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const route = ROUTE_MAP[currentHash] ? currentHash : 'dashboard';
    if (route !== currentActiveRoute) {
      navigateToRoute(route, false);
    }
  });

  // 3. Rota Inicial (Deep Linking)
  const initialHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  const startRoute = ROUTE_MAP[initialHash] ? initialHash : 'dashboard';
  if (!window.location.hash) {
    window.history.replaceState({ route: startRoute }, '', '#dashboard');
  }
  navigateToRoute(startRoute, false);
}

// Configuração dos eventos de fechamento de Modais
function setupModalCloseListeners() {
  const modalConfigs = [
    { btnId: 'btnCloseModal', modalId: 'modalMedico' },
    { btnId: 'btnCloseMedicoModal', modalId: 'modalMedico' },
    { btnId: 'btnCloseSupervisorModal', modalId: 'modalSupervisor' },
    { btnId: 'btnCloseTutorModal', modalId: 'modalTutor' },
    { btnId: 'btnCloseProcessoModal', modalId: 'modalProcesso' },
    { btnId: 'btnCloseRegiaoModal', modalId: 'modalRegiao' },
    { btnId: 'btnCloseExportModal', modalId: 'modalExport' },
    { btnId: 'btnCancelExport', modalId: 'modalExport' },
    { btnId: 'btnCloseMaterialModal', modalId: 'modalMaterial' },
    { btnId: 'btnCancelMaterial', modalId: 'modalMaterial' },
    { btnId: 'btnCloseNovoProcessoModal', modalId: 'modalNovoProcesso' },
    { btnId: 'btnCancelProcesso', modalId: 'modalNovoProcesso' }
  ];

  modalConfigs.forEach(({ btnId, modalId }) => {
    const btn = document.getElementById(btnId);
    const modal = document.getElementById(modalId);
    if (btn && modal) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('active');
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }
  });

  // Fechamento universal para qualquer modal com classe .btn-close
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.querySelectorAll('.btn-close, .modal-close, [data-dismiss="modal"]').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('active');
      });
    });
  });

  // Fechar modal ao pressionar ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
  });
}

// Inicialização e Verificação de Sessão do Admin
// Configuração do Menu Mobile (Gaveta Lateral Suave)
function setupMobileMenu() {
  const btnMenu = document.getElementById('btnMobileMenu');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  if (!btnMenu || !sidebar || !backdrop) return;

  const toggleSidebar = (open) => {
    sidebar.classList.toggle('open', open);
    backdrop.classList.toggle('active', open);
  };

  btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = sidebar.classList.contains('open');
    toggleSidebar(!isOpen);
  });

  backdrop.addEventListener('click', () => toggleSidebar(false));

  // Fechar sidebar ao clicar em qualquer item no mobile
  document.querySelectorAll('.sidebar .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        toggleSidebar(false);
      }
    });
  });
}

// Inicialização Geral
document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseClient) {
    showAlert('Supabase não configurado. Verifique as credenciais.', 'error');
    return;
  }

  // 1. Guardião Criptográfico: Validar token JWT da sessão ativa e permissão no Supabase
  let currentProfile = null;
  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
      document.body.innerHTML = '';
      window.location.replace('index.html');
      return;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, name, status')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'ADMIN' && profile.status !== 'APPROVED')) {
      alert('Acesso Restrito: Sua conta não possui permissão de administrador ou está aguardando aprovação.');
      await supabaseClient.auth.signOut();
      document.body.innerHTML = '';
      window.location.replace('index.html');
      return;
    }
    currentProfile = profile;
  } catch (err) {
    console.error('Erro de validação de acesso:', err);
    window.location.replace('index.html');
    return;
  }

  // 2. Exibir o corpo da página após validação bem-sucedida
  document.body.style.display = 'block';

  // 3. Atualizar nome do usuário no topo
  const adminName = document.getElementById('adminName');
  if (adminName && currentProfile && currentProfile.name) {
    adminName.textContent = currentProfile.name;
  }

  // 4. Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  // 5. Inicializar Navegação SPA, Modais e Alternador de Tema
  setupNavigation();
  setupMobileMenu();
  setupModalCloseListeners();
  setupThemeToggle();

  // 6. Carregar Módulos do Sistema
  loadDashboardStats();
  loadMedicos();
  setupMedicoFilters();
  setupExportLogic();

  loadReferencias();
  loadMapData();
  loadSupervisores();
  loadTutores();
  setupTutoresLogic();

  loadMateriais();
  setupMateriaisLogic();

  loadProcessos();
  setupProcessosLogic();

  loadUsers();

  // Refresh de usuários
  const btnRefreshUsers = document.getElementById('btnRefresh');
  if (btnRefreshUsers) {
    btnRefreshUsers.addEventListener('click', () => loadUsers());
  }
});

// Alternador de Tema Claro / Escuro (com persistência local)
function setupThemeToggle() {
  const btn = document.getElementById('btnThemeToggle');
  const icon = document.getElementById('themeIcon');
  const savedTheme = localStorage.getItem('gestao_cce_theme') || 'dark';

  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (icon) {
      icon.className = 'fas fa-moon';
      icon.style.color = 'var(--accent-primary)';
    }
  }

  if (btn && !btn.dataset.listenerAttached) {
    btn.dataset.listenerAttached = 'true';
    btn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('gestao_cce_theme', 'dark');
        if (icon) {
          icon.className = 'fas fa-sun';
          icon.style.color = 'var(--accent-warning)';
        }
        if (window.showToast) window.showToast('Tema Escuro ativado', 'info');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('gestao_cce_theme', 'light');
        if (icon) {
          icon.className = 'fas fa-moon';
          icon.style.color = 'var(--accent-primary)';
        }
        if (window.showToast) window.showToast('Tema Claro ativado', 'info');
      }
      // Re-renderizar gráficos com o novo tema
      if (typeof renderDashboardWithCurrentFilter === 'function') {
        renderDashboardWithCurrentFilter();
      }
    });
  }
}

