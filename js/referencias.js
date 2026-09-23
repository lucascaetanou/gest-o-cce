// ============================================
// Gestão CCE — Módulo de Referências Regionais
// (o mapa fica em js/mapa.js)
// ============================================

window.mapReferencias = [];
let allReferencias = [];
let referenciasTab = 'Todos';

async function loadReferencias() {
  const tbody = document.getElementById('referenciasTableBody');
  const tabsContainer = document.getElementById('referenciasTabs');
  if (!tbody || !tabsContainer) return;

  tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Carregando referências…</td></tr>';

  try {
    const { data: referencias, error } = await supabaseClient
      .from('referencias_regionalizadas')
      .select('*')
      .order('municipio_dsei', { ascending: true });

    if (error) throw error;

    allReferencias = (referencias || []).filter(r => r.municipio_dsei && normStr(r.municipio_dsei) !== 'ceara');
    window.mapReferencias = referencias || [];

    if (!allReferencias.length) {
      tbody.innerHTML = emptyRow(6, 'Nenhuma referência encontrada.', '');
      return;
    }

    renderReferenciasTabs();
    populateReferenciasFilters();
    setupReferenciasFilters();
    filterReferencias();
  } catch (error) {
    console.error(error);
    tbody.innerHTML = emptyRow(6, 'Erro ao carregar referências.', '');
  }
}

function renderReferenciasTabs() {
  const tabsContainer = document.getElementById('referenciasTabs');
  const counts = {};
  allReferencias.forEach(r => { const k = r.responsavel || 'Sem responsável'; counts[k] = (counts[k] || 0) + 1; });
  const tabs = [['Todos', allReferencias.length], ...Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))];
  if (!tabs.some(t => t[0] === referenciasTab)) referenciasTab = 'Todos';

  tabsContainer.innerHTML = '';
  tabs.forEach(([name, n]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = name === referenciasTab ? 'on' : '';
    btn.innerHTML = `${escapeHTML(name)}<span class="c">${fmtNum(n)}</span>`;
    btn.onclick = () => {
      referenciasTab = name;
      tabsContainer.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      filterReferencias();
    };
    tabsContainer.appendChild(btn);
  });
}

function populateReferenciasFilters() {
  const sel = document.getElementById('filterRefIvs');
  if (!sel) return;
  const current = sel.value;
  const cats = [...new Set(allReferencias.map(r => (r.categoria_ivs || '').trim()).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todas as categorias IVS</option>' + cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  if (cats.includes(current)) sel.value = current;
}

function setupReferenciasFilters() {
  ['searchReferencias', 'filterRefIvs', 'filterRefAbertas'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.listening) {
      el.dataset.listening = 'true';
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', filterReferencias);
    }
  });
}

function filterReferencias() {
  const q = normStr(document.getElementById('searchReferencias')?.value);
  const ivs = document.getElementById('filterRefIvs')?.value || '';
  const soAbertas = document.getElementById('filterRefAbertas')?.checked;

  const data = allReferencias.filter(r => {
    if (referenciasTab !== 'Todos' && (r.responsavel || 'Sem responsável') !== referenciasTab) return false;
    if (q && !normStr(`${r.municipio_dsei} ${r.regiao_saude} ${r.macro_regiao}`).includes(q)) return false;
    if (ivs && (r.categoria_ivs || '').trim() !== ivs) return false;
    if (soAbertas && !((r.vagas_desocupadas || 0) > 0)) return false;
    return true;
  });
  renderReferenciasTable(data);
}

function ivsTag(cat) {
  if (!cat) return '<span class="muted">—</span>';
  const n = parseInt(cat, 10);
  const cls = n >= 5 ? 'danger' : n === 4 ? 'warn' : 'plain';
  return `<span class="tag ${cls}">${escapeHTML(cat.replace(/vulnerabilidade/i, '').trim())}</span>`;
}

function renderReferenciasTable(data) {
  const tbody = document.getElementById('referenciasTableBody');
  const count = document.getElementById('referenciasCount');
  if (!tbody) return;
  if (count) count.textContent = `${fmtNum(data.length)} de ${fmtNum(allReferencias.length)} municípios`;

  if (!data || data.length === 0) {
    tbody.innerHTML = emptyRow(6, 'Nenhum município com esses filtros.', '');
    return;
  }

  tbody.innerHTML = data.map(r => {
    const total = r.total_vagas || 0;
    const desoc = r.vagas_desocupadas || 0;
    const ocup = Math.max(0, total - desoc);
    return `<tr>
      <td><div class="cell-main">${escapeHTML(titleCase(r.municipio_dsei || '-'))}</div><div class="cell-sub">${escapeHTML(r.macro_regiao || '')}</div></td>
      <td>${escapeHTML(titleCase(r.regiao_saude || '—'))}</td>
      <td class="muted">${escapeHTML(r.responsavel || '—')}</td>
      <td>${ivsTag(r.categoria_ivs)}</td>
      <td class="r">${fmtNum(total)}<div class="cell-sub">${fmtNum(r.vagas_autorizadas_federal || 0)} fed. · ${fmtNum(r.vagas_coparticipacao_municipal || 0)} mun.</div></td>
      <td>${total ? occCell(ocup, total) : '<span class="muted">—</span>'}${desoc ? `<div class="cell-sub alert-num">${plural(desoc, 'vaga aberta', 'vagas abertas')}</div>` : ''}</td>
    </tr>`;
  }).join('');
}

// Mantido por compatibilidade com admin.js: o mapa agora é iniciado pelo dashboard
async function loadMapData() {
  if (typeof window.initCearaMap === 'function' && (window.dashboardReferencias || []).length) {
    window.initCearaMap(window.dashboardReferencias);
  }
}
