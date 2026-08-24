// ============================================
// Gestão CCE — Utilitários e Helpers Compartilhados
// ============================================

// Normalização para busca insensível a acentos e maiúsculas
function normStr(str) {
  if (!str) return '';
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Sanitização de HTML para prevenção de XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Máscara de CPF para privacidade (Ex: ***.456.789-**)
function maskCPF(cpf) {
  if (!cpf) return '-';
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length === 11) {
    return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
  }
  return '***.***.***-**';
}

// Máscara de Conta Bancária (Ex: Ag: **** / Conta: *****-4)
function maskBankAccount(acc) {
  if (!acc) return '-';
  const str = String(acc).trim();
  if (str.length > 4) {
    return `****-${str.slice(-2)}`;
  }
  return '****';
}

// Animação de contadores numéricos
function animateCounter(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const duration = 1200; // ms
  const startTime = performance.now();
  const startValue = parseInt(el.textContent) || 0;
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (targetValue - startValue) * eased);
    el.textContent = currentValue;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// Conversor de objetos para CSV formatado em UTF-8 com BOM
function convertToCSV(objArray, fields) {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
  let str = '';
  
  const headers = fields.map(f => `"${f.label.replace(/"/g, '""')}"`).join(';');
  str += headers + '\r\n';
  
  for (let i = 0; i < array.length; i++) {
    let line = '';
    for (let j = 0; j < fields.length; j++) {
      if (j > 0) line += ';';
      const fieldKey = fields[j].key;
      let val = array[i][fieldKey];
      
      if (val === null || val === undefined) {
        val = '';
      } else {
        val = String(val).replace(/"/g, '""');
      }
      line += `"${val}"`;
    }
    str += line + '\r\n';
  }
  return str;
}

// Download automático de arquivos CSV no navegador
function downloadCSV(csvContent, fileName) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
