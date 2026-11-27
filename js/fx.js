/* WeBuy — Micro-interaction dùng lại (Task 6). Đi kèm css/fx.css.
 * - .fx-tilt: nghiêng 3D theo con trỏ (chỉ chuột/bút, không áp cho cảm ứng), mỗi lúc chỉ 1 thẻ.
 * - .fx-skeleton: gắn trạng thái đã tải ảnh để tắt hiệu ứng chờ.
 * - Tự áp dụng cho thẻ được thêm sau (danh sách lọc lại, carousel) bằng MutationObserver.
 * Không đụng logic giỏ hàng / nhóm mua của js/app.js.
 */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const rootStyle = getComputedStyle(document.documentElement);
  const maxTilt = () => {
    if (reduce.matches) return 0;
    const v = parseFloat(rootStyle.getPropertyValue('--tilt-max'));
    return Number.isFinite(v) ? v : 7;
  };

  /* ---------- Tilt ---------- */
  let active = null, raf = 0, lastX = 0, lastY = 0;
  const reset = card => {
    card.classList.remove('is-tilting');
    ['--fx-rx', '--fx-ry', '--gx', '--gy'].forEach(k => card.style.removeProperty(k));
  };
  // Giữ góc nghiêng hiện tại khi con trỏ tiến vào vùng nút trên thẻ nhóm.
  // Vùng đệm tránh việc nút dịch chuyển khỏi con trỏ giữa hai frame.
  const nearControl = (card, x, y) => card.matches('.near-card') &&
    Array.from(card.querySelectorAll('.card-tools, .near-cta, .near-body h3 a')).some(el => {
      const r = el.getBoundingClientRect(), pad = 14;
      return x >= r.left - pad && x <= r.right + pad &&
             y >= r.top - pad && y <= r.bottom + pad;
    });
  const apply = () => {
    raf = 0;
    if (!active) return;
    if (nearControl(active, lastX, lastY)) return;
    const m = maxTilt();
    if (!m) return;
    const r = (active.matches('.near-card') ? active.closest('.near-slot') || active : active).getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = Math.min(1, Math.max(0, (lastX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (lastY - r.top) / r.height));
    active.classList.add('is-tilting');
    active.style.setProperty('--fx-ry', ((x - 0.5) * 2 * m).toFixed(2) + 'deg');
    active.style.setProperty('--fx-rx', ((0.5 - y) * 2 * m).toFixed(2) + 'deg');
    active.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
    active.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
  };
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !finePointer.matches) return;
    const card = e.target instanceof Element ? e.target.closest('.fx-tilt') : null;
    if (card !== active) { if (active) reset(active); active = card; }
    if (!active) return;
    lastX = e.clientX; lastY = e.clientY;
    if (nearControl(active, lastX, lastY)) return;
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    if (active && (!e.relatedTarget || !active.contains(e.relatedTarget))) { reset(active); active = null; }
  });
  window.addEventListener('blur', () => { if (active) { reset(active); active = null; } });

  /* ---------- Gắn glare + skeleton ---------- */
  const wireTilt = card => {
    if (card.dataset.fxTilt) return;
    card.dataset.fxTilt = '1';
    if (!card.querySelector(':scope > .fx-glare')) {
      const g = document.createElement('span');
      g.className = 'fx-glare';
      g.setAttribute('aria-hidden', 'true');
      card.appendChild(g);
    }
  };
  const wireSkeleton = box => {
    if (box.dataset.fxSkel) return;
    box.dataset.fxSkel = '1';
    const img = box.querySelector('img');
    const done = () => box.classList.add('is-loaded');
    if (!img || (img.complete && img.naturalWidth)) { done(); return; }
    if (img.complete && !img.naturalWidth && img.getAttribute('src')) { box.classList.add('is-loaded', 'is-error'); return; }
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', () => box.classList.add('is-loaded', 'is-error'), { once: true });
  };
  const scan = (root = document) => {
    if (!root || root.nodeType !== 1 && root !== document) return;
    if (root !== document) {
      if (root.matches('.fx-tilt')) wireTilt(root);
      if (root.matches('.fx-skeleton')) wireSkeleton(root);
    }
    root.querySelectorAll('.fx-tilt').forEach(wireTilt);
    root.querySelectorAll('.fx-skeleton').forEach(wireSkeleton);
  };

  /* Bật/tắt icon có hiệu ứng nảy (dùng chung cho yêu thích, so sánh) */
  const pop = el => {
    if (!el || reduce.matches) return;
    el.classList.remove('is-popping');
    void el.offsetWidth;
    el.classList.add('is-popping');
    setTimeout(() => el.classList.remove('is-popping'), 500);
  };

  const start = () => {
    scan(document);
    new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) scan(n); })))
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.WeBuyFX = { scan, pop };
})();
