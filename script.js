"use strict";

/* =========================================
   KAMOJANG ROAD
   FRONTEND APPLICATION
========================================= */

const SUPABASE_URL = "https://nvgpprjwzwqakgjtaukn.supabase.co";
const SUPABASE_KEY = "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";
const WHATSAPP_ADMIN = "6285283234473";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let currentProfile = null;
let currentPage = "home";

let matchesCache = [];
let ordersCache = [];
let membersCache = [];
let applicationsCache = [];
let notificationsCache = [];

let toastTimer = null;

/* =========================================
   UTILITAS
========================================= */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function showMessage(id, message, success = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "#66e6a5" : "#ff8585";
}

function setButtonLoading(button, loading, originalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? "MEMPROSES..." : originalText;
}

function statusLabel(status) {
  const labels = {
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
    reserved: "Reservasi",
    awaiting_verification: "Menunggu verifikasi",
    paid: "Lunas",
    expired: "Kedaluwarsa",
    cancelled: "Dibatalkan",
    distributed: "Sudah dibagikan",
    active: "Aktif"
  };

  return labels[status] || status || "-";
}

function statusClass(status) {
  if (["approved", "paid", "active", "distributed"].includes(status)) {
    return "status-success";
  }

  if (["rejected", "expired", "cancelled"].includes(status)) {
    return "status-rejected";
  }

  return "status-pending";
}

function statusHTML(status) {
  return `
    <span class="status ${statusClass(status)}">
      ${escapeHTML(statusLabel(status))}
    </span>
  `;
}

function setHTML(id, html) {
  const element = $(id);
  if (element) element.innerHTML = html;
}

function getErrorMessage(error) {
  return error?.message || "Terjadi kesalahan. Silakan coba lagi.";
}

function requireProfile() {
  if (!currentUser || !currentProfile) {
    showToast("Silakan login terlebih dahulu.");
    return false;
  }

  return true;
}

function isAdmin() {
  return currentProfile?.role === "admin";
}

function isSecretary() {
  return currentProfile?.role === "secretary";
}

function isStaff() {
  return isAdmin() || isSecretary();
}

/* =========================================
   NAVIGASI HALAMAN
========================================= */

function showView(viewName) {
  const views = document.querySelectorAll(".view");

  views.forEach((view) => {
    view.classList.remove("active");
  });

  const target = $(viewName + "View");

  if (target) {
    target.classList.add("active");
    currentPage = viewName;
  }

  const nav = $("publicNav");
  if (nav) nav.classList.remove("open");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");

  if (viewButton) {
    event.preventDefault();

    const view = viewButton.dataset.view;

    if (view === "login" && currentUser) {
      openDashboard();
      return;
    }

    showView(view);
  }
});

$("menuToggle")?.addEventListener("click", () => {
  $("publicNav")?.classList.toggle("open");
});

function openDashboard() {
  if (!currentProfile) {
    showView("login");
    return;
  }

  if (currentProfile.role === "admin") {
    showView("admin");
    loadAdminDashboard();
  } else if (currentProfile.role === "secretary") {
    showView("secretary");
    loadSecretaryDashboard();
  } else if (currentProfile.role === "member") {
    showView("member");
    loadMemberDashboard();
  } else {
    showToast("Peran akun tidak dikenali.");
    showView("home");
  }
}

/* =========================================
   NAVIGASI DASHBOARD
========================================= */

function activateSubPage(type, page) {
  const pageSelector = `.${type}-page`;
  const buttonSelector = `[data-${type}-page]`;

  document.querySelectorAll(pageSelector).forEach((element) => {
    element.classList.remove("active");
  });

  document.querySelectorAll(buttonSelector).forEach((element) => {
    element.classList.remove("active");
  });

  const target = $(
    type === "member"
      ? "member" + capitalize(page)
      : type === "admin"
        ? "admin" + capitalize(page)
        : "secretary" + capitalize(page)
  );

  if (target) target.classList.add("active");

  const button = document.querySelector(
    `[data-${type}-page="${page}"]`
  );

  if (button) button.classList.add("active");

  if (type === "member") {
    if (page === "matches") loadMemberMatches();
    if (page === "orders") loadMemberOrders();
    if (page === "notifications") loadMemberNotifications();
  }

  if (type === "admin") {
    if (page === "applications") loadAdminApplications();
    if (page === "members") loadAdminMembers();
    if (page === "matches") loadAdminMatches();
    if (page === "orders") loadAdminOrders();
    if (page === "bracelets") loadAdminBracelets();
    if (page === "manual") loadManualMatches();
  }

  if (type === "secretary") {
    if (page === "applications") loadSecretaryApplications();
    if (page === "members") loadSecretaryMembers();
    if (page === "orders") loadSecretaryOrders();
    if (page === "bracelets") loadSecretaryBracelets();
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

document.addEventListener("click", (event) => {
  const memberButton = event.target.closest("[data-member-page]");
  const adminButton = event.target.closest("[data-admin-page]");
  const secretaryButton = event.target.closest("[data-secretary-page]");

  if (memberButton) {
    activateSubPage("member", memberButton.dataset.memberPage);
  }

  if (adminButton && isAdmin()) {
    activateSubPage("admin", adminButton.dataset.adminPage);
  }

  if (secretaryButton && isSecretary()) {
    activateSubPage("secretary", secretaryButton.dataset.secretaryPage);
  }
});

/* =========================================
   LOGIN
========================================= */

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = event.currentTarget.querySelector(
    'button[type="submit"]'
  );

  const originalText = button.textContent;

  setButtonLoading(button, true, originalText);

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;

    await loadCurrentProfile();

    if (!currentProfile) {
      await db.auth.signOut();
      currentUser = null;

      throw new Error(
        "Profil anggota belum tersedia. Hubungi pengurus."
      );
    }

    showMessage("loginMessage", "Login berhasil.", true);

    openDashboard();

    showToast("Selamat datang di KAMOJANG ROAD.");

  } catch (error) {
    showMessage("loginMessage", getErrorMessage(error));
  } finally {
    setButtonLoading(button, false, originalText);
  }
});

/* =========================================
   MEMUAT PROFIL
========================================= */

async function loadCurrentProfile() {
  if (!currentUser) return null;

  const { data, error } = await db
    .from("member_profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) throw error;

  if (!data) {
    throw new Error("Profil akun tidak ditemukan.");
  }

  if (
    data.role === "member" &&
    !data.membership_id
  ) {
    throw new Error(
      "ID KTA belum diterbitkan. Hubungi pengurus."
    );
  }

  currentProfile = data;

  return data;
}

/* =========================================
   PENDAFTARAN KTA
========================================= */

$("ktaForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = event.currentTarget.querySelector(
    'button[type="submit"]'
  );

  const originalText = button.textContent;

  const fullName = $("ktaName").value.trim();
  const email = $("ktaEmail").value.trim().toLowerCase();

  if (fullName.length < 2) {
    showMessage("ktaMessage", "Nama lengkap belum benar.");
    return;
  }

  setButtonLoading(button, true, originalText);

  try {
    const { error } = await db
      .from("kta_requests")
      .insert({
        full_name: fullName,
        email: email,
        user_id: null,
        status: "pending"
      });

    if (error) throw error;

    showMessage(
      "ktaMessage",
      "Pendaftaran berhasil dikirim. Pengurus akan menghubungi kamu.",
      true
    );

    event.currentTarget.reset();

  } catch (error) {
    showMessage("ktaMessage", getErrorMessage(error));
  } finally {
    setButtonLoading(button, false, originalText);
  }
});

/* =========================================
   LOGOUT
========================================= */

async function logout() {
  const { error } = await db.auth.signOut();

  if (error) {
    showToast(getErrorMessage(error));
    return;
  }

  currentUser = null;
  currentProfile = null;

  matchesCache = [];
  ordersCache = [];
  membersCache = [];
  applicationsCache = [];
  notificationsCache = [];

  showView("home");
  showToast("Kamu sudah keluar dari akun.");
}

$("memberLogout")?.addEventListener("click", logout);
$("adminLogout")?.addEventListener("click", logout);
$("secretaryLogout")?.addEventListener("click", logout);

/* =========================================
   SESI LOGIN OTOMATIS
========================================= */

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentUser = null;
    currentProfile = null;
  }

  if (event === "SIGNED_IN" && session?.user) {
    currentUser = session.user;
  }
});

async function restoreSession() {
  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (data.session?.user) {
      currentUser = data.session.user;

      await loadCurrentProfile();

      openDashboard();
    }
  } catch (error) {
    console.error("Pemulihan sesi:", error);
    showView("home");
  }
}

/* =========================================
   DASHBOARD ANGGOTA
========================================= */

async function loadMemberDashboard() {
  if (!requireProfile()) return;

  if (currentProfile.role !== "member") {
    showToast("Akses anggota tidak diizinkan.");
    return;
  }

  const name = currentProfile.full_name || "-";
  const membershipId = currentProfile.membership_id || "-";

  $("memberWelcome").textContent = "DASHBOARD";
  $("memberName").textContent = name;
  $("memberId").textContent = "ID KTA: " + membershipId;

  $("statMemberId").textContent = membershipId;

  $("identityName").textContent = name;
  $("identityEmail").textContent = currentUser.email || "-";
  $("identityId").textContent = membershipId;
  $("identityStatus").textContent = "Aktif";

  $("ktaCardName").textContent = name.toUpperCase();
  $("ktaCardId").textContent = "ID KTA: " + membershipId;

  $("memberOverviewMessage").textContent =
    "Akun anggota kamu telah aktif. Gunakan menu untuk melihat informasi pertandingan dan pesanan.";

  await Promise.all([
    loadMemberOrders(),
    loadMemberNotifications()
  ]);
}

/* =========================================
   DATA PERTANDINGAN ANGGOTA
========================================= */

async function loadMemberMatches() {
  if (!requireProfile()) return;

  setHTML(
    "matchList",
    '<p class="empty-state">Memuat pertandingan...</p>'
  );

  try {
    const { data, error } = await db
      .from("matches")
      .select("*")
      .order("match_date", { ascending: true });

    if (error) throw error;

    matchesCache = data || [];

    const available = matchesCache.filter((match) => {
      return match.sales_open === true;
    });

    if (!available.length) {
      setHTML(
        "matchList",
        '<p class="empty-state">Belum ada pertandingan yang dibuka.</p>'
      );
      return;
    }

    const html = available.map((match) => `
      <article class="content-card">
        <h3>${escapeHTML(match.match_name)}</h3>

        <p>Stadion: ${escapeHTML(match.stadium || "-")}</p>
        <p>Tanggal: ${escapeHTML(formatDate(match.match_date))}</p>
        <p>Harga: ${escapeHTML(formatRupiah(match.ticket_price))}</p>
        <p>Kuota: ${escapeHTML(match.quota ?? "-")}</p>

        <hr>

        <button
          class="btn btn-primary"
          data-reserve-match="${escapeHTML(match.id)}"
        >
          PESAN TIKET
        </button>
      </article>
    `).join("");

    setHTML("matchList", html);

  } catch (error) {
    setHTML(
      "matchList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

/* =========================================
   RESERVASI TIKET
========================================= */

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-reserve-match]");

  if (!button) return;

  if (!requireProfile()) return;

  if (currentProfile.role !== "member") return;

  const matchId = button.dataset.reserveMatch;

  const match = matchesCache.find(
    (item) => String(item.id) === String(matchId)
  );

  if (!match) {
    showToast("Pertandingan tidak ditemukan.");
    return;
  }

  const confirmed = confirm(
    "Reservasi 1 tiket untuk pertandingan ini?"
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "MEMPROSES...";

  try {
    const { data, error } = await db.rpc(
      "kr_reserve_ticket",
      {
        p_match_id: match.id,
        p_quantity: 1
      }
    );

    if (error) throw error;

    showToast(
      "Reservasi berhasil dibuat. Selesaikan pembayaran sesuai instruksi."
    );

    await loadMemberOrders();

    if (data?.expires_at) {
      showToast(
        "Batas reservasi: " + formatDate(data.expires_at)
      );
    }

  } catch (error) {
    showToast(getErrorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = "PESAN TIKET";
  }
});

/* =========================================
   PESANAN ANGGOTA
========================================= */

async function loadMemberOrders() {
  if (!requireProfile()) return;

  try {
    const { data, error } = await db
      .from("ticket_orders")
      .select("*, matches(match_name, stadium, match_date, ticket_price)")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    ordersCache = data || [];

    const activeOrders = ordersCache.filter((order) => {
      return [
        "reserved",
        "awaiting_verification"
      ].includes(order.status);
    });

    $("statActiveOrders").textContent = activeOrders.length;

    if (!ordersCache.length) {
      setHTML(
        "memberOrderList",
        '<p class="empty-state">Belum ada pesanan.</p>'
      );
      return;
    }

    const html = ordersCache.map((order) => {
      const matchName =
        order.matches?.match_name ||
        order.match_name ||
        "Pertandingan";

      const total = order.total_price ??
        (Number(order.quantity || 1) *
         Number(order.matches?.ticket_price || 0));

      let actions = "";

      if (order.status === "reserved") {
        actions = `
          <p class="small-note">
            Segera selesaikan pembayaran sebelum batas reservasi.
          </p>

          <button
            class="btn btn-outline"
            data-cancel-order="${escapeHTML(order.id)}"
          >
            BATALKAN
          </button>

          <button
            class="btn btn-primary"
            data-transfer-order="${escapeHTML(order.id)}"
          >
            SAYA SUDAH TRANSFER
          </button>
        `;
      }

      if (order.status === "awaiting_verification") {
        actions = `
          <p class="small-note">
            Menunggu pemeriksaan pembayaran oleh pengurus.
          </p>
        `;
      }

      return `
        <article class="content-card">
          <h3>${escapeHTML(matchName)}</h3>

          <p>Jumlah: ${escapeHTML(order.quantity)}</p>
          <p>Total: ${escapeHTML(formatRupiah(total))}</p>
          <p>Status: ${statusHTML(order.status)}</p>
          <p>Tanggal: ${escapeHTML(formatDate(order.created_at))}</p>

          ${actions}
        </article>
      `;
    }).join("");

    setHTML("memberOrderList", html);

  } catch (error) {
    setHTML(
      "memberOrderList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

/* =========================================
   BATALKAN RESERVASI
========================================= */

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cancel-order]");

  if (!button) return;

  const orderId = button.dataset.cancelOrder;

  if (!confirm("Batalkan reservasi tiket ini?")) return;

  button.disabled = true;

  try {
    const { error } = await db.rpc(
      "kr_cancel_reservation",
      {
        p_order_id: orderId
      }
    );

    if (error) throw error;

    showToast("Reservasi berhasil dibatalkan.");

    await loadMemberOrders();

  } catch (error) {
    showToast(getErrorMessage(error));
    button.disabled = false;
  }
});

/* =========================================
   KONFIRMASI TRANSFER ANGGOTA
========================================= */

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-transfer-order]");

  if (!button) return;

  const orderId = button.dataset.transferOrder;

  const order = ordersCache.find(
    (item) => String(item.id) === String(orderId)
  );

  if (!order) return;

  const matchName =
    order.matches?.match_name ||
    order.match_name ||
    "Pertandingan";

  const total = order.total_price ??
    (Number(order.quantity || 1) *
     Number(order.matches?.ticket_price || 0));

  const message = [
    "Halo pengurus KAMOJANG ROAD.",
    "",
    "Saya sudah melakukan transfer tiket.",
    "Nama: " + currentProfile.full_name,
    "ID KTA: " + currentProfile.membership_id,
    "Pertandingan: " + matchName,
    "Jumlah: " + order.quantity,
    "Total: " + formatRupiah(total),
    "",
    "Saya akan melampirkan bukti transfer."
  ].join("\n");

  const whatsappURL =
    "https://wa.me/" +
    WHATSAPP_ADMIN +
    "?text=" +
    encodeURIComponent(message);

  window.open(whatsappURL, "_blank", "noopener");

  const confirmed = confirm(
    "Setelah mengirim pesan dan melampirkan bukti transfer di WhatsApp, tekan OK untuk mengirim konfirmasi ke website."
  );

  if (!confirmed) return;

  button.disabled = true;

  try {
    const { error } = await db.rpc(
      "kr_mark_transferred",
      {
        p_order_id: orderId
      }
    );

    if (error) throw error;

    showToast(
      "Konfirmasi terkirim. Pesanan menunggu verifikasi pengurus."
    );

    await loadMemberOrders();

  } catch (error) {
    showToast(getErrorMessage(error));
    button.disabled = false;
  }
});

/* =========================================
   NOTIFIKASI ANGGOTA
========================================= */

async function loadMemberNotifications() {
  if (!requireProfile()) return;

  try {
    const { data, error } = await db
      .from("member_notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    notificationsCache = data || [];

    $("statNotifications").textContent =
      notificationsCache.length;

    if (!notificationsCache.length) {
      setHTML(
        "memberNotificationList",
        '<p class="empty-state">Belum ada notifikasi.</p>'
      );
      return;
    }

    setHTML(
      "memberNotificationList",
      notificationsCache.map((item) => `
        <article class="content-card">
          <h3>${escapeHTML(item.title || "Notifikasi")}</h3>
          <p>${escapeHTML(item.message || "")}</p>
          <p class="small-note">${escapeHTML(formatDate(item.created_at))}</p>
        </article>
      `).join("")
    );

  } catch (error) {
    setHTML(
      "memberNotificationList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

/* =========================================
   DASHBOARD ADMIN
========================================= */

async function loadAdminDashboard() {
  if (!requireProfile() || !isAdmin()) return;

  try {
    const results = await Promise.all([
      db.from("member_profiles").select("*"),
      db.from("ticket_orders").select("*"),
      db.from("kta_requests").select("*")
    ]);

    results.forEach((result) => {
      if (result.error) throw result.error;
    });

    const members = results[0].data || [];
    const orders = results[1].data || [];
    const applications = results[2].data || [];

    $("adminMemberCount").textContent = members.filter(
      (member) => member.role === "member"
    ).length;

    $("adminTicketCount").textContent = orders
      .filter((order) => [
        "paid",
        "reserved",
        "awaiting_verification"
      ].includes(order.status))
      .reduce((sum, order) => sum + Number(order.quantity || 0), 0);

    $("adminPendingCount").textContent = orders.filter(
      (order) => order.status === "awaiting_verification"
    ).length;

    $("adminReservationCount").textContent = orders.filter(
      (order) => order.status === "reserved"
    ).length;

    $("adminSystemStatus").textContent =
      "Data berhasil dimuat. Anggota: " +
      members.length +
      ", pesanan: " +
      orders.length +
      ", pengajuan KTA: " +
      applications.length + ".";

  } catch (error) {
    $("adminSystemStatus").textContent =
      "Gagal memuat monitoring: " + getErrorMessage(error);
  }
}

/* =========================================
   ADMIN: PENGAJUAN KTA
========================================= */

async function loadAdminApplications() {
  if (!requireProfile() || !isAdmin()) return;

  setHTML(
    "adminApplicationList",
    '<p class="empty-state">Memuat pengajuan...</p>'
  );

  try {
    const { data, error } = await db
      .from("kta_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    applicationsCache = data || [];

    if (!applicationsCache.length) {
      setHTML(
        "adminApplicationList",
        '<p class="empty-state">Belum ada pengajuan KTA.</p>'
      );
      return;
    }

    setHTML(
      "adminApplicationList",
      applicationsCache.map((item) => `
        <article class="content-card">
          <h3>${escapeHTML(item.full_name)}</h3>

          <p>Email: ${escapeHTML(item.email || "-")}</p>
          <p>Status: ${statusHTML(item.status)}</p>
          <p>Tanggal: ${escapeHTML(formatDate(item.created_at))}</p>

          ${
            item.status === "pending"
              ? `
                <button
                  class="btn btn-primary"
                  data-kta-approve="${escapeHTML(item.id)}"
                >
                  SETUJUI
                </button>

                <button
                  class="btn btn-outline"
                  data-kta-reject="${escapeHTML(item.id)}"
                >
                  TOLAK
                </button>
              `
              : ""
          }
        </article>
      `).join("")
    );

  } catch (error) {
    setHTML(
      "adminApplicationList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

/* =========================================
   ADMIN: SETUJUI / TOLAK KTA
========================================= */

async function updateKTAStatus(id, status) {
  if (!requireProfile() || !isAdmin()) return;

  try {
    const { error } = await db
      .from("kta_requests")
      .update({ status })
      .eq("id", id)
      .eq("status", "pending");

    if (error) throw error;

    showToast("Status pengajuan KTA diperbarui.");

    await loadAdminApplications();

  } catch (error) {
    showToast(getErrorMessage(error));
  }
}

document.addEventListener("click", async (event) => {
  const approve = event.target.closest("[data-kta-approve]");
  const reject = event.target.closest("[data-kta-reject]");

  if (approve) {
    if (!confirm("Setujui pengajuan ini?")) return;

    await updateKTAStatus(
      approve.dataset.ktaApprove,
      "approved"
    );
  }

  if (reject) {
    if (!confirm("Tolak pengajuan ini?")) return;

    await updateKTAStatus(
      reject.dataset.ktaReject,
      "rejected"
    );
  }
});

/* =========================================
   ADMIN: DATA ANGGOTA
========================================= */

async function loadAdminMembers() {
  if (!requireProfile() || !isAdmin()) return;

  try {
    const { data, error } = await db
      .from("member_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    membersCache = (data || []).filter(
      (member) => member.role === "member"
    );

    if (!membersCache.length) {
      setHTML(
        "adminMemberList",
        '<p class="empty-state">Belum ada anggota.</p>'
      );
      return;
    }

    setHTML(
      "adminMemberList",
      membersCache.map((member) => `
        <article class="content-card">
          <h3>${escapeHTML(member.full_name)}</h3>
          <p>ID KTA: ${escapeHTML(member.membership_id || "-")}</p>
          <p>Terdaftar: ${escapeHTML(formatDate(member.created_at))}</p>
        </article>
      `).join("")
    );

  } catch (error) {
    setHTML(
      "adminMemberList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

/* =========================================
   ADMIN: KELOLA PERTANDINGAN
========================================= */

$("matchForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireProfile() || !isAdmin()) return;

  const button = event.currentTarget.querySelector(
    'button[type="submit"]'
  );

  const originalText = button.textContent;

  const payload = {
    p_match_id: $("matchId").value || null,
    p_match_name: $("matchName").value.trim(),
    p_stadium: $("matchStadium").value.trim(),
    p_match_date: $("matchDate").value,
    p_ticket_price: Number($("matchPrice").value),
    p_quota: Number($("matchQuota").value),
    p_sales_open: $("matchSalesOpen").checked
  };

  setButtonLoading(button, true, originalText);

  try {
    const { error } = await db.rpc(
      "kr_save_match",
      payload
    );

    if (error) throw error;

    showMessage(
      "matchMessage",
      "Data pertandingan berhasil disimpan.",
      true
    );

    event.currentTarget.reset();
    $("matchId").value = "";

    await loadAdminMatches();

  } catch (error) {
    showMessage("matchMessage", getErrorMessage(error));
  } finally {
    setButtonLoading(button, false, originalText);
  }
});

$("matchFormReset")?.addEventListener("click", () => {
  $("matchForm")?.reset();
  $("matchId").value = "";
});

async function loadAdminMatches() {
  if (!requireProfile() || !isAdmin()) return;

  try {
    const { data, error } = await db
      .from("matches")
      .select("*")
      .order("match_date", { ascending: true });

    if (error) throw error;

    matchesCache = data || [];

    if (!matchesCache.length) {
      setHTML(
        "adminMatchList",
        '<p class="empty-state">Belum ada pertandingan.</p>'
      );
      return;
    }

    setHTML(
      "adminMatchList",
      matchesCache.map((match) => `
        <article class="content-card">
          <h3>${escapeHTML(match.match_name)}</h3>

          <p>Stadion: ${escapeHTML(match.stadium || "-")}</p>
          <p>Tanggal: ${escapeHTML(formatDate(match.match_date))}</p>
          <p>Harga: ${escapeHTML(formatRupiah(match.ticket_price))}</p>
          <p>Kuota: ${escapeHTML(match.quota)}</p>
          <p>Penjualan: ${match.sales_open ? "Dibuka" : "Ditutup"}</p>

          <button
            class="btn btn-outline"
            data-edit-match="${escapeHTML(match.id)}"
          >
            EDIT
          </button>
        </article>
      `).join("")
    );

  } catch (error) {
    setHTML(
      "adminMatchList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-match]");

  if (!button || !isAdmin()) return;

  const match = matchesCache.find(
    (item) => String(item.id) === String(button.dataset.editMatch)
  );

  if (!match) return;

  $("matchId").value = match.id;
  $("matchName").value = match.match_name || "";
  $("matchStadium").value = match.stadium || "";
  $("matchDate").value = match.match_date
    ? new Date(match.match_date).toISOString().slice(0, 16)
    : "";

  $("matchPrice").value = match.ticket_price ?? 0;
  $("matchQuota").value = match.quota ?? 0;
  $("matchSalesOpen").checked = match.sales_open === true;

  $("matchForm").scrollIntoView({
    behavior: "smooth"
  });
});

/* =========================================
   ADMIN: PESANAN & PEMBAYARAN
========================================= */

async function loadAdminOrders() {
  if (!requireProfile() || !isAdmin()) return;

  try {
    const { data, error } = await db
      .from("ticket_orders")
      .select("*, matches(match_name, match_date, ticket_price)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    ordersCache = data || [];

    if (!ordersCache.length) {
      setHTML(
        "adminOrderList",
        '<p class="empty-state">Belum ada pesanan.</p>'
      );
      return;
    }

    setHTML(
      "adminOrderList",
      ordersCache.map((order) => `
        <article class="content-card">
          <h3>${escapeHTML(order.buyer_name || "Anggota")}</h3>

          <p>Pertandingan: ${
            escapeHTML(
              order.matches?.match_name ||
              order.match_name ||
              "-"
            )
          }</p>

          <p>Jumlah: ${escapeHTML(order.quantity)}</p>

          <p>Total: ${escapeHTML(
            formatRupiah(order.total_price)
          )}</p>

          <p>Status: ${statusHTML(order.status)}</p>

          ${
            order.status === "awaiting_verification"
              ? `
                <button
                  class="btn btn-primary"
                  data-verify-order="${escapeHTML(order.id)}"
                >
                  SETUJUI PEMBAYARAN
                </button>

                <button
                  class="btn btn-outline"
                  data-reject-order="${escapeHTML(order.id)}"
                >
                  TOLAK PEMBAYARAN
                </button>
              `
              : ""
          }
        </article>
      `).join("")
    );

  } catch (error) {
    setHTML(
      "adminOrderList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

/* =========================================
   ADMIN: VERIFIKASI PEMBAYARAN
========================================= */

async function verifyOrder(orderId, approved) {
  if (!requireProfile() || !isAdmin()) return;

  try {
    const { error } = await db.rpc(
      "kr_verify_ticket_payment",
      {
        p_order_id: orderId,
        p_approved: approved
      }
    );

    if (error) throw error;

    showToast(
      approved
        ? "Pembayaran berhasil disetujui."
        : "Pembayaran ditolak."
    );

    await Promise.all([
      loadAdminOrders(),
      loadAdminDashboard()
    ]);

  } catch (error) {
    showToast(getErrorMessage(error));
  }
}

document.addEventListener("click", async (event) => {
  const verify = event.target.closest("[data-verify-order]");
  const reject = event.target.closest("[data-reject-order]");

  if (verify) {
    if (!confirm("Setujui pembayaran ini?")) return;

    await verifyOrder(
      verify.dataset.verifyOrder,
      true
    );
  }

  if (reject) {
    if (!confirm("Tolak pembayaran ini?")) return;

    await verifyOrder(
      reject.dataset.rejectOrder,
      false
    );
  }
});

/* =========================================
   ADMIN: DISTRIBUSI GELANG
========================================= */

async function loadAdminBracelets() {
  if (!requireProfile() || !isAdmin()) return;

  try {
    const { data, error } = await db
      .from("ticket_orders")
      .select("*, matches(match_name)")
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const orders = data || [];

    if (!orders.length) {
      setHTML(
        "adminBraceletList",
        '<p class="empty-state">Belum ada tiket lunas.</p>'
      );
      return;
    }

    setHTML(
      "adminBraceletList",
      orders.map((order) => `
        <article class="content-card">
          <h3>${escapeHTML(order.buyer_name || "Anggota")}</h3>

          <p>Pertandingan: ${
            escapeHTML(order.matches?.match_name || "-")
          }</p>

          <p>Status gelang: ${
            statusHTML(order.bracelet_status || "pending")
          }</p>

          ${
            order.bracelet_status !== "distributed"
              ? `
                <button
                  class="btn btn-primary"
                  data-give-bracelet="${escapeHTML(order.id)}"
                >
                  TANDAI SUDAH DIBAGIKAN
                </button>
              `
              : ""
          }
        </article>
      `).join("")
    );

  } catch (error) {
    setHTML(
      "adminBraceletList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-give-bracelet]");

  if (!button || !isAdmin()) return;

  if (!confirm("Tandai gelang sudah diserahkan?")) return;

  button.disabled = true;

  try {
    const { error } = await db.rpc(
      "kr_give_bracelet",
      {
        p_order_id: button.dataset.giveBracelet
      }
    );

    if (error) throw error;

    showToast("Distribusi gelang berhasil dicatat.");

    await loadAdminBracelets();

  } catch (error) {
    showToast(getErrorMessage(error));
    button.disabled = false;
  }
});

/* =========================================
   ADMIN: PEMBELIAN LANGSUNG
========================================= */

async function loadManualMatches() {
  if (!requireProfile() || !isAdmin()) return;

  try {
    const { data, error } = await db
      .from("matches")
      .select("*")
      .eq("sales_open", true)
      .order("match_date", { ascending: true });

    if (error) throw error;

    const select = $("manualMatch");

    if (!select) return;

    if (!data?.length) {
      select.innerHTML =
        '<option value="">Tidak ada pertandingan aktif</option>';
      return;
    }

    select.innerHTML = `
      <option value="">Pilih pertandingan</option>
      ${data.map((match) => `
        <option value="${escapeHTML(match.id)}">
          ${escapeHTML(match.match_name)}
        </option>
      `).join("")}
    `;

  } catch (error) {
    showMessage("manualOrderMessage", getErrorMessage(error));
  }
}

$("manualOrderForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireProfile() || !isAdmin()) return;

  const button = event.currentTarget.querySelector(
    'button[type="submit"]'
  );

  const originalText = button.textContent;

  const payload = {
    p_buyer_name: $("manualBuyerName").value.trim(),
    p_match_id: $("manualMatch").value,
    p_quantity: Number($("manualQuantity").value),
    p_paid: $("manualPaid").checked
  };

  if (!payload.p_match_id) {
    showMessage("manualOrderMessage", "Pilih pertandingan terlebih dahulu.");
    return;
  }

  setButtonLoading(button, true, originalText);

  try {
    const { error } = await db.rpc(
      "kr_manual_ticket_order",
      payload
    );

    if (error) throw error;

    showMessage(
      "manualOrderMessage",
      "Pembelian langsung berhasil dicatat.",
      true
    );

    event.currentTarget.reset();

    await loadAdminDashboard();

  } catch (error) {
    showMessage(
      "manualOrderMessage",
      getErrorMessage(error)
    );
  } finally {
    setButtonLoading(button, false, originalText);
  }
});

/* =========================================
   DASHBOARD SEKRETARIS
   HANYA MEMBACA DATA
========================================= */

async function loadSecretaryDashboard() {
  if (!requireProfile() || !isSecretary()) return;

  const message = $("secretaryOverview");

  if (message) {
    const paragraph = message.querySelector(".content-card p");

    if (paragraph) {
      paragraph.textContent =
        "Akses baca saja aktif. Perubahan data hanya dapat dilakukan admin.";
    }
  }

  await Promise.all([
    loadSecretaryApplications(),
    loadSecretaryMembers(),
    loadSecretaryOrders(),
    loadSecretaryBracelets()
  ]);
}

async function loadSecretaryApplications() {
  if (!requireProfile() || !isSecretary()) return;

  try {
    const { data, error } = await db
      .from("kta_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setHTML(
      "secretaryApplicationList",
      data?.length
        ? data.map((item) => `
            <article class="content-card">
              <h3>${escapeHTML(item.full_name)}</h3>
              <p>Email: ${escapeHTML(item.email || "-")}</p>
              <p>Status: ${statusHTML(item.status)}</p>
              <p>Tanggal: ${escapeHTML(formatDate(item.created_at))}</p>
            </article>
          `).join("")
        : '<p class="empty-state">Belum ada pengajuan.</p>'
    );

  } catch (error) {
    setHTML(
      "secretaryApplicationList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

async function loadSecretaryMembers() {
  if (!requireProfile() || !isSecretary()) return;

  try {
    const { data, error } = await db
      .from("member_profiles")
      .select("*")
      .eq("role", "member")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setHTML(
      "secretaryMemberList",
      data?.length
        ? data.map((member) => `
            <article class="content-card">
              <h3>${escapeHTML(member.full_name)}</h3>
              <p>ID KTA: ${escapeHTML(member.membership_id || "-")}</p>
              <p>Terdaftar: ${escapeHTML(formatDate(member.created_at))}</p>
            </article>
          `).join("")
        : '<p class="empty-state">Belum ada anggota.</p>'
    );

  } catch (error) {
    setHTML(
      "secretaryMemberList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

async function loadSecretaryOrders() {
  if (!requireProfile() || !isSecretary()) return;

  try {
    const { data, error } = await db
      .from("ticket_orders")
      .select("*, matches(match_name)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setHTML(
      "secretaryOrderList",
      data?.length
        ? data.map((order) => `
            <article class="content-card">
              <h3>${escapeHTML(order.buyer_name || "Anggota")}</h3>
              <p>Pertandingan: ${
                escapeHTML(order.matches?.match_name || "-")
              }</p>
              <p>Jumlah: ${escapeHTML(order.quantity)}</p>
              <p>Status: ${statusHTML(order.status)}</p>
            </article>
          `).join("")
        : '<p class="empty-state">Belum ada pesanan.</p>'
    );

  } catch (error) {
    setHTML(
      "secretaryOrderList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

async function loadSecretaryBracelets() {
  if (!requireProfile() || !isSecretary()) return;

  try {
    const { data, error } = await db
      .from("ticket_orders")
      .select("*, matches(match_name)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setHTML(
      "secretaryBraceletList",
      data?.length
        ? data.map((order) => `
            <article class="content-card">
              <h3>${escapeHTML(order.buyer_name || "Anggota")}</h3>
              <p>Pertandingan: ${
                escapeHTML(order.matches?.match_name || "-")
              }</p>
              <p>Status gelang: ${
                statusHTML(order.bracelet_status || "pending")
              }</p>
            </article>
          `).join("")
        : '<p class="empty-state">Belum ada data gelang.</p>'
    );

  } catch (error) {
    setHTML(
      "secretaryBraceletList",
      `<p class="empty-state">${escapeHTML(getErrorMessage(error))}</p>`
    );
  }
}

/* =========================================
   TAHUN FOOTER
========================================= */

if ($("currentYear")) {
  $("currentYear").textContent = new Date().getFullYear();
}

/* =========================================
   PEMUATAN AWAL
========================================= */

async function initializeApp() {
  await restoreSession();
}

initializeApp();