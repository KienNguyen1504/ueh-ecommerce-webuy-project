/* WeBuy — So sánh sản phẩm (Task 10).
 * - Nút <button data-compare="ID"> trên thẻ sản phẩm và trang chi tiết (data-compare-from-url).
 * - Chọn tối đa 3 sản phẩm (cùng hoặc khác danh mục); lưu ID trong localStorage "webuy_demo_v2_compare".
 * - Khay so sánh cố định đáy màn hình + hộp thoại bảng so sánh: giá lẻ, giá nhóm, tiết kiệm,
 *   số thành viên tối thiểu, mô tả ngắn, nút Xóa mục / Đóng, đường dẫn xem chi tiết.
 * - Dữ liệu lấy đúng từ WEBUY_PRODUCTS (cùng nguồn với danh sách, chi tiết, giỏ hàng).
 * - Mobile: bảng cuộn ngang, cột tiêu chí cố định, có dòng hướng dẫn vuốt.
 */
(() => {
  'use strict';
  const KEY = 'webuy_demo_v2_compare';
  const MAX = 3;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ';
  const products = () => window.WEBUY_PRODUCTS || [];
  const byId = id => products().find(p => String(p.id) === String(id));
  const urlId = () => new URLSearchParams(location.search).get('id') || '';
  const short = (t, n = 110) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(v)) return [];
      // bỏ id trùng và sản phẩm không còn trong dữ liệu
      return [...new Set(v.map(x => String(x ?? '')))].filter(id => byId(id)).slice(0, MAX);
    } catch { return []; }
  };
  let ids = [];
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* bỏ qua */ } };
  const has = id => ids.includes(String(id));

  let toastTimer = 0;
  function toast(message, isError) {
    const el = document.getElementById('app-toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'app-toast show' + (isError ? ' is-error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function add(id) {
    id = String(id);
    if (has(id)) return true;
    if (!byId(id)) { toast('Không tìm thấy sản phẩm này.', true); return false; }
    if (ids.length >= MAX) { toast(`Chỉ so sánh tối đa ${MAX} sản phẩm. Bỏ bớt một mục trong khay so sánh.`, true); tray?.classList.add('is-shake'); setTimeout(() => tray?.classList.remove('is-shake'), 500); return false; }
    ids.push(id); write(); refresh();
    return true;
  }
  function remove(id) { ids = ids.filter(x => x !== String(id)); write(); refresh(); }
  function clear() { ids = []; write(); refresh(); }

  /* ---------- Nút so sánh ---------- */
  function syncButtons() {
    document.querySelectorAll('[data-compare-from-url]').forEach(b => {
      const id = urlId();
      if (b.dataset.compare !== id) b.dataset.compare = id;
      b.hidden = !byId(id);
    });
    document.querySelectorAll('[data-compare]').forEach(b => {
      const id = b.dataset.compare, on = !!id && has(id);
      const name = byId(id)?.name || 'sản phẩm';
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-label', on ? `Bỏ ${name} khỏi so sánh` : `Thêm ${name} vào so sánh`);
      b.title = on ? 'Bỏ so sánh' : 'So sánh';
      const label = b.querySelector('.compare-label');
      if (label) label.textContent = on ? 'Đang so sánh' : 'So sánh';
    });
  }

  /* ---------- Khay so sánh ---------- */
  let tray = null;
  function buildTray() {
    tray = document.createElement('aside');
    tray.className = 'compare-tray';
    tray.id = 'compare-tray';
    tray.setAttribute('aria-label', 'Khay so sánh sản phẩm');
    tray.hidden = true;
    document.body.appendChild(tray);
  }
  function renderTray() {
    if (!tray) buildTray();
    const n = ids.length;
    tray.hidden = n === 0;
    document.body.classList.toggle('has-compare-tray', n > 0);
    if (!n) { tray.innerHTML = ''; return; }
    const slots = ids.map(id => {
      const p = byId(id);
      return `<li class="ct-item"><img src="${esc(p.image)}" alt="" width="44" height="44"><span class="ct-name">${esc(p.name)}</span>
        <button class="ct-remove" type="button" data-compare-remove="${esc(id)}" aria-label="Bỏ ${esc(p.name)} khỏi so sánh">×</button></li>`;
    }).join('') + Array.from({ length: MAX - n }, () => '<li class="ct-item ct-empty" aria-hidden="true"><span>+</span></li>').join('');
    tray.innerHTML = `<div class="container ct-inner">
      <p class="ct-title"><b>So sánh</b><span>${n}/${MAX} sản phẩm</span></p>
      <ul class="ct-list">${slots}</ul>
      <div class="ct-actions">
        <button class="ct-open fx-press" type="button" data-compare-open ${n < 2 ? 'disabled aria-describedby="ct-hint"' : ''}>So sánh ngay</button>
        <button class="ct-clear" type="button" data-compare-clear>Xóa tất cả</button>
      </div>
      ${n < 2 ? '<p class="ct-hint" id="ct-hint">Chọn thêm ít nhất 1 sản phẩm để so sánh.</p>' : ''}
    </div>`;
  }

  /* ---------- Hộp thoại bảng so sánh ---------- */
  let modal = null, opener = null;
  function tableHTML() {
    const list = ids.map(byId).filter(Boolean);
    if (!list.length) return '<p class="cmp-empty">Chưa có sản phẩm nào để so sánh.</p>';
    const minGroup = Math.min(...list.map(p => p.group));
    const minMembers = Math.min(...list.map(p => Number(p.minMembers) || 1));
    const cell = (p, html) => `<td>${html}</td>`;
    const row = (label, fn) => `<tr><th scope="row">${label}</th>${list.map(p => cell(p, fn(p))).join('')}</tr>`;
    return `<div class="cmp-scroll" tabindex="0" role="region" aria-label="Bảng so sánh ${list.length} sản phẩm">
      <table class="cmp-table" style="--cols:${list.length}">
        <caption class="sr-only">So sánh ${list.length} sản phẩm theo giá lẻ, giá nhóm, số thành viên tối thiểu và mô tả</caption>
        <thead><tr><th scope="col" class="cmp-corner">Tiêu chí</th>${list.map(p => `<th scope="col">
          <div class="cmp-head"><img src="${esc(p.image)}" alt="" width="96" height="96"><span>${esc(p.name)}</span>
          <button class="cmp-remove" type="button" data-compare-remove="${esc(p.id)}" aria-label="Xóa ${esc(p.name)} khỏi bảng so sánh">Xóa mục</button></div></th>`).join('')}</tr></thead>
        <tbody>
          ${row('Danh mục', p => esc(p.category))}
          ${row('Giá mua lẻ', p => `<span class="cmp-retail">${money(p.retail)}</span>`)}
          ${row('Giá mua chung', p => `<strong class="cmp-group">${money(p.group)}</strong>${list.length > 1 && p.group === minGroup ? '<em class="cmp-best">Thấp nhất</em>' : ''}`)}
          ${row('Tiết kiệm khi mua chung', p => { const d = p.retail - p.group; return `${money(d)} <small>(-${Math.round(d / p.retail * 100)}%)</small>`; })}
          ${row('Thành viên tối thiểu', p => `${Number(p.minMembers) || 1} người${list.length > 1 && (Number(p.minMembers) || 1) === minMembers ? '<em class="cmp-best">Dễ đủ nhóm</em>' : ''}`)}
          ${row('Mô tả ngắn', p => `<span class="cmp-desc">${esc(short(p.description))}</span>`)}
          ${row('', p => `<a class="cmp-link" href="product-detail.html?id=${encodeURIComponent(p.id)}">Xem chi tiết →</a>`)}
        </tbody>
      </table>
    </div>
    <p class="cmp-hint" aria-hidden="true"><span>⟷</span> Vuốt ngang để xem đủ các cột</p>`;
  }
  function renderModal() {
    if (!modal) return;
    const body = modal.querySelector('.cmp-body');
    body.innerHTML = tableHTML();
    const count = modal.querySelector('[data-cmp-count]');
    if (count) count.textContent = `${ids.length}/${MAX} sản phẩm`;
    const scroller = body.querySelector('.cmp-scroll');
    if (scroller) modal.classList.toggle('has-overflow', scroller.scrollWidth > scroller.clientWidth + 2);
  }
  function openModal(from) {
    if (ids.length < 1) return;
    opener = from || document.activeElement;
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'cmp-backdrop';
      modal.innerHTML = `<section class="cmp-dialog" role="dialog" aria-modal="true" aria-labelledby="cmp-title">
        <header class="cmp-top"><div><h2 id="cmp-title">So sánh sản phẩm</h2><p data-cmp-count></p></div>
          <button class="cmp-close fx-press" type="button" data-compare-close aria-label="Đóng bảng so sánh">×</button></header>
        <div class="cmp-body"></div>
        <footer class="cmp-foot"><button class="ct-clear" type="button" data-compare-clear>Xóa tất cả</button><button class="cmp-done fx-press" type="button" data-compare-close>Đóng</button></footer>
      </section>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
      modal.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); closeModal(); return; }
        if (e.key !== 'Tab') return;
        const f = [...modal.querySelectorAll('button,a[href],[tabindex="0"]')].filter(el => !el.disabled && el.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      });
    }
    renderModal();
    modal.hidden = false;
    document.body.classList.add('cmp-open');
    modal.querySelector('.cmp-close')?.focus();
  }
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('cmp-open');
    const back = opener && document.contains(opener) ? opener : document.querySelector('[data-compare-open]');
    back?.focus?.();
  }

  function refresh() {
    syncButtons();
    renderTray();
    if (modal && !modal.hidden) { if (ids.length) renderModal(); else closeModal(); }
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target.closest('[data-compare],[data-compare-remove],[data-compare-open],[data-compare-clear],[data-compare-close]') : null;
    if (!t) return;
    if (t.hasAttribute('data-compare-close')) { closeModal(); return; }
    if (t.hasAttribute('data-compare-open')) { openModal(t); return; }
    if (t.hasAttribute('data-compare-clear')) { clear(); closeModal(); toast('Đã xóa danh sách so sánh.'); return; }
    if (t.hasAttribute('data-compare-remove')) {
      const name = byId(t.dataset.compareRemove)?.name || 'sản phẩm';
      remove(t.dataset.compareRemove);
      toast(`Đã bỏ ${name} khỏi so sánh.`);
      (modal && !modal.hidden ? modal.querySelector('.cmp-close') : tray?.querySelector('button'))?.focus();
      return;
    }
    e.preventDefault();
    const id = t.dataset.compare;
    if (!id) return;
    if (has(id)) { remove(id); toast(`Đã bỏ ${byId(id)?.name || 'sản phẩm'} khỏi so sánh.`); }
    else if (add(id)) {
      window.WeBuyFX?.pop(t);
      toast(ids.length >= 2 ? `Đã thêm vào so sánh (${ids.length}/${MAX}). Bấm "So sánh ngay" ở cuối màn hình.` : 'Đã thêm vào so sánh. Chọn thêm sản phẩm khác để so sánh.');
    }
  });
  window.addEventListener('resize', () => { if (modal && !modal.hidden) renderModal(); });
  window.addEventListener('storage', e => { if (e.key === KEY) { ids = read(); refresh(); } });

  const start = () => {
    ids = read();
    write();
    refresh();
    new MutationObserver(list => {
      if (list.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches('[data-compare]') || n.querySelector('[data-compare]'))))) syncButtons();
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.WeBuyCompare = { has, add, remove, clear, list: () => ids.slice(), open: openModal, close: closeModal, MAX };
})();
