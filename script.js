
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

menuToggle.addEventListener("click", () => {
  nav.classList.toggle("open");
});

nav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => nav.classList.remove("open"));
});

document.getElementById("year").textContent =
  new Date().getFullYear();

// SUPABASE
const SUPABASE_URL =
  "https://nvgpprjwzwqakgjtaukn.supabase.co";

// PERTAHANKAN PUBLISHABLE KEY MILIKMU DI BARIS INI
const SUPABASE_KEY = "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ELEMEN WEBSITE
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const dashboard = document.getElementById("memberDashboard");
const dashboardNotice = document.getElementById("dashboardNotice");
const dashboardMessage = document.getElementById("dashboardMessage");
const memberName = document.getElementById("memberName");
const memberId = document.getElementById("memberId");
const logoutButton = document.getElementById("logoutButton");

// MEMUAT PROFIL
async function loadMemberProfile(user) {
  dashboard.hidden = false;
  dashboardNotice.hidden = true;

  memberName.textContent = "Memuat nama...";
  memberId.textContent = "Memuat ID...";
  dashboardMessage.textContent = "Mengambil data profil...";

  const { data, error } = await supabaseClient
    .from("member_profiles")
    .select("full_name, membership_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    dashboardMessage.textContent =
      "Kesalahan profil: " + error.message;
    return;
  }

  if (!data) {
    memberName.textContent = "Profil belum ditemukan";
    memberId.textContent = "ID KTA belum tersedia";
    dashboardMessage.textContent =
      "Data profil akun ini tidak ditemukan.";
    return;
  }

  memberName.textContent =
    data.full_name || "Nama belum tersedia";

  memberId.textContent =
    data.membership_id || "ID KTA belum diterbitkan";

  dashboardMessage.textContent =
    "Profil berhasil dimuat.";
}

// SAAT LOGOUT
function showLoggedOut() {
  dashboard.hidden = true;
  dashboardNotice.hidden = false;
}

// LOGIN
loginButton.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    loginMessage.textContent =
      "Masukkan email dan password.";
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
        "Supabase: " + error.message +
        (error.code ? " (Kode: " + error.code + ")" : "");
      return;
    }

    loginMessage.textContent = "Login berhasil.";

    await loadMemberProfile(data.user);

    document.getElementById("anggota").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    loginMessage.textContent =
      "Kesalahan aplikasi: " + error.message;

  } finally {
    loginButton.disabled = false;
  }
});

// LOGOUT
logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      dashboardMessage.textContent =
        "Logout gagal: " + error.message;
      return;
    }

    showLoggedOut();
    loginMessage.textContent = "Kamu sudah logout.";

    document.getElementById("login").scrollIntoView({
      behavior: "smooth"
    });

  } finally {
    logoutButton.disabled = false;
  }
});

// PERIKSA SESI
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
