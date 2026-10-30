'use strict';

const menuToggle = document.getElementById('menuToggle');
const nav = document.getElementById('nav');

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Tutup menu' : 'Buka menu');
    menuToggle.textContent = isOpen ? '×' : '☰';
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Buka menu');
      menuToggle.textContent = '☰';
    });
  });
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const ktaForm = document.getElementById('ktaForm');
if (ktaForm) {
  ktaForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!ktaForm.reportValidity()) return;

    const name = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const extra = document.getElementById('message').value.trim();
    const text = [
      'Halo Pengurus Kamojang Road, saya berminat mendaftar KTA.',
      `Nama: ${name}`,
      `Nomor WhatsApp: ${phone}`,
      extra ? `Pesan: ${extra}` : ''
    ].filter(Boolean).join('\n');

    const whatsappUrl = `https://wa.me/6285283234473?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  });
}
