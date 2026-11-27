/* Generic image loading/error fallback for catalog, wishlist and feature cards. */
(() => {
  'use strict';
  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.wbFallback === '1') return;
    img.dataset.wbFallback = '1';
    img.removeAttribute('src');
    img.setAttribute('aria-label', 'Ảnh sản phẩm chưa khả dụng');
    const host = img.closest('.product-image,.product-card-image,.wish-thumb,.related-image,.hub-group-image,.cart-item-image,.detail-main-image') || img.parentElement;
    host?.classList.add('wb-image-error');
  }, true);
})();
