// ============================================
// Gestão CCE — Módulo de Referências Regionais e Mapa
// ============================================

window.mapReferencias = [];
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


