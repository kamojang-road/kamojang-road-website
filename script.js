
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
    if (targetId === "ktaPanel") loadAdminKta();
    if (targetId === "memberPanel") loadAdminMembers();
    if (targetId === "ticketPanel") loadAdminTickets();

    targetPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

// PENDAFTARAN KTA
$("ktaForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("ktaName").value.trim();
  const email = $("ktaEmail").value.trim();
  const phone = $("ktaPhone").value.trim();
  const button = event.submitter;

  if (!name || !email || !phone) {
    showMessage("ktaMessage", "Lengkapi semua data.");
    return;
  }

  button.disabled = true;
  button.textContent = "MENGIRIM...";

  try {
    const { error } = await db.from("kta_requests").insert({
      full_name: name,
      email,
      status: "pending"
    });

    if (error) throw error;

    showMessage(
      "ktaMessage",
      "Pendaftaran tersimpan. Silakan lanjut menghubungi pengurus melalui WhatsApp.",
      true
    );

    const text = [
      "PENDAFTARAN KTA KAMOJANG ROAD",
      "Nama: " + name,
      "Email: " + email,
      "WhatsApp: " + phone
    ].join("\n");

    window.open(
      "https://wa.me/6285283234473?text=" + encodeURIComponent(text),
      "_blank"
    );

    $("ktaForm").reset();
  } catch (error) {
    showMessage("ktaMessage", "Pendaftaran gagal: " + error.message);
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

// AMBIL PERTANDINGAN AKTIF
async function getActiveMatch() {
  const { data, error } = await db
    .from("match_events")
    .select("id, home_team, away_team, match_date, stadium")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// DASHBOARD ANGGOTA
async function loadMemberDashboard() {
  const { data: sessionData } = await db.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) return;

  $("activeMatchInfo").textContent = "Memuat informasi pertandingan...";
  $("memberOrders").textContent = "Memuat pesanan...";
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
      .select("id, match_name, quantity, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (orderError) throw orderError;

    $("memberOrders").innerHTML = orders.length
      ? orders.map((order) => `
          <div class="data-item">
            <strong>${escapeHTML(order.match_name)}</strong>
            <p>${escapeHTML(order.quantity)} tiket pertandingan</p>
            <p>Status: ${escapeHTML(statusLabel(order.status))}</p>
          </div>
        `).join("")
      : "Belum ada pesanan.";

  } catch (error) {
    $("activeMatchInfo").textContent =
      "Gagal memuat pertandingan: " + error.message;

    $("memberOrders").textContent =
      "Gagal memuat pesanan: " + error.message;
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
      "Permintaan satu tiket berhasil dikirim. Menunggu persetujuan Admin.",
      true
    );

    await loadMemberDashboard();

  } catch (error) {
    showMessage("ticketMessage", "Pemesanan gagal: " + error.message);
  } finally {
    button.textContent = "AJUKAN PEMESANAN";

    try {
      const activeMatch = await getActiveMatch();
      button.disabled = !activeMatch;
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
    const { error: deactivateError } = await db
      .from("match_events")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) throw deactivateError;

    const { error: insertError } = await db
      .from("match_events")
      .insert({
        home_team: home,
        away_team: away,
        match_date: date,
        stadium,
        is_active: true
      });

    if (insertError) throw insertError;

    showMessage(
      "eventMessage",
      "Pertandingan aktif berhasil disimpan.",
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

// DAFTAR PERTANDINGAN ADMIN
async function loadAdminEvents() {
  const { data, error } = await db
    .from("match_events")
    .select("id, home_team, away_team, match_date, stadium, is_active, created_at")
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

          ${
            item.is_active
              ? `<button
                  class="btn btn-danger close-sales-button"
                  data-event-id="${escapeHTML(item.id)}"
                  type="button">
                  TUTUP PENJUALAN TIKET
                </button>`
              : `<p class="muted">Pertandingan ini tidak menerima pesanan baru.</p>`
          }
        </div>
      `).join("")
    : "Belum ada pertandingan.";

  document.querySelectorAll(".close-sales-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = confirm(
        "Tutup penjualan tiket pertandingan ini? Riwayat pesanan anggota tetap disimpan."
      );

      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "MENUTUP...";

      try {
        const { error: updateError } = await db
          .from("match_events")
          .update({ is_active: false })
          .eq("id", button.dataset.eventId);

        if (updateError) throw updateError;

        alert("Penjualan tiket berhasil ditutup. Riwayat pesanan tetap tersimpan.");

        await loadAdminEvents();

      } catch (error) {
        alert("Gagal menutup penjualan: " + error.message);
        button.disabled = false;
        button.textContent = "TUTUP PENJUALAN TIKET";
      }
    });
  });
}

// DASHBOARD ADMIN
async function loadAdminDashboard() {
  await Promise.all([
    loadAdminEvents(),
    loadAdminKta(),
    loadAdminMembers(),
    loadAdminTickets()
  ]);
}

// PENGAJUAN KTA ADMIN
async function loadAdminKta() {
  const { data, error } = await db
    .from("kta_requests")
    .select("id, full_name, email, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    $("adminKtaList").textContent =
      "Gagal memuat pengajuan KTA: " + error.message;
    return;
  }

  const items = data || [];

  $("ktaCount").textContent = items.length;
  $("ktaMenuCount").textContent = items.length;

  $("adminKtaList").innerHTML = items.length
    ? items.map((item) => `
        <div class="data-item">
          <strong>${escapeHTML(item.full_name)}</strong>
          <p>${escapeHTML(item.email)}</p>
          <p>Status: ${escapeHTML(statusLabel(item.status))}</p>

          <select data-kta-id="${escapeHTML(item.id)}" class="kta-status">
            <option value="pending" ${item.status === "pending" ? "selected" : ""}>Menunggu</option>
            <option value="processing" ${item.status === "processing" ? "selected" : ""}>Diproses</option>
            <option value="completed" ${item.status === "completed" ? "selected" : ""}>Selesai</option>
          </select>
        </div>
      `).join("")
    : "Belum ada pengajuan KTA.";

  document.querySelectorAll(".kta-status").forEach((select) => {
    select.addEventListener("change", async () => {
      const { error: updateError } = await db
        .from("kta_requests")
        .update({ status: select.value })
        .eq("id", select.dataset.ktaId);

      if (updateError) {
        alert("Gagal mengubah status KTA: " + updateError.message);
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
    .eq("role", "member");

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
        <div class="data-item">
          <strong>${escapeHTML(member.full_name)}</strong>
          <p>ID KTA: ${escapeHTML(member.membership_id || "Belum tersedia")}</p>
        </div>
      `).join("")
    : "Belum ada data anggota.";
}

// PERMINTAAN TIKET ADMIN
async function loadAdminTickets() {
  const { data, error } = await db
    .from("ticket_requests")
    .select("id, user_id, match_name, quantity, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    $("adminTicketList").textContent =
      "Gagal memuat tiket: " + error.message;
    return;
  }

  const tickets = data || [];

  $("orderCount").textContent = tickets.length;
  $("orderMenuCount").textContent = tickets.length;

  $("adminTicketList").innerHTML = tickets.length
    ? tickets.map((ticket) => `
        <div class="data-item">
          <strong>${escapeHTML(ticket.match_name)}</strong>
          <p>ID akun anggota: ${escapeHTML(ticket.user_id)}</p>
          <p>Jumlah: ${escapeHTML(ticket.quantity)} tiket</p>
          <p>Status: ${escapeHTML(statusLabel(ticket.status))}</p>

          ${
            ticket.status === "pending"
              ? `<button
                  class="btn btn-orange approve-ticket"
                  data-ticket-id="${escapeHTML(ticket.id)}"
                  type="button">
                  SETUJUI TIKET
                </button>`
              : ""
          }
        </div>
      `).join("")
    : "Belum ada permintaan tiket.";

  document.querySelectorAll(".approve-ticket").forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = confirm(
        "Pastikan pembayaran administrasi anggota sudah diterima. Setujui tiket ini?"
      );

      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "MEMPROSES...";

      const { error: updateError } = await db
        .from("ticket_requests")
        .update({ status: "approved" })
        .eq("id", button.dataset.ticketId);

      if (updateError) {
        alert("Gagal menyetujui tiket: " + updateError.message);
        button.disabled = false;
        button.textContent = "SETUJUI TIKET";
      } else {
        await loadAdminTickets();
      }
    });
  });
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
