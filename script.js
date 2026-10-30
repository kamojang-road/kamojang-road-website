
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

// Publishable Key milik proyek
const SUPABASE_KEY =
  "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ELEMEN LOGIN DAN DASHBOARD
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const dashboard = document.getElementById("memberDashboard");
const dashboardNotice = document.getElementById("dashboardNotice");
const dashboardMessage = document.getElementById("dashboardMessage");
const memberName = document.getElementById("memberName");
const memberId = document.getElementById("memberId");
const logoutButton = document.getElementById("logoutButton");

// ELEMEN PENDAFTARAN KTA
const registrationForm =
  document.getElementById("ktaRegistrationForm");

const registerButton =
  document.getElementById("registerButton");

const registerMessage =
  document.getElementById("registerMessage");

// PENDAFTARAN KTA
registrationForm.addEventListener("submit", async event => {
  event.preventDefault();

  const fullName =
    document.getElementById("registerName").value.trim();

  const email =
    document.getElementById("registerEmail").value.trim().toLowerCase();

  if (fullName.length < 2 || !email) {
    registerMessage.textContent =
      "Periksa kembali nama dan email.";
    return;
  }

  registerButton.disabled = true;
  registerMessage.textContent = "Mengirim pendaftaran...";

  try {
    const { error } = await supabaseClient
      .from("kta_requests")
      .insert({
        user_id: null,
        full_name: fullName,
        email: email,
        status: "pending"
      });

    if (error) {
      registerMessage.textContent =
        "Pendaftaran gagal: " + error.message;
      return;
    }

    registrationForm.reset();

    registerMessage.textContent =
      "Pendaftaran berhasil dikirim. Silakan menunggu pemeriksaan Admin/Ketua.";

  } catch (error) {
    registerMessage.textContent =
      "Terjadi kesalahan: " + error.message;

  } finally {
    registerButton.disabled = false;
  }
});

// TAMPILAN SAAT BELUM LOGIN
function showLoggedOut() {
  dashboard.hidden = true;
  dashboardNotice.hidden = false;
}

// MEMUAT PROFIL DAN MEMERIKSA ID KTA
async function loadMemberProfile(user) {
  dashboard.hidden = true;
  dashboardNotice.hidden = false;

  dashboardMessage.textContent = "Memeriksa data anggota...";

  const { data, error } = await supabaseClient
    .from("member_profiles")
    .select("full_name, membership_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    dashboardMessage.textContent =
      "Kesalahan profil: " + error.message;
    return false;
  }

  if (!data || !data.membership_id) {
    dashboardMessage.textContent =
      "Akun belum memiliki ID KTA. Hubungi Admin/Ketua.";

    await supabaseClient.auth.signOut();

    loginMessage.textContent =
      "Akses belum aktif. ID KTA harus diterbitkan terlebih dahulu.";

    return false;
  }

  memberName.textContent =
    data.full_name || "Nama belum tersedia";

  memberId.textContent = data.membership_id;

  dashboardMessage.textContent =
    "Profil anggota berhasil dimuat.";

  dashboard.hidden = false;
  dashboardNotice.hidden = true;

  return true;
}

// LOGIN
loginButton.addEventListener("click", async () => {
  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

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
        "Login gagal: " + error.message;
      return;
    }

    const allowed = await loadMemberProfile(data.user);

    if (allowed) {
      loginMessage.textContent = "Login berhasil.";

      document.getElementById("anggota").scrollIntoView({
        behavior: "smooth"
      });
    }

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

// PERIKSA SESI SAAT WEBSITE DIBUKA
async function checkExistingSession() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error || !data.session) {
      showLoggedOut();
      return;
    }

    await loadMemberProfile(data.session.user);

  } catch (error) {
    showLoggedOut();
  }
}

checkExistingSession();
