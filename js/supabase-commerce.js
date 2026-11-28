/* Mua chung trên các trang root. Cùng API client với Auth, catalog, giỏ và đơn của Nhi. */
(() => {
  'use strict';

  const API = window.WeBuyAPI;
  if (window.WeBuyLan || API?.mode !== 'supabase') return;

  const page = location.pathname.split('/').pop();
  const params = new URLSearchParams(location.search);
  const byId = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invitedGroup = params.get('group')?.toLowerCase();
  const loginUrl = () => 'webuy-backend-nhi/login.html?' + new URLSearchParams({
    next: '../' + page + location.search + location.hash
  });
  const paymentUrl = orderId => 'webuy-backend-nhi/order-payment.html?id=' + encodeURIComponent(orderId);
  const detailUrl = (productId, groupId) => 'product-detail.html?' + new URLSearchParams(
    groupId ? { id: productId, group: groupId } : { id: productId }
  );
  const loginLink = () => `<a class="btn btn-outline" href="${esc(loginUrl())}">Đăng nhập</a>`;
  const errorText = error => error?.status === 0
    ? 'Chưa nhận được kết quả từ máy chủ. Hãy thử lại.'
    : API.ui.errorMessage(error);
  const active = slot => ['HOLD', 'CONFIRMED', 'ORDERED'].includes(slot?.status);

  let session;
  let product;
  let snapshots = [];
  let cart = { items: [], count: 0 };
  let clockOffset = 0;
  let polling;
  let busy = false;
  let checkoutRequest;
  let toastTimer;
  window.WeBuyLiveCommerce = { get product() { return product; } };

  function toast(text, error = false) {
    const box = byId('app-toast');
    if (!box) return;
    box.textContent = text;
    box.className = 'app-toast show' + (error ? ' is-error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 3600);
  }

  function updateHeader() {
    document.querySelectorAll('[data-cart-count]').forEach(node => {
      node.textContent = String(cart.count);
      node.setAttribute('aria-label', `${cart.count} sản phẩm trong giỏ hàng`);
    });
    document.querySelectorAll('.header-avatar').forEach(link => {
      link.href = session ? 'webuy-backend-nhi/profile.html' : loginUrl();
    });
  }

  function updateClocks() {
    document.querySelectorAll('[data-live-deadline]').forEach(node => {
      const remaining = Math.max(0, Math.ceil((Date.parse(node.dataset.liveDeadline) - Date.now() - clockOffset) / 1000));
      const minutes = Math.floor(remaining / 60);
      node.textContent = remaining ? `${minutes}:${String(remaining % 60).padStart(2, '0')}` : 'Hết giờ';
    });
  }

  const region = () => {
    try { return JSON.parse(localStorage.getItem('webuy_demo_v2_location') || '{}')?.code || 'all'; }
    catch { return 'all'; }
  };
  const groupAction = (action, id, label) => `<button type="button" class="group-action-link"
    data-live-action="${action}" data-target="${esc(id)}" ${busy ? 'disabled' : ''}>${label}</button>`;

  function renderGroups() {
    if (!product) return;
    const list = byId('available-groups');
    const requested = invitedGroup;
    const area = region();
    const sorted = [...snapshots].sort((a, b) =>
      Number(b.group.id === requested) - Number(a.group.id === requested)
      || Number(b.group.regionCode === area) - Number(a.group.regionCode === area));
    const joinable = sorted.find(({ group, myReservation }) =>
      (!requested || group.id === requested) && group.status === 'OPEN' && !active(myReservation));
    const join = byId('join-group-btn');
    join.dataset.liveAction = 'join';
    join.dataset.target = joinable?.group.id || '';
    join.disabled = busy || !joinable;
    join.textContent = joinable ? 'Tham gia nhóm' : 'Chọn một nhóm bên dưới';
    byId('create-group-btn').disabled = busy;
    byId('missing-group').hidden = !requested || sorted.some(({ group }) => group.id === requested);

    const html = sorted.map(({ group: g, myReservation: r }) => {
      const label = ({
        OPEN: 'Đang ghép nhóm', FULL: g.lockedAt ? 'Đã chốt' : 'Đã đầy · Chờ xác nhận',
        COMPLETED: 'Đã tạo đủ đơn', EXPIRED: 'Đã hết hạn', CANCELLED: 'Đã hủy'
      })[g.status];
      const actions = [];
      if (g.status === 'OPEN' && !active(r)) actions.push(groupAction('join', g.id, 'Tham gia nhóm'));
      if (r?.status === 'HOLD') actions.push(groupAction('confirm', r.id, 'Xác nhận suất'));
      if (!g.lockedAt && ['HOLD', 'CONFIRMED'].includes(r?.status)) {
        actions.push(groupAction('cancelReservation', r.id, 'Hủy suất'));
      }
      if (g.canCancel) actions.push(groupAction('cancel', g.id, 'Hủy nhóm'));
      if (g.status === 'FULL' && g.lockedAt && r?.status === 'CONFIRMED') {
        actions.push(groupAction('groupCheckout', g.id, 'Đặt đơn mua chung'));
      }
      if (r?.orderId) actions.push(`<a class="group-action-link" href="${esc(paymentUrl(r.orderId))}">Xem đơn ${esc(r.orderId)}</a>`);
      const regionName = window.WeBuyRegions?.find(item => item.code === g.regionCode)?.name || g.regionCode;
      const end = ['OPEN', 'FULL'].includes(g.status) ? ` · Hạn nhóm <span data-live-deadline="${esc(g.endsAt)}"></span>` : '';
      const slot = r ? `<p>Suất của bạn · ${money(r.unitPriceSnapshot)} · ${({
        HOLD: 'Đang giữ', CONFIRMED: 'Đã xác nhận', ORDERED: 'Đã đặt đơn', CANCELLED: 'Đã hủy', EXPIRED: 'Đã hết hạn'
      })[r.status]}${['HOLD', 'CONFIRMED'].includes(r.status) ? ` · Còn <span data-live-deadline="${esc(r.expiresAt)}"></span>` : ''}</p>` : '';
      return `<article class="available-group" id="group-${esc(g.id)}">
        <div class="group-row"><strong>Nhóm ${esc(g.id.slice(-6).toUpperCase())} · ${label}</strong><b>${g.occupied}/${g.capacity}</b></div>
        <div class="mini-track"><span style="width:${100 * g.occupied / g.capacity}%"></span></div>
        <small>${esc(regionName)} · ${g.confirmedCount}/${g.capacity} đã xác nhận${end}</small>${slot}
        <div class="group-tools">${actions.join('')}${groupAction('share', g.id, 'Sao chép liên kết')}</div>
      </article>`;
    }).join('') || '<p class="muted">Chưa có nhóm mua đang hoạt động.</p>';
    if (list.dataset.liveMarkup !== html) {
      list.innerHTML = html;
      list.dataset.liveMarkup = html;
    }
    updateClocks();
  }

  function refreshGroups() {
    if (!product) return Promise.resolve();
    if (polling) return polling;
    const userId = session?.user.id;
    polling = (async () => {
      try {
        const result = await API.groups.list(product.id);
        const requested = invitedGroup;
        if (uuid.test(requested || '') && !result.items.some(item => item.group.id === requested)) {
          const invited = await API.groups.get(requested).catch(error => {
            if (error.status !== 404) throw error;
            return null;
          });
          if (invited?.group.productId === product.id) result.items.push(invited);
        }
        if (session?.user.id !== userId) return;
        snapshots = result.items;
        clockOffset = Date.parse(result.serverNow) - Date.now();
        renderGroups();
      } catch (error) {
        toast(errorText(error), true);
      }
    })().finally(() => { polling = null; });
    return polling;
  }

  function showGroupFull(groupId) {
    const suggested = snapshots.filter(({ group, myReservation }) =>
      group.id !== groupId && group.status === 'OPEN' && !active(myReservation));
    const dialog = document.createElement('dialog');
    dialog.className = 'app-modal';
    dialog.innerHTML = `<h2>Nhóm đã đầy</h2>${suggested.length
      ? `<p>Bạn có thể tham gia nhóm còn chỗ.</p><ul>${suggested.map(({ group }) =>
        `<li><a href="${esc(detailUrl(product.id, group.id))}">Nhóm ${esc(group.id.slice(-6).toUpperCase())} · ${group.occupied}/${group.capacity}</a></li>`).join('')}</ul>`
      : '<p>Hiện chưa có nhóm khác còn chỗ. Bạn có thể tạo nhóm ở khu vực khác.</p>'}
      <form method="dialog"><button class="btn btn-outline">Đóng</button></form>`;
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
  }

  async function groupRequest(operation, args) {
    const storageKey = 'webuy_group_request:' + JSON.stringify([session.user.id, operation, ...args]);
    let key;
    try { key = sessionStorage.getItem(storageKey); } catch { /* Chế độ riêng tư có thể chặn bộ nhớ. */ }
    if (!key) {
      key = API.newRequestId();
      try { sessionStorage.setItem(storageKey, key); } catch { /* SDK vẫn retry cùng key trong request này. */ }
    }
    try {
      return await API.groups[operation](...args, key);
    } catch (error) {
      if (!error.status || error.status >= 500) key = null;
      throw error;
    } finally {
      if (key) {
        try { sessionStorage.removeItem(storageKey); } catch { /* Không có dữ liệu lưu để xóa. */ }
      }
    }
  }

  async function loadDetail() {
    const grid = document.querySelector('.detail-grid');
    const missing = byId('detail-not-found');
    missing.querySelector('h2').textContent = 'Không tìm thấy sản phẩm';
    missing.querySelector('p').textContent = 'Sản phẩm bạn đang tìm không tồn tại hoặc liên kết không hợp lệ.';
    missing.hidden = true;
    grid.hidden = true;
    try {
      const result = await API.products.get(params.get('id') || '');
      product = result.status === 'published' ? { ...result, image: API.imageUrl(result.image) } : null;
    } catch (error) {
      if (error.status === 404) product = null;
      else {
        missing.querySelector('h2').textContent = 'Chưa tải được sản phẩm';
        missing.querySelector('p').textContent = errorText(error);
        missing.hidden = false;
        return;
      }
    }
    document.dispatchEvent(new Event('webuy:live-product'));
    if (!product) return;
    document.querySelector('.available-groups-section h3').textContent = 'Nhóm mua';
    document.querySelector('.group-deadline').firstChild.textContent = 'Hạn nhóm ';
    document.querySelector('.demo-action-notice').textContent = 'Giá nhóm của bạn được lưu khi giữ suất. Đặt đơn và thanh toán ở chế độ thử nghiệm.';
    byId('create-group-btn').dataset.liveAction = 'create';
    byId('buy-retail-btn').dataset.liveAction = 'retailCheckout';
    byId('detail-add-cart').dataset.liveAction = 'retailCart';
    byId('join-group-btn').disabled = true;
    await refreshGroups();
  }

  const selectedItems = () => cart.items.filter(item => item.available && (!params.get('item') || item.id === params.get('item')));

  function renderCart() {
    const list = byId('cart-items');
    list.innerHTML = !session ? loginLink() : cart.items.map(item => `<article class="cart-item">
      <a href="${esc(detailUrl(item.productId, item.groupId))}"><img src="${esc(API.imageUrl(item.image))}" alt=""></a>
      <div class="cart-item-main"><a class="cart-item-title" href="${esc(detailUrl(item.productId, item.groupId))}">${esc(item.name)}</a>
      <span class="cart-kind">${item.kind === 'group' ? 'Mua chung' : 'Mua lẻ'}</span>
      <span class="cart-item-state">${item.available ? 'Sẵn sàng đặt đơn' : 'Chưa thể đặt đơn'}</span>
      <div class="cart-item-bottom"><div class="qty-inline">
        ${item.kind === 'retail' ? groupAction('decrease', item.id, '−') : ''}
        <span>${item.quantity}</span>
        ${item.kind === 'retail' ? groupAction('increase', item.id, '+') : ''}
      </div>${groupAction('remove', item.id, 'Xóa khỏi giỏ')}</div></div>
      <strong class="cart-line-price">${item.lineTotal == null ? '—' : money(item.lineTotal)}</strong></article>`).join('')
      || '<p>Giỏ hàng đang trống.</p>';
    const ready = selectedItems();
    byId('cart-subtotal').textContent = money(ready.reduce((total, item) => total + item.lineTotal, 0));
    byId('cart-ready-count').textContent = ready.length + ' mục sẵn sàng';
    byId('cart-pending-note').textContent = 'Tạm tính theo các mục có thể đặt đơn.';
    const checkout = byId('cart-checkout');
    checkout.setAttribute('aria-disabled', String(!ready.length));
    checkout.classList.toggle('is-disabled', !ready.length);
  }

  function renderCheckout() {
    const form = byId('checkout-form');
    const summary = byId('checkout-summary');
    const ready = selectedItems();
    form.hidden = !ready.length || !session;
    if (!session || !ready.length) {
      summary.innerHTML = session ? '<p>Chưa có sản phẩm có thể đặt đơn.</p>' : loginLink();
      return;
    }
    summary.innerHTML = ready.map(item => `<div class="checkout-line"><span>${esc(item.name)} <small>× ${item.quantity}</small></span>
      <strong>${money(item.lineTotal)}</strong></div>`).join('') +
      `<div class="checkout-total"><span>Tạm tính</span><strong>${money(ready.reduce((sum, item) => sum + item.lineTotal, 0))}</strong></div>`;
  }

  function displayCart() {
    updateHeader();
    if (page === 'cart.html') renderCart();
    if (page === 'checkout.html') renderCheckout();
  }

  async function loadCart() {
    const userId = session?.user.id;
    const result = userId ? await API.cart.get() : { items: [], count: 0 };
    if (session?.user.id !== userId) return;
    cart = result;
    displayCart();
  }

  async function groupOrCartAction(event) {
    const button = event.target.closest('[data-live-action]');
    if (!button || busy) return;
    const { liveAction: action, target } = button.dataset;
    if (action === 'share') {
      const href = new URL(detailUrl(product.id, target), location.href).href;
      try { await navigator.clipboard.writeText(href); toast('Đã sao chép liên kết nhóm.'); }
      catch { window.prompt('Sao chép liên kết nhóm', href); }
      return;
    }
    if (!session) { location.href = loginUrl(); return; }
    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    let full = false;
    try {
      if (action === 'create' || action === 'join') {
        const args = action === 'create' ? [product.id, region(), Number(byId('group-hours').value)] : [target];
        const { status } = await groupRequest(action, args);
        toast(status === 201 ? (action === 'create' ? 'Đã tạo nhóm và giữ suất.' : 'Đã giữ suất cho bạn.') : 'Bạn đã có suất trong nhóm.');
      } else if (['confirm', 'cancelReservation', 'cancel'].includes(action)) {
        const { group } = await API.groups[action](target);
        toast(action === 'confirm' ? (group.lockedAt ? 'Nhóm đã chốt.' : 'Đã xác nhận suất.') : 'Đã hủy.');
      } else if (action === 'groupCheckout') {
        const result = await API.cart.add(product.id, 'group', 1, target);
        const line = result.items.find(item => item.kind === 'group' && item.groupId === target);
        if (!line) throw new API.ApiError(500, 'CART_ITEM_MISSING', 'Chưa tìm thấy dòng mua chung trong giỏ.');
        location.href = 'checkout.html?' + new URLSearchParams({ item: line.id });
      } else if (action === 'retailCart' || action === 'retailCheckout') {
        const quantity = Number(byId('detail-qty').value);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
          throw new API.ApiError(400, 'INVALID_QUANTITY', 'Vui lòng nhập số lượng nguyên từ 1 đến 99.');
        }
        cart = await API.cart.add(product.id, 'retail', quantity);
        updateHeader();
        if (action === 'retailCheckout') location.href = 'cart.html';
        else toast('Đã thêm vào giỏ hàng.');
      } else {
        const item = cart.items.find(line => line.id === target);
        if (item) cart = action === 'remove' ? await API.cart.remove(item.id)
          : await API.cart.setQuantity(item.id, Math.min(99, item.quantity + (action === 'increase' ? 1 : -1)));
      }
    } catch (error) {
      if (error.status === 401) { location.href = loginUrl(); return; }
      if (error.status === 409 && error.code === 'FULL') full = true;
      else toast(errorText(error), true);
    } finally {
      busy = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (product) {
        if (polling) await polling;
        await refreshGroups();
      } else displayCart();
      if (full) showGroupFull(target);
    }
  }

  function lockCheckoutShipping(form, locked) {
    for (const field of ['name', 'phone', 'address']) form.elements.namedItem(field).readOnly = locked;
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (busy || !event.target.reportValidity()) return;
    const form = event.target;
    if (!checkoutRequest) {
      const itemIds = selectedItems().map(item => item.id);
      if (!itemIds.length) return;
      const input = new FormData(form);
      const shipping = Object.fromEntries(['name', 'phone', 'address'].map(name => [name, input.get(name)]));
      checkoutRequest = { itemIds, shipping, id: API.newRequestId() };
    }
    const request = checkoutRequest;
    busy = true;
    lockCheckoutShipping(form, true);
    const status = byId('live-order-status');
    status.textContent = '';
    try {
      const { id, itemIds: items, shipping: details } = request;
      const order = await API.ui.withLoading(form.querySelector('[type="submit"]'), () => API.orders.place(items, details, id));
      if (checkoutRequest !== request) return;
      if (!order?.id) throw new API.ApiError(500, 'ORDER_ID_MISSING', 'Máy chủ chưa trả mã đơn. Hãy thử lại.');
      checkoutRequest = null;
      form.hidden = true;
      cart.items = cart.items.filter(item => !items.includes(item.id));
      cart.count = cart.items.reduce((total, item) => total + item.quantity, 0);
      updateHeader();
      byId('checkout-summary').innerHTML = `<p>Đã tạo đơn <strong>${esc(order.id)}</strong>.</p>
        <a class="btn btn-primary" href="${esc(paymentUrl(order.id))}">Xem đơn và thanh toán mô phỏng</a>`;
    } catch (error) {
      if (checkoutRequest !== request) return;
      if (error.status > 0 && error.status < 500) checkoutRequest = null;
      if (error.status === 401) location.href = loginUrl();
      status.textContent = checkoutRequest
        ? 'Chưa nhận được kết quả. Bấm đặt đơn lần nữa để thử lại với thông tin đã gửi.'
        : error.code === 'OUT_OF_STOCK' ? 'Sản phẩm đã hết hàng. Chưa tạo đơn.' : errorText(error);
    } finally {
      busy = false;
      lockCheckoutShipping(form, Boolean(checkoutRequest));
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    document.addEventListener('click', groupOrCartAction);
    const form = byId('checkout-form');
    if (form) {
      form.hidden = true;
      form.querySelector('[name="address"]').maxLength = 200;
      form.insertAdjacentHTML('beforeend', '<p id="live-order-status" role="alert"></p>');
      form.addEventListener('submit', submitOrder);
    }
    const banner = document.querySelector('.demo-banner span');
    if (banner) banner.textContent = 'Dữ liệu được lưu trong tài khoản WeBuy. Thanh toán là mô phỏng.';
    try { session = await API.auth.getSession(); }
    catch (error) { toast(errorText(error), true); }
    updateHeader();
    if (page === 'product-detail.html') {
      await loadDetail();
      const onVisible = () => { if (!document.hidden && !busy) void refreshGroups(); };
      setInterval(onVisible, 2000);
      setInterval(updateClocks, 1000);
      document.addEventListener('visibilitychange', onVisible);
      document.addEventListener('webuy:location', renderGroups);
      window.addEventListener('focus', onVisible);
      window.addEventListener('online', () => { if (product === undefined) void loadDetail(); else onVisible(); });
    }
    loadCart().catch(error => toast(errorText(error), true));
    API.auth.onChange(next => {
      const changed = next?.user.id !== session?.user.id;
      session = next;
      if (!changed) return;
      checkoutRequest = null;
      if (form) lockCheckoutShipping(form, false);
      snapshots = [];
      cart = { items: [], count: 0 };
      displayCart();
      renderGroups();
      setTimeout(() => {
        loadCart().catch(error => toast(errorText(error), true));
        Promise.resolve(polling).then(refreshGroups);
      }, 0);
    });
  }, { once: true });
})();
