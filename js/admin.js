// ============================================
// Gestão CCE — Orquestrador Principal do Painel
// ============================================

// Referência global segura ao cliente Supabase
var supabaseClient = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

// Configuração de Navegação SPA entre as Seções
function setupNavigation() {
  const navItems = {
    navDashboard: { section: 'sectionDashboard', title: 'Dashboard', subtitle: 'Visão geral do sistema' },
    navMedicos: { section: 'sectionMedicos', title: 'Médicos (PMMB)', subtitle: 'Consulta e filtros de profissionais' },
    navReferencias: { section: 'sectionReferencias', title: 'Referências Regionais', subtitle: 'Superintendências e regiões de saúde' },
    navSupervisores: { section: 'sectionSupervisores', title: 'Supervisores (PMMB)', subtitle: 'Gerenciamento de Supervisores' },
    navTutores: { section: 'sectionTutores', title: 'Tutores (PMMB)', subtitle: 'Gerenciamento de Tutores' },
    navMateriais: { section: 'sectionMateriais', title: 'Documentos e Materiais', subtitle: 'Repositório de apoio e normativas' },
    navProcessos: { section: 'sectionProcessos', title: 'Processos Administrativos', subtitle: 'Demandas e Acompanhamento de Processos SEI' },
    navUsers: { section: 'sectionUsers', title: 'Contas de Acesso', subtitle: 'Gerenciar permissões de usuários' }
  };

  Object.entries(navItems).forEach(([navId, config]) => {
    const navEl = document.getElementById(navId);
    if (navEl) {
      navEl.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        navEl.classList.add('active');

        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
        const section = document.getElementById(config.section);
        if (section) section.classList.add('active');

        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');
        if (pageTitle) pageTitle.textContent = config.title;
        if (pageSubtitle) pageSubtitle.textContent = config.subtitle;
      });
    }
  });
}

// Configuração dos eventos de fechamento de Modais
function setupModalCloseListeners() {
  const modalConfigs = [
    { btnId: 'btnCloseMedicoModal', modalId: 'modalMedico' },
    { btnId: 'btnCloseSupervisorModal', modalId: 'modalSupervisor' },
    { btnId: 'btnCloseTutorModal', modalId: 'modalTutor' },
    { btnId: 'btnCloseProcessoModal', modalId: 'modalProcesso' },
    { btnId: 'btnCloseRegiaoModal', modalId: 'modalRegiao' },
    { btnId: 'btnCloseExportModal', modalId: 'modalExport' }
  ];

  modalConfigs.forEach(({ btnId, modalId }) => {
    const btn = document.getElementById(btnId);
    const modal = document.getElementById(modalId);
    if (btn && modal) {
      btn.addEventListener('click', () => modal.classList.remove('active'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }
  });
}

// Inicialização e Verificação de Sessão do Admin
document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseClient) {
    showAlert('Supabase não configurado. Verifique as credenciais.', 'error');
    return;
  }

  // 1. Validar sessão ativa e permissão ADMIN
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role, name, status')
    .eq('id', session.user.id)
    .single();

  if (!profile || (profile.role !== 'ADMIN' && profile.status !== 'APPROVED')) {
    alert('Acesso Negado. Sua conta aguarda aprovação.');
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
    return;
  }

  // 2. Exibir o corpo da página após validação bem-sucedida
  document.body.style.display = 'block';

  // 3. Atualizar nome do usuário no topo
  const adminName = document.getElementById('adminName');
  if (adminName && profile.name) {
    adminName.textContent = profile.name;
  }

  // 4. Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  // 5. Inicializar Navegação SPA e Modais
  setupNavigation();
  setupModalCloseListeners();

  // 6. Carregar Módulos do Sistema
  loadDashboardStats();
  loadMedicos();
  setupMedicoFilters();
  setupExportLogic();

  loadReferencias();
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
