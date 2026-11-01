// =====================================================
// KAMOJANG ROAD - SCRIPT UTAMA
// Sistem KTA, anggota, pertandingan, kategori tiket,
// kuota otomatis, upload bukti pembayaran, dan verifikasi
// =====================================================

const SUPABASE_URL = "https://nvgpprjwzwqakgjtaukn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_EIjm_-SB9c-STxPHRYKQSg_a1FROgmR";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

const PROOF_BUCKET = "ticket-payment-proofs";
const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

let currentActiveMatch = null;
let memberCategories = [];


// =====================================================
// PEMBUAT BARIS KATEGORI PADA FORM PERTANDINGAN
// =====================================================

let eventCategoryCounter = 0;

function addEventCategoryRow() {
  const container = $("eventCategoryRows");
  if (!container) return;

  eventCategoryCounter++;

  const row = document.createElement("div");
  row.className = "event-category-row data-item";

  row.innerHTML = `
    <div class="category-row-heading">
      <strong class="category-row-title">
        KATEGORI ${eventCategoryCounter}
      </strong>

      <button
        type="button"
        class="btn btn-danger remove-event-category">
        HAPUS
      </button>
    </div>

    <label>Nama kategori</label>
    <input
      type="text"
      data-field="name"
      required
      maxlength="100"
      value="Kategori ${eventCategoryCounter}"
      placeholder="Contoh: Tribun Timur">

    <label>Keterangan tribun / alokasi</label>
    <input
      type="text"
      data-field="stand"
      maxlength="100"
      placeholder="Contoh: Blok A">

    <label>Kuota tiket</label>
    <input
      type="number"
      data-field="quota"
      min="0"
      step="1"
      required
      value="100">

    <label>Harga per tiket (Rp)</label>
    <input
      type="number"
      data-field="price"
      min="0"
      step="1000"
      required
      value="0">
  `;

  container.appendChild(row);
  updateEventCategoryTitles();
}

function updateEventCategoryTitles() {
  const container = $("eventCategoryRows");
  if (!container) return;

  const rows = container.querySelectorAll(".event-category-row");

  rows.forEach((row, index) => {
    const title = row.querySelector(".category-row-title");
    const removeButton = row.querySelector(".remove-event-category");

    if (title) {
      title.textContent = "KATEGORI " + (index + 1);
    }

    if (removeButton) {
      removeButton.disabled = rows.length <= 1;
    }
  });

  eventCategoryCounter = rows.length;
}

function getEventCategoryValues() {
  const container = $("eventCategoryRows");

  if (!container) {
    throw new Error("Form kategori tiket tidak ditemukan.");
  }

  const rows = [
    ...container.querySelectorAll(".event-category-row")
  ];

  return rows.map((row) => {
    const name = row.querySelector('[data-field="name"]').value.trim();
    const stand = row.querySelector('[data-field="stand"]').value.trim();
    const quotaValue = row.querySelector('[data-field="quota"]').value;
    const priceValue = row.querySelector('[data-field="price"]').value;

    return {
      name,
      stand,
      quota: Number(quotaValue),
      price: Number(priceValue),
      quotaValue,
      priceValue
    };
  });
}

function resetEventCategoryRows() {
  const container = $("eventCategoryRows");
  if (!container) return;

  container.innerHTML = "";
  eventCategoryCounter = 0;

  addEventCategoryRow();
}

// Tombol tambah kategori
$("addEventCategoryButton")?.addEventListener("click", () => {
  addEventCategoryRow();
});

// Tombol hapus kategori
$("eventCategoryRows")?.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-event-category");
  if (!button) return;

  const container = $("eventCategoryRows");
  const rows = container.querySelectorAll(".event-category-row");

  if (rows.length <= 1) {
    alert("Minimal harus ada satu kategori tiket.");
    return;
  }

  button.closest(".event-category-row").remove();

  updateEventCategoryTitles();
});

// Buat satu kategori otomatis
resetEventCategoryRows();


// =====================================================
// FUNGSI BANTU
// =====================================================

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

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function statusLabel(status) {
  const labels = {
    pending: "Menunggu pembayaran",
    approved: "Disetujui",
    rejected: "Ditolak",
    processing: "Diproses",
    completed: "Selesai"
  };

  return labels[status] || status || "Belum diketahui";
}

function paymentStatusLabel(status) {
  const labels = {
    awaiting_payment: "Menunggu pembayaran",
    under_review: "Menunggu verifikasi admin",
    verified: "Pembayaran terverifikasi",
    rejected: "Bukti pembayaran ditolak"
  };

  return labels[status] || status || "Belum diketahui";
}

function isPendingTicket(status) {
  return status === "pending" || status === "processing";
}

function setButtonLoading(button, loading, loadingText, normalText) {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? loadingText : normalText;
}

function getFileExtension(file) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf"
  };

  return extensions[file.type] || "file";
}

function getUniqueFileName(file) {
  const uniqueId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : Date.now() + "-" + Math.random().toString(36).slice(2);

  return uniqueId + "." + getFileExtension(file);
}


// =====================================================
// TAMPILAN HALAMAN
// =====================================================

function showPublicPage() {
  $("memberPage")?.classList.add("hidden");
  $("adminPage")?.classList.add("hidden");

  document.querySelectorAll(".hero, .section").forEach((el) => {
    el.classList.remove("hidden");
  });
}

function showDashboard(role) {
  document.querySelectorAll(".hero, .section").forEach((el) => {
    el.classList.add("hidden");
  });

  $("memberPage")?.classList.add("hidden");
  $("adminPage")?.classList.add("hidden");

  if (role === "admin") {
    $("adminPage")?.classList.remove("hidden");
    loadAdminDashboard();
  } else if (role === "member") {
    $("memberPage")?.classList.remove("hidden");
    loadMemberDashboard();
  } else {
    alert("Jenis akun tidak dikenali. Hubungi pengurus.");
    showPublicPage();
    return;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}


// =====================================================
// PROFIL ANGGOTA
// =====================================================

async function getProfile(userId) {
  const { data, error } = await db
    .from("member_profiles")
    .select("id, full_name, role, membership_id")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}


// =====================================================
// MENU HP
// =====================================================

$("menuToggle")?.addEventListener("click", () => {
  $("nav")?.classList.toggle("open");
});

document.querySelectorAll("#nav a").forEach((link) => {
  link.addEventListener("click", () => {
    $("nav")?.classList.remove("open");
  });
});


// =====================================================
// MENU DASHBOARD ADMIN
// =====================================================

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


// =====================================================
// PENDAFTARAN KTA DAN PEMBUATAN AKUN
// =====================================================

$("ktaForm")?.addEventListener("submit", async (event) => {
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
    showMessage("ktaMessage", "Password minimal 6 karakter.");
    return;
  }

  if (!button) {
    showMessage("ktaMessage", "Tombol pendaftaran tidak ditemukan.");
    return;
  }

  setButtonLoading(
    button,
    true,
    "MEMBUAT AKUN...",
    "KIRIM PENDAFTARAN"
  );

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

    if (data?.error) throw new Error(data.error);

    showMessage(
      "ktaMessage",
      "Pendaftaran berhasil. Silakan kirim dokumen melalui WhatsApp. Akun menunggu persetujuan Admin.",
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
      "Saya akan mengirim foto KTP dan pas foto untuk verifikasi.",
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
    setButtonLoading(
      button,
      false,
      "MEMBUAT AKUN...",
      "KIRIM PENDAFTARAN"
    );
  }
});


// =====================================================
// LOGIN ADMIN DAN ANGGOTA
// =====================================================

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const button = event.submitter;

  if (!button) return;

  setButtonLoading(button, true, "MEMERIKSA...", "MASUK");

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
    setButtonLoading(button, false, "MEMERIKSA...", "MASUK");
  }
});


// =====================================================
// LUPA KATA SANDI
// =====================================================

$("resetPasswordButton")?.addEventListener("click", async () => {
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


// =====================================================
// EDGE FUNCTION manage-kta-v2
// =====================================================

async function callManageKta(payload) {
  const { data: sessionData, error: sessionError } =
    await db.auth.getSession();

  if (sessionError) {
    throw new Error(
      "Gagal mengambil sesi login: " + sessionError.message
    );
  }

  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "Sesi login tidak ditemukan. Silakan login kembali."
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


// =====================================================
// PERSETUJUAN KTA ADMIN
// =====================================================

$("adminKtaList")?.addEventListener("click", async (event) => {
  const button = event.target.closest(".approve-kta-button");

  if (!button) return;

  const requestId = button.dataset.requestId;

  if (!requestId) {
    alert("ID pengajuan KTA tidak ditemukan.");
    return;
  }

  const confirmed = confirm(
    "Setujui pengajuan ini dan aktifkan anggota?"
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "MEMPROSES...";

  try {
    const result = await callManageKta({
      action: "approve",
      requestId
    });

    alert(
      "Pengajuan KTA berhasil disetujui.\nID KTA: " +
      (result.membershipId || "Sudah tersedia")
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


// =====================================================
// AMBIL PERTANDINGAN AKTIF
// =====================================================

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


// =====================================================
// KATEGORI TIKET DAN SISA KUOTA
// =====================================================

async function getCategoryRemaining(category) {
  const { count, error } = await db
    .from("ticket_requests")
    .select("id", { count: "exact", head: true })
    .eq("category_id", category.id)
    .in("status", ["pending", "approved"]);

  if (error) throw error;

  const reserved = count || 0;

  return {
    ...category,
    reserved,
    remaining: Math.max(0, Number(category.quota) - reserved)
  };
}

async function getMatchCategories(eventId) {
  const { data, error } = await db
    .from("match_ticket_categories")
    .select("id, event_id, name, stand, quota, price, is_active")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return Promise.all(
    (data || []).map((category) => getCategoryRemaining(category))
  );
}

function renderCategoryInfo(category) {
  const container = $("ticketCategoryInfo");
  if (!container) return;

  if (!category) {
    container.textContent = "Pilih kategori tiket untuk melihat informasi.";
    return;
  }

  container.innerHTML = `
    <div class="data-item">
      <strong>${escapeHTML(category.name)}</strong>
      <p>Tribun: ${escapeHTML(category.stand || "-")}</p>
      <p>Harga: <strong>${escapeHTML(formatRupiah(category.price))}</strong></p>
      <p>Sisa kuota: <strong>${escapeHTML(category.remaining)}</strong></p>
    </div>
  `;
}

async function loadMemberCategories(eventId) {
  const select = $("ticketCategory");
  const info = $("ticketCategoryInfo");
  const button = $("ticketSubmitButton");

  if (!select) return;

  select.innerHTML = '<option value="">Memuat kategori...</option>';
  select.disabled = true;

  if (button) button.disabled = true;

  try {
    const categories = await getMatchCategories(eventId);

    memberCategories = categories.filter(
      (category) => category.remaining > 0
    );

    if (!memberCategories.length) {
      select.innerHTML = '<option value="">Tidak ada kategori tersedia</option>';

      if (info) {
        info.textContent =
          "Belum ada kategori tersedia atau seluruh kuota telah habis.";
      }

      return;
    }

    select.innerHTML = `
      <option value="">Pilih kategori tiket</option>
      ${memberCategories.map((category) => `
        <option value="${escapeHTML(category.id)}">
          ${escapeHTML(category.name)}
          - ${escapeHTML(category.stand || "Tanpa tribun")}
          - ${escapeHTML(formatRupiah(category.price))}
          (Sisa ${escapeHTML(category.remaining)})
        </option>
      `).join("")}
    `;

    select.disabled = false;

    if (info) {
      info.textContent = "Silakan pilih satu kategori tiket.";
    }

  } catch (error) {
    select.innerHTML = '<option value="">Gagal memuat kategori</option>';

    if (info) {
      info.textContent = "Gagal memuat kategori: " + error.message;
    }
  }
}

$("ticketCategory")?.addEventListener("change", () => {
  const category = memberCategories.find(
    (item) => String(item.id) === String($("ticketCategory").value)
  );

  renderCategoryInfo(category);

  if ($("ticketSubmitButton")) {
    $("ticketSubmitButton").disabled = !category;
  }
});


// =====================================================
// INFORMASI REKENING DAN UPLOAD BUKTI PEMBAYARAN
// =====================================================

async function getPaymentSettings() {
  const { data, error } = await db
    .from("payment_settings")
    .select("bank_name, account_number, account_holder")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function loadMemberPaymentInfo(profile, activeOrders) {
  const container = $("memberPaymentInfo");
  if (!container) return;

  if (!activeOrders.length) {
    container.textContent =
      "Informasi pembayaran akan muncul setelah kamu memesan tiket.";
    return;
  }

  container.textContent = "Memuat informasi pembayaran...";

  try {
    const settings = await getPaymentSettings();

    const accountHTML = settings?.bank_name &&
      settings?.account_number &&
      settings?.account_holder
      ? `
        <div class="data-item">
          <strong>Informasi Rekening Pembayaran</strong>
          <p>Bank: ${escapeHTML(settings.bank_name)}</p>
          <p>Nomor rekening:
            <strong>${escapeHTML(settings.account_number)}</strong>
          </p>
          <p>Atas nama: ${escapeHTML(settings.account_holder)}</p>
        </div>
      `
      : `
        <div class="data-item">
          Informasi rekening belum diatur oleh Admin.
        </div>
      `;

    const ordersHTML = activeOrders.map((order) => {
      const paymentStatus = order.payment_status || "awaiting_payment";

      let statusHTML = "";

      if (paymentStatus === "under_review") {
        statusHTML = `
          <p class="status-open">
            Bukti pembayaran sedang diperiksa Admin.
          </p>
        `;
      } else if (paymentStatus === "verified") {
        statusHTML = `
          <p class="status-open">
            Pembayaran sudah diverifikasi. Tiket disetujui.
          </p>
        `;
      } else if (paymentStatus === "rejected") {
        statusHTML = `
          <p class="status-closed">
            Bukti pembayaran ditolak.
          </p>
          <p>Catatan Admin:
            ${escapeHTML(order.payment_note || "Silakan unggah ulang bukti pembayaran.")}
          </p>
        `;
      }

      const canUpload =
        isPendingTicket(order.status) &&
        ["awaiting_payment", "rejected"].includes(paymentStatus);

      const uploadHTML = canUpload
        ? `
          <div class="payment-upload-area">
            <label for="proof-${escapeHTML(order.id)}">
              Pilih bukti pembayaran (JPG, PNG, WEBP, atau PDF)
            </label>

            <input
              class="payment-proof-file"
              id="proof-${escapeHTML(order.id)}"
              type="file"
              data-ticket-id="${escapeHTML(order.id)}"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            >

            <button
              class="btn btn-orange upload-payment-proof"
              data-ticket-id="${escapeHTML(order.id)}"
              type="button">
              UPLOAD BUKTI PEMBAYARAN
            </button>

            <p class="payment-upload-message message"
              data-message-ticket="${escapeHTML(order.id)}"
              aria-live="polite"></p>

            <p class="muted">
              Maksimal ukuran file 5 MB. Pastikan bukti pembayaran terlihat jelas.
            </p>
          </div>
        `
        : "";

      return `
        <div class="data-item payment-order-item">
          <strong>${escapeHTML(order.match_name)}</strong>
          <p>Kategori: ${escapeHTML(order.category_name_snapshot || "-")}</p>
          <p>Tribun: ${escapeHTML(order.stand_snapshot || "-")}</p>
          <p>Harga tiket: ${escapeHTML(formatRupiah(order.unit_price_snapshot))}</p>
          <p>Status pembayaran:
            <strong>${escapeHTML(paymentStatusLabel(paymentStatus))}</strong>
          </p>
          ${statusHTML}
          ${uploadHTML}
        </div>
      `;
    }).join("");

    container.innerHTML = accountHTML + ordersHTML;

  } catch (error) {
    console.error("Gagal memuat informasi pembayaran:", error);

    container.textContent =
      "Gagal memuat informasi pembayaran: " + error.message;
  }
}


// PENANGANAN UPLOAD BUKTI PEMBAYARAN

$("memberPaymentInfo")?.addEventListener("click", async (event) => {
  const button = event.target.closest(".upload-payment-proof");

  if (!button) return;

  const ticketId = button.dataset.ticketId;
  const fileInput = $("memberPaymentInfo").querySelector(
    `.payment-proof-file[data-ticket-id="${ticketId}"]`
  );

  const message = $("memberPaymentInfo").querySelector(
    `[data-message-ticket="${ticketId}"]`
  );

  const file = fileInput?.files?.[0];

  if (!file) {
    if (message) {
      message.textContent = "Pilih file bukti pembayaran terlebih dahulu.";
    }
    return;
  }

  if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
    if (message) {
      message.textContent =
        "Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.";
    }
    return;
  }

  if (file.size > MAX_PROOF_SIZE) {
    if (message) {
      message.textContent = "Ukuran file maksimal 5 MB.";
    }
    return;
  }

  button.disabled = true;
  button.textContent = "MENGUPLOAD...";

  if (message) message.textContent = "";

  let uploadedPath = null;

  try {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData.session?.user;

    if (!user) {
      throw new Error("Sesi login berakhir. Silakan login kembali.");
    }

    const fileName = getUniqueFileName(file);
    uploadedPath = `${user.id}/${ticketId}/${fileName}`;

    const { error: uploadError } = await db.storage
      .from(PROOF_BUCKET)
      .upload(uploadedPath, file, {
        upsert: false,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    const { error: submitError } = await db.rpc(
      "submit_ticket_payment_proof",
      {
        p_ticket_id: Number(ticketId),
        p_proof_path: uploadedPath
      }
    );

    if (submitError) throw submitError;

    if (message) {
      message.textContent =
        "Bukti pembayaran berhasil diunggah. Menunggu verifikasi Admin.";
      message.style.color = "#66d98a";
    }

    await loadMemberDashboard();

  } catch (error) {
    console.error("Upload bukti pembayaran gagal:", error);

    if (uploadedPath) {
      await db.storage
        .from(PROOF_BUCKET)
        .remove([uploadedPath])
        .catch(() => {});
    }

    if (message) {
      message.textContent = "Upload gagal: " + error.message;
      message.style.color = "#f47721";
    }

    button.disabled = false;
    button.textContent = "UPLOAD BUKTI PEMBAYARAN";
  }
});


// =====================================================
// DASHBOARD ANGGOTA
// =====================================================

async function loadMemberDashboard() {
  const { data: sessionData } = await db.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) return;

  if ($("activeMatchInfo")) {
    $("activeMatchInfo").textContent = "Memuat pertandingan...";
  }

  if ($("memberOrders")) {
    $("memberOrders").textContent = "Memuat pesanan...";
  }

  if ($("memberOrderHistory")) {
    $("memberOrderHistory").textContent = "Memuat riwayat...";
  }

  if ($("ticketSubmitButton")) {
    $("ticketSubmitButton").disabled = true;
  }

  try {
    const profile = await getProfile(user.id);

    $("memberName").textContent = profile.full_name || "-";
    $("memberId").textContent =
      profile.membership_id || "Belum tersedia";

    currentActiveMatch = await getActiveMatch();

    if (currentActiveMatch) {
      $("activeMatchInfo").innerHTML = `
        <div class="data-item">
          <strong>
            ${escapeHTML(currentActiveMatch.home_team)}
            vs
            ${escapeHTML(currentActiveMatch.away_team)}
          </strong>
          <p>Tanggal:
            ${escapeHTML(formatDate(currentActiveMatch.match_date))}
          </p>
          <p>Stadion:
            ${escapeHTML(currentActiveMatch.stadium)}
          </p>
        </div>
      `;

      await loadMemberCategories(currentActiveMatch.id);

    } else {
      $("activeMatchInfo").textContent =
        "Belum ada penjualan tiket pertandingan yang dibuka.";

      if ($("ticketCategory")) {
        $("ticketCategory").innerHTML =
          '<option value="">Belum ada pertandingan aktif</option>';
        $("ticketCategory").disabled = true;
      }

      if ($("ticketCategoryInfo")) {
        $("ticketCategoryInfo").textContent =
          "Kategori tiket belum tersedia.";
      }
    }

    const { data: orders, error: orderError } = await db
      .from("ticket_requests")
      .select(`
        id,
        user_id,
        event_id,
        match_name,
        quantity,
        status,
        created_at,
        category_id,
        category_name_snapshot,
        stand_snapshot,
        unit_price_snapshot,
        payment_status,
        payment_proof_path,
        payment_submitted_at,
        payment_verified_at,
        payment_note
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (orderError) throw orderError;

    const allOrders = orders || [];

    const activeOrders = allOrders.filter((order) => {
      return (
        currentActiveMatch &&
        String(order.event_id) === String(currentActiveMatch.id)
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
            <p>Kategori: ${escapeHTML(order.category_name_snapshot || "-")}</p>
            <p>Tribun: ${escapeHTML(order.stand_snapshot || "-")}</p>
            <p>Jumlah: 1 tiket</p>
            <p>Harga: ${escapeHTML(formatRupiah(order.unit_price_snapshot))}</p>
            <p>Status tiket: ${escapeHTML(statusLabel(order.status))}</p>
            <p>Status pembayaran:
              ${escapeHTML(paymentStatusLabel(order.payment_status))}
            </p>
            <p>Tanggal pesan:
              ${escapeHTML(formatDateTime(order.created_at))}
            </p>
          </div>
        `).join("")
      : "Belum ada pesanan untuk pertandingan yang sedang dibuka.";

    $("memberOrderHistory").innerHTML = historyOrders.length
      ? historyOrders.map((order) => `
          <div class="data-item">
            <strong>${escapeHTML(order.match_name)}</strong>
            <p>Kategori: ${escapeHTML(order.category_name_snapshot || "-")}</p>
            <p>Tribun: ${escapeHTML(order.stand_snapshot || "-")}</p>
            <p>Jumlah: 1 tiket</p>
            <p>Harga: ${escapeHTML(formatRupiah(order.unit_price_snapshot))}</p>
            <p>Status tiket: ${escapeHTML(statusLabel(order.status))}</p>
            <p>Status pembayaran:
              ${escapeHTML(paymentStatusLabel(order.payment_status))}
            </p>
            <p>Tanggal pesan:
              ${escapeHTML(formatDateTime(order.created_at))}
            </p>
          </div>
        `).join("")
      : "Belum ada riwayat pesanan tiket.";

    await loadMemberPaymentInfo(profile, activeOrders);

  } catch (error) {
    console.error("Dashboard anggota gagal dimuat:", error);

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


// =====================================================
// PEMESANAN TIKET - SATU KTA MAKSIMAL SATU TIKET
// =====================================================

$("ticketForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("ticketSubmitButton");
  const categoryId = $("ticketCategory")?.value;

  if (!categoryId) {
    showMessage("ticketMessage", "Pilih kategori tiket terlebih dahulu.");
    return;
  }

  setButtonLoading(
    button,
    true,
    "MENGIRIM...",
    "AJUKAN PEMESANAN"
  );

  try {
    const activeMatch = await getActiveMatch();

    if (!activeMatch) {
      throw new Error("Penjualan tiket sedang ditutup.");
    }

    const { error } = await db.rpc("book_ticket", {
      p_event_id: activeMatch.id,
      p_category_id: categoryId
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "KTA ini sudah digunakan untuk memesan tiket pertandingan tersebut."
        );
      }

      throw error;
    }

    showMessage(
      "ticketMessage",
      "Pemesanan berhasil. Silakan lakukan pembayaran dan unggah bukti transfer.",
      true
    );

    $("ticketForm").reset();

    await loadMemberDashboard();

  } catch (error) {
    console.error("Pemesanan tiket gagal:", error);

    showMessage(
      "ticketMessage",
      "Pemesanan gagal: " + error.message
    );

  } finally {
    button.textContent = "AJUKAN PEMESANAN";

    try {
      const match = await getActiveMatch();
      button.disabled = !match || !($("ticketCategory")?.value);
    } catch (_) {
      button.disabled = true;
    }
  }
});


// =====================================================
// ADMIN - SIMPAN PERTANDINGAN BESERTA KATEGORI
// =====================================================

$("eventForm")?.addEventListener("submit", async (event) => {
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

  const categories = getEventCategoryValues();

  if (!categories.length) {
    showMessage(
      "eventMessage",
      "Tambahkan minimal satu kategori tiket."
    );
    return;
  }

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];

    if (!category.name) {
      showMessage(
        "eventMessage",
        `Nama kategori ${i + 1} wajib diisi.`
      );
      return;
    }

    if (
      category.quotaValue === "" ||
      !Number.isInteger(category.quota) ||
      category.quota < 0
    ) {
      showMessage(
        "eventMessage",
        `Kuota kategori ${i + 1} harus berupa bilangan bulat minimal 0.`
      );
      return;
    }

    if (
      category.priceValue === "" ||
      !Number.isFinite(category.price) ||
      category.price < 0
    ) {
      showMessage(
        "eventMessage",
        `Harga kategori ${i + 1} tidak valid.`
      );
      return;
    }
  }

  // Cegah kategori ganda dengan nama dan tribun yang sama.
  const categoryKeys = categories.map((category) => {
    return (
      category.name.toLowerCase() +
      "||" +
      category.stand.toLowerCase()
    );
  });

  if (new Set(categoryKeys).size !== categoryKeys.length) {
    showMessage(
      "eventMessage",
      "Ada kategori dengan nama dan keterangan tribun yang sama. Periksa kembali."
    );
    return;
  }

  setButtonLoading(
    button,
    true,
    "MENYIMPAN PERTANDINGAN & KATEGORI...",
    "SIMPAN PERTANDINGAN & KATEGORI TIKET"
  );

  let newEventId = null;
  let previousActiveEventId = null;
  let previousEventArchived = false;

  try {
    // Simpan pertandingan baru dalam keadaan belum aktif.
    const { data: newEvent, error: eventError } = await db
      .from("match_events")
      .insert({
        home_team: home,
        away_team: away,
        match_date: date,
        stadium,
        is_active: false,
        is_archived: false
      })
      .select("id")
      .single();

    if (eventError) throw eventError;

    newEventId = newEvent.id;

    // Siapkan semua kategori untuk pertandingan baru.
    const categoryRows = categories.map((category) => ({
      event_id: newEventId,
      name: category.name,
      stand: category.stand || null,
      quota: category.quota,
      price: category.price,
      is_active: true
    }));

    // Simpan seluruh kategori sekaligus.
    const { error: categoryError } = await db
      .from("match_ticket_categories")
      .insert(categoryRows);

    if (categoryError) throw categoryError;

    // Cari pertandingan aktif sebelumnya.
    const { data: previousEvent, error: previousError } = await db
      .from("match_events")
      .select("id")
      .eq("is_active", true)
      .eq("is_archived", false)
      .neq("id", newEventId)
      .maybeSingle();

    if (previousError) throw previousError;

    if (previousEvent) {
      previousActiveEventId = previousEvent.id;

      // Tutup dan arsipkan pertandingan sebelumnya.
      const { error: archiveError } = await db
        .from("match_events")
        .update({
          is_active: false,
          is_archived: true
        })
        .eq("id", previousActiveEventId);

      if (archiveError) throw archiveError;

      previousEventArchived = true;
    }

    // Aktifkan pertandingan baru setelah semua kategori berhasil disimpan.
    const { error: activateError } = await db
      .from("match_events")
      .update({
        is_active: true,
        is_archived: false
      })
      .eq("id", newEventId);

    if (activateError) throw activateError;

    showMessage(
      "eventMessage",
      `Berhasil! Pertandingan ${home} vs ${away} dan ${categories.length} kategori tiket sudah disimpan. Penjualan tiket sekarang aktif.`,
      true
    );

    $("eventForm").reset();
    $("eventHome").value = "Persija Jakarta";
    resetEventCategoryRows();

    await Promise.all([
      loadAdminEvents(),
      loadAdminMatchHistory()
    ]);

  } catch (error) {
    console.error("Gagal menyimpan pertandingan dan kategori:", error);

    // Jika proses gagal setelah pertandingan baru dibuat,
    // jangan biarkan pertandingan setengah jadi menjadi aktif.
    if (newEventId) {
      await db
        .from("match_events")
        .update({
          is_active: false,
          is_archived: true
        })
        .eq("id", newEventId);

      // Pulihkan pertandingan lama jika sebelumnya sudah diarsipkan.
      if (previousEventArchived && previousActiveEventId) {
        await db
          .from("match_events")
          .update({
            is_active: true,
            is_archived: false
          })
          .eq("id", previousActiveEventId);
      }
    }

    showMessage(
      "eventMessage",
      "Gagal menyimpan pertandingan atau kategori: " + error.message
    );

    await loadAdminEvents();

  } finally {
    setButtonLoading(
      button,
      false,
      "MENYIMPAN PERTANDINGAN & KATEGORI...",
      "SIMPAN PERTANDINGAN & KATEGORI TIKET"
    );
  }
});


// =====================================================
// ADMIN - DAFTAR PERTANDINGAN
// =====================================================

async function loadAdminEvents() {
  const list = $("adminEventList");
  if (!list) return;

  const { data, error } = await db
    .from("match_events")
    .select(`
      id,
      home_team,
      away_team,
      match_date,
      stadium,
      is_active,
      is_archived,
      created_at
    `)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = "Gagal memuat pertandingan: " + error.message;
    return;
  }

  list.innerHTML = data.length
    ? data.map((item) => `
        <div class="data-item">
          <strong>
            ${escapeHTML(item.home_team)} vs ${escapeHTML(item.away_team)}
          </strong>
          <p>Tanggal: ${escapeHTML(formatDate(item.match_date))}</p>
          <p>Stadion: ${escapeHTML(item.stadium)}</p>
          <p class="${item.is_active ? "status-open" : "status-closed"}">
            ${item.is_active ? "PENJUALAN TIKET DIBUKA" : "PENJUALAN DITUTUP"}
          </p>

          <button
            class="btn btn-danger archive-event-button"
            data-event-id="${escapeHTML(item.id)}"
            type="button">
            ${item.is_active
              ? "TUTUP PENJUALAN & PINDAHKAN KE RIWAYAT"
              : "PINDAHKAN KE RIWAYAT"}
          </button>
        </div>
      `).join("")
    : "Tidak ada pertandingan yang belum diarsipkan.";
}

$("adminEventList")?.addEventListener("click", async (event) => {
  const button = event.target.closest(".archive-event-button");
  if (!button) return;

  const confirmed = confirm(
    "Pindahkan pertandingan ini ke riwayat? Semua pesanan tiket tetap tersimpan."
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "MEMINDAHKAN...";

  try {
    const { error } = await db
      .from("match_events")
      .update({
        is_active: false,
        is_archived: true
      })
      .eq("id", button.dataset.eventId);

    if (error) throw error;

    alert("Pertandingan berhasil dipindahkan ke riwayat.");

    await Promise.all([
      loadAdminEvents(),
      loadAdminMatchHistory()
    ]);

  } catch (error) {
    alert("Gagal memindahkan pertandingan: " + error.message);
    button.disabled = false;
    button.textContent = "PINDAHKAN KE RIWAYAT";
  }
});


// =====================================================
// ADMIN - RIWAYAT PERTANDINGAN
// =====================================================

async function loadAdminMatchHistory() {
  const list = $("adminMatchHistoryList");
  if (!list) return;

  const { data, error } = await db
    .from("match_events")
    .select(`
      id,
      home_team,
      away_team,
      match_date,
      stadium,
      is_active,
      is_archived,
      created_at
    `)
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
            <p><strong>Pertandingan:</strong>
              ${escapeHTML(item.home_team)} vs ${escapeHTML(item.away_team)}
            </p>
            <p><strong>Tanggal:</strong>
              ${escapeHTML(formatDate(item.match_date))}
            </p>
            <p><strong>Stadion:</strong>
              ${escapeHTML(item.stadium)}
            </p>
            <p class="status-closed">PENJUALAN TIKET DITUTUP</p>
          </div>
        </details>
      `).join("")
    : "Belum ada riwayat pertandingan.";
}


// =====================================================
// DASHBOARD ADMIN
// =====================================================

async function loadAdminDashboard() {
  await Promise.all([
    loadAdminEvents(),
    loadAdminMatchHistory(),
    loadAdminKta(),
    loadAdminMembers(),
    loadAdminTickets()
  ]);
}


// =====================================================
// PENGATURAN REKENING ADMIN
// =====================================================

async function loadAdminPaymentSettings() {
  try {
    const data = await getPaymentSettings();

    $("paymentBankName").value = data?.bank_name || "";
    $("paymentAccountNumber").value = data?.account_number || "";
    $("paymentAccountHolder").value = data?.account_holder || "";

    showMessage(
      "paymentSettingsMessage",
      "Informasi rekening berhasil dimuat.",
      true
    );

  } catch (error) {
    showMessage(
      "paymentSettingsMessage",
      "Gagal memuat rekening: " + error.message
    );
  }
}

$("paymentSettingsForm")?.addEventListener("submit", async (event) => {
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

  setButtonLoading(
    button,
    true,
    "MENYIMPAN...",
    "SIMPAN INFORMASI REKENING"
  );

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
    setButtonLoading(
      button,
      false,
      "MENYIMPAN...",
      "SIMPAN INFORMASI REKENING"
    );
  }
});


// =====================================================
// ADMIN - PENGAJUAN KTA
// =====================================================

async function loadAdminKta() {
  const list = $("adminKtaList");
  if (!list) return;

  const { data, error } = await db
    .from("kta_requests")
    .select("id, full_name, email, phone, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent =
      "Gagal memuat pengajuan KTA: " + error.message;
    return;
  }

  const items = (data || []).filter(
    (item) => item.status !== "approved"
  );

  if ($("ktaCount")) $("ktaCount").textContent = items.length;
  if ($("ktaMenuCount")) $("ktaMenuCount").textContent = items.length;

  list.innerHTML = items.length
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
}

$("adminKtaList")?.addEventListener("change", async (event) => {
  const select = event.target.closest(".kta-status");
  if (!select) return;

  select.disabled = true;

  try {
    const { error } = await db
      .from("kta_requests")
      .update({ status: select.value })
      .eq("id", select.dataset.ktaId);

    if (error) throw error;

    await loadAdminKta();

  } catch (error) {
    alert("Gagal mengubah status KTA: " + error.message);
    select.disabled = false;
  }
});


// =====================================================
// ADMIN - DATA ANGGOTA
// =====================================================

async function loadAdminMembers() {
  const list = $("adminMemberList");
  if (!list) return;

  const { data, error } = await db
    .from("member_profiles")
    .select("id, full_name, role, membership_id")
    .eq("role", "member")
    .order("full_name", { ascending: true });

  if (error) {
    list.textContent = "Gagal memuat anggota: " + error.message;
    return;
  }

  const members = data || [];

  if ($("memberCount")) $("memberCount").textContent = members.length;
  if ($("memberMenuCount")) $("memberMenuCount").textContent = members.length;

  list.innerHTML = members.length
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
}

$("adminMemberList")?.addEventListener("click", async (event) => {
  const button = event.target.closest(".save-member-button");
  if (!button) return;

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


// =====================================================
// ADMIN - PROFIL PEMESAN TIKET
// =====================================================

async function getTicketProfiles(tickets) {
  const userIds = [
    ...new Set(
      tickets.map((ticket) => ticket.user_id).filter(Boolean)
    )
  ];

  if (!userIds.length) return new Map();

  const { data, error } = await db
    .from("member_profiles")
    .select("id, full_name, membership_id")
    .in("id", userIds);

  if (error) throw error;

  return new Map(
    (data || []).map((profile) => [profile.id, profile])
  );
}


// =====================================================
// ADMIN - DAFTAR BUKTI PEMBAYARAN
// =====================================================

async function loadAdminTickets() {
  const container = $("adminTicketList");
  if (!container) return;

  container.textContent = "Memuat bukti pembayaran...";

  const { data, error } = await db
    .from("ticket_requests")
    .select(`
      id,
      user_id,
      event_id,
      match_name,
      quantity,
      status,
      created_at,
      category_name_snapshot,
      stand_snapshot,
      unit_price_snapshot,
      payment_status,
      payment_proof_path,
      payment_submitted_at,
      payment_note
    `)
    .eq("payment_status", "under_review")
    .order("payment_submitted_at", { ascending: true });

  if (error) {
    container.textContent =
      "Gagal memuat bukti pembayaran: " + error.message;
    return;
  }

  const tickets = data || [];

  if ($("orderCount")) $("orderCount").textContent = tickets.length;
  if ($("orderMenuCount")) $("orderMenuCount").textContent = tickets.length;

  if (!tickets.length) {
    container.textContent =
      "Belum ada bukti pembayaran yang menunggu verifikasi.";
    return;
  }

  try {
    const profiles = await getTicketProfiles(tickets);

    const cards = await Promise.all(
      tickets.map(async (ticket) => {
        const profile = profiles.get(ticket.user_id);

        let proofHTML = `
          <p class="status-closed">
            Bukti pembayaran tidak ditemukan.
          </p>
        `;

        if (ticket.payment_proof_path) {
          const { data: signedData, error: signedError } =
            await db.storage
              .from(PROOF_BUCKET)
              .createSignedUrl(ticket.payment_proof_path, 300);

          if (!signedError && signedData?.signedUrl) {
            proofHTML = `
              <p>
                <a
                  href="${escapeHTML(signedData.signedUrl)}"
                  target="_blank"
                  rel="noopener">
                  LIHAT BUKTI PEMBAYARAN
                </a>
              </p>
            `;
          } else {
            proofHTML = `
              <p class="status-closed">
                Gagal membuka bukti pembayaran.
                ${escapeHTML(signedError?.message || "")}
              </p>
            `;
          }
        }

        return `
          <div class="data-item">
            <strong>${escapeHTML(ticket.match_name)}</strong>
            <p>Nama Anggota:
              ${escapeHTML(profile?.full_name || "Nama tidak ditemukan")}
            </p>
            <p>ID KTA:
              ${escapeHTML(profile?.membership_id || "Belum tersedia")}
            </p>
            <p>Kategori:
              ${escapeHTML(ticket.category_name_snapshot || "-")}
            </p>
            <p>Tribun:
              ${escapeHTML(ticket.stand_snapshot || "-")}
            </p>
            <p>Jumlah: 1 tiket</p>
            <p>Harga:
              <strong>${escapeHTML(formatRupiah(ticket.unit_price_snapshot))}</strong>
            </p>
            <p>Dikirim:
              ${escapeHTML(formatDateTime(ticket.payment_submitted_at))}
            </p>

            ${proofHTML}

            <div class="payment-review-actions">
              <button
                class="btn btn-orange review-payment-button"
                data-ticket-id="${escapeHTML(ticket.id)}"
                data-approved="true"
                type="button">
                VERIFIKASI & SETUJUI
              </button>

              <button
                class="btn btn-danger review-payment-button"
                data-ticket-id="${escapeHTML(ticket.id)}"
                data-approved="false"
                type="button">
                TOLAK BUKTI
              </button>
            </div>
          </div>
        `;
      })
    );

    container.innerHTML = cards.join("");

  } catch (error) {
    container.textContent =
      "Gagal menampilkan data pemesan: " + error.message;
  }
}
// =====================================================
// ADMIN - VERIFIKASI ATAU TOLAK BUKTI PEMBAYARAN
// =====================================================

document.addEventListener("click", async (event) => {
  // Pastikan target klik merupakan elemen HTML.
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest(".review-payment-button");

  if (!button) return;

  // Pastikan tombol berada di daftar pembayaran admin.
  

  if (button.disabled) return;

  const ticketId = button.dataset.ticketId;
  const approved = button.dataset.approved === "true";

  if (!ticketId || !Number.isFinite(Number(ticketId))) {
    alert("ID tiket tidak valid atau tidak ditemukan.");
    return;
  }

  let note = null;

  if (approved) {
    const confirmed = confirm(
      "Pastikan pembayaran sudah diterima dan nominalnya sesuai. Verifikasi dan setujui tiket ini?"
    );

    if (!confirmed) return;

  } else {
    note = prompt(
      "Tuliskan alasan penolakan bukti pembayaran agar anggota dapat memperbaikinya:"
    );

    if (note === null) return;

    note = note.trim();

    if (!note) {
      alert("Alasan penolakan wajib diisi.");
      return;
    }
  }

  const originalText = button.textContent;

  // Nonaktifkan tombol selama proses berlangsung.
  button.disabled = true;
  button.textContent = "MEMPROSES...";

  // Nonaktifkan tombol lain pada tiket yang sama agar
  // admin tidak mengirim dua permintaan secara bersamaan.
  const ticketCard = button.closest(".data-item");
  const relatedButtons = ticketCard
    ? [...ticketCard.querySelectorAll(".review-payment-button")]
    : [];

  relatedButtons.forEach((item) => {
    item.disabled = true;
  });

  try {
    const { error } = await db.rpc(
      "admin_review_ticket_payment",
      {
        p_ticket_id: Number(ticketId),
        p_approved: approved,
        p_note: note
      }
    );

    if (error) throw error;

    alert(
      approved
        ? "Pembayaran berhasil diverifikasi dan tiket disetujui."
        : "Bukti pembayaran ditolak. Anggota dapat mengunggah ulang bukti."
    );

    await Promise.all([
      loadAdminTickets(),
      loadAdminTicketHistory()
    ]);

  } catch (error) {
    console.error("Verifikasi pembayaran gagal:", error);

    alert(
      "Gagal memproses pembayaran: " +
      (error.message || "Terjadi kesalahan yang tidak diketahui.")
    );

    // Aktifkan kembali tombol jika proses gagal.
    relatedButtons.forEach((item) => {
      item.disabled = false;
    });

    button.textContent = originalText;
  }
});


// =====================================================
// ADMIN - RIWAYAT PEMBELI TIKET
// =====================================================

async function loadAdminTicketHistory() {
  const list = $("adminTicketHistoryList");
  if (!list) return;

  const { data: tickets, error: ticketError } = await db
    .from("ticket_requests")
    .select(`
      id,
      user_id,
      event_id,
      match_name,
      quantity,
      status,
      created_at,
      category_name_snapshot,
      stand_snapshot,
      unit_price_snapshot,
      payment_status
    `)
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
    (events || []).map((item) => [String(item.id), item])
  );

  const archivedEventIds = new Set(
    (events || [])
      .filter((item) => item.is_archived)
      .map((item) => String(item.id))
  );

  const history = (tickets || []).filter((ticket) => {
    return (
      archivedEventIds.has(String(ticket.event_id)) ||
      (!ticket.event_id && !isPendingTicket(ticket.status))
    );
  });

  if (!history.length) {
    list.textContent = "Belum ada riwayat pembeli tiket.";
    return;
  }

  try {
    const profiles = await getTicketProfiles(history);
    const groups = new Map();

    history.forEach((ticket) => {
      const key = ticket.event_id
        ? "event-" + String(ticket.event_id)
        : "match-" + String(ticket.match_name || "Pertandingan tidak diketahui");

      if (!groups.has(key)) groups.set(key, []);

      groups.get(key).push(ticket);
    });

    const sortedGroups = [...groups.entries()].sort((a, b) => {
      const newestA = Math.max(
        ...a[1].map((ticket) =>
          new Date(ticket.created_at || 0).getTime()
        )
      );

      const newestB = Math.max(
        ...b[1].map((ticket) =>
          new Date(ticket.created_at || 0).getTime()
        )
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
              <strong>
                ${escapeHTML(profile?.full_name || "Nama tidak ditemukan")}
              </strong>
              <span class="compact-buyer-status">
                ${escapeHTML(statusLabel(ticket.status))}
              </span>
            </div>

            <p>ID KTA:
              ${escapeHTML(profile?.membership_id || "Belum tersedia")}
            </p>
            <p>Kategori:
              ${escapeHTML(ticket.category_name_snapshot || "-")}
            </p>
            <p>Tribun:
              ${escapeHTML(ticket.stand_snapshot || "-")}
            </p>
            <p>Harga:
              ${escapeHTML(formatRupiah(ticket.unit_price_snapshot))}
            </p>
            <p>Status pembayaran:
              ${escapeHTML(paymentStatusLabel(ticket.payment_status))}
            </p>
            <p>Tanggal pesan:
              ${escapeHTML(formatDateTime(ticket.created_at))}
            </p>
          </div>
        `;
      }).join("");

      return `
        <details class="compact-record ticket-history-group"
          data-group="${escapeHTML(key)}">

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
              <strong>Tanggal pertandingan:</strong>
              ${escapeHTML(matchDate)}
            </p>

            ${event?.stadium
              ? `
                <p class="ticket-group-stadium">
                  <strong>Stadion:</strong>
                  ${escapeHTML(event.stadium)}
                </p>
              `
              : ""}

            <div class="compact-buyer-list">
              ${buyerRows}
            </div>
          </div>
        </details>
      `;
    }).join("");

  } catch (error) {
    list.textContent =
      "Gagal menampilkan riwayat tiket: " + error.message;
  }
}



// =====================================================
// LOGOUT
// =====================================================

document.querySelectorAll(".logoutButton").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      const { error } = await db.auth.signOut();

      if (error) throw error;

      showPublicPage();

    } catch (error) {
      console.error("Gagal logout:", error);

      alert("Gagal keluar dari akun: " + error.message);

      button.disabled = false;
    }
  });
});


// =====================================================
// PULIHKAN SESI LOGIN
// =====================================================

async function restoreSession() {
  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (!data.session) return;

    const profile = await getProfile(data.session.user.id);

    showDashboard(profile.role);

  } catch (error) {
    console.error("Gagal memulihkan sesi:", error);

    await db.auth.signOut();

    showPublicPage();
  }
}

restoreSession();


// =====================================================
// PANTAU PERUBAHAN STATUS LOGIN
// =====================================================

db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    showPublicPage();
  }
});
