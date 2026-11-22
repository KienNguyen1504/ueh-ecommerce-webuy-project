/* WeBuy Seller Center (frontend demo) — khu vực riêng, không sửa giỏ hàng/đơn cũ.
 * Sản phẩm được lưu với khóa webuy_seller_v1_products.
 * js/catalog-data.js đọc cùng khóa để Kênh người mua hiển thị sản phẩm đã đăng.
 */
(() => {
  'use strict';

  const STORE_KEY = 'webuy_seller_v1_shop';
  const PRODUCTS_KEY = 'webuy_seller_v1_products';
  const GROUPS_KEY = 'webuy_demo_v2_groups'; // khóa nhóm mua hiện dùng trong js/app.js
  const CATEGORIES = ['Balo & túi ví', 'Áo thun', 'Thiết bị gia dụng', 'Trang sức'];
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ';
  const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const save = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch { toast('Không thể lưu dữ liệu. Hãy kiểm tra dung lượng trình duyệt hoặc giảm kích thước ảnh.', true); return false; }
  };
  const now = () => Date.now();
  const uid = () => 'seller-' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  const getItems = () => { const data = read(PRODUCTS_KEY, []); return Array.isArray(data) ? data : []; };
  const getGroups = () => { const data = read(GROUPS_KEY, []); return Array.isArray(data) ? data : []; };
  const isPicture = url => typeof url === 'string' && (/^https?:\/\/[^\s<>"']+$/i.test(url) || /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(url));
  const picture = url => isPicture(url) ? url : 'images/logo-mark.png';
  const asInt = value => Number.isInteger(Number(value)) && String(value).trim() !== '' ? Number(value) : NaN;
  const durationLabel = hours => hours === 168 ? '7 ngày' : hours + ' giờ';
  const statusLabel = state => ({published:'Đang hiển thị', hidden:'Đang ẩn',draft:'Bản nháp',open:'Đang chờ đủ người',success:'Đã đủ thành viên',expired:'Hết hạn'})[state] || state;

  let shop = read(STORE_KEY, null);
  let editingId = null;
  let pendingImage = ''; // ảnh sau khi tải và nén, chưa lưu cho tới khi submit
  let pendingLogo = ''; // logo sau khi tải và nén
  let toastTimeout;

  function toast(message, error = false) {
    const el = q('#sc-toast');
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('show'), 4300);
  }

  function setError(form, name, message) {
    const target = q(`[data-error-for="${name}"]`, form);
    if (target) target.textContent = message || '';
    const input = form.elements.namedItem(name);
    if (input?.setAttribute) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }
  function clearErrors(form) {
    qa('.sc-error', form).forEach(el => el.textContent = '');
    qa('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
  }
  function reportErrors(form, errors) {
    clearErrors(form);
    for (const [name, message] of Object.entries(errors)) setError(form, name, message);
    if (Object.keys(errors).length) {
      const first = Object.keys(errors)[0];
      const input = form.elements.namedItem(first === 'image' ? 'imageUrl' : first);
      if (input?.focus) input.focus();
      toast('Vui lòng kiểm tra các trường được đánh dấu.', true);
      return true;
    }
    return false;
  }

  function storeValues(form) {
    const data = new FormData(form);
    return {
      storeName: String(data.get('storeName') || '').trim(),
      representative: String(data.get('representative') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').replace(/[\s.-]/g, ''),
      address: String(data.get('address') || '').trim(),
      description: String(data.get('description') || '').trim()
    };
  }
  function validateStore(values, needsTerms = false, form = null) {
    const errors = {};
    if (!values.storeName || values.storeName.length > 80) errors.storeName = 'Nhập tên cửa hàng (tối đa 80 ký tự).';
    if (!values.representative || values.representative.length > 80) errors.representative = 'Nhập họ và tên người đại diện.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Email không đúng định dạng.';
    if (!/^(0\d{9}|\+84\d{9}|84\d{9})$/.test(values.phone)) errors.phone = 'Số điện thoại Việt Nam phải có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.';
    if (!values.address || values.address.length > 200) errors.address = 'Nhập địa chỉ cửa hàng.';
    if (needsTerms && !q('[name="terms"]', form)?.checked) errors.terms = 'Cần đồng ý điều khoản để tiếp tục.';
    return errors;
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!file) { resolve(''); return; }
      if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { reject(new Error('Chỉ hỗ trợ JPG, PNG, WebP.')); return; }
      if (file.size > 5 * 1024 * 1024) { reject(new Error('Ảnh gốc vượt quá 5 MB.')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('File ảnh không hợp lệ.'));
        img.onload = () => {
          const scale = Math.min(1, 800 / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const context = canvas.getContext('2d');
          if (!context) { reject(new Error('Không xử lý được ảnh.')); return; }
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.74));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function fillStoreForm() {
    const form = q('#sc-store-form');
    for (const key of ['storeName','representative','email','phone','address','description']) {
      if (form.elements[key]) form.elements[key].value = shop?.[key] || '';
    }
  }
  function updateIdentity() {
    q('#sc-shop-header-name').textContent = shop.storeName;
    q('#sc-welcome-name').textContent = shop.storeName;
    q('#sc-shop-avatar').src = picture(shop.logo || '');
  }

  function activate() {
    if (!shop) {
      q('#sc-app').hidden = true;
      q('#sc-onboarding').hidden = false;
      q('#sc-intro').hidden = false;
      q('#sc-registration').hidden = true;
      return;
    }
    q('#sc-app').hidden = false;
    q('#sc-onboarding').hidden = true;
    updateIdentity();
    fillStoreForm();
    switchView('overview');
    toast('Chào mừng đến WeBuy Seller Center!');
  }

  function switchView(view) {
    const choices = ['overview','products','editor','groups','store'];
    if (!choices.includes(view)) return;
    if (view === 'editor' && !editingId) resetEditor();
    choices.forEach(name => q('#sc-view-' + name).hidden = name !== view);
    qa('[data-sc-view]').forEach(btn => {
      const active = btn.dataset.scView === view;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current','page'); else btn.removeAttribute('aria-current');
    });
    q('#sc-app').classList.remove('sidebar-open');
    q('#sc-menu-toggle').setAttribute('aria-expanded', 'false');
    refreshViews();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function productValues(form) {
    const data = new FormData(form);
    const url = String(data.get('imageUrl') || '').trim();
    const current = getItems().find(item => item.id === editingId);
    const image = pendingImage || url || current?.image || '';
    return {
      name: String(data.get('name') || '').trim(),
      category: String(data.get('category') || ''),
      image,
      description: String(data.get('description') || '').trim(),
      retail: asInt(data.get('retail')),
      group: asInt(data.get('group')),
      minMembers: asInt(data.get('minMembers')),
      groupDurationHours: asInt(data.get('groupDurationHours'))
    };
  }
  function validateProduct(value, draft = false) {
    const errors = {};
    if (!value.name || value.name.length > 120) errors.name = 'Nhập tên sản phẩm (tối đa 120 ký tự).';
    if (!draft || value.category) if (!CATEGORIES.includes(value.category)) errors.category = 'Vui lòng chọn danh mục có sẵn.';
    if (!draft || value.image) if (!isPicture(value.image)) errors.image = 'Cần tải ảnh lên hoặc nhập URL ảnh bắt đầu bằng http:// hoặc https://.';
    if (!draft || value.description) if (!value.description || value.description.length > 2000) errors.description = 'Nhập mô tả sản phẩm.';
    if (!draft || Number.isFinite(value.retail)) if (!Number.isSafeInteger(value.retail) || value.retail <= 0 || value.retail > 100000000000) errors.retail = 'Giá mua lẻ phải là số nguyên lớn hơn 0.';
    if (!draft || Number.isFinite(value.group)) if (!Number.isSafeInteger(value.group) || value.group <= 0 || value.group > 100000000000) errors.group = 'Giá mua chung phải là số nguyên lớn hơn 0.';
    if (Number.isFinite(value.retail) && Number.isFinite(value.group) && value.group > value.retail) errors.group = 'Giá mua chung không được cao hơn giá mua lẻ.';
    if (!draft || Number.isFinite(value.minMembers)) if (!Number.isInteger(value.minMembers) || value.minMembers < 2 || value.minMembers > 1000) errors.minMembers = 'Số thành viên tối thiểu phải là số nguyên từ 2 đến 1.000.';
    if (!draft || Number.isFinite(value.groupDurationHours)) if (![12,24,48,72,168].includes(value.groupDurationHours)) errors.groupDurationHours = 'Chọn thời hạn hợp lệ.';
    return errors;
  }

  function renderSavings() {
    const form = q('#sc-product-form');
    const values = productValues(form);
    const el = q('#sc-savings');
    if (values.retail > 0 && values.group > 0 && values.group <= values.retail && Number.isInteger(values.minMembers) && values.minMembers >= 2) {
      const saving = values.retail - values.group;
      const percent = Math.round(saving / values.retail * 100);
      el.textContent = `Người mua tiết kiệm ${money(saving)} (${percent}%) khi tham gia nhóm đủ ${values.minMembers} thành viên.`;
    } else {
      el.textContent = 'Nhập giá mua lẻ, giá mua chung và số thành viên để xem mức tiết kiệm.';
    }
    const preview = q('#sc-image-preview');
    const url = values.image;
    preview.hidden = !isPicture(url);
    if (!preview.hidden && preview.getAttribute('src') !== url) preview.src = url;
  }

  function resetEditor() {
    editingId = null;
    pendingImage = '';
    const form = q('#sc-product-form');
    form.reset();
    clearErrors(form);
    q('#sc-editor-title').textContent = 'Đăng sản phẩm mới';
    q('#sc-publish').textContent = 'Đăng sản phẩm';
    q('#sc-p-duration').value = '24';
    renderSavings();
  }
  function editProduct(id) {
    const item = getItems().find(p => p.id === id);
    if (!item) { toast('Không tìm thấy sản phẩm.', true); return; }
    editingId = id;
    pendingImage = '';
    const form = q('#sc-product-form');
    form.reset(); clearErrors(form);
    for (const key of ['name','category','description','retail','group','minMembers','groupDurationHours']) {
      if (form.elements[key]) form.elements[key].value = item[key] || '';
    }
    q('#sc-p-image-url').value = /^https?:\/\//i.test(item.image) ? item.image : '';
    q('#sc-editor-title').textContent = 'Chỉnh sửa sản phẩm';
    q('#sc-publish').textContent = 'Lưu & hiển thị sản phẩm';
    renderSavings();
    switchView('editor');
  }
  function persistProduct(status, draft = false) {
    const form = q('#sc-product-form');
    const values = productValues(form);
    const errors = validateProduct(values, draft);
    if (reportErrors(form, errors)) return;
    const items = getItems();
    const original = items.find(p => p.id === editingId);
    const item = {
      ...values,
      retail: Number.isFinite(values.retail) ? values.retail : 0,
      price: Number.isFinite(values.retail) ? values.retail : 0,
      group: Number.isFinite(values.group) ? values.group : 0,
      minMembers: Number.isFinite(values.minMembers) ? values.minMembers : 0,
      groupDurationHours: Number.isFinite(values.groupDurationHours) ? values.groupDurationHours : 0,
      id: original?.id || uid(),
      shopId: shop.id,
      status,
      createdAt: original?.createdAt || now(),
      updatedAt: now(),
      badge: 'Từ người bán'
    };
    const index = items.findIndex(p => p.id === item.id);
    if (index === -1) items.push(item); else items[index] = item;
    if (!save(PRODUCTS_KEY, items)) return;
    toast(status === 'draft' ? 'Đã lưu bản nháp.' : 'Đã đăng/lưu sản phẩm thành công! Sản phẩm đã kết nối với Kênh người mua.');
    resetEditor();
    switchView('products');
  }

  function groupMeta(g) {
    const need = Math.max(2, Number(g.need) || 2);
    const count = Math.max(0, Number(g.demoCount) || 0) + (Array.isArray(g.members) ? g.members.length : 0);
    const state = count >= need ? 'success' : now() >= Number(g.endsAt) ? 'expired' : 'open';
    return {need,count,state,progress:Math.min(100,Math.round(count/need*100)),left:Math.max(0,Math.ceil((Number(g.endsAt) - now())/3600000))};
  }
  function myGroups() {
    const ids = new Set(getItems().filter(p => p.shopId === shop.id).map(p => p.id));
    return getGroups().filter(g => g && ids.has(g.productId)).sort((a,b) => (Number(b.createdAt)||0)-(Number(a.createdAt)||0));
  }

  function renderProductRow(p, recent = false) {
    const status = p.status || 'draft';
    const info = `${money(p.retail)} lẻ · ${money(p.group)} mua chung`;
    const actions = `<button type="button" class="sc-small-btn" data-sc-edit="${esc(p.id)}">Chỉnh sửa</button>
      ${status === 'published' ? `<button type="button" class="sc-small-btn danger" data-sc-toggle="${esc(p.id)}">Ẩn</button>` : status === 'hidden' ? `<button type="button" class="sc-small-btn" data-sc-toggle="${esc(p.id)}">Hiện lại</button>` : ''}
      ${status === 'published' ? `<a class="sc-small-btn" target="_blank" rel="noopener noreferrer" href="product-detail.html?id=${encodeURIComponent(p.id)}">Xem bên mua ↗</a>` : ''}`;
    return `<article class="sc-product-line"><img src="${esc(picture(p.image))}" alt="Ảnh ${esc(p.name)}" loading="lazy"><div class="sc-product-info"><strong>${esc(p.name || 'Chưa có tên')}</strong><small>${esc(p.category || 'Chưa chọn danh mục')} · ${info}</small><small><span class="sc-state" data-state="${esc(status)}">${statusLabel(status)}</span></small></div><div class="sc-product-actions">${recent ? `<button type="button" class="sc-small-btn" data-sc-edit="${esc(p.id)}">Chỉnh sửa</button>` : actions}</div></article>`;
  }
  function renderGroupCard(g) {
    const p = getItems().find(item => item.id === g.productId);
    if (!p) return '';
    const data = groupMeta(g);
    const label = data.state === 'open' ? `Còn khoảng ${data.left} giờ` : data.state === 'success' ? 'Đã đạt mức tối thiểu' : 'Đã hết thời gian';
    return `<article class="sc-group-card"><div class="sc-group-card-head"><div><h3>${esc(p.name)}</h3><p>Mã nhóm: ${esc(g.id)}</p></div><span class="sc-state" data-state="${data.state}">${statusLabel(data.state)}</span></div><p><strong>${data.count}/${data.need}</strong> thành viên · ${label}</p><div class="sc-progress" role="img" aria-label="Tiến độ ${data.progress}%"><span style="width:${data.progress}%"></span></div><div class="sc-group-foot"><small class="sc-muted">${data.progress}% mục tiêu</small><button class="sc-small-btn" type="button" data-sc-group="${esc(g.id)}">Xem chi tiết →</button></div></article>`;
  }

  function renderOverview() {
    const items = getItems().filter(p => p.shopId === shop.id).sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));
    const groups = myGroups();
    q('#sc-stat-total').textContent = items.length;
    q('#sc-stat-visible').textContent = items.filter(p=>p.status==='published').length;
    q('#sc-stat-open').textContent = groups.filter(g=>groupMeta(g).state==='open').length;
    q('#sc-stat-success').textContent = groups.filter(g=>groupMeta(g).state==='success').length;
    q('#sc-notification-count').textContent = groups.filter(g=>groupMeta(g).state==='open').length;
    q('#sc-recent-products').innerHTML = items.length ? items.slice(0,5).map(p=>renderProductRow(p,true)).join('') : '<p class="sc-empty">Chưa có sản phẩm. Nhấn “Đăng sản phẩm mới” để bắt đầu.</p>';
    q('#sc-recent-groups').innerHTML = groups.length ? groups.slice(0,4).map(renderGroupCard).join('') : '<p class="sc-empty">Chưa có nhóm mua liên quan. Người mua có thể tạo nhóm tại trang chi tiết sản phẩm đã đăng.</p>';
  }
  function renderMyProducts() {
    const keyword = q('#sc-product-search').value.trim().toLocaleLowerCase('vi-VN');
    const filter = q('#sc-product-filter').value;
    const list = getItems().filter(p=>p.shopId === shop.id).sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));
    const filtered = list.filter(p=>(filter==='all'||p.status===filter) && `${p.name} ${p.category}`.toLocaleLowerCase('vi-VN').includes(keyword));
    q('#sc-products-list').innerHTML = filtered.length ? filtered.map(p=>renderProductRow(p)).join('') : '<p class="sc-empty">Không có sản phẩm phù hợp. Thử đổi bộ lọc hoặc đăng sản phẩm mới.</p>';
  }
  function renderGroups() {
    const filter = q('#sc-group-filter').value;
    const list = myGroups().filter(g=>filter==='all'||groupMeta(g).state===filter);
    q('#sc-groups-list').innerHTML = list.length ? list.map(renderGroupCard).join('') : '<p class="sc-empty">Chưa có nhóm mua thuộc bộ lọc này.</p>';
  }
  function refreshViews() { if (!shop) return; renderOverview(); renderMyProducts(); renderGroups(); }

  function setVisibility(id) {
    const items = getItems();
    const p = items.find(p=>p.id===id&&p.shopId===shop.id);
    if (!p) return;
    if (p.status === 'hidden') {
      const errors = validateProduct(p);
      if (Object.keys(errors).length) { toast('Sản phẩm chưa đủ thông tin để công khai. Hãy chỉnh sửa trước.', true); editProduct(id); return; }
      p.status = 'published';
    } else if (p.status === 'published') p.status = 'hidden';
    else return;
    p.updatedAt = now();
    if (!save(PRODUCTS_KEY, items)) return;
    refreshViews();
    toast(p.status === 'published' ? 'Đã hiển thị lại sản phẩm trên Kênh người mua.' : 'Đã ẩn sản phẩm khỏi Kênh người mua.');
  }

  function previewProduct() {
    const values = productValues(q('#sc-product-form'));
    if (reportErrors(q('#sc-product-form'), validateProduct(values))) return;
    const root = q('#sc-modal-root');
    root.innerHTML = `<div class="sc-modal-backdrop" role="presentation"><section class="sc-modal" role="dialog" aria-modal="true" aria-label="Xem trước sản phẩm"><button type="button" class="sc-modal-close" data-sc-close aria-label="Đóng">×</button><img src="${esc(picture(values.image))}" alt="Ảnh sản phẩm"><span class="sc-eyebrow">${esc(values.category)}</span><h2>${esc(values.name)}</h2><p>${esc(values.description)}</p><div class="sc-preview-prices"><div>Giá mua lẻ<br><strong>${money(values.retail)}</strong></div><div>Giá mua chung<br><strong>${money(values.group)}</strong></div></div><p>Giá nhóm từ <strong>${values.minMembers} người</strong> · Thời hạn: <strong>${durationLabel(values.groupDurationHours)}</strong></p><button class="sc-btn sc-btn-primary" type="button" data-sc-close>Đóng xem trước</button></section></div>`;
    q('.sc-modal-close', root).focus();
  }
  function groupDetail(id) {
    const g = myGroups().find(g=>g.id===id);
    if (!g) return;
    const p = getItems().find(item=>item.id===g.productId);
    const {need,count,state,left} = groupMeta(g);
    const started = new Date(Number(g.createdAt)||now()).toLocaleString('vi-VN');
    const end = new Date(Number(g.endsAt)||now()).toLocaleString('vi-VN');
    q('#sc-modal-root').innerHTML = `<div class="sc-modal-backdrop"><section class="sc-modal" role="dialog" aria-modal="true" aria-label="Chi tiết nhóm mua"><button class="sc-modal-close" type="button" data-sc-close aria-label="Đóng">×</button><span class="sc-eyebrow">NHÓM MUA LIÊN QUAN</span><h2>${esc(p?.name||'Sản phẩm')}</h2><p><strong>Mã nhóm:</strong> ${esc(g.id)}</p><p><strong>Trạng thái:</strong> ${statusLabel(state)}</p><p><strong>Thành viên:</strong> ${count}/${need}</p><p><strong>Khởi tạo:</strong> ${esc(started)}</p><p><strong>Kết thúc dự kiến:</strong> ${esc(end)}</p><p>${state==='open'?`Còn khoảng ${left} giờ để đạt điều kiện mua chung.`:state==='success'?'Nhóm đã đủ số lượng thành viên tối thiểu.':'Nhóm đã quá thời hạn mà chưa đủ người.'}</p><button class="sc-btn sc-btn-primary" type="button" data-sc-close>Đóng</button></section></div>`;
    q('.sc-modal-close', q('#sc-modal-root')).focus();
  }

  // Sự kiện và đăng ký biểu mẫu
  q('#sc-start-registration').addEventListener('click',()=>{q('#sc-intro').hidden=true;q('#sc-registration').hidden=false;q('#sc-reg-store').focus();});
  q('#sc-back-intro').addEventListener('click',()=>{q('#sc-registration').hidden=true;q('#sc-intro').hidden=false;});
  q('#sc-register-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = storeValues(form);
    const errors = validateStore(values, true, form);
    if (reportErrors(form, errors)) return;
    const submit = q('[type="submit"]', form);
    submit.disabled = true;
    try {
      const logoFile = form.elements.logo.files[0];
      const logo = logoFile ? await compressImage(logoFile) : '';
      const newShop = { ...values, logo, id: uid(), createdAt: now() };
      if (!save(STORE_KEY, newShop)) return;
      shop = newShop;
      activate();
      toast('Đăng ký người bán thành công! Chào mừng đến với WeBuy Seller Center.');
    } catch (error) { setError(form, 'logo', error.message); toast(error.message,true); }
    finally { submit.disabled = false; }
  });
  q('#sc-store-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = storeValues(form);
    if (reportErrors(form, validateStore(values))) return;
    const submit = q('[type="submit"]', form);submit.disabled=true;
    try {
      const file = form.elements.logo.files[0];
      const logo = file ? await compressImage(file) : shop.logo;
      const next = {...shop, ...values, logo, updatedAt:now()};
      if (!save(STORE_KEY,next)) return;
      shop = next;updateIdentity();toast('Đã cập nhật thông tin cửa hàng.');
    } catch (error) { setError(form,'logo',error.message);toast(error.message,true); }
    finally { submit.disabled=false; }
  });

  q('#sc-product-form').addEventListener('submit', event => {event.preventDefault();persistProduct('published');});
  q('#sc-save-draft').addEventListener('click',()=>persistProduct('draft',true));
  q('#sc-product-preview').addEventListener('click',previewProduct);
  q('#sc-product-form').addEventListener('input',event=>{
    if (event.target.name) setError(q('#sc-product-form'),event.target.name,'');
    renderSavings();
  });
  q('#sc-p-image-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    pendingImage = '';
    try { pendingImage = await compressImage(file);setError(q('#sc-product-form'),'imageFile','');renderSavings();toast('Đã tải ảnh. Nhấn “Đăng sản phẩm” để lưu.'); }
    catch(error) {setError(q('#sc-product-form'),'imageFile',error.message);toast(error.message,true);event.target.value='';renderSavings();}
  });
  q('#sc-product-search').addEventListener('input',renderMyProducts);
  q('#sc-product-filter').addEventListener('change',renderMyProducts);
  q('#sc-group-filter').addEventListener('change',renderGroups);
  q('#sc-refresh-groups').addEventListener('click',()=>{refreshViews();toast('Đã cập nhật dữ liệu nhóm mua trên trình duyệt.');});
  q('#sc-notification').addEventListener('click',()=>switchView('groups'));
  q('#sc-menu-toggle').addEventListener('click',()=>{
    const app = q('#sc-app');
    app.classList.toggle('sidebar-open');
    q('#sc-menu-toggle').setAttribute('aria-expanded',String(app.classList.contains('sidebar-open')));
  });
  document.addEventListener('click',event=>{
    const btn = event.target.closest('[data-sc-view],[data-sc-go],[data-sc-edit],[data-sc-toggle],[data-sc-group],[data-sc-close]');
    if (btn) {
      if (btn.dataset.scView) {if(btn.dataset.scView==='editor')resetEditor();switchView(btn.dataset.scView);}
      else if (btn.dataset.scGo) {if(btn.dataset.scGo==='editor')resetEditor();switchView(btn.dataset.scGo);}
      else if (btn.dataset.scEdit) editProduct(btn.dataset.scEdit);
      else if (btn.dataset.scToggle) setVisibility(btn.dataset.scToggle);
      else if (btn.dataset.scGroup) groupDetail(btn.dataset.scGroup);
      else if (btn.hasAttribute('data-sc-close')) q('#sc-modal-root').innerHTML='';
    }
    if (event.target.classList.contains('sc-modal-backdrop')) q('#sc-modal-root').innerHTML='';
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && q('#sc-modal-root').innerHTML)q('#sc-modal-root').innerHTML='';});
  window.addEventListener('storage',event=>{if([PRODUCTS_KEY,GROUPS_KEY,STORE_KEY].includes(event.key)){shop=read(STORE_KEY,null);if(shop){updateIdentity();refreshViews();}}});

  activate();
})();
