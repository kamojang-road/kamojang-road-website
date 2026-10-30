const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.textContent = isOpen ? "×" : "☰";
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.textContent = "☰";
    });
  });
}

document.getElementById("year").textContent = new Date().getFullYear();

const SUPABASE_URL = "https://nvgpprjwzwqakgjtaukn.supabase.co";
const SUPABASE_KEY = "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const WHATSAPP_NUMBER = "6285283234473";

const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const dashboard = document.getElementById("memberDashboard");
const dashboardNotice = document.getElementById("dashboardNotice");
const dashboardMessage = document.getElementById("dashboardMessage");
const memberName = document.getElementById("memberName");
const memberId = document.getElementById("memberId");
const logoutButton = document.getElementById("logoutButton");

const adminPanel = document.getElementById("adminPanel");
const secretaryPanel = document.getElementById("secretaryPanel");
const regularMemberPanel = document.getElementById("regularMemberPanel");

function showLoggedOut() {
  dashboard.hidden = true;
  dashboardNotice.hidden = false;
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "-";
  row.appendChild(cell);
  return cell;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID");
}

function showEmptyRow(body, colspan, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colspan;
  cell.textContent = message;
  row.appendChild(cell);
  body.appendChild(row);
}

async function loadMemberProfile(user) {
  dashboard.hidden = false;
  dashboardNotice.hidden = true;
  dashboardMessage.textContent = "Memuat profil...";

  const { data, error } = await supabaseClient
    .from("member_profiles")
    .select("full_name, membership_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    dashboardMessage.textContent =
      "Profil tidak dapat dimuat: " + (error?.message || "Data tidak ditemukan");
    await supabaseClient.auth.signOut();
    showLoggedOut();
    return false;
  }

  const role = data.role;

  memberName.textContent = data.full_name || "Nama belum tersedia";
  memberId.textContent = data.membership_id || "Belum diterbitkan";

  adminPanel.hidden = true;
  secretaryPanel.hidden = true;
  regularMemberPanel.hidden = true;

  if (role === "admin") {
    document.getElementById("roleLabel").textContent = "ADMINISTRATOR";
    adminPanel.hidden = false;
    dashboardMessage.textContent = "Selamat datang, Admin.";
    await loadManagementData("admin");

  } else if (role === "secretary") {
    document.getElementById("roleLabel").textContent = "SEKRETARIS";
    secretaryPanel.hidden = false;
    dashboardMessage.textContent = "Selamat datang, Sekretaris.";
    await loadManagementData("secretary");

  } else if (role === "member") {
    if (!data.membership_id) {
      dashboard.hidden = true;
      dashboardNotice.hidden = false;
      loginMessage.textContent =
        "Akun belum aktif atau belum memiliki ID KTA.";
      await supabaseClient.auth.signOut();
      return false;
    }

    document.getElementById("roleLabel").textContent = "PROFIL ANGGOTA";
    regularMemberPanel.hidden = false;
    dashboardMessage.textContent = "Profil anggota berhasil dimuat.";

  } else {
    dashboard.hidden = true;
    dashboardNotice.hidden = false;
    loginMessage.textContent = "Role akun tidak dikenali.";
    await supabaseClient.auth.signOut();
    return false;
  }

  return true;
}

async function loadManagementData(role) {
  const isAdmin = role === "admin";

  const requestBody = document.getElementById(
    isAdmin ? "adminRequestsBody" : "secretaryRequestsBody"
  );

  const membersBody = document.getElementById(
    isAdmin ? "adminMembersBody" : "secretaryMembersBody"
  );

  requestBody.replaceChildren();
  membersBody.replaceChildren();

  dashboardMessage.textContent = "Memuat data pengurus...";

  const { data: requests, error: requestError } =
    await supabaseClient
      .from("kta_requests")
      .select("id, full_name, email, status, created_at")
      .order("created_at", { ascending: false });

  if (requestError) {
    dashboardMessage.textContent =
      "Gagal memuat pendaftaran: " + requestError.message;
    return;
  }

  const rows = requests || [];

  if (isAdmin) {
    document.getElementById("totalRequests").textContent = rows.length;
    document.getElementById("pendingRequests").textContent =
      rows.filter(item => item.status === "pending").length;
    document.getElementById("approvedRequests").textContent =
      rows.filter(item => item.status === "approved").length;
    document.getElementById("rejectedRequests").textContent =
      rows.filter(item => item.status === "rejected").length;
  }

  rows.forEach(item => {
    const row = document.createElement("tr");

    addCell(row, item.full_name);
    addCell(row, item.email);
    addCell(row, formatDate(item.created_at));
    addCell(row, item.status);

    if (isAdmin) {
      const actionCell = document.createElement("td");

      if (item.status === "pending") {
        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "small-action approve";
        approve.textContent = "Setujui";
        approve.addEventListener("click", () =>
          updateRequestStatus(item.id, "approved")
        );

        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "small-action reject";
        reject.textContent = "Tolak";
        reject.addEventListener("click", () =>
          updateRequestStatus(item.id, "rejected")
        );

        actionCell.append(approve, reject);
      } else {
        actionCell.textContent = "Selesai";
      }

      row.appendChild(actionCell);
    }

    requestBody.appendChild(row);
  });

  if (rows.length === 0) {
    showEmptyRow(
      requestBody,
      isAdmin ? 5 : 4,
      "Belum ada pendaftaran KTA."
    );
  }

  const { data: members, error: memberError } =
    await supabaseClient
      .from("member_profiles")
      .select("full_name, membership_id, role")
      .order("created_at", { ascending: false });

  if (memberError) {
    dashboardMessage.textContent =
      "Gagal memuat anggota: " + memberError.message;
    return;
  }

  (members || []).forEach(item => {
    const row = document.createElement("tr");
    addCell(row, item.full_name);
    addCell(row, item.membership_id || "Belum memiliki ID");
    addCell(row, item.role);
    membersBody.appendChild(row);
  });

  if (!members || members.length === 0) {
    showEmptyRow(membersBody, 3, "Belum ada data anggota.");
  }

  dashboardMessage.textContent =
    isAdmin
      ? "Data admin berhasil dimuat."
      : "Data sekretaris berhasil dimuat.";
}

async function updateRequestStatus(id, status) {
  const confirmation = confirm(
    status === "approved"
      ? "Setujui pengajuan KTA ini?"
      : "Tolak pengajuan KTA ini?"
  );

  if (!confirmation) return;

  const buttons = document.querySelectorAll(".small-action");
  buttons.forEach(button => button.disabled = true);

  const { error } = await supabaseClient
    .from("kta_requests")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    alert("Gagal memperbarui status: " + error.message);
  } else {
    alert("Status pengajuan berhasil diperbarui.");
  }

  const { data } = await supabaseClient.auth.getUser();

  if (data.user) {
    await loadManagementData("admin");
  }
}

// LOGIN
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

    const success = await loadMemberProfile(data.user);

    if (success) {
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

// LOGOUT
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
    dashboardMessage.textContent = error.message;
  } finally {
    logoutButton.disabled = false;
  }
});

// PENDAFTARAN KTA
const registrationForm = document.getElementById("ktaRegistrationForm");

registrationForm.addEventListener("submit", async event => {
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
        email,
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
      "\n\nMohon informasi tahapan selanjutnya.";

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

// PERIKSA SESI YANG SUDAH ADA
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
