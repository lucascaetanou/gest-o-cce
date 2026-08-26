// ============================================
// Gestão CCE — Authentication Module
// ============================================

// Forçar HTTPS em produção (segurança extra)
if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  window.location.href = window.location.href.replace('http:', 'https:');
}

// Supabase Configuration (Lido de window.ENV configurado em js/config.js)
const SUPABASE_URL = (typeof window.ENV !== 'undefined' && window.ENV.SUPABASE_URL) 
  ? window.ENV.SUPABASE_URL 
  : 'https://aodzyrsmzuqkoxvhwdqz.supabase.co';

const SUPABASE_ANON_KEY = (typeof window.ENV !== 'undefined' && window.ENV.SUPABASE_ANON_KEY) 
  ? window.ENV.SUPABASE_ANON_KEY 
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvZHp5cnNtenVxa294dmh3ZHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzYxMjIsImV4cCI6MjEwMTkxMjEyMn0.Ido7I3b8KBXVEVVd4tzSipFzFPmNNUY8J0fc5ieDMzE';

// Initialize Supabase client
window.supabaseClient = (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
var supabaseClient = window.supabaseClient;

// --- Utility: Show Alert ---
function showAlert(message, type = 'error') {
  const alertEl = document.getElementById('alertMessage');
  if (alertEl) {
    alertEl.textContent = message;
    alertEl.className = `alert ${type}`;
    alertEl.style.display = 'block';
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      alertEl.style.display = 'none';
    }, 6000);
  } else {
    alert(message);
  }
}

// --- Auto Check Active Session on Login Page ---
document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm && supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role, status')
        .eq('id', session.user.id)
        .single();
      if (profile && (profile.role === 'ADMIN' || profile.status === 'APPROVED')) {
        window.location.href = 'admin.html';
      }
    }
  }
});

// --- Login Form Logic ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      showAlert('Supabase não configurado. Adicione suas chaves no auth.js', 'error');
      return;
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnSubmit');
    const btnSpan = btn.querySelector('span');
    
    // Loading state
    const originalText = btnSpan ? btnSpan.textContent : btn.textContent;
    if (btnSpan) btnSpan.textContent = 'Entrando...';
    else btn.textContent = 'Entrando...';
    btn.disabled = true;

    try {
      // 1. Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (authError) throw authError;

      // 2. Fetch profile to check role and status
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        await supabaseClient.auth.signOut();
        throw new Error('Erro ao buscar perfil: ' + (profileError.message || 'Contate o administrador.'));
      }

      // 3. Route based on role/status
      if (profile.role === 'ADMIN') {
        window.location.href = 'admin.html';
      } else if (profile.status === 'APPROVED') {
        showAlert('Login realizado com sucesso!', 'success');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 800);
      } else {
        await supabaseClient.auth.signOut();
        throw new Error('Sua conta está aguardando aprovação do administrador.');
      }

    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      if (btnSpan) btnSpan.textContent = originalText;
      else btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

// --- Register Form Logic (com sanitização e validação anti-injeção) ---
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const passwordInput = document.getElementById('password');
  const strengthContainer = document.getElementById('passwordStrength');
  
  if (passwordInput && strengthContainer) {
    const strengthBar = strengthContainer.querySelector('.bar');
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      let strength = 0;
      if (val.length >= 6) strength += 25;
      if (val.length >= 10) strength += 25;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) strength += 25;
      if (/[0-9!@#$%^&*]/.test(val)) strength += 25;
      
      if (strengthBar) {
        strengthBar.style.width = strength + '%';
        if (strength <= 25) strengthBar.style.background = '#ef4444';
        else if (strength <= 50) strengthBar.style.background = '#f59e0b';
        else if (strength <= 75) strengthBar.style.background = '#3b82f6';
        else strengthBar.style.background = '#10b981';
      }
    });
  }

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      showAlert('Supabase não configurado. Verifique as credenciais.', 'error');
      return;
    }

    // Sanitização e limpeza de inputs
    const name = document.getElementById('name').value.trim().replace(/<[^>]*>?/gm, '');
    const email = document.getElementById('email').value.trim().toLowerCase();
    const phone = document.getElementById('phone').value.trim().replace(/<[^>]*>?/gm, '');
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnSubmit');
    const btnSpan = btn ? btn.querySelector('span') : null;

    // Validação de formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Por favor, informe um e-mail válido.', 'error');
      return;
    }

    if (password.length < 6) {
      showAlert('A senha deve conter no mínimo 6 caracteres.', 'error');
      return;
    }

    const originalText = btnSpan ? btnSpan.textContent : (btn ? btn.textContent : 'Solicitar Acesso');
    if (btnSpan) btnSpan.textContent = 'Processando...';
    else if (btn) btn.textContent = 'Processando...';
    if (btn) btn.disabled = true;

    try {
      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { name, phone }
        }
      });
      if (authError) throw authError;

      // 2. Inserir perfil como PENDING
      if (authData.user) {
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .upsert([{
            id: authData.user.id,
            name: name,
            email: email,
            phone: phone,
            role: 'USER',
            status: 'PENDING'
          }]);

        if (profileError) {
          console.warn('Nota de inserção de perfil:', profileError);
        }
      }

      showAlert('Cadastro realizado com sucesso! Sua conta passará por aprovação do administrador.', 'success');
      registerForm.reset();
      
      if (strengthContainer) {
        const bar = strengthContainer.querySelector('.bar');
        if (bar) bar.style.width = '0%';
      }
      
      setTimeout(() => {
        window.location.replace('index.html');
      }, 3500);

    } catch (error) {
      showAlert(error.message || 'Erro ao realizar cadastro.', 'error');
    } finally {
      if (btnSpan) btnSpan.textContent = originalText;
      else if (btn) btn.textContent = originalText;
      if (btn) btn.disabled = false;
    }
  });
}
