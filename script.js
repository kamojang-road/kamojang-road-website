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
  link.addEventListener("click", () => $("nav").classList.remove("open"));
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

    targetPanel.scrollIntoView({ behavior: "smooth", block: "start" });
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
    showMessage("loginMessage", "Permintaan reset dikirim. Periksa email.", true);
  }
});

// PANGGIL EDGE FUNCTION manage-kta
async function callManageKta(payload) {
  const { data, error } = await db.functions.invoke("manage-kta", {
    body: payload
  });

  if (error) {
    let message = error.message || "Edge Function gagal dijalankan.";
    try {
      const details = await error.context.json();
      if (details?.error) message = details.error;
    } catch (_) {
      // Gunakan pesan error standar jika respons bukan JSON.
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

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
    $("memberId").textContent = profile.membership_id || "Belum tersedia";

    const activeMatch = await getActiveMatch();

    if (activeMatch) {
      $("activeMatchInfo").innerHTML = `
        <div class="data-item">
          <strong>${escapeHTML(activeMatch.home_team)} vs ${escapeHTML(activeMatch.away_team)}</strong>
          <p>Tanggal: ${escapeHTML(formatDate(activeMatch.match_date))}</p>
          <p>Stadion: ${escapeHTML(activeMatch.stadium)}</p>
        </div>`;
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
          </div>`).join("")
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
    if (!activeMatch) throw new Error("Penjualan tiket sedang ditutup.");

    const matchName = activeMatch.home_team + " vs " + activeMatch.away_team;

    const { error } = await db.from("ticket_requests").insert({
      user_id: user.id,
      event_id: activeMatch.id,
      match_name: matchName,
      quantity: 1,
      status: "pending"
    });

    if (error?.code === "23505") {
      throw new Error("KTA ini sudah digunakan untuk memesan tiket pertandingan tersebut.");
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
    showMessage("eventMessage", "Lengkapi semua informasi pertandingan.");
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

    const { error: insertError } = await db.from("match_events").insert({
      home_team: home,
      away_team: away,
      match_date: date,
      stadium,
      is_active: true
    });
    if (insertError) throw insertError;

    showMessage("eventMessage", "Pertandingan aktif berhasil disimpan.", true);
    $("eventForm").reset();
    $("eventHome").value = "Persija Jakarta";
    await loadAdminEvents();
  } catch (error) {
    showMessage("eventMessage", "Gagal menyimpan pertandingan: " + error.message);
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
    $("adminEventList").textContent = "Gagal memuat pertandingan: " + error.message;
    return;
  }

  $("adminEventList").innerHTML = data.length
    ? data.map((item) => `
        <div class="data-item">
          <strong>${escapeHTML(item.home_team)} vs ${escapeHTML(item.away_team)}</strong>
          <p>Tanggal: ${escapeHTML(formatDate(item.match_date))}</p>
          <p>Stadion: ${escapeHTML(item.stadium)}</p>
          <p class="${item.is_active ? "status-open" : "status-closed"}">
            ${item.is_active ? "PENJUALAN TIKET DIBUKA" : "PENJUALAN DITUTUP"}
          </p>
          ${item.is_active
            ? `<button class="btn btn-danger close-sales-button"
                 data-event-id="${escapeHTML(item.id)}" type="button">
                 TUTUP PENJUALAN TIKET
               </button>`
            : `<p class="muted">Pertandingan ini tidak menerima pesanan baru.</p>`}
        </div>`).join("")
    : "Belum ada pertandingan.";

  document.querySelectorAll(".close-sales-button").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Tutup penjualan tiket pertandingan ini? Riwayat pesanan tetap disimpan.")) return;

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
    $("adminKtaList").textContent = "Gagal memuat pengajuan KTA: " + error.message;
    return;
  }

  const items = (data || []).filter((item) => item.status !== "approved");
  $("ktaCount").textContent = items.length;
  $("ktaMenuCount").textContent = items.length;

  $("adminKtaList").innerHTML = items.length
    ? items.map((item) => `
        <div class="data-item">
          <strong>${escapeHTML(item.full_name)}</strong>
          <p>${escapeHTML(item.email)}</p>
          <p>Status: ${escapeHTML(statusLabel(item.status))}</p>
          <div class="member-edit-fields">
            <label>Status pengajuan</label>
            <select data-kta-id="${escapeHTML(item.id)}" class="kta-status">
              <option value="pending" ${item.status === "pending" ? "selected" : ""}>Menunggu</option>
              <option value="processing" ${item.status === "processing" ? "selected" : ""}>Diproses</option>
              <option value="completed" ${item.status === "completed" ? "selected" : ""}>Selesai</option>
            </select>
          </div>
          <button class="btn btn-orange approve-kta-button"
            data-request-id="${escapeHTML(item.id)}" type="button">
            SETUJUI KTA & BUAT AKUN ANGGOTA
          </button>
        </div>`).join("")
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
      } else {
        await loadAdminKta();
      }
      select.disabled = false;
    });
  });

  document.querySelectorAll(".approve-kta-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = confirm(
        "Setujui pengajuan ini? Sistem akan membuat profil anggota dan mengirim undangan akun ke email pendaftar."
      );
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "MEMPROSES...";

      try {
        const result = await callManageKta({
          action: "approve",
          requestId: button.dataset.requestId
        });

        alert(
          "Pengajuan KTA berhasil disetujui.\nID KTA: " +
          (result.membershipId || "Sudah tersedia") +
          "\nUndangan akun akan dikirim ke email pendaftar jika akun baru dibuat."
        );

        await Promise.all([loadAdminKta(), loadAdminMembers()]);
      } catch (error) {
        alert("Gagal menyetujui KTA: " + error.message);
        button.disabled = false;
        button.textContent = "SETUJUI KTA & BUAT AKUN ANGGOTA";
      }
    });
  });
}

// DATA ANGGOTA ADMIN - NAMA DAN ID KTA BISA DIEDIT
async function loadAdminMembers() {
  const { data, error } = await db
    .from("member_profiles")
    .select("id, full_name, role, membership_id")
    .eq("role", "member")
    .order("full_name", { ascending: true });

  if (error) {
    $("adminMemberList").textContent = "Gagal memuat anggota: " + error.message;
    return;
  }

  const members = data || [];
  $("memberCount").textContent = members.length;
  $("memberMenuCount").textContent = members.length;

  $("adminMemberList").innerHTML = members.length
    ? members.map((member) => `
        <div class="data-item member-edit-card">
          <strong>${escapeHTML(member.full_name || "Tanpa nama")}</strong>
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
          <button class="btn btn-orange save-member-button"
            data-member-id="${escapeHTML(member.id)}" type="button">
            SIMPAN PERUBAHAN
          </button>
          <p class="member-save-message message" aria-live="polite"></p>
        </div>`).join("")
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

// PERMINTAAN TIKET ADMIN - TAMPILKAN NAMA ANGGOTA, BUKAN UUID
async function loadAdminTickets() {
  const { data, error } = await db
    .from("ticket_requests")
    .select("id, user_id, match_name, quantity, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    $("adminTicketList").textContent = "Gagal memuat tiket: " + error.message;
    return;
  }

  const tickets = data || [];
  const userIds = [...new Set(tickets.map((ticket) => ticket.user_id).filter(Boolean))];
  let profiles = [];

  if (userIds.length > 0) {
    const { data: profileData, error: profileError } = await db
      .from("member_profiles")
      .select("id, full_name, membership_id")
      .in("id", userIds);

    if (profileError) {
      $("adminTicketList").textContent =
        "Gagal memuat nama anggota: " + profileError.message;
      return;
    }
    profiles = profileData || [];
  }

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  $("orderCount").textContent = tickets.length;
  $("orderMenuCount").textContent = tickets.length;

  $("adminTicketList").innerHTML = tickets.length
    ? tickets.map((ticket) => {
        const member = profileMap.get(ticket.user_id);
        return `
          <div class="data-item">
            <strong>${escapeHTML(ticket.match_name)}</strong>
            <p>Nama Anggota: ${escapeHTML(member?.full_name || "Nama tidak ditemukan")}</p>
            <p>ID KTA: ${escapeHTML(member?.membership_id || "Belum tersedia")}</p>
            <p>Jumlah: ${escapeHTML(ticket.quantity)} tiket</p>
            <p>Status: ${escapeHTML(statusLabel(ticket.status))}</p>
            ${ticket.status === "pending"
              ? `<button class="btn btn-orange approve-ticket"
                   data-ticket-id="${escapeHTML(ticket.id)}" type="button">
                   SETUJUI TIKET
                 </button>`
              : ""}
          </div>`;
      }).join("")
    : "Belum ada permintaan tiket.";

  document.querySelectorAll(".approve-ticket").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Pastikan pembayaran anggota sudah diterima. Setujui tiket ini?")) return;

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
  if (event === "SIGNED_OUT") showPublicPage();
});
