
// Helper: Normalização para busca insensível a acentos e maiúsculas
function normStr(str) {
  if (!str) return '';
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function matchMedicoProcesso(docName, processo) {
  if (!docName || !processo) return false;
  const d = normStr(docName);
  if (!d || d === 'vaga sem profissional' || d.length < 3) return false;

  const intStr = normStr(processo.interessado);
  const descStr = normStr(processo.descricao_demanda);

  // 1. Checa 'interessado' somente se houver conteúdo válido (minimo 3 caracteres)
  if (intStr && intStr.length >= 3) {
    // Nome completo do médico contido no interessado
    if (intStr.includes(d)) return true;
    // Interessado contido no nome do médico (apenas se interessado tiver tamanho relevante >= 6)
    if (d.includes(intStr) && intStr.length >= 6) return true;

    // Match palavra a palavra (primeiro nome + ao menos 1 sobrenome com no minimo 3 letras)
    const dWords = d.split(/\s+/).filter(w => w.length >= 3);
    const intWords = intStr.split(/\s+/).filter(w => w.length >= 3);
    if (dWords.length >= 2 && intWords.length >= 2) {
      const firstMatch = (dWords[0] === intWords[0]);
      const secondMatch = dWords.slice(1).some(w => intWords.includes(w));
      if (firstMatch && secondMatch) return true;
    }
  }

  // 2. Checa 'descricao_demanda' somente se nome do médico estiver presente nela
  if (descStr && descStr.length >= 6 && descStr.includes(d)) {
    return true;
  }

  return false;
}


// --- Security: XSS Escape Function ---
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- Security: Data Masking (LGPD) ---
function maskCPF(cpf) {
  if (!cpf || cpf === '-') return '-';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length < 11) return '***.***.***-**';
  return '***.' + clean.substring(3, 6) + '.' + clean.substring(6, 9) + '-**';
}
function maskBankAccount(val) {
  if (!val || val === '-') return '****';
  const s = String(val);
  if (s.length <= 2) return '****';
  return '****' + s.substring(s.length - 2);
}
// ============================================
// Gestão CCE — Admin Panel Module
// ============================================

// Chart instances (for updating)
let statusChart = null;
let monthlyChart = null;
let chartRegiao = null;
let chartTipoProf = null;
let chartProcStatus = null;
let chartProcEquipes = null;
let chartProcInteressados = null;


// ---- SPA Navigation ----
function setupNavigation() {
  const navItems = {
    navDashboard: { section: 'sectionDashboard', title: 'Dashboard', subtitle: 'Visão geral do sistema PMMB' },
    navMedicos: { section: 'sectionMedicos', title: 'Médicos (PMMB)', subtitle: 'Gerenciamento de médicos cadastrados' },
    navReferencias: { section: 'sectionReferencias', title: 'Referências Regionais', subtitle: 'Acompanhamento de vagas por região' },
    navSupervisores: { section: 'sectionSupervisores', title: 'Supervisores (PMMB)', subtitle: 'Gerenciamento de Supervisores' },
    navTutores: { section: 'sectionTutores', title: 'Tutores (PMMB)', subtitle: 'Gerenciamento de Tutores' },
    navMateriais: { section: 'sectionMateriais', title: 'Documentos e Materiais', subtitle: 'Manuais, tutoriais e informativos do sistema' },
    navProcessos: { section: 'sectionProcessos', title: 'Processos Administrativos', subtitle: 'Gerenciamento de processos administrativos' },
    navUsers: { section: 'sectionUsers', title: 'Contas de Acesso', subtitle: 'Gerenciar contas da plataforma' }
  };

  Object.entries(navItems).forEach(([navId, config]) => {
    const navEl = document.getElementById(navId);
    if (navEl) {
      navEl.addEventListener('click', () => {
        // Update active nav
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        navEl.classList.add('active');
        
        // Show correct section
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
        const section = document.getElementById(config.section);
        if (section) section.classList.add('active');
        
        // Update page title
        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');
        if (pageTitle) pageTitle.textContent = config.title;
        if (pageSubtitle) pageSubtitle.textContent = config.subtitle;
      });
    }
  });
}

// ---- Animated Counter ----
function animateCounter(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const duration = 1200; // ms
  const startTime = performance.now();
  const startValue = parseInt(el.textContent) || 0;
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (targetValue - startValue) * eased);
    el.textContent = currentValue;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ---- Fetch all doctors ----
async function fetchAllDoctors(selectCols) {
  let allData = [];
  let from = 0;
  const size = 1000;
  let fetchMore = true;
  const cols = selectCols || 'perfil_profissional,ativo_inativo,status,regiao_saude,municipio_atuacao';

  while (fetchMore) {
    const { data, error } = await supabaseClient
      .from('doctors')
      .select(cols)
      .range(from, from + size - 1);
    
    if (error) {
      console.error(error);
      break;
    }
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += size;
    } else {
      fetchMore = false;
    }
  }
  return allData;
}

// ---- Dashboard: Load Stats ----
async function loadDashboardStats() {
  if (!supabaseClient) return;

  try {
    // Load all doctors for stats calculation
    const allDoctors = await fetchAllDoctors('perfil_profissional,ativo_inativo,status,regiao_saude,municipio_atuacao,modalidade');

    // Calculate metrics from doctors table directly
    const ativas = allDoctors.filter(d => d.ativo_inativo === 'ATIVA');
    const ocupadas = ativas.filter(d => d.status === 'OCUPADA');
    const desocupadas = ativas.filter(d => d.status === 'DESOCUPADA');
    const emProcesso = ativas.filter(d => d.status === 'EM PROCESSO DE OCUPACAO');
    const federal = ativas.filter(d => d.modalidade && !d.modalidade.toUpperCase().includes('COPARTICIPACAO'));
    const copart = ativas.filter(d => d.modalidade && d.modalidade.toUpperCase().includes('COPARTICIPACAO'));
    const municipios = new Set(allDoctors.map(d => d.municipio_atuacao).filter(Boolean));

    const txOcupacao = ativas.length > 0 ? ((ocupadas.length / ativas.length) * 100).toFixed(0) : 0;

    // Update DOM Top Stats
    const elMed = document.getElementById('statMedicosAtivos'); if(elMed) elMed.textContent = ocupadas.length;
    const elVag = document.getElementById('statTotalVagas'); if(elVag) elVag.textContent = ativas.length;
    const elVagDet = document.getElementById('statVagasDet'); if(elVagDet) elVagDet.textContent = `${federal.length} fed. + ${copart.length} copart.`;
    const elTx = document.getElementById('statTaxaOcupacao'); if(elTx) elTx.textContent = `${txOcupacao}%`;
    const elTxDet = document.getElementById('statTaxaDet'); if(elTxDet) elTxDet.textContent = `${ocupadas.length} de ${ativas.length}`;
    const elDesoc = document.getElementById('statVagasDesocupadas'); if(elDesoc) elDesoc.textContent = desocupadas.length;
    const elExtra = document.getElementById('statProfissionalExtra'); if(elExtra) elExtra.textContent = emProcesso.length;
    const elSec = document.getElementById('statSecretarios'); if(elSec) elSec.textContent = municipios.size;
    const elSecDet = document.getElementById('statSecretariosDet'); if(elSecDet) elSecDet.textContent = `${municipios.size} municípios`;

    const d = new Date();
    const subTitle = document.getElementById('dashSubtitle');
    if (subTitle) subTitle.textContent = `Lista atualizada em ${d.toLocaleDateString('pt-BR')} • ${municipios.size} municípios com profissionais ativos`;

    // 2. Alertas de Desocupação (from referencias table)
    const { data: referencias } = await supabaseClient.from('referencias_regionalizadas').select('*');
    updateAlertas(referencias);

    // 3. Chart: Medicos por Região (from all doctors)
    updateMedicosRegiaoChart(null, allDoctors);

    // 4. Chart: Tipo Profissional
    updateTipoProfissionalChart(allDoctors);

  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

function updateAlertas(referencias) {
  if (referencias) {
    window.dashboardReferencias = referencias;
  }
  renderAlertasList();
}

function renderAlertasList() {
  const container = document.getElementById('alertasList');
  const countEl = document.getElementById('alertasCount');
  const sortSelect = document.getElementById('alertasSort');
  const referencias = window.dashboardReferencias;
  
  if (!container || !referencias) return;
  
  // Set up event listener if not already done
  if (sortSelect && !sortSelect.dataset.listener) {
    sortSelect.addEventListener('change', renderAlertasList);
    sortSelect.dataset.listener = 'true';
  }

  let alertas = referencias.filter(r => r.vagas_desocupadas > 0);
  
  const sortMethod = sortSelect ? sortSelect.value : 'desc';
  
  alertas.sort((a, b) => {
    if (sortMethod === 'asc') {
      return (a.vagas_desocupadas || 0) - (b.vagas_desocupadas || 0);
    } else if (sortMethod === 'alpha') {
      return (a.municipio_dsei || '').localeCompare(b.municipio_dsei || '');
    } else { // desc
      return (b.vagas_desocupadas || 0) - (a.vagas_desocupadas || 0);
    }
  });
  
  if(countEl) countEl.textContent = `${alertas.length} municípios com vagas abertas`;
  container.innerHTML = '';

  if (alertas.length === 0) {
    container.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-muted);">Nenhum alerta de desocupação.</div>';
    return;
  }

  alertas.forEach(a => {
    const total = a.total_vagas || 0;
    const desc = a.vagas_desocupadas || 0;
    const prog = total > 0 ? ((desc / total) * 100).toFixed(0) : 0;
    
    let badgeClass = 'badge-danger';
    if (prog < 30) badgeClass = 'badge-warning';
    
    const html = `
      <div class="alerta-item" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:600; color:var(--text-primary)">${escapeHTML(a.municipio_dsei || '-')}</div>
          <div style="font-size:0.8rem; color:var(--text-muted)">${escapeHTML(a.macro_regiao || '-')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.1rem; font-weight:700; color:var(--accent-danger)">${desc} <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted)">desocupadas</span></div>
          <div style="font-size:0.8rem; color:var(--text-muted)">de ${total} vagas totais</div>
        </div>
      </div>
    `;
    container.innerHTML += html;
  });
}

function updateMedicosRegiaoChart(referencias, allDoctors) {
  const ctx = document.getElementById('chartMedicosRegiao');
  if (!ctx) return;

  // Group by regiao_saude from doctors
  const dataMap = {};
  const source = allDoctors || [];
  source.filter(d => d.ativo_inativo === 'ATIVA' && d.status === 'OCUPADA').forEach(d => {
    const regiao = d.regiao_saude || 'Não Informado';
    dataMap[regiao] = (dataMap[regiao] || 0) + 1;
  });

  const labels = Object.keys(dataMap).sort((a,b) => dataMap[b] - dataMap[a]);
  const data = labels.map(l => dataMap[l]);

  if (chartRegiao) chartRegiao.destroy();

  chartRegiao = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Médicos Ativos',
        data: data,
        backgroundColor: '#6366f1',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b8fa3' } },
        x: { grid: { display: false }, ticks: { color: '#8b8fa3', maxRotation: 45, minRotation: 45 } }
      },
      plugins: { legend: { display: false } }
    }
  });
}


function updateTipoProfissionalChart(doctors) {
  const ctx = document.getElementById('chartTipoProfissional');
  if (!ctx || !doctors) return;

  // Group by perfil_profissional
  const dataMap = {};
  doctors.forEach(d => {
    const perfil = d.perfil_profissional || 'Não Informado';
    dataMap[perfil] = (dataMap[perfil] || 0) + 1;
  });

  const labels = Object.keys(dataMap);
  const data = labels.map(l => dataMap[l]);

  if (chartTipoProf) chartTipoProf.destroy();

  chartTipoProf = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'],
        borderWidth: 2,
        borderColor: '#111638'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { color: '#f0f0ff', padding: 20 } }
      }
    }
  });
}

// ---- Load Users Table ----
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  
  // Loading state (safe, no user data)
  tbody.innerHTML = '';
  const loadingRow = document.createElement('tr');
  const loadingCell = document.createElement('td');
  loadingCell.colSpan = 5;
  loadingCell.style.cssText = 'text-align:center; color:var(--text-muted); padding:3rem;';
  loadingCell.textContent = 'Carregando usuários...';
  loadingRow.appendChild(loadingCell);
  tbody.appendChild(loadingRow);

  try {
    const { data: users, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    tbody.innerHTML = '';

    const nonAdminUsers = (users || []).filter(u => {
      const r = (u.role || '').toUpperCase();
      return r !== 'ADMIN';
    });
    
    if (nonAdminUsers.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 5;
      emptyCell.style.cssText = 'text-align:center; color:var(--text-muted); padding:3rem;';
      emptyCell.textContent = 'Nenhum usuário pendente ou cadastrado no momento.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    nonAdminUsers.forEach(user => {
      const tr = document.createElement('tr');

      // Name
      const tdName = document.createElement('td');
      tdName.textContent = user.name || user.full_name || '-';
      tr.appendChild(tdName);

      // Email
      const tdEmail = document.createElement('td');
      tdEmail.textContent = user.email || '-';
      tr.appendChild(tdEmail);

      // Phone
      const tdPhone = document.createElement('td');
      tdPhone.textContent = user.phone || '-';
      tr.appendChild(tdPhone);

      // Status badge
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      if (user.status === 'APPROVED') {
        badge.className = 'badge badge-approved';
        badge.textContent = 'Aprovado';
      } else if (user.status === 'REJECTED') {
        badge.className = 'badge badge-rejected';
        badge.textContent = 'Rejeitado';
      } else {
        badge.className = 'badge badge-pending';
        badge.textContent = 'Pendente';
      }
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      // Actions
      const tdActions = document.createElement('td');
      tdActions.style.cssText = 'display:flex; gap:0.5rem;';

      if (user.status === 'PENDING') {
        const btnApprove = document.createElement('button');
        btnApprove.className = 'btn btn-sm btn-success';
        btnApprove.textContent = 'Aprovar';
        btnApprove.addEventListener('click', () => updateStatus(user.id, 'APPROVED'));

        const btnReject = document.createElement('button');
        btnReject.className = 'btn btn-sm btn-danger';
        btnReject.textContent = 'Rejeitar';
        btnReject.addEventListener('click', () => updateStatus(user.id, 'REJECTED'));

        tdActions.appendChild(btnApprove);
        tdActions.appendChild(btnReject);
      } else {
        const resolvedSpan = document.createElement('span');
        resolvedSpan.style.cssText = 'color:var(--text-muted); font-size:0.8rem;';
        resolvedSpan.textContent = 'Resolvido';
        tdActions.appendChild(resolvedSpan);
      }

      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error(error);
    showAlert('Erro ao carregar usuários.', 'error');
  }
}

// ---- Update User Status ----
async function updateStatus(userId, newStatus) {
  const action = newStatus === 'APPROVED' ? 'APROVAR' : 'REJEITAR';
  if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) return;

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);

    if (error) throw error;

    showAlert(`Usuário ${newStatus === 'APPROVED' ? 'aprovado' : 'rejeitado'} com sucesso!`, 'success');
    
    // Refresh both table and dashboard
    loadUsers();
    loadDashboardStats();

  } catch (error) {
    showAlert('Erro ao atualizar usuário.', 'error');
  }
}
// ---- Load Medicos (PMMB) ----
async function loadMedicos() {
  const tbody = document.getElementById('medicosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Carregando médicos...</td></tr>';

  try {
    const { data: medicos, error } = await supabaseClient
      .from('doctors')
      .select('id, nome_profissional, perfil_profissional, status, ativo_inativo, municipio_atuacao, regiao_saude, status_prof_egestor, eixo_vaga, gestao')
      .order('nome_profissional', { ascending: true });

    if (error) throw error;

    if (!medicos || medicos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Nenhum médico encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    
    window.medicosData = medicos;
    populateMedicoFilters(medicos);
    renderMedicosTable(window.medicosData);
    setupMedicoFilters();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ef4444; padding: 3rem;">Erro ao carregar médicos.</td></tr>';
  }
}

function renderMedicosTable(data) {
  const tbody = document.getElementById('medicosTableBody');
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Nenhum médico encontrado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  
  data.forEach(m => {
      const tr = document.createElement('tr');
      
      let statusBadge = `<span class="badge badge-pending">${escapeHTML(m.status || 'Vaga')}</span>`;
      if (m.status === 'OCUPADA') statusBadge = `<span class="badge badge-approved">OCUPADA</span>`;
      else if (m.status === 'DESOCUPADA') statusBadge = `<span class="badge badge-rejected">DESOCUPADA</span>`;
      else if (m.status === 'EM PROCESSO DE OCUPACAO') statusBadge = `<span class="badge badge-pending">EM PROCESSO</span>`;

      const isInativa = m.ativo_inativo === 'INATIVA';
      const rowStyle = isInativa ? 'opacity: 0.5;' : '';

      tr.style.cssText = rowStyle;
      tr.innerHTML = `
        <td>
          <div style="font-weight: 500; color: var(--text-primary)">${m.nome_profissional ? escapeHTML(m.nome_profissional) : '<em style="color:var(--text-muted)">Vaga sem profissional</em>'}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">${escapeHTML(m.perfil_profissional || '-')}</div>
        </td>
        <td>${statusBadge}${isInativa ? '<div style="font-size:0.7rem;color:var(--accent-danger);margin-top:2px">INATIVA</div>' : ''}</td>
        <td>
          <div>${escapeHTML(m.municipio_atuacao || '-')}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">${escapeHTML(m.regiao_saude || '-')}</div>
        </td>
        <td style="font-size:0.8rem; color: var(--text-secondary)">${escapeHTML(m.status_prof_egestor || '-')}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" onclick="viewMedicoDetails('${escapeHTML(m.id)}')">Ver</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

function populateMedicoFilters(data) {
  const selectEixo = document.getElementById('filterMedicoEixo');
  const selectGestao = document.getElementById('filterMedicoGestao');

  if (selectEixo && data) {
    const currentVal = selectEixo.value;
    const eixos = new Set();
    data.forEach(m => {
      if (m.eixo_vaga) {
        const val = m.eixo_vaga.trim();
        if (val) eixos.add(val);
      }
    });
    const sorted = Array.from(eixos).sort();
    selectEixo.innerHTML = '<option value="" style="background: #1e293b; color: #fff;">Todos os Eixos</option>' +
      sorted.map(v => `<option value="${escapeHTML(v)}" style="background: #1e293b; color: #fff;">${escapeHTML(v)}</option>`).join('');
    if (currentVal && eixos.has(currentVal)) selectEixo.value = currentVal;
  }

  if (selectGestao && data) {
    const currentVal = selectGestao.value;
    const gestoes = new Set();
    data.forEach(m => {
      if (m.gestao) {
        const val = m.gestao.trim();
        if (val) gestoes.add(val);
      }
    });
    const sorted = Array.from(gestoes).sort();
    selectGestao.innerHTML = '<option value="" style="background: #1e293b; color: #fff;">Todas as Gestões</option>' +
      sorted.map(v => `<option value="${escapeHTML(v)}" style="background: #1e293b; color: #fff;">${escapeHTML(v)}</option>`).join('');
    if (currentVal && gestoes.has(currentVal)) selectGestao.value = currentVal;
  }
}

function setupMedicoFilters() {
  const elementIds = ['searchMedicoName', 'searchMedicoCity', 'filterMedicoEixo', 'filterMedicoGestao'];
  
  elementIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', filterMedicos);
      el.addEventListener('change', filterMedicos);
    }
  });

  const btnLimpar = document.getElementById('btnLimparFiltrosMedicos');
  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      elementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      filterMedicos();
    });
  }
}

function filterMedicos() {
  if (!window.medicosData) return;

  const nameVal = normStr(document.getElementById('searchMedicoName')?.value);
  const cityVal = normStr(document.getElementById('searchMedicoCity')?.value);
  const eixoVal = (document.getElementById('filterMedicoEixo')?.value || '').trim().toUpperCase();
  const gestaoVal = (document.getElementById('filterMedicoGestao')?.value || '').trim().toUpperCase();

  const filtered = window.medicosData.filter(m => {
    // 1. Nome
    if (nameVal) {
      const nome = normStr(m.nome_profissional || 'vaga sem profissional');
      if (!nome.includes(nameVal)) return false;
    }

    // 2. Município / Região
    if (cityVal) {
      const city = normStr(m.municipio_atuacao);
      const regiao = normStr(m.regiao_saude);
      if (!city.includes(cityVal) && !regiao.includes(cityVal)) return false;
    }

    // 3. Eixo da Vaga
    if (eixoVal) {
      const mEixo = (m.eixo_vaga || '').trim().toUpperCase();
      if (mEixo !== eixoVal) return false;
    }

    // 4. Gestão
    if (gestaoVal) {
      const mGestao = (m.gestao || '').trim().toUpperCase();
      if (mGestao !== gestaoVal) return false;
    }

    return true;
  });

  renderMedicosTable(filtered);
}

// ---- Load Referencias Regionais ----
let allReferencias = [];

async function loadReferencias() {
  const tbody = document.getElementById('referenciasTableBody');
  const tabsContainer = document.getElementById('referenciasTabs');
  if (!tbody || !tabsContainer) return;
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Carregando referências...</td></tr>';
  tabsContainer.innerHTML = '';

  try {
    const { data: referencias, error } = await supabaseClient
      .from('referencias_regionalizadas')
      .select('*')
      .order('municipio_dsei', { ascending: true });

    if (error) throw error;

    if (!referencias || referencias.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Nenhuma referência encontrada.</td></tr>';
      return;
    }

    allReferencias = referencias;
    
    // Get unique responsaveis
    const uniqueResponsaveis = [...new Set(referencias.map(r => r.responsavel).filter(Boolean))].sort();
    
    // Add "Todas as Regiões" as the first tab
    const tabs = ['Todas as Regiões', ...uniqueResponsaveis];

    if (tabs.length === 1) { // Only "Todas" exists
      renderReferenciasTable(referencias);
      return;
    }

    // Create Tabs
    tabs.forEach((tabName, index) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm ' + (index === 0 ? 'btn-primary' : 'btn-ghost');
      btn.textContent = tabName;
      btn.onclick = () => {
        // Update active tab style
        Array.from(tabsContainer.children).forEach(c => {
          c.classList.remove('btn-primary');
          c.classList.add('btn-ghost');
        });
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-primary');
        
        // Render filtered table
        if (tabName === 'Todas as Regiões') {
          renderReferenciasTable(allReferencias);
        } else {
          renderReferenciasTable(allReferencias.filter(r => r.responsavel === tabName));
        }
      };
      tabsContainer.appendChild(btn);
    });

    // Render first tab by default
    renderReferenciasTable(allReferencias);

  } catch (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ef4444; padding: 3rem;">Erro ao carregar referências.</td></tr>';
  }
}

function renderReferenciasTable(data) {
  const tbody = document.getElementById('referenciasTableBody');
  if (!tbody) return;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 3rem;">Nenhum município para esta referência.</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  
  data.forEach(r => {
    const tr = document.createElement('tr');
    
    const totalVagas = r.total_vagas || 0;
    const desocupadas = r.vagas_desocupadas || 0;
    const ocupadas = totalVagas - desocupadas;
    
    // Simple progress bar for occupation
    const percent = totalVagas > 0 ? (ocupadas / totalVagas) * 100 : 0;
    let barColor = '#10b981'; // green
    if (percent > 80) barColor = '#f59e0b'; // yellow
    if (percent > 95) barColor = '#ef4444'; // red

    tr.innerHTML = `
      <td>
        <div style="font-weight: 500;">${escapeHTML(r.regiao_saude || '-')}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted)">Resp: ${escapeHTML(r.responsavel || '-')}</div>
      </td>
      <td>
        <div>${escapeHTML(r.municipio_dsei || '-')}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted)">${escapeHTML(r.macro_regiao || '-')}</div>
      </td>
      <td>${escapeHTML(r.categoria_ivs || '-')}</td>
      <td>
        <div style="font-weight: 600">${totalVagas} totais</div>
        <div style="font-size: 0.8rem; color: var(--text-muted)">
          Fed: ${r.vagas_autorizadas_federal || 0} | Muni: ${r.vagas_coparticipacao_municipal || 0}
        </div>
      </td>
      <td style="min-width: 150px;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-size: 0.8rem;">
          <span>${ocupadas} ocupadas</span>
          <span style="color:var(--text-muted)">${desocupadas} livres</span>
        </div>
        <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${percent}%; background: ${barColor};"></div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ---- View Medico Details ----
async function viewMedicoDetails(id) {
  const modal = document.getElementById('modalMedico');
  const modalBody = document.getElementById('modalMedicoBody');
  if (!modal || !modalBody) return;
  
  modalBody.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted)"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:1rem">Carregando detalhes...</p></div>';
  modal.classList.add('active');

  try {
    const { data: medico, error } = await supabaseClient
      .from('doctors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Garantir que temos processosData carregado
    if (!window.processosData || window.processosData.length === 0) {
      try {
        const { data: pData } = await supabaseClient.from('processos_administrativos').select('*').order('created_at', { ascending: false });
        window.processosData = pData || [];
      } catch (e) {
        console.error('Erro ao buscar processos para vinculo:', e);
      }
    }

    // Buscar processos relacionados por nome do médico (insensível a acentos)
    const docName = (medico.nome_profissional || '').trim();
    let processosRelacionados = (window.processosData || []).filter(p => matchMedicoProcesso(docName, p));

    let processosHtml = '';
    if (processosRelacionados.length > 0) {
      processosHtml = processosRelacionados.map(p => {
        let badgeClass = 'badge-pending';
        const st = (p.status_processo || '').toUpperCase();
        if (st.includes('CONCLUÍDO') || st.includes('CONCLUIDO')) badgeClass = 'badge-approved';
        else if (st.includes('ARQUIVADO') || st.includes('SOBRESTADO')) badgeClass = 'badge-rejected';

        return `
          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.85rem; margin-top:0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem">
                <span style="font-weight:600; color:var(--text-primary); font-family:monospace; font-size:0.85rem">${escapeHTML(p.numero_sei || '-')}</span>
                <span class="badge ${badgeClass}">${escapeHTML(p.status_processo || '-')}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Equipe: <strong>${escapeHTML(p.equipe_responsavel || '-')}</strong> | Demanda: ${escapeHTML(p.descricao_demanda || '-')}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="goToProcessoDetails('${escapeHTML(p.id)}')" style="font-size:0.8rem">
              <i class="fas fa-external-link-alt"></i> Ver Processo
            </button>
          </div>
        `;
      }).join('');
    } else {
      processosHtml = '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0">Nenhum processo administrativo vinculado a este(a) profissional.</div>';
    }

    modalBody.innerHTML = `
      <div class="modal-grid">
        <div class="detail-group"><div class="detail-label">Nome Completo</div><div class="detail-value">${escapeHTML(medico.nome_profissional || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Nº Inscrição</div><div class="detail-value">${escapeHTML(medico.nu_inscricao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Perfil Profissional</div><div class="detail-value">${escapeHTML(medico.perfil_profissional || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Status da Vaga</div><div class="detail-value">${escapeHTML(medico.status || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Ativo/Inativo</div><div class="detail-value">${escapeHTML(medico.ativo_inativo || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Status e-Gestor</div><div class="detail-value">${escapeHTML(medico.status_prof_egestor || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Município</div><div class="detail-value">${escapeHTML(medico.municipio_atuacao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Região de Saúde (CIR)</div><div class="detail-value">${escapeHTML(medico.regiao_saude || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">UF</div><div class="detail-value">${escapeHTML(medico.estado_atuacao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Categoria IVS</div><div class="detail-value">${escapeHTML(medico.categoria_ivs || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Modalidade</div><div class="detail-value">${escapeHTML(medico.modalidade || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Eixo da Vaga</div><div class="detail-value">${escapeHTML(medico.eixo_vaga || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Origem da Vaga</div><div class="detail-value">${escapeHTML(medico.origem_vaga || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Gestão</div><div class="detail-value">${escapeHTML(medico.gestao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Eixo Integração</div><div class="detail-value">${escapeHTML(medico.eixo_integracao || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">País de Origem</div><div class="detail-value">${escapeHTML(medico.pais_origem || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Nacionalidade</div><div class="detail-value">${escapeHTML(medico.nacionalidade || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Sexo</div><div class="detail-value">${escapeHTML(medico.sexo || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Raça/Cor</div><div class="detail-value">${escapeHTML(medico.raca_cor || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Início Atividade</div><div class="detail-value">${escapeHTML(medico.inicio_atividade || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Encerramento</div><div class="detail-value">${escapeHTML(medico.encerramento_atividade || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">CPF</div><div class="detail-value">${maskCPF(medico.cpf)}</div></div>
        <div class="detail-group"><div class="detail-label">Email</div><div class="detail-value">${escapeHTML(medico.email || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Telefone</div><div class="detail-value">${escapeHTML(medico.telefone || '-')}</div></div>
        <div class="detail-group"><div class="detail-label">Banco</div><div class="detail-value">${escapeHTML(medico.banco || '-')} / Ag: ${maskBankAccount(medico.agencia_bancaria)} / Cc: ${maskBankAccount(medico.conta_bancaria)}</div></div>
      </div>

      <!-- Seção de Processos Administrativos Vinculados -->
      <div style="margin-top:1.5rem; background:var(--bg-secondary); padding:1.25rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-info); font-size:0.95rem; font-weight:600; display:flex; align-items:center; justify-content:space-between">
          <span><i class="fas fa-gavel" style="margin-right:0.5rem"></i> Processos Administrativos Relacionados</span>
          <span class="badge badge-info" style="font-size:0.8rem">${processosRelacionados.length}</span>
        </h4>
        ${processosHtml}
      </div>
    `;
  } catch (err) {
    console.error(err);
    modalBody.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--accent-danger)">Erro ao carregar detalhes do médico.</div>';
  }
}


window.goToProcessoDetails = function(processoId) {
  // 1. Fechar modal do médico
  const modalMedico = document.getElementById('modalMedico');
  if (modalMedico) modalMedico.classList.remove('active');

  // 2. Mudar para a aba de Processos
  const navProc = document.getElementById('navProcessos');
  if (navProc) navProc.click();

  // 3. Abrir o modal do processo específico
  setTimeout(() => {
    if (typeof window.viewProcessoDetails === 'function') {
      window.viewProcessoDetails(processoId);
    }
  }, 250);
};


// ---- Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseClient) {
    showAlert('Supabase não configurado. Adicione suas chaves.', 'error');
    return;
  }

  // 1. Verify admin session
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
    window.location.href = 'index.html';
    return;
  }

  // Revela a página apenas após confirmar autorização
  document.body.style.display = 'block';

  // Se não for ADMIN, esconde o menu de gerenciar usuários
  if (profile.role !== 'ADMIN') {
    const navUsers = document.getElementById('navUsers');
    if (navUsers) navUsers.style.display = 'none';
  }

  // 2. Set admin name
  const adminNameEl = document.getElementById('adminName');
  if (adminNameEl) adminNameEl.textContent = profile.name || 'Administrador';

  // 3. Setup navigation
  setupNavigation();

  // 4. Setup logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  }

  // 5. Setup refresh buttons
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadUsers();
      animateIcon(btnRefresh.querySelector('i'));
    });
  }
  
  const btnRefreshMedicos = document.getElementById('btnRefreshMedicos');
  if (btnRefreshMedicos) {
    btnRefreshMedicos.addEventListener('click', () => {
      loadMedicos();
      animateIcon(btnRefreshMedicos.querySelector('i'));
    });
  }

  const btnRefreshReferencias = document.getElementById('btnRefreshReferencias');
  if (btnRefreshReferencias) {
    btnRefreshReferencias.addEventListener('click', () => {
      loadReferencias();
      animateIcon(btnRefreshReferencias.querySelector('i'));
    });
  }

  function animateIcon(icon) {
    if (icon) {
      icon.style.transition = 'transform 0.5s';
      icon.style.transform = 'rotate(360deg)';
      setTimeout(() => { icon.style.transform = ''; }, 500);
    }
  }

  // Modal Close Setup
  const btnCloseModal = document.getElementById('btnCloseModal');
  const modalMedico = document.getElementById('modalMedico');
  if (btnCloseModal && modalMedico) {
    btnCloseModal.addEventListener('click', () => modalMedico.classList.remove('active'));
    modalMedico.addEventListener('click', (e) => {
      if (e.target === modalMedico) modalMedico.classList.remove('active');
    });
  }

  // Modal Supervisor
  const btnCloseSupervisorModal = document.getElementById('btnCloseSupervisorModal');
  const modalSupervisor = document.getElementById('modalSupervisor');
  if (btnCloseSupervisorModal && modalSupervisor) {
    btnCloseSupervisorModal.addEventListener('click', () => modalSupervisor.classList.remove('active'));
    modalSupervisor.addEventListener('click', (e) => {
      if (e.target === modalSupervisor) modalSupervisor.classList.remove('active');
    });
  }

  // Modal Tutor
  const btnCloseTutorModal = document.getElementById('btnCloseTutorModal');
  const modalTutor = document.getElementById('modalTutor');
  if (btnCloseTutorModal && modalTutor) {
    btnCloseTutorModal.addEventListener('click', () => modalTutor.classList.remove('active'));
    modalTutor.addEventListener('click', (e) => {
      if (e.target === modalTutor) modalTutor.classList.remove('active');
    });
  }

  // 6. Load everything
  loadDashboardStats();
  loadMedicos();
  loadReferencias();
  loadSupervisores();
  loadTutores();
  setupTutoresLogic();
  loadMateriais();
  setupMateriaisLogic();
  loadProcessos();
  setupProcessosLogic();
  loadMapData();
  loadUsers();
  
  // Refresh Supervisores
  const btnRefreshSupervisores = document.getElementById('btnRefreshSupervisores');
  if (btnRefreshSupervisores) {
    btnRefreshSupervisores.addEventListener('click', () => {
      const icon = btnRefreshSupervisores.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      loadSupervisores().then(() => {
        if (icon) icon.classList.remove('fa-spin');
      });
    });
  }

  // 7. Setup Export
  setupExportLogic();
});

// ============================================
// Mapa Interativo Regional
// ============================================

async function loadMapData() {
  try {
    const { data: refs, error } = await supabaseClient
      .from('referencias_regionalizadas')
      .select('*');
    
    if (error) throw error;
    window.mapReferencias = refs || [];
    
    // Setup region click handlers
    document.querySelectorAll('.map-region').forEach(region => {
      region.addEventListener('click', () => {
        const macroRegiao = region.dataset.region;
        const responsavel = region.dataset.responsavel;
        
        // Toggle active class
        document.querySelectorAll('.map-region').forEach(r => r.classList.remove('active'));
        region.classList.add('active');
        
        showRegionReport(macroRegiao, responsavel);
      });
    });
  } catch (err) {
    console.error('Error loading map data:', err);
  }
}

function showRegionReport(macroRegiao, responsavel) {
  const panel = document.getElementById('mapReport');
  const refs = window.mapReferencias || [];
  
  const regionData = refs.filter(r => r.macro_regiao === macroRegiao);
  
  let totalVagas = 0, ocupadas = 0, desocupadas = 0, federal = 0, copart = 0;
  const municipios = [];
  const cirs = new Set();
  
  regionData.forEach(r => {
    totalVagas += r.total_vagas || 0;
    desocupadas += r.vagas_desocupadas || 0;
    ocupadas += r.total_medicos_ativos_pmmb || 0;
    federal += r.vagas_autorizadas_federal || 0;
    copart += r.vagas_coparticipacao_municipal || 0;
    if (r.municipio_dsei) municipios.push(r.municipio_dsei);
    if (r.regiao_saude) cirs.add(r.regiao_saude);
  });
  
  const taxa = totalVagas > 0 ? ((ocupadas / totalVagas) * 100).toFixed(0) : 0;
  const emProcesso = Math.max(0, totalVagas - ocupadas - desocupadas);
  
  // Color based on responsible
  let accentColor = '#7c3aed';
  if (responsavel === 'Marcossuel Acioles') accentColor = '#06b6d4';
  else if (responsavel === 'Alyne Cuba') accentColor = '#f59e0b';
  
  // Bar color based on taxa
  let barColor = '#10b981';
  if (taxa < 70) barColor = '#ef4444';
  else if (taxa < 85) barColor = '#f59e0b';
  
  panel.innerHTML = `
    <div class="report-header" style="border-left: 4px solid ${accentColor}">
      <h3 style="font-size:1.2rem;font-weight:700;margin-bottom:0.25rem">${macroRegiao}</h3>
      <div style="font-size:0.85rem;color:var(--text-secondary);display:flex;align-items:center;gap:0.5rem">
        <i class="fas fa-user-tie"></i>
        Responsável: <strong>${responsavel}</strong>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.25rem">
        ${cirs.size} CIR(s): ${[...cirs].sort().join(', ')}
      </div>
    </div>
    <div class="report-body">
      <div class="report-stat-grid">
        <div class="report-stat">
          <span class="stat-number" style="color:${accentColor}">${totalVagas}</span>
          <span class="stat-desc">Vagas Ativas</span>
        </div>
        <div class="report-stat">
          <span class="stat-number" style="color:#10b981">${ocupadas}</span>
          <span class="stat-desc">Ocupadas</span>
        </div>
        <div class="report-stat">
          <span class="stat-number" style="color:#ef4444">${desocupadas}</span>
          <span class="stat-desc">Desocupadas</span>
        </div>
        <div class="report-stat">
          <span class="stat-number" style="color:${barColor}">${taxa}%</span>
          <span class="stat-desc">Taxa Ocupação</span>
        </div>
      </div>
      
      <div class="report-bar-section">
        <div class="report-bar-label">
          <span>Ocupação</span>
          <span style="color:var(--text-muted)">${ocupadas} de ${totalVagas}</span>
        </div>
        <div class="report-bar-track">
          <div class="report-bar-fill" style="width:${taxa}%;background:${barColor}"></div>
        </div>
      </div>
      
      <div class="report-breakdown">
        <h4>Distribuição de Vagas</h4>
        <div class="breakdown-row">
          <span><i class="fas fa-flag" style="color:#3b82f6;margin-right:0.5rem"></i>Federal</span>
          <span style="font-weight:600">${federal}</span>
        </div>
        <div class="breakdown-row">
          <span><i class="fas fa-handshake" style="color:#8b5cf6;margin-right:0.5rem"></i>Coparticipação</span>
          <span style="font-weight:600">${copart}</span>
        </div>
        ${emProcesso > 0 ? `
        <div class="breakdown-row">
          <span><i class="fas fa-clock" style="color:#f59e0b;margin-right:0.5rem"></i>Em Processo</span>
          <span style="font-weight:600;color:var(--accent-warning)">${emProcesso}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="report-municipios">
        <h4><i class="fas fa-city" style="margin-right:0.5rem"></i>Municípios (${municipios.length})</h4>
        <div class="municipio-details" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.5rem;">
          ${regionData.sort((a,b) => (a.municipio_dsei||'').localeCompare(b.municipio_dsei||'')).map(r => {
            const rOcupadas = r.total_medicos_ativos_pmmb || 0;
            const rDesocupadas = r.vagas_desocupadas || 0;
            const rVagas = r.total_vagas || 0;
            const rEmProcesso = Math.max(0, rVagas - rOcupadas - rDesocupadas);
            return `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); padding: 0.75rem; border-radius: 6px;">
              <div style="font-weight: 600; margin-bottom: 0.35rem; color: var(--text-primary); font-size: 0.9rem;">${escapeHTML(r.municipio_dsei || '-')}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem;">
                <div>Vagas: <strong style="color:var(--text-primary)">${rVagas}</strong></div>
                <div>Ocupadas: <strong style="color:#10b981">${rOcupadas}</strong></div>
                <div>Desocup.: <strong style="color:#ef4444">${rDesocupadas}</strong></div>
                <div>Processo: <strong style="color:#f59e0b">${rEmProcesso}</strong></div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn-primary btn-sm" style="margin-top: 1rem; width: 100%" onclick="exportRegionCSV('${escapeHTML(macroRegiao)}')">
          <i class="fas fa-file-excel"></i> Exportar Dados da Região
        </button>
      </div>
    </div>
  `;
}
// ============================================

function setupExportLogic() {
  const modalExport = document.getElementById('modalExport');
  const btnOpenExportModal = document.getElementById('btnOpenExportModal');
  const btnCloseExportModal = document.getElementById('btnCloseExportModal');
  const btnCancelExport = document.getElementById('btnCancelExport');
  const exportForm = document.getElementById('exportForm');
  const btnSelectAllCols = document.getElementById('btnSelectAllCols');
  const btnClearAllCols = document.getElementById('btnClearAllCols');

  if (btnOpenExportModal) {
    btnOpenExportModal.addEventListener('click', () => {
      if (modalExport) modalExport.classList.add('active');
    });
  }

  const closeExport = () => { if (modalExport) modalExport.classList.remove('active'); };
  if (btnCloseExportModal) btnCloseExportModal.addEventListener('click', closeExport);
  if (btnCancelExport) btnCancelExport.addEventListener('click', closeExport);

  // Close on outside click
  if (modalExport) {
    modalExport.addEventListener('click', (e) => {
      if (e.target === modalExport) closeExport();
    });
  }

  if (btnSelectAllCols) {
    btnSelectAllCols.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('#exportForm input[name="cols"]').forEach(cb => cb.checked = true);
    });
  }

  if (btnClearAllCols) {
    btnClearAllCols.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('#exportForm input[name="cols"]').forEach(cb => cb.checked = false);
    });
  }

  if (exportForm) {
    exportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const checkedBoxes = document.querySelectorAll('#exportForm input[name="cols"]:checked');
      if (checkedBoxes.length === 0) {
        alert('Selecione pelo menos uma coluna para exportar.');
        return;
      }

      const selectedCols = Array.from(checkedBoxes).map(cb => cb.value);
      
      const btnSubmit = document.getElementById('btnRunExport');
      const originalHtml = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Gerando...';
      btnSubmit.disabled = true;

      try {
        const allData = await fetchCustomDoctorsData(selectedCols);
        if (!allData || allData.length === 0) {
          alert('Nenhum dado encontrado para exportar.');
          return;
        }
        const csvString = convertToCSV(allData, selectedCols);
        downloadCSV(csvString, 'relatorio_medicos_pmmb.csv');
        closeExport();
      } catch (err) {
        console.error(err);
        alert('Erro ao gerar relatório: ' + err.message);
      } finally {
        btnSubmit.innerHTML = originalHtml;
        btnSubmit.disabled = false;
      }
    });
  }
}

// Reusable function to fetch ALL doctors data with specific columns
async function fetchCustomDoctorsData(columns) {
  let allData = [];
  let from = 0;
  const size = 1000;
  let fetchMore = true;
  const colsString = columns.join(',');

  while (fetchMore) {
    const { data, error } = await supabaseClient
      .from('doctors')
      .select(colsString)
      .range(from, from + size - 1);
    
    if (error) {
      throw error;
    }
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += size;
    } else {
      fetchMore = false;
    }
  }
  return allData;
}

// Convert JSON array to CSV string
function convertToCSV(dataArray, headers) {
  const escapeCsvValue = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [];
  
  // Header row
  csvRows.push(headers.join(';'));

  // Data rows
  for (const row of dataArray) {
    const values = headers.map(header => escapeCsvValue(row[header]));
    csvRows.push(values.join(';'));
  }

  // Use \uFEFF to force UTF-8 BOM so Excel opens it with correct accents
  return '\uFEFF' + csvRows.join('\n');
}

// Trigger browser download
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// Supervisores PMMB
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


// ============================================
// Tutores PMMB
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


// ---- Exportar Região CSV ----
window.exportRegionCSV = function(macroRegiao) {
  const refs = window.mapReferencias || [];
  const regionData = refs.filter(r => r.macro_regiao === macroRegiao);
  
  if (regionData.length === 0) {
    alert('Nenhum dado encontrado para esta região.');
    return;
  }
  
  const headers = [
    'macro_regiao', 'regiao_saude', 'municipio_dsei', 
    'total_vagas', 'total_medicos_ativos_pmmb', 'vagas_desocupadas', 
    'vagas_autorizadas_federal', 'vagas_coparticipacao_municipal'
  ];
  
  const csvString = convertToCSV(regionData, headers);
  const safeName = macroRegiao.toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadCSV(csvString, `relatorio_regiao_${safeName}.csv`);
};


// ============================================
// ---- Materiais Logic ----
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


// ============================================
// ---- Processos Administrativos ----
// ============================================
window.processosData = [];

async function loadProcessos() {
  const tbody = document.getElementById('processosTableBody');
  if (!tbody) return;

  try {
    const { data, error } = await supabaseClient
      .from('processos_administrativos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    window.processosData = data || [];
    renderProcessosTable(window.processosData);
    updateProcessosDashboard(window.processosData);
    populateEquipesFilter(window.processosData);
  } catch (err) {
    console.error('Erro ao buscar processos:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar processos: ${escapeHTML(err.message)}</td></tr>`;
  }
}

function updateProcessosDashboard(data) {
  if (!data) return;

  const total = data.length;
  let analise = 0;
  let sobrestado = 0;
  let concluido = 0;
  let outros = 0;
  let medicosCount = 0;
  let orgaosCount = 0;

  const statusMap = {};
  const equipeMap = {};

  const keywordsOrgao = [
    'SECRETARIA', 'SMS', 'PREFEITURA', 'CONSELHO', 'COSEMS', 'PROCURADORIA', 
    'VARA', 'UNIVERSIDADE', 'UFC', 'DISTRITO', 'DSEI', 'POLICIA', 'POLÍCIA', 
    'SINDICATO', 'UNIAO', 'UNIÃO', 'MINISTERIO', 'MINISTÉRIO', 'GOVERNO'
  ];

  data.forEach(p => {
    // Status
    const st = (p.status_processo || 'NÃO INFORMADO').toUpperCase().trim();
    statusMap[st] = (statusMap[st] || 0) + 1;

    if (st.includes('ANÁLISE') || st.includes('ANALISE')) analise++;
    else if (st.includes('SOBRESTADO')) sobrestado++;
    else if (st.includes('CONCLUÍDO') || st.includes('CONCLUIDO')) concluido++;
    else outros++;

    // Equipes
    const eq = (p.equipe_responsavel || 'NÃO INFORMADA').toUpperCase().trim();
    equipeMap[eq] = (equipeMap[eq] || 0) + 1;

    // Interessados (Médico vs Órgão Público/Secretaria)
    const intStr = (p.interessado || '').toUpperCase().trim();
    const vinculoStr = (p.vinculo_medico || '').toUpperCase().trim();
    const isOrgao = keywordsOrgao.some(kw => intStr.includes(kw));

    if (vinculoStr.includes('CRM') || vinculoStr.includes('RMS')) {
      if (isOrgao) orgaosCount++;
      else medicosCount++;
    } else if (isOrgao) {
      orgaosCount++;
    } else if (intStr) {
      medicosCount++;
    } else {
      orgaosCount++;
    }
  });

  // Atualiza Cards
  const elTotal = document.getElementById('statProcTotal');
  const elAnalise = document.getElementById('statProcAnalise');
  const elSobrestado = document.getElementById('statProcSobrestado');
  const elConcluido = document.getElementById('statProcConcluido');
  const elMedicos = document.getElementById('statProcMedicos');
  const elOrgaos = document.getElementById('statProcOrgaos');

  if (elTotal) elTotal.textContent = total;
  if (elAnalise) elAnalise.textContent = analise;
  if (elSobrestado) elSobrestado.textContent = sobrestado;
  if (elConcluido) elConcluido.textContent = concluido;
  if (elMedicos) elMedicos.textContent = medicosCount;
  if (elOrgaos) elOrgaos.textContent = orgaosCount;

  // Gráfico 1: Status
  updateProcStatusChart(statusMap);

  // Gráfico 2: Tipo de Interessado (Médicos vs Órgãos Públicos)
  updateProcInteressadosChart(medicosCount, orgaosCount);

  // Gráfico 3: Equipes Responsáveis
  updateProcEquipesChart(equipeMap);
}

function updateProcStatusChart(statusMap) {
  const ctx = document.getElementById('chartProcStatus');
  if (!ctx) return;

  const labels = Object.keys(statusMap);
  const values = Object.values(statusMap);

  const colors = [
    '#f59e0b', // Amber (Em Análise)
    '#ef4444', // Red (Sobrestado)
    '#10b981', // Emerald (Concluído)
    '#3b82f6', // Blue (Em Andamento)
    '#8b5cf6', // Violet
    '#64748b'  // Slate
  ];

  if (chartProcStatus) {
    chartProcStatus.data.labels = labels;
    chartProcStatus.data.datasets[0].data = values;
    chartProcStatus.update();
  } else {
    chartProcStatus = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }
}

function updateProcInteressadosChart(medicosCount, orgaosCount) {
  const ctx = document.getElementById('chartProcInteressados');
  if (!ctx) return;

  const labels = ['Médicos / Profissionais', 'Órgãos Públicos / Secretarias'];
  const values = [medicosCount, orgaosCount];
  const colors = ['#3b82f6', '#8b5cf6'];

  if (chartProcInteressados) {
    chartProcInteressados.data.datasets[0].data = values;
    chartProcInteressados.update();
  } else {
    chartProcInteressados = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }
}


function updateProcEquipesChart(equipeMap) {
  const ctx = document.getElementById('chartProcEquipes');
  if (!ctx) return;

  // Ordenar equipes por quantidade (top 7)
  const sorted = Object.entries(equipeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  const labels = sorted.map(x => x[0]);
  const values = sorted.map(x => x[1]);

  if (chartProcEquipes) {
    chartProcEquipes.data.labels = labels;
    chartProcEquipes.data.datasets[0].data = values;
    chartProcEquipes.update();
  } else {
    chartProcEquipes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Qtd. Processos',
          data: values,
          backgroundColor: 'rgba(6, 182, 212, 0.75)',
          borderColor: '#06b6d4',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Bar gráfico horizontal
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#f1f5f9', font: { family: 'Inter', size: 11, weight: '500' } }
          }
        }
      }
    });
  }
}


function renderProcessosTable(data) {
  const tbody = document.getElementById('processosTableBody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:3rem">Nenhum processo encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  data.forEach(p => {
    const tr = document.createElement('tr');

    let badgeClass = 'badge-pending';
    const st = (p.status_processo || '').toUpperCase();
    if (st === 'CONCLUÍDO' || st === 'CONCLUIDO') badgeClass = 'badge-approved';
    else if (st === 'ARQUIVADO') badgeClass = 'badge-rejected';
    else if (st === 'EM ANÁLISE' || st === 'EM ANALISE') badgeClass = 'badge-pending';
    else if (st === 'SOBRESTADO') badgeClass = 'badge-rejected';
    else if (st === 'PENDENTE') badgeClass = 'badge-pending';

    const dataMov = p.data_ultima_movimentacao ? new Date(p.data_ultima_movimentacao + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

    tr.innerHTML = `
      <td>
        <div style="font-weight:600; color:var(--text-primary); font-family:monospace; font-size:0.85rem">${escapeHTML(p.numero_sei || '-')}</div>
      </td>
      <td>${escapeHTML(p.equipe_responsavel || '-')}</td>
      <td>
        <div>${escapeHTML(p.municipio || '-')}</div>
        <div style="font-size:0.75rem; color:var(--text-muted)">${escapeHTML(p.uf || '-')}</div>
      </td>
      <td style="max-width:200px">
        <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escapeHTML(p.interessado || '-')}</div>
      </td>
      <td style="font-size:0.85rem; color:var(--text-secondary)">${dataMov}</td>
      <td><span class="badge ${badgeClass}">${escapeHTML(p.status_processo || '-')}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="viewProcessoDetails('${escapeHTML(p.id)}')" title="Ver Detalhes">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.viewProcessoDetails = function(id) {
  const p = window.processosData.find(x => x.id === id);
  if (!p) return;

  const modalBody = document.getElementById('modalProcessoBody');
  const modal = document.getElementById('modalProcesso');
  if (!modalBody || !modal) return;

  const dataReceb = p.data_recebimento ? new Date(p.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
  const dataMov = p.data_ultima_movimentacao ? new Date(p.data_ultima_movimentacao + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

  let badgeClass = 'badge-pending';
  const st = (p.status_processo || '').toUpperCase();
  if (st === 'CONCLUÍDO' || st === 'CONCLUIDO') badgeClass = 'badge-approved';
  else if (st === 'ARQUIVADO' || st === 'SOBRESTADO') badgeClass = 'badge-rejected';

  modalBody.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:1.5rem">
      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-info); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Identificação</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Nº Processo SEI:</span> <span style="color:var(--text-primary); font-weight:600; font-family:monospace">${escapeHTML(p.numero_sei || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Equipe Responsável:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(p.equipe_responsavel || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Data Recebimento:</span> <span style="color:var(--text-primary)">${dataReceb}</span></div>
          <div><span style="color:var(--text-secondary)">UF:</span> <span style="color:var(--text-primary)">${escapeHTML(p.uf || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Município:</span> <span style="color:var(--text-primary)">${escapeHTML(p.municipio || '-')}</span></div>
        </div>
      </div>

      <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
        <h4 style="color:var(--accent-info); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Processo</h4>
        <div style="display:flex; flex-direction:column; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-secondary)">Interessado:</span> <span style="color:var(--text-primary); font-weight:500">${escapeHTML(p.interessado || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Vínculo Médico:</span> <span style="color:var(--text-primary)">${escapeHTML(p.vinculo_medico || '-')}</span></div>
          <div><span style="color:var(--text-secondary)">Última Movimentação:</span> <span style="color:var(--text-primary)">${dataMov}</span></div>
          <div><span style="color:var(--text-secondary)">Status:</span> <span class="badge ${badgeClass}">${escapeHTML(p.status_processo || '-')}</span></div>
        </div>
      </div>
    </div>

    <div style="background:var(--bg-secondary); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border)">
      <h4 style="color:var(--accent-info); font-size:0.9rem; font-weight:600; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); padding-bottom:0.5rem">Descrição da Demanda</h4>
      <p style="font-size:0.9rem; color:var(--text-primary); line-height:1.6; white-space:pre-wrap">${escapeHTML(p.descricao_demanda || 'Sem descrição registrada.')}</p>
    </div>
  `;

  modal.classList.add('active');
};

function populateEquipesFilter(data) {
  const select = document.getElementById('filterProcEquipe');
  if (!select || !data) return;

  const currentVal = select.value;
  const equipes = new Set();

  data.forEach(p => {
    if (p.equipe_responsavel) {
      const eq = p.equipe_responsavel.trim().toUpperCase();
      if (eq) equipes.add(eq);
    }
  });

  const sortedEquipes = Array.from(equipes).sort();
  select.innerHTML = '<option value="" style="background: #1e293b; color: #fff;">Todas as Equipes</option>' +
    sortedEquipes.map(eq => `<option value="${escapeHTML(eq)}" style="background: #1e293b; color: #fff;">${escapeHTML(eq)}</option>`).join('');
  
  if (currentVal && equipes.has(currentVal)) {
    select.value = currentVal;
  }
}

function setupProcessosLogic() {
  // Configurar ouvintes em TODOS os elementos de filtro
  const filterElementIds = [
    'searchProcesso',
    'filterProcVinculo',
    'filterProcEquipe',
    'filterProcMunicipio',
    'filterProcStatus'
  ];

  filterElementIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', filterProcessos);
      el.addEventListener('change', filterProcessos);
    }
  });

  // Botão Limpar Filtros
  const btnLimpar = document.getElementById('btnLimparFiltrosProc');
  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      filterElementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      filterProcessos();
    });
  }

  // Modal Detalhes — close
  const btnCloseProcesso = document.getElementById('btnCloseProcessoModal');
  const modalProcesso = document.getElementById('modalProcesso');
  if (btnCloseProcesso && modalProcesso) {
    btnCloseProcesso.addEventListener('click', () => modalProcesso.classList.remove('active'));
    modalProcesso.addEventListener('click', (e) => {
      if (e.target === modalProcesso) modalProcesso.classList.remove('active');
    });
  }

  // Modal Novo Processo — open/close
  const modalNovo = document.getElementById('modalNovoProcesso');
  const btnNovoProcesso = document.getElementById('btnNovoProcesso');
  const btnCloseNovo = document.getElementById('btnCloseNovoProcessoModal');
  const btnCancelProcesso = document.getElementById('btnCancelProcesso');

  const closeNovo = () => { if (modalNovo) modalNovo.classList.remove('active'); };

  if (btnNovoProcesso) btnNovoProcesso.addEventListener('click', () => { if (modalNovo) modalNovo.classList.add('active'); });
  if (btnCloseNovo) btnCloseNovo.addEventListener('click', closeNovo);
  if (btnCancelProcesso) btnCancelProcesso.addEventListener('click', closeNovo);

  // Form submit
  const form = document.getElementById('processoForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById('btnSubmitProcesso');
      const origHtml = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      btnSubmit.disabled = true;

      const payload = {
        numero_sei: document.getElementById('procSei').value,
        equipe_responsavel: document.getElementById('procEquipe').value,
        data_recebimento: document.getElementById('procDataReceb').value || null,
        uf: document.getElementById('procUf').value || 'CE',
        municipio: document.getElementById('procMunicipio').value,
        descricao_demanda: document.getElementById('procDescricao').value,
        interessado: document.getElementById('procInteressado').value,
        vinculo_medico: document.getElementById('procVinculo').value,
        data_ultima_movimentacao: document.getElementById('procDataMov').value || null,
        status_processo: document.getElementById('procStatus').value
      };

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) payload.autor_id = session.user.id;

        const { error } = await supabaseClient.from('processos_administrativos').insert([payload]);
        if (error) throw error;

        form.reset();
        document.getElementById('procUf').value = 'CE';
        closeNovo();
        showAlert('Processo cadastrado com sucesso!', 'success');
        loadProcessos();
      } catch (err) {
        console.error(err);
        showAlert('Erro ao salvar processo: ' + err.message, 'error');
      } finally {
        btnSubmit.innerHTML = origHtml;
        btnSubmit.disabled = false;
      }
    });
  }

  // Export Excel
  const btnExport = document.getElementById('btnExportProcessos');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      if (!window.processosData || window.processosData.length === 0) {
        showAlert('Nenhum processo para exportar.', 'error');
        return;
      }
      exportProcessosExcel(window.processosData);
    });
  }
}

function filterProcessos() {
  if (!window.processosData) return;

  const q = normStr(document.getElementById('searchProcesso')?.value);
  const vinculo = (document.getElementById('filterProcVinculo')?.value || '').trim().toUpperCase();
  const equipe = (document.getElementById('filterProcEquipe')?.value || '').trim().toUpperCase();
  const municipio = normStr(document.getElementById('filterProcMunicipio')?.value);
  const status = normStr(document.getElementById('filterProcStatus')?.value);

  const filtered = window.processosData.filter(p => {
    // 1. Busca textual geral
    if (q) {
      const matchText = normStr(p.interessado).includes(q) ||
                        normStr(p.numero_sei).includes(q) ||
                        normStr(p.descricao_demanda).includes(q) ||
                        normStr(p.municipio).includes(q);
      if (!matchText) return false;
    }

    // 2. Vínculo Médico
    if (vinculo) {
      const pVinculo = (p.vinculo_medico || '').toUpperCase().trim();
      if (vinculo === 'NENHUM') {
        if (pVinculo !== '' && pVinculo !== 'NULL') return false;
      } else {
        if (!pVinculo.includes(vinculo)) return false;
      }
    }

    // 3. Equipe Responsável
    if (equipe) {
      const pEquipe = (p.equipe_responsavel || '').toUpperCase().trim();
      if (pEquipe !== equipe) return false;
    }

    // 4. Município
    if (municipio) {
      if (!normStr(p.municipio).includes(municipio)) return false;
    }

    // 5. Status do Processo
    if (status) {
      const pStatus = normStr(p.status_processo);
      if (!pStatus.includes(status)) return false;
    }

    return true;
  });

  renderProcessosTable(filtered);
}

function exportProcessosExcel(data) {
  // CSV export (opens as Excel)
  const headers = ['Nº', 'Nº PROCESSO SEI', 'EQUIPE RESPONSÁVEL', 'DATA DE RECEBIMENTO DE PROCESSO', 'UF', 'MUNICÍPIO', 'DESCRIÇÃO DA DEMANDA', 'INTERESSADO', 'VÍNCULO DO(A) MÉDICO(A) COM O PROGRAMA', 'DATA DA ÚLTIMA MOVIMENTAÇÃO', 'STATUS DO PROCESSO'];

  let csv = '\uFEFF'; // BOM for UTF-8
  csv += headers.join(';') + '\n';

  data.forEach((p, i) => {
    const dataReceb = p.data_recebimento ? new Date(p.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
    const dataMov = p.data_ultima_movimentacao ? new Date(p.data_ultima_movimentacao + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

    const row = [
      i + 1,
      (p.numero_sei || '-').replace(/;/g, ','),
      (p.equipe_responsavel || '-').replace(/;/g, ','),
      dataReceb,
      p.uf || '-',
      (p.municipio || '-').replace(/;/g, ','),
      (p.descricao_demanda || '-').replace(/;/g, ',').replace(/\n/g, ' '),
      (p.interessado || '-').replace(/;/g, ','),
      (p.vinculo_medico || '-').replace(/;/g, ','),
      dataMov,
      p.status_processo || '-'
    ];
    csv += row.join(';') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'processos_administrativos_' + new Date().toISOString().slice(0,10) + '.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  showAlert('Exportação realizada com sucesso!', 'success');
}
