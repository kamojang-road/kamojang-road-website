
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

menuToggle.addEventListener("click", () => {
  nav.classList.toggle("open");
});

nav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => nav.classList.remove("open"));
});

document.getElementById("year").textContent = new Date().getFullYear();

// KONFIGURASI SUPABASE
const SUPABASE_URL = "https://nvgpprjwzwqakgjtaukn.supabase.co";
const SUPABASE_KEY = "KEY_DISENSOR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const dashboard = document.getElementById("memberDashboard");
const dashboardNotice = document.getElementById("dashboardNotice");

async function loadMemberProfile(user) {
  const { data, error } = await supabaseClient
    .from("member_profiles")
    .select("full_name, membership_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    document.getElementById("dashboardMessage").textContent =
      "Profil anggota belum ditemukan. Hubungi pengurus.";
    return;
  }

  document.getElementById("memberName").textContent = data.full_name;
  document.getElementById("memberId").textContent =
    data.membership_id || "Belum memiliki ID KTA";

  dashboard.hidden = false;
  dashboardNotice.hidden = true;
}

function showLoggedOut() {
  dashboard.hidden = true;
  dashboardNotice.hidden = false;
}

loginButton.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    loginMessage.textContent = "Masukkan email dan password terlebih dahulu.";
    return;
  }

  loginButton.disabled = true;
  loginMessage.textContent = "Sedang masuk...";

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      loginMessage.textContent = "Login gagal. Periksa email dan password.";
      return;
    }

    loginMessage.textContent = "Login berhasil.";
    await loadMemberProfile(data.user);
    document.getElementById("anggota").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    loginMessage.textContent = "Terjadi kesalahan koneksi. Coba lagi.";
  } finally {
    loginButton.disabled = false;
  }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    document.getElementById("dashboardMessage").textContent =
      "Logout belum berhasil. Silakan coba lagi.";
    return;
  }

  showLoggedOut();
  loginMessage.textContent = "Kamu sudah logout.";
  document.getElementById("login").scrollIntoView({ behavior: "smooth" });
});

// Periksa sesi yang masih aktif saat halaman dibuka
async function checkExistingSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    await loadMemberProfile(data.session.user);
  } else {
    showLoggedOut();
  }
}

checkExistingSession();
