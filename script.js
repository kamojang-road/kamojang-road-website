'use strict';

/* KONFIGURASI SUPABASE */
const SUPABASE_URL = 'https://nvgpprjwzwqakgjtaukn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR';

let supabaseClient = null;
let currentUserId = null;

/* ELEMEN HALAMAN */
const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');
const year = document.getElementById('year');

const ktaForm = document.getElementById('ktaForm');
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const resetPasswordButton = document.getElementById('resetPasswordButton');
const logoutButton = document.getElementById('logoutButton');

const authMessage = document.getElementById('authMessage');
const accountPanel = document.getElementById('accountPanel');
const accountEmail = document.getElementById('accountEmail');
const accountStatus = document.getElementById('accountStatus');
const accountHeading = document.getElementById('accountHeading');

const profileSummary = document.getElementById('profileSummary');
const profileName = document.getElementById('profileName');
const profileRole = document.getElementById('profileRole');
const profileMembership = document.getElementById('profileMembership');

const dashboard = document.getElementById('dashboard');
const dashboardTitle = document.getElementById('dashboardTitle');
const dashboardDescription = document.getElementById('dashboardDescription');
const dashboardCards = document.getElementById('dashboardCards');
const dashboardNote = document.getElementById('dashboardNote');

/* TAHUN FOOTER */
if (year) {
  year.textContent = new Date().getFullYear();
}

/* MENU MOBILE */
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const opened = nav.classList.toggle('open');

    menuToggle.setAttribute('aria-expanded', String(opened));
    menuToggle.setAttribute('aria-label', opened ? 'Tutup menu' : 'Buka menu');
    menuToggle.textContent = opened ? '×' : '☰';
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Buka menu');
      menuToggle.textContent = '☰';
    });
  });
}

/* FORMULIR MINAT KTA VIA WHATSAPP */
if (ktaForm) {
  ktaForm.addEventListener('submit', event => {
    event.preventDefault();

    if (!ktaForm.reportValidity()) return;

    const name = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const extra = document.getElementById('message').value.trim();

    const message = [
      'Halo Pengurus Kamojang Road, saya berminat mendaftar KTA.',
      `Nama: ${name}`,
      `Nomor WhatsApp: ${phone}`,
      extra ? `Pesan: ${extra}` : ''
    ].filter(Boolean).join('\n');

    const url = 'https://wa.me/6285283234473?text=' + encodeURIComponent(message);
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

/* PESAN LOGIN */
function showAuthMessage(message, type = '') {
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.className = `auth-message ${type}`.trim();
}

function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Email atau kata sandi tidak cocok.';
  }

  if (message.includes('email not confirmed')) {
    return 'Email akun belum dikonfirmasi. Hubungi pengurus.';
  }

  if (message.includes('network')) {
    return 'Koneksi internet bermasalah. Coba lagi.';
  }

  return 'Login belum berhasil. Periksa akun atau hubungi pengurus.';
}

/* KONFIGURASI PERAN */
const roleConfig = {
  member: {
    label: 'Anggota',
    title: 'DASHBOARD ANGGOTA.',
    description: 'Selamat datang di area anggota Kamojang Road.',
    cards: [
      ['Data Anggota', 'Periksa nama dan status ID KTA pada profil akun.'],
      ['Tiket Pertandingan', 'Informasi pemesanan tiket dapat ditanyakan kepada pengurus.'],
      ['Riwayat & Notifikasi', 'Informasi riwayat akan tersedia setelah modul terkait diaktifkan.']
    ]
  },

  admin: {
    label: 'Admin',
    title: 'DASHBOARD PENGURUS.',
    description: 'Akun dikenali sebagai admin.',
    cards: [
      ['Pengajuan KTA', 'Pengelolaan pengajuan belum diaktifkan.'],
      ['Data Anggota', 'Pengelolaan data anggota belum diaktifkan.'],
      ['Pertandingan & Tiket', 'Pengaturan pertandingan dan pembayaran belum diaktifkan.']
    ]
  },

  secretary: {
    label: 'Sekretaris',
    title: 'DASHBOARD SEKRETARIS.',
    description: 'Akses informasi sekretaris.',
    cards: [
      ['Pengajuan KTA', 'Daftar pengajuan belum diaktifkan.'],
      ['Data Anggota', 'Tampilan data anggota belum diaktifkan.'],
      ['Data Tiket', 'Tampilan data pembeli belum diaktifkan.']
    ]
  }
};

/* TAMPILKAN DASHBOARD */
function renderDashboard(profile) {
  const config = roleConfig[profile.role];

  if (!config) {
    dashboard.hidden = true;
    accountStatus.textContent = 'Peran akun belum dikenali. Hubungi pengurus.';
    return;
  }

  profileName.textContent = profile.full_name || '-';
  profileRole.textContent = config.label;
  profileMembership.textContent = profile.membership_id || 'Belum tercatat';

  profileSummary.hidden = false;
  accountHeading.textContent = 'BERHASIL MASUK';
  accountStatus.textContent = 'Profil berhasil ditemukan.';

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

  dashboardNote.textContent =
    'Catatan: fitur pengelolaan data dan tiket belum diaktifkan pada versi ini.';

  dashboard.hidden = false;
}

/* MEMBACA PROFIL */
async function loadProfileAndDashboard(user) {
  if (!user || !supabaseClient) return;

  currentUserId = user.id;

  accountPanel.hidden = false;
  loginForm.hidden = true;

  accountEmail.textContent = user.email || 'Akun anggota';
  accountStatus.textContent = 'Memeriksa profil akun...';

  profileSummary.hidden = true;
  dashboard.hidden = true;

  const { data, error } = await supabaseClient
    .from('member_profiles')
    .select('id, full_name, role, membership_id')
    .eq('id', user.id)
    .maybeSingle();

  if (currentUserId !== user.id) return;

  if (error) {
    accountStatus.textContent =
      'Profil tidak dapat dibaca. Periksa aturan akses database.';
    return;
  }

  if (!data) {
    accountStatus.textContent =
      'Profil belum dibuat oleh pengurus. Hubungi pengurus untuk aktivasi.';
    return;
  }

  renderDashboard(data);

  if (!dashboard.hidden) {
    dashboard.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

/* KONDISI KELUAR */
function showSignedOut() {
  currentUserId = null;

  if (accountPanel) accountPanel.hidden = true;
  if (loginForm) loginForm.hidden = false;
  if (dashboard) dashboard.hidden = true;
  if (profileSummary) profileSummary.hidden = true;
}

/* INISIALISASI SUPABASE */
if (window.supabase && window.supabase.createClient) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  supabaseClient.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        showAuthMessage('Sesi akun tidak dapat diperiksa.', 'error');
        return;
      }

      if (data.session?.user) {
        loadProfileAndDashboard(data.session.user);
      } else {
        showSignedOut();
      }
    })
    .catch(() => {
      showAuthMessage('Koneksi ke layanan akun gagal.', 'error');
    });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setTimeout(() => {
        loadProfileAndDashboard(session.user);
      }, 0);
    } else {
      showSignedOut();
    }
  });

} else {
  showAuthMessage(
    'Layanan login tidak dapat dimuat. Periksa koneksi internet.',
    'error'
  );
}

/* LOGIN */
if (loginForm) {
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (!supabaseClient) {
      showAuthMessage('Layanan login belum tersedia.', 'error');
      return;
    }

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    loginButton.disabled = true;
    loginButton.textContent = 'MEMERIKSA AKUN...';

    showAuthMessage('Sedang memeriksa akun...');

    try {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

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

/* LUPA KATA SANDI */
if (resetPasswordButton) {
  resetPasswordButton.addEventListener('click', async () => {
    if (!supabaseClient) {
      showAuthMessage('Layanan login belum tersedia.', 'error');
      return;
    }

    const email = document.getElementById('loginEmail').value.trim();

    if (!email) {
      showAuthMessage('Isi email akun terlebih dahulu.', 'error');
      return;
    }

    resetPasswordButton.disabled = true;

    try {
      const { error } =
        await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname + '#login'
        });

      if (error) throw error;

      showAuthMessage(
        'Jika email terdaftar, instruksi pemulihan akan dikirim.',
        'success'
      );

    } catch (error) {
      showAuthMessage(
        'Permintaan pemulihan belum berhasil. Coba lagi.',
        'error'
      );

    } finally {
      resetPasswordButton.disabled = false;
    }
  });
}

/* LOGOUT */
if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    if (!supabaseClient) return;

    logoutButton.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) throw error;

      showSignedOut();
      showAuthMessage('Kamu sudah keluar dari akun.', 'success');

      document.getElementById('login').scrollIntoView({
        behavior: 'smooth'
      });

    } catch (error) {
      showAuthMessage('Belum berhasil keluar. Coba lagi.', 'error');

    } finally {
      logoutButton.disabled = false;
    }
  });
}