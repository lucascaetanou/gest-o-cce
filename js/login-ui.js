// Gestão CCE — interação da experiência unificada de login e cadastro
document.addEventListener('DOMContentLoaded', () => {
  const shell = document.getElementById('authShell');
  const loginPane = document.querySelector('.auth-pane-login');
  const registerPane = document.querySelector('.auth-pane-register');
  const showRegisterButton = document.getElementById('showRegister');
  const showLoginButton = document.getElementById('showLogin');

  if (!shell || !loginPane || !registerPane) return;

  const clearAlerts = () => {
    ['loginAlert', 'registerAlert'].forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.style.display = 'none';
      element.textContent = '';
      element.className = 'alert';
    });
  };

  const setMode = (registerMode, focusField = true) => {
    shell.classList.toggle('show-register', registerMode);
    loginPane.setAttribute('aria-hidden', String(registerMode));
    registerPane.setAttribute('aria-hidden', String(!registerMode));
    document.title = `${registerMode ? 'Cadastro' : 'Login'} | Gestão CCE`;
    clearAlerts();

    if (registerMode) {
      window.history.replaceState(null, '', '#cadastro');
    } else if (!window.location.hash.includes('type=recovery')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    if (focusField) {
      const field = document.getElementById(registerMode ? 'registerName' : 'loginEmail');
      window.setTimeout(() => field?.focus(), 520);
    }
  };

  showRegisterButton?.addEventListener('click', () => setMode(true));
  showLoginButton?.addEventListener('click', () => setMode(false));

  const registrationRequested = /^(#cadastro|#register)$/i.test(window.location.hash);
  setMode(registrationRequested, false);
});
