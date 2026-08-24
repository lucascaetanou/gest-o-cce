// ============================================
// Gestão CCE — Magic Bento Component (React Bits Style)
// Interactive Spotlight, Dynamic Border Glow & 3D Tilt
// ============================================

(function initMagicBento() {
  function setupMagicBento() {
    // Select all bento style cards across the dashboard and app
    const selectors = [
      '.stat-box',
      '.stat-card',
      '.chart-card',
      '.alertas-card',
      '.proc-stat-card',
      '.table-card',
      '.auth-card',
      '.material-card',
      '.detail-card'
    ];

    const cards = document.querySelectorAll(selectors.join(', '));

    cards.forEach((card) => {
      // Prevent attaching duplicate listeners
      if (card.dataset.magicBentoAttached) return;
      card.dataset.magicBentoAttached = 'true';

      card.classList.add('magic-bento-card');

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Subtle 3D perspective tilt calculations (-3 to +3 degrees)
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -3;
        const rotateY = ((x - centerX) / centerX) * 3;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
        card.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
        card.setAttribute('data-hover', 'true');
      });

      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
        card.removeAttribute('data-hover');
      });
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMagicBento);
  } else {
    setupMagicBento();
  }

  // Observe DOM additions (e.g. dynamically loaded cards or tab switches)
  const observer = new MutationObserver(() => {
    setupMagicBento();
  });

  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });

  window.refreshMagicBento = setupMagicBento;
})();
