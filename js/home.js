/* WeBuy — Trang chủ (chỉ index.html). Vanilla JS, đọc cùng nguồn dữ liệu js/catalog-data.js.
 *  1. Hero 3D: cảnh nghiêng theo con trỏ + dao động nhẹ khi rảnh; dừng khi ra khỏi màn hình/tab ẩn.
 *  2. Danh mục: sinh từ WEBUY_CATEGORIES, có số sản phẩm mỗi danh mục.
 *  3. Nhóm sắp đủ người: lấy nhóm mẫu gần đủ nhất (đọc trạng thái nhóm app.js lưu trong trình duyệt).
 *  4. Sản phẩm nổi bật: carousel kéo/vuốt.
 *  5. Hiệu ứng cuộn 3D: cập nhật --p (0→1) và --sp (parallax) cho [data-scroll3d]; tắt khi giảm chuyển động.
 * Tải sau catalog-data.js và app.js để đọc nhóm và khu vực đã khởi tạo.
 */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const products = window.WEBUY_PRODUCTS || [];
  const categories = window.WEBUY_CATEGORIES || [];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const motionScale = () => reduceMotion.matches ? 0 : (window.innerWidth < 768 ? 0.45 : 1);
  const detailURL = p => `product-detail.html?id=${encodeURIComponent(String(p.id))}`;
  const ICON_HEART = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20.3s-7.4-4.4-9.2-9.1C1.5 7.7 3.7 4.6 7 4.6c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.3 0 5.5 3.1 4.2 6.6-1.8 4.7-9.2 9.1-9.2 9.1z"></path></svg>';
  const ICON_COMPARE = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h12l-3-3M20 17H8l3 3"></path></svg>';
  const toolsHTML = p => `
        <div class="card-tools">
          <button class="tool-btn wish-btn fx-press fx-pop" type="button" data-wish="${esc(p.id)}" aria-pressed="false" aria-label="Thêm ${esc(p.name)} vào yêu thích" title="Yêu thích">${ICON_HEART}</button>
          <button class="tool-btn compare-btn fx-press fx-pop" type="button" data-compare="${esc(p.id)}" aria-pressed="false" aria-label="Thêm ${esc(p.name)} vào so sánh" title="So sánh">${ICON_COMPARE}</button>
        </div>`;

  /* ---------- Dots dùng chung cho carousel ---------- */
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

  /* ---------- 1. Hero 3D ---------- */
  function initHero3D() {
    const hero = document.querySelector('[data-hero]');
    const stage = hero?.querySelector('.scene-stage');
    if (!hero || !stage) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, inView = true, pointer = false;
    const t0 = performance.now();

    const tick = now => {
      raf = 0;
      const m = motionScale();
      if (!m) { stage.style.transform = ''; return; }
      let gx = tx, gy = ty;
      if (!pointer) {                       // vòng lặp tinh tế khi không có con trỏ (và trên cảm ứng)
        const t = (now - t0) / 1000;
        gx = Math.sin(t * 0.45) * 0.22;
        gy = Math.cos(t * 0.38) * 0.14;
      }
      cx += (gx - cx) * 0.07;
      cy += (gy - cy) * 0.07;
      stage.style.transform = `rotateX(${(-cy * 18 * m).toFixed(2)}deg) rotateY(${(cx * 26 * m).toFixed(2)}deg)`;
      hero.style.setProperty('--lx', (55 + cx * 70).toFixed(1) + '%');
      hero.style.setProperty('--ly', (32 + cy * 60).toFixed(1) + '%');
      // lớp người mua trượt nhẹ ngược con trỏ (tăng cảm giác chiều sâu)
      hero.style.setProperty('--px', (-cx * 36 * m).toFixed(1) + 'px');
      hero.style.setProperty('--py', (-cy * 26 * m).toFixed(1) + 'px');
      if (inView && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf && inView && !document.hidden && motionScale()) raf = requestAnimationFrame(tick); };

    hero.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = hero.getBoundingClientRect();
      tx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
      ty = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
      pointer = true;
      start();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { pointer = false; });
    document.addEventListener('visibilitychange', start);
    reduceMotion.addEventListener?.('change', () => { stage.style.transform = ''; start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        hero.classList.toggle('is-paused', !inView);   // dừng mọi animation CSS khi hero khuất
        start();
      }, { threshold: 0.05 }).observe(hero);
    }
    start();
  }

  /* ---------- Số liệu nhanh ở hero ---------- */
  function fillStats() {
    const set = (k, v) => { const el = document.querySelector(`[data-stat="${k}"]`); if (el) el.textContent = v; };
    set('products', products.length);
    set('categories', categories.length || new Set(products.map(p => p.category)).size);
    const offs = products.filter(p => p.retail > 0 && p.group < p.retail).map(p => 1 - p.group / p.retail);
    if (offs.length) set('saving', '-' + Math.round(offs.reduce((a, b) => a + b, 0) / offs.length * 100) + '%');
  }

  /* ---------- 2. Danh mục ---------- */
  function renderCategories() {
    const grid = document.getElementById('home-cat-grid');
    if (!grid || !categories.length) return;
    const count = name => products.filter(p => p.category === name).length;
    grid.innerHTML = categories.map(c => `
      <li><a class="cat-tile fx-tilt" href="products.html?category=${encodeURIComponent(c.id)}#tat-ca-danh-muc">
        <span class="cat-tile-img fx-skeleton"><img src="${esc(c.image)}" alt="" width="84" height="84" loading="lazy" decoding="async"></span>
        <span class="cat-tile-name">${esc(c.name)}</span>
        <span class="cat-tile-count">${count(c.name)} sản phẩm</span>
      </a></li>`).join('') + `
      <li><a class="cat-tile cat-tile-all fx-tilt" href="products.html#tat-ca-danh-muc">
        <span class="cat-tile-img"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="2"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="13.5" width="7" height="7" rx="2"></rect></svg></span>
        <span class="cat-tile-name">Tất cả danh mục</span>
        <span class="cat-tile-count">${products.length} sản phẩm</span>
      </a></li>`;
  }

  /* ---------- 3. Nhóm sắp đủ người ---------- */
  function readGroups() {
    try {
      const v = JSON.parse(localStorage.getItem('webuy_demo_v2_groups') || 'null');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  const hoursLeft = ends => {
    if (!ends) return '';
    const h = Math.ceil((ends - Date.now()) / 3600000);
    return h > 0 ? `Còn khoảng ${h} giờ` : 'Đã hết hạn';
  };
  function initNearGroups() {
    const box = document.getElementById('near-groups');
    if (!box) return;
    const stored = readGroups();
    const region = JSON.parse(localStorage.getItem('webuy_demo_v2_location') || '{}').code || 'all';
    const rows = stored.filter(g => region === 'all' || g.regionCode === region).map(g => {
      const p = products.find(product => product.id === g.productId);
      const need = Number(g.need);
      const count = (Number(g.demoCount) || 0) + (g.members || []).length;
      return { p, id:g.id, need, count, left:need-count, ends:g.endsAt };
    }).filter(r => r.p && r.left > 0 && r.ends > Date.now())
      .sort((a, b) => a.left - b.left || b.count / b.need - a.count / a.need || a.p.group - b.p.group)
      .slice(0, 4);

    if (!rows.length) {
      box.innerHTML = '<li class="near-empty">Hiện chưa có nhóm nào sắp đủ người. <a class="section-link-light" href="products.html">Xem sản phẩm để tạo nhóm mới →</a></li>';
      return;
    }
    box.innerHTML = rows.map((r, i) => {
      const p = r.p, name = esc(p.name);
      const people = Array.from({ length: r.need }, (_, k) => `<i class="${k < r.count ? '' : 'is-empty'}"></i>`).join('');
      return `
      <li class="near-slot" style="--i:${i};--ring-off:${(1 - r.count / r.need).toFixed(3)}">
        <article class="near-card fx-tilt" data-product-ref="${esc(p.id)}">
          <div class="near-photo fx-skeleton"><img src="${esc(p.image)}" alt="Ảnh minh họa ${name}" width="320" height="240" loading="lazy" decoding="async"></div>
          <span class="near-badge">Còn thiếu ${r.left} người</span>
          <div class="near-ring" role="img" aria-label="Đã có ${r.count} trên ${r.need} thành viên">
            <svg viewBox="0 0 44 44" aria-hidden="true"><circle class="ring-bg" cx="22" cy="22" r="18"></circle><circle class="ring-fg" cx="22" cy="22" r="18" pathLength="1"></circle></svg>
            <b>${r.count}/${r.need}</b>
          </div>
          ${toolsHTML(p)}
          <div class="near-body">
            <p class="near-cat">${esc(p.category)}</p>
            <h3><a href="${detailURL(p)}">${name}</a></h3>
            <div class="near-price"><strong>${money(p.group)}</strong><s>${money(p.retail)}</s></div>
            <div class="near-people" aria-hidden="true">${people}<span>cần <b>${r.need}</b> người</span></div>
            <div class="near-foot"><span>${esc(hoursLeft(r.ends) || 'Nhóm mẫu đang mở')}</span>
              <a class="near-cta fx-press fx-icon" href="${detailURL(p)}&group=${encodeURIComponent(r.id)}#group-${encodeURIComponent(r.id)}" aria-label="Vào nhóm mua ${name}">Vào nhóm <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"></path></svg></a>
            </div>
          </div>
        </article>
      </li>`;
    }).join('');

    // vòng tiến độ chạy khi thẻ hiện ra
    const slots = box.querySelectorAll('.near-slot');
    if (reduceMotion.matches || !('IntersectionObserver' in window)) { slots.forEach(s => s.classList.add('is-in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: 0.3 });
    slots.forEach(s => io.observe(s));
  }

  /* ---------- 4. Sản phẩm nổi bật ---------- */
  const FEATURED_BADGES = ['Nổi bật', 'Đề xuất', 'Được yêu thích', 'Được quan tâm'];
  const productCard = p => {
    const id = esc(p.id);
    const retail = Number(p.retail ?? p.price) || 0;
    const group = Number(p.group) || 0;
    const need = Math.max(1, Number(p.minMembers) || 1);
    const off = retail > 0 && group > 0 && group < retail ? Math.round((1 - group / retail) * 100) : 0;
    const name = esc(p.name);
    return `
      <article class="fp-card product-card fx-tilt" data-product-id="${id}">
        <div class="fp-media fx-skeleton">
          <img src="${esc(p.image)}" alt="Ảnh minh họa ${name}" width="320" height="288" loading="lazy" decoding="async" draggable="false">
          ${off ? `<span class="fp-off">-${off}%</span>` : ''}
        </div>
        ${toolsHTML(p)}
        <div class="fp-body">
          <p class="fp-cat">${esc(p.category)}</p>
          <h3 class="fp-name"><a class="fp-link" href="${detailURL(p)}">${name}</a></h3>
          <div class="fp-prices">
            <strong class="fp-group" aria-label="Giá mua chung ${money(group)}">${money(group)}</strong>
            <s class="fp-retail" aria-label="Giá mua lẻ ${money(retail)}">${money(retail)}</s>
          </div>
          <p class="fp-cond">Giá nhóm từ ${need} thành viên</p>
          <div class="fp-actions">
            <a class="fp-btn fp-btn-main fx-press" href="${detailURL(p)}" tabindex="-1" aria-hidden="true">Xem chi tiết</a>
            <button class="fp-btn fp-btn-ghost fx-press" type="button" data-add-cart="${id}" aria-label="Thêm ${name} vào giỏ hàng">+ Giỏ</button>
          </div>
        </div>
      </article>`;
  };

  function initProducts(root) {
    const viewport = root.querySelector('.fp-viewport');
    const track = root.querySelector('.fp-track');
    if (!viewport || !track || !products.length) return;
    const featured = products.filter(p => FEATURED_BADGES.includes(p.badge));
    const list = (featured.length >= 5 ? featured : products).slice(0, 12);

    track.insertAdjacentHTML('beforeend', list.map(productCard).join(''));
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
    viewport.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });

    const pageBy = dir => {
      const visible = Math.max(1, Math.floor(viewport.clientWidth / step));
      viewport.scrollBy({ left: dir * step * Math.max(1, visible - 1), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    };
    prev?.addEventListener('click', () => pageBy(-1));
    next?.addEventListener('click', () => pageBy(1));

    // Kéo bằng chuột (cảm ứng đã cuộn tự nhiên); không kéo khi bấm vào nút
    let down = false, startX = 0, startLeft = 0, dragged = false;
    viewport.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
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
    window.addEventListener('load', measure, { once: true });
  }

  /* ---------- 5. Hiệu ứng cuộn 3D (parallax + xếp lớp) ---------- */
  function initScroll3D() {
    const sections = Array.from(document.querySelectorAll('[data-scroll3d]'));
    if (!sections.length) return;
    const visible = new Set();
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight || 1;
      visible.forEach(sec => {
        const r = sec.getBoundingClientRect();
        // p = 0 khi mép trên section vừa chạm đáy màn hình, = 1 khi lên tới ~45% chiều cao màn hình
        const p = clamp((vh - r.top) / (vh * 0.55), 0, 1);
        const sp = clamp((r.top + r.height / 2 - vh / 2) / vh, -1, 1);
        sec.style.setProperty('--p', p.toFixed(3));
        sec.style.setProperty('--sp', sp.toFixed(3));
        // đánh dấu nút trên đường nối 3 bước
        sec.querySelectorAll('.steps-node').forEach((node, k) => node.classList.toggle('is-active', p >= 0.35 + k * 0.3));
      });
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(update); };
    const settle = () => sections.forEach(sec => {
      sec.style.setProperty('--p', '1'); sec.style.setProperty('--sp', '0');
      sec.querySelectorAll('.steps-node').forEach(n => n.classList.add('is-active'));
    });
    if (reduceMotion.matches || !('IntersectionObserver' in window)) { settle(); return; }
    sections.forEach(sec => sec.style.setProperty('--p', '0'));
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      request();
    }, { rootMargin: '10% 0px 10% 0px' });
    sections.forEach(s => io.observe(s));
    window.addEventListener('scroll', () => { if (visible.size) request(); }, { passive: true });
    window.addEventListener('resize', request);
    reduceMotion.addEventListener?.('change', () => { if (reduceMotion.matches) settle(); else request(); });

    // rê chuột / focus vào thẻ bước nào thì sáng nút tương ứng trên đường nối
    document.querySelectorAll('.step-card[data-step]').forEach(card => {
      const node = document.querySelector(`.steps-node[data-node="${card.dataset.step}"]`);
      if (!node) return;
      const on = () => node.classList.add('is-hover');
      const off = () => node.classList.remove('is-hover');
      card.addEventListener('pointerenter', on); card.addEventListener('pointerleave', off);
      card.addEventListener('focus', on); card.addEventListener('blur', off);
    });
  }

  /* ---------- 6. Scroll reveal nhẹ ---------- */
  function initReveal() {
    const targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;
    if (reduceMotion.matches || !('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(t => io.observe(t));
  }

  /* ---------- Banner khuyến mãi: tự chạy 5s, dừng khi rê chuột/focus, vuốt trên cảm ứng ---------- */
  function initPromo(root) {
    const track = root.querySelector('.promo-track');
    const slides = [...root.querySelectorAll('.promo-slide')];
    const dotsBox = root.querySelector('.promo-dots');
    if (!track || slides.length < 2) return;
    let idx = 0, timer = 0, hold = false;
    const dots = slides.map((_, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', `Banner ${k + 1}`);
      b.addEventListener('click', () => { go(k); restart(); });
      dotsBox?.appendChild(b); return b;
    });
    function go(k) {
      idx = (k + slides.length) % slides.length;
      track.style.transform = `translateX(${-idx * 100}%)`;
      slides.forEach((s, j) => { s.classList.toggle('is-active', j === idx); s.setAttribute('aria-hidden', j === idx ? 'false' : 'true'); s.inert = j !== idx; });
      markDots(dots, idx);
    }
    function restart() {
      clearInterval(timer);
      if (!hold && !reduceMotion.matches) timer = setInterval(() => go(idx + 1), 5000);
    }
    root.querySelector('.promo-prev')?.addEventListener('click', () => { go(idx - 1); restart(); });
    root.querySelector('.promo-next')?.addEventListener('click', () => { go(idx + 1); restart(); });
    root.addEventListener('mouseenter', () => { hold = true; restart(); });
    root.addEventListener('mouseleave', () => { hold = false; restart(); });
    root.addEventListener('focusin', () => { hold = true; restart(); });
    root.addEventListener('focusout', () => { hold = false; restart(); });
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { go(idx - 1); restart(); }
      if (e.key === 'ArrowRight') { go(idx + 1); restart(); }
    });
    let x0 = null;
    root.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') x0 = e.clientX; }, { passive: true });
    root.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { go(idx + (dx < 0 ? 1 : -1)); restart(); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearInterval(timer); else restart(); });
    go(0); restart();
  }

  fillStats();
  renderCategories();
  initNearGroups();
  document.addEventListener('webuy:location',initNearGroups);
  document.addEventListener('webuy:lan-state',initNearGroups);
  window.addEventListener('storage',e => { if (['webuy_demo_v2_location','webuy_demo_v2_groups'].includes(e.key)) initNearGroups(); });
  document.querySelectorAll('[data-carousel="products"]').forEach(initProducts);
  initHero3D();
  document.querySelectorAll('[data-promo]').forEach(initPromo);
  initScroll3D();
  initReveal();
})();
