(() => {
  const id = new URLSearchParams(location.search).get('id');
  let shop;
  try { shop = JSON.parse(localStorage.getItem('webuy_seller_v1_shop')); } catch {}
  const title = document.getElementById('store-title');
  if (!shop || shop.id !== id) { title.textContent = 'Chưa tìm thấy cửa hàng trên trình duyệt này'; return; }
  document.title = shop.storeName + ' | WeBuy';
  title.textContent = shop.storeName;
  if (shop.logo) document.getElementById('store-logo').src = shop.logo;
  document.getElementById('store-description').textContent = shop.description || '';
  const products = window.WEBUY_PRODUCTS.filter(p => p.shopId === id && p.status === 'published');
  document.getElementById('store-count').textContent = products.length ? `Đang bán · ${products.length} sản phẩm` : 'Chưa có sản phẩm đang bán';
  for (const p of products) {
    const card = document.createElement('a'), img = document.createElement('img'), name = document.createElement('b'), price = document.createElement('small');
    card.href = 'product-detail.html?id=' + encodeURIComponent(p.id);
    img.src = p.image; img.alt = ''; img.loading = 'lazy'; name.textContent = p.name;
    price.textContent = new Intl.NumberFormat('vi-VN').format(p.group) + 'đ · Từ ' + p.minMembers + ' người';
    card.append(img,name,price); document.getElementById('store-catalog').append(card);
  }
  window.addEventListener('storage',e => { if (e.key?.startsWith('webuy_seller_v1_')) location.reload(); });
})();
