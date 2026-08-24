// ============================================
// Gestão CCE — Magic Bento Spotlight Glow Effect
// Smooth, Ultra-Lightweight & Zero-Jank (React Bits Style)
// ============================================

(function initMagicBento() {
  function handleMouseMove(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }

  function attachMagicBento() {
    // Select stat cards and dashboard cards only (avoids shifting complex tables)
    const selectors = [
      '.stat-box',
      '.stat-card',
      '.chart-card',
      '.alertas-card',
      '.proc-stat-card'
    ];

    const cards = document.querySelectorAll(selectors.join(', '));
    cards.forEach((card) => {
      if (card.dataset.magicBentoAttached) return;
      card.dataset.magicBentoAttached = 'true';
      card.classList.add('magic-bento-card');
      card.addEventListener('mousemove', handleMouseMove, { passive: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachMagicBento);
  } else {
    attachMagicBento();
  }

  window.refreshMagicBento = attachMagicBento;
})();
