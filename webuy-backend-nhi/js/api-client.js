/* WeBuy | Lớp API dùng chung ở frontend (checklist: "Lớp API dùng chung ở frontend").
 *
 * Các trang chỉ gọi WeBuyAPI.<nhóm>.<hàm>(), không tự đọc localStorage làm dữ liệu thật,
 * không tự gọi fetch tới Supabase. Đổi giữa giả lập và backend thật ở js/api-config.js.
 *
 *   WeBuyAPI.auth          signUp, signIn, signOut, getSession, onChange
 *   WeBuyAPI.profile       get, update
 *   WeBuyAPI.products      search, get, categories
 *   WeBuyAPI.seller        register, myStore, updateStore, dashboard, listProducts, saveProduct, setStatus, uploadImage
 *   WeBuyAPI.stock         hold, release
 *   WeBuyAPI.cart          get, add, setQuantity, remove, merge
 *   WeBuyAPI.orders        place, get, list, payDemo, cancel, refundDemo
 *   WeBuyAPI.notifications list, markRead
 *   WeBuyAPI.ui            withLoading, errorMessage
 *
 * Mọi hàm trả về Promise. Lỗi luôn là WeBuyAPI.ApiError { status, code, message }:
 *   0 = mất mạng, 400 = dữ liệu sai, 401 = chưa đăng nhập, 403 = không có quyền,
 *   404 = không tìm thấy, 409 = xung đột (hết hàng, sai trạng thái...), 429 = thao tác quá nhanh.
 * Cần nạp js/api-config.js trước file này. Chế độ mock cần thêm js/catalog-data.js.
 */
(() => {
  'use strict';

  const CONFIG = window.WEBUY_API_CONFIG || { mode: 'mock' };
  const MODE = (() => {
    try { return localStorage.getItem('webuy_api_mode') || CONFIG.mode || 'mock'; } catch { return CONFIG.mode || 'mock'; }
  })();
  const BUCKET = CONFIG.storageBucket || 'store-assets';
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

  /* ------------------------------------------------------------------ Lỗi chuẩn hóa */
  class ApiError extends Error {
    constructor(status, code, message) {
      super(message || code);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }
  const fail = (status, code, message) => { throw new ApiError(status, code, message); };

  const FRIENDLY = {
    0: 'Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại — giao dịch chưa được ghi nhận.',
    401: 'Bạn cần đăng nhập để tiếp tục.',
    403: 'Bạn không có quyền thực hiện thao tác này.',
    404: 'Không tìm thấy dữ liệu.',
    429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
    500: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
  };
  function errorMessage(err) {
    if (err instanceof ApiError) return err.message && err.message !== err.code ? err.message : (FRIENDLY[err.status] || 'Có lỗi xảy ra, vui lòng thử lại.');
    return FRIENDLY[500];
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  /* Gọi 1 thao tác có thử lại: chỉ thử lại khi mất mạng hoặc lỗi máy chủ (5xx),
   * và chỉ với thao tác an toàn khi lặp lại (đọc dữ liệu, hoặc có request id như đặt hàng). */
  async function run(name, fn, { retry = false } = {}) {
    const attempts = retry ? 3 : 1;
    for (let i = 0; i < attempts; i++) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) fail(0, 'OFFLINE', FRIENDLY[0]);
      try {
        return await fn();
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, 'NETWORK', FRIENDLY[0]);
        const transient = err.status === 0 || err.status >= 500;
        if (!transient || i === attempts - 1) {
          if (err.status >= 500) report(name, err);
          throw err;
        }
        await sleep(600 * (i + 1) * (i + 1));
      }
    }
  }

  /* ================================================================== SUPABASE (backend thật) */
  function loadSupabase() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CONFIG.supabaseJsUrl;
      s.async = true;
      s.onload = () => resolve(window.supabase);
      s.onerror = () => reject(new ApiError(0, 'SDK_LOAD_FAILED', 'Không tải được thư viện Supabase. Kiểm tra kết nối mạng.'));
      document.head.appendChild(s);
    });
  }

  function supabaseAdapter() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
      console.error('WeBuyAPI: chế độ supabase cần supabaseUrl và supabaseKey trong js/api-config.js');
    }
    const clientPromise = loadSupabase().then(sb => sb.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    }));

    // Đổi lỗi của Supabase/PostgREST sang ApiError. Migration trả SQLSTATE 'PT404' -> HTTP 404,
    // message = mã lỗi (VD OUT_OF_STOCK), details = câu tiếng Việt.
    function toApiError(error, httpStatus) {
      if (!error) return null;
      const code = String(error.code || '');
      if (/^PT\d{3}$/.test(code)) return new ApiError(Number(code.slice(2)), error.message, error.details || error.message);
      if (code === '42501') return new ApiError(httpStatus === 403 ? 403 : 401, 'AUTH_REQUIRED', FRIENDLY[401]);
      if (code === 'PGRST202') return new ApiError(404, 'RPC_NOT_FOUND', 'Backend chưa có chức năng này (chưa chạy migration?).');
      if (code === '23505') return new ApiError(409, 'DUPLICATE', 'Dữ liệu đã tồn tại.');
      if (code === '23514' || code === '22P02' || code === '22023') return new ApiError(400, 'INVALID_INPUT', 'Dữ liệu gửi lên không hợp lệ.');
      if (!httpStatus || error.name === 'TypeError' || /fetch|network/i.test(error.message || '')) return new ApiError(0, 'NETWORK', FRIENDLY[0]);
      return new ApiError(httpStatus >= 400 ? httpStatus : 500, code || 'SERVER_ERROR', error.message || FRIENDLY[500]);
    }

    async function rpc(fn, args = {}) {
      const client = await clientPromise;
      const { data, error, status } = await client.rpc(fn, args);
      if (error) throw toApiError(error, status);
      return data;
    }

    const authError = error => {
      const msg = String(error?.message || '');
      if (/invalid login credentials/i.test(msg)) return new ApiError(400, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
      if (/already registered|already exists/i.test(msg)) return new ApiError(409, 'EMAIL_TAKEN', 'Email này đã có tài khoản. Hãy đăng nhập.');
      if (/password/i.test(msg)) return new ApiError(400, 'WEAK_PASSWORD', 'Mật khẩu cần ít nhất 6 ký tự.');
      if (/email not confirmed/i.test(msg)) return new ApiError(403, 'EMAIL_NOT_CONFIRMED', 'Bạn cần xác nhận email trước khi đăng nhập.');
      if (/rate limit/i.test(msg)) return new ApiError(429, 'RATE_LIMITED', FRIENDLY[429]);
      return error?.status ? new ApiError(error.status, 'AUTH_ERROR', msg) : new ApiError(0, 'NETWORK', FRIENDLY[0]);
    };
    const sessionOf = s => s?.user ? { user: { id: s.user.id, email: s.user.email } } : null;

    return {
      client: () => clientPromise,
      rpc,
      toApiError,
      auth: {
        async getSession() { const c = await clientPromise; const { data } = await c.auth.getSession(); return sessionOf(data.session); },
        async signUp({ email, password, name }) {
          const c = await clientPromise;
          const { data, error } = await c.auth.signUp({
            email, password,
            options: { data: { full_name: name || '' }, emailRedirectTo: location.origin + location.pathname.replace(/[^/]*$/, 'login.html') }
          });
          if (error) throw authError(error);
          return { session: sessionOf(data.session), needsConfirmation: !data.session };
        },
        async signIn({ email, password }) {
          const c = await clientPromise;
          const { data, error } = await c.auth.signInWithPassword({ email, password });
          if (error) throw authError(error);
          return sessionOf(data.session);
        },
        async signOut() { const c = await clientPromise; await c.auth.signOut(); },
        onChange(cb) { clientPromise.then(c => c.auth.onAuthStateChange((_e, s) => cb(sessionOf(s)))); }
      },
      async uploadImage(file, folder) {
        const store = await rpc('get_my_store');
        if (!store) fail(403, 'STORE_REQUIRED', 'Bạn cần đăng ký cửa hàng trước.');
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
        const path = `${store.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const c = await clientPromise;
        const { error } = await c.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new ApiError(Number(error.statusCode) || 400, 'UPLOAD_FAILED', 'Không tải được ảnh lên: ' + error.message);
        return path;
      },
      imageBase: CONFIG.supabaseUrl ? `${CONFIG.supabaseUrl}/storage/v1/object/public/${BUCKET}/` : ''
    };
  }

  /* ================================================================== MOCK (giả lập trên trình duyệt)
   * Làm theo đúng hợp đồng API ở trên để demo cũ vẫn chạy khi chưa có Supabase.
   * Dữ liệu nằm ở localStorage của MÁY NÀY nên không đồng bộ giữa 2 trình duyệt — đó là việc của Supabase. */
  function mockAdapter() {
    const DB_KEY = 'webuy_mock_api_v1';
    const SESSION_KEY = 'webuy_mock_api_v1_session';
    const listeners = [];
    const delay = () => sleep(120 + Math.random() * 120); // giả lập độ trễ mạng để thấy trạng thái "Đang tải"

    const slug = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const fold = t => slug(t).replace(/-/g, ' ');

    function seed() {
      const base = (window.WEBUY_PRODUCTS || []).filter(p => /^\d+$/.test(String(p.id)));
      const categories = [...new Set(base.map(p => p.category))].map((name, i) => ({ id: slug(name), name, sort: i }));
      return {
        users: [], profiles: {}, carts: {}, orders: [], notifications: [], holds: [], seq: 1,
        categories,
        stores: [{ id: 'store-webuy', ownerId: null, name: 'WeBuy Official', slug: 'webuy-official', description: '', phone: '', address: '', logo: null }],
        products: base.map(p => ({
          id: String(p.id), slug: `${slug(p.name)}-${p.id}`, storeId: 'store-webuy', categoryId: slug(p.category),
          name: p.name, description: p.description || '', retail: p.retail, group: p.group, minMembers: p.minMembers || 2,
          image: p.image, badge: p.badge || '', status: 'published', available: 50, held: 0, sold: 0,
          publishedAt: Date.now() - Number(p.id) * 1000, updatedAt: Date.now()
        }))
      };
    }
    const load = () => {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(DB_KEY)); } catch { d = null; /* dữ liệu hỏng: tạo lại */ }
      if (!d || !Array.isArray(d.products)) return seed();
      // Trang được mở trước khi có catalog-data.js: bổ sung sản phẩm/danh mục gốc còn thiếu
      const fresh = seed();
      for (const c of fresh.categories) if (!d.categories.some(x => x.id === c.id)) d.categories.push(c);
      for (const p of fresh.products) if (!d.products.some(x => x.id === p.id)) d.products.push(p);
      return d;
    };
    const save = db => localStorage.setItem(DB_KEY, JSON.stringify(db));
    const sessionUser = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.userId || null; } catch { return null; } };
    const emit = s => listeners.forEach(cb => { try { cb(s); } catch (e) { console.error(e); } });

    async function tx(fn) { await delay(); const db = load(); const out = fn(db); save(db); return out === undefined ? null : JSON.parse(JSON.stringify(out)); }
    const needUser = () => sessionUser() || fail(401, 'AUTH_REQUIRED', FRIENDLY[401]);
    const storeOf = (db, uid) => db.stores.find(s => s.ownerId === uid);
    const needSeller = (db, uid) => {
      if (!['seller', 'admin'].includes(db.profiles[uid]?.role)) fail(403, 'SELLER_ONLY', 'Chỉ người bán mới dùng được chức năng này.');
      return storeOf(db, uid) || fail(403, 'STORE_REQUIRED', 'Bạn cần đăng ký cửa hàng trước.');
    };
    const catName = (db, id) => db.categories.find(c => c.id === id)?.name || '';
    const productJson = (db, p) => {
      const s = db.stores.find(x => x.id === p.storeId) || {};
      return {
        id: p.id, slug: p.slug, name: p.name, description: p.description, price: p.retail, retail: p.retail, group: p.group,
        minMembers: p.minMembers, category: catName(db, p.categoryId), categoryId: p.categoryId, image: p.image, badge: p.badge,
        status: p.status, stock: { available: p.available, held: p.held, sold: p.sold }, inStock: p.available > 0,
        store: { id: s.id, name: s.name, slug: s.slug }, updatedAt: p.updatedAt
      };
    };
    const findCategory = (db, value) => db.categories.find(c => c.id === value || fold(c.name) === fold(value));
    const notify = (db, userId, eventId, type, title, body = '', link = null) => {
      if (!userId || db.notifications.some(n => n.userId === userId && n.eventId === eventId)) return;
      db.notifications.push({ id: db.seq++, userId, eventId, type, title, body, link, createdAt: new Date().toISOString(), read: false });
    };
    const phoneOk = p => p === '' || /^\+?[0-9]{9,12}$/.test(p);
    const cleanPhone = p => String(p || '').replace(/[\s.-]/g, '');

    async function hash(text) {
      if (!crypto.subtle) return 'plain:' + text;
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('webuy-mock:' + text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function releaseExpired(db) {
      const now = Date.now();
      for (const h of db.holds) {
        if (h.status === 'HELD' && h.expiresAt < now) {
          h.status = 'RELEASED';
          const p = db.products.find(x => x.id === h.productId);
          if (p) { p.held -= h.quantity; p.available += h.quantity; }
        }
      }
      for (const o of db.orders) {
        if (o.status === 'PENDING' && o.paymentExpiresAt < now) {
          o.status = 'CANCELLED'; o.cancelledAt = new Date().toISOString(); o.cancelReason = 'Hết hạn thanh toán';
          notify(db, o.userId, `order:${o.id}:CANCELLED`, 'order', `Đơn ${o.id} đã bị hủy`, o.cancelReason, `order-payment.html?id=${o.id}`);
        }
      }
    }
    const orderJson = o => ({ ...o, paymentExpiresAt: new Date(o.paymentExpiresAt).toISOString(), userId: undefined, requestId: undefined });
    const cartJson = (db, uid) => {
      const items = (db.carts[uid] || []).map(ci => {
        const p = db.products.find(x => x.id === ci.productId);
        if (!p) return null;
        const unit = ci.kind === 'group' ? p.group : p.retail;
        return { id: ci.id, productId: p.id, name: p.name, image: p.image, kind: ci.kind, groupId: ci.groupId, quantity: ci.quantity,
          unitPrice: unit, retail: p.retail, group: p.group, lineTotal: unit * ci.quantity,
          available: p.status === 'published' && p.available >= ci.quantity, stockAvailable: p.available, addedAt: ci.addedAt };
      }).filter(Boolean);
      return { items, count: items.reduce((s, i) => s + i.quantity, 0),
        subtotal: items.filter(i => db.products.find(p => p.id === i.productId).status === 'published').reduce((s, i) => s + i.lineTotal, 0) };
    };
    function setStatus(db, o, next) {
      const allowed = { DRAFT: ['PENDING', 'CANCELLED'], PENDING: ['PAID_DEMO', 'CANCELLED'], PAID_DEMO: ['REFUNDED_DEMO'] };
      if (!(allowed[o.status] || []).includes(next)) fail(409, 'INVALID_STATUS_CHANGE', `Không thể chuyển đơn từ ${o.status} sang ${next}.`);
      o.status = next;
      const titles = { PAID_DEMO: `Đơn ${o.id} đã thanh toán (mô phỏng)`, CANCELLED: `Đơn ${o.id} đã bị hủy`, REFUNDED_DEMO: `Đơn ${o.id} đã hoàn tiền (mô phỏng)` };
      notify(db, o.userId, `order:${o.id}:${next}`, 'order', titles[next], next === 'CANCELLED' ? (o.cancelReason || '') : '', `order-payment.html?id=${o.id}`);
    }
    const myOrder = (db, uid, id) => db.orders.find(o => o.id === id && o.userId === uid) || fail(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');

    const api = {
      async rpc(fn) { fail(404, 'RPC_NOT_FOUND', `Chế độ mock chưa hỗ trợ ${fn}.`); },
      auth: {
        async getSession() {
          const uid = sessionUser();
          const u = uid && load().users.find(x => x.id === uid);
          return u ? { user: { id: u.id, email: u.email } } : null;
        },
        async signUp({ email, password, name }) {
          email = String(email || '').trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'INVALID_EMAIL', 'Email không hợp lệ.');
          if (String(password || '').length < 6) fail(400, 'WEAK_PASSWORD', 'Mật khẩu cần ít nhất 6 ký tự.');
          const passHash = await hash(password);
          const user = await tx(db => {
            if (db.users.some(u => u.email === email)) fail(409, 'EMAIL_TAKEN', 'Email này đã có tài khoản. Hãy đăng nhập.');
            const u = { id: uuid(), email, passHash, createdAt: new Date().toISOString() };
            db.users.push(u);
            db.profiles[u.id] = { name: String(name || '').trim().slice(0, 80), phone: '', address: '', role: 'buyer' };
            return u;
          });
          localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
          const s = { user: { id: user.id, email } };
          emit(s);
          return { session: s, needsConfirmation: false };
        },
        async signIn({ email, password }) {
          email = String(email || '').trim().toLowerCase();
          const passHash = await hash(password);
          await delay();
          const u = load().users.find(x => x.email === email && x.passHash === passHash);
          if (!u) fail(400, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
          localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id }));
          const s = { user: { id: u.id, email: u.email } };
          emit(s);
          return s;
        },
        async signOut() { localStorage.removeItem(SESSION_KEY); emit(null); },
        onChange(cb) {
          listeners.push(cb);
          window.addEventListener('storage', e => { if (e.key === SESSION_KEY) api.auth.getSession().then(cb); });
        }
      },
      profile: {
        get: () => tx(db => {
          const uid = needUser();
          const p = db.profiles[uid] || fail(404, 'PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ.');
          return { id: uid, email: db.users.find(u => u.id === uid)?.email, ...p, storeId: storeOf(db, uid)?.id || null };
        }),
        update: ({ name, phone, address }) => tx(db => {
          const uid = needUser();
          phone = cleanPhone(phone);
          if (String(name || '').trim().length > 80) fail(400, 'INVALID_NAME', 'Họ tên tối đa 80 ký tự.');
          if (!phoneOk(phone)) fail(400, 'INVALID_PHONE', 'Số điện thoại không hợp lệ.');
          if (String(address || '').length > 200) fail(400, 'INVALID_ADDRESS', 'Địa chỉ tối đa 200 ký tự.');
          Object.assign(db.profiles[uid], { name: String(name || '').trim(), phone, address: String(address || '').trim() });
          return { id: uid, email: db.users.find(u => u.id === uid)?.email, ...db.profiles[uid], storeId: storeOf(db, uid)?.id || null };
        })
      },
      products: {
        search: ({ q, category, priceMin, priceMax, sort = 'newest', page = 1, pageSize = 12 } = {}) => tx(db => {
          if (q && String(q).length > 100) fail(400, 'INVALID_QUERY', 'Từ khóa tối đa 100 ký tự.');
          if (!['newest', 'price_asc', 'price_desc', 'name_asc', 'popular'].includes(sort)) fail(400, 'INVALID_SORT', 'Kiểu sắp xếp không hợp lệ.');
          if (!(page >= 1 && page <= 1000)) fail(400, 'INVALID_PAGE', 'Số trang không hợp lệ.');
          if (!(pageSize >= 1 && pageSize <= 48)) fail(400, 'INVALID_PAGE_SIZE', 'Mỗi trang có từ 1 đến 48 sản phẩm.');
          if (priceMin != null && priceMax != null && priceMin > priceMax) fail(400, 'INVALID_PRICE_RANGE', 'Giá thấp nhất phải nhỏ hơn hoặc bằng giá cao nhất.');
          const cat = category ? (findCategory(db, category) || fail(400, 'INVALID_CATEGORY', 'Danh mục không tồn tại.')) : null;
          const needle = q ? fold(q) : '';
          let list = db.products.filter(p => p.status === 'published'
            && (!cat || p.categoryId === cat.id)
            && (priceMin == null || p.retail >= priceMin) && (priceMax == null || p.retail <= priceMax)
            && (!needle || [p.name, catName(db, p.categoryId), p.description].some(t => fold(t).includes(needle))));
          const by = { price_asc: (a, b) => a.retail - b.retail, price_desc: (a, b) => b.retail - a.retail,
            name_asc: (a, b) => a.name.localeCompare(b.name, 'vi'), popular: (a, b) => b.sold - a.sold, newest: (a, b) => b.publishedAt - a.publishedAt };
          list = list.sort(by[sort]);
          const total = list.length;
          return { items: list.slice((page - 1) * pageSize, page * pageSize).map(p => productJson(db, p)), total, page, pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)) };
        }),
        get: id => tx(db => {
          const uid = sessionUser();
          const p = db.products.find(x => x.id === String(id) && (x.status === 'published' || x.storeId === storeOf(db, uid)?.id));
          return productJson(db, p || fail(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.'));
        }),
        categories: () => tx(db => db.categories.map(c => ({ id: c.id, name: c.name, count: db.products.filter(p => p.categoryId === c.id && p.status === 'published').length })))
      },
      seller: {
        register: ({ name, description = '', phone = '', address = '' }) => tx(db => {
          const uid = needUser();
          if (storeOf(db, uid)) fail(409, 'ALREADY_SELLER', 'Tài khoản này đã có cửa hàng.');
          name = String(name || '').trim(); phone = cleanPhone(phone);
          if (name.length < 2 || name.length > 80) fail(400, 'INVALID_STORE_NAME', 'Tên cửa hàng từ 2 đến 80 ký tự.');
          if (!phoneOk(phone)) fail(400, 'INVALID_PHONE', 'Số điện thoại không hợp lệ.');
          const s = { id: uuid(), ownerId: uid, name, slug: `${slug(name) || 'cua-hang'}-${uuid().slice(0, 6)}`, description, phone, address, logo: null, createdAt: new Date().toISOString() };
          db.stores.push(s);
          if (db.profiles[uid].role === 'buyer') db.profiles[uid].role = 'seller';
          notify(db, uid, `store-created:${s.id}`, 'seller', `Cửa hàng ${s.name} đã sẵn sàng`, 'Bạn có thể đăng sản phẩm đầu tiên trong Seller Center.', 'seller-center.html');
          return { ...s, ownerId: undefined };
        }),
        myStore: () => tx(db => { const s = storeOf(db, needUser()); return s ? { ...s, ownerId: undefined } : null; }),
        updateStore: ({ name, description = '', phone = '', address = '', logo = null }) => tx(db => {
          const s = needSeller(db, needUser());
          name = String(name || '').trim(); phone = cleanPhone(phone);
          if (name.length < 2 || name.length > 80) fail(400, 'INVALID_STORE_NAME', 'Tên cửa hàng từ 2 đến 80 ký tự.');
          if (!phoneOk(phone)) fail(400, 'INVALID_PHONE', 'Số điện thoại không hợp lệ.');
          Object.assign(s, { name, description, phone, address, logo: logo || s.logo });
          return { ...s, ownerId: undefined };
        }),
        dashboard: () => tx(db => {
          const s = needSeller(db, needUser());
          const mine = db.products.filter(p => p.storeId === s.id);
          const ids = new Set(mine.map(p => p.id));
          const orders = db.orders.filter(o => o.items.some(i => ids.has(i.productId)));
          return {
            products: { total: mine.length, ...Object.fromEntries(['published', 'draft', 'hidden'].map(st => [st, mine.filter(p => p.status === st).length])) },
            stock: { available: mine.reduce((a, p) => a + p.available, 0), held: mine.reduce((a, p) => a + p.held, 0), sold: mine.reduce((a, p) => a + p.sold, 0) },
            orders: { pending: orders.filter(o => o.status === 'PENDING').length, paidDemo: orders.filter(o => o.status === 'PAID_DEMO').length,
              revenueDemo: orders.filter(o => o.status === 'PAID_DEMO').flatMap(o => o.items).filter(i => ids.has(i.productId)).reduce((a, i) => a + i.lineTotal, 0) }
          };
        }),
        listProducts: () => tx(db => { const s = needSeller(db, needUser()); return db.products.filter(p => p.storeId === s.id).sort((a, b) => b.updatedAt - a.updatedAt).map(p => productJson(db, p)); }),
        saveProduct: data => tx(db => {
          const s = needSeller(db, needUser());
          const name = String(data.name || '').trim();
          const retail = Number(data.retail), group = Number(data.group), minMembers = Number(data.minMembers), stock = Number(data.stock);
          if (name.length < 2 || name.length > 120) fail(400, 'INVALID_NAME', 'Tên sản phẩm từ 2 đến 120 ký tự.');
          if (!(Number.isInteger(retail) && retail > 0)) fail(400, 'INVALID_RETAIL_PRICE', 'Giá mua lẻ phải lớn hơn 0.');
          if (!(Number.isInteger(group) && group > 0)) fail(400, 'INVALID_GROUP_PRICE', 'Giá mua chung phải lớn hơn 0.');
          if (group > retail) fail(400, 'GROUP_PRICE_TOO_HIGH', 'Giá mua chung không được cao hơn giá mua lẻ.');
          if (!(Number.isInteger(minMembers) && minMembers >= 2 && minMembers <= 50)) fail(400, 'INVALID_MIN_MEMBERS', 'Số người tối thiểu từ 2 đến 50.');
          if (!(Number.isInteger(stock) && stock >= 0 && stock <= 100000)) fail(400, 'INVALID_STOCK', 'Tồn kho từ 0 đến 100.000.');
          const cat = findCategory(db, data.category) || fail(400, 'INVALID_CATEGORY', 'Danh mục không tồn tại.');
          if (data.image && !String(data.image).startsWith(`${s.id}/products/`) && !String(data.image).startsWith('data:image/')) {
            fail(400, 'INVALID_IMAGE_PATH', 'Ảnh phải được tải lên thư mục của cửa hàng bạn.');
          }
          const status = data.status || 'draft';
          let p;
          if (data.id) {
            p = db.products.find(x => x.id === data.id) || fail(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
            if (p.storeId !== s.id) fail(403, 'NOT_PRODUCT_OWNER', 'Bạn không có quyền sửa sản phẩm này.');
          } else {
            p = { id: 's' + uuid().replace(/-/g, '').slice(0, 11), slug: '', storeId: s.id, held: 0, sold: 0, badge: '', publishedAt: null };
            db.products.push(p);
          }
          Object.assign(p, { name, categoryId: cat.id, description: String(data.description || '').trim(), retail, group, minMembers,
            image: data.image || p.image || null, status, available: stock, updatedAt: Date.now(),
            slug: p.slug || `${slug(name) || 'san-pham'}-${uuid().slice(0, 6)}`, publishedAt: p.publishedAt || (status === 'published' ? Date.now() : null) });
          return productJson(db, p);
        }),
        setStatus: (id, status) => tx(db => {
          const s = needSeller(db, needUser());
          if (!['draft', 'published', 'hidden'].includes(status)) fail(400, 'INVALID_STATUS', 'Trạng thái không hợp lệ.');
          const p = db.products.find(x => x.id === id) || fail(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
          if (p.storeId !== s.id) fail(403, 'NOT_PRODUCT_OWNER', 'Bạn không có quyền sửa sản phẩm này.');
          p.status = status; p.updatedAt = Date.now(); if (status === 'published' && !p.publishedAt) p.publishedAt = Date.now();
          return productJson(db, p);
        }),
        async uploadImage(file) {
          // Bản mock không có Storage: đọc ảnh thành data URL để xem trước
          return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => reject(new ApiError(400, 'UPLOAD_FAILED', 'Không đọc được ảnh.'));
            r.readAsDataURL(file);
          });
        }
      },
      stock: {
        hold: (productId, quantity = 1, minutes = 10) => tx(db => {
          const uid = needUser();
          if (!(quantity >= 1 && quantity <= 20)) fail(400, 'INVALID_QUANTITY', 'Số lượng giữ từ 1 đến 20.');
          releaseExpired(db);
          const p = db.products.find(x => x.id === productId && x.status === 'published') || fail(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng bán.');
          if (p.available < quantity) fail(409, 'OUT_OF_STOCK', `Sản phẩm "${p.name}" không còn đủ hàng.`);
          p.available -= quantity; p.held += quantity;
          const h = { id: uuid(), productId, userId: uid, orderId: null, quantity, status: 'HELD', expiresAt: Date.now() + minutes * 60000 };
          db.holds.push(h);
          return { id: h.id, productId, quantity, status: h.status, expiresAt: new Date(h.expiresAt).toISOString() };
        }),
        release: holdId => tx(db => {
          const uid = needUser();
          const h = db.holds.find(x => x.id === holdId && x.userId === uid) || fail(404, 'HOLD_NOT_FOUND', 'Không tìm thấy lượt giữ hàng.');
          if (h.status !== 'HELD') return { released: false };
          h.status = 'RELEASED';
          const p = db.products.find(x => x.id === h.productId); p.held -= h.quantity; p.available += h.quantity;
          return { released: true };
        })
      },
      cart: {
        get: () => tx(db => cartJson(db, needUser())),
        add: (productId, kind = 'retail', quantity = 1, groupId = null) => tx(db => {
          const uid = needUser();
          if (!(quantity >= 1 && quantity <= 99)) fail(400, 'INVALID_QUANTITY', 'Số lượng từ 1 đến 99.');
          if (kind === 'group' && !groupId) fail(400, 'GROUP_REQUIRED', 'Mua chung cần chọn nhóm.');
          if (!db.products.some(p => p.id === productId && p.status === 'published')) fail(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng bán.');
          const cart = db.carts[uid] = db.carts[uid] || [];
          const g = kind === 'group' ? groupId : null;
          const line = cart.find(i => i.productId === productId && i.kind === kind && i.groupId === g);
          if (line) line.quantity = Math.min(99, line.quantity + quantity);
          else { if (cart.length >= 50) fail(409, 'CART_FULL', 'Giỏ hàng tối đa 50 dòng sản phẩm.'); cart.push({ id: uuid(), productId, kind, groupId: g, quantity, addedAt: new Date().toISOString() }); }
          return cartJson(db, uid);
        }),
        setQuantity: (itemId, quantity) => tx(db => {
          const uid = needUser();
          if (!(quantity >= 0 && quantity <= 99)) fail(400, 'INVALID_QUANTITY', 'Số lượng từ 0 đến 99.');
          const cart = db.carts[uid] || [];
          const line = cart.find(i => i.id === itemId) || fail(404, 'CART_ITEM_NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ.');
          if (quantity === 0) cart.splice(cart.indexOf(line), 1); else line.quantity = quantity;
          return cartJson(db, uid);
        }),
        remove: itemId => api.cart.setQuantity(itemId, 0),
        merge: items => tx(db => {
          const uid = needUser();
          if (!Array.isArray(items)) fail(400, 'INVALID_ITEMS', 'Dữ liệu giỏ hàng không hợp lệ.');
          const cart = db.carts[uid] = db.carts[uid] || [];
          let skipped = 0;
          for (const it of items.slice(0, 50)) {
            const kind = it.kind === 'group' ? 'group' : 'retail';
            const g = kind === 'group' ? (it.groupId || null) : null;
            const q = Math.min(99, Math.max(1, parseInt(it.quantity, 10) || 1));
            if ((kind === 'group' && !g) || !db.products.some(p => p.id === String(it.productId) && p.status === 'published')) { skipped++; continue; }
            const line = cart.find(i => i.productId === String(it.productId) && i.kind === kind && i.groupId === g);
            if (line) line.quantity = Math.max(line.quantity, q);
            else cart.push({ id: uuid(), productId: String(it.productId), kind, groupId: g, quantity: q, addedAt: new Date().toISOString() });
          }
          return { ...cartJson(db, uid), skipped };
        })
      },
      orders: {
        place: (itemIds, shipping, requestId) => tx(db => {
          const uid = needUser();
          if (!requestId) fail(400, 'REQUEST_ID_REQUIRED', 'Thiếu mã yêu cầu đặt hàng.');
          const existing = db.orders.find(o => o.userId === uid && o.requestId === requestId);
          if (existing) return { ...orderJson(existing), replayed: true };
          const name = String(shipping?.name || '').trim(), phone = cleanPhone(shipping?.phone), address = String(shipping?.address || '').trim();
          if (name.length < 2) fail(400, 'INVALID_NAME', 'Vui lòng nhập họ tên người nhận.');
          if (!/^\+?[0-9]{9,12}$/.test(phone)) fail(400, 'INVALID_PHONE', 'Số điện thoại người nhận không hợp lệ.');
          if (address.length < 5) fail(400, 'INVALID_ADDRESS', 'Vui lòng nhập địa chỉ nhận hàng.');
          if (!Array.isArray(itemIds) || !itemIds.length) fail(400, 'EMPTY_ORDER', 'Hãy chọn ít nhất 1 sản phẩm.');
          releaseExpired(db);
          const cart = db.carts[uid] || [];
          const lines = itemIds.map(id => cart.find(i => i.id === id));
          if (lines.some(l => !l)) fail(400, 'INVALID_CART_ITEMS', 'Có sản phẩm không nằm trong giỏ hàng của bạn.');
          for (const l of lines) {
            const p = db.products.find(x => x.id === l.productId && x.status === 'published') || fail(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng bán.');
            if (p.available < l.quantity) fail(409, 'OUT_OF_STOCK', `Sản phẩm "${p.name}" không còn đủ hàng.`);
          }
          const id = 'WB' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + uuid().replace(/-/g, '').slice(0, 6).toUpperCase();
          const expires = Date.now() + 15 * 60000;
          const items = lines.map(l => {
            const p = db.products.find(x => x.id === l.productId);
            p.available -= l.quantity; p.held += l.quantity;
            db.holds.push({ id: uuid(), productId: p.id, userId: uid, orderId: id, quantity: l.quantity, status: 'HELD', expiresAt: expires });
            const unit = l.kind === 'group' ? p.group : p.retail;
            return { productId: p.id, name: p.name, image: p.image, kind: l.kind, groupId: l.groupId, quantity: l.quantity,
              unitPrice: unit, retailPrice: p.retail, groupPrice: p.group, lineTotal: unit * l.quantity };
          });
          const subtotal = items.reduce((a, i) => a + i.lineTotal, 0);
          const o = { id, userId: uid, requestId, status: 'PENDING', subtotal, discount: 0, total: subtotal, shipping: { name, phone, address },
            createdAt: new Date().toISOString(), paymentExpiresAt: expires, paidAt: null, cancelledAt: null, refundedAt: null, cancelReason: null, items };
          db.orders.push(o);
          db.carts[uid] = cart.filter(i => !itemIds.includes(i.id));
          notify(db, uid, `order:${id}:PENDING`, 'order', `Đã tạo đơn ${id}`, 'Hoàn tất thanh toán mô phỏng trong 15 phút để giữ hàng.', `order-payment.html?id=${id}`);
          return orderJson(o);
        }),
        get: id => tx(db => { releaseExpired(db); return orderJson(myOrder(db, needUser(), id)); }),
        list: (limit = 20) => tx(db => { const uid = needUser(); releaseExpired(db); return db.orders.filter(o => o.userId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(orderJson); }),
        payDemo: id => tx(db => {
          releaseExpired(db);
          const o = myOrder(db, needUser(), id);
          if (o.status === 'PAID_DEMO') return orderJson(o);
          if (o.status !== 'PENDING') fail(409, 'ORDER_NOT_PAYABLE', `Đơn ở trạng thái ${o.status} nên không thể thanh toán.`);
          for (const h of db.holds.filter(x => x.orderId === id && x.status === 'HELD')) {
            h.status = 'CONSUMED'; const p = db.products.find(x => x.id === h.productId); p.held -= h.quantity; p.sold += h.quantity;
          }
          o.paidAt = new Date().toISOString();
          setStatus(db, o, 'PAID_DEMO');
          return orderJson(o);
        }),
        cancel: (id, reason) => tx(db => {
          const o = myOrder(db, needUser(), id);
          if (o.status === 'CANCELLED') return orderJson(o);
          if (!['DRAFT', 'PENDING'].includes(o.status)) fail(409, 'ORDER_NOT_CANCELLABLE', 'Đơn đã thanh toán, hãy dùng hoàn tiền mô phỏng.');
          for (const h of db.holds.filter(x => x.orderId === id && x.status === 'HELD')) {
            h.status = 'RELEASED'; const p = db.products.find(x => x.id === h.productId); p.held -= h.quantity; p.available += h.quantity;
          }
          o.cancelledAt = new Date().toISOString(); o.cancelReason = String(reason || '').trim() || 'Người mua hủy';
          setStatus(db, o, 'CANCELLED');
          return orderJson(o);
        }),
        refundDemo: id => tx(db => {
          const o = myOrder(db, needUser(), id);
          if (o.status === 'REFUNDED_DEMO') return orderJson(o);
          if (o.status !== 'PAID_DEMO') fail(409, 'ORDER_NOT_REFUNDABLE', 'Chỉ hoàn tiền được đơn đã thanh toán mô phỏng.');
          for (const i of o.items) { const p = db.products.find(x => x.id === i.productId); if (p) { p.sold = Math.max(0, p.sold - i.quantity); p.available += i.quantity; } }
          o.refundedAt = new Date().toISOString();
          setStatus(db, o, 'REFUNDED_DEMO');
          return orderJson(o);
        })
      },
      notifications: {
        list: (limit = 20) => tx(db => {
          const uid = needUser();
          const mine = db.notifications.filter(n => n.userId === uid).sort((a, b) => b.id - a.id);
          return { unread: mine.filter(n => !n.read).length, items: mine.slice(0, limit).map(n => ({ ...n, userId: undefined, eventId: undefined })) };
        }),
        markRead: ids => tx(db => {
          const uid = needUser();
          db.notifications.filter(n => n.userId === uid && (!ids || ids.includes(n.id))).forEach(n => { n.read = true; });
          const mine = db.notifications.filter(n => n.userId === uid).sort((a, b) => b.id - a.id);
          return { unread: mine.filter(n => !n.read).length, items: mine.slice(0, 20).map(n => ({ ...n, userId: undefined, eventId: undefined })) };
        })
      },
      async log() { /* mock: chỉ in ra Console */ },
      imageBase: '',
      resetMock() { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); emit(null); }
    };
    return api;
  }

  /* ================================================================== Ghép thành WeBuyAPI */
  const isMock = MODE !== 'supabase';
  const impl = isMock ? mockAdapter() : supabaseAdapter();
  const R = (fn, args) => impl.rpc(fn, args);

  function report(endpoint, err) {
    console.error(`[WeBuyAPI] ${endpoint}:`, err);
    if (isMock || err.status === 0) return;
    R('log_client_error', { p_endpoint: endpoint, p_status: err.status, p_code: err.code, p_message: err.message,
      p_context: { page: location.pathname.split('/').pop() } }).catch(() => {});
  }

  // Mỗi hàm: nếu là mock thì gọi bản giả lập, nếu là supabase thì gọi RPC tương ứng trong migration
  const call = (name, mockFn, rpcName, args, opts) => run(name, () => (isMock ? mockFn() : R(rpcName, args)), opts);

  const WeBuyAPI = {
    mode: isMock ? 'mock' : 'supabase',
    ApiError,
    newRequestId: uuid,

    imageUrl(path) {
      if (!path) return 'images/logo-mark.png';
      if (/^(images\/|https?:|data:image\/)/.test(path)) return path;
      return impl.imageBase + path;
    },

    auth: {
      getSession: () => run('auth.getSession', () => impl.auth.getSession(), { retry: true }),
      signUp: data => run('auth.signUp', () => impl.auth.signUp(data)),
      signIn: data => run('auth.signIn', () => impl.auth.signIn(data)),
      signOut: () => run('auth.signOut', () => impl.auth.signOut()),
      onChange: cb => impl.auth.onChange(cb)
    },

    profile: {
      get: () => call('profile.get', () => impl.profile.get(), 'get_my_profile', {}, { retry: true }),
      update: d => call('profile.update', () => impl.profile.update(d), 'update_my_profile', { p_name: d.name, p_phone: d.phone, p_address: d.address })
    },

    products: {
      search: (p = {}) => call('products.search', () => impl.products.search(p), 'search_products', {
        p_q: p.q || null, p_category: p.category || null, p_price_min: p.priceMin ?? null, p_price_max: p.priceMax ?? null,
        p_sort: p.sort || 'newest', p_page: p.page || 1, p_page_size: p.pageSize || 12 }, { retry: true }),
      get: id => call('products.get', () => impl.products.get(id), 'get_product', { p_id: String(id) }, { retry: true }),
      categories: () => call('products.categories', () => impl.products.categories(), 'list_categories', {}, { retry: true })
    },

    seller: {
      register: d => call('seller.register', () => impl.seller.register(d), 'register_seller', { p_name: d.name, p_description: d.description || '', p_phone: d.phone || '', p_address: d.address || '' }),
      myStore: () => call('seller.myStore', () => impl.seller.myStore(), 'get_my_store', {}, { retry: true }),
      updateStore: d => call('seller.updateStore', () => impl.seller.updateStore(d), 'update_my_store', { p_name: d.name, p_description: d.description || '', p_phone: d.phone || '', p_address: d.address || '', p_logo_path: d.logo || null }),
      dashboard: () => call('seller.dashboard', () => impl.seller.dashboard(), 'seller_dashboard', {}, { retry: true }),
      listProducts: () => call('seller.listProducts', () => impl.seller.listProducts(), 'seller_list_products', {}, { retry: true }),
      saveProduct: d => call('seller.saveProduct', () => impl.seller.saveProduct(d), 'seller_save_product', {
        p_id: d.id || null, p_name: d.name, p_category: d.category, p_description: d.description || '', p_retail_price: Number(d.retail),
        p_group_price: Number(d.group), p_min_members: Number(d.minMembers), p_stock: Number(d.stock), p_image_path: d.image || null, p_status: d.status || 'draft' }),
      setStatus: (id, status) => call('seller.setStatus', () => impl.seller.setStatus(id, status), 'seller_set_product_status', { p_id: id, p_status: status }),
      // Kiểm tra trước ở trình duyệt cho nhanh; Storage trên server kiểm tra lại (2 MB, JPG/PNG/WebP, đúng thư mục cửa hàng)
      uploadImage(file, folder = 'products') {
        if (!(file instanceof Blob)) return Promise.reject(new ApiError(400, 'NO_FILE', 'Hãy chọn một ảnh.'));
        if (!IMAGE_TYPES.includes(file.type)) return Promise.reject(new ApiError(400, 'INVALID_IMAGE_TYPE', 'Chỉ nhận ảnh JPG, PNG hoặc WebP.'));
        if (file.size > IMAGE_MAX_BYTES) return Promise.reject(new ApiError(400, 'IMAGE_TOO_LARGE', 'Ảnh tối đa 2 MB.'));
        if (!['products', 'logo'].includes(folder)) return Promise.reject(new ApiError(400, 'INVALID_FOLDER', 'Thư mục ảnh không hợp lệ.'));
        return run('seller.uploadImage', () => (isMock ? impl.seller.uploadImage(file) : impl.uploadImage(file, folder)));
      }
    },

    stock: {
      hold: (productId, quantity = 1, minutes = 10) => call('stock.hold', () => impl.stock.hold(String(productId), quantity, minutes), 'hold_stock', { p_product_id: String(productId), p_quantity: quantity, p_minutes: minutes }),
      release: holdId => call('stock.release', () => impl.stock.release(holdId), 'release_stock_hold', { p_hold_id: holdId })
    },

    cart: {
      get: () => call('cart.get', () => impl.cart.get(), 'get_cart', {}, { retry: true }),
      add: (productId, kind = 'retail', quantity = 1, groupId = null) => call('cart.add', () => impl.cart.add(String(productId), kind, quantity, groupId), 'add_to_cart', { p_product_id: String(productId), p_kind: kind, p_quantity: quantity, p_group_ref: groupId }),
      setQuantity: (itemId, quantity) => call('cart.setQuantity', () => impl.cart.setQuantity(itemId, quantity), 'set_cart_item_quantity', { p_item_id: itemId, p_quantity: quantity }),
      remove: itemId => call('cart.remove', () => impl.cart.remove(itemId), 'remove_cart_item', { p_item_id: itemId }),
      // Gộp giỏ localStorage cũ khi đăng nhập. Gọi lại nhiều lần không bị nhân đôi số lượng.
      merge: items => call('cart.merge', () => impl.cart.merge(items), 'merge_cart', { p_items: items }, { retry: true })
    },

    orders: {
      // requestId: tạo 1 lần cho mỗi lần bấm "Xác nhận" (WeBuyAPI.newRequestId()) và giữ nguyên khi thử lại
      place: (itemIds, shipping, requestId) => call('orders.place', () => impl.orders.place(itemIds, shipping, requestId), 'place_order', { p_cart_item_ids: itemIds, p_shipping: shipping, p_client_request_id: requestId }, { retry: true }),
      get: id => call('orders.get', () => impl.orders.get(id), 'get_order', { p_order_id: id }, { retry: true }),
      list: (limit = 20) => call('orders.list', () => impl.orders.list(limit), 'list_my_orders', { p_limit: limit }, { retry: true }),
      payDemo: id => call('orders.payDemo', () => impl.orders.payDemo(id), 'pay_order_demo', { p_order_id: id }, { retry: true }),
      cancel: (id, reason) => call('orders.cancel', () => impl.orders.cancel(id, reason), 'cancel_order', { p_order_id: id, p_reason: reason || null }, { retry: true }),
      refundDemo: id => call('orders.refundDemo', () => impl.orders.refundDemo(id), 'refund_order_demo', { p_order_id: id }, { retry: true })
    },

    notifications: {
      list: (limit = 20) => call('notifications.list', () => impl.notifications.list(limit), 'get_notifications', { p_limit: limit }, { retry: true }),
      markRead: (ids = null) => call('notifications.markRead', () => impl.notifications.markRead(ids), 'mark_notifications_read', { p_ids: ids })
    },

    ui: {
      errorMessage,
      // Khóa nút trong lúc chờ để tránh bấm 2 lần, hiện "Đang xử lý…", trả nút về như cũ khi xong
      async withLoading(button, task, busyText = 'Đang xử lý…') {
        const old = button ? button.innerHTML : '';
        if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = busyText; }
        try { return await task(); }
        finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); button.innerHTML = old; } }
      }
    }
  };

  if (isMock) WeBuyAPI.resetMock = impl.resetMock;
  else WeBuyAPI._toApiError = impl.toApiError; // để kiểm thử cách đổi lỗi
  window.WeBuyAPI = WeBuyAPI;
})();
