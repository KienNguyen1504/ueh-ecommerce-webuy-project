/* WeBuy – Product detail trust & discovery enhancements.
 * Uses the shared WEBUY_PRODUCTS catalog; Q&A and policy copy are explicitly demo-labelled.
 */
(() => {
  'use strict';
  const products = () => window.WEBUY_PRODUCTS || [];
  const money = n => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentId = new URLSearchParams(location.search).get('id');
  const product = products().find(p => String(p.id) === String(currentId));
  if (!document.querySelector('.detail-grid') || !product) return;

  const details = document.createElement('section');
  details.className = 'section detail-trust-section';
  details.innerHTML = `
    <div class="container detail-trust-grid">
      <section class="detail-info-panel">
        <div class="feature-section-heading"><span class="eyebrow">MINH BẠCH THÔNG TIN</span><h2>Thông tin chi tiết đáng tin</h2><p>Thông tin dưới đây lấy từ catalog WeBuy đang hiển thị. Trường nào chưa có dữ liệu sẽ được ghi rõ, không tự suy diễn thông số.</p></div>
        <div class="detail-spec-wrap"><table class="detail-spec-table"><tbody id="trusted-specs"></tbody></table></div>
        <div class="demo-policy"><span class="demo-pill">CHÍNH SÁCH DEMO</span><ul>
          <li>Giá lẻ và giá nhóm được hiển thị theo catalog hiện tại; không phải báo giá hoặc cam kết giao dịch thực.</li>
          <li>Giá nhóm chỉ áp dụng khi nhóm đạt số thành viên tối thiểu trước hạn kết thúc hiển thị.</li>
          <li>Nếu nhóm hết hạn mà chưa đủ người, trạng thái nhóm chuyển sang hết hạn; người dùng có thể xem nhóm khác hoặc tạo nhóm mới.</li>
          <li>Chính sách đổi trả, bảo hành và vận chuyển thực tế cần được người bán xác nhận trước khi mua.</li>
        </ul></div>
      </section>
      <section class="detail-info-panel detail-qa-panel">
        <div class="feature-section-heading"><span class="eyebrow">HỎI ĐÁP</span><h2>Câu hỏi thường gặp</h2><p class="demo-note">Các câu trả lời mẫu phục vụ trình diễn, không phải phản hồi từ khách hàng thật.</p></div>
        <div class="demo-qa-list">
          <details><summary>Giá mua chung được áp dụng khi nào? <span class="demo-pill">DEMO</span></summary><p>Giá mua chung trong bản demo chỉ được xem là điều kiện tham khảo và áp dụng khi nhóm đạt đủ số thành viên tối thiểu trước thời hạn.</p></details>
          <details><summary>Tôi có thể theo dõi nhóm đã tham gia ở đâu? <span class="demo-pill">DEMO</span></summary><p>Mở mục Hồ sơ → Nhóm mua của tôi. Dữ liệu nhóm hiện lưu trong localStorage của trình duyệt này.</p></details>
          <details><summary>Thông tin bảo hành và đổi trả được xác nhận thế nào? <span class="demo-pill">DEMO</span></summary><p>Catalog hiện chưa cung cấp chính sách riêng cho sản phẩm này. Vui lòng xác nhận trực tiếp với người bán trước khi đặt mua.</p></details>
        </div>
      </section>
    </div>
  `;
  document.querySelector('.details-description')?.after(details);

  const specRows = [
    ['Mã sản phẩm', product.id],
    ['Tên sản phẩm', product.name],
    ['Danh mục', product.category],
    ['Mô tả catalog', product.description || 'Chưa có mô tả trong catalog'],
    ['Giá mua lẻ', money(product.retail)],
    ['Giá mua chung', money(product.group)],
    ['Điều kiện nhóm', `Tối thiểu ${Number(product.minMembers) || 1} thành viên`],
    ['Mức tiết kiệm dự kiến', money(Math.max(0, Number(product.retail) - Number(product.group)))],
    ['Thông số kỹ thuật khác', Array.isArray(product.specs) && product.specs.length ? product.specs.map(s => `${s.label}: ${s.value}`).join(' · ') : 'Chưa có dữ liệu chi tiết trong catalog demo'],
    ['Người bán', product.storeName || product.sellerName || (String(product.id).startsWith('seller-') ? 'Người bán trên WeBuy' : 'Catalog WeBuy')]
  ];
  document.getElementById('trusted-specs').innerHTML = specRows.map(([k,v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');

  const relatedSection = document.createElement('section');
  relatedSection.className = 'section related-products-section';
  relatedSection.innerHTML = `<div class="container"><div class="feature-section-heading"><span class="eyebrow">KHÁM PHÁ THÊM</span><h2>Sản phẩm liên quan</h2><p>Ưu tiên cùng danh mục; nếu chưa đủ, bổ sung sản phẩm có giá nhóm gần nhau.</p></div><div class="related-products-grid" id="related-products-grid" aria-live="polite"><div class="related-loading"><span class="loading-dot"></span>Đang tìm sản phẩm phù hợp…</div></div></div>`;
  details.after(relatedSection);
  const sameCategory = products().filter(p => String(p.id) !== String(product.id) && p.category === product.category);
  const remaining = products().filter(p => String(p.id) !== String(product.id) && !sameCategory.some(x => String(x.id) === String(p.id)))
    .sort((a,b) => Math.abs(Number(a.group)-Number(product.group)) - Math.abs(Number(b.group)-Number(product.group)));
  const related = [...sameCategory, ...remaining].slice(0, 6);
  const grid = document.getElementById('related-products-grid');
  if (!related.length) grid.innerHTML = `<div class="feature-empty"><strong>Chưa có gợi ý phù hợp.</strong><p>Catalog hiện chưa có sản phẩm liên quan.</p><a class="btn btn-outline" href="products.html">Tìm sản phẩm khác</a></div>`;
  else grid.innerHTML = related.map(p => `<article class="related-card"><a class="related-image" href="product-detail.html?id=${encodeURIComponent(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async"></a><div class="related-card-body"><span class="related-category">${esc(p.category)}</span><a class="related-name" href="product-detail.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a><strong>${money(p.group)}</strong><small>Giá nhóm · từ ${Number(p.minMembers)||1} người</small><a class="related-link" href="product-detail.html?id=${encodeURIComponent(p.id)}">Xem chi tiết →</a></div></article>`).join('');

  document.querySelectorAll('.detail-main-image img, .related-card img').forEach(img => {
    const host = img.closest('.detail-main-image, .related-image');
    if (host && !img.complete) host.classList.add('is-loading');
    img.addEventListener('load', () => host?.classList.remove('is-loading'), { once: true });
    img.addEventListener('error', () => {
      host?.classList.remove('is-loading');
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = '1';
      img.removeAttribute('src');
      img.alt = img.alt || 'Ảnh sản phẩm chưa khả dụng';
      host?.classList.add('image-fallback');
    }, { once: true });
    if (img.complete && img.naturalWidth > 0) host?.classList.remove('is-loading');
  });
})();
