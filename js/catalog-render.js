/*
 * WeBuy - Danh sach san pham (products.html).
 * - Sinh khu "Toan bo danh muc" tu window.WEBUY_CATEGORIES (nut data-filter, js/app.js xu ly loc).
 * - Sinh the san pham tu window.WEBUY_PRODUCTS (cung nguon voi trang chu, chi tiet, gio hang).
 * - Hien so ket qua, cac bo loc dang ap dung (doc tu URL) va nut Dat lai.
 * File nay chi chay tren products.html, tai SAU catalog-data.js va TRUOC app.js.
 */
(() => {
  'use strict';
  const grid = document.querySelector('.product-grid');
  if (!grid) return;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  const money = value => new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + 'đ';
  const all = () => window.WEBUY_PRODUCTS || [];
  const categories = window.WEBUY_CATEGORIES || [];
  const ICON_HEART = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20.3s-7.4-4.4-9.2-9.1C1.5 7.7 3.7 4.6 7 4.6c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.3 0 5.5 3.1 4.2 6.6-1.8 4.7-9.2 9.1-9.2 9.1z"></path></svg>';
  const ICON_COMPARE = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h12l-3-3M20 17H8l3 3"></path></svg>';
  const SORT_LABEL = {
    'price-asc': 'Giá lẻ tăng dần', 'price-desc': 'Giá lẻ giảm dần',
    'group-asc': 'Giá nhóm tăng dần', 'group-desc': 'Giá nhóm giảm dần'
  };

  /* ---------- Khu "Toàn bộ danh mục" ---------- */
  function renderCategoryGrid() {
    const box = document.getElementById('catalog-cat-grid');
    if (!box || !categories.length) return;
    const count = name => all().filter(p => p.category === name).length;
    box.innerHTML = `
      <button class="cat-filter fx-tilt" data-filter="all" type="button" aria-pressed="true">
        <span class="cat-filter-img cat-filter-all" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="2"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="13.5" width="7" height="7" rx="2"></rect></svg></span>
        <span class="cat-filter-name">Tất cả</span><span class="cat-filter-count">${all().length} sản phẩm</span>
      </button>` + categories.map(c => `
      <button class="cat-filter fx-tilt" data-filter="${escapeHTML(c.id)}" type="button" aria-pressed="false">
        <span class="cat-filter-img fx-skeleton" aria-hidden="true"><img src="${escapeHTML(c.image)}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>
        <span class="cat-filter-name">${escapeHTML(c.name)}</span><span class="cat-filter-count">${count(c.name)} sản phẩm</span>
      </button>`).join('');
  }

  /* ---------- Trạng thái lọc: số kết quả, bộ lọc đang áp dụng, nút Đặt lại ---------- */
  function renderStatus(shown) {
    const params = new URLSearchParams(location.search);
    const chips = [];
    const cat = categories.find(c => c.id === params.get('category'));
    if (cat) chips.push(['category', 'Danh mục: ' + cat.name]);
    const q = (params.get('q') || '').trim();
    if (q) chips.push(['q', `Tên: “${q}”`]);
    const min = params.get('groupMin'), max = params.get('groupMax');
    if (min || max) chips.push(['groupMin,groupMax', 'Giá nhóm: ' + (min ? money(min) : '0đ') + ' – ' + (max ? money(max) : 'không giới hạn')]);
    const sort = params.get('sort');
    if (SORT_LABEL[sort]) chips.push(['sort', 'Sắp xếp: ' + SORT_LABEL[sort]]);

    const active = document.getElementById('catalog-active');
    if (active) active.innerHTML = chips.map(([key, label]) =>
      `<button type="button" class="active-chip fx-press" data-clear-param="${key}" aria-label="Bỏ điều kiện ${escapeHTML(label)}">${escapeHTML(label)} <span aria-hidden="true">×</span></button>`).join('');
    const reset = document.getElementById('catalog-reset-all');
    if (reset) reset.hidden = chips.length === 0;
    const count = document.getElementById('catalog-count');
    if (count) count.innerHTML = `Hiển thị <b>${shown}</b>/${all().length} sản phẩm`;
  }

  /**
   * Render a product list to the existing products.html grid.
   * @param {Array<object>} list - filter/sort results or the complete WEBUY_PRODUCTS array.
   * @returns {number} number of rendered products
   */
  function renderProducts(list) {
    const items = Array.isArray(list) ? list : [];
    grid.innerHTML = items.map(p => {
      const id = escapeHTML(p.id);
      const name = escapeHTML(p.name);
      const category = escapeHTML(p.category);
      const image = escapeHTML(p.image);
      const badge = escapeHTML(p.badge || 'Mua chung');
      const need = Math.max(1, Number(p.minMembers) || 1);
      const members = Math.max(0, Number(p.initialMembers) || 0);
      const progress = Math.min(100, Math.round(members / need * 100));
      const price = Number(p.price ?? p.retail) || 0;
      const group = Number(p.group) || 0;
      const detailURL = `product-detail.html?id=${encodeURIComponent(String(p.id))}`;

      return `
        <article class="product-card fx-tilt" data-product-id="${id}">
          <div class="product-photo fx-skeleton">
            <img src="${image}" alt="Ảnh minh họa ${name}" width="400" height="400" loading="lazy" decoding="async" />
            <span class="tag tag-top">${badge}</span>
          </div>
          <div class="card-tools">
            <button class="tool-btn wish-btn fx-press fx-pop" type="button" data-wish="${id}" aria-pressed="false" aria-label="Thêm ${name} vào yêu thích" title="Yêu thích">${ICON_HEART}</button>
            <button class="tool-btn compare-btn fx-press fx-pop" type="button" data-compare="${id}" aria-pressed="false" aria-label="Thêm ${name} vào so sánh" title="So sánh">${ICON_COMPARE}</button>
          </div>
          <div class="product-details">
            <div class="product-category">${category}</div>
            <h3>${name}</h3>
            <div class="prices">
              <span class="price-row-label">Giá mua lẻ</span>
              <strong class="retail">${money(price)}</strong>
            </div>
            <div class="prices group-price-row">
              <span class="price-row-label">Giá mua chung</span>
              <strong class="group-price">${money(group)}</strong>
            </div>
            <p class="tier-condition">Áp dụng từ ${need} thành viên hợp lệ</p>
            <div class="group-stats">
              <span>
                <svg aria-hidden="true" class="icon" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"></circle><path d="M2 20v-2a6 6 0 0 1 12 0v2"></path><path d="M17 5a3 3 0 0 1 0 6m0 5a5 5 0 0 1 5 4"></path></svg>
                <b>${members}/${need}</b> thành viên
              </span>
              <span>
                <svg aria-hidden="true" class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
                Đang cập nhật
              </span>
            </div>
            <div class="progress-track" role="img" aria-label="Tiến độ nhóm mẫu: ${members} trên ${need} thành viên">
              <span style="width:${progress}%"></span>
            </div>
            <a class="card-detail fx-icon" href="${detailURL}">Xem chi tiết <svg aria-hidden="true" class="arrow-icon" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"></path></svg></a>
            <div class="card-shop-actions">
              <button class="card-add-button fx-press" data-add-cart="${id}" type="button">+ Thêm vào giỏ</button>
              <a class="card-join-link fx-press" href="${detailURL}">Mua chung</a>
            </div>
          </div>
        </article>`;
    }).join('');

    const empty = document.getElementById('empty-search');
    if (empty) empty.hidden = items.length !== 0;
    renderStatus(items.length);
    return items.length;
  }

  // Public function for search/filter/sort (js/app.js) to reuse instead of duplicating markup.
  window.renderProducts = renderProducts;
  renderCategoryGrid();
  renderProducts(all());

  // Mở từ menu/hero (#tat-ca-danh-muc): đưa tiêu điểm vào khu danh mục để dùng bàn phím ngay
  if (location.hash === '#tat-ca-danh-muc') {
    window.addEventListener('load', () => document.getElementById('tat-ca-danh-muc')?.focus({ preventScroll: true }), { once: true });
  }
})();
