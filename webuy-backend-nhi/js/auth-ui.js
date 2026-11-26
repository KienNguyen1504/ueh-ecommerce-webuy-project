/* WeBuy | Giao diện tài khoản dùng chung (checklist: "Giao diện Auth và vai trò").
 *
 *  - Header: chưa đăng nhập -> nút "Đăng nhập" (về lại đúng trang đang xem sau khi đăng nhập);
 *            đã đăng nhập  -> menu tài khoản: tên, vai trò, thông báo, Hồ sơ, Seller Center, Đăng xuất.
 *  - Trang có <body data-require-auth="..."> (Seller Center): chưa đăng nhập thì hiện hướng dẫn đăng nhập.
 *  - Trang Hồ sơ: đọc/lưu họ tên, SĐT, địa chỉ qua API để đăng nhập máy khác vẫn thấy;
 *                 hiện danh sách đơn hàng trên tài khoản.
 * Vai trò (buyer/seller/admin) luôn đọc từ backend, không đọc từ dữ liệu trình duyệt.
 * Cần nạp js/api-config.js và js/api-client.js trước file này.
 */
(() => {
  'use strict';
  const API = window.WeBuyAPI;
  if (!API) { console.warn('auth-ui: chưa nạp js/api-client.js'); return; }

  const page = location.pathname.split('/').pop() || 'index.html';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ';
  const ROLE_LABEL = { buyer: 'Người mua', seller: 'Người bán', admin: 'Quản trị' };
  const STATUS_LABEL = { DRAFT: 'Nháp', PENDING: 'Chờ thanh toán', PAID_DEMO: 'Đã thanh toán (mô phỏng)', CANCELLED: 'Đã hủy', REFUNDED_DEMO: 'Đã hoàn tiền (mô phỏng)' };
  const loginUrl = () => 'login.html?next=' + encodeURIComponent(page + location.search + location.hash);
  const initials = (name, email) => ((name || '').trim() || (email || 'W').split('@')[0]).split(/\s+/).slice(-2).map(x => x[0]).join('').toUpperCase().slice(0, 2);

  let session = null;
  let profile = null;

  /* ---------------------------------------------------------------- Header */
  function renderHeader() {
    document.querySelectorAll('.header-avatar').forEach(link => {
      const wrap = link.closest('.wb-account') || wrapAvatar(link);
      const avatar = link.querySelector('[data-avatar]');
      const caption = link.querySelector('.avatar-caption');
      wrap.querySelector('.wb-account-menu')?.remove();

      if (!session) {
        link.href = loginUrl();
        link.removeAttribute('aria-haspopup');
        link.removeAttribute('aria-expanded');
        link.setAttribute('aria-label', 'Đăng nhập hoặc đăng ký');
        if (avatar) avatar.textContent = '→';
        if (caption) caption.textContent = 'Đăng nhập';
        return;
      }

      link.href = 'profile.html';
      link.setAttribute('aria-haspopup', 'menu');
      link.setAttribute('aria-expanded', 'false');
      link.setAttribute('aria-label', 'Tài khoản của ' + (profile?.name || session.user.email));
      if (avatar) avatar.textContent = initials(profile?.name, session.user.email);
      if (caption) caption.textContent = (profile?.name || session.user.email).split(/\s+/).slice(-1)[0];

      const isSeller = ['seller', 'admin'].includes(profile?.role);
      const menu = document.createElement('div');
      menu.className = 'wb-account-menu';
      menu.hidden = true;
      menu.setAttribute('role', 'menu');
      menu.innerHTML = `
        <div class="wb-account-head">
          <strong>${esc(profile?.name || 'Tài khoản WeBuy')}</strong>
          <span>${esc(session.user.email)}</span>
          <em class="wb-role wb-role-${esc(profile?.role || 'buyer')}">${ROLE_LABEL[profile?.role] || 'Người mua'}</em>
        </div>
        <div class="wb-notify">
          <div class="wb-notify-head"><span>Thông báo</span><button type="button" data-wb-read-all>Đánh dấu đã đọc</button></div>
          <ul class="wb-notify-list" data-wb-notify-list><li class="wb-notify-empty">Đang tải…</li></ul>
        </div>
        <a role="menuitem" href="profile.html">Hồ sơ của tôi</a>
        <a role="menuitem" href="order-payment.html">Đơn hàng trên tài khoản</a>
        <a role="menuitem" href="seller-center.html">${isSeller ? 'Seller Center' : 'Đăng ký bán hàng'}</a>
        <button type="button" role="menuitem" data-wb-logout>Đăng xuất</button>`;
      wrap.appendChild(menu);
    });
    refreshBadge();
  }

  function wrapAvatar(link) {
    const wrap = document.createElement('div');
    wrap.className = 'wb-account';
    link.parentNode.insertBefore(wrap, link);
    wrap.appendChild(link);
    const badge = document.createElement('span');
    badge.className = 'wb-badge';
    badge.hidden = true;
    badge.setAttribute('data-wb-badge', '');
    wrap.appendChild(badge);
    return wrap;
  }

  function toggleMenu(wrap, open) {
    const menu = wrap.querySelector('.wb-account-menu');
    const link = wrap.querySelector('.header-avatar');
    if (!menu) return;
    menu.hidden = !open;
    link.setAttribute('aria-expanded', String(open));
    if (open) loadNotifications(menu);
  }

  async function refreshBadge() {
    const badges = document.querySelectorAll('[data-wb-badge]');
    if (!session) { badges.forEach(b => { b.hidden = true; }); return; }
    try {
      const n = await API.notifications.list(1);
      badges.forEach(b => { b.hidden = !n.unread; b.textContent = n.unread > 9 ? '9+' : n.unread; b.setAttribute('aria-label', `${n.unread} thông báo chưa đọc`); });
    } catch { /* lỗi mạng: bỏ qua huy hiệu, không chặn trang */ }
  }

  async function loadNotifications(menu) {
    const list = menu.querySelector('[data-wb-notify-list]');
    try {
      const n = await API.notifications.list(6);
      list.innerHTML = n.items.length ? n.items.map(i => `
        <li class="${i.read ? '' : 'is-unread'}">
          <a href="${esc(i.link || 'profile.html')}"><strong>${esc(i.title)}</strong>${i.body ? `<span>${esc(i.body)}</span>` : ''}
          <time>${new Date(i.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</time></a>
        </li>`).join('') : '<li class="wb-notify-empty">Chưa có thông báo.</li>';
    } catch (e) {
      list.innerHTML = `<li class="wb-notify-empty">${esc(API.ui.errorMessage(e))} <button type="button" data-wb-retry>Thử lại</button></li>`;
    }
  }

  /* ---------------------------------------------------------------- Trang yêu cầu đăng nhập */
  function renderGate() {
    const need = document.body.dataset.requireAuth;
    const old = document.getElementById('wb-auth-gate');
    if (!need) return;
    if (session) {
      old?.remove();
      document.querySelectorAll('[data-wb-gated]').forEach(el => { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); el.removeAttribute('data-wb-gated'); });
      return;
    }
    if (old) return;
    [...document.body.children].forEach(el => {
      if (el.tagName === 'SCRIPT' || el.hasAttribute('inert')) return;
      el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); el.setAttribute('data-wb-gated', '');
    });
    const title = need === 'seller-center' ? 'Đăng nhập để vào Seller Center' : 'Bạn cần đăng nhập';
    const text = need === 'seller-center'
      ? 'Seller Center chỉ dành cho tài khoản đã đăng nhập. Sau khi đăng nhập, bạn có thể đăng ký cửa hàng và quản lý sản phẩm của riêng mình.'
      : 'Trang này chứa dữ liệu riêng của tài khoản. Hãy đăng nhập để tiếp tục.';
    const gate = document.createElement('div');
    gate.id = 'wb-auth-gate';
    gate.className = 'wb-gate';
    gate.innerHTML = `
      <section class="wb-gate-card" role="dialog" aria-modal="true" aria-labelledby="wb-gate-title">
        <img src="images/logo-mark.png" alt="" width="56" height="56">
        <h1 id="wb-gate-title">${title}</h1>
        <p>${text}</p>
        <a class="wb-btn wb-btn-primary" href="${loginUrl()}">Đăng nhập / Đăng ký</a>
        <a class="wb-btn wb-btn-ghost" href="index.html">Về trang chủ</a>
      </section>`;
    document.body.appendChild(gate);
    gate.querySelector('.wb-btn-primary').focus();
  }

  /* ---------------------------------------------------------------- Trang Hồ sơ */
  async function syncProfilePage() {
    if (page !== 'profile.html') return;
    const form = document.getElementById('profile-form');
    const box = document.getElementById('wb-account-orders');
    if (!session) {
      if (box) box.innerHTML = `<p class="muted">Bạn đang xem hồ sơ demo trên trình duyệt. <a href="${loginUrl()}">Đăng nhập</a> để lưu hồ sơ và đơn hàng vào tài khoản.</p>`;
      return;
    }
    if (form && profile) {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      set('profile-name', profile.name);
      set('profile-phone', profile.phone);
      set('profile-address', profile.address);
      const email = document.getElementById('profile-email');
      if (email) { email.value = session.user.email; email.readOnly = true; email.title = 'Email đăng nhập, không đổi tại đây'; }
      const sum = document.getElementById('profile-summary-name');
      if (sum && profile.name) sum.textContent = profile.name;
    }
    renderAccountOrders();
  }

  async function renderAccountOrders() {
    const box = document.getElementById('wb-account-orders');
    if (!box || !session) return;
    box.innerHTML = '<div class="wb-skeleton"></div><div class="wb-skeleton"></div>';
    try {
      const orders = await API.orders.list(10);
      box.innerHTML = orders.length ? `<ul class="wb-order-list">${orders.map(o => `
        <li><a href="order-payment.html?id=${encodeURIComponent(o.id)}">
          <strong>${esc(o.id)}</strong>
          <span class="wb-status wb-status-${esc(o.status)}">${STATUS_LABEL[o.status] || esc(o.status)}</span>
          <span>${o.items.length} sản phẩm · ${money(o.total)}</span>
          <time>${new Date(o.createdAt).toLocaleString('vi-VN')}</time></a></li>`).join('')}</ul>`
        : '<p class="muted">Tài khoản chưa có đơn hàng nào.</p>';
    } catch (e) {
      box.innerHTML = `<p class="wb-error">${esc(API.ui.errorMessage(e))} <button type="button" class="wb-link-btn" data-wb-orders-retry>Thử lại</button></p>`;
    }
  }

  // Lưu hồ sơ: chạy trước js/app.js (pha capture) để gửi lên tài khoản; app.js vẫn lưu bản demo như cũ
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'profile-form' || !session) return;
    const f = e.target;
    const values = { name: f.elements.name?.value || '', phone: f.elements.phone?.value || '', address: f.elements.address?.value || '' };
    const btn = f.querySelector('[type="submit"]');
    try {
      profile = await API.ui.withLoading(btn, () => API.profile.update(values), 'Đang lưu…');
      renderHeader();
      showNote(f, 'Đã lưu hồ sơ vào tài khoản. Đăng nhập trên máy khác vẫn thấy thông tin này.');
    } catch (err) {
      showNote(f, API.ui.errorMessage(err), true);
    }
  }, true);

  function showNote(form, text, isError = false) {
    let note = form.querySelector('.wb-form-note');
    if (!note) { note = document.createElement('p'); note.className = 'wb-form-note'; note.setAttribute('role', 'status'); form.appendChild(note); }
    note.textContent = text;
    note.classList.toggle('is-error', isError);
  }

  /* ---------------------------------------------------------------- Sự kiện chung */
  document.addEventListener('click', async e => {
    const avatar = e.target.closest('.wb-account .header-avatar');
    if (avatar && session) {
      e.preventDefault();
      const wrap = avatar.closest('.wb-account');
      toggleMenu(wrap, wrap.querySelector('.wb-account-menu').hidden);
      return;
    }
    if (e.target.closest('[data-wb-logout]')) {
      await API.auth.signOut();
      location.href = 'index.html';
      return;
    }
    if (e.target.closest('[data-wb-read-all]')) {
      const menu = e.target.closest('.wb-account-menu');
      try { await API.notifications.markRead(); } catch { /* thử lại sau */ }
      loadNotifications(menu); refreshBadge();
      return;
    }
    if (e.target.closest('[data-wb-retry]')) { loadNotifications(e.target.closest('.wb-account-menu')); return; }
    if (e.target.closest('[data-wb-orders-retry]')) { renderAccountOrders(); return; }
    // Bấm ra ngoài thì đóng menu
    document.querySelectorAll('.wb-account').forEach(w => { if (!w.contains(e.target)) toggleMenu(w, false); });
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.wb-account').forEach(w => {
      if (w.querySelector('.wb-account-menu:not([hidden])')) { toggleMenu(w, false); w.querySelector('.header-avatar').focus(); }
    });
  });

  async function refresh() {
    try {
      session = await API.auth.getSession();
      profile = session ? await API.profile.get() : null;
    } catch (e) {
      console.warn('auth-ui:', e);
      if (e.status === 401) { session = null; profile = null; }
    }
    renderHeader();
    renderGate();
    syncProfilePage();
    window.dispatchEvent(new CustomEvent('webuy:session', { detail: { session, profile } }));
  }

  function start() {
    // Trang Hồ sơ: thêm khối "Đơn hàng trên tài khoản"
    if (page === 'profile.html' && !document.getElementById('wb-account-orders')) {
      const orders = document.getElementById('my-orders');
      if (orders) orders.insertAdjacentHTML('beforebegin', `
        <section class="panel profile-panel" id="my-account-orders">
          <p class="eyebrow"><span></span>Lưu trên tài khoản</p>
          <h2>Đơn hàng trên tài khoản</h2>
          <div id="wb-account-orders"></div>
        </section>`);
    }
    refresh();
    API.auth.onChange(() => refresh());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.WeBuyAuthUI = { refresh, getSession: () => session, getProfile: () => profile };
})();
