const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
    });
  });
}

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

// SUPABASE
const SUPABASE_URL =
  "https://nvgpprjwzwqakgjtaukn.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// WHATSAPP PENGURUS
const WHATSAPP_NUMBER = "6285283234473";

// ELEMEN LOGIN DAN DASHBOARD
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const dashboard = document.getElementById("memberDashboard");
const dashboardNotice = document.getElementById("dashboardNotice");
const dashboardMessage = document.getElementById("dashboardMessage");
const memberName = document.getElementById("memberName");
const memberId = document.getElementById("memberId");
const logoutButton = document.getElementById("logoutButton");

// RAPikan FORMULIR PENDAFTARAN
const registrationStyle = document.createElement("style");

registrationStyle.textContent = `
  #ktaRegistrationForm {
    width: 100%;
    max-width: 520px;
    margin: 24px auto;
    padding: 24px;
    box-sizing: border-box;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 14px;
  }

  #ktaRegistrationForm input {
    display: block;
    width: 100%;
    min-height: 52px;
    padding: 14px 16px;
    margin: 10px 0 18px;
    box-sizing: border-box;
    font-size: 16px;
    border-radius: 8px;
  }

  #registerButton {
    display: block;
    width: auto;
    min-width: 190px;
    max-width: 100%;
    min-height: 46px;
    padding: 12px 22px;
    margin: 20px auto 0;
    font-size: 14px;
    font-weight: 700;
    border-radius: 8px;
  }

  #registerMessage {
    margin-top: 14px;
    text-align: center;
    overflow-wrap: anywhere;
  }

  @media (max-width: 600px) {
    #ktaRegistrationForm {
      padding: 18px;
    }

    #ktaRegistrationForm input {
      min-height: 54px;
    }
  }
`;

document.head.appendChild(registrationStyle);

// MEMUAT PROFIL ANGGOTA
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
    dashboardMessage.textContent =
      "Kesalahan profil: " + error.message;
    return false;
  }

  if (!data || !data.membership_id) {
    dashboard.hidden = true;
    dashboardNotice.hidden = false;

    await supabaseClient.auth.signOut();

    loginMessage.textContent =
      "Akun belum aktif. Silakan hubungi pengurus KTA.";

    return false;
  }

  memberName.textContent =
    data.full_name || "Nama belum tersedia";

  memberId.textContent = data.membership_id;

  dashboardMessage.textContent =
    "Profil berhasil dimuat.";

  return true;
}

// TAMPILAN SAAT LOGOUT
function showLoggedOut() {
  dashboard.hidden = true;
  dashboardNotice.hidden = false;
}

// LOGIN
if (loginButton) {
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

      const berhasil =
        await loadMemberProfile(data.user);

      if (berhasil) {
        loginMessage.textContent = "Login berhasil.";

        document.getElementById("anggota")
          .scrollIntoView({ behavior: "smooth" });
      }

    } catch (error) {
      loginMessage.textContent =
        "Kesalahan aplikasi: " + error.message;

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
      const { error } =
        await supabaseClient.auth.signOut();

      if (error) {
        dashboardMessage.textContent =
          "Logout gagal: " + error.message;
        return;
      }

      showLoggedOut();
      loginMessage.textContent = "Kamu sudah logout.";

      document.getElementById("login")
        .scrollIntoView({ behavior: "smooth" });

    } finally {
      logoutButton.disabled = false;
    }
  });
}

// PENDAFTARAN KTA + WHATSAPP
const registrationForm =
  document.getElementById("ktaRegistrationForm");

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nameInput =
      document.getElementById("registerName");

    const emailInput =
      document.getElementById("registerEmail");

    const registerButton =
      document.getElementById("registerButton");

    const registerMessage =
      document.getElementById("registerMessage");

    const fullName = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (fullName.length < 2 || !email.includes("@")) {
      registerMessage.textContent =
        "Periksa kembali nama dan alamat email.";
      return;
    }

    registerButton.disabled = true;
    registerMessage.textContent =
      "Menyimpan pendaftaran...";

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
        "\n\nSaya akan mengirimkan foto diri dan dokumen yang diperlukan melalui chat ini.";

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
