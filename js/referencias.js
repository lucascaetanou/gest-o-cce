// ============================================
// Gestão CCE — Módulo de Referências Regionais e Mapa
// ============================================

window.mapReferencias = [];

// Carrega tabela de referências regionais
async function loadReferencias() {
  const tbody = document.getElementById('referenciasTableBody');
  if (!tbody) return;

  try {
    const { data: referencias, error } = await supabaseClient
      .from('referencias_regionais')
      .select('*')
      .order('municipio', { ascending: true });

    if (error) throw error;

    window.mapReferencias = referencias || [];
    renderReferenciasTable(window.mapReferencias);
    loadMapData();

  } catch (error) {
    console.error('Erro ao carregar referências:', error);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--accent-danger); padding:3rem">Erro ao carregar referências regionais.</td></tr>';
  }
}

// Renderiza tabela de referências regionais
function renderReferenciasTable(data) {
  const tbody = document.getElementById('referenciasTableBody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:3rem">Nenhuma referência regional encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = '';

  data.forEach(ref => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHTML(ref.municipio || '-')}</strong></td>
      <td>${escapeHTML(ref.regiao_saude || '-')}</td>
      <td><span class="badge badge-approved">${escapeHTML(ref.superintendencia || '-')}</span></td>
      <td>${escapeHTML(ref.referencia_regional || '-')}</td>
      <td>${escapeHTML(ref.telefone_referencia || '-')}</td>
      <td><small style="color:var(--text-muted)">${escapeHTML(ref.email_referencia || '-')}</small></td>
      <td><small>${escapeHTML(ref.instituicao_supervisora || '-')}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

// Carrega dados agregados para o mapa interativo
async function loadMapData() {
  try {
    const { data: medicos, error: errMed } = await supabaseClient
      .from('medicos_municipios')
      .select('municipio, regiao_saude, situacao_profissional');

    if (errMed) throw errMed;

    const regionSummary = {};

    (medicos || []).forEach(m => {
      const reg = m.regiao_saude || 'OUTRAS';
      if (!regionSummary[reg]) {
        regionSummary[reg] = { total: 0, ativos: 0, desocupadas: 0, municipios: new Set() };
      }
      regionSummary[reg].total++;
      if (m.municipio) regionSummary[reg].municipios.add(m.municipio);

      const sit = (m.situacao_profissional || '').toUpperCase();
      if (sit.includes('ATIVO')) regionSummary[reg].ativos++;
      else if (sit.includes('DESOCUPADA') || sit.includes('VAGA')) regionSummary[reg].desocupadas++;
    });

    const regionsGrid = document.getElementById('mapRegionsGrid');
    if (!regionsGrid) return;

    regionsGrid.innerHTML = '';

    Object.entries(regionSummary).forEach(([regName, stats]) => {
      const card = document.createElement('div');
      card.className = 'stat-card stat-card--primary';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <div style="font-weight:600; font-size:1rem; color:var(--text-primary)">${escapeHTML(regName)}</div>
          <span class="badge badge-approved" style="font-size:0.75rem">${stats.municipios.size} municípios</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:1rem">
          <div><div style="font-size:1.25rem; font-weight:700; color:var(--accent-success)">${stats.ativos}</div><div style="font-size:0.75rem; color:var(--text-muted)">Médicos Ativos</div></div>
          <div><div style="font-size:1.25rem; font-weight:700; color:var(--accent-danger)">${stats.desocupadas}</div><div style="font-size:0.75rem; color:var(--text-muted)">Desocupadas</div></div>
        </div>
      `;
      card.addEventListener('click', () => showRegionReport(regName));
      regionsGrid.appendChild(card);
    });

  } catch (error) {
    console.error('Erro ao carregar mapa:', error);
  }
}

// Exibe relatório modal de uma região selecionada
function showRegionReport(regiaoName) {
  const modal = document.getElementById('modalRegiao');
  const modalTitle = document.getElementById('modalRegiaoTitle');
  const modalBody = document.getElementById('modalRegiaoBody');
  if (!modal || !modalBody) return;

  if (modalTitle) modalTitle.textContent = `Relatório Regional: ${regiaoName}`;
  modalBody.innerHTML = '<div style="text-align:center; padding:2rem"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
  modal.classList.add('active');

  const munList = (window.mapReferencias || []).filter(r => r.regiao_saude === regiaoName);

  modalBody.innerHTML = `
    <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center">
      <span style="font-size:0.9rem; color:var(--text-secondary)">Total de Municípios Referenciados: ${munList.length}</span>
      <button class="btn btn-ghost btn-sm" onclick="exportRegionCSV('${escapeHTML(regiaoName)}')"><i class="fas fa-download"></i> Exportar Região</button>
    </div>
    <div style="max-height:400px; overflow-y:auto">
      <table class="data-table">
        <thead>
          <tr><th>Município</th><th>Referência Regional</th><th>Contato</th><th>Instituição</th></tr>
        </thead>
        <tbody>
          ${munList.map(m => `
            <tr>
              <td><strong>${escapeHTML(m.municipio || '-')}</strong></td>
              <td>${escapeHTML(m.referencia_regional || '-')}</td>
              <td>${escapeHTML(m.telefone_referencia || '-')}</td>
              <td>${escapeHTML(m.instituicao_supervisora || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Exporta dados de uma macrorregião específica em CSV
window.exportRegionCSV = function(macroRegiao) {
  const list = (window.mapReferencias || []).filter(r => !macroRegiao || r.regiao_saude === macroRegiao);
  const fields = [
    { key: 'municipio', label: 'Município' },
    { key: 'regiao_saude', label: 'Região de Saúde' },
    { key: 'superintendencia', label: 'Superintendência' },
    { key: 'referencia_regional', label: 'Referência Regional' },
    { key: 'telefone_referencia', label: 'Telefone' },
    { key: 'email_referencia', label: 'E-mail' },
    { key: 'instituicao_supervisora', label: 'Instituição Supervisora' }
  ];
  const csv = convertToCSV(list, fields);
  downloadCSV(csv, `relatorio_regiao_${normStr(macroRegiao || 'todas')}.csv`);
};
