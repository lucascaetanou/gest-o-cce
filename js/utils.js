// ============================================
// Gestão CCE — Utilitários Compartilhados
// ============================================

function normStr(str) {
  if (!str) return '';
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}


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



function maskCPF(cpf) {
  if (!cpf || cpf === '-') return '-';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length < 11) return '***.***.***-**';
  return '***.' + clean.substring(3, 6) + '.' + clean.substring(6, 9) + '-**';


function maskBankAccount(val) {
  if (!val || val === '-') return '****';
  const s = String(val);
  if (s.length <= 2) return '****';
  return '****' + s.substring(s.length - 2);


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
