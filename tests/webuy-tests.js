/* WeBuy | Buoc 7 - Kiem thu tu dong tren trinh duyet.
 * File nay CHI duoc nap boi tests/test-runner.html, KHONG anh huong website.
 * Moi test nap trang that trong <iframe> cung nguon, thao tac nhu nguoi dung
 * va so sanh ket qua thuc te voi ket qua mong doi.
 */
(() => {
  'use strict';
  const PREFIX = 'webuy_demo_v2_';
  const frame = document.getElementById('sandbox');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  /* Xoa du lieu demo de moi test bat dau tu trang thai sach. */
  const testKey = k => k.startsWith('webuy_') || k.startsWith('group_created_');
  function resetStorage() {
    Object.keys(localStorage)
      .filter(testKey)
      .forEach(k => localStorage.removeItem(k));
    localStorage.setItem('webuy_location_prompted','1');
  }
  /* Nap mot trang vao iframe, cho script chay xong, tra ve window cua trang. */
  function load(url) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Het thoi gian nap ' + url)), 8000);
      frame.onload = async () => { clearTimeout(timer); await sleep(250); resolve(frame.contentWindow); };
      frame.src = url;
    });
  }
  const $ = (w, sel) => w.document.querySelector(sel);
  const $$ = (w, sel) => [...w.document.querySelectorAll(sel)];
  const click = async (w, sel) => { const el = $(w, sel); if (!el) throw new Error('Khong thay phan tu ' + sel); el.click(); await sleep(250); };
  const cartCount = w => $(w, '[data-cart-count]').textContent.trim();
  const P = () => window.WEBUY_PRODUCTS;
  function eq(actual, expected, label) {
    if (actual !== expected) throw new Error(`${label || 'Gia tri'}: mong doi "${expected}", thuc te "${actual}"`);
  }
  function ok(cond, msg) { if (!cond) throw new Error(msg); }

  /* ---- Danh sach test case: id, nhom, mo ta, ket qua mong doi, ham kiem tra ---- */
  const T = [];
  const tc = (id, group, desc, expected, fn) => T.push({ id, group, desc, expected, fn });

  /* 1. Dieu huong va hien thi */
  tc('TC01', 'Điều hướng', 'Mở trang chủ, kiểm tra tiêu đề và 4 liên kết danh mục', 'Tiêu đề "Trang chủ | WeBuy"; có ít nhất 4 liên kết products.html?category=', async () => {
    const w = await load('../index.html');
    eq(w.document.title, 'Trang chủ | WeBuy', 'Tiêu đề');
    const n = $$(w, 'a[href*="products.html?category="]').length;
    ok(n >= 4, `Chỉ có ${n} liên kết danh mục`);
    return `Tiêu đề đúng; ${n} liên kết danh mục`;
  });
  tc('TC02', 'Điều hướng', 'Menu chính tô sáng đúng trang hiện tại trên cart/checkout/profile', 'Không có mục menu nào bị tô sáng nhầm là "Giới thiệu"', async () => {
    const bad = [];
    for (const page of ['cart', 'checkout', 'profile']) {
      const w = await load(`../${page}.html`);
      const active = $$(w, '.primary-nav .is-active').map(a => a.textContent.trim());
      if (active.includes('Giới thiệu')) bad.push(page + '.html');
    }
    ok(!bad.length, 'Menu "Giới thiệu" bị tô sáng nhầm tại: ' + bad.join(', '));
    return 'Menu không tô sáng nhầm trên cả 3 trang';
  });

  /* 2. Danh sach, loc, tim kiem, sap xep */
  tc('TC03', 'Sản phẩm', 'Mở products.html', 'Hiển thị đủ 24 thẻ sản phẩm (6 danh mục)', async () => {
    const w = await load('../products.html');
    eq($$(w, '.product-card').length, P().length, 'Số thẻ sản phẩm');
    ok(P().length >= 24, 'Dữ liệu chưa đủ 24 sản phẩm');
    return `${P().length}/${P().length} thẻ sản phẩm`;
  });
  tc('TC04', 'Sản phẩm', 'Lọc danh mục ?category=ao-thun', 'Chỉ còn các sản phẩm Áo thun (4)', async () => {
    const w = await load('../products.html?category=ao-thun');
    const expected = P().filter(p => p.category === 'Áo thun').length;
    eq($$(w, '.product-card').length, expected, 'Số thẻ');
    ok($$(w, '.product-category').every(el => el.textContent.trim() === 'Áo thun'), 'Có thẻ khác danh mục');
    return `Còn ${expected} sản phẩm Áo thun`;
  });
  tc('TC05', 'Sản phẩm', 'Tìm kiếm không dấu: ?q=den ban', 'Tìm thấy "Đèn bàn Minimal Light"', async () => {
    const w = await load('../products.html?q=den%20ban');
    eq($$(w, '.product-card').length, 1, 'Số kết quả');
    ok($(w, '.product-card h3').textContent.includes('Đèn bàn'), 'Sai sản phẩm');
    return 'Tìm đúng: ' + $(w, '.product-card h3').textContent;
  });
  tc('TC06', 'Sản phẩm', 'Tìm từ khóa không tồn tại: ?q=xyz123', '0 sản phẩm và hiện thông báo trống', async () => {
    const w = await load('../products.html?q=xyz123');
    eq($$(w, '.product-card').length, 0, 'Số thẻ');
    const empty = w.document.getElementById('empty-search');
    ok(empty && !empty.hidden, 'Không hiện thông báo "không có kết quả"');
    return '0 sản phẩm, thông báo trống đang hiển thị';
  });
  tc('TC07', 'Sản phẩm', 'Sắp xếp giá mua lẻ tăng dần ?sort=price-asc', 'Sản phẩm đầu tiên có giá lẻ thấp nhất', async () => {
    const w = await load('../products.html?sort=price-asc');
    const cheapest = [...P()].sort((a, b) => a.price - b.price)[0];
    eq($(w, '.product-card h3').textContent, cheapest.name, 'Sản phẩm đầu');
    return 'Đầu danh sách: ' + cheapest.name + ' (' + fmt(cheapest.price) + ')';
  });
  tc('TC08', 'Sản phẩm', 'Lọc khoảng giá mua chung 200.000–300.000đ', 'Số sản phẩm khớp đúng với dữ liệu', async () => {
    const w = await load('../products.html?groupMin=200000&groupMax=300000');
    const expected = P().filter(p => p.group >= 200000 && p.group <= 300000).length;
    eq($$(w, '.product-card').length, expected, 'Số sản phẩm');
    return expected + ' sản phẩm khớp';
  });

  /* 3. Chi tiet san pham */
  tc('TC09', 'Chi tiết', 'Mở chi tiết cho cả 24 sản phẩm (id=1..24)', 'Mỗi trang hiển thị đúng tên, giá lẻ, giá nhóm', async () => {
    for (const p of P()) {
      const w = await load('../product-detail.html?id=' + p.id);
      eq($(w, '#detail-title').textContent, p.name, `Tên id=${p.id}`);
      eq($(w, '#detail-retail-price').textContent, fmt(p.retail), `Giá lẻ id=${p.id}`);
      eq($(w, '#detail-group-price').textContent, fmt(p.group), `Giá nhóm id=${p.id}`);
    }
    return `Đúng cả ${P().length} sản phẩm`;
  });
  tc('TC10', 'Chi tiết', 'Mở id không tồn tại (id=99)', 'Hiện thông báo "Không tìm thấy sản phẩm"', async () => {
    const w = await load('../product-detail.html?id=99');
    ok(!$(w, '#detail-not-found').hidden, 'Không hiện thông báo lỗi');
    return 'Thông báo không tìm thấy đang hiển thị';
  });
  tc('TC11', 'Chi tiết', 'Trang chi tiết có khối "Nhóm đang mở" (id=1)', 'Có ít nhất 1 nhóm hiển thị kèm tiến độ', async () => {
    const w = await load('../product-detail.html?id=1');
    ok($(w, '#available-groups'), 'Thiếu phần tử #available-groups trong product-detail.html');
    ok($$(w, '#available-groups .available-group').length >= 1, 'Không có nhóm nào được hiển thị');
    return 'Hiển thị ' + $$(w, '#available-groups .available-group').length + ' nhóm';
  });

  /* 4. Gio hang */
  tc('TC12', 'Giỏ hàng', 'Bấm "+ Thêm vào giỏ" ở thẻ sản phẩm', 'Bộ đếm giỏ hàng tăng thành 1', async () => {
    const w = await load('../products.html');
    await click(w, '[data-add-cart="1"]');
    eq(cartCount(w), '1', 'Bộ đếm giỏ');
    return 'Bộ đếm giỏ = 1';
  });
  tc('TC13', 'Giỏ hàng', 'Tải lại trang sau khi thêm giỏ', 'Giỏ hàng vẫn giữ nguyên (localStorage)', async () => {
    const w = await load('../products.html');
    await click(w, '[data-add-cart="1"]');
    const w2 = await load('../products.html');
    eq(cartCount(w2), '1', 'Bộ đếm sau khi tải lại');
    return 'Giỏ vẫn còn 1 sản phẩm sau khi tải lại';
  });
  tc('TC14', 'Giỏ hàng', 'Nhập số lượng không hợp lệ (0, 100, 1.5) rồi bấm Thêm vào giỏ', 'Báo lỗi, giỏ không thay đổi', async () => {
    const w = await load('../product-detail.html?id=2');
    for (const v of ['0', '100', '1.5']) {
      $(w, '#detail-qty').value = v;
      await click(w, '#detail-add-cart');
      eq(cartCount(w), '0', `Bộ đếm sau khi nhập ${v}`);
    }
    return 'Cả 3 giá trị sai đều bị từ chối';
  });
  tc('TC15', 'Giỏ hàng', 'Nhập số lượng 3 hợp lệ rồi Thêm vào giỏ', 'Bộ đếm giỏ = 3', async () => {
    const w = await load('../product-detail.html?id=2');
    $(w, '#detail-qty').value = '3';
    await click(w, '#detail-add-cart');
    eq(cartCount(w), '3', 'Bộ đếm giỏ');
    return 'Bộ đếm giỏ = 3';
  });
  tc('TC16', 'Giỏ hàng', 'Trang giỏ: bấm + rồi − rồi xóa', 'Tạm tính đổi theo số lượng; xóa xong giỏ trống', async () => {
    const w0 = await load('../product-detail.html?id=2');
    await click(w0, '#detail-add-cart');
    const w = await load('../cart.html');
    eq($(w, '#cart-subtotal').textContent, fmt(189000), 'Tạm tính ban đầu');
    await click(w, '[data-cart-plus]');
    eq($(w, '#cart-subtotal').textContent, fmt(378000), 'Tạm tính sau khi +');
    await click(w, '[data-cart-minus]');
    eq($(w, '#cart-subtotal').textContent, fmt(189000), 'Tạm tính sau khi −');
    await click(w, '[data-cart-remove]');
    eq($$(w, '.cart-item').length, 0, 'Số dòng sau khi xóa');
    return 'Tạm tính 189.000đ → 378.000đ → 189.000đ → giỏ trống';
  });
  tc('TC17', 'Giỏ hàng', 'localStorage chứa giỏ hàng bị hỏng/sai định dạng', 'Trang không lỗi, giỏ hiển thị 0', async () => {
    localStorage.setItem(PREFIX + 'cart', '{khong-phai-json');
    let w = await load('../cart.html');
    eq(cartCount(w), '0', 'Bộ đếm khi JSON hỏng');
    localStorage.setItem(PREFIX + 'cart', JSON.stringify([{ productId: '1', kind: 'retail', quantity: -5 }, { productId: '999', kind: 'retail', quantity: 1 }]));
    w = await load('../cart.html');
    eq(cartCount(w), '0', 'Bộ đếm khi dữ liệu giả');
    return 'Dữ liệu hỏng/giả bị bỏ qua, không phát sinh lỗi';
  });

  /* 5. Mua chung */
  tc('TC18', 'Mua chung', 'Nút "Tham gia nhóm" trên chi tiết Balo (nhóm 2/3 đang mở)', 'Nút hiển thị và bấm được', async () => {
    const w = await load('../product-detail.html?id=1');
    const b = $(w, '#join-group-btn');
    ok(b.offsetParent !== null, 'Nút "Tham gia nhóm" đang bị ẩn');
    ok(!b.disabled, 'Nút "Tham gia nhóm" đang bị vô hiệu hóa');
    return 'Nút hiển thị và dùng được';
  });
  tc('TC19', 'Mua chung', 'Bấm "Tham gia nhóm" của Balo (2/3 → 3/3)', 'Nhóm đủ thành viên; giỏ có mục mua chung sẵn sàng, tạm tính = 249.000đ', async () => {
    const w = await load('../product-detail.html?id=1');
    await click(w, '#join-group-btn');
    eq(cartCount(w), '1', 'Bộ đếm giỏ');
    const c = await load('../cart.html');
    ok($(c, '.cart-item-state').textContent.includes('Sẵn sàng xác nhận'), 'Mục mua chung chưa ở trạng thái sẵn sàng');
    eq($(c, '#cart-subtotal').textContent, fmt(249000), 'Tạm tính');
    return 'Nhóm 3/3, tạm tính 249.000đ';
  });
  tc('TC20', 'Mua chung', 'Sau khi nhóm đã đủ, kiểm tra không thể tham gia thêm', 'Nút bị vô hiệu hóa, thông báo "Chưa có nhóm đang mở"', async () => {
    const w = await load('../product-detail.html?id=1');
    await click(w, '#join-group-btn');
    const w2 = await load('../product-detail.html?id=1');
    ok($(w2, '#join-group-btn').disabled, 'Nút vẫn còn bấm được dù nhóm đã đủ');
    return 'Nút bị khóa: "' + $(w2, '#join-group-btn').textContent.trim() + '"';
  });
  tc('TC21', 'Mua chung', 'Tạo nhóm mới cho Đèn bàn (cần 4 người)', 'Hiện hộp thoại; giỏ có mục "Đang chờ đủ thành viên (1/4)"; không cho xác nhận đơn', async () => {
    const w = await load('../product-detail.html?id=3');
    await click(w, '#create-group-btn');
    ok($(w, '.app-modal'), 'Không hiện hộp thoại tạo nhóm');
    const c = await load('../cart.html');
    ok($(c, '.cart-item-state').textContent.includes('1/4'), 'Trạng thái không phải 1/4: ' + $(c, '.cart-item-state').textContent);
    eq($(c, '#cart-checkout').getAttribute('aria-disabled'), 'true', 'aria-disabled của nút xác nhận');
    return 'Nhóm 1/4 bị chặn không cho xác nhận đơn';
  });
  tc('TC22', 'Mua chung', 'Nhóm tự tạo: bấm "+ Mô phỏng 1 thành viên" đến khi đủ 4/4', 'Giỏ chuyển sang "Sẵn sàng xác nhận", tạm tính = 349.000đ', async () => {
    const w = await load('../product-detail.html?id=3');
    await click(w, '#create-group-btn');
    const w2 = await load('../product-detail.html?id=3');
    for (let i = 0; i < 3; i++) {
      const btn = $(w2, '[data-simulate-member]');
      ok(btn, 'Không có nút "+ Mô phỏng 1 thành viên mới (demo)" trên trang chi tiết');
      btn.click(); await sleep(250);
    }
    const c = await load('../cart.html');
    ok($(c, '.cart-item-state').textContent.includes('Sẵn sàng xác nhận'), 'Chưa sẵn sàng: ' + $(c, '.cart-item-state').textContent);
    eq($(c, '#cart-subtotal').textContent, fmt(349000), 'Tạm tính');
    return 'Nhóm 4/4, tạm tính 349.000đ';
  });

  /* 6. Thanh toan demo va ho so */
  async function addRetailAndOpenCheckout() {
    const w = await load('../product-detail.html?id=2');
    await click(w, '#detail-add-cart');
    return load('../checkout.html');
  }
  tc('TC23', 'Xác nhận đơn', 'Nhập số điện thoại sai định dạng "abc" và "12345"', 'Trường điện thoại bị đánh dấu không hợp lệ', async () => {
    const w = await addRetailAndOpenCheckout();
    const phone = $(w, '#checkout-phone');
    for (const v of ['abc', '12345']) {
      phone.value = v;
      ok(!phone.validity.valid, `Số điện thoại "${v}" vẫn được chấp nhận`);
    }
    return 'Cả 2 giá trị sai đều bị từ chối';
  });
  tc('TC24', 'Xác nhận đơn', 'Nhập số điện thoại hợp lệ "0901234567" và "+84901234567"', 'Trường điện thoại hợp lệ', async () => {
    const w = await addRetailAndOpenCheckout();
    const phone = $(w, '#checkout-phone');
    for (const v of ['0901234567', '+84901234567']) {
      phone.value = v;
      ok(phone.validity.valid, `Số điện thoại hợp lệ "${v}" bị từ chối`);
    }
    return 'Cả 2 định dạng đều được chấp nhận';
  });
  tc('TC25', 'Xác nhận đơn', 'Điền đủ thông tin hợp lệ và bấm "Lưu đơn hàng demo"', 'Hiện hộp thoại mã đơn; giỏ về 0; hồ sơ có 1 đơn', async () => {
    const w = await addRetailAndOpenCheckout();
    $(w, '[name=name]').value = 'Nguyễn Văn A';
    $(w, '[name=phone]').value = '0901234567';
    $(w, '[name=address]').value = '59C Nguyễn Đình Chiểu, Q.3, TP.HCM';
    $(w, '#checkout-form [type=submit]').click(); await sleep(400);
    ok($(w, '.app-modal'), 'Không hiện hộp thoại xác nhận đơn');
    eq(cartCount(w), '0', 'Giỏ sau khi đặt');
    const p = await load('../profile.html');
    eq($$(p, '.order-item').length, 1, 'Số đơn trong hồ sơ');
    return 'Đơn được lưu, giỏ trống, hồ sơ có 1 đơn';
  });
  tc('TC26', 'Hồ sơ', 'Đổi tên hiển thị trong hồ sơ thành "Trần Thị B"', 'Avatar trên header đổi thành "TB"', async () => {
    const w = await load('../profile.html');
    $(w, '[name=name]').value = 'Trần Thị B';
    $(w, '#profile-form [type=submit]').click(); await sleep(300);
    eq($(w, '[data-avatar]').textContent.trim(), 'TB', 'Chữ viết tắt avatar');
    return 'Avatar = TB';
  });
  tc('TC27', 'Xác nhận đơn', 'Mở checkout khi giỏ trống', 'Ẩn biểu mẫu, hiện thông báo "Chưa có sản phẩm có thể xác nhận"', async () => {
    const w = await load('../checkout.html');
    ok(w.document.getElementById('checkout-form').hidden, 'Biểu mẫu vẫn hiển thị khi giỏ trống');
    return 'Biểu mẫu bị ẩn khi giỏ trống';
  });
  tc('TC28', 'Trang chủ', 'Bố cục trang chủ mới: hero 3D + 2 CTA, danh mục, nhóm sắp đủ, nổi bật, 3 bước, tin cậy', 'Đúng thứ tự khối; ảnh và giá lấy từ dữ liệu chung', async () => {
    const w = await load('../index.html');
    const order = ['.hero3d', '.home-cats', '#nhom-sap-du', '.section-products', '#quy-trinh', '.trust-section'];
    const tops = order.map(sel => { const el = $(w, sel); ok(el, 'Thiếu khối ' + sel); return el.getBoundingClientRect().top + w.scrollY; });
    ok(tops.every((t, i) => i === 0 || t > tops[i - 1]), 'Sai thứ tự khối trang chủ');
    ok($(w, '.hero3d a[href="#nhom-sap-du"]') && $(w, '.hero3d a[href="products.html#tat-ca-danh-muc"]'), 'Thiếu 2 CTA Xem nhóm / Khám phá sản phẩm');
    ok($(w, '.hero3d-scene .scene-stage .people-cut') && $$(w, '.hero3d-scene .coin').length >= 3, 'Hero chưa có cảnh 3D');
    eq($$(w, '#home-cat-grid .cat-tile').length, (w.WEBUY_CATEGORIES || []).length + 1, 'Số ô danh mục (gồm Tất cả)');
    eq($$(w, '.step-card').length, 3, 'Số bước mua chung');
    eq($(w, '.journey-cta').getAttribute('href'), 'products.html', 'Đường dẫn CTA');
    const firstCard = $(w, '.fp-card');
    const p = P().find(x => x.id === firstCard.dataset.productId);
    eq(firstCard.querySelector('img').getAttribute('src'), p.image, 'Ảnh sản phẩm nổi bật');
    eq(firstCard.querySelector('.fp-group').textContent, fmt(p.group), 'Giá nhóm sản phẩm nổi bật');
    return 'Đủ 6 khối đúng thứ tự, 2 CTA, cảnh 3D, 3 bước';
  });
  tc('TC29', 'Địa điểm', 'Tự mở popup khi chưa lưu địa điểm', 'Popup lựa chọn xuất hiện khi vào trang', async () => {
    localStorage.removeItem('webuy_location_prompted');
    localStorage.removeItem(PREFIX + 'location');
    const w = await load('../index.html');
    ok($(w, '.loc-modal'), 'Popup địa điểm không tự mở');
    return 'Popup tự mở khi chưa lưu địa điểm';
  });
  tc('TC30', 'Địa điểm', 'Không tự mở popup khi đã lưu địa điểm', 'Trang tải bình thường, popup không xuất hiện', async () => {
    localStorage.removeItem('webuy_location_prompted');
    localStorage.setItem(PREFIX + 'location', JSON.stringify({ code: 'hcm', name: 'TP.HCM' }));
    const w = await load('../index.html');
    ok(!$(w, '.loc-modal'), 'Popup vẫn tự mở dù đã có địa điểm');
    return 'Không hiện popup khi địa điểm đã được lưu';
  });

  /* ---- Tinh nang 11: Xu WeBuy (diem danh, tro choi, dung xu) ---- */
  tc('TC31', 'Xu WeBuy', 'Mở trang chủ', 'Có nút nổi "Điểm danh săn quà" và chip "0 xu" trên Header', async () => {
    const w = await load('../index.html');
    ok($(w, '.wbr-fab-main'), 'Không thấy nút nổi điểm danh');
    eq($(w, '.wbr-chip').textContent.trim(), '0 xu', 'Chip xu');
    return 'Có nút nổi và chip "0 xu"';
  });
  tc('TC32', 'Xu WeBuy', 'Bấm chip xu rồi bấm "Nhận ngay" để điểm danh lần đầu', 'Số dư 10 xu, lịch sử có dòng "Điểm danh Ngày 1"', async () => {
    const w = await load('../index.html');
    await click(w, '.wbr-chip');
    await click(w, '[data-wbr="checkin"]');
    const s = w.WeBuyRewards.getState();
    eq(s.balance, 10, 'Số dư');
    eq(s.history[0].note, 'Điểm danh Ngày 1', 'Lịch sử');
    ok($(w, '.wbr-reward'), 'Không hiện màn Chúc mừng');
    return 'Số dư 10 xu, có màn Chúc mừng';
  });
  tc('TC33', 'Xu WeBuy', 'Điểm danh lần thứ hai trong cùng ngày', 'Không cộng thêm xu, số dư vẫn 10', async () => {
    const w = await load('../index.html');
    w.WeBuyRewards.claimCheckin();
    const again = w.WeBuyRewards.claimCheckin();
    ok(!again.ok, 'Vẫn cho điểm danh lần hai');
    eq(w.WeBuyRewards.getState().balance, 10, 'Số dư');
    return 'Lần hai bị chặn, số dư 10';
  });
  tc('TC34', 'Xu WeBuy', 'Sang ngày kế tiếp, rồi bỏ lỡ một ngày', 'Ngày kế nhận mức Ngày 2; bỏ lỡ thì chuỗi về Ngày 1', async () => {
    const w = await load('../index.html');
    const R = w.WeBuyRewards;
    R.debugSetToday('2026-11-20'); R.claimCheckin();
    R.debugSetToday('2026-11-21');
    const next = R.getCheckin();
    eq(next.day, 2, 'Ngày kế tiếp');
    R.claimCheckin();
    R.debugSetToday('2026-11-23');
    const skip = R.getCheckin();
    eq(skip.day, 1, 'Sau khi bỏ lỡ');
    ok(skip.broken, 'Không báo đứt chuỗi');
    R.debugSetToday(null);
    return 'Ngày 2 đúng mức, bỏ lỡ thì về Ngày 1';
  });
  tc('TC35', 'Xu WeBuy', 'Dùng hết lượt chơi Gom nhóm trong ngày', 'Còn 0 lượt, nút "Chơi ngay" bị khóa', async () => {
    const w = await load('../index.html');
    await click(w, '.wbr-chip');
    await click(w, '[data-wbr="play"]');
    await sleep(2400); // chờ đếm ngược 3-2-1 để lượt chơi được tính
    eq(w.WeBuyRewards.playInfo().left, 0, 'Số lượt còn lại');
    w.WeBuyRewards.close(); // kết thúc sớm, nhận xu an ủi
    await sleep(250);
    ok(w.WeBuyRewards.getState().balance >= 5, 'Không nhận được xu tối thiểu');
    await click(w, '[data-wbr="hub"]');
    ok(!$(w, '[data-wbr="play"]'), 'Nút chơi vẫn bấm được');
    return 'Hết lượt, nhận ít nhất 5 xu';
  });
  tc('TC36', 'Xu WeBuy', 'Thanh toán đơn có bật "Dùng Xu WeBuy" khi có 300 xu', 'Đơn 299.000đ giảm 29.900đ, số dư còn 1 xu', async () => {
    let w = await load('../index.html');
    w.WeBuyRewards.addXu(300, 'Nạp thử');
    localStorage.setItem(PREFIX + 'cart', JSON.stringify([{ productId: P()[0].id, kind: 'retail', groupId: null, quantity: 1, addedAt: Date.now() }]));
    w = await load('../checkout.html');
    const total = P()[0].retail;
    const use = Math.min(300, Math.floor(total * 0.1 / 100));
    await click(w, '#wbr-use-xu');
    $(w, '#checkout-name').value = 'Nguyễn Văn A';
    $(w, '#checkout-phone').value = '0912345678';
    $(w, '#checkout-address').value = '59C Nguyễn Đình Chiểu';
    $(w, '#checkout-form').requestSubmit();
    await sleep(400);
    const order = JSON.parse(localStorage.getItem(PREFIX + 'orders')).slice(-1)[0];
    eq(order.xuUsed, use, 'Số xu đã dùng');
    eq(order.total, total - use * 100, 'Tổng sau giảm');
    eq(w.WeBuyRewards.getState().balance, 300 - use, 'Số dư còn lại');
    return `Dùng ${use} xu, giảm ${fmt(use * 100)}`;
  });
  tc('TC37', 'Xu WeBuy', 'Chơi Vịt bay săn xu một lượt rồi đóng popup', 'Lượt Vịt bay về 0, nhận ít nhất 5 xu, lượt Gom nhóm vẫn còn', async () => {
    const w = await load('../index.html');
    await click(w, '.wbr-chip');
    await click(w, '[data-wbr="fly"]');
    ok($(w, '[data-wbr-fly-canvas]'), 'Không thấy sân chơi Vịt bay');
    await sleep(2400); // chờ đếm ngược 3-2-1 để lượt chơi được tính
    eq(w.WeBuyRewards.flyInfo().left, 0, 'Số lượt Vịt bay còn lại');
    eq(w.WeBuyRewards.playInfo().left, 1, 'Số lượt Gom nhóm còn lại');
    w.WeBuyRewards.close(); // kết thúc sớm, nhận xu an ủi
    await sleep(250);
    ok(w.WeBuyRewards.getState().balance >= 5, 'Không nhận được xu tối thiểu');
    await click(w, '[data-wbr="hub"]');
    ok(!$(w, '[data-wbr="fly"]'), 'Nút Bay thôi vẫn bấm được');
    return 'Hết lượt Vịt bay, nhận ít nhất 5 xu, Gom nhóm còn 1 lượt';
  });


  /* 9. Danh muc, Yeu thich, So sanh (Front-end checklist 27/11) */
  tc('TC38', 'Danh mục', 'Mở products.html#tat-ca-danh-muc, bấm danh mục "Thiết bị điện tử"', 'Hiện đủ 6 danh mục + Tất cả; lọc còn sản phẩm điện tử, URL có category', async () => {
    const w = await load('../products.html#tat-ca-danh-muc');
    eq($$(w, '#catalog-cat-grid [data-filter]').length, (w.WEBUY_CATEGORIES || []).length + 1, 'Số ô danh mục');
    await click(w, '#catalog-cat-grid [data-filter="dien-tu"]');
    const expected = P().filter(p => p.category === 'Thiết bị điện tử').length;
    eq($$(w, '.product-card').length, expected, 'Số sản phẩm điện tử');
    ok(w.location.search.includes('category=dien-tu'), 'URL chưa phản ánh danh mục');
    return `${expected} sản phẩm, URL ${w.location.search}`;
  });
  tc('TC39', 'Danh mục', 'Kết hợp danh mục + tên + sắp xếp qua URL, rồi Đặt lại', 'Kết quả đúng sau khi tải lại; Đặt lại về đủ sản phẩm', async () => {
    const w = await load('../products.html?category=dien-tu&q=loa&sort=group-desc');
    const expected = P().filter(p => p.category === 'Thiết bị điện tử' && p.name.toLowerCase().includes('loa')).sort((a, b) => b.group - a.group);
    eq($$(w, '.product-card').length, expected.length, 'Số kết quả');
    eq($(w, '.product-card h3').textContent, expected[0].name, 'Sản phẩm đầu (giá nhóm cao nhất)');
    ok($(w, '#catalog-count').textContent.includes(`${expected.length}/${P().length}`), 'Không hiện số kết quả');
    await click(w, '#catalog-reset-all');
    eq($$(w, '.product-card').length, P().length, 'Số thẻ sau khi Đặt lại');
    return `${expected.length} kết quả → Đặt lại còn ${P().length}`;
  });
  tc('TC40', 'Yêu thích', 'Bấm tim trên thẻ Balo 2 lần rồi 1 lần nữa', 'Lưu đúng 1 ID "1" trong localStorage, nút ở trạng thái bật', async () => {
    const w = await load('../products.html');
    await click(w, '.product-card[data-product-id="1"] [data-wish]');
    await click(w, '.product-card[data-product-id="1"] [data-wish]');
    await click(w, '.product-card[data-product-id="1"] [data-wish]');
    eq(localStorage.getItem(PREFIX + 'wishlist'), '["1"]', 'Danh sách lưu');
    eq($(w, '.product-card[data-product-id="1"] [data-wish]').getAttribute('aria-pressed'), 'true', 'Trạng thái nút');
    return 'Lưu ["1"], không trùng';
  });
  tc('TC41', 'Yêu thích', 'Mở Hồ sơ khi danh sách có 1 sản phẩm và 1 sản phẩm đã ẩn (id 999), rồi xóa', 'Hiện 1 sản phẩm + 1 mục "không còn hiển thị"; xóa được', async () => {
    localStorage.setItem(PREFIX + 'wishlist', JSON.stringify(['21', '999']));
    const w = await load('../profile.html#yeu-thich');
    eq($$(w, '#wishlist-list .wish-item:not(.is-hidden)').length, 1, 'Sản phẩm hiển thị');
    eq($$(w, '#wishlist-list .wish-item.is-hidden').length, 1, 'Mục đã ẩn');
    await click(w, '#wishlist-list [data-wish-remove="21"]');
    await click(w, '[data-wish-clear-hidden]');
    eq(localStorage.getItem(PREFIX + 'wishlist'), '[]', 'Danh sách sau khi xóa');
    return 'Hiển thị đúng và xóa hết được';
  });
  tc('TC42', 'So sánh', 'Chọn so sánh 4 sản phẩm liên tiếp', 'Chỉ giữ tối đa 3 sản phẩm, khay hiện 3/3', async () => {
    const w = await load('../products.html');
    for (const id of ['1', '17', '21', '9']) await click(w, `.product-card[data-product-id="${id}"] [data-compare]`);
    eq(localStorage.getItem(PREFIX + 'compare'), '["1","17","21"]', 'Danh sách so sánh');
    eq($$(w, '#compare-tray .ct-item:not(.ct-empty)').length, 3, 'Số mục trong khay');
    return 'Giữ 3 sản phẩm đầu, báo vượt giới hạn';
  });
  tc('TC43', 'So sánh', 'Mở bảng so sánh 3 sản phẩm, xóa 1 mục', 'Giá lẻ/giá nhóm/thành viên đúng dữ liệu chung; còn 2 cột sau khi xóa', async () => {
    localStorage.setItem(PREFIX + 'compare', JSON.stringify(['1', '17', '21']));
    const w = await load('../products.html');
    await click(w, '[data-compare-open]');
    const rows = $$(w, '.cmp-table tbody tr').map(r => [...r.querySelectorAll('td')].map(td => td.textContent.trim()));
    ['1', '17', '21'].forEach((id, k) => {
      const p = P().find(x => x.id === id);
      eq(rows[1][k], fmt(p.retail), 'Giá lẻ ' + p.name);
      ok(rows[2][k].startsWith(fmt(p.group)), 'Sai giá nhóm ' + p.name);
      ok(rows[4][k].startsWith(p.minMembers + ' người'), 'Sai số thành viên ' + p.name);
    });
    await click(w, '.cmp-table [data-compare-remove="17"]');
    eq($$(w, '.cmp-table thead th').length - 1, 2, 'Số cột sau khi xóa');
    return 'Bảng đúng dữ liệu, xóa mục hoạt động';
  });


  /* 10. Frontend checklist bổ sung: Group Hub, share, reverse bidding, assistant, visual search */
  tc('TC44', 'Nhóm mua', 'Tạo nhóm cho sản phẩm 3 rồi tải lại trang và thử tạo lần nữa', 'Chỉ có một nhóm cá nhân đang mở cho cùng sản phẩm; nút tạo bị khóa', async () => {
    let w = await load('../product-detail.html?id=3');
    await click(w, '#create-group-btn');
    let groups = JSON.parse(localStorage.getItem(PREFIX + 'groups'));
    const before = groups.filter(g => String(g.productId) === '3' && !g.isDemo && g.endsAt > Date.now()).length;
    eq(before, 1, 'Số nhóm cá nhân mở sau lần tạo đầu');
    w = await load('../product-detail.html?id=3');
    ok($(w, '#create-group-btn').disabled, 'Nút Tạo nhóm chưa bị khóa khi đã có nhóm mở');
    eq($(w, '#create-group-btn').textContent.trim(), 'Bạn đã có nhóm đang mở', 'Nhãn nút');
    const after = JSON.parse(localStorage.getItem(PREFIX + 'groups')).filter(g => String(g.productId) === '3' && !g.isDemo && g.endsAt > Date.now()).length;
    eq(after, 1, 'Không được tạo nhóm trùng');
    return 'Tạo lần đầu thành công; lần hai bị chặn, không nhân đôi nhóm';
  });
  tc('TC45', 'Nhóm mua / Giỏ hàng', 'Tham gia nhóm demo đang mở của sản phẩm 2', 'Thêm user vào nhóm và tạo đúng một dòng giỏ hàng mua chung', async () => {
    const w = await load('../product-detail.html?id=2');
    const btn = $(w, '[data-join-group="demo-2"]');
    ok(btn, 'Không tìm thấy nút tham gia nhóm demo-2');
    btn.click(); await sleep(300);
    const groups = JSON.parse(localStorage.getItem(PREFIX + 'groups'));
    const g = groups.find(x => x.id === 'demo-2');
    const cart = JSON.parse(localStorage.getItem(PREFIX + 'cart') || '[]');
    ok(g.members.length === 1, 'Thành viên không được ghi vào nhóm');
    ok(cart.some(x => x.kind === 'group' && x.groupId === 'demo-2' && x.productId === '2'), 'Không có đúng sản phẩm nhóm trong giỏ');
    ok($(w, '#join-group-btn').disabled, 'Nút tham gia chưa cập nhật trạng thái khi nhóm đã đủ người');
    ok($(w, '#join-group-btn').textContent.includes('Đã tham gia nhóm'), 'Nhãn nút chưa phản ánh trạng thái đã tham gia');
    return 'Tham gia nhóm, thêm đúng sản phẩm vào giỏ và đồng bộ nút sang trạng thái đã tham gia/đủ người';
  });
  tc('TC46', 'Trạng thái nhóm', 'Hiển thị riêng nhóm đủ người và nhóm hết hạn', 'Nhóm đủ người có trạng thái success; nhóm chưa đủ nhưng quá hạn có trạng thái expired', async () => {
    localStorage.setItem(PREFIX + 'groups', JSON.stringify([
      {id:'demo-3',productId:'3',need:4,members:[],demoCount:4,endsAt:Date.now()+3600000,isDemo:true,regionCode:'hcm'},
      {id:'demo-4',productId:'4',need:3,members:[],demoCount:1,endsAt:Date.now()-3600000,isDemo:true,regionCode:'hn'}
    ]));
    const a = await load('../product-detail.html?id=3');
    ok($(a, '.available-group .state-success'), 'Không hiện trạng thái nhóm đủ người');
    const b = await load('../product-detail.html?id=4');
    ok($(b, '.available-group .state-expired'), 'Không hiện trạng thái nhóm hết hạn');
    ok(!$(b, '.available-group [data-join-group]'), 'Nhóm hết hạn vẫn cho tham gia');
    return 'Nhóm đủ người và hết hạn được phân biệt; nhóm hết hạn không có nút tham gia';
  });
  tc('TC47', 'Group Hub', 'Mở trang Nhóm mua đang mở, lọc chỉ còn thiếu 1 người', 'Có thẻ nhóm lấy từ localStorage/catalog, bộ lọc chạy và link về đúng product-detail', async () => {
    const w = await load('../groups.html');
    ok($$(w, '.hub-group-card').length > 0, 'Không render thẻ nhóm');
    const card = $(w, '.hub-group-card');
    const link = card.querySelector('a[href*="product-detail.html?id="]');
    ok(link && /group=/.test(link.href), 'Thẻ nhóm không dẫn đúng product-detail kèm group id');
    $(w, '#groups-one').checked = true; $(w, '#groups-one').dispatchEvent(new w.Event('change',{bubbles:true}));
    ok($$(w, '.hub-group-card').every(c => c.textContent.includes('Thiếu 1 người')), 'Bộ lọc còn thiếu 1 người không đúng');
    return `${$$(w, '.hub-group-card').length} nhóm còn thiếu đúng 1 người; liên kết chi tiết hợp lệ`;
  });
  tc('TC48', 'Chia sẻ nhóm', 'Mở hộp chia sẻ từ Group Hub', 'URL chứa product id và group id; cảnh báo localStorage không đồng bộ hiển thị', async () => {
    const w = await load('../groups.html');
    Object.defineProperty(w.navigator,'share',{configurable:true,value:undefined});
    await click(w, '.hub-group-card [data-share-group]');
    const input = $(w, '#group-share-link');
    ok(input, 'Không hiện URL chia sẻ/QR modal');
    const u = new w.URL(input.value);
    ok(u.pathname.endsWith('/product-detail.html') && u.searchParams.get('id') && u.searchParams.get('group'), 'URL chia sẻ sai định dạng');
    ok($(w, '.share-local-warning').textContent.includes('localStorage'), 'Thiếu cảnh báo localStorage');
    return 'Link đúng product-detail?id=…&group=…; có cảnh báo chỉ lưu localStorage';
  });
  tc('TC49', 'Đấu giá ngược', 'Gửi yêu cầu khi thiếu dữ liệu bắt buộc', 'Không lưu yêu cầu; hiển thị hướng dẫn lỗi hợp lệ', async () => {
    const w = await load('../reverse-bidding.html');
    $(w, '#bid-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    ok(!$(w, '#bid-form-error').hidden, 'Không hiển thị lỗi validation');
    const saved = JSON.parse(localStorage.getItem(PREFIX + 'reverse_requests') || '[]');
    eq(saved.length, 0, 'Không được lưu yêu cầu sai');
    return 'Yêu cầu không hợp lệ bị chặn và có thông báo';
  });
  tc('TC50', 'Đấu giá ngược', 'Tạo yêu cầu hợp lệ, nhận 2 báo giá DEMO và chọn một phương án', 'Tạo yêu cầu, sinh 2 báo giá mô phỏng, chọn báo giá và khóa yêu cầu', async () => {
    const w = await load('../reverse-bidding.html');
    const form = $(w, '#bid-form');
    form.elements.productType.value = 'Balo laptop';
    form.elements.category.value = 'Balo & túi ví';
    form.elements.people.value = '5';
    form.elements.targetPrice.value = '250000';
    form.elements.deadline.value = new Date(Date.now()+86400000).toISOString().slice(0,16);
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await sleep(200);
    const requests = JSON.parse(localStorage.getItem(PREFIX + 'reverse_requests')||'[]');
    eq(requests.length,1,'Số yêu cầu được lưu');eq(requests[0].quotes.length,2,'Số báo giá demo');
    ok(requests[0].quotes.every(q=>q.isDemo),'Báo giá chưa được đánh dấu DEMO');
    await click(w,'#bid-tab-compare');
    await click(w,'[data-bid-accept]');
    const saved = JSON.parse(localStorage.getItem(PREFIX + 'reverse_requests'))[0];
    eq(saved.status,'locked','Trạng thái sau chọn');ok(saved.acceptedQuoteId,'Chưa ghi nhận phương án đã chọn');
    return 'Yêu cầu hợp lệ → 2 báo giá DEMO → chọn báo giá → khóa yêu cầu';
  });
  tc('TC51', 'Trợ lý WeBuy', 'Hỏi "có 300k mua balo"', 'Gợi ý sản phẩm Balo có giá nhóm trong ngân sách từ WEBUY_PRODUCTS', async () => {
    const w = await load('../index.html');
    await click(w,'.assistant-launch');
    const input = $(w,'#weby-assistant input[name="question"]');input.value='có 300k mua balo';
    $(w,'#weby-assistant form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    const links = $$(w,'.assistant-product');ok(links.length>0,'Không có gợi ý');
    ok(links.some(a=>a.textContent.toLowerCase().includes('balo')),'Không gợi ý đúng danh mục balo');
    const p = P().find(x=>x.id===links[0].href.split('id=')[1]);
    ok(p,'Gợi ý không thuộc WEBUY_PRODUCTS');
    ok(links.every(a=>a.querySelector('small').textContent.includes('249.000đ') || P().some(p=>a.href.includes('id='+p.id))),'Thiếu lý do/giá gợi ý');
    return `${links.length} gợi ý được lấy từ catalog cho ngân sách 300.000đ`;
  });
  tc('TC52', 'Tìm kiếm hình ảnh', 'Mở camera, chọn ảnh mẫu và danh mục dự phòng', 'Hiển thị preview và tối đa 3 gợi ý tương tự; không tải ảnh lên server', async () => {
    const w = await load('../products.html');
    await click(w,'.header-image-search');
    const input = $(w,'#image-search-file');
    const dt = new w.DataTransfer();dt.items.add(new w.File(['demo-image'],'sample.png',{type:'image/png'}));input.files=dt.files;
    input.dispatchEvent(new w.Event('change',{bubbles:true}));
    $(w,'#image-search-category').value='Balo & túi ví';$(w,'#image-search-category').dispatchEvent(new w.Event('change',{bubbles:true}));
    await click(w,'.image-search-submit');
    ok(!$(w,'#image-search-preview').getAttribute('src')?.startsWith('data:'),'Ảnh không được preview local');
    ok($$(w,'.image-match-card').length>0&&$$(w,'.image-match-card').length<=3,'Số gợi ý không nằm trong 1–3');
    ok($(w,'.image-search-result-heading').textContent.includes('danh mục dự phòng'),'Không ghi rõ chế độ dự phòng');
    return `${$$(w,'.image-match-card').length} gợi ý từ danh mục; ảnh chỉ preview local`;
  });
  tc('TC53', 'Chi tiết sản phẩm', 'Kiểm tra thông tin chi tiết, Q&A DEMO và gợi ý liên quan', 'Không lặp sản phẩm hiện tại; Q&A có nhãn DEMO và dữ liệu tên/giá khớp catalog', async () => {
    const w=await load('../product-detail.html?id=1');
    ok($(w,'#trusted-specs').textContent.includes(P()[0].name),'Thông tin chi tiết không khớp catalog');
    ok($$(w,'.demo-qa-list .demo-pill').length>=3,'Q&A thiếu nhãn DEMO');
    ok($$(w,'.related-card').length>=4&&$$(w,'.related-card').length<=6,'Số gợi ý không trong 4–6');
    ok($$(w,'.related-card').every(c=>new URL(c.querySelector('a').href).searchParams.get('id') !== '1'),'Gợi ý lặp ID hiện tại');
    return `${$$(w,'.related-card').length} gợi ý, tên và giá lấy từ catalog, Q&A có nhãn DEMO`;
  });

  tc('TC54', 'Chi tiết sản phẩm', 'Mở URL với mã sản phẩm không tồn tại', 'Hiện thông báo không tìm thấy và nút trở về danh sách', async () => {
    const w = await load('../product-detail.html?id=missing-product-id');
    ok(!$(w, '#detail-not-found').hidden, 'Không hiện thông báo không tìm thấy sản phẩm');
    const back = $(w, '#detail-not-found a');
    ok(back && back.getAttribute('href') === 'products.html', 'Thiếu liên kết trở về danh sách sản phẩm');
    ok($(w, '.detail-grid').hidden, 'Chi tiết sản phẩm lỗi vẫn hiển thị');
    return 'ID không tồn tại được thông báo rõ và có nút trở về products.html';
  });
  tc('TC55', 'Sản phẩm người bán', 'Mở chi tiết sản phẩm người bán đang ở trạng thái published', 'Thông tin chi tiết và gợi ý liên quan đọc cùng catalog WEBUY_PRODUCTS', async () => {
    localStorage.setItem('webuy_seller_v1_products', JSON.stringify([{
      id: 'seller-test-frontend', name: 'Balo demo người bán', status: 'published',
      retail: 340000, group: 290000, category: 'Balo & túi ví', image: 'images/product-01.webp',
      description: 'Sản phẩm thử nghiệm để kiểm tra tích hợp catalog người bán.', minMembers: 3,
      storeName: 'Cửa hàng Demo'
    }]));
    const w = await load('../product-detail.html?id=seller-test-frontend');
    ok(!$(w, '#detail-not-found') || $(w, '#detail-not-found').hidden, 'Sản phẩm người bán published không được tìm thấy');
    ok($(w, '#detail-title').textContent.includes('Balo demo người bán'), 'Tên sản phẩm không lấy từ catalog người bán');
    ok($(w, '#trusted-specs').textContent.includes('290.000đ'), 'Giá nhóm không khớp dữ liệu người bán');
    ok($$(w, '.related-card').length >= 4, 'Không tạo đủ gợi ý từ catalog dùng chung');
    localStorage.removeItem('webuy_seller_v1_products');
    return 'Sản phẩm published của Seller Center xuất hiện trong chi tiết và gợi ý liên quan';
  });
  tc('TC56', 'Trạng thái rỗng', 'Kiểm tra wishlist trống và trang catalog có trạng thái không có kết quả', 'Hai trang đều có hướng dẫn và nút tìm sản phẩm khác/đặt lại', async () => {
    const w = await load('../profile.html#yeu-thich');
    ok($(w, '#wishlist-list .wish-empty'), 'Wishlist trống thiếu hướng dẫn');
    ok($(w, '#wishlist-list .wish-empty a[href*="products.html"]'), 'Wishlist trống thiếu nút tìm sản phẩm');
    const p = await load('../products.html?q=__no_catalog_match__');
    ok(!$(p, '#empty-search').hidden, 'Catalog không hiện trạng thái rỗng');
    ok($(p, '#empty-search #clear-filters'), 'Catalog thiếu nút đặt lại/tìm sản phẩm');
    return 'Wishlist và catalog đều có empty state kèm thao tác quay lại/tìm lại';
  });

  tc('TC57', 'Đấu giá ngược', 'Kiểm tra bố cục trang không còn khối giải thích Quy trình MVP', 'Chỉ hiển thị form tạo yêu cầu và tab báo giá; đủ trường bắt buộc', async () => {
    const w = await load('../reverse-bidding.html');
    ok(!$(w, 'aside.bid-panel'), 'Vẫn còn panel Quy trình MVP');
    ok(!w.document.body.textContent.includes('Quy trình MVP'), 'Vẫn còn nội dung Quy trình MVP');
    for (const name of ['productType', 'people', 'targetPrice', 'deadline']) {
      ok($(w, `#bid-form [name="${name}"]`), `Thiếu trường ${name}`);
    }
    ok($(w, '#bid-tab-seller'), 'Thiếu tab báo giá người bán');
    return 'Đã bỏ panel giải thích; form có đủ loại sản phẩm, số người, giá mục tiêu và hạn chót';
  });
  tc('TC58', 'Đấu giá ngược', 'Yêu cầu quá hạn tự khóa và không cho chọn báo giá', 'Trạng thái hết hạn, không còn nút chọn phương án', async () => {
    const expired = {
      id: 'bid-expired-test', productType: 'Balo laptop', category: 'Balo & túi ví',
      people: 5, targetPrice: 250000, deadline: new Date(Date.now() - 60000).toISOString(),
      status: 'open', quotes: [{id:'expired-q1',seller:'Nhà bán mô phỏng A',price:200000,leadTime:2,note:'DEMO',isDemo:true}]
    };
    localStorage.setItem(PREFIX + 'reverse_requests', JSON.stringify([expired]));
    const w = await load('../reverse-bidding.html');
    await click(w, '#bid-tab-seller');
    ok($(w, '.bid-seller-request-card .hub-state').textContent.includes('Đã hết hạn'), 'Yêu cầu quá hạn chưa chuyển trạng thái');
    eq($$(w, '[data-bid-accept]').length, 0, 'Yêu cầu hết hạn vẫn có nút chọn');
    const stored = JSON.parse(localStorage.getItem(PREFIX + 'reverse_requests'))[0];
    eq(stored.status, 'expired', 'Trạng thái được lưu');
    return 'Yêu cầu quá hạn tự chuyển sang hết hạn và đã khóa thao tác chọn báo giá';
  });

  tc('TC59', 'Đấu giá ngược', 'Tab người bán có form gửi báo giá cho yêu cầu đang mở', 'Form có tên cửa hàng, giá chào, thời gian giao và ghi chú', async () => {
    const request = { id:'bid-seller-form-test', productType:'Balo laptop', category:'Balo & túi ví', people:4, targetPrice:250000, deadline:new Date(Date.now()+86400000).toISOString(), status:'open', quotes:[] };
    localStorage.setItem(PREFIX + 'reverse_requests', JSON.stringify([request]));
    const w = await load('../reverse-bidding.html');
    await click(w, '#bid-tab-seller');
    const form = $(w, '[data-bid-seller-form="bid-seller-form-test"]');
    ok(form, 'Không hiển thị form người bán');
    for (const name of ['sellerName','price','leadTime','note']) ok($(w, `[data-bid-seller-form] [name="${name}"]`), `Thiếu trường ${name}`);
    return 'Tab Người bán: Gửi báo giá hiển thị form đầy đủ cho yêu cầu đang mở';
  });
  tc('TC60', 'Đấu giá ngược', 'Người bán gửi báo giá DEMO', 'Báo giá hợp lệ được thêm vào localStorage và xuất hiện ở phần so sánh', async () => {
    const request = { id:'bid-seller-submit-test', productType:'Bình giữ nhiệt', category:'Gia dụng', people:5, targetPrice:180000, deadline:new Date(Date.now()+86400000).toISOString(), status:'open', quotes:[] };
    localStorage.setItem(PREFIX + 'reverse_requests', JSON.stringify([request]));
    const w = await load('../reverse-bidding.html');
    await click(w, '#bid-tab-seller');
    const form = $(w, '[data-bid-seller-form="bid-seller-submit-test"]');
    form.elements.sellerName.value = 'Cửa hàng Test';
    form.elements.price.value = '165000';
    form.elements.leadTime.value = '2';
    form.elements.note.value = 'Miễn phí vận chuyển';
    form.dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    await sleep(100);
    const saved = JSON.parse(localStorage.getItem(PREFIX + 'reverse_requests'))[0];
    const quote = saved.quotes.find(q => q.seller === 'Cửa hàng Test');
    ok(quote, 'Báo giá người bán không được lưu');
    eq(quote.price, 165000, 'Giá chào được lưu');
    eq(quote.source, 'seller-form', 'Nguồn báo giá');
    await click(w, '#bid-tab-compare');
    ok($(w, '#bid-requests').textContent.includes('Cửa hàng Test'), 'Người mua không thấy báo giá mới');
    return 'Báo giá 165.000đ được lưu và hiển thị trong tab người mua';
  });
  tc('TC61', 'Đấu giá ngược', 'Người mua chọn báo giá do người bán nhập', 'Báo giá được chọn và yêu cầu chuyển sang trạng thái khóa', async () => {
    const request = { id:'bid-seller-accept-test', productType:'Balo', category:'Balo & túi ví', people:3, targetPrice:300000, deadline:new Date(Date.now()+86400000).toISOString(), status:'open', quotes:[{id:'seller-quote-accepted',seller:'Cửa hàng Demo nhập tay',price:270000,leadTime:2,note:'Báo giá thử',isDemo:true,source:'seller-form'}] };
    localStorage.setItem(PREFIX + 'reverse_requests', JSON.stringify([request]));
    const w = await load('../reverse-bidding.html');
    await click(w, '#bid-tab-compare');
    await click(w, '[data-bid-accept="bid-seller-accept-test"][data-quote-id="seller-quote-accepted"]');
    const saved = JSON.parse(localStorage.getItem(PREFIX + 'reverse_requests'))[0];
    eq(saved.status, 'locked', 'Trạng thái yêu cầu');
    eq(saved.acceptedQuoteId, 'seller-quote-accepted', 'Báo giá được chấp nhận');
    ok($(w, '#bid-requests').textContent.includes('Yêu cầu này đã được khóa') || $(w, '#bid-requests').textContent.includes('Đã khóa'), 'Giao diện chưa báo đã khóa');
    return 'Người mua chọn được báo giá của người bán; yêu cầu lưu trạng thái locked';
  });


  const questions = [
    ['có 300k mua balo','Balo & túi ví',300000],
    ['áo thun dưới 200 nghìn','Áo thun',200000],
    ['túi 400.000 đồng','Balo & túi ví',400000],
    ['đồ gia dụng 500k','Thiết bị gia dụng',500000],
    ['trang sức 1 triệu','Trang sức',1000000],
    ['tai nghe 1,5 triệu','Thiết bị điện tử',1500000],
    ['sắc đẹp 300 ngàn','Sắc đẹp',300000],
    ['son 0.5 triệu','Sắc đẹp',500000],
    ['áo thun 1000 đồng','Áo thun',1000],
    ['balo ở Hà Nội','Balo & túi ví',Infinity,'hn'],
    ['nhóm ở Đà Nẵng',null,Infinity,'dn'],
    ['xyzxyz',null,0]
  ];
  questions.forEach(([question,category,budget,region], i) => {
    tc('TC'+(62+i),'Trợ lý WeBuy',question,'Khớp catalog, ngân sách và khu vực hoặc báo rỗng',async () => {
      const w = await load('../groups.html');
      const form = $(w,'.assistant-form');
      form.elements.question.value = question;
      form.requestSubmit();
      const rows = $$(w,'.assistant-product');
      const groups = JSON.parse(localStorage.getItem(PREFIX+'groups'));
      const expected = P().filter(p=>(!category || p.category===category) && p.group<=budget &&
        (!region || groups.some(g=>g.productId===p.id && g.regionCode===region && g.endsAt>Date.now())))
        .sort((a,b)=>a.group-b.group).slice(0,3);
      eq(rows.map(a=>new URL(a.href).searchParams.get('id')).join(),expected.map(p=>p.id).join(),'ID sản phẩm');
      if (!expected.length) ok($(w,'.assistant-messages').textContent.includes('chưa tìm thấy'),'Thiếu trạng thái rỗng');
      return rows.length + ' gợi ý khớp dữ liệu';
    });
  });
  tc('TC74','Xu','Điểm danh bảy ngày và lùi đồng hồ','140 xu, chặn nhận trùng/lùi ngày',async () => {
    const w=await load('../profile.html'), r=w.WeBuyRewards;
    for (let day=10;day<=16;day++) {
      r.debugSetToday('2026-11-'+day); ok(r.claimCheckin().ok,'Bỏ mất ngày '+day); ok(!r.claimCheckin().ok,'Nhận trùng');
    }
    r.debugSetToday('2026-11-15');
    ok(!r.claimCheckin().ok && !r.playInfo().left && !r.flyInfo().left,'Ngày lùi vẫn có lượt');
    eq(r.getState().balance,140,'Số dư'); return '7 lần cộng, tổng 140 xu';
  });
  tc('TC75','Đơn và Xu','Gửi checkout hai lần, tải lại, hủy hai lần','Một đơn, một lần trừ, một lần hoàn',async () => {
    localStorage.setItem(PREFIX+'cart',JSON.stringify([{productId:'1',kind:'retail',quantity:1,groupId:null,addedAt:1}]));
    let w=await load('../checkout.html');
    const r=w.WeBuyRewards; r.addXu(350,'Xu kiểm thử');
    eq(r.maxXuForOrder(9999),0,'Giới hạn dưới 10 xu'); eq(r.maxXuForOrder(10000),10,'Ngưỡng 10 xu');
    await click(w,'#wbr-use-xu'); const form=$(w,'#checkout-form');
    Object.assign(form.elements.name,{value:'Minh Thư'});form.elements.phone.value='0912345678';form.elements.address.value='Quận 1';
    form.requestSubmit(); form.requestSubmit(); await sleep(300);
    const orders=JSON.parse(localStorage.getItem(PREFIX+'orders')); eq(orders.length,1,'Số đơn');
    const order=orders[0]; eq(order.xuUsed,299,'Số xu');eq(order.total,269100,'Tổng sau giảm');
    ok($(w,'#app-dialog-root').textContent.includes(fmt(order.total)),'Sai tổng thông báo');
    w=await load('../profile.html');
    ok($(w,'.order-item').textContent.includes(fmt(order.total)),'Sai tổng lịch sử đơn');
    await click(w,'[data-cancel-order]');const confirm=$(w,'[data-confirm-cancel]'); confirm.click(); confirm.click();
    await sleep(250); w=await load('../profile.html');
    eq(w.WeBuyRewards.getState().balance,350,'Số dư sau hoàn');
    eq(w.WeBuyRewards.getState().history.filter(h=>h.note.includes(order.id)).length,2,'Lịch sử đơn');
    return '299 xu trừ và hoàn đúng một lần';
  });
  tc('TC76','Thông báo','Nhóm thiếu một người, đủ người, đọc và xóa','Các sự kiện riêng, lưu trạng thái sau reload',async () => {
    let w=await load('../product-detail.html?id=1'); await click(w,'#create-group-btn');
    const plus=$(w,'[data-simulate-member]'); plus.click(); $(w,'[data-simulate-member]').click();
    w=await load('../profile.html'); await click(w,'.notice-bell');
    const list=$(w,'.notice-list');ok(list.textContent.includes('thiếu 1 người') && list.textContent.includes('Đã đủ người'),'Thiếu sự kiện nhóm');
    await click(w,'[data-notice-read]'); eq($$(w,'.notice-list .unread').length,0,'Chưa đọc');
    await click(w,'[data-notice-clear]');w=await load('../profile.html'); await click(w,'.notice-bell');
    eq($$(w,'.notice-list a').length,0,'Thông báo đã xóa lại xuất hiện'); return 'Đã đọc và xóa, tải lại vẫn giữ';
  });
  tc('TC77','Chia sẻ và chat','Tạo nhóm có hạn chốt, chia sẻ qua ứng dụng, nhắn rồi mở lại từ giỏ','Đúng nhóm, đúng hạn, giữ tin sau reload',async () => {
    let w=await load('../product-detail.html?id=1'); $(w,'#group-hours').value='6'; await click(w,'#create-group-btn');
    const group=JSON.parse(localStorage.getItem(PREFIX+'groups')).find(g=>!g.isDemo);
    ok(Math.abs(group.endsAt-group.createdAt-6*3600000)<100,'Sai hạn chốt');
    let invite; Object.defineProperty(w.navigator,'share',{configurable:true,value:async payload=>{invite=new URL(payload.url);}});
    await click(w,'#app-dialog-root [data-share-group]');eq(invite.searchParams.get('group'),group.id,'Nhóm được mời');
    await click(w,'#app-dialog-root [data-chat-group]'); $(w,'#chat-text').value='  Hẹn chốt đơn nhé  ';
    $(w,'.group-chat form').requestSubmit(); w=await load('../cart.html'); await click(w,'[data-chat-group]');
    eq($(w,'.chat-bubble p').textContent,'Hẹn chốt đơn nhé','Nội dung lưu');
    $(w,'#chat-text').value='   ';$(w,'.group-chat form').requestSubmit();eq($$(w,'.chat-bubble').length,1,'Tin trắng');
    return 'Link đúng mã nhóm, tin nhắn theo nhóm còn sau khi chuyển trang';
  });
  tc('TC78','Địa điểm','Đổi khu vực ngay trên Group Hub rồi tải lại','Nhãn và danh sách khớp khu vực đã chọn',async () => {
    let w=await load('../groups.html');await click(w,'[data-open-location]');await click(w,'[data-pick-loc="dn"]');await click(w,'#loc-confirm-btn');
    for (let i=0;i<2;i++) {
      eq($(w,'#groups-region').value,'dn','Bộ lọc');ok($(w,'[data-location-label]').textContent.includes('Đà Nẵng'),'Nhãn');
      const cards=$$(w,'.hub-group-card');ok(cards.length && cards.every(c=>c.textContent.includes('Đà Nẵng')),'Lọc nhóm');w=await load('../groups.html');
    } return 'Header và Group Hub cùng dùng Đà Nẵng';
  });
  tc('TC79','Tìm ảnh','Chọn tệp sai định dạng và ảnh lớn','Hiện lỗi, xóa preview, khóa tìm',async () => {
    const w=await load('../products.html');await click(w,'[data-image-search-open]');
    for (const f of [new w.File(['x'],'x.txt',{type:'text/plain'}),new w.File([new Uint8Array(8*1024*1024+1)],'x.png',{type:'image/png'})]) {
      const dt=new w.DataTransfer();dt.items.add(f);const input=$(w,'#image-search-file'); input.files=dt.files; input.dispatchEvent(new w.Event('change'));
      ok(!$(w,'#image-search-error').hidden && $(w,'.image-search-submit').disabled,'Không chặn file');
      ok(!$(w,'#image-search-preview').getAttribute('src'),'Còn preview');
    } return 'Chặn cả hai file';
  });
  tc('TC80','Người bán','Đăng ký → nháp → đăng → tạo nhóm → ẩn/hiện','Dashboard, trang cửa hàng và catalog đọc cùng dữ liệu',async () => {
    let w=await load('../seller-center.html'); await click(w,'#sc-start-registration');
    let form=$(w,'#sc-register-form'); form.requestSubmit();
    ok(form.querySelectorAll('[aria-invalid="true"]').length>=6,'Thiếu lỗi bắt buộc');
    for(const [key,value] of Object.entries({storeName:'Cửa hàng QC',representative:'Ngọc',email:'bad',phone:'12345',address:'TP.HCM'})) form.elements[key].value=value;
    form.elements.terms.checked=true;form.requestSubmit();
    ok(form.elements.email.hasAttribute('aria-invalid') && form.elements.phone.hasAttribute('aria-invalid'),'Không chặn email/điện thoại');
    form.elements.email.value='shop@example.test';form.elements.phone.value='0901234567';form.requestSubmit();await sleep(80);
    w=await load('../seller-center.html'); eq($(w,'#sc-welcome-name').textContent,'Cửa hàng QC','Hồ sơ sau reload');
    await click(w,'[data-sc-view="editor"]');form=$(w,'#sc-product-form');
    form.elements.name.value='Balo cửa hàng QC'; await click(w,'#sc-save-draft');
    await click(w,'[data-sc-edit]');form=$(w,'#sc-product-form');
    const imageUrl=new URL('../images/product-01.webp',location.href).href;
    for(const [key,value] of Object.entries({category:'Balo & túi ví',imageUrl,description:'Balo canvas màu xanh',retail:'300000',group:'350000',minMembers:'1',groupDurationHours:'12'})) form.elements[key].value=value;
    form.requestSubmit(); ok(form.elements.group.hasAttribute('aria-invalid') && form.elements.minMembers.hasAttribute('aria-invalid'),'Giá / số người');
    form.elements.group.value='200000';form.elements.minMembers.value='2';form.requestSubmit();await sleep(80);
    const item=JSON.parse(localStorage.getItem('webuy_seller_v1_products'))[0];
    w=await load('../product-detail.html?id='+item.id);eq($(w,'#group-hours').value,'12','Hạn do người bán đặt');
    const shopUrl=$(w,'#detail-store').href;await click(w,'#create-group-btn');w=await load('../seller-center.html');eq($(w,'#sc-stat-open').textContent,'1','KPI mở');
    w=await load('../product-detail.html?id='+item.id);await click(w,'[data-simulate-member]');
    w=await load('../seller-center.html'); eq($(w,'#sc-stat-success').textContent,'1','KPI đủ người');await click(w,'[data-sc-group]');
    ok($(w,'#sc-modal-root a').href.includes('group='),'Thiếu đường dẫn nhóm');
    w=await load(shopUrl);eq($$(w,'#store-catalog a').length,1,'Sản phẩm đang bán');
    w=await load('../seller-center.html');await click(w,'[data-sc-view="products"]');await click(w,'[data-sc-toggle]');
    w=await load(shopUrl);eq($$(w,'#store-catalog a').length,0,'Sản phẩm ẩn còn trong shop');ok(!w.WEBUY_PRODUCTS.some(p=>p.id===item.id),'Catalog còn SP ẩn');
    w=await load('../seller-center.html');await click(w,'[data-sc-view="products"]');await click(w,'[data-sc-toggle]');
    w=await load(shopUrl);eq($$(w,'#store-catalog a').length,1,'Hiện lại sản phẩm');return 'Luồng cửa hàng và số liệu đúng sau tải lại';
  });

  tc('TC81','Popup','Mở Xu trong lúc chọn địa điểm, đóng bằng Esc','Địa điểm đóng trước, sau đó mở được Xu',async () => {
    localStorage.removeItem('webuy_location_prompted');
    const w=await load('../index.html');ok($(w,'.loc-modal'),'Thiếu popup lần đầu');
    w.WeBuyRewards.open();ok(!$(w,'.wbr-overlay') || $(w,'.wbr-overlay').hidden,'Hai popup chồng nhau');
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    ok(!$(w,'.loc-modal'),'Esc chưa đóng');
    w.WeBuyRewards.open();ok(!$(w,'.wbr-overlay').hidden,'Không mở được Xu sau khi đóng popup');
    return 'Hai popup mở lần lượt';
  });
  /* ---- Chay va hien thi ket qua ---- */
  const tbody = document.getElementById('results');
  const summary = document.getElementById('summary');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  window.WEBUY_TEST_RESULTS = [];

  async function runAll() {
    const btn = document.getElementById('run');
    btn.disabled = true; tbody.innerHTML = ''; window.WEBUY_TEST_RESULTS = [];
    const backup = Object.fromEntries(Object.keys(localStorage).filter(testKey).map(k=>[k,localStorage.getItem(k)]));
    let pass = 0, fail = 0;
    for (const t of T) {
      resetStorage();
      let status = 'PASS', actual;
      try { actual = await t.fn(); pass++; }
      catch (e) { status = 'FAIL'; actual = e.message; fail++; }
      window.WEBUY_TEST_RESULTS.push({ id: t.id, group: t.group, desc: t.desc, expected: t.expected, actual, status });
      const tr = document.createElement('tr');
      tr.className = status === 'PASS' ? 'pass' : 'fail';
      tr.innerHTML = `<td>${t.id}</td><td>${esc(t.group)}</td><td>${esc(t.desc)}</td><td>${esc(t.expected)}</td><td>${esc(actual)}</td><td><b>${status}</b></td>`;
      tbody.appendChild(tr);
      summary.textContent = `Đang chạy… ${pass + fail}/${T.length}`;
    }
    await load('about:blank');
    Object.keys(localStorage).filter(testKey).forEach(k=>localStorage.removeItem(k));
    for(const [k,value] of Object.entries(backup)) localStorage.setItem(k,value);
    summary.textContent = `Hoàn tất: ${pass}/${T.length} PASS · ${fail} FAIL`;
    summary.className = fail ? 'bad' : 'good';
    document.body.dataset.done = 'true';
    btn.disabled = false;
  }
  document.getElementById('run').addEventListener('click', runAll);
  document.getElementById('copy').addEventListener('click', () => {
    const rows = [['ID', 'Nhóm', 'Trường hợp kiểm thử', 'Kết quả mong đợi', 'Kết quả thực tế', 'Trạng thái']]
      .concat(window.WEBUY_TEST_RESULTS.map(r => [r.id, r.group, r.desc, r.expected, r.actual, r.status]));
    const tsv = rows.map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => alert('Đã sao chép bảng kết quả. Dán vào Word/Excel.'));
  });
  window.WEBUY_RUN_ALL = runAll;
  if (new URLSearchParams(location.search).get('auto') === '1') setTimeout(runAll, 350);
})();
