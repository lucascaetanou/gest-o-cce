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

// --- Auto Check Active Session / Recovery Event on Login Page ---
let isPasswordRecoverySession = false;

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      isPasswordRecoverySession = true;
      const modal = document.getElementById('forgotPasswordModal');
      if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        if (typeof switchRecoveryStep === 'function') {
          switchRecoveryStep('stepNewPassword');
        }
        const newPassInput = document.getElementById('newPassword');
        if (newPassInput) setTimeout(() => newPassInput.focus(), 200);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');
  
  // Se a URL contiver hash de recovery, ativa a recuperação de senha
  if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')) {
    isPasswordRecoverySession = true;
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      if (typeof switchRecoveryStep === 'function') {
        switchRecoveryStep('stepNewPassword');
      }
      const newPassInput = document.getElementById('newPassword');
      if (newPassInput) setTimeout(() => newPassInput.focus(), 200);
    }
    return;
  }

  if (loginForm && supabaseClient && !isPasswordRecoverySession) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role, status')
        .eq('id', session.user.id)
        .single();
      if (profile && profile.status === 'APPROVED') {
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
      if (authError) {
        throw new Error('E-mail ou senha incorretos.');
      }

      // 2. Fetch profile com campos específicos
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('id, role, status, name')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabaseClient.auth.signOut();
        throw new Error('Perfil de usuário não encontrado ou inativo.');
      }

      // 3. Route based on role/status
      if (profile.status === 'APPROVED') {
        showAlert('Login realizado com sucesso!', 'success');
        setTimeout(() => {
          window.location.replace('admin.html');
        }, 600);
      } else {
        await supabaseClient.auth.signOut();
        throw new Error('Sua conta está aguardando aprovação do administrador.');
      }

    } catch (error) {
      showAlert(error.message || 'Falha na autenticação.', 'error');
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
      // 1. Criar usuário no Supabase Auth com metadados seguros
      // O perfil é gerado de forma segura pela Trigger Server-Side (sem risco de escalação de privilégios)
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { 
            name: name, 
            phone: phone 
          }
        }
      });
      if (authError) {
        throw new Error(authError.message || 'Erro ao processar solicitação de cadastro.');
      }

      showAlert('Cadastro solicitado com sucesso! Sua conta passará por aprovação do administrador.', 'success');
      registerForm.reset();
      
      if (strengthContainer) {
        const bar = strengthContainer.querySelector('.bar');
        if (bar) bar.style.width = '0%';
      }
      
      setTimeout(() => {
        window.location.replace('index.html');
      }, 3000);

    } catch (error) {
      showAlert(error.message || 'Erro ao solicitar cadastro. Tente novamente.', 'error');
    } finally {
      if (btnSpan) btnSpan.textContent = originalText;
      else if (btn) btn.textContent = originalText;
      if (btn) btn.disabled = false;
    }
  });
}

// ============================================
// Módulo de Recuperação de Senha (OTP 6 Dígitos)
// ============================================
const forgotModal = document.getElementById('forgotPasswordModal');
const btnOpenForgot = document.getElementById('btnOpenForgotModal');
const btnCloseForgot = document.getElementById('btnCloseForgotModal');
const forgotEmailForm = document.getElementById('forgotEmailForm');
const forgotOtpForm = document.getElementById('forgotOtpForm');
const forgotNewPassForm = document.getElementById('forgotNewPasswordForm');
const btnFinishRecovery = document.getElementById('btnFinishRecovery');
const btnBackToEmail = document.getElementById('btnBackToEmail');
const btnResendOtp = document.getElementById('btnResendOtp');
const otpDigits = document.querySelectorAll('.otp-digit');

let recoveryEmailState = '';
let resendInterval = null;

// Helpers de alerta do modal
function showModalAlert(alertId, message, type = 'error') {
  const el = document.getElementById(alertId);
  if (el) {
    el.textContent = message;
    el.className = `alert ${type}`;
    el.style.display = 'block';
  }
}

function hideModalAlert(alertId) {
  const el = document.getElementById(alertId);
  if (el) {
    el.style.display = 'none';
    el.textContent = '';
  }
}

function switchRecoveryStep(stepId) {
  const steps = ['stepEmail', 'stepOtp', 'stepNewPassword', 'stepSuccess'];
  steps.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = (s === stepId) ? 'block' : 'none';
  });
  ['forgotAlert1', 'forgotAlert2', 'forgotAlert3'].forEach(hideModalAlert);
}

function startResendCountdown(seconds = 60) {
  if (resendInterval) clearInterval(resendInterval);
  let count = seconds;
  const timerText = document.getElementById('resendTimerText');
  const countdownEl = document.getElementById('resendCountdown');
  if (btnResendOtp) btnResendOtp.style.display = 'none';
  if (timerText) timerText.style.display = 'inline';
  if (countdownEl) countdownEl.textContent = count;

  resendInterval = setInterval(() => {
    count--;
    if (countdownEl) countdownEl.textContent = count;
    if (count <= 0) {
      clearInterval(resendInterval);
      if (timerText) timerText.style.display = 'none';
      if (btnResendOtp) btnResendOtp.style.display = 'inline';
    }
  }, 1000);
}

// Abrir e Fechar Modal
if (btnOpenForgot && forgotModal) {
  btnOpenForgot.addEventListener('click', (e) => {
    e.preventDefault();
    forgotModal.style.display = 'flex';
    forgotModal.setAttribute('aria-hidden', 'false');
    switchRecoveryStep('stepEmail');
    if (forgotEmailForm) forgotEmailForm.reset();
    if (forgotOtpForm) forgotOtpForm.reset();
    if (forgotNewPassForm) forgotNewPassForm.reset();
    const emailInput = document.getElementById('forgotEmail');
    if (emailInput) setTimeout(() => emailInput.focus(), 100);
  });
}

function closeModal() {
  if (forgotModal) {
    forgotModal.style.display = 'none';
    forgotModal.setAttribute('aria-hidden', 'true');
    if (resendInterval) clearInterval(resendInterval);
  }
}

if (btnCloseForgot) btnCloseForgot.addEventListener('click', closeModal);
if (btnFinishRecovery) btnFinishRecovery.addEventListener('click', () => {
  closeModal();
  const mainEmail = document.getElementById('email');
  if (mainEmail) {
    mainEmail.value = recoveryEmailState;
    document.getElementById('password')?.focus();
  }
});

// Fechar ao clicar fora do card
if (forgotModal) {
  forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) closeModal();
  });
}

// Etapa 1: Enviar Código OTP para o E-mail
if (forgotEmailForm) {
  forgotEmailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      showModalAlert('forgotAlert1', 'Serviço de autenticação indisponível.', 'error');
      return;
    }

    const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
    const btn = document.getElementById('btnSendOtp');
    const btnSpan = btn ? btn.querySelector('span') : null;
    const origText = btnSpan ? btnSpan.textContent : 'Enviar Código';

    if (btnSpan) btnSpan.textContent = 'Enviando...';
    if (btn) btn.disabled = true;
    hideModalAlert('forgotAlert1');

    try {
      recoveryEmailState = email;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) throw error;

      const targetEl = document.getElementById('otpEmailTarget');
      if (targetEl) targetEl.textContent = email;

      switchRecoveryStep('stepOtp');
      startResendCountdown(60);
      
      if (otpDigits.length > 0) {
        otpDigits.forEach(input => input.value = '');
        setTimeout(() => otpDigits[0].focus(), 100);
      }
    } catch (err) {
      showModalAlert('forgotAlert1', err.message || 'Erro ao enviar o código de verificação. Verifique o e-mail informado.', 'error');
    } finally {
      if (btnSpan) btnSpan.textContent = origText;
      if (btn) btn.disabled = false;
    }
  });
}

// Gerenciamento de digitação e navegação dos inputs OTP (6 dígitos)
if (otpDigits.length > 0) {
  otpDigits.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length >= 1) {
        e.target.value = val.slice(-1); // Apenas 1 caractere
        if (idx < otpDigits.length - 1) {
          otpDigits[idx + 1].focus();
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        otpDigits[idx - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6,8}$/.test(pasteData)) {
        otpDigits.forEach(d => d.value = '');
        pasteData.split('').forEach((char, i) => {
          if (otpDigits[i]) otpDigits[i].value = char;
        });
        const lastIdx = Math.min(pasteData.length - 1, otpDigits.length - 1);
        if (otpDigits[lastIdx]) otpDigits[lastIdx].focus();
      }
    });
  });
}

// Reenviar Código OTP
if (btnResendOtp) {
  btnResendOtp.addEventListener('click', async () => {
    if (!recoveryEmailState || !supabaseClient) return;
    try {
      btnResendOtp.disabled = true;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(recoveryEmailState, {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      showModalAlert('forgotAlert2', 'Novo código enviado com sucesso para seu e-mail!', 'success');
      startResendCountdown(60);
    } catch (err) {
      showModalAlert('forgotAlert2', 'Erro ao reenviar o código. Tente novamente.', 'error');
    } finally {
      btnResendOtp.disabled = false;
    }
  });
}

// Voltar para a Etapa 1
if (btnBackToEmail) {
  btnBackToEmail.addEventListener('click', () => {
    switchRecoveryStep('stepEmail');
    if (resendInterval) clearInterval(resendInterval);
  });
}

// Etapa 2: Validar Código OTP e Conferir Status do Usuário
if (forgotOtpForm) {
  forgotOtpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      showModalAlert('forgotAlert2', 'Serviço indisponível.', 'error');
      return;
    }

    const otpCode = Array.from(otpDigits).map(i => i.value.trim()).join('');
    if (otpCode.length < 6) {
      showModalAlert('forgotAlert2', 'Por favor, digite o código de verificação completo.', 'error');
      return;
    }

    const btn = document.getElementById('btnVerifyOtp');
    const btnSpan = btn ? btn.querySelector('span') : null;
    const origText = btnSpan ? btnSpan.textContent : 'Verificar Código';

    if (btnSpan) btnSpan.textContent = 'Verificando...';
    if (btn) btn.disabled = true;
    hideModalAlert('forgotAlert2');

    try {
      const { data, error } = await supabaseClient.auth.verifyOtp({
        email: recoveryEmailState,
        token: otpCode,
        type: 'recovery'
      });

      if (error) {
        throw new Error('Código de verificação inválido ou expirado.');
      }

      // Verificação de segurança: checar se a conta está ativa/aprovada
      if (data?.user) {
        const { data: profile, error: profileErr } = await supabaseClient
          .from('profiles')
          .select('role, status')
          .eq('id', data.user.id)
          .single();

        if (profile && profile.status !== 'APPROVED') {
          await supabaseClient.auth.signOut();
          throw new Error('Sua conta ainda não foi aprovada pelo administrador ou está inativa.');
        }
      }

      // Avança para a criação da nova senha
      switchRecoveryStep('stepNewPassword');
      const newPassInput = document.getElementById('newPassword');
      if (newPassInput) setTimeout(() => newPassInput.focus(), 100);

    } catch (err) {
      showModalAlert('forgotAlert2', err.message || 'Código inválido. Tente novamente.', 'error');
    } finally {
      if (btnSpan) btnSpan.textContent = origText;
      if (btn) btn.disabled = false;
    }
  });
}

// Medidor de força da nova senha na recuperação
const resetPassInput = document.getElementById('newPassword');
const resetStrengthEl = document.getElementById('resetPasswordStrength');
if (resetPassInput && resetStrengthEl) {
  const bar = resetStrengthEl.querySelector('.bar');
  resetPassInput.addEventListener('input', () => {
    const val = resetPassInput.value;
    let strength = 0;
    if (val.length >= 6) strength += 25;
    if (val.length >= 10) strength += 25;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) strength += 25;
    if (/[0-9!@#$%^&*]/.test(val)) strength += 25;
    
    if (bar) {
      bar.style.width = strength + '%';
      if (strength <= 25) bar.style.background = '#ef4444';
      else if (strength <= 50) bar.style.background = '#f59e0b';
      else if (strength <= 75) bar.style.background = '#3b82f6';
      else bar.style.background = '#10b981';
    }
  });
}

// Etapa 3: Salvar Nova Senha
if (forgotNewPassForm) {
  forgotNewPassForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
      showModalAlert('forgotAlert3', 'Serviço indisponível.', 'error');
      return;
    }

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const btn = document.getElementById('btnSaveNewPassword');
    const btnSpan = btn ? btn.querySelector('span') : null;
    const origText = btnSpan ? btnSpan.textContent : 'Salvar Nova Senha';

    if (newPassword.length < 6) {
      showModalAlert('forgotAlert3', 'A senha deve conter no mínimo 6 caracteres.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showModalAlert('forgotAlert3', 'As senhas informadas não coincidem.', 'error');
      return;
    }

    if (btnSpan) btnSpan.textContent = 'Salvando...';
    if (btn) btn.disabled = true;
    hideModalAlert('forgotAlert3');

    try {
      const { error } = await supabaseClient.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Desloga da sessão de recuperação para exigir login com a nova senha
      await supabaseClient.auth.signOut();

      switchRecoveryStep('stepSuccess');

    } catch (err) {
      showModalAlert('forgotAlert3', err.message || 'Erro ao redefinir a senha. Tente novamente.', 'error');
    } finally {
      if (btnSpan) btnSpan.textContent = origText;
      if (btn) btn.disabled = false;
    }
  });
}
