const SUPABASE_URL = "https://nvgpprjwzwqakgjtaukn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

function showMessage(id, message, success = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = success ? "#66d98a" : "#f47721";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function statusLabel(status) {
  const labels = {
    pending: "Menunggu persetujuan",
    approved: "Disetujui",
    rejected: "Ditolak",
    processing: "Diproses",
    completed: "Selesai"
  };
  return labels[status] || status || "Belum diketahui";
}

function isPendingTicket(status) {
  return status === "pending" || status === "processing";
}

// TAMPILAN HALAMAN
function showPublicPage() {
  $("memberPage").classList.add("hidden");
  $("adminPage").classList.add("hidden");

  document.querySelectorAll(".hero, .section").forEach((el) => {
    el.classList.remove("hidden");
  });
}

function showDashboard(role) {
  document.querySelectorAll(".hero, .section").forEach((el) => {
    el.classList.add("hidden");
  });

  $("memberPage").classList.add("hidden");
  $("adminPage").classList.add("hidden");

  if (role === "admin") {
    $("adminPage").classList.remove("hidden");
    loadAdminDashboard();
  } else if (role === "member") {
    $("memberPage").classList.remove("hidden");
    loadMemberDashboard();
  } else {
    alert("Jenis akun tidak dikenali. Hubungi pengurus.");
    showPublicPage();
    return;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// PROFIL ANGGOTA
async function getProfile(userId) {
  const { data, error } = await db
    .from("member_profiles")
    .select("id, full_name, role, membership_id")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

// MENU HP
$("menuToggle").addEventListener("click", () => {
  $("nav").classList.toggle("open");
});

document.querySelectorAll("#nav a").forEach((link) => {
  link.addEventListener("click", () => {
    $("nav").classList.remove("open");
  });
});

// MENU DASHBOARD ADMIN
document.querySelectorAll(".admin-menu-button").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.adminPanel;
    const targetPanel = $(targetId);

    if (!targetPanel) return;

    document.querySelectorAll(".admin-panel").forEach((panel) => {
      panel.classList.add("hidden");
    });

    document.querySelectorAll(".admin-menu-button").forEach((item) => {
      item.classList.remove("active");
    });

    targetPanel.classList.remove("hidden");
    button.classList.add("active");

    if (targetId === "eventPanel") loadAdminEvents();
    if (targetId === "historyMatchPanel") loadAdminMatchHistory();
    if (targetId === "ktaPanel") loadAdminKta();
    if (targetId === "memberPanel") loadAdminMembers();
    if (targetId === "ticketPanel") loadAdminTickets();
    if (targetId === "ticketHistoryPanel") loadAdminTicketHistory();
    if (targetId === "paymentSettingsPanel") loadAdminPaymentSettings();

    targetPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

// PENDAFTARAN KTA SEKALIGUS PEMBUATAN AKUN
$("ktaForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("ktaName").value.trim();
  const email = $("ktaEmail").value.trim();
  const phone = $("ktaPhone").value.trim();

  const passwordInput =
    $("ktaPassword") ||
    $("ktaForm").querySelector('input[type="password"]');

  const password = passwordInput?.value || "";
  const button = event.submitter || $("ktaForm").querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (!name || !email || !phone || !password) {
    showMessage(
      "ktaMessage",
      "Nama, email, WhatsApp, dan password wajib diisi."
    );
    return;
  }

  if (password.length < 6) {
    showMessage(
      "ktaMessage",
      "Password minimal 6 karakter."
    );
    return;
  }

  if (!button) {
    showMessage("ktaMessage", "Tombol pendaftaran tidak ditemukan.");
    return;
  }

  button.disabled = true;
  button.textContent = "MEMBUAT AKUN...";

  try {
    const { data, error } = await db.functions.invoke(
      "manage-kta-v2",
      {
        body: {
          action: "register",
          fullName: name,
          email,
          phone,
          password
        }
      }
    );

    if (error) {
      let message = error.message || "Pendaftaran gagal.";

      try {
        const details = await error.context.json();
        if (details?.error) message = details.error;
      } catch (_) {}

      throw new Error(message);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    showMessage(
      "ktaMessage",
      "Pendaftaran dan pembuatan akun berhasil. Silakan lanjut mengirim dokumen melalui WhatsApp. Akun menunggu persetujuan Admin.",
      true
    );

    const text = [
      "PENDAFTARAN KTA KAMOJANG ROAD",
      "",
      "Nama: " + name,
      "Email: " + email,
      "WhatsApp: " + phone,
      "",
      "Saya sudah mengisi formulir pendaftaran KTA melalui website.",
      "Saya akan mengirim foto KTP dan pas foto kepada pengurus untuk verifikasi.",
      "",
      "Mohon dilakukan pemeriksaan dan persetujuan pengajuan KTA saya."
    ].join("\n");

    window.open(
      "https://wa.me/6285283234473?text=" + encodeURIComponent(text),
      "_blank"
    );

    $("ktaForm").reset();
  } catch (error) {
    showMessage(
      "ktaMessage",
      "Pendaftaran gagal: " + error.message
    );
  } finally {
    button.disabled = false;
    button.textContent = "KIRIM PENDAFTARAN";
  }
});

// LOGIN ADMIN DAN ANGGOTA
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const button = event.submitter;

  button.disabled = true;
  button.textContent = "MEMERIKSA...";

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const profile = await getProfile(data.user.id);

    if (!["admin", "member"].includes(profile.role)) {
      throw new Error("Role akun tidak memiliki akses.");
    }

    $("loginForm").reset();
    showDashboard(profile.role);
  } catch (error) {
    await db.auth.signOut();
    showMessage("loginMessage", "Login gagal: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "MASUK";
  }
});

// LUPA KATA SANDI
$("resetPasswordButton").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();

  if (!email) {
    showMessage("loginMessage", "Masukkan email terlebih dahulu.");
    return;
  }

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  if (error) {
    showMessage("loginMessage", error.message);
  } else {
    showMessage(
      "loginMessage",
      "Permintaan reset dikirim. Periksa email.",
      true
    );
  }
});

// PANGGIL EDGE FUNCTION manage-kta-v2 UNTUK ADMIN
async function callManageKta(payload) {
  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();

  if (sessionError) {
    throw new Error("Gagal mengambil sesi login: " + sessionError.message);
  }

  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "Sesi login tidak ditemukan. Silakan logout lalu login kembali."
    );
  }

  const { data, error } = await db.functions.invoke("manage-kta-v2", {
    body: payload,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (error) {
    let message = error.message || "Edge Function gagal dijalankan.";

    try {
      const details = await error.context.json();
      if (details?.error) message = details.error;
    } catch (_) {}

    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

// PENANGANAN KLIK PERSETUJUAN KTA
$("adminKtaList").addEventListener("click", async (event) => {
  const button = event.target.closest(".approve-kta-button");

  if (!button) return;

  const requestId = button.dataset.requestId;

  if (!requestId) {
    alert("ID pengajuan KTA tidak ditemukan.");
    return;
  }

  const confirmed = confirm(
    "Setujui pengajuan ini? Sistem akan membuat profil anggota dan ID KTA untuk akun yang sudah dibuat saat pendaftaran."
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "MEMPROSES...";

  try {
    const result = await callManageKta({
      action: "approve",
      requestId: requestId
    });

    alert(
      "Pengajuan KTA berhasil disetujui.\nID KTA: " +
      (result.membershipId || "Sudah tersedia") +
      "\nAkun anggota sekarang dapat digunakan untuk login."
    );

    await Promise.all([
      loadAdminKta(),
      loadAdminMembers()
    ]);
  } catch (error) {
    alert("Gagal menyetujui KTA: " + error.message);
    button.disabled = false;
    button.textContent = "SETUJUI KTA & AKTIFKAN ANGGOTA";
  }
});

// AMBIL PERTANDINGAN AKTIF
async function getActiveMatch() {
  const { data, error } = await db
    .from("match_events")
    .select("id, home_team, away_team, match_date, stadium")
    .eq("is_active", true)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// INFORMASI PEMBAYARAN UNTUK ANGGOTA
async function loadMemberPaymentInfo(profile, activeOrders) {
  const container = $("memberPaymentInfo");
  if (!container) return;

  if (!activeOrders.length) {
    container.textContent =
      "Informasi rekening akan muncul jika kamu memiliki pesanan tiket aktif.";
    return;
  }

  container.textContent = "Memuat informasi rekening...";

  try {
    const { data, error } = await db
      .from("payment_settings")
      .select("bank_name, account_number, account_holder")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    if (
      !data ||
      !data.bank_name ||
      !data.account_number ||
      !data.account_holder
    ) {
      container.textContent = "Rekening belum diatur oleh Admin.";
      return;
    }

    container.innerHTML = activeOrders.map((order) => {
      const message = [
        "Halo Admin KAMOJANG ROAD, saya ingin mengirim bukti pembayaran tiket.",
        "",
        "Nama Anggota: " + (profile.full_name || "-"),
        "ID KTA: " + (profile.membership_id || "-"),
        "Pertandingan: " + (order.match_name || "-"),
        "Jumlah Tiket: " + (order.quantity || 1),
        "",
        "Bank: " + data.bank_name,
        "Nomor Rekening: " + data.account_number,
        "Atas Nama: " + data.account_holder,
        "",
        "Saya akan melampirkan bukti transfer pada chat ini."
      ].join("\n");

      const whatsappUrl =
        "https://wa.me/6285283234473?text=" +
        encodeURIComponent(message);

      return `
        <div class="data-item">
          <strong>${escapeHTML(order.match_name)}</strong>
          <p>Bank: ${escapeHTML(data.bank_name)}</p>
          <p>Nomor rekening: <strong>${escapeHTML(data.account_number)}</strong></p>
          <p>Atas nama: ${escapeHTML(data.account_holder)}</p>
          <p>Jumlah tiket: ${escapeHTML(order.quantity)}</p>
          <a
            class="btn btn-orange full"
            href="${escapeHTML(whatsappUrl)}"
            target="_blank"
            rel="noopener">
            KIRIM BUKTI PEMBAYARAN VIA WHATSAPP
          </a>
          <p class="muted">
            Setelah WhatsApp terbuka, lampirkan foto bukti transfer secara manual.
          </p>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Gagal memuat rekening:", error);
    container.textContent =
      "Gagal memuat informasi rekening. Silakan coba muat ulang halaman.";
  }
}

// DASHBOARD ANGGOTA
async function loadMemberDashboard() {
  const { data: sessionData } = await db.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) return;

  $("activeMatchInfo").textContent = "Memuat informasi pertandingan...";
  $("memberOrders").textContent = "Memuat pesanan...";
  $("memberOrderHistory").textContent = "Memuat riwayat pesanan...";
  $("ticketSubmitButton").disabled = true;

  try {
    const profile = await getProfile(user.id);

    $("memberName").textContent = profile.full_name || "-";
    $("memberId").textContent =
      profile.membership_id || "Belum tersedia";

    const activeMatch = await getActiveMatch();

    if (activeMatch) {
      $("activeMatchInfo").innerHTML = `
        <div class="data-item">
          <strong>
            ${escapeHTML(activeMatch.home_team)}
            vs
            ${escapeHTML(activeMatch.away_team)}
          </strong>
          <p>Tanggal: ${escapeHTML(formatDate(activeMatch.match_date))}</p>
          <p>Stadion: ${escapeHTML(activeMatch.stadium)}</p>
        </div>
      `;

      $("ticketSubmitButton").disabled = false;
    } else {
      $("activeMatchInfo").textContent =
        "Belum ada penjualan tiket pertandingan yang dibuka.";
    }

    const { data: orders, error: orderError } = await db
      .from("ticket_requests")
      .select("id, event_id, match_name, quantity, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (orderError) throw orderError;

    const allOrders = orders || [];

    const activeOrders = allOrders.filter((order) => {
      return (
        activeMatch &&
        String(order.event_id) === String(activeMatch.id) &&
        isPendingTicket(order.status)
      );
    });

    const historyOrders = allOrders.filter((order) => {
      return !activeOrders.some(
        (activeOrder) => activeOrder.id === order.id
      );
    });

    $("memberOrders").innerHTML = activeOrders.length
      ? activeOrders.map((order) => `
          <div class="data-item">
            <strong>${escapeHTML(order.match_name)}</strong>
            <p>${escapeHTML(order.quantity)} tiket pertandingan</p>
            <p>Status: ${escapeHTML(statusLabel(order.status))}</p>
            <p>Tanggal pesan: ${escapeHTML(formatDateTime(order.created_at))}</p>
          </div>
        `).join("")
      : "Belum ada pesanan aktif untuk pertandingan yang sedang dibuka.";

    $("memberOrderHistory").innerHTML = historyOrders.length
      ? historyOrders.map((order) => `
          <div class="data-item">
            <strong>${escapeHTML(order.match_name)}</strong>
            <p>${escapeHTML(order.quantity)} tiket pertandingan</p>
            <p>Status: ${escapeHTML(statusLabel(order.status))}</p>
            <p>Tanggal pesan: ${escapeHTML(formatDateTime(order.created_at))}</p>
          </div>
        `).join("")
      : "Belum ada riwayat pesanan tiket.";

    await loadMemberPaymentInfo(profile, activeOrders);
  } catch (error) {
    $("activeMatchInfo").textContent =
      "Gagal memuat pertandingan: " + error.message;

    $("memberOrders").textContent =
      "Gagal memuat pesanan: " + error.message;

    $("memberOrderHistory").textContent =
      "Gagal memuat riwayat: " + error.message;

    $("memberPaymentInfo").textContent =
      "Informasi pembayaran tidak dapat dimuat.";
  }
}

// PEMESANAN SATU TIKET PER ANGGOTA PER PERTANDINGAN
$("ticketForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("ticketSubmitButton");

  button.disabled = true;
  button.textContent = "MENGIRIM...";

  try {
    const { data: sessionData } = await db.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) throw new Error("Silakan login kembali.");

    const activeMatch = await getActiveMatch();

    if (!activeMatch) {
      throw new Error("Penjualan tiket sedang ditutup.");
    }

    const matchName =
      activeMatch.home_team + " vs " + activeMatch.away_team;

    const { error } = await db.from("ticket_requests").insert({
      user_id: user.id,
      event_id: activeMatch.id,
      match_name: matchName,
      quantity: 1,
      status: "pending"
    });

    if (error?.code === "23505") {
      throw new Error(
        "KTA ini sudah digunakan untuk memesan tiket pertandingan tersebut."
      );
    }

    if (error) throw error;

    showMessage(
      "ticketMessage",
      "Permintaan satu tiket berhasil dikirim. Menunggu persetujuan Admin.",
      true
    );

    await loadMemberDashboard();
  } catch (error) {
    showMessage("ticketMessage", "Pemesanan gagal: " + error.message);
  } finally {
    button.textContent = "AJUKAN PEMESANAN";

    try {
      button.disabled = !(await getActiveMatch());
    } catch (_) {
      button.disabled = true;
    }
  }
});
// SIMPAN PERTANDINGAN DARI ADMIN
$("eventForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("eventSubmitButton");

  const home = $("eventHome").value.trim();
  const away = $("eventAway").value.trim();
  const date = $("eventDate").value;
  const stadium = $("eventStadium").value.trim();

  if (!home || !away || !date || !stadium) {
    showMessage(
      "eventMessage",
      "Lengkapi semua informasi pertandingan."
    );
    return;
  }

  button.disabled = true;
  button.textContent = "MENYIMPAN...";

  try {
    const { error: archiveError } = await db
      .from("match_events")
      .update({
        is_active: false,
        is_archived: true
      })
      .eq("is_active", true);

    if (archiveError) throw archiveError;

    const { error: insertError } = await db
      .from("match_events")
      .insert({
        home_team: home,
        away_team: away,
        match_date: date,
        stadium,
        is_active: true,
        is_archived: false
      });

    if (insertError) throw insertError;

    showMessage(
      "eventMessage",
      "Pertandingan aktif berhasil disimpan. Pertandingan aktif sebelumnya masuk riwayat.",
      true
    );

    $("eventForm").reset();
    $("eventHome").value = "Persija Jakarta";

    await loadAdminEvents();
  } catch (error) {
    showMessage(
      "eventMessage",
      "Gagal menyimpan pertandingan: " + error.message
    );
  } finally {
    button.disabled = false;
    button.textContent = "SIMPAN PERTANDINGAN AKTIF";
  }
});

// DAFTAR PERTANDINGAN AKTIF / BELUM DIARSIPKAN
async function loadAdminEvents() {
  const { data, error } = await db
    .from("match_events")
    .select("id, home_team, away_team, match_date, stadium, is_active, is_archived, created_at")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    $("adminEventList").textContent =
      "Gagal memuat pertandingan: " + error.message;
    return;
  }

  $("adminEventList").innerHTML = data.length
    ? data.map((item) => `
        <div class="data-item">
          <strong>
            ${escapeHTML(item.home_team)}
            vs
            ${escapeHTML(item.away_team)}
          </strong>
          <p>Tanggal: ${escapeHTML(formatDate(item.match_date))}</p>
          <p>Stadion: ${escapeHTML(item.stadium)}</p>
          <p class="${item.is_active ? "status-open" : "status-closed"}">
            ${item.is_active ? "PENJUALAN TIKET DIBUKA" : "PENJUALAN DITUTUP"}
          </p>
          ${item.is_active
            ? `
              <button
                class="btn btn-danger close-sales-button"
                data-event-id="${escapeHTML(item.id)}"
                type="button">
                TUTUP PENJUALAN & PINDAHKAN KE RIWAYAT
              </button>
            `
            : `
              <button
                class="btn btn-danger archive-event-button"
                data-event-id="${escapeHTML(item.id)}"
                type="button">
                PINDAHKAN KE RIWAYAT
              </button>
            `
          }
        </div>
      `).join("")
    : "Tidak ada pertandingan aktif atau pertandingan yang belum diarsipkan.";

  document.querySelectorAll(
    ".close-sales-button, .archive-event-button"
  ).forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = confirm(
        "Pindahkan pertandingan ini ke Riwayat Pertandingan? Semua pesanan tiket tetap tersimpan."
      );

      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "MEMINDAHKAN...";

      try {
        const { error: updateError } = await db
          .from("match_events")
          .update({
            is_active: false,
            is_archived: true
          })
          .eq("id", button.dataset.eventId);

        if (updateError) throw updateError;

        alert("Pertandingan berhasil dipindahkan ke riwayat.");
        await loadAdminEvents();
        await loadAdminMatchHistory();
      } catch (error) {
        alert("Gagal memindahkan pertandingan: " + error.message);
        button.disabled = false;
        button.textContent = "PINDAHKAN KE RIWAYAT";
      }
    });
  });
}

// RIWAYAT PERTANDINGAN ADMIN
async function loadAdminMatchHistory() {
  const list = $("adminMatchHistoryList");

  const { data, error } = await db
    .from("match_events")
    .select("id, home_team, away_team, match_date, stadium, is_active, is_archived, created_at")
    .eq("is_archived", true)
    .order("match_date", { ascending: false });

  if (error) {
    list.textContent =
      "Gagal memuat riwayat pertandingan: " + error.message;
    return;
  }

  list.innerHTML = data.length
    ? data.map((item) => `
        <details class="compact-record">
          <summary class="compact-record-summary">
            <span class="compact-record-title">
              ${escapeHTML(item.home_team)} vs ${escapeHTML(item.away_team)}
            </span>
            <span class="compact-record-meta">
              ${escapeHTML(formatDate(item.match_date))}
            </span>
          </summary>

          <div class="compact-record-body">
            <p><strong>Pertandingan:</strong> ${escapeHTML(item.home_team)} vs ${escapeHTML(item.away_team)}</p>
            <p><strong>Tanggal:</strong> ${escapeHTML(formatDate(item.match_date))}</p>
            <p><strong>Stadion:</strong> ${escapeHTML(item.stadium)}</p>
            <p class="status-closed">PENJUALAN TIKET DITUTUP</p>
          </div>
        </details>
      `).join("")
    : "Belum ada riwayat pertandingan.";
}

// DASHBOARD ADMIN
async function loadAdminDashboard() {
  await Promise.all([
    loadAdminEvents(),
    loadAdminMatchHistory(),
    loadAdminKta(),
    loadAdminMembers(),
    loadAdminTickets()
  ]);
}

// PENGATURAN REKENING ADMIN
async function loadAdminPaymentSettings() {
  const message = $("paymentSettingsMessage");

  try {
    const { data, error } = await db
      .from("payment_settings")
      .select("bank_name, account_number, account_holder")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    $("paymentBankName").value = data?.bank_name || "";
    $("paymentAccountNumber").value = data?.account_number || "";
    $("paymentAccountHolder").value = data?.account_holder || "";

    if (message) {
      showMessage(
        "paymentSettingsMessage",
        "Informasi rekening berhasil dimuat.",
        true
      );
    }
  } catch (error) {
    showMessage(
      "paymentSettingsMessage",
      "Gagal memuat rekening: " + error.message
    );
  }
}

// SIMPAN INFORMASI REKENING ADMIN
$("paymentSettingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("paymentSettingsSaveButton");

  const bankName = $("paymentBankName").value.trim();
  const accountNumber = $("paymentAccountNumber").value.trim();
  const accountHolder = $("paymentAccountHolder").value.trim();

  if (!bankName || !accountNumber || !accountHolder) {
    showMessage(
      "paymentSettingsMessage",
      "Lengkapi semua informasi rekening."
    );
    return;
  }

  button.disabled = true;
  button.textContent = "MENYIMPAN...";

  try {
    const { error } = await db
      .from("payment_settings")
      .upsert({
        id: 1,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "id"
      });

    if (error) throw error;

    showMessage(
      "paymentSettingsMessage",
      "Informasi rekening berhasil disimpan.",
      true
    );
  } catch (error) {
    showMessage(
      "paymentSettingsMessage",
      "Gagal menyimpan rekening: " + error.message
    );
  } finally {
    button.disabled = false;
    button.textContent = "SIMPAN INFORMASI REKENING";
  }
});

// PENGAJUAN KTA ADMIN
async function loadAdminKta() {
  const { data, error } = await db
    .from("kta_requests")
    .select("id, full_name, email, phone, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    $("adminKtaList").textContent =
      "Gagal memuat pengajuan KTA: " + error.message;
    return;
  }

  const items = (data || []).filter(
    (item) => item.status !== "approved"
  );

  $("ktaCount").textContent = items.length;
  $("ktaMenuCount").textContent = items.length;

  $("adminKtaList").innerHTML = items.length
    ? items.map((item) => `
        <div class="data-item">
          <strong>${escapeHTML(item.full_name)}</strong>
          <p>Email: ${escapeHTML(item.email)}</p>
          <p>WhatsApp: ${escapeHTML(item.phone || "-")}</p>
          <p>Status: ${escapeHTML(statusLabel(item.status))}</p>

          <div class="member-edit-fields">
            <label>Status pengajuan</label>
            <select
              data-kta-id="${escapeHTML(item.id)}"
              class="kta-status">
              <option value="pending" ${item.status === "pending" ? "selected" : ""}>Menunggu</option>
              <option value="processing" ${item.status === "processing" ? "selected" : ""}>Diproses</option>
              <option value="completed" ${item.status === "completed" ? "selected" : ""}>Selesai</option>
              <option value="rejected" ${item.status === "rejected" ? "selected" : ""}>Ditolak</option>
            </select>
          </div>

          ${item.status !== "rejected"
            ? `
              <button
                class="btn btn-orange approve-kta-button"
                data-request-id="${escapeHTML(item.id)}"
                type="button">
                SETUJUI KTA & AKTIFKAN ANGGOTA
              </button>
            `
            : ""}
        </div>
      `).join("")
    : "Tidak ada pengajuan KTA yang menunggu proses.";

  document.querySelectorAll(".kta-status").forEach((select) => {
    select.addEventListener("change", async () => {
      select.disabled = true;

      const { error: updateError } = await db
        .from("kta_requests")
        .update({ status: select.value })
        .eq("id", select.dataset.ktaId);

      if (updateError) {
        alert("Gagal mengubah status KTA: " + updateError.message);
        select.disabled = false;
      } else {
        await loadAdminKta();
      }
    });
  });
}

// DATA ANGGOTA ADMIN
async function loadAdminMembers() {
  const { data, error } = await db
    .from("member_profiles")
    .select("id, full_name, role, membership_id")
    .eq("role", "member")
    .order("full_name", { ascending: true });

  if (error) {
    $("adminMemberList").textContent =
      "Gagal memuat anggota: " + error.message;
    return;
  }

  const members = data || [];

  $("memberCount").textContent = members.length;
  $("memberMenuCount").textContent = members.length;

  $("adminMemberList").innerHTML = members.length
    ? members.map((member) => `
        <details class="compact-record member-compact-record">
          <summary class="compact-record-summary">
            <span class="compact-record-title">
              ${escapeHTML(member.full_name || "Tanpa nama")}
            </span>
            <span class="compact-record-meta">
              ${escapeHTML(member.membership_id || "Belum ada ID")}
            </span>
          </summary>

          <div class="compact-record-body member-edit-card">
            <div class="member-edit-fields">
              <label>Nama anggota</label>
              <input
                class="edit-member-name"
                type="text"
                value="${escapeHTML(member.full_name || "")}"
                maxlength="120"
              >

              <label>ID KTA</label>
              <input
                class="edit-member-kta"
                type="text"
                value="${escapeHTML(member.membership_id || "")}"
                maxlength="40"
              >
            </div>

            <button
              class="btn btn-orange save-member-button"
              data-member-id="${escapeHTML(member.id)}"
              type="button">
              SIMPAN PERUBAHAN
            </button>

            <p class="member-save-message message" aria-live="polite"></p>
          </div>
        </details>
      `).join("")
    : "Belum ada data anggota.";

  document.querySelectorAll(".save-member-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".member-edit-card");
      const nameInput = card.querySelector(".edit-member-name");
      const ktaInput = card.querySelector(".edit-member-kta");
      const message = card.querySelector(".member-save-message");

      const fullName = nameInput.value.trim();
      const membershipId = ktaInput.value.trim();

      if (!fullName || !membershipId) {
        message.textContent = "Nama dan ID KTA wajib diisi.";
        return;
      }

      button.disabled = true;
      button.textContent = "MENYIMPAN...";
      message.textContent = "";

      try {
        await callManageKta({
          action: "edit-member",
          memberId: button.dataset.memberId,
          fullName,
          membershipId
        });

        message.textContent = "Data anggota berhasil diperbarui.";
        message.style.color = "#66d98a";

        await loadAdminMembers();
      } catch (error) {
        message.textContent = "Gagal menyimpan: " + error.message;
        message.style.color = "#f47721";

        button.disabled = false;
        button.textContent = "SIMPAN PERUBAHAN";
      }
    });
  });
}

// AMBIL DATA PEMESAN DAN PROFIL ANGGOTA
async function getTicketProfiles(tickets) {
  const userIds = [
    ...new Set(
      tickets.map((ticket) => ticket.user_id).filter(Boolean)
    )
  ];

  if (userIds.length === 0) return new Map();

  const { data, error } = await db
    .from("member_profiles")
    .select("id, full_name, membership_id")
    .in("id", userIds);

  if (error) throw error;

  return new Map(
    (data || []).map((profile) => [profile.id, profile])
  );
}

// TAMPILKAN KARTU PESANAN ADMIN
function renderAdminTicket(ticket, profile, showAction) {
  return `
    <div class="data-item">
      <strong>${escapeHTML(ticket.match_name)}</strong>
      <p>Nama Anggota: ${escapeHTML(profile?.full_name || "Nama tidak ditemukan")}</p>
      <p>ID KTA: ${escapeHTML(profile?.membership_id || "Belum tersedia")}</p>
      <p>Jumlah: ${escapeHTML(ticket.quantity)} tiket</p>
      <p>Status: ${escapeHTML(statusLabel(ticket.status))}</p>
      <p>Tanggal pesan: ${escapeHTML(formatDateTime(ticket.created_at))}</p>

      ${showAction && ticket.status === "pending"
        ? `
          <button
            class="btn btn-orange approve-ticket"
            data-ticket-id="${escapeHTML(ticket.id)}"
            type="button">
            SETUJUI TIKET
          </button>
        `
        : ""}
    </div>
  `;
}

// PERMINTAAN TIKET ADMIN
// Tampilan dan struktur panel tetap dipertahankan
async function loadAdminTickets() {
  const container = $("adminTicketList");

  if (!container) {
    console.error("Elemen adminTicketList tidak ditemukan.");
    return;
  }

  const { data, error } = await db
    .from("ticket_requests")
    .select("id, user_id, event_id, match_name, quantity, status, created_at")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent =
      "Gagal memuat tiket: " + error.message;
    console.error("Gagal memuat tiket:", error);
    return;
  }

  const tickets = data || [];
  const profiles = await getTicketProfiles(tickets);

  $("orderCount").textContent = tickets.length;
  $("orderMenuCount").textContent = tickets.length;

  container.innerHTML = tickets.length
    ? tickets.map((ticket) => {
        const profile = profiles.get(ticket.user_id);
        return renderAdminTicket(ticket, profile, true);
      }).join("")
    : "Tidak ada permintaan tiket yang perlu diproses.";

  // PENANGANAN KLIK TOMBOL SETUJUI TIKET
  container.onclick = async function (event) {
    const button = event.target.closest(".approve-ticket");

    if (!button || !container.contains(button)) return;
    if (button.disabled) return;

    const ticketId = button.dataset.ticketId;

    if (!ticketId) {
      alert("ID tiket tidak ditemukan.");
      return;
    }

    const confirmed = confirm(
      "Pastikan pembayaran anggota sudah diterima. Setujui tiket ini?"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "MEMPROSES...";

    try {
      const { error: updateError } = await db
        .from("ticket_requests")
        .update({ status: "approved" })
        .eq("id", ticketId);

      if (updateError) {
        console.error("Gagal menyetujui tiket:", updateError);

        alert(
          "Gagal menyetujui tiket: " + updateError.message
        );

        button.disabled = false;
        button.textContent = "SETUJUI TIKET";
        return;
      }

      alert("Tiket berhasil disetujui.");

      await Promise.all([
        loadAdminTickets(),
        loadAdminTicketHistory()
      ]);

    } catch (error) {
      console.error("Terjadi kesalahan:", error);

      alert("Terjadi kesalahan: " + error.message);

      button.disabled = false;
      button.textContent = "SETUJUI TIKET";
    }
  };
}

// RIWAYAT PEMBELI TIKET ADMIN
async function loadAdminTicketHistory() {
  const list = $("adminTicketHistoryList");

  const { data: tickets, error: ticketError } = await db
    .from("ticket_requests")
    .select("id, user_id, event_id, match_name, quantity, status, created_at")
    .order("created_at", { ascending: false });

  if (ticketError) {
    list.textContent =
      "Gagal memuat riwayat pembeli tiket: " + ticketError.message;
    return;
  }

  const { data: events, error: eventError } = await db
    .from("match_events")
    .select("id, home_team, away_team, match_date, stadium, is_archived");

  if (eventError) {
    list.textContent =
      "Gagal memuat data pertandingan: " + eventError.message;
    return;
  }

  const eventMap = new Map(
    (events || []).map((event) => [String(event.id), event])
  );

  const archivedEventIds = new Set(
    (events || [])
      .filter((event) => event.is_archived)
      .map((event) => String(event.id))
  );

  const history = (tickets || []).filter((ticket) => {
    return (
      archivedEventIds.has(String(ticket.event_id)) ||
      !isPendingTicket(ticket.status)
    );
  });

  if (!history.length) {
    list.textContent = "Belum ada riwayat pembeli tiket.";
    return;
  }

  const profiles = await getTicketProfiles(history);

  const groups = new Map();

  history.forEach((ticket) => {
    const key = ticket.event_id
      ? "event-" + String(ticket.event_id)
      : "match-" + String(ticket.match_name || "Pertandingan tidak diketahui");

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(ticket);
  });

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const newestA = Math.max(
      ...a[1].map((ticket) => new Date(ticket.created_at || 0).getTime())
    );

    const newestB = Math.max(
      ...b[1].map((ticket) => new Date(ticket.created_at || 0).getTime())
    );

    return newestB - newestA;
  });

  list.innerHTML = sortedGroups.map(([key, groupTickets]) => {
    const firstTicket = groupTickets[0];
    const event = firstTicket.event_id
      ? eventMap.get(String(firstTicket.event_id))
      : null;

    const matchTitle = event
      ? `${event.home_team} vs ${event.away_team}`
      : firstTicket.match_name || "Pertandingan tidak diketahui";

    const matchDate = event?.match_date
      ? formatDate(event.match_date)
      : "-";

    const buyerRows = groupTickets.map((ticket) => {
      const profile = profiles.get(ticket.user_id);

      return `
        <div class="compact-buyer-row">
          <div class="compact-buyer-heading">
            <strong>${escapeHTML(profile?.full_name || "Nama tidak ditemukan")}</strong>
            <span class="compact-buyer-status">${escapeHTML(statusLabel(ticket.status))}</span>
          </div>

          <p>ID KTA: ${escapeHTML(profile?.membership_id || "Belum tersedia")}</p>
          <p>Jumlah: ${escapeHTML(ticket.quantity)} tiket</p>
          <p>Tanggal pesan: ${escapeHTML(formatDateTime(ticket.created_at))}</p>
        </div>
      `;
    }).join("");

    return `
      <details class="compact-record ticket-history-group" data-group="${escapeHTML(key)}">
        <summary class="compact-record-summary">
          <span class="compact-record-title">
            ${escapeHTML(matchTitle)}
          </span>
          <span class="compact-record-meta">
            ${groupTickets.length} pembeli
          </span>
        </summary>

        <div class="compact-record-body">
          <p class="ticket-group-date">
            <strong>Tanggal pertandingan:</strong> ${escapeHTML(matchDate)}
          </p>

          ${event?.stadium
            ? `<p class="ticket-group-stadium"><strong>Stadion:</strong> ${escapeHTML(event.stadium)}</p>`
            : ""}

          <div class="compact-buyer-list">
            ${buyerRows}
          </div>
        </div>
      </details>
    `;
  }).join("");
}

// LOGOUT
document.querySelectorAll(".logoutButton").forEach((button) => {
  button.addEventListener("click", async () => {
    await db.auth.signOut();
    showPublicPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// PULIHKAN SESI LOGIN
async function restoreSession() {
  const { data } = await db.auth.getSession();

  if (!data.session) return;

  try {
    const profile = await getProfile(data.session.user.id);
    showDashboard(profile.role);
  } catch (error) {
    await db.auth.signOut();
    console.error("Profil akun tidak ditemukan:", error.message);
  }
}

restoreSession();

db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    showPublicPage();
  }
});