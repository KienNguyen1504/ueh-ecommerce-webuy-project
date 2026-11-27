/* WeBuy — Yêu thích / Wishlist (Task 9).
 * - Nút tim: <button data-wish="ID"> trên thẻ sản phẩm (trang chủ, danh sách) và trang chi tiết
 *   (trang chi tiết dùng data-wish-from-url: lấy id từ ?id=).
 * - Lưu MẢNG ID (chuỗi, không trùng) trong localStorage "webuy_demo_v2_wishlist".
 * - Hồ sơ: khối #yeu-thich hiển thị danh sách; sản phẩm đã ẩn/không còn trong dữ liệu được đánh dấu
 *   "không còn hiển thị" và có nút xóa (không làm hỏng trang).
 * - Đồng bộ giữa các tab bằng sự kiện storage. Không đụng logic giỏ/nhóm của js/app.js
 *   (nút "Thêm vào giỏ" trong danh sách dùng lại data-add-cart do app.js xử lý).
 */
(() => {
  'use strict';
  const KEY = 'webuy_demo_v2_wishlist';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ';
  const products = () => window.WEBUY_PRODUCTS || [];
  const byId = id => products().find(p => String(p.id) === String(id));
  const urlId = () => new URLSearchParams(location.search).get('id') || '';

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(v)) return [];
      return [...new Set(v.map(x => String(x ?? '').trim()).filter(Boolean))].slice(0, 200);
    } catch { return []; }
  };
  let ids = read();
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { toast('Trình duyệt không cho lưu danh sách yêu thích.', true); } };

  const has = id => ids.includes(String(id));
  const visibleIds = () => ids.filter(id => byId(id));
  const hiddenIds = () => ids.filter(id => !byId(id));

  let toastTimer = 0;
  function toast(message, isError) {
    const el = document.getElementById('app-toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'app-toast show' + (isError ? ' is-error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function set(id, on) {
    id = String(id);
    if (!id) return false;
    const now = has(id);
    if (on === now) return now;
    if (on) ids.unshift(id); else ids = ids.filter(x => x !== id);
    write();
    refresh();
    document.dispatchEvent(new CustomEvent('webuy:wishlist', { detail: { id, on, ids: ids.slice() } }));
    return on;
  }
  const toggle = id => set(id, !has(id));

  /* ---------- Đồng bộ nút tim ---------- */
  function syncButtons(root = document) {
    root.querySelectorAll('[data-wish-from-url]').forEach(b => {
      const id = urlId();
      if (b.dataset.wish !== id) b.dataset.wish = id;
      b.hidden = !byId(id);
    });
    root.querySelectorAll('[data-wish]').forEach(b => {
      const id = b.dataset.wish;
      const on = !!id && has(id);
      const name = byId(id)?.name || 'sản phẩm';
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-label', on ? `Bỏ ${name} khỏi yêu thích` : `Thêm ${name} vào yêu thích`);
      b.title = on ? 'Bỏ yêu thích' : 'Yêu thích';
      const label = b.querySelector('.wish-label');
      if (label) label.textContent = on ? 'Đã yêu thích' : 'Yêu thích';
    });
  }

  /* ---------- Lối tắt trên header (tim + số lượng) ---------- */
  function headerLink() {
    const actions = document.querySelector('.header-actions');
    if (!actions) return;
    let link = actions.querySelector('.header-wish');
    if (!link) {
      link = document.createElement('a');
      link.className = 'header-wish fx-press';
      link.href = 'profile.html#yeu-thich';
      link.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20.3s-7.4-4.4-9.2-9.1C1.5 7.7 3.7 4.6 7 4.6c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.3 0 5.5 3.1 4.2 6.6-1.8 4.7-9.2 9.1-9.2 9.1z"></path></svg><span class="wish-counter" data-wish-count></span>';
      const cart = actions.querySelector('.header-cart');
      actions.insertBefore(link, cart || null);
    }
    const n = visibleIds().length;
    link.setAttribute('aria-label', `Yêu thích của tôi: ${n} sản phẩm`);
    const c = link.querySelector('[data-wish-count]');
    if (c) { c.textContent = n > 99 ? '99+' : String(n); c.hidden = n === 0; }
  }

  /* ---------- Khối "Yêu thích của tôi" trong Hồ sơ ---------- */
  function renderProfile() {
    const box = document.getElementById('wishlist-list');
    if (!box) return;
    const vis = visibleIds(), hid = hiddenIds();
    const count = document.querySelector('[data-wish-total]');
    if (count) count.textContent = vis.length ? `(${vis.length})` : '';
    const clearBtn = document.querySelector('[data-wish-clear-hidden]');
    if (clearBtn) clearBtn.hidden = hid.length === 0;
    if (!ids.length) {
      box.innerHTML = '<div class="wish-empty"><span aria-hidden="true">♡</span><p>Chưa có kết quả trong danh sách yêu thích. Bấm biểu tượng tim trên thẻ sản phẩm để lưu lại.</p><a class="btn btn-outline" href="products.html#tat-ca-danh-muc">Tìm sản phẩm khác</a></div>';
      return;
    }
    box.innerHTML = vis.map(id => {
      const p = byId(id), url = `product-detail.html?id=${encodeURIComponent(id)}`;
      return `<article class="wish-item">
        <a class="wish-thumb fx-skeleton" href="${url}"><img src="${esc(p.image)}" alt="" width="72" height="72" loading="lazy" decoding="async"></a>
        <div class="wish-info">
          <a class="wish-name" href="${url}">${esc(p.name)}</a>
          <small>${esc(p.category)} · giá nhóm từ ${Number(p.minMembers) || 1} người</small>
          <div class="wish-price"><strong>${money(p.group)}</strong><s>${money(p.retail)}</s></div>
        </div>
        <div class="wish-actions">
          <button class="wish-cart fx-press" type="button" data-add-cart="${esc(id)}">+ Giỏ</button>
          <button class="wish-remove fx-press" type="button" data-wish-remove="${esc(id)}" aria-label="Xóa ${esc(p.name)} khỏi yêu thích">Xóa</button>
        </div>
      </article>`;
    }).join('') + hid.map(id => `<article class="wish-item is-hidden">
        <div class="wish-thumb wish-thumb-off" aria-hidden="true">?</div>
        <div class="wish-info"><span class="wish-name">Sản phẩm không còn hiển thị</span><small>Mã ${esc(id)} đã bị ẩn hoặc gỡ khỏi WeBuy.</small></div>
        <div class="wish-actions"><button class="wish-remove fx-press" type="button" data-wish-remove="${esc(id)}" aria-label="Xóa sản phẩm mã ${esc(id)} khỏi yêu thích">Xóa</button></div>
      </article>`).join('');
  }

  function refresh() {
    syncButtons();
    headerLink();
    renderProfile();
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', e => {
    const btn = e.target instanceof Element ? e.target.closest('[data-wish],[data-wish-remove],[data-wish-clear-hidden]') : null;
    if (!btn) return;
    if (btn.hasAttribute('data-wish-clear-hidden')) {
      const n = hiddenIds().length;
      ids = ids.filter(id => byId(id)); write(); refresh();
      toast(`Đã dọn ${n} sản phẩm không còn hiển thị.`);
      return;
    }
    if (btn.hasAttribute('data-wish-remove')) {
      const id = btn.dataset.wishRemove;
      set(id, false);
      toast('Đã xóa khỏi danh sách yêu thích.');
      document.getElementById('wishlist-list')?.querySelector('button, a')?.focus();
      return;
    }
    e.preventDefault();
    const id = btn.dataset.wish;
    if (!id || !byId(id)) { toast('Không tìm thấy sản phẩm này.', true); return; }
    const on = toggle(id);
    window.WeBuyFX?.pop(btn);
    toast(on ? `Đã thêm ${byId(id).name} vào Yêu thích.` : `Đã bỏ ${byId(id).name} khỏi Yêu thích.`);
  });

  window.addEventListener('storage', e => { if (e.key === KEY) { ids = read(); refresh(); } });

  const start = () => {
    refresh();
    // thẻ sản phẩm được vẽ lại khi lọc/sắp xếp: đồng bộ trạng thái tim cho nút mới
    new MutationObserver(list => {
      if (list.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches('[data-wish],.header-actions') || n.querySelector('[data-wish]'))))) syncButtons();
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.WeBuyWishlist = { has, toggle, list: () => ids.slice(), visible: visibleIds, hidden: hiddenIds, refresh };
})();
