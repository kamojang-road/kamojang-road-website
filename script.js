const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Tutup menu" : "Buka menu");
    menuToggle.textContent = isOpen ? "×" : "☰";
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Buka menu");
      menuToggle.textContent = "☰";
    });
  });
}

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

// SUPABASE
const SUPABASE_URL = "https://nvgpprjwzwqakgjtaukn.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// WHATSAPP PENGURUS
const WHATSAPP_NUMBER = "6285283234473";

// ELEMEN WEBSITE
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const dashboard = document.getElementById("memberDashboard");
const dashboardNotice = document.getElementById("dashboardNotice");
const dashboardMessage = document.getElementById("dashboardMessage");
const memberName = document.getElementById("memberName");
const memberId = document.getElementById("memberId");
const logoutButton = document.getElementById("logoutButton");

// PROFIL ANGGOTA
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
    dashboard.hidden = true;
    dashboardNotice.hidden = false;
    dashboardMessage.textContent = "Kesalahan profil: " + error.message;
    await supabaseClient.auth.signOut();
    return false;
  }

  if (!data || !data.membership_id) {
    dashboard.hidden = true;
    dashboardNotice.hidden = false;

    await supabaseClient.auth.signOut();

    loginMessage.textContent =
      "Akun belum aktif atau belum memiliki ID KTA. Hubungi pengurus.";

    return false;
  }

  memberName.textContent = data.full_name || "Nama belum tersedia";
  memberId.textContent = data.membership_id;
  dashboardMessage.textContent = "Profil berhasil dimuat.";

  return true;
}

// TAMPILAN LOGOUT
function showLoggedOut() {
  dashboard.hidden = true;
  dashboardNotice.hidden = false;
}

// LOGIN
if (loginButton) {
  loginButton.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      loginMessage.textContent = "Masukkan email dan password.";
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
        loginMessage.textContent = "Login gagal: " + error.message;
        return;
      }

      const berhasil = await loadMemberProfile(data.user);

      if (berhasil) {
        loginMessage.textContent = "Login berhasil.";
        document.getElementById("anggota").scrollIntoView({
          behavior: "smooth"
        });
      }
    } catch (error) {
      loginMessage.textContent = "Kesalahan aplikasi: " + error.message;
    } finally {
      loginButton.disabled = false;
    }
  });
}

// LOGOUT
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        dashboardMessage.textContent = "Logout gagal: " + error.message;
        return;
      }

      showLoggedOut();
      loginMessage.textContent = "Kamu sudah logout.";

      document.getElementById("login").scrollIntoView({
        behavior: "smooth"
      });
    } catch (error) {
      dashboardMessage.textContent = "Kesalahan: " + error.message;
    } finally {
      logoutButton.disabled = false;
    }
  });
}

// PENDAFTARAN KTA DAN WHATSAPP
const registrationForm = document.getElementById("ktaRegistrationForm");

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nameInput = document.getElementById("registerName");
    const emailInput = document.getElementById("registerEmail");
    const registerButton = document.getElementById("registerButton");
    const registerMessage = document.getElementById("registerMessage");

    const fullName = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (fullName.length < 2 || !email.includes("@")) {
      registerMessage.textContent =
        "Periksa kembali nama dan alamat email.";
      return;
    }

    registerButton.disabled = true;
    registerMessage.textContent = "Menyimpan pendaftaran...";

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
          "Pendaftaran belum tersimpan: " + error.message;
        return;
      }

      const message =
        "Halo Pengurus KAMOJANG ROAD, saya ingin mendaftar KTA." +
        "\n\nNama lengkap: " + fullName +
        "\nEmail: " + email +
        "\n\nMohon informasi tahapan selanjutnya untuk pendaftaran KTA.";

      const whatsappURL =
        "https://wa.me/" + WHATSAPP_NUMBER +
        "?text=" + encodeURIComponent(message);

      registerMessage.textContent =
        "Pendaftaran tersimpan. Membuka WhatsApp...";

      window.location.href = whatsappURL;

    } catch (error) {
      registerMessage.textContent =
        "Terjadi kesalahan: " + error.message;
    } finally {
      registerButton.disabled = false;
    }
  });
}

// PERIKSA SESI LOGIN
async function checkExistingSession() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

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
