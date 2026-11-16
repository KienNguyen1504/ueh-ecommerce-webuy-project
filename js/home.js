/* WeBuy — Trang chủ: banner carousel, sản phẩm nổi bật, newsletter, scroll reveal.
 * Vanilla JS, chỉ dùng cho index.html. Tải SAU catalog-data.js và TRƯỚC app.js
 * để app.js vẫn cập nhật tiến độ nhóm / giỏ hàng cho các thẻ được tạo ở đây.
 * Thêm banner mới: chỉ cần thêm một <article class="banner-slide"> vào .carousel-track.
 */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Dots dùng chung ---------- */
  function buildDots(box, count, labelPrefix, onPick) {
    if (!box) return [];
    box.innerHTML = '';
    return Array.from({ length: count }, (_, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'car-dot';
      b.setAttribute('aria-label', `${labelPrefix} ${k + 1}`);
      b.addEventListener('click', () => onPick(k));
      box.appendChild(b);
      return b;
    });
  }
  const markDots = (dots, active) => dots.forEach((d, k) => {
    d.classList.toggle('is-active', k === active);
    if (k === active) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
  });

  /* ---------- 1. Banner carousel ---------- */
  function initBanner(root) {
    const viewport = root.querySelector('.carousel-viewport');
    const track = root.querySelector('.carousel-track');
    if (!viewport || !track) return;
    const slides = Array.from(track.children);
    const n = slides.length;
    if (!n) return;

    const AUTOPLAY_MS = 5000;
    let index = 0, timer = 0;
    let hovered = false, focused = false, dragging = false, inView = true, userPaused = false;

    slides.forEach((s, k) => s.setAttribute('aria-label', `${k + 1} / ${n}`));
    const dots = buildDots(root.querySelector('[data-dots]'), n, 'Chuyển tới banner', k => go(k, true));

    const render = () => {
      track.style.transform = `translate3d(${-index * 100}%,0,0)`;
      slides.forEach((s, k) => {
        const on = k === index;
        s.setAttribute('aria-hidden', String(!on));
        s.inert = !on;
        s.querySelectorAll('a,button').forEach(el => { el.tabIndex = on ? 0 : -1; });
      });
      markDots(dots, index);
    };
    const canPlay = () => !(reduceMotion.matches || userPaused || hovered || focused || dragging || !inView || document.hidden) && n > 1;
    const schedule = () => {
      clearTimeout(timer);
      track.setAttribute('aria-live', canPlay() ? 'off' : 'polite');
      if (canPlay()) timer = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    };
    function go(k, byUser) {
      index = (k + n) % n;
      render();
      if (byUser) userPaused = false;
      schedule();
    }

    root.querySelector('.car-prev')?.addEventListener('click', () => go(index - 1, true));
    root.querySelector('.car-next')?.addEventListener('click', () => go(index + 1, true));

    // Tạm dừng khi hover / focus / tab ẩn / ngoài màn hình
    root.addEventListener('mouseenter', () => { hovered = true; schedule(); });
    root.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    root.addEventListener('focusin', () => { focused = true; schedule(); });
    root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) { focused = false; schedule(); } });
    document.addEventListener('visibilitychange', schedule);
    reduceMotion.addEventListener?.('change', schedule);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; schedule(); }, { threshold: 0.25 }).observe(root);
    }
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { go(index - 1, true); }
      else if (e.key === 'ArrowRight') { go(index + 1, true); }
    });

    // Kéo bằng chuột / vuốt cảm ứng
    let startX = 0, startY = 0, startT = 0, dx = 0, tracking = false, moved = false, suppressClick = false;
    viewport.addEventListener('dragstart', e => e.preventDefault());
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tracking = true; moved = false; dx = 0;
      startX = e.clientX; startY = e.clientY; startT = performance.now();
    });
    viewport.addEventListener('pointermove', e => {
      if (!tracking) return;
      dx = e.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(e.clientY - startY) > Math.abs(dx)) { tracking = false; return; }
        moved = true; dragging = true;
        track.classList.add('is-dragging');
        try { viewport.setPointerCapture(e.pointerId); } catch (_) { /* bỏ qua */ }
        clearTimeout(timer);
      }
      const edge = (index === 0 && dx > 0) || (index === n - 1 && dx < 0) ? 0.35 : 1; // lực cản ở hai đầu
      track.style.transform = `translate3d(calc(${-index * 100}% + ${dx * edge}px),0,0)`;
    });
    const endDrag = () => {
      if (!tracking) return;
      tracking = false;
      if (!moved) return;
      const w = viewport.clientWidth || 1;
      const v = Math.abs(dx) / Math.max(1, performance.now() - startT);
      let next = index;
      if (Math.abs(dx) > w * 0.18 || v > 0.5) next = dx < 0 ? index + 1 : index - 1;
      track.classList.remove('is-dragging');
      dragging = false;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      next = clamp(next, 0, n - 1);
      go(next, true);
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('click', e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);

    render();
    schedule();
  }

  /* ---------- 2. Sản phẩm nổi bật (dữ liệu thật từ WEBUY_PRODUCTS) ---------- */
  const productCard = p => {
    const id = esc(p.id);
    const retail = Number(p.retail ?? p.price) || 0;
    const group = Number(p.group) || 0;
    const need = Math.max(1, Number(p.minMembers) || 1);
    const members = Math.max(0, Number(p.initialMembers) || 0);
    const progress = clamp(Math.round(members / need * 100), 0, 100);
    const off = retail > 0 && group > 0 && group < retail ? Math.round((1 - group / retail) * 100) : 0;
    const url = `product-detail.html?id=${encodeURIComponent(String(p.id))}`;
    const name = esc(p.name);
    return `
      <article class="fp-card product-card" data-product-id="${id}">
        <div class="fp-media">
          <img src="${esc(p.image)}" alt="Ảnh minh họa ${name}" width="320" height="320" loading="lazy" draggable="false">
          ${off ? `<span class="fp-off">-${off}%</span>` : ''}
        </div>
        <div class="fp-body">
          <p class="fp-cat">${esc(p.category)}</p>
          <h3 class="fp-name"><a class="fp-link" href="${url}">${name}</a></h3>
          <div class="fp-prices">
            <s class="fp-retail" aria-label="Giá mua lẻ ${money(retail)}">${money(retail)}</s>
            <strong class="fp-group" aria-label="Giá mua chung ${money(group)}">${money(group)}</strong>
          </div>
          <p class="fp-cond">Giá mua chung từ ${need} thành viên hợp lệ</p>
          <div class="group-stats">
            <span><svg aria-hidden="true" class="icon" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"></circle><path d="M2 20v-2a6 6 0 0 1 12 0v2"></path><path d="M17 5a3 3 0 0 1 0 6m0 5a5 5 0 0 1 5 4"></path></svg><b>${members}/${need}</b> thành viên</span>
            <span><svg aria-hidden="true" class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>Đang cập nhật</span>
          </div>
          <div class="progress-track" role="img" aria-label="Tiến độ nhóm mẫu: ${members} trên ${need} thành viên"><span style="width:${progress}%"></span></div>
          <div class="fp-actions">
            <a class="fp-btn fp-btn-main" href="${url}" tabindex="-1" aria-hidden="true">Xem chi tiết →</a>
            <button class="fp-btn fp-btn-ghost" type="button" data-add-cart="${id}" aria-label="Thêm ${name} vào giỏ hàng">+ Thêm giỏ</button>
          </div>
        </div>
      </article>`;
  };

  function initProducts(root) {
    const viewport = root.querySelector('.fp-viewport');
    const track = root.querySelector('.fp-track');
    const products = window.WEBUY_PRODUCTS || [];
    if (!viewport || !track || !products.length) return;

    track.insertAdjacentHTML('beforeend', products.map(productCard).join(''));
    const cards = Array.from(track.querySelectorAll('.fp-card'));
    const prev = root.querySelector('.car-prev');
    const next = root.querySelector('.car-next');
    const dotsBox = root.querySelector('[data-dots]');
    let dots = [];
    let step = 1, raf = 0;

    const measure = () => {
      const first = cards[0];
      if (!first) return;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      step = first.getBoundingClientRect().width + gap;
      const max = viewport.scrollWidth - viewport.clientWidth;
      const count = max <= 2 ? 1 : Math.round(max / step) + 1;
      if (dots.length !== count) dots = buildDots(dotsBox, count, 'Xem nhóm sản phẩm', k => viewport.scrollTo({ left: k * step, behavior: reduceMotion.matches ? 'auto' : 'smooth' }));
      if (dotsBox) dotsBox.hidden = count <= 1;
      update();
    };
    const update = () => {
      const max = viewport.scrollWidth - viewport.clientWidth;
      const left = viewport.scrollLeft;
      markDots(dots, clamp(Math.round(left / step), 0, dots.length - 1));
      if (prev) prev.disabled = left <= 2;
      if (next) next.disabled = left >= max - 2;
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });

    const pageBy = dir => {
      const visible = Math.max(1, Math.floor(viewport.clientWidth / step));
      viewport.scrollBy({ left: dir * step * Math.max(1, visible - 1), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    };
    prev?.addEventListener('click', () => pageBy(-1));
    next?.addEventListener('click', () => pageBy(1));

    // Kéo bằng chuột (cảm ứng đã cuộn tự nhiên)
    let down = false, startX = 0, startLeft = 0, dragged = false;
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; dragged = false; startX = e.clientX; startLeft = viewport.scrollLeft;
    });
    viewport.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!dragged && Math.abs(dx) < 6) return;
      if (!dragged) { dragged = true; viewport.classList.add('is-dragging'); try { viewport.setPointerCapture(e.pointerId); } catch (_) { /* bỏ qua */ } }
      viewport.scrollLeft = startLeft - dx;
    });
    const release = () => {
      if (!down) return;
      down = false;
      if (dragged) {
        viewport.classList.remove('is-dragging');
        viewport.scrollTo({ left: clamp(Math.round(viewport.scrollLeft / step), 0, dots.length - 1) * step, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        setTimeout(() => { dragged = false; }, 0);
      }
    };
    viewport.addEventListener('pointerup', release);
    viewport.addEventListener('pointercancel', release);
    viewport.addEventListener('click', e => { if (dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    viewport.addEventListener('dragstart', e => e.preventDefault());

    measure();
    // ảnh tải xong có thể làm đổi kích thước thẻ
    window.addEventListener('load', measure, { once: true });
  }

  /* ---------- 3. Newsletter (chưa có backend: không giả lập đăng ký thành công) ---------- */
  function initNewsletter() {
    const form = document.getElementById('newsletter-form');
    const msg = document.getElementById('nl-msg');
    const input = document.getElementById('nl-email');
    if (!form || !msg || !input) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const value = input.value.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      msg.classList.toggle('is-error', !valid);
      input.setAttribute('aria-invalid', String(!valid));
      msg.textContent = valid
        ? 'Tính năng nhận tin đang được hoàn thiện nên WeBuy chưa lưu email này. Cảm ơn bạn đã quan tâm!'
        : 'Vui lòng nhập địa chỉ email hợp lệ.';
      if (!valid) input.focus();
    });
    input.addEventListener('input', () => { msg.textContent = ''; input.removeAttribute('aria-invalid'); });
  }

  /* ---------- 4. Scroll reveal nhẹ ---------- */
  function initReveal() {
    const targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;
    if (reduceMotion.matches || !('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(t => io.observe(t));
  }

  document.querySelectorAll('[data-carousel="banner"]').forEach(initBanner);
  document.querySelectorAll('[data-carousel="products"]').forEach(initProducts);
  initNewsletter();
  initReveal();
})();
