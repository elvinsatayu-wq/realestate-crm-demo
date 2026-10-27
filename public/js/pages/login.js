// Login page: deliberately does not import auth.js (which would redirect back here).
import { hydrateIcons } from '../core/icons.js';

hydrateIcons();

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submit = form.querySelector('[type=submit]');
const password = form.elements.password;

// Only same-site paths are allowed as a post-login destination (no open redirects).
function nextUrl() {
  const next = new URLSearchParams(location.search).get('next') || '/';
  return /^\/(?![/\\])/.test(next) && !next.startsWith('/login') ? next : '/';
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.toggle('hidden', !message);
}

document.getElementById('toggle-password').addEventListener('click', () => {
  password.type = password.type === 'password' ? 'text' : 'password';
  password.focus();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = form.elements.username.value.trim();
  if (!username || !password.value) return showError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

  showError('');
  submit.disabled = true;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: password.value }),
    });
    if (res.ok) {
      location.replace(nextUrl());
      return;
    }
    const payload = await res.json().catch(() => ({}));
    showError(payload.error || 'เข้าสู่ระบบไม่สำเร็จ');
    password.select();
  } catch {
    showError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
  } finally {
    submit.disabled = false;
  }
});
