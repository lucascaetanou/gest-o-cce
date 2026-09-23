// ============================================
// Gestão CCE — Mapa das regiões de saúde (Leaflet + malha IBGE)
// Geometria: js/ceara-geo.js. Números: contagem ao vivo da tabela doctors; região/responsável: referencias_regionalizadas.
// Nenhuma escrita no Supabase acontece aqui.
// ============================================

(function () {
  const RESP_KEYS = { 'Marcossuel Acioles': 'a', 'Tatiane Almeida': 'b', 'Alyne Cuba': 'c' };
  const EXTRA_KEYS = ['d', 'e'];
  // Posição do rótulo de cada macrorregião (lat, lng); outras usam o centro da área
  const LABEL_AT = {
    'fortaleza': [-3.95, -39.38], 'norte': [-4.2, -40.65], 'sertao central': [-5.25, -39.45],
    'litoral leste': [-5.1, -38.15], 'cariri': [-6.85, -39.45]
  };
  // Grafias da tabela que diferem do IBGE
  const NAME_ALIASES = { 'itapage': 'itapaje', 'jijoca de jericoacara': 'jijoca de jericoacoara', 'dep. ira. pinheiro': 'deputado irapuan pinheiro' };
  const VAGA_BINS = ['0', '1', '2', '3–4', '5 ou mais'];

  const key = s => {
    const n = normStr(s).replace(/\s+/g, ' ');
    return NAME_ALIASES[n] || n;
  };
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const validMacro = m => m && normStr(m) !== 'nao informado';

  let map = null, base = null, labelsTile = null;
  let munLayer = null, cirLayer = null, macroLayer = null, hoverLine = null, hoverId = null, hoverTip = null;
  let ALL = null, mode = 'resp', sel = null;
  let REG = {};          // macro -> agregados
  let unmapped = [];     // vagas cujo município não existe na malha (ex.: "CEARA")
  let respKey = {};      // responsável -> letra de cor
  let rfTab = 'mun', rfSort = { k: 'abertas', dir: -1 }, rfOnlyOpen = false, rfQuery = '', rfCir = '', rfMedMun = '';

  function colorFor(resp) {
    if (!respKey[resp]) {
      const used = Object.values(respKey);
      respKey[resp] = RESP_KEYS[resp] || EXTRA_KEYS.find(k => !used.includes(k)) || 'e';
    }
    return `var(--m-${respKey[resp]})`;
  }

  // ---------- Dados ----------
  function buildData(refs) {
    // Referências: só região/macro/responsável (a tabela tem duplicatas; prefere a linha com região de saúde)
    const byMun = {};
    (refs || []).forEach(r => {
      if (!r.municipio_dsei) return;
      const k = key(r.municipio_dsei);
      if (!byMun[k] || (!byMun[k].regiao_saude && r.regiao_saude)) byMun[k] = r;
    });
    // Números: contagem ao vivo da tabela doctors
    const live = typeof window.getMunicipioStats === 'function' ? window.getMunicipioStats(key) : {};
    const geoKeys = new Set(window.CE_GEO.muns.features.map(f => key(f.properties.nome)));
    unmapped = Object.entries(live).filter(([k]) => !geoKeys.has(k)).map(([, s]) => s);

    // responsável mais frequente de cada macrorregião (para municípios sem linha na tabela)
    const votes = {};
    (refs || []).forEach(r => {
      if (!validMacro(r.macro_regiao) || !r.responsavel) return;
      const m = r.macro_regiao.trim();
      votes[m] = votes[m] || {};
      votes[m][r.responsavel] = (votes[m][r.responsavel] || 0) + 1;
    });
    const respOfMacro = m => {
      const v = votes[m]; if (!v) return 'Sem responsável';
      return Object.entries(v).sort((a, b) => b[1] - a[1])[0][0];
    };

    REG = {};
    respKey = {};
    Object.keys(RESP_KEYS).forEach(n => { respKey[n] = RESP_KEYS[n]; });

    window.CE_GEO.muns.features.forEach(f => {
      const p = f.properties;
      const r = byMun[key(p.nome)] || null;
      p.ref = r;
      p.macroAtual = (r && validMacro(r.macro_regiao)) ? r.macro_regiao.trim() : p.macro;
      p.resp = (r && r.responsavel && validMacro(r.macro_regiao)) ? r.responsavel : respOfMacro(p.macroAtual);
      const s = live[key(p.nome)] || { total: 0, ocup: 0, abertas: 0, emProc: 0 };
      p.st = { total: s.total, ocup: s.ocup, abertas: s.abertas, emProc: s.emProc, semCadastro: !r };

      const g = REG[p.macroAtual] = REG[p.macroAtual] || { resp: p.resp, total: 0, ocup: 0, abertas: 0, emProc: 0, muns: [] };
      g.total += p.st.total; g.ocup += p.st.ocup; g.abertas += p.st.abertas; g.emProc += p.st.emProc;
      g.muns.push(p);
    });
    Object.values(REG).forEach(g => colorFor(g.resp));
  }

  function procsByMun() {
    const out = {};
    (window.dashboardProcessos || []).forEach(p => {
      const k = key(p.municipio || '');
      if (!k) return;
      (out[k] = out[k] || []).push(p);
    });
    return out;
  }

  // ---------- Mapa ----------
  function setBase() {
    [base, labelsTile].forEach(l => l && map.removeLayer(l));
    const t = isDark() ? 'Dark' : 'Light';
    const url = n => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${t}_Gray_${n}/MapServer/tile/{z}/{y}/{x}`;
    base = L.tileLayer(url('Base'), { maxNativeZoom: 16, attribution: 'Fundo: Esri, HERE, Garmin, © OpenStreetMap · Malha municipal: IBGE' }).addTo(map);
    labelsTile = L.tileLayer(url('Reference'), { maxNativeZoom: 16, pane: 'labels' }).addTo(map);
  }

  const lineCol = () => isDark() ? '#0d1110' : '#ffffff';
  const vagaShades = () => isDark()
    ? ['#262d2a', '#5a322e', '#7e3d36', '#b3554b', '#f08a82']
    : ['#eceeea', '#f0c8c3', '#e0968d', '#c85a50', '#9e2219'];
  const vagaBin = n => n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;

  function munStyle(f) {
    const p = f.properties, dim = sel && p.macroAtual !== sel;
    if (mode === 'resp') return { fillColor: cssv('--m-' + respKey[p.resp]) || '#888', fillOpacity: dim ? 0.12 : 0.55, color: lineCol(), weight: 0.5, opacity: dim ? 0.3 : 0.7 };
    return { fillColor: vagaShades()[vagaBin(p.st.abertas)], fillOpacity: dim ? 0.25 : 0.88, color: lineCol(), weight: 0.5, opacity: 0.7 };
  }
  const macroStyle = f => ({ fill: false, color: cssv('--ink'), weight: f.properties.macro === sel ? 3 : 1.6, opacity: sel && f.properties.macro !== sel ? 0.35 : 0.8 });

  function tip(p) {
    const s = p.st;
    const nums = !s.total
      ? '<span class="t">Nenhuma vaga do programa</span>'
      : `${fmtNum(s.ocup)} médicos · ${fmtNum(s.total)} vagas · ${s.abertas ? `<b class="alert-num">${plural(s.abertas, 'aberta', 'abertas')}</b>` : '<span class="t">sem vagas abertas</span>'}`;
    return `<b>${escapeHTML(p.nome)}</b><div class="t">${escapeHTML(p.cir)} · ${escapeHTML(p.macroAtual)}</div>
      <div class="t">Responsável: <span style="color:var(--ink)">${escapeHTML(p.resp)}</span></div>
      <div style="margin-top:4px">${nums}</div>`;
  }

  function clearHover() {
    hoverId = null;
    if (map && hoverTip) map.closeTooltip(hoverTip);
    if (hoverLine) { map.removeLayer(hoverLine); hoverLine = null; }
  }
  function showHover(f, latlng) {
    if (hoverId !== f.properties.id) {
      if (hoverLine) map.removeLayer(hoverLine);
      hoverLine = L.geoJSON(f, { pane: 'hover', interactive: false, style: { fill: false, color: cssv('--ink'), weight: 2.5, opacity: 1 } }).addTo(map);
      hoverTip.setContent(tip(f.properties));
      hoverId = f.properties.id;
    }
    hoverTip.setLatLng(latlng);
    if (!map.hasLayer(hoverTip)) hoverTip.addTo(map);
  }

  function createMap() {
    const el = document.getElementById('ceMap');
    if (!el || typeof L === 'undefined' || !window.CE_GEO) return false;
    el.innerHTML = '';

    map = L.map(el, { zoomSnap: 0.25, minZoom: 6.25, maxZoom: 12, scrollWheelZoom: false });
    map.createPane('labels'); map.getPane('labels').style.zIndex = 450; map.getPane('labels').style.pointerEvents = 'none';
    map.createPane('hover'); map.getPane('hover').style.zIndex = 460; map.getPane('hover').style.pointerEvents = 'none';
    hoverTip = L.tooltip({ className: 'mtip', direction: 'top', offset: [0, -12], opacity: 1 });

    munLayer = L.geoJSON(window.CE_GEO.muns, {
      style: munStyle,
      onEachFeature: (f, l) => l.on({
        mousemove: e => showHover(f, e.latlng),
        mouseout: clearHover,
        click: () => { clearHover(); select(sel === f.properties.macroAtual ? null : f.properties.macroAtual); }
      })
    }).addTo(map);
    cirLayer = L.geoJSON(window.CE_GEO.cirs, { interactive: false, style: () => ({ fill: false, color: lineCol(), weight: 1.6, opacity: 0.95 }) }).addTo(map);
    macroLayer = L.geoJSON(window.CE_GEO.macros, { interactive: false, style: macroStyle }).addTo(map);

    Object.keys(REG).forEach(m => {
      let at = LABEL_AT[normStr(m)];
      if (!at) {
        const b = L.latLngBounds(REG[m].muns.map(p => munBounds(p.id)).filter(Boolean));
        if (!b.isValid()) return;
        const c = b.getCenter(); at = [c.lat, c.lng];
      }
      L.marker(at, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'maclabel', html: `<span>${escapeHTML(m)}</span>`, iconSize: [0, 0] }) }).addTo(map);
    });

    ALL = macroLayer.getBounds();
    map.fitBounds(ALL, { padding: [12, 12] });
    map.setMaxBounds(ALL.pad(0.35));

    const Reset = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const d = L.DomUtil.create('div', 'leaflet-bar');
        d.innerHTML = '<button class="mapreset" type="button" title="Ver o estado inteiro" aria-label="Ver o estado inteiro"><i class="fas fa-expand"></i></button>';
        L.DomEvent.disableClickPropagation(d);
        d.onclick = () => select(null);
        return d;
      }
    });
    map.addControl(new Reset());
    el.addEventListener('mouseleave', clearHover);
    map.on('movestart zoomstart', clearHover);
    setBase();
    return true;
  }

  const boundsCache = {};
  function munBounds(id) {
    if (boundsCache[id]) return boundsCache[id];
    let b = null;
    munLayer && munLayer.eachLayer(l => { if (l.feature.properties.id === id) b = l.getBounds(); });
    return (boundsCache[id] = b);
  }
  function macroBounds(m) {
    let b = null;
    macroLayer.eachLayer(l => { if (l.feature.properties.macro === m) b = l.getBounds(); });
    if (b) return b;
    const all = L.latLngBounds(REG[m].muns.map(p => munBounds(p.id)).filter(Boolean));
    return all.isValid() ? all : ALL;
  }

  function paint() {
    if (!map) return;
    munLayer.setStyle(munStyle);
    cirLayer.setStyle({ color: lineCol() });
    macroLayer.setStyle(macroStyle);
    const legend = document.getElementById('mapLegend');
    if (!legend) return;
    const lines = `<span class="sep">|</span><span><i class="lg-line" style="border-color:var(--ink)"></i>Macrorregião</span><span><i class="lg-line" style="border-color:var(--line-strong)"></i>Região de saúde</span>`;
    if (mode === 'resp') {
      const byResp = {};
      Object.entries(REG).forEach(([m, g]) => { (byResp[g.resp] = byResp[g.resp] || []).push(m); });
      legend.innerHTML = '<div class="maplegend">' + Object.entries(byResp).map(([r, ms]) =>
        `<span><i class="sw" style="background:${colorFor(r)}"></i>${escapeHTML(r)} · ${escapeHTML(ms.sort().join(' e '))}</span>`).join('') + lines + '</div>';
    } else {
      legend.innerHTML = '<div class="maplegend"><span class="muted">Vagas abertas por município:</span>' +
        VAGA_BINS.map((t, i) => `<span><i class="sw" style="background:${vagaShades()[i]};outline:1px solid var(--line)"></i>${t}</span>`).join('') + lines + '</div>';
    }
  }

  // ---------- Seleção ----------
  function select(m, opts = {}) {
    if (m && !REG[m]) m = null;
    if (m !== sel) { rfCir = ''; rfQuery = ''; rfMedMun = ''; }
    sel = m;
    paint();
    renderReport();
    openRegFull(false);
    if (!opts.fromFilter && typeof window.setDashboardRegion === 'function') window.setDashboardRegion(m);
    if (map) {
      if (m) map.flyToBounds(macroBounds(m), { padding: [20, 20], duration: 0.5 });
      else map.flyToBounds(ALL, { padding: [12, 12], duration: 0.5 });
    }
  }

  window.ceMapSelectFromFilter = function (value) {
    if (!Object.keys(REG).length) return;
    const m = Object.keys(REG).find(k => normStr(k) === normStr(value)) || null;
    select(m, { fromFilter: true });
  };

  // ---------- Painel ao lado do mapa ----------
  function renderReport() {
    const box = document.getElementById('mapReport');
    if (!box) return;
    if (!sel) {
      const rows = Object.entries(REG).filter(([m]) => validMacro(m)).sort((a, b) => b[1].abertas - a[1].abertas);
      box.innerHTML = `<div class="empty"><div class="lbl">Macrorregiões</div><div class="hint">Selecione no mapa ou na lista abaixo</div><ul>` +
        rows.map(([m, g]) => `<li data-m="${escapeHTML(m)}" tabindex="0"><i class="sw" style="background:${colorFor(g.resp)}"></i>
          <span><b style="font-weight:600">${escapeHTML(m)}</b><div class="cell-sub">${escapeHTML(g.resp)} · ${plural(g.muns.length, 'município', 'municípios')}</div></span>
          <span><b class="alert-num">${fmtNum(g.abertas)}</b> <span class="muted">abertas</span></span></li>`).join('') + '</ul>' +
        (unmapped.length ? `<p class="hint" style="margin-top:12px">Fora do mapa: ${unmapped.map(s => `${plural(s.total, 'vaga', 'vagas')} cadastradas como “${escapeHTML(s.nome)}”, sem município (${fmtNum(s.abertas)} ${s.abertas === 1 ? 'aberta' : 'abertas'})`).join('; ')}.</p>` : '') +
        '</div>';
      box.querySelectorAll('li').forEach(li => {
        li.onclick = () => select(li.dataset.m);
        li.onkeydown = e => { if (e.key === 'Enter') select(li.dataset.m); };
      });
      return;
    }
    const g = REG[sel];
    const occ = g.total ? (g.ocup / g.total) * 100 : 0;
    const pm = procsByMun();
    const openProcs = g.muns.reduce((s, p) => s + (pm[key(p.nome)] || []).filter(x => !window.isClosedProcess?.(x)).length, 0);
    const top = g.muns.filter(p => p.st.abertas > 0).sort((a, b) => b.st.abertas - a.st.abertas).slice(0, 5);
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div><div class="hint">Macrorregião · ${plural(g.muns.length, 'município', 'municípios')}</div><h3 class="rt">${escapeHTML(sel)}</h3>
        <div class="hint">Responsável: <b style="color:var(--ink);font-weight:600">${escapeHTML(g.resp)}</b></div></div>
        <button class="btn btn-ghost btn-sm" id="mapClear" type="button"><i class="fas fa-xmark"></i>Limpar</button>
      </div>
      <div class="kv">
        <div><div class="hint">Médicos ativos</div><div class="v">${fmtNum(g.ocup)}</div></div>
        <div><div class="hint">Vagas abertas</div><div class="v alert-num">${fmtNum(g.abertas)}</div></div>
        <div><div class="hint">Ocupação</div><div class="v">${occ.toFixed(0)}%</div><div class="bar" style="margin-top:6px"><i style="width:${occ}%"></i></div></div>
        <div><div class="hint">Processos em aberto</div><div class="v">${fmtNum(openProcs)}</div></div>
      </div>
      <div class="lbl">Municípios com mais vagas abertas</div>
      <ol>${top.length ? top.map(p => `<li><span>${escapeHTML(p.nome)}<span class="muted"> · ${escapeHTML(p.cir.split(' ')[0])}</span></span><span class="alert-num">${plural(p.st.abertas, 'aberta', 'abertas')}</span></li>`).join('') : '<li><span class="muted">Nenhuma vaga aberta</span></li>'}</ol>
      <button class="btn btn-primary" id="openRf" type="button" style="margin-top:16px;width:100%">Ver relatório da região <i class="fas fa-arrow-down"></i></button>`;
    document.getElementById('mapClear').onclick = () => select(null);
    document.getElementById('openRf').onclick = () => openRegFull(true);
  }

  // ---------- Relatório completo ----------
  function openRegFull(scroll) {
    const RF = document.getElementById('regFull');
    if (!RF) return;
    if (!sel) { RF.hidden = true; return; }
    if (!scroll && RF.hidden) return; // só atualiza se já estiver aberto
    RF.hidden = false;
    renderRegFull();
    if (scroll) RF.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function regionProcs() {
    const pm = procsByMun();
    return REG[sel].muns.flatMap(p => pm[key(p.nome)] || []);
  }
  function regionDoctors() {
    const names = new Set(REG[sel].muns.map(p => key(p.nome)));
    return (window.medicosData || []).filter(d => d.ativo_inativo !== 'INATIVA' && names.has(key(d.municipio_atuacao || '')));
  }

  function renderRegFull() {
    const g = REG[sel];
    const procs = regionProcs();
    const docs = regionDoctors();
    document.getElementById('rfTitle').textContent = 'Relatório · ' + sel;
    document.getElementById('rfMeta').textContent = `Responsável: ${g.resp} · ${plural(g.muns.length, 'município', 'municípios')} · ${plural(new Set(g.muns.map(p => p.cir)).size, 'região de saúde', 'regiões de saúde')}`;
    document.getElementById('rfcMun').textContent = g.muns.length;
    document.getElementById('rfcProc').textContent = procs.length;
    document.getElementById('rfcMed').textContent = fmtNum(docs.filter(d => d.status === 'OCUPADA').length);
    document.querySelectorAll('#rfTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === rfTab));
    ({ mun: rfMun, proc: rfProc, med: rfMed })[rfTab](g, procs, docs);
  }

  function rfMun(g) {
    const pm = procsByMun();
    const cirs = [...new Set(g.muns.map(p => p.cir))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const showEmProc = g.muns.some(p => p.st.emProc > 0);
    let rows = g.muns.map(p => ({
      nome: p.nome, cir: p.cir, vagas: p.st.total, ocup: p.st.ocup, abertas: p.st.abertas, emProc: p.st.emProc,
      occ: p.st.total ? p.st.ocup / p.st.total : -1,
      proc: (pm[key(p.nome)] || []).length, semCadastro: p.st.semCadastro
    }));
    if (rfOnlyOpen) rows = rows.filter(r => r.abertas > 0);
    if (rfCir) rows = rows.filter(r => r.cir === rfCir);
    if (rfQuery) rows = rows.filter(r => normStr(r.nome).includes(normStr(rfQuery)));
    const { k, dir } = rfSort;
    rows.sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k], 'pt-BR') : a[k] - b[k]) * dir || a.nome.localeCompare(b.nome, 'pt-BR'));
    const tot = rows.reduce((a, r) => ({ vagas: a.vagas + r.vagas, ocup: a.ocup + r.ocup, abertas: a.abertas + r.abertas, emProc: a.emProc + r.emProc, proc: a.proc + r.proc }), { vagas: 0, ocup: 0, abertas: 0, emProc: 0, proc: 0 });
    const th = (kk, label, cls = '') => `<th class="${cls} sortable" data-k="${kk}" aria-sort="${k === kk ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${label}${k === kk ? ` <i class="fas fa-arrow-${dir > 0 ? 'up' : 'down'}" style="font-size:10px"></i>` : ''}</th>`;
    const cols = showEmProc ? 8 : 7;

    document.getElementById('rfBody').innerHTML = `
      <div class="filters">
        <input type="search" id="rfQ" class="search-input" placeholder="Buscar município…" value="${escapeHTML(rfQuery)}">
        <select id="rfCir" aria-label="Região de saúde"><option value="">Todas as regiões de saúde</option>${cirs.map(c => `<option ${c === rfCir ? 'selected' : ''}>${escapeHTML(c)}</option>`).join('')}</select>
        <label class="check-inline"><input type="checkbox" id="rfOpen" ${rfOnlyOpen ? 'checked' : ''}> Só com vagas abertas</label>
        <span class="spacer"></span><span class="hint">${rows.length} de ${g.muns.length} municípios</span>
      </div>
      <div class="tbl"><table>
        <thead><tr>${th('nome', 'Município')}${th('cir', 'Região de saúde')}${th('vagas', 'Vagas', 'r')}${th('ocup', 'Ocupadas', 'r')}${th('occ', 'Ocupação')}${th('abertas', 'Abertas', 'r')}${showEmProc ? th('emProc', 'Em ocupação', 'r') : ''}${th('proc', 'Processos', 'r')}</tr></thead>
        <tbody>${rows.map(r => `<tr class="click" data-m="${escapeHTML(r.nome)}" title="Ver médicos de ${escapeHTML(r.nome)}">
          <td class="cell-main">${escapeHTML(r.nome)}${r.semCadastro ? ' <span class="tag warn" title="Município sem linha em referências regionais">sem cadastro</span>' : ''}</td>
          <td class="muted">${escapeHTML(r.cir)}</td>
          <td class="r">${fmtNum(r.vagas)}</td><td class="r">${fmtNum(r.ocup)}</td>
          <td>${r.vagas ? occCell(r.ocup, r.vagas) : '<span class="muted">—</span>'}</td>
          <td class="r">${r.abertas ? `<b class="alert-num">${fmtNum(r.abertas)}</b>` : '<span class="muted">0</span>'}</td>
          ${showEmProc ? `<td class="r">${r.emProc ? fmtNum(r.emProc) : '<span class="muted">0</span>'}</td>` : ''}
          <td class="r">${r.proc ? fmtNum(r.proc) : '<span class="muted">0</span>'}</td></tr>`).join('') || `<tr><td colspan="${cols}"><div class="empty-state">Nenhum município com esses filtros</div></td></tr>`}</tbody>
        <tfoot><tr><td colspan="2">Total</td><td class="r">${fmtNum(tot.vagas)}</td><td class="r">${fmtNum(tot.ocup)}</td><td>${tot.vagas ? occCell(tot.ocup, tot.vagas) : ''}</td><td class="r alert-num">${fmtNum(tot.abertas)}</td>${showEmProc ? `<td class="r">${fmtNum(tot.emProc)}</td>` : ''}<td class="r">${fmtNum(tot.proc)}</td></tr></tfoot>
      </table></div>`;

    const body = document.getElementById('rfBody');
    body.querySelectorAll('th.sortable').forEach(t => t.onclick = () => {
      const kk = t.dataset.k;
      rfSort = { k: kk, dir: rfSort.k === kk ? -rfSort.dir : (['nome', 'cir'].includes(kk) ? 1 : -1) };
      renderRegFull();
    });
    document.getElementById('rfQ').oninput = e => {
      rfQuery = e.target.value; const pos = e.target.selectionStart; renderRegFull();
      const q = document.getElementById('rfQ'); q.focus(); q.setSelectionRange(pos, pos);
    };
    document.getElementById('rfCir').onchange = e => { rfCir = e.target.value; renderRegFull(); };
    document.getElementById('rfOpen').onchange = e => { rfOnlyOpen = e.target.checked; renderRegFull(); };
    body.querySelectorAll('tbody tr[data-m]').forEach(tr => tr.onclick = () => { rfMedMun = tr.dataset.m; rfTab = 'med'; renderRegFull(); });
  }

  function rfProc(g, procs) {
    const closed = p => window.isClosedProcess ? window.isClosedProcess(p) : false;
    const stale = p => window.isStaleProcess ? window.isStaleProcess(p) : false;
    const total = procs.length;
    const abertos = procs.filter(p => !closed(p));
    const analise = procs.filter(p => normStr(p.status_processo || '').includes('analise')).length;
    const sob = procs.filter(p => normStr(p.status_processo || '').includes('sobrestado')).length;
    const parados = procs.filter(stale).length;
    let sentence;
    if (!total) sentence = 'Nenhum processo administrativo vinculado aos municípios desta região.';
    else {
      const partes = [];
      if (abertos.length === total) partes.push(total === 1 ? 'em aberto' : 'todos em aberto');
      else partes.push(`<b>${fmtNum(abertos.length)}</b> em aberto`);
      if (analise) partes.push(`<b>${fmtNum(analise)}</b> em análise`);
      if (sob) partes.push(`<b class="alert-num">${fmtNum(sob)}</b> ${sob === 1 ? 'sobrestado' : 'sobrestados'}`);
      sentence = `<b>${plural(total, 'processo', 'processos')}</b>: ${partes.join(', ')}. ` +
        (parados === 0 ? 'Nenhum parado há mais de 30 dias.' : parados === abertos.length && parados > 1 ? `Todos os abertos estão parados há mais de 30 dias.` : `<b class="warn-num">${fmtNum(parados)}</b> parados há mais de 30 dias.`);
    }
    const dem = {}, cid = {};
    procs.forEach(p => {
      const d = window.getProcessDemandType ? window.getProcessDemandType(p) : (p.tipo_demanda || 'OUTROS');
      dem[d] = (dem[d] || 0) + 1;
      const c = (p.municipio || 'NÃO INFORMADO').trim().toUpperCase();
      cid[c] = (cid[c] || 0) + 1;
    });
    document.getElementById('rfBody').innerHTML = `
      <div class="rf-sentence">${sentence}</div>
      <div class="cols"><div><h3>Principais demandas</h3><div class="rank" id="rfDem"></div></div><div><h3>Municípios com mais processos</h3><div class="rank" id="rfCid"></div></div></div>
      <div class="tfoot"><span>Clique numa linha para abrir a tela Processos filtrada</span><button class="lnk" type="button" id="rfProcGo">Abrir na tela Processos →</button></div>`;
    const go = (t, v) => window.openProcessosFilter && window.openProcessosFilter(t, v);
    renderRankList('rfDem', Object.entries(dem).sort((a, b) => b[1] - a[1]).slice(0, 6), v => go('demanda', v), 'Nenhum processo.');
    renderRankList('rfCid', Object.entries(cid).sort((a, b) => b[1] - a[1]).slice(0, 6), v => go('municipio', v), 'Nenhum processo.');
    document.getElementById('rfProcGo').onclick = () => document.getElementById('navProcessos')?.click();
  }

  function rfMed(g, procs, docs) {
    let list = docs;
    if (rfMedMun) list = list.filter(d => key(d.municipio_atuacao || '') === key(rfMedMun));
    list = list.slice().sort((a, b) => (a.nome_profissional || 'zz').localeCompare(b.nome_profissional || 'zz', 'pt-BR'));
    const LIMIT = 50;
    const shown = list.slice(0, LIMIT);
    const loading = !(window.medicosData && window.medicosData.length);
    document.getElementById('rfBody').innerHTML = `
      <div class="filters">
        ${rfMedMun ? `<span class="tag info" style="font-size:12.5px">${escapeHTML(rfMedMun)} <button class="icon-btn" id="rfMedClr" aria-label="Remover filtro de município"><i class="fas fa-xmark"></i></button></span>` : ''}
        <span class="spacer"></span><span class="hint">${loading ? 'Carregando médicos…' : `Mostrando ${fmtNum(shown.length)} de ${fmtNum(list.length)} vagas ativas`}</span>
      </div>
      <div class="tbl"><table>
        <thead><tr><th>Nome</th><th>Município</th><th>Instituição</th><th>Eixo</th><th>Vaga</th></tr></thead>
        <tbody>${shown.map(d => `<tr class="click" data-id="${escapeHTML(String(d.id))}">
          <td class="cell-main">${d.nome_profissional ? escapeHTML(d.nome_profissional) : '<span class="muted">Vaga sem profissional</span>'}</td>
          <td>${escapeHTML(titleCase(d.municipio_atuacao || '-'))}<div class="cell-sub">${escapeHTML(titleCase(d.regiao_saude || ''))}</div></td>
          <td>${escapeHTML(d.instituicao || '—')}</td>
          <td>${escapeHTML(titleCase(d.eixo_vaga || '—'))}</td>
          <td>${statusTag(d.status === 'EM PROCESSO DE OCUPACAO' ? 'Em processo' : d.status)}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state">${loading ? 'Carregando…' : 'Nenhuma vaga ativa'}</div></td></tr>`}</tbody>
      </table></div>
      <div class="tfoot"><span>Clique numa linha para ver os detalhes</span>${rfMedMun ? `<button class="lnk" type="button" id="rfMedGo">Abrir ${escapeHTML(rfMedMun)} na tela Médicos →</button>` : ''}</div>`;
    const body = document.getElementById('rfBody');
    body.querySelectorAll('tbody tr[data-id]').forEach(tr => tr.onclick = () => window.viewMedicoDetails && window.viewMedicoDetails(tr.dataset.id));
    const clr = document.getElementById('rfMedClr'); if (clr) clr.onclick = () => { rfMedMun = ''; renderRegFull(); };
    const goBtn = document.getElementById('rfMedGo'); if (goBtn) goBtn.onclick = () => window.filtrarMedicosPorMunicipio(rfMedMun);
  }

  function exportRegion() {
    if (!sel) return;
    const pm = procsByMun();
    const rows = REG[sel].muns.map(p => ({
      macro_regiao: sel, responsavel: REG[sel].resp, regiao_saude: p.cir, municipio: p.nome,
      total_vagas: p.st.total, ocupadas: p.st.ocup, vagas_abertas: p.st.abertas, em_ocupacao: p.st.emProc,
      processos_administrativos: (pm[key(p.nome)] || []).length
    })).sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'));
    const headers = Object.keys(rows[0]);
    downloadCSV(convertToCSV(rows, headers), `relatorio_regiao_${normStr(sel).replace(/[^a-z0-9]+/g, '_')}.csv`);
  }

  function bindStaticControls() {
    document.querySelectorAll('#mapMode button').forEach(b => b.onclick = () => {
      mode = b.dataset.m;
      document.querySelectorAll('#mapMode button').forEach(x => x.classList.toggle('on', x === b));
      paint();
    });
    const tabs = document.getElementById('rfTabs');
    if (tabs) tabs.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      rfTab = b.dataset.t; if (rfTab !== 'med') rfMedMun = '';
      renderRegFull();
    };
    const close = document.getElementById('rfClose');
    if (close) close.onclick = () => {
      document.getElementById('regFull').hidden = true;
      document.getElementById('ceMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const csv = document.getElementById('rfCsv');
    if (csv) csv.onclick = exportRegion;
  }

  // ---------- API pública ----------
  let initialized = false;
  window.initCearaMap = function (refs) {
    if (!window.CE_GEO) return;
    buildData(refs);
    if (!initialized) {
      bindStaticControls();
      if (!createMap()) { renderReport(); return; }
      initialized = true;
    }
    paint();
    renderReport();
    const current = window.dashboardSelectedRegion;
    if (current && current !== 'TODAS') window.ceMapSelectFromFilter(current);
  };

  window.invalidateCearaMap = function () {
    if (!map) return;
    map.invalidateSize();
    if (!sel && ALL) map.fitBounds(ALL, { padding: [12, 12] });
  };

  window.refreshMapTheme = function () {
    if (!map) return;
    setBase();
    paint();
  };

  // Quando médicos ou processos terminam de carregar, atualiza o relatório aberto
  window.refreshRegionReport = function () {
    if (!initialized) return;
    renderReport();
    const RF = document.getElementById('regFull');
    if (RF && !RF.hidden && sel) renderRegFull();
  };
})();
