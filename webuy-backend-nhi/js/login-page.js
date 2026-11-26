/* WeBuy | Trang đăng nhập / đăng ký (login.html).
 * - Sau khi đăng nhập quay về đúng trang trước đó (?next=...), chỉ chấp nhận trang nội bộ của WeBuy.
 * - Gộp giỏ hàng đang lưu trên trình duyệt vào giỏ của tài khoản (không nhân đôi số lượng).
 * - Đồng bộ tên/SĐT/địa chỉ của tài khoản về hồ sơ demo để trang thanh toán cũ tự điền.
 * Phiên đăng nhập (token) do Supabase SDK tự lưu và làm mới; file này không tự tạo hay đọc token.
 */
(() => {
  'use strict';
  const API = window.WeBuyAPI;
  const q = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);

  // Chỉ cho quay về trang .html của chính website (chặn chuyển hướng sang trang lạ)
  const next = (() => {
    const raw = params.get('next') || '';
    return /^[a-z0-9-]+\.html(\?[^#\s]*)?(#[\w-]*)?$/i.test(raw) && !/^login\.html/i.test(raw) ? raw : 'index.html';
  })();
  q('[data-back]').href = next;

  const message = q('#auth-message');
  function show(text, type = 'error') {
    message.textContent = text;
    message.className = `wb-alert wb-alert-${type}`;
    message.hidden = !text;
  }

  const reason = q('#auth-reason');
  if (/^seller-center/.test(next)) { reason.textContent = 'Đăng nhập để vào Seller Center và quản lý cửa hàng của bạn.'; reason.hidden = false; }
  else if (/^order-payment/.test(next)) { reason.textContent = 'Đăng nhập để xem và thanh toán đơn hàng của bạn.'; reason.hidden = false; }

  q('#auth-mode-note').textContent = API.mode === 'mock'
    ? 'Bản demo: tài khoản đang lưu trên trình duyệt này (chế độ mock).'
    : 'Tài khoản được lưu an toàn trên máy chủ WeBuy.';

  /* ---- Chuyển tab ---- */
  const tabs = [q('#tab-login'), q('#tab-signup')];
  function selectTab(tab, focus = false) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      q('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    show('');
    if (focus) tab.focus();
    const firstInput = q('#' + tab.getAttribute('aria-controls')).querySelector('input');
    if (!focus && firstInput) firstInput.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); selectTab(tabs[(i + 1) % 2], true); }
    });
  });
  if (params.get('tab') === 'signup') selectTab(tabs[1]);

  /* ---- Kiểm tra dữ liệu ---- */
  function fieldError(input, text) {
    const box = input.closest('.wb-field');
    let el = box.querySelector('.wb-field-error');
    if (!text) { input.removeAttribute('aria-invalid'); el?.remove(); return false; }
    input.setAttribute('aria-invalid', 'true');
    if (!el) { el = document.createElement('small'); el.className = 'wb-field-error'; el.id = input.id + '-error'; box.appendChild(el); }
    el.textContent = text;
    input.setAttribute('aria-describedby', el.id);
    return true;
  }
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  /* ---- Sau khi đăng nhập ---- */
  async function afterLogin() {
    // 1. Gộp giỏ localStorage cũ vào giỏ tài khoản (lỗi ở bước này không chặn đăng nhập)
    try {
      const local = JSON.parse(localStorage.getItem('webuy_demo_v2_cart') || '[]');
      if (Array.isArray(local) && local.length) {
        await API.cart.merge(local.map(i => ({ productId: String(i.productId), kind: i.kind === 'group' ? 'group' : 'retail', quantity: i.quantity, groupId: i.groupId || null })));
      }
    } catch (e) { console.warn('Không gộp được giỏ hàng:', e); }
    // 2. Đồng bộ hồ sơ về bản demo để các trang cũ hiển thị đúng tên
    try {
      const p = await API.profile.get();
      const old = JSON.parse(localStorage.getItem('webuy_demo_v2_profile') || '{}');
      localStorage.setItem('webuy_demo_v2_profile', JSON.stringify({ ...old, name: p.name || old.name || 'Khách WeBuy', email: p.email, phone: p.phone || old.phone || '', address: p.address || old.address || '' }));
    } catch (e) { console.warn('Không đồng bộ được hồ sơ:', e); }
    location.replace(next);
  }

  /* ---- Đăng nhập ---- */
  q('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const email = f.email.value.trim();
    const password = f.password.value;
    const bad = [fieldError(f.email, emailOk(email) ? '' : 'Email không hợp lệ.'), fieldError(f.password, password.length >= 6 ? '' : 'Mật khẩu có ít nhất 6 ký tự.')];
    if (bad.some(Boolean)) { f.querySelector('[aria-invalid="true"]').focus(); return; }
    show('');
    try {
      await API.ui.withLoading(f.querySelector('[type="submit"]'), () => API.auth.signIn({ email, password }), 'Đang đăng nhập…');
      show('Đăng nhập thành công, đang chuyển trang…', 'ok');
      await afterLogin();
    } catch (err) {
      show(API.ui.errorMessage(err));
      f.password.select();
    }
  });

  /* ---- Đăng ký ---- */
  q('#form-signup').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    const email = f.email.value.trim();
    const password = f.password.value;
    const bad = [
      fieldError(f.name, name.length >= 2 ? '' : 'Vui lòng nhập họ tên.'),
      fieldError(f.email, emailOk(email) ? '' : 'Email không hợp lệ.'),
      fieldError(f.password, password.length >= 6 ? '' : 'Mật khẩu cần ít nhất 6 ký tự.'),
      fieldError(f.confirm, f.confirm.value === password ? '' : 'Mật khẩu nhập lại không khớp.')
    ];
    if (bad.some(Boolean)) { f.querySelector('[aria-invalid="true"]').focus(); return; }
    show('');
    try {
      const res = await API.ui.withLoading(f.querySelector('[type="submit"]'), () => API.auth.signUp({ name, email, password }), 'Đang tạo tài khoản…');
      if (res.needsConfirmation) {
        show(`Đã gửi email xác nhận tới ${email}. Bấm vào liên kết trong email rồi quay lại đăng nhập.`, 'ok');
        selectTab(tabs[0]);
        q('#login-email').value = email;
        show(`Đã gửi email xác nhận tới ${email}. Bấm vào liên kết trong email rồi quay lại đăng nhập.`, 'ok');
        return;
      }
      show('Tạo tài khoản thành công, đang chuyển trang…', 'ok');
      await afterLogin();
    } catch (err) {
      show(API.ui.errorMessage(err));
      if (err.code === 'EMAIL_TAKEN') { selectTab(tabs[0]); q('#login-email').value = email; show(API.ui.errorMessage(err)); }
    }
  });

  // Đã đăng nhập sẵn thì không cần ở lại trang này
  API.auth.getSession().then(s => { if (s && !params.has('stay')) location.replace(next); }).catch(() => {});
})();
