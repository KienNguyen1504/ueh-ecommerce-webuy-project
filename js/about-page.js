/* WeBuy | Trang Giới thiệu - hiệu ứng & tương tác.
 * Tự chứa trong IIFE, chỉ đọc window.WEBUY_PRODUCTS (nếu có), không sửa gì của app.js. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return Number(n).toLocaleString('vi-VN') + '₫'; };
  var products = (window.WEBUY_PRODUCTS || []).filter(function (p) { return p && p.retail && p.group; });

  /* ---------- 1. Reveal khi cuộn ---------- */
  var revealEls = $$('.ab-reveal');
  if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); } });
    }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else revealEls.forEach(function (el) { el.classList.add('is-in'); });

  /* ---------- 2. Số liệu đếm lên (lấy từ dữ liệu sản phẩm thật) ---------- */
  if (products.length) {
    var best = Math.max.apply(null, products.map(function (p) { return Math.round((1 - p.group / p.retail) * 100); }));
    var set = function (k, v) { var el = $('[data-stat="' + k + '"]'); if (el) el.dataset.count = v; };
    set('products', products.length); set('save', best);
  }
  function countUp(el) {
    var to = +el.dataset.count || 0, t0 = null, dur = 1600;
    if (reduce) { el.textContent = to; return; }
    (function step(t) {
      if (!t0) t0 = t;
      var k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(to * e);
      if (k < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  var stats = $('#ab-stats');
  if (stats && 'IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { $$('[data-count]', stats).forEach(countUp); so.disconnect(); }
    }, { threshold: .4 });
    so.observe(stats);
  } else $$('[data-count]').forEach(function (el) { el.textContent = el.dataset.count; });

  /* ---------- 3. Parallax nhẹ cho ảnh ---------- */
  var pxEls = $$('[data-parallax],.ab-frame img');
  if (!reduce && pxEls.length) {
    var ticking = false;
    var upd = function () {
      var vh = window.innerHeight;
      pxEls.forEach(function (img) {
        var host = img.parentElement.getBoundingClientRect();
        if (host.bottom < -100 || host.top > vh + 100) return;
        var f = parseFloat(img.dataset.parallax) || .08;
        var c = host.top + host.height / 2 - vh / 2;
        img.style.setProperty('--py', (-c * f).toFixed(1) + 'px');
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    window.addEventListener('resize', upd); upd();
  }

  /* ---------- 4. Hero collage nghiêng theo chuột ---------- */
  var col = $('[data-tilt]');
  if (col && !reduce && matchMedia('(hover:hover)').matches) {
    var chips = $$('.ab-chip', col);
    col.addEventListener('mousemove', function (e) {
      var r = col.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      chips.forEach(function (c, i) { c.style.translate = (x * (20 + i * 10)) + 'px ' + (y * (20 + i * 10)) + 'px'; });
    });
    col.addEventListener('mouseleave', function () { chips.forEach(function (c) { c.style.translate = ''; }); });
  }

  /* ---------- 5. Thẻ giá trị: chạm để mở trên thiết bị cảm ứng / bàn phím ---------- */
  $$('.ab-vcard').forEach(function (c) {
    var toggle = function () {
      var on = !c.classList.contains('is-open');
      $$('.ab-vcard.is-open').forEach(function (o) { o.classList.remove('is-open'); o.setAttribute('aria-expanded', 'false'); });
      if (on) { c.classList.add('is-open'); c.setAttribute('aria-expanded', 'true'); }
    };
    c.addEventListener('click', toggle);
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  /* ---------- 6. Mô phỏng mua chung ---------- */
  var sim = $('#ab-sim');
  if (sim) {
    var list = products.length ? products.slice(0, 4) : [{ id: 1, name: 'Balo canvas Everyday', category: 'Balo & túi ví', image: 'images/product-01.webp', retail: 299000, group: 249000, minMembers: 3, initialMembers: 2 }];
    var cur = list[0], n = 1;
    var pick = $('#ab-pick'), seatsEl = $('#ab-seats'), bar = $('#ab-bar'), msg = $('#ab-msg');
    var price = $('#ab-price'), old = $('#ab-old'), save = $('#ab-save'), img = $('#ab-sim-img'), badge = $('#ab-sim-badge');
    var add = $('#ab-add'), reset = $('#ab-reset');

    pick.innerHTML = list.map(function (p, i) {
      var short = p.name.split(' ').slice(0, 2).join(' ');
      return '<button type="button" data-i="' + i + '"' + (i === 0 ? ' class="is-on"' : '') + '>' + short + '</button>';
    }).join('');

    function render() {
      var need = cur.minMembers || 3, seats = Math.max(need, 5), done = n >= need;
      $('#ab-sim-name').textContent = cur.name;
      $('#ab-sim-cat').textContent = cur.category || '';
      price.textContent = fmt(done ? cur.group : cur.retail);
      price.classList.toggle('is-group', done);
      old.textContent = done ? fmt(cur.retail) : '';
      var pct = Math.round((1 - cur.group / cur.retail) * 100);
      save.textContent = 'Giảm ' + pct + '%'; save.classList.toggle('is-on', done);
      seatsEl.innerHTML = '';
      for (var i = 1; i <= seats; i++) {
        var s = document.createElement('span');
        s.className = 'ab-seat' + (i <= n ? ' is-on' : (i <= need ? ' is-need' : ''));
        s.textContent = i <= n ? (i === 1 ? 'Bạn' : '+' + (i - 1)) : '?';
        seatsEl.appendChild(s);
      }
      bar.style.width = Math.min(100, Math.round(n / need * 100)) + '%';
      bar.classList.toggle('is-done', done);
      badge.textContent = done ? 'ĐÃ MỞ GIÁ NHÓM' : 'NHÓM ĐANG MỞ';
      msg.innerHTML = done
        ? 'Chúc mừng! Nhóm đã đủ <b>' + need + ' thành viên</b>, mỗi người tiết kiệm <b>' + fmt(cur.retail - cur.group) + '</b>.'
        : 'Còn thiếu <b>' + (need - n) + ' thành viên</b> nữa để mở mức giá nhóm ' + fmt(cur.group) + '.';
      add.disabled = n >= seats; add.style.opacity = add.disabled ? .5 : 1;
    }
    function choose(i) {
      cur = list[i]; n = 1;
      $$('button', pick).forEach(function (b, k) { b.classList.toggle('is-on', k === i); });
      img.classList.add('is-swap');
      setTimeout(function () { img.src = cur.image; img.alt = cur.name; img.classList.remove('is-swap'); }, 220);
      render();
    }
    pick.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) choose(+b.dataset.i); });
    add.addEventListener('click', function () { n++; render(); });
    reset.addEventListener('click', function () { n = 1; render(); });
    img.src = cur.image; render();
  }

  /* ---------- 7. Quy trình tự chạy ---------- */
  var proc = $('#ab-proc');
  if (proc) {
    var steps = $$('.ab-step', proc), panes = $$('.ab-pane', proc), idx = 0, timer, DUR = 6000;
    proc.style.setProperty('--dur', DUR / 1000 + 's');
    var go = function (i) {
      idx = (i + steps.length) % steps.length;
      steps.forEach(function (s, k) {
        var on = k === idx; s.classList.toggle('is-on', on); s.setAttribute('aria-selected', on);
        var bar = $('i', s); if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
        panes[k].classList.toggle('is-on', on);
      });
      restart();
    };
    var restart = function () { clearTimeout(timer); if (!reduce) timer = setTimeout(function () { go(idx + 1); }, DUR); };
    steps.forEach(function (s, k) { s.addEventListener('click', function () { go(k); }); });
    proc.addEventListener('mouseenter', function () { proc.classList.add('is-paused'); clearTimeout(timer); });
    proc.addEventListener('mouseleave', function () { proc.classList.remove('is-paused'); restart(); });
    restart();
  }

})();
