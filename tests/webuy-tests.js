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
  function resetStorage() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX) || k.startsWith('group_created_'))
      .forEach(k => localStorage.removeItem(k));
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
  tc('TC03', 'Sản phẩm', 'Mở products.html', 'Hiển thị đủ 8 thẻ sản phẩm', async () => {
    const w = await load('../products.html');
    eq($$(w, '.product-card').length, P().length, 'Số thẻ sản phẩm');
    return '8/8 thẻ sản phẩm';
  });
  tc('TC04', 'Sản phẩm', 'Lọc danh mục ?category=ao-thun', 'Chỉ còn 1 sản phẩm là Áo thun', async () => {
    const w = await load('../products.html?category=ao-thun');
    eq($$(w, '.product-card').length, 1, 'Số thẻ');
    return 'Còn 1 sản phẩm: ' + $(w, '.product-card h3').textContent;
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
  tc('TC09', 'Chi tiết', 'Mở chi tiết cho cả 8 sản phẩm (id=1..8)', 'Mỗi trang hiển thị đúng tên, giá lẻ, giá nhóm', async () => {
    for (const p of P()) {
      const w = await load('../product-detail.html?id=' + p.id);
      eq($(w, '#detail-title').textContent, p.name, `Tên id=${p.id}`);
      eq($(w, '#detail-retail-price').textContent, fmt(p.retail), `Giá lẻ id=${p.id}`);
      eq($(w, '#detail-group-price').textContent, fmt(p.group), `Giá nhóm id=${p.id}`);
    }
    return 'Đúng cả 8 sản phẩm';
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

  /* ---- Chay va hien thi ket qua ---- */
  const tbody = document.getElementById('results');
  const summary = document.getElementById('summary');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  window.WEBUY_TEST_RESULTS = [];

  async function runAll() {
    const btn = document.getElementById('run');
    btn.disabled = true; tbody.innerHTML = ''; window.WEBUY_TEST_RESULTS = [];
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
    resetStorage();
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
})();
