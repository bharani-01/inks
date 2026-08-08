/**
 * Printa — Admin Profile Logic
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();

  const profileForm = document.getElementById('profile-form');
  const passwordForm = document.getElementById('password-form');
  if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);
  if (passwordForm) passwordForm.addEventListener('submit', handlePasswordChange);

  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? icons.eyeOff : icons.eye;
    });
  });
});

async function loadProfile() {
  try {
    const data = await api.get('/users/profile');
    const user = data.user;
    api.setUser(user);

    const form = document.getElementById('profile-form');
    if (form) {
      form.name.value = user.name || '';
      form.email.value = user.email || '';
      form.phone.value = user.phone || '';
    }

    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();

    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const roleEl = document.getElementById('profile-role');
    const joinedEl = document.getElementById('profile-joined');
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (roleEl) roleEl.textContent = 'Administrator';
    if (joinedEl) joinedEl.textContent = new Date(user.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (err) { showToast('Failed to load profile', 'error'); }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const phone = form.phone.value.trim();
  if (!name || !email) { showToast('Name and email are required', 'error'); return; }

  btn.disabled = true;
  try {
    const data = await api.put('/users/profile', { name, email, phone });
    api.setUser(data.user);
    showToast('Profile updated successfully', 'success');
    const sidebarName = document.querySelector('.sidebar-user .user-name');
    const sidebarAvatar = document.querySelector('.sidebar-user .user-avatar');
    if (sidebarName) sidebarName.textContent = data.user.name;
    if (sidebarAvatar) sidebarAvatar.textContent = data.user.name.charAt(0).toUpperCase();
    await loadProfile();
  } catch (err) { showToast(err.message, 'error'); } finally { btn.disabled = false; }
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const currentPassword = form.currentPassword.value;
  const newPassword = form.newPassword.value;
  const confirmNewPassword = form.confirmNewPassword.value;

  if (!currentPassword || !newPassword) { showToast('All password fields are required', 'error'); return; }
  if (newPassword.length < 6) { showToast('New password must be at least 6 characters', 'error'); return; }
  if (newPassword !== confirmNewPassword) { showToast('New passwords do not match', 'error'); return; }

  btn.disabled = true;
  try {
    await api.put('/users/change-password', { currentPassword, newPassword });
    showToast('Password changed successfully', 'success');
    form.reset();
  } catch (err) { showToast(err.message, 'error'); } finally { btn.disabled = false; }
}
