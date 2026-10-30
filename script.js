
// ==========================================
// KAMOJANG ROAD - WEBSITE SCRIPT
// ==========================================

// MENU MOBILE
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

menuToggle.addEventListener("click", () => {
  nav.classList.toggle("open");
});

nav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
  });
});

// TAHUN FOOTER
document.getElementById("year").textContent =
  new Date().getFullYear();


// ==========================================
// KONFIGURASI SUPABASE
// ==========================================

const SUPABASE_URL =
  "https://nvgpprjwzwqakgjtaukn.supabase.co";

// GANTI KEY_SENSOR DENGAN PUBLISHABLE KEY MILIKMU
const SUPABASE_KEY = "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ==========================================
// ELEMEN WEBSITE
// ==========================================

const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const dashboard = document.getElementById("memberDashboard");
const dashboardNotice = document.getElementById("dashboardNotice");
const dashboardMessage = document.getElementById("dashboardMessage");
const memberName = document.getElementById("memberName");
const memberId = document.getElementById("memberId");
const logoutButton = document.getElementById("logoutButton");


// ==========================================
// TAMPILKAN PROFIL ANGGOTA
// ==========================================

async function loadMemberProfile(user) {
  dashboard.hidden = false;
  dashboardNotice.hidden = true;

  memberName.textContent = "Memuat nama...";
  memberId.textContent = "Memuat ID...";
  dashboardMessage.textContent = "Sedang mengambil data profil...";

  try {
    const { data, error } = await supabaseClient
      .from("member_profiles")
      .select("full_name, membership_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      dashboardMessage.textContent =
        "Gagal mengambil profil: " + error.message;
      return;
    }

    if (!data) {
      memberName.textContent = "Profil belum tersedia";
      memberId.textContent = "Belum memiliki ID KTA";
      dashboardMessage.textContent =
        "Data profil akun ini belum ditemukan di database.";
      return;
    }

    memberName.textContent =
      data.full_name || "Nama belum tersedia";

    memberId.textContent =
      data.membership_id || "ID KTA belum diterbitkan";

    dashboardMessage.textContent =
      "Profil anggota berhasil dimuat.";

  } catch (error) {
    dashboardMessage.textContent =
      "Terjadi kesalahan saat mengambil profil.";
  }
}


// ==========================================
// KONDISI SAAT BELUM LOGIN
// ==========================================

function showLoggedOut() {
  dashboard.hidden = true;
  dashboardNotice.hidden = false;

  memberName.textContent = "Memuat nama...";
  memberId.textContent = "Memuat ID...";
  dashboardMessage.textContent = "";
}


// ==========================================
// LOGIN ANGGOTA
// ==========================================

loginButton.addEventListener("click", async () => {
  const email = document
    .getElementById("loginEmail")
    .value.trim();

  const password = document
    .getElementById("loginPassword")
    .value;

  if (!email || !password) {
    loginMessage.textContent =
      "Masukkan email dan password terlebih dahulu.";
    return;
  }

  loginButton.disabled = true;
  loginMessage.textContent = "Sedang masuk...";

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      loginMessage.textContent =
        "Login gagal. Periksa email dan password.";
      return;
    }

    loginMessage.textContent = "Login berhasil.";

    await loadMemberProfile(data.user);

    document.getElementById("anggota").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    loginMessage.textContent =
      "Terjadi kesalahan koneksi. Silakan coba lagi.";

  } finally {
    loginButton.disabled = false;
  }
});


// ==========================================
// LOGOUT ANGGOTA
// ==========================================

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      dashboardMessage.textContent =
        "Logout gagal. Silakan coba lagi.";
      return;
    }

    showLoggedOut();

    loginMessage.textContent = "Kamu sudah logout.";

    document.getElementById("login").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    dashboardMessage.textContent =
      "Terjadi kesalahan saat logout.";

  } finally {
    logoutButton.disabled = false;
  }
});


// ==========================================
// PERIKSA SESI LOGIN SAAT HALAMAN DIBUKA
// ==========================================

async function checkExistingSession() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      showLoggedOut();
      return;
    }

    if (data.session) {
      await loadMemberProfile(data.session.user);
    } else {
      showLoggedOut();
    }

  } catch (error) {
    showLoggedOut();
  }
}

checkExistingSession();
