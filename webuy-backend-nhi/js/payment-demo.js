/* WeBuy | Trang đơn hàng & thanh toán MÔ PHỎNG (order-payment.html).
 * Checklist: "Trạng thái đơn & thanh toán demo".
 *   order-payment.html          -> danh sách đơn trên tài khoản
 *   order-payment.html?id=WB... -> chi tiết 1 đơn: thanh toán mô phỏng / hủy / hoàn tiền mô phỏng
 * Không có tiền thật: không nhập thẻ, không kết nối cổng thanh toán. Trạng thái đơn do backend quyết định.
 */
(() => {
  'use strict';
  const API = window.WeBuyAPI;
  const root = document.getElementById('pay-root');
  const id = new URLSearchParams(location.search).get('id');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ';
  const STATUS = { DRAFT: 'Nháp', PENDING: 'Chờ thanh toán', PAID_DEMO: 'Đã thanh toán (mô phỏng)', CANCELLED: 'Đã hủy', REFUNDED_DEMO: 'Đã hoàn tiền (mô phỏng)' };
  let timer = null;

  const errorBox = (err, retry = true) => `
    <section class="wb-card"><h1>Không tải được dữ liệu</h1>
      <p class="wb-error">${esc(API.ui.errorMessage(err))}</p>
      ${retry ? '<button type="button" class="wb-btn wb-btn-ghost" data-retry>Thử lại</button>' : ''}
      <a class="wb-btn wb-btn-ghost" href="order-payment.html">Xem tất cả đơn</a></section>`;

  async function renderList() {
    document.title = 'Đơn hàng của tôi | WeBuy';
    try {
      const orders = await API.orders.list(30);
      root.innerHTML = `
        <section class="wb-card">
          <h1>Đơn hàng của tôi</h1>
          <p>Đơn được lưu trên tài khoản, mở trên máy khác vẫn thấy.</p>
          ${orders.length ? `<ul class="wb-order-list">${orders.map(o => `
            <li><a href="order-payment.html?id=${encodeURIComponent(o.id)}">
              <strong>${esc(o.id)}</strong>
              <span class="wb-status wb-status-${esc(o.status)}">${STATUS[o.status] || esc(o.status)}</span>
              <span>${o.items.length} sản phẩm · ${money(o.total)}</span>
              <time>${new Date(o.createdAt).toLocaleString('vi-VN')}</time></a></li>`).join('')}</ul>`
          : '<p class="muted">Chưa có đơn hàng nào. <a href="products.html">Khám phá sản phẩm</a></p>'}
        </section>`;
    } catch (err) {
      root.innerHTML = errorBox(err);
    }
  }

  function countdown(expiresAt) {
    clearInterval(timer);
    const el = root.querySelector('[data-countdown]');
    if (!el) return;
    const tick = () => {
      const left = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      el.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
      if (left <= 0) { clearInterval(timer); renderOrder(); } // hết hạn: tải lại để thấy trạng thái server
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function orderHtml(o) {
    const actions = {
      PENDING: `<button type="button" class="wb-btn wb-btn-primary" data-action="pay">Thanh toán mô phỏng ${money(o.total)}</button>
                <button type="button" class="wb-btn wb-btn-danger" data-action="cancel">Hủy đơn</button>`,
      PAID_DEMO: '<button type="button" class="wb-btn wb-btn-ghost" data-action="refund">Hoàn tiền mô phỏng</button>'
    }[o.status] || '';
    return `
      <div class="wb-pay">
        <section class="wb-card">
          <p class="wb-alert wb-alert-info"><strong>Thanh toán mô phỏng.</strong> WeBuy là bản thử nghiệm học tập: không nhập thẻ, không trừ tiền thật, không giao hàng thật.</p>
          <h1>Đơn ${esc(o.id)}</h1>
          <p><span class="wb-status wb-status-${esc(o.status)}">${STATUS[o.status] || esc(o.status)}</span>
             · Tạo lúc ${new Date(o.createdAt).toLocaleString('vi-VN')}</p>
          ${o.status === 'PENDING' ? `<p>Giữ hàng cho bạn trong <span class="wb-countdown" data-countdown>--:--</span>. Quá thời gian này đơn sẽ tự hủy và trả hàng về kho.</p>` : ''}
          ${o.status === 'CANCELLED' && o.cancelReason ? `<p>Lý do hủy: ${esc(o.cancelReason)}</p>` : ''}
          <ul class="wb-items">${o.items.map(i => `
            <li><img src="${esc(API.imageUrl(i.image))}" alt="">
              <div><strong>${esc(i.name)}</strong>
                <small>${i.kind === 'group' ? 'Mua chung' : 'Mua lẻ'} · ${i.quantity} × ${money(i.unitPrice)} (giá chốt lúc đặt)</small></div>
              <strong>${money(i.lineTotal)}</strong></li>`).join('')}</ul>
        </section>
        <aside class="wb-card">
          <div class="wb-sum">
            <div class="wb-sum-row"><span>Tạm tính</span><strong>${money(o.subtotal)}</strong></div>
            ${o.discount ? `<div class="wb-sum-row"><span>Giảm giá</span><strong>−${money(o.discount)}</strong></div>` : ''}
            <div class="wb-sum-row wb-sum-total"><span>Tổng</span><span>${money(o.total)}</span></div>
            <div><strong>Giao tới</strong><br>${esc(o.shipping?.name)} · ${esc(o.shipping?.phone)}<br>${esc(o.shipping?.address)}</div>
          </div>
          <p class="wb-alert" id="pay-message" role="alert" hidden></p>
          <div class="wb-actions">${actions}<a class="wb-btn wb-btn-ghost" href="order-payment.html">Tất cả đơn hàng</a></div>
        </aside>
      </div>`;
  }

  async function renderOrder() {
    try {
      const o = await API.orders.get(id);
      document.title = `Đơn ${o.id} | WeBuy`;
      root.innerHTML = orderHtml(o);
      if (o.status === 'PENDING') countdown(o.paymentExpiresAt);
    } catch (err) {
      root.innerHTML = errorBox(err, err.status !== 404);
    }
  }

  root.addEventListener('click', async e => {
    if (e.target.closest('[data-retry]')) { id ? renderOrder() : renderList(); return; }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'cancel' && !confirm('Hủy đơn này? Hàng đang giữ sẽ được trả về kho.')) return;
    if (action === 'refund' && !confirm('Hoàn tiền mô phỏng cho đơn này?')) return;
    root.querySelectorAll('[data-action]').forEach(b => { b.disabled = true; }); // khóa cả 2 nút để không bấm chồng
    const msg = root.querySelector('#pay-message');
    try {
      await API.ui.withLoading(btn, () => ({ pay: API.orders.payDemo, cancel: API.orders.cancel, refund: API.orders.refundDemo }[action])(id));
      await renderOrder();
      const done = root.querySelector('#pay-message');
      done.textContent = { pay: 'Thanh toán mô phỏng thành công. Không có tiền thật nào bị trừ.', cancel: 'Đã hủy đơn và trả hàng về kho.', refund: 'Đã hoàn tiền mô phỏng.' }[action];
      done.className = 'wb-alert wb-alert-ok';
      done.hidden = false;
    } catch (err) {
      msg.textContent = API.ui.errorMessage(err);
      msg.className = 'wb-alert wb-alert-error';
      msg.hidden = false;
      root.querySelectorAll('[data-action]').forEach(b => { b.disabled = false; });
      if (err.status === 409) setTimeout(renderOrder, 1500); // trạng thái đã đổi ở nơi khác: tải lại
    }
  });

  // Chỉ tải dữ liệu khi đã có phiên đăng nhập (auth-ui.js báo qua sự kiện webuy:session)
  window.addEventListener('webuy:session', e => {
    if (!e.detail.session) { clearInterval(timer); root.innerHTML = ''; return; }
    id ? renderOrder() : renderList();
  });
})();
