/* WeBuy reverse bidding. All seller quotations in this frontend MVP are demo data. */
(() => {
  'use strict';

  const KEY = 'webuy_demo_v2_reverse_requests';
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const money = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + 'đ';
  const readRequests = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
    } catch {
      return [];
    }
  };
  let requests = readRequests();
  const saveRequests = () => localStorage.setItem(KEY, JSON.stringify(requests));
  const toast = (message) => {
    const node = $('#app-toast');
    if (!node) return;
    node.textContent = message;
    node.className = 'app-toast show';
    window.setTimeout(() => node.classList.remove('show'), 3000);
  };

  const categorySelect = $('#bid-category');
  (window.WEBUY_CATEGORIES || []).forEach((category) => {
    const option = document.createElement('option');
    option.value = category.name;
    option.textContent = category.name;
    categorySelect.append(option);
  });

  function requestStatus(request) {
    if (request.status === 'locked' || request.acceptedQuoteId) return 'locked';
    const deadline = new Date(request.deadline).getTime();
    if (!Number.isFinite(deadline) || deadline <= Date.now() || request.status === 'expired') return 'expired';
    return 'open';
  }

  function updateExpiredRequests() {
    let changed = false;
    requests.forEach((request) => {
      if (request.status !== 'locked' && requestStatus(request) === 'expired' && request.status !== 'expired') {
        request.status = 'expired';
        request.expiredAt = Date.now();
        changed = true;
      }
    });
    if (changed) saveRequests();
    return changed;
  }

  // Two illustrative offers appear with each newly-created request. Sellers may add their own demo quote below.
  function createDemoQuotes(request) {
    const target = Number(request.targetPrice);
    const samples = [
      { seller: 'Nhà bán mô phỏng A', ratio: 0.97, leadTime: 2, note: 'Giá tham khảo; giao dự kiến 2 ngày.' },
      { seller: 'Nhà bán mô phỏng B', ratio: 0.93, leadTime: 3, note: 'Mức giá thấp hơn mục tiêu; giao dự kiến 3 ngày.' }
    ];
    return samples.map((sample, index) => ({
      id: `${request.id}-quote-${index + 1}`,
      seller: sample.seller,
      price: Math.max(1000, Math.round((target * sample.ratio) / 1000) * 1000),
      leadTime: sample.leadTime,
      note: sample.note,
      isDemo: true,
      source: 'sample',
      createdAt: Date.now()
    }));
  }

  function statusMarkup(status) {
    if (status === 'locked') return '<span class="hub-state state-success">Đã khóa</span>';
    if (status === 'expired') return '<span class="hub-state state-expired">Đã hết hạn</span>';
    return '<span class="hub-state state-open">Đang nhận báo giá</span>';
  }

  function renderSellerRequests() {
    updateExpiredRequests();
    const box = $('#bid-seller-requests');
    if (!box) return;
    const sellerRequests = requests.slice().reverse();
    if (!sellerRequests.length) {
      box.innerHTML = '<div class="feature-empty"><h3>Chưa có yêu cầu mua nào</h3><p>Chuyển sang tab Người mua: Tạo yêu cầu để tạo nhu cầu mua trước.</p><button class="btn btn-outline" type="button" data-bid-go-create>Đi đến tạo yêu cầu</button></div>';
      return;
    }

    box.innerHTML = sellerRequests.map((request) => {
      const status = requestStatus(request);
      const deadlineText = new Date(request.deadline).toLocaleString('vi-VN');
      const quoteCount = Array.isArray(request.quotes) ? request.quotes.length : 0;
      const formMarkup = status === 'open' ? `
          <form class="bid-seller-quote-form" data-bid-seller-form="${esc(request.id)}" novalidate>
            <h4>Gửi báo giá của cửa hàng <span class="demo-pill">DEMO</span></h4>
            <div class="bid-seller-fields">
              <label class="bid-field">Tên cửa hàng / người bán<input name="sellerName" type="text" minlength="2" maxlength="70" placeholder="Ví dụ: Cửa hàng Phương Nam" required></label>
              <label class="bid-field">Giá chào / sản phẩm (VNĐ)<input name="price" type="number" min="1000" step="1000" placeholder="Ví dụ: 235000" required></label>
              <label class="bid-field">Thời gian giao dự kiến (ngày)<input name="leadTime" type="number" min="1" max="90" step="1" value="3" required></label>
            </div>
            <label class="bid-field">Ghi chú báo giá<textarea name="note" rows="2" maxlength="240" placeholder="Ví dụ: Giá đã gồm phí vận chuyển nội thành."></textarea></label>
            <p class="bid-form-error" data-bid-seller-error role="alert" hidden></p>
            <button class="btn btn-primary" type="submit">Gửi báo giá DEMO</button>
          </form>` : `<p class="bid-expiry-note">${status === 'expired' ? 'Yêu cầu đã hết hạn, không nhận thêm báo giá.' : 'Người mua đã chọn phương án và khóa yêu cầu.'}</p>`;
      return `
        <article class="bid-seller-request-card">
          <div class="bid-request-head">
            <div><span class="demo-pill">YÊU CẦU MUA DEMO</span><h3>${esc(request.productType)}</h3>
              <p>${esc(request.category || 'Chưa chọn danh mục')} · ${Number(request.people) || 0} người · Hạn: ${esc(deadlineText)}</p></div>
            ${statusMarkup(status)}
          </div>
          <div class="bid-seller-request-facts"><span>Giá mục tiêu <strong>${money(request.targetPrice)}</strong></span><span>Đã có <strong>${quoteCount}</strong> báo giá</span></div>
          ${formMarkup}
        </article>`;
    }).join('');
  }

  function renderBuyerQuotes() {
    updateExpiredRequests();
    const box = $('#bid-requests');
    if (!box) return;

    if (!requests.length) {
      box.innerHTML = '<div class="feature-empty"><h3>Chưa có yêu cầu mua chung</h3><p>Tạo yêu cầu trước, sau đó người bán có thể gửi báo giá tại tab riêng.</p><button class="btn btn-outline" type="button" data-bid-go-create>Tạo yêu cầu mua</button></div>';
      return;
    }

    box.innerHTML = requests.slice().reverse().map((request) => {
      const status = requestStatus(request);
      const quotes = Array.isArray(request.quotes) ? request.quotes.filter((quote) => quote && quote.isDemo) : [];
      const bestQuote = quotes.length ? quotes.reduce((best, quote) => quote.price < best.price ? quote : best) : null;
      const deadlineText = Number.isFinite(new Date(request.deadline).getTime())
        ? new Date(request.deadline).toLocaleString('vi-VN')
        : 'Không xác định';

      return `
        <article class="bid-request-card">
          <div class="bid-request-head"><div><span class="demo-pill">YÊU CẦU DEMO</span><h3>${esc(request.productType)}</h3>
            <p>${esc(request.category || 'Chưa chọn danh mục')} · ${Number(request.people) || 0} người · Hạn nhận báo giá: ${esc(deadlineText)}</p></div>${statusMarkup(status)}</div>
          <div class="bid-target"><span>Giá mục tiêu / sản phẩm</span><strong>${money(request.targetPrice)}</strong></div>
          <div class="bid-quotes"><h4>Báo giá nhận được <span class="demo-pill">DỮ LIỆU MÔ PHỎNG</span></h4>
            ${quotes.length ? quotes.map((quote) => {
              const selected = request.acceptedQuoteId === quote.id;
              const isBest = bestQuote && quote.id === bestQuote.id;
              let action = '';
              if (selected) action = '<span class="quote-selected">Đã chọn ✓</span>';
              else if (status === 'expired') action = '<span class="quote-unavailable">Đã hết hạn</span>';
              else if (status === 'locked') action = '<span class="quote-unavailable">Yêu cầu đã khóa</span>';
              else action = `<button type="button" data-bid-accept="${esc(request.id)}" data-quote-id="${esc(quote.id)}">Chọn phương án</button>`;
              return `<div class="bid-quote ${selected ? 'is-selected' : ''}">
                <div class="bid-quote-info"><strong>${esc(quote.seller)} ${isBest ? '<span class="demo-pill">GIÁ THẤP NHẤT</span>' : ''}</strong>
                  <small>${esc(quote.note || 'Không có ghi chú')} · Dự kiến ${Number(quote.leadTime) || 0} ngày · <span class="demo-inline-label">DEMO</span>${quote.source === 'seller-form' ? ' · Người bán nhập' : ' · Báo giá mẫu'}</small></div>
                <b>${money(quote.price)}</b>${action}
              </div>`;
            }).join('') : '<div class="feature-empty"><p>Chưa có báo giá cho yêu cầu này.</p></div>'}
          </div>
          ${request.acceptedQuoteId ? '<p class="bid-selection-note">Bạn đã chọn một phương án mô phỏng. Yêu cầu này đã được khóa.</p>' : ''}
          ${status === 'expired' ? '<p class="bid-expiry-note">Đã đến hạn chót. Yêu cầu tự khóa và không thể chọn thêm báo giá.</p>' : ''}
          <p class="bid-demo-disclaimer">Đây là luồng mô phỏng trên cùng trình duyệt; báo giá không phải chào giá hoặc cam kết từ người bán thật.</p>
        </article>`;
    }).join('');
  }

  function renderAll() {
    renderSellerRequests();
    renderBuyerQuotes();
  }

  function setActiveTab(tab) {
    const tabs = {
      buyer: ['#bid-tab-buyer', '#bid-form-panel'],
      seller: ['#bid-tab-seller', '#bid-seller-panel'],
      compare: ['#bid-tab-compare', '#bid-compare-panel']
    };
    Object.entries(tabs).forEach(([key, [buttonSelector, panelSelector]]) => {
      const active = key === tab;
      $(buttonSelector).classList.toggle('is-active', active);
      $(buttonSelector).setAttribute('aria-selected', String(active));
      $(panelSelector).hidden = !active;
    });
    if (tab === 'seller') renderSellerRequests();
    if (tab === 'compare') renderBuyerQuotes();
  }

  $('#bid-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const productType = String(formData.get('productType') || '').trim();
    const people = Number(formData.get('people'));
    const targetPrice = Number(formData.get('targetPrice'));
    const deadline = String(formData.get('deadline') || '');
    const deadlineDate = new Date(deadline);
    const errors = [];

    if (productType.length < 2) errors.push('Nhập loại sản phẩm (ít nhất 2 ký tự).');
    if (!Number.isInteger(people) || people < 2 || people > 99) errors.push('Số người phải là số nguyên từ 2 đến 99.');
    if (!Number.isFinite(targetPrice) || targetPrice < 1000) errors.push('Giá mục tiêu phải từ 1.000đ trở lên.');
    if (!deadline || Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) errors.push('Hạn chót phải là thời điểm trong tương lai.');

    const error = $('#bid-form-error');
    if (errors.length) {
      error.textContent = errors.join(' ');
      error.hidden = false;
      return;
    }

    error.hidden = true;
    const request = {
      id: `bid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      productType,
      category: String(formData.get('category') || ''),
      people,
      targetPrice,
      deadline: deadlineDate.toISOString(),
      status: 'open',
      createdAt: Date.now(),
      quotes: []
    };
    request.quotes = createDemoQuotes(request);
    requests.push(request);
    saveRequests();
    event.currentTarget.reset();
    toast('Đã tạo yêu cầu. Chuyển sang tab người bán để gửi thêm báo giá.');
    renderAll();
    setActiveTab('seller');
  });

  // Seller submits a quote for a selected buyer request. This is a same-browser demo only.
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-bid-seller-form]');
    if (!form) return;
    event.preventDefault();
    const request = requests.find((item) => item.id === form.dataset.bidSellerForm);
    if (!request) {
      toast('Không tìm thấy yêu cầu mua này.');
      renderSellerRequests();
      return;
    }
    if (requestStatus(request) !== 'open') {
      toast('Yêu cầu đã hết hạn hoặc được khóa, không thể gửi báo giá.');
      renderAll();
      return;
    }

    const data = new FormData(form);
    const seller = String(data.get('sellerName') || '').trim();
    const price = Number(data.get('price'));
    const leadTime = Number(data.get('leadTime'));
    const note = String(data.get('note') || '').trim();
    const errors = [];
    if (seller.length < 2) errors.push('Nhập tên cửa hàng (ít nhất 2 ký tự).');
    if (!Number.isFinite(price) || price < 1000) errors.push('Giá chào phải từ 1.000đ trở lên.');
    if (!Number.isInteger(leadTime) || leadTime < 1 || leadTime > 90) errors.push('Thời gian giao phải từ 1 đến 90 ngày.');
    const duplicate = (request.quotes || []).some((quote) => String(quote.seller).trim().toLowerCase() === seller.toLowerCase());
    if (duplicate) errors.push('Tên người bán này đã gửi báo giá cho yêu cầu.');

    const error = form.querySelector('[data-bid-seller-error]');
    if (errors.length) {
      error.textContent = errors.join(' ');
      error.hidden = false;
      return;
    }

    request.quotes = Array.isArray(request.quotes) ? request.quotes : [];
    request.quotes.push({
      id: `${request.id}-seller-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      seller,
      price: Math.round(price),
      leadTime,
      note: note || 'Người bán gửi mức giá đề xuất.',
      isDemo: true,
      source: 'seller-form',
      createdAt: Date.now()
    });
    saveRequests();
    toast('Đã gửi báo giá DEMO. Người mua có thể xem trong tab Chọn báo giá.');
    renderAll();
    setActiveTab('seller');
  });

  document.addEventListener('click', (event) => {
    const create = event.target.closest('[data-bid-go-create]');
    if (create) {
      setActiveTab('buyer');
      $('#bid-form').elements.productType.focus();
      return;
    }

    const compare = event.target.closest('[data-bid-go-compare]');
    if (compare) {
      setActiveTab('compare');
      return;
    }

    const button = event.target.closest('[data-bid-accept]');
    if (!button) return;
    const request = requests.find((item) => item.id === button.dataset.bidAccept);
    if (!request) return;
    const status = requestStatus(request);
    if (status !== 'open') {
      if (status === 'expired') request.status = 'expired';
      saveRequests();
      renderBuyerQuotes();
      toast(status === 'expired' ? 'Yêu cầu đã hết hạn, không thể chọn báo giá.' : 'Yêu cầu này đã được khóa.');
      return;
    }
    const quote = (Array.isArray(request.quotes) ? request.quotes : []).find((item) => item.id === button.dataset.quoteId && item.isDemo);
    if (!quote) {
      toast('Không tìm thấy báo giá DEMO hợp lệ.');
      return;
    }
    request.acceptedQuoteId = quote.id;
    request.status = 'locked';
    request.lockedAt = Date.now();
    saveRequests();
    renderAll();
    setActiveTab('compare');
    toast('Đã chọn báo giá mô phỏng. Yêu cầu đã khóa.');
  });

  $('#bid-tab-buyer').addEventListener('click', () => setActiveTab('buyer'));
  $('#bid-tab-seller').addEventListener('click', () => setActiveTab('seller'));
  $('#bid-tab-compare').addEventListener('click', () => setActiveTab('compare'));

  window.setInterval(() => {
    if (updateExpiredRequests()) renderAll();
  }, 15000);

  renderAll();
})();
