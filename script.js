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

function showPublicPage() {
  $("memberPage").classList.add("hidden");
  $("adminPage").classList.add("hidden");
  document.querySelectorAll(".hero, .section").forEach((el) => {
    el.classList.remove("hidden");
  });
  $("login").scrollIntoView({ behavior: "smooth" });
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
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

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

// PENDAFTARAN KTA
$("ktaForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("ktaName").value.trim();
  const email = $("ktaEmail").value.trim();
  const phone = $("ktaPhone").value.trim();

  if (!name || !email || !phone) {
    showMessage("ktaMessage", "Lengkapi semua data.");
    return;
  }

  const button = event.submitter;
  button.disabled = true;
  button.textContent = "MENGIRIM...";

  try {
    const { error } = await db.from("kta_requests").insert({
      full_name: name,
      email: email,
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

// DASHBOARD ANGGOTA
async function loadMemberDashboard() {
  const { data: sessionData } = await db.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  try {
    const profile = await getProfile(user.id);

    $("memberName").textContent = profile.full_name || "-";
    $("memberId").textContent = profile.membership_id || "Belum tersedia";

    const { data, error } = await db
      .from("ticket_requests")
      .select("id, match_name, quantity, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    $("memberOrders").innerHTML = data.length
      ? data.map((order) => `
          <div class="data-item">
            <strong>${escapeHTML(order.match_name)}</strong>
            <p>Jumlah: ${escapeHTML(order.quantity)} tiket</p>
            <p>Status: ${escapeHTML(order.status)}</p>
          </div>
        `).join("")
      : "Belum ada pesanan.";
  } catch (error) {
    $("memberOrders").textContent = "Gagal memuat data: " + error.message;
  }
}

// PEMESANAN TIKET ANGGOTA
$("ticketForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const matchName = $("matchName").value.trim();
  const quantity = Number($("ticketQuantity").value);

  if (!matchName || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    showMessage("ticketMessage", "Isi pertandingan dan jumlah 1–10 tiket.");
    return;
  }

  try {
    const { data: sessionData } = await db.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw new Error("Silakan login kembali.");

    const { error } = await db.from("ticket_requests").insert({
      user_id: user.id,
      match_name: matchName,
      quantity,
      status: "pending"
    });

    if (error) throw error;

    showMessage("ticketMessage", "Permintaan tiket berhasil dikirim.", true);
    $("ticketForm").reset();
    $("ticketQuantity").value = 1;
    loadMemberDashboard();
  } catch (error) {
    showMessage("ticketMessage", "Pemesanan gagal: " + error.message);
  }
});

// DASHBOARD ADMIN
async function loadAdminDashboard() {
  try {
    const [ktaResult, memberResult, ticketResult] = await Promise.all([
      db.from("kta_requests")
        .select("id, full_name, email, status, created_at")
        .order("created_at", { ascending: false }),

      db.from("member_profiles")
        .select("id, full_name, role, membership_id")
        .eq("role", "member"),

      db.from("ticket_requests")
        .select("id, user_id, match_name, quantity, status, created_at")
        .order("created_at", { ascending: false })
    ]);

    if (ktaResult.error) throw ktaResult.error;
    if (memberResult.error) throw memberResult.error;
    if (ticketResult.error) throw ticketResult.error;

    const kta = ktaResult.data || [];
    const members = memberResult.data || [];
    const tickets = ticketResult.data || [];

    $("ktaCount").textContent = kta.length;
    $("memberCount").textContent = members.length;
    $("orderCount").textContent = tickets.length;

    $("adminKtaList").innerHTML = kta.length
      ? kta.map((item) => `
          <div class="data-item">
            <strong>${escapeHTML(item.full_name)}</strong>
            <p>${escapeHTML(item.email)}</p>
            <p>Status: ${escapeHTML(item.status)}</p>
            <select data-kta-id="${escapeHTML(item.id)}" class="kta-status">
              <option value="pending" ${item.status === "pending" ? "selected" : ""}>Menunggu</option>
              <option value="processing" ${item.status === "processing" ? "selected" : ""}>Diproses</option>
              <option value="completed" ${item.status === "completed" ? "selected" : ""}>Selesai</option>
            </select>
          </div>
        `).join("")
      : "Belum ada pengajuan KTA.";

    $("adminMemberList").innerHTML = members.length
      ? members.map((member) => `
          <div class="data-item">
            <strong>${escapeHTML(member.full_name)}</strong>
            <p>ID KTA: ${escapeHTML(member.membership_id || "Belum tersedia")}</p>
            <p>ID akun: ${escapeHTML(member.id)}</p>
          </div>
        `).join("")
      : "Belum ada data anggota.";

    $("adminTicketList").innerHTML = tickets.length
      ? tickets.map((ticket) => `
          <div class="data-item">
            <strong>${escapeHTML(ticket.match_name)}</strong>
            <p>ID akun: ${escapeHTML(ticket.user_id)}</p>
            <p>Jumlah: ${escapeHTML(ticket.quantity)} tiket</p>
            <p>Status: ${escapeHTML(ticket.status)}</p>
          </div>
        `).join("")
      : "Belum ada permintaan tiket.";

    document.querySelectorAll(".kta-status").forEach((select) => {
      select.addEventListener("change", async () => {
        const id = select.dataset.ktaId;

        const { error } = await db
          .from("kta_requests")
          .update({ status: select.value })
          .eq("id", id);

        if (error) {
          alert("Gagal mengubah status: " + error.message);
          loadAdminDashboard();
        }
      });
    });

  } catch (error) {
    $("adminKtaList").textContent =
      "Gagal memuat data. Periksa izin database: " + error.message;
  }
}

// LOGOUT
document.querySelectorAll(".logoutButton").forEach((button) => {
  button.addEventListener("click", async () => {
    await db.auth.signOut();
    $("memberPage").classList.add("hidden");
    $("adminPage").classList.add("hidden");
    document.querySelectorAll(".hero, .section").forEach((el) => {
      el.classList.remove("hidden");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// CEK SESI SAAT HALAMAN DIBUKA
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

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    $("memberPage").classList.add("hidden");
    $("adminPage").classList.add("hidden");
    document.querySelectorAll(".hero, .section").forEach((el) => {
      el.classList.remove("hidden");
    });
  }
});