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


// Supabase Auth + pemeriksaan profil dan role.
// Hanya publishable/anon key yang boleh ada di browser. Jangan masukkan service_role key.
const SUPABASE_URL = 'https://nvgpprjwzwqakgjtaukn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR';
const authMessage = document.getElementById('authMessage');
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const resetPasswordButton = document.getElementById('resetPasswordButton');
const accountPanel = document.getElementById('accountPanel');
const accountEmail = document.getElementById('accountEmail');
const accountStatus = document.getElementById('accountStatus');
const accountHeading = document.getElementById('accountHeading');
const profileSummary = document.getElementById('profileSummary');
const profileName = document.getElementById('profileName');
const profileRole = document.getElementById('profileRole');
const profileMembership = document.getElementById('profileMembership');
const logoutButton = document.getElementById('logoutButton');
const dashboard = document.getElementById('dashboard');
const dashboardTitle = document.getElementById('dashboardTitle');
const dashboardDescription = document.getElementById('dashboardDescription');
const dashboardCards = document.getElementById('dashboardCards');
let supabaseClient = null;
let currentUserId = null;

function showAuthMessage(message, type = '') {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = `auth-message ${type}`.trim();
}

function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'Email atau kata sandi tidak cocok. Periksa kembali atau hubungi pengurus.';
  if (message.includes('email not confirmed')) return 'Email akun belum dikonfirmasi. Hubungi pengurus.';
  if (message.includes('network')) return 'Koneksi internet bermasalah. Coba lagi.';
  return 'Login belum berhasil. Periksa data akun atau hubungi pengurus.';
}

const roleConfig = {
  member: {
    label: 'Anggota', title: 'DASHBOARD ANGGOTA.',
    description: 'Selamat datang. Informasi profil anggota ditampilkan di bawah ini.',
    cards: [
      ['Data Anggota', 'Periksa nama dan status ID KTA yang tercatat di profil.'],
      ['Tiket Pertandingan', 'Pemesanan tiket online belum diaktifkan. Hubungi pengurus untuk informasi tiket.'],
      ['Riwayat & Notifikasi', 'Riwayat transaksi dan notifikasi akan tersedia setelah modul tiket diaktifkan.']
    ]
  },
  admin: {
    label: 'Admin', title: 'DASHBOARD PENGURUS.',
    description: 'Akun dikenali sebagai admin. Panel ini belum menyediakan tindakan pengelolaan.',
    cards: [
      ['Pengajuan KTA', 'Daftar dan persetujuan pengajuan belum diaktifkan pada panel web.'],
      ['Data Anggota', 'Pengelolaan profil anggota belum diaktifkan.'],
      ['Pertandingan & Tiket', 'Pengaturan pertandingan, stok, pembayaran, dan gelang belum diaktifkan.']
    ]
  },
  secretary: {
    label: 'Sekretaris', title: 'DASHBOARD SEKRETARIS.',
    description: 'Akun dikenali sebagai sekretaris dengan akses informasi saja.',
    cards: [
      ['Pengajuan KTA', 'Tampilan daftar pengajuan belum diaktifkan.'],
      ['Data Anggota', 'Tampilan data anggota belum diaktifkan.'],
      ['Data Tiket', 'Tampilan data pembeli dan status gelang belum diaktifkan.']
    ]
  }
};

function renderDashboard(profile) {
  const config = roleConfig[profile.role];
  if (!config) {
    dashboard.hidden = true;
    accountStatus.textContent = 'Akun berhasil masuk, tetapi peran belum dikenali. Hubungi pengurus untuk pemeriksaan.';
    return;
  }
  profileName.textContent = profile.full_name || '-';
  profileRole.textContent = config.label;
  profileMembership.textContent = profile.membership_id || 'Belum tercatat';
  profileSummary.hidden = false;
  accountHeading.textContent = 'BERHASIL MASUK';
  accountStatus.textContent = 'Profil ditemukan. Peran akun berhasil diverifikasi.';
  dashboardTitle.innerHTML = config.title.replace(/\.$/, ' <span>KR.</span>');
  dashboardDescription.textContent = config.description;
  dashboardCards.replaceChildren();
  config.cards.forEach(([title, description]) => {
    const article = document.createElement('article');
    article.className = 'dashboard-card';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const paragraph = document.createElement('p');
    paragraph.textContent = description;
    article.append(heading, paragraph);
    dashboardCards.append(article);
  });
  dashboard.hidden = false;
}

async function loadProfileAndDashboard(user) {
  if (!user || !supabaseClient) return;
  currentUserId = user.id;
  accountPanel.hidden = false;
  loginForm.hidden = true;
  accountEmail.textContent = user.email || 'Akun anggota';
  accountStatus.textContent = 'Memeriksa profil dan peran akun...';
  profileSummary.hidden = true;
  dashboard.hidden = true;
  const { data, error } = await supabaseClient
    .from('member_profiles')
    .select('id, full_name, role, membership_id')
    .eq('id', user.id)
    .maybeSingle();
  if (currentUserId !== user.id) return;
  if (error) {
    accountStatus.textContent = 'Tidak dapat membaca profil. Periksa aturan akses database atau hubungi pengurus.';
    return;
  }
  if (!data) {
    accountStatus.textContent = 'Akun berhasil masuk, tetapi profil anggota belum dibuat oleh pengurus. Dashboard belum dapat dibuka.';
    return;
  }
  renderDashboard(data);
  if (dashboard && !dashboard.hidden) dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showSignedOut() {
  currentUserId = null;
  accountPanel.hidden = true;
  loginForm.hidden = false;
  dashboard.hidden = true;
  profileSummary.hidden = true;
}

if (window.supabase?.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) return;
    if (data.session?.user) loadProfileAndDashboard(data.session.user);
    else showSignedOut();
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      // Defer the profile request until after the auth callback completes.
      setTimeout(() => loadProfileAndDashboard(session.user), 0);
    } else {
      showSignedOut();
    }
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
      await loadProfileAndDashboard(data.user);
      showAuthMessage('Autentikasi berhasil.', 'success');
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

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    if (!supabaseClient) return;
    logoutButton.disabled = true;
    const { error } = await supabaseClient.auth.signOut();
    logoutButton.disabled = false;
    if (error) showAuthMessage('Belum berhasil keluar. Coba lagi.', 'error');
    else showAuthMessage('Kamu sudah keluar dari akun.', 'success');
  });
}
