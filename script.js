'use strict';

const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Tutup menu' : 'Buka menu');
    menuToggle.textContent = isOpen ? '×' : '☰';
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Buka menu');
      menuToggle.textContent = '☰';
    });
  });
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const ktaForm = document.getElementById('ktaForm');
if (ktaForm) {
  ktaForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!ktaForm.reportValidity()) return;

    const name = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const extra = document.getElementById('message').value.trim();
    const text = [
      'Halo Pengurus Kamojang Road, saya berminat mendaftar KTA.',
      `Nama: ${name}`,
      `Nomor WhatsApp: ${phone}`,
      extra ? `Pesan: ${extra}` : ''
    ].filter(Boolean).join('\n');

    const whatsappUrl = `https://wa.me/6285283234473?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  });
}


// Supabase Auth: login hanya untuk akun yang sudah dibuat/diaktifkan pengurus.
const SUPABASE_URL = 'https://nvgpprjwzwqakgjtaukn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR';
const authMessage = document.getElementById('authMessage');
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const resetPasswordButton = document.getElementById('resetPasswordButton');
const accountPanel = document.getElementById('accountPanel');
const accountEmail = document.getElementById('accountEmail');
const logoutButton = document.getElementById('logoutButton');
let supabaseClient = null;

function showAuthMessage(message, type = '') {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = `auth-message ${type}`.trim();
}

function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'Email atau kata sandi tidak cocok. Periksa kembali atau hubungi pengurus.';
  if (message.includes('email not confirmed')) return 'Email akun belum dikonfirmasi. Periksa email atau hubungi pengurus.';
  if (message.includes('network')) return 'Koneksi internet bermasalah. Coba lagi.';
  return 'Login belum berhasil. Periksa data akun atau hubungi pengurus.';
}

function showSignedInUser(user) {
  if (!accountPanel || !loginForm) return;
  if (user) {
    accountEmail.textContent = user.email || 'Akun anggota';
    accountPanel.hidden = false;
    loginForm.hidden = true;
  } else {
    accountPanel.hidden = true;
    loginForm.hidden = false;
  }
}

if (window.supabase?.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (!error) showSignedInUser(data.session?.user || null);
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    showSignedInUser(session?.user || null);
  });
} else if (loginForm) {
  showAuthMessage('Layanan login tidak dapat dimuat. Periksa koneksi internet lalu muat ulang halaman.', 'error');
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabaseClient) return showAuthMessage('Layanan login belum tersedia. Muat ulang halaman.', 'error');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    loginButton.disabled = true;
    loginButton.textContent = 'MEMERIKSA AKUN...';
    showAuthMessage('Sedang memeriksa akun...');
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showSignedInUser(data.user);
      showAuthMessage('Login berhasil. Status akses anggota tetap perlu diverifikasi pengurus.', 'success');
    } catch (error) {
      showAuthMessage(friendlyAuthError(error), 'error');
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'MASUK';
    }
  });
}

if (resetPasswordButton) {
  resetPasswordButton.addEventListener('click', async () => {
    if (!supabaseClient) return showAuthMessage('Layanan login belum tersedia.', 'error');
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) return showAuthMessage('Isi email akun terlebih dahulu, lalu tekan Lupa kata sandi.', 'error');
    resetPasswordButton.disabled = true;
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname + '#login' });
      if (error) throw error;
      showAuthMessage('Jika email terdaftar, instruksi pemulihan akan dikirim ke email tersebut.', 'success');
    } catch (_error) {
      showAuthMessage('Permintaan pemulihan belum berhasil. Coba lagi atau hubungi pengurus.', 'error');
    } finally {
      resetPasswordButton.disabled = false;
    }
  });
}

if (logoutButton && supabaseClient) {
  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    const { error } = await supabaseClient.auth.signOut();
    logoutButton.disabled = false;
    if (error) showAuthMessage('Belum berhasil keluar. Coba lagi.', 'error');
    else showAuthMessage('Kamu sudah keluar dari akun.', 'success');
  });
}
