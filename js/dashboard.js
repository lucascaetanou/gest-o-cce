// ============================================
// Gestão CCE — Módulo de Dashboard
// ============================================

window.dashboardReferencias = [];

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

