// ============================================
// Gestão CCE — Utilitários Compartilhados
// ============================================

function normStr(str) {
  if (!str) return '';
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    function(tag) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag);
    }
  );
}

function maskCPF(cpf) {
  if (!cpf || cpf === '-') return '-';
  var clean = cpf.replace(/\D/g, '');
  if (clean.length < 11) return '***.***.***-**';
  return '***.' + clean.substring(3, 6) + '.' + clean.substring(6, 9) + '-**';
}

function maskBankAccount(val) {
  if (!val || val === '-') return '****';
  var s = String(val);
  if (s.length <= 2) return '****';
  return '****' + s.substring(s.length - 2);
}

function animateCounter(elementId, targetValue) {
  var el = document.getElementById(elementId);
  if (!el) return;
  
  var duration = 1200; // ms
  var startTime = performance.now();
  var startValue = parseInt(el.textContent) || 0;
  
  function update(currentTime) {
    var elapsed = currentTime - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var currentValue = Math.round(startValue + (targetValue - startValue) * eased);
    el.textContent = currentValue;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function convertToCSV(dataArray, headers) {
  var escapeCsvValue = function(val) {
    if (val === null || val === undefined) return '""';
    var str = String(val);
    if (str.indexOf(';') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      return '"' + str.split('"').join('""') + '"';
    }
    return str;
  };

  var csvRows = [];
  csvRows.push(headers.join(';'));

  for (var i = 0; i < dataArray.length; i++) {
    var row = dataArray[i];
    var values = headers.map(function(header) { return escapeCsvValue(row[header]); });
    csvRows.push(values.join(';'));
  }

  return '\uFEFF' + csvRows.join('\n');
}

function downloadCSV(csvContent, filename) {
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- Modern Floating Toast Notification System ---
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  else if (type === 'error') iconClass = 'fa-exclamation-circle';
  else if (type === 'warning') iconClass = 'fa-exclamation-triangle';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'toast-icon';
  const icon = document.createElement('i');
  icon.className = `fas ${iconClass}`;
  iconDiv.appendChild(icon);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';
  const msgDiv = document.createElement('div');
  msgDiv.className = 'toast-message';
  msgDiv.textContent = message;
  contentDiv.appendChild(msgDiv);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => toast.remove();

  toast.appendChild(iconDiv);
  toast.appendChild(contentDiv);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 300);
  }, duration);
}

function showAlert(message, type = 'error') {
  const alertEl = document.getElementById('alertMessage');
  if (alertEl) {
    alertEl.textContent = message;
    alertEl.className = `alert ${type}`;
    alertEl.style.display = 'block';
    setTimeout(() => { alertEl.style.display = 'none'; }, 6000);
  }
  showToast(message, type);
}

window.showToast = showToast;
window.showAlert = showAlert;

// --- Helpers de apresentação ---
function fmtNum(n) {
  return (Number(n) || 0).toLocaleString('pt-BR');
}

function plural(n, um, varios) {
  return `${fmtNum(n)} ${Number(n) === 1 ? um : varios}`;
}

// Contador discreto ao lado de um item do menu lateral (vazio quando zero)
function setNavCount(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ? fmtNum(value) : '';
}

// Etiqueta de situação a partir de um texto livre (OCUPADA, ATIVO, SOBRESTADO...)
function statusTag(text) {
  const raw = (text || '').toString().trim();
  if (!raw) return '<span class="muted">—</span>';
  const s = normStr(raw);
  let cls = 'plain';
  // A ordem importa: "desocupada" contém "ocupada" e "inativo" contém "ativo"
  if (/sobrestad|desocupad|rejeitad|recusad|inativ|desligad|arquivad/.test(s)) cls = 'danger';
  else if (/analise|pendente|processo|andamento/.test(s)) cls = 'warn';
  else if (/concluid|ocupada|aprovad|^ativ|validad/.test(s)) cls = 'ok';
  const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return `<span class="tag ${cls}">${escapeHTML(label)}</span>`;
}

// Converte texto em MAIÚSCULAS para "Primeira maiúscula" preservando siglas curtas
function titleCase(str) {
  if (!str) return '';
  const small = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return String(str).toLowerCase().split(/\s+/).map((w, i) => {
    if (i > 0 && small.includes(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).length === 10 ? dateStr + 'T00:00:00' : dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(String(dateStr).length === 10 ? dateStr + 'T00:00:00' : dateStr);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

// Lista de detalhes (dt/dd) usada nas gavetas
function detailsList(rows) {
  return '<dl class="details">' + rows.map(([label, value, raw]) => {
    const empty = value === null || value === undefined || value === '' || value === '-';
    const content = empty ? 'Não informado' : (raw ? value : escapeHTML(String(value)));
    return `<dt>${escapeHTML(label)}</dt><dd${empty ? ' class="muted"' : ''}>${content}</dd>`;
  }).join('') + '</dl>';
}

function emptyRow(colspan, title, hint, action) {
  return `<tr><td colspan="${colspan}"><div class="empty-state"><b>${escapeHTML(title)}</b>${hint ? escapeHTML(hint) : ''}${action || ''}</div></td></tr>`;
}

window.fmtNum = fmtNum;
window.setNavCount = setNavCount;
window.statusTag = statusTag;


// --- Tipos de perfil de usuário (espelham profiles.role no Supabase) ---
const PROFILE_TYPES = {
  ADMIN: { label: 'Admin master', tag: 'info' },
  MIN_SAUDE: { label: 'Ministério da Saúde', tag: 'ok' },
  MIN_EDUCACAO: { label: 'Ministério da Educação', tag: 'info' },
  USER: { label: 'Sem perfil definido', tag: 'plain' }
};
// Perfis que o admin master pode atribuir a um cadastro
const ASSIGNABLE_PROFILE_TYPES = ['MIN_SAUDE', 'MIN_EDUCACAO'];

function getProfileTypeLabel(role) {
  const key = (role || '').toUpperCase();
  return (PROFILE_TYPES[key] || PROFILE_TYPES.USER).label;
}
