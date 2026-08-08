/**
 * Printa — Auth Page Logic
 * Handles login and register form submissions
 */

/** Quick fill credentials for dev testing */
function quickFill(email, password) {
  const emailInput = document.querySelector('#email');
  const passwordInput = document.querySelector('#password');
  if (emailInput) emailInput.value = email;
  if (passwordInput) passwordInput.value = password;
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) initLogin(loginForm);
  if (registerForm) initRegister(registerForm);

  // Password toggle buttons
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? icons.eyeOff : icons.eye;
    });
  });
});

function initLogin(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);

    const email = form.email.value.trim();
    const password = form.password.value;

    let valid = true;
    if (!email) { showFieldError(form, 'email', 'Email is required'); valid = false; }
    if (!password) { showFieldError(form, 'password', 'Password is required'); valid = false; }
    if (!valid) return;

    const btn = form.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);

    try {
      const data = await api.post('/auth/login', { email, password });
      api.setToken(data.token);
      api.setUser(data.user);
      showToast('Welcome back!', 'success');
      setTimeout(() => {
        window.location.href = getDashboardPath(data.user);
      }, 500);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

function initRegister(form) {
  form.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('blur', () => validateField(form, input));
    input.addEventListener('input', () => {
      const errorEl = form.querySelector(`#${input.name}-error`);
      if (errorEl && errorEl.classList.contains('visible')) validateField(form, input);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone?.value.trim() || '';
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    let valid = true;
    if (!name) { showFieldError(form, 'name', 'Name is required'); valid = false; }
    if (!email) { showFieldError(form, 'email', 'Email is required'); valid = false; }
    else if (!isValidEmail(email)) { showFieldError(form, 'email', 'Enter a valid email'); valid = false; }
    if (!password) { showFieldError(form, 'password', 'Password is required'); valid = false; }
    else if (password.length < 6) { showFieldError(form, 'password', 'Minimum 6 characters'); valid = false; }
    if (password !== confirmPassword) { showFieldError(form, 'confirmPassword', 'Passwords do not match'); valid = false; }
    if (!valid) return;

    const btn = form.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);

    try {
      const data = await api.post('/auth/register', { name, email, phone, password });
      api.setToken(data.token);
      api.setUser(data.user);
      showToast('Account created successfully!', 'success');
      setTimeout(() => {
        window.location.href = getDashboardPath(data.user);
      }, 500);
    } catch (err) {
      if (err.message.includes('Email already')) showFieldError(form, 'email', err.message);
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

function validateField(form, input) {
  clearFieldError(form, input.name);
  switch (input.name) {
    case 'name':
      if (!input.value.trim()) showFieldError(form, 'name', 'Name is required'); break;
    case 'email':
      if (!input.value.trim()) showFieldError(form, 'email', 'Email is required');
      else if (!isValidEmail(input.value)) showFieldError(form, 'email', 'Enter a valid email'); break;
    case 'password':
      if (input.value && input.value.length < 6) showFieldError(form, 'password', 'Minimum 6 characters'); break;
    case 'confirmPassword':
      if (input.value && input.value !== form.password.value) showFieldError(form, 'confirmPassword', 'Passwords do not match'); break;
  }
}

function showFieldError(form, fieldName, message) {
  const input = form.querySelector(`[name="${fieldName}"]`);
  const errorEl = form.querySelector(`#${fieldName}-error`);
  if (input) input.classList.add('error');
  if (errorEl) { errorEl.textContent = message; errorEl.classList.add('visible'); }
}

function clearFieldError(form, fieldName) {
  const input = form.querySelector(`[name="${fieldName}"]`);
  const errorEl = form.querySelector(`#${fieldName}-error`);
  if (input) input.classList.remove('error');
  if (errorEl) errorEl.classList.remove('visible');
}

function clearErrors(form) {
  form.querySelectorAll('.form-input').forEach(input => input.classList.remove('error'));
  form.querySelectorAll('.form-error').forEach(el => el.classList.remove('visible'));
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  const originalText = btn.dataset.text || btn.textContent;
  if (loading) {
    btn.dataset.text = originalText;
    btn.innerHTML = '<span class="spinner"></span> Please wait...';
  } else {
    btn.textContent = originalText;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
