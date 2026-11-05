/*
 * WeBuy - Bai tap nhom Buoi 3, Buoc 2.
 * Sinh danh sach san pham tu window.WEBUY_PRODUCTS.
 * Su dung class CSS va data-* hien co de tuong thich js/app.js.
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
      const description = escapeHTML(p.description);
      const badge = escapeHTML(p.badge || 'Mua chung');
      const need = Math.max(1, Number(p.minMembers) || 1);
      const members = Math.max(0, Number(p.initialMembers) || 0);
      const progress = Math.min(100, Math.round(members / need * 100));
      const price = Number(p.price ?? p.retail) || 0;
      const group = Number(p.group) || 0;
      const detailURL = `product-detail.html?id=${encodeURIComponent(String(p.id))}`;

      return `
        <article class="product-card" data-product-id="${id}">
          <div class="product-photo">
            <img src="${image}" alt="Ảnh minh họa ${name}" loading="lazy" />
            <span class="tag tag-top">${badge}</span>
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
            <a class="card-detail" href="${detailURL}">Xem chi tiết →</a>
            <div class="card-shop-actions">
              <button class="card-add-button" data-add-cart="${id}" type="button">+ Thêm vào giỏ</button>
              <a class="card-join-link" href="${detailURL}">Mua chung</a>
            </div>
          </div>
        </article>`;
    }).join('');

    // Empty-state is defined by existing Buoi 2 HTML and CSS.
    const empty = document.getElementById('empty-search');
    if (empty) empty.hidden = items.length !== 0;
    const count = document.getElementById('catalog-count');
    if (count) count.textContent = `Hiển thị ${items.length}/${(window.WEBUY_PRODUCTS || []).length} sản phẩm`;
    return items.length;
  }

  // Public function for Buoc 3 (search/filter/sort) to reuse instead of duplicating markup.
  window.renderProducts = renderProducts;
  renderProducts(window.WEBUY_PRODUCTS || []);
})();
