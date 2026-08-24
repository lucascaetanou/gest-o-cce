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

