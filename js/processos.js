// ============================================
// Gestão CCE — Módulo de Processos Administrativos
// ============================================

window.processosData = [];

// Instâncias dos gráficos para atualização
let chartProcStatus = null;
let chartProcEquipes = null;
let chartProcInteressados = null;

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
    window.dashboardProcessos = data || [];
    renderProcessosTable(window.processosData);
    updateProcessosDashboard(window.processosData);
    populateEquipesFilter(window.processosData);
    if (typeof window.renderProcessInsights === 'function') window.renderProcessInsights();
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
    '#14b8a6', // Teal
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
  const colors = ['#2389c7', '#14b8a6'];

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
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:3.5rem 1rem;">
          <div style="max-width:320px; margin:0 auto; color:var(--text-muted);">
            <i class="fas fa-gavel" style="font-size:2.2rem; opacity:0.4; margin-bottom:0.75rem; display:block;"></i>
            <div style="font-weight:600; color:var(--text-primary); font-size:1rem; margin-bottom:0.25rem;">Nenhum processo encontrado</div>
            <div style="font-size:0.85rem; margin-bottom:1rem;">Nenhum processo administrativo corresponde à busca.</div>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('btnLimparFiltrosProc')?.click()"><i class="fas fa-undo"></i> Limpar filtros</button>
          </div>
        </td>
      </tr>
    `;
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
          <div><span style="color:var(--text-secondary)">Tipo de Demanda:</span> <span class="badge badge-info">${escapeHTML(p.tipo_demanda || 'OUTROS')}</span></div>
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
  select.innerHTML = '<option value="" style="background: #0b2236; color: #fff;">Todas as Equipes</option>' +
    sortedEquipes.map(eq => `<option value="${escapeHTML(eq)}" style="background: #0b2236; color: #fff;">${escapeHTML(eq)}</option>`).join('');
  
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
        tipo_demanda: document.getElementById('procTipoDemanda').value,
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
                        normStr(p.tipo_demanda).includes(q) ||
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
  const headers = ['Nº', 'Nº PROCESSO SEI', 'EQUIPE RESPONSÁVEL', 'DATA DE RECEBIMENTO DE PROCESSO', 'UF', 'MUNICÍPIO', 'TIPO DE DEMANDA', 'DESCRIÇÃO DA DEMANDA', 'INTERESSADO', 'VÍNCULO DO(A) MÉDICO(A) COM O PROGRAMA', 'DATA DA ÚLTIMA MOVIMENTAÇÃO', 'STATUS DO PROCESSO'];

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
      (p.tipo_demanda || 'OUTROS').replace(/;/g, ','),
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
