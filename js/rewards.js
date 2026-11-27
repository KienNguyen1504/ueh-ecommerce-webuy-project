/* WeBuy | Tính năng 11 - Popup điểm danh, trò chơi và Xu WeBuy.
 *
 * File này tự chèn nút nổi "Điểm danh săn quà", chip xu trên Header và popup Xu WeBuy
 * vào mọi trang có nạp nó. Dữ liệu lưu bằng localStorage (bản demo, không có máy chủ).
 *
 * Bố cục file:
 *   1. Cấu hình            - các con số của thể lệ, đổi ở đây là đổi toàn bộ
 *   2. Lưu trữ             - đọc/ghi trạng thái xu vào localStorage
 *   3. Ngày tháng          - xác định "hôm nay", đếm số ngày cách nhau
 *   4. Nghiệp vụ xu        - cộng/trừ xu, điểm danh, lượt chơi
 *   5. Giao diện chung     - thông báo, chip xu, nút nổi
 *   6. Popup               - trang chính, màn Chúc mừng, Thể lệ
 *   7. Trò chơi            - Gom nhóm 15 giây
 *   7b. Trò chơi           - Vịt bay săn xu (kiểu Flappy Bird)
 *   8. Trang Hồ sơ         - khối "Xu của tôi"
 *   9. Trang Thanh toán    - dùng xu trừ tiền đơn hàng
 *  10. Khởi động
 *
 * Cần nạp js/rewards-art.js (hình vẽ) trước file này.
 */
(() => {
  'use strict';

  const Art = window.WeBuyArt;
  if (!Art) { console.warn('WeBuy xu: chưa nạp js/rewards-art.js'); return; }

  /* ===================================================================
   * 1. CẤU HÌNH
   * =================================================================== */
  const STORAGE_PREFIX = 'webuy_demo_v2_';            // cùng tiền tố với js/app.js
  const STORAGE_KEY = STORAGE_PREFIX + 'rewards';
  const FAB_HIDDEN_KEY = 'webuy_rewards_fab_hidden';  // lưu ở sessionStorage: ẩn nút nổi đến hết phiên

  const CHECKIN_REWARDS = [10, 10, 15, 15, 20, 20, 50]; // xu của Ngày 1..7, tổng 140 xu

  const GAME = {
    seconds: 15,     // thời gian một lượt chơi
    groupSize: 3,    // đủ 3 bạn thì chốt một nhóm
    xuPerGroup: 5,   // mỗi nhóm chốt được 5 xu
    minXu: 5,        // thưởng tối thiểu mỗi lượt
    maxXu: 30,       // thưởng tối đa mỗi lượt
    buddies: 5,      // số bạn mua chung cùng xuất hiện trên sân
    buddySize: 64    // kích thước nhân vật (px)
  };

  // Trò chơi "Vịt bay săn xu": chú vịt bay qua các kệ hàng, qua mỗi kệ được xu
  const FLY = {
    xuPerShelf: 2,   // qua mỗi cặp kệ hàng được 2 xu
    minXu: 5,        // thưởng an ủi khi chưa qua kệ nào
    maxXu: 30,       // thưởng tối đa mỗi lượt (qua 15 kệ là đạt)
    gap: 150,        // khoảng trống giữa kệ trên và kệ dưới (px)
    shelfWidth: 58,  // độ rộng một kệ (px)
    spacing: 210,    // khoảng cách giữa hai cặp kệ liên tiếp (px)
    speed: 150,      // tốc độ chạy ngang lúc đầu (px mỗi giây), tăng dần theo số kệ đã qua
    gravity: 1500,   // gia tốc rơi (px/giây²)
    flap: -430,      // vận tốc bay lên mỗi lần chạm (px/giây)
    maxFall: 560,    // tốc độ rơi tối đa (px/giây)
    duckSize: 46     // kích thước chú vịt (px)
  };

  const XU_VALUE = 100;            // 1 xu = 100đ
  const MAX_DISCOUNT_PERCENT = 10; // mỗi đơn dùng xu tối đa 10% tiền hàng
  const MIN_XU_USE = 10;           // mỗi đơn dùng ít nhất 10 xu
  const HISTORY_LIMIT = 100;       // chỉ giữ 100 dòng lịch sử gần nhất

  // Popup xu chỉ tự mở khi không có popup nào khác đang hiện (ví dụ Popup địa điểm).
  // Nếu popup khác dùng tên lớp riêng, thêm bộ chọn của nó vào đây.
  const OTHER_POPUP_SELECTOR = 'dialog[open], [role="dialog"], [aria-modal="true"], .app-modal-backdrop';

  const page = location.pathname.split('/').pop() || 'index.html';
  const money = n => new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===================================================================
   * 2. LƯU TRỮ
   * =================================================================== */
  function defaultState() {
    return {
      balance: 0,         // số xu hiện có
      streakDay: 0,       // ngày trong chuỗi của lần điểm danh gần nhất (0 = chưa điểm danh)
      lastCheckin: null,  // ngày điểm danh gần nhất, dạng 'YYYY-MM-DD'
      playDate: null,     // ngày đang đếm lượt chơi
      playsUsed: 0,       // số lượt đã chơi trong ngày playDate
      flyDate: null,      // ngày đang đếm lượt chơi Vịt bay
      flyUsed: 0,         // số lượt Vịt bay đã chơi trong ngày flyDate
      flyBest: 0,         // số kệ nhiều nhất từng bay qua
      bonusDate: null,    // ngày được tặng lượt chơi thưởng
      groupCount: null,   // số nhóm mua đã tham gia ở lần kiểm tra trước
      autoShown: null,    // ngày popup đã tự mở
      history: []         // [{ time, note, amount, balance }]
    };
  }

  // Đọc trạng thái và kiểm tra định dạng, tránh lỗi khi dữ liệu trong localStorage bị sai
  function loadState() {
    const base = defaultState();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { saved = null; }
    if (!saved || typeof saved !== 'object') return base;

    const state = { ...base, ...saved };
    if (!Number.isInteger(state.balance) || state.balance < 0) state.balance = 0;
    if (!Number.isInteger(state.streakDay) || state.streakDay < 0 || state.streakDay > 7) state.streakDay = 0;
    if (!Number.isInteger(state.playsUsed) || state.playsUsed < 0) state.playsUsed = 0;
    if (!Number.isInteger(state.flyUsed) || state.flyUsed < 0) state.flyUsed = 0;
    if (!Number.isInteger(state.flyBest) || state.flyBest < 0) state.flyBest = 0;
    if (!Array.isArray(state.history)) state.history = [];
    return state;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { console.warn('WeBuy xu: không thể lưu dữ liệu trên trình duyệt hiện tại.'); }
  }

  let state = loadState();

  /* ===================================================================
   * 3. NGÀY THÁNG
   * =================================================================== */
  let fakeToday = null; // chỉ dùng khi kiểm thử: giả lập một ngày khác (xem debugSetToday)

  // Đổi Date thành chuỗi 'YYYY-MM-DD' theo giờ của thiết bị
  function dateKey(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
  }

  function today() { return fakeToday || dateKey(new Date()); }

  // Số ngày từ a đến b (b sau a thì kết quả dương)
  function daysBetween(a, b) {
    const toNoon = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
    return Math.round((toNoon(b) - toNoon(a)) / 86400000);
  }

  /* ===================================================================
   * 4. NGHIỆP VỤ XU
   * =================================================================== */
  function addHistory(note, amount) {
    state.history.push({ time: Date.now(), note, amount, balance: state.balance });
    if (state.history.length > HISTORY_LIMIT) state.history = state.history.slice(-HISTORY_LIMIT);
  }

  function addXu(amount, note) {
    const latest = loadState();
    state.balance = latest.balance + amount;
    state.history = latest.history;
    addHistory(note, amount);
    saveState();
    refreshAll();
    document.dispatchEvent(new Event('webuy:wallet'));
  }

  // Trừ xu. Trả về false nếu không đủ xu (số dư không bao giờ âm).
  function spendXu(amount, note) {
    if (!Number.isInteger(amount) || amount <= 0 || amount > state.balance) return false;
    state.balance -= amount;
    addHistory(note, -amount);
    saveState();
    refreshAll();
    return true;
  }

  /* Tình trạng điểm danh của hôm nay.
   * - claimedToday: hôm nay đã điểm danh
   * - day: ngày trong chuỗi (1..7) sẽ nhận, hoặc đã nhận nếu claimedToday
   * - reward: số xu sẽ nhận
   * - broken: chuỗi vừa bị đứt vì bỏ lỡ ngày
   * - blocked: ngày trên thiết bị lùi về trước lần điểm danh gần nhất
   */
  function getCheckin() {
    const now = today();
    const last = state.lastCheckin;

    if (last === now) return { claimedToday: true, day: state.streakDay, reward: 0, broken: false, blocked: false };

    const gap = last ? daysBetween(last, now) : null;
    if (gap !== null && gap < 0) return { claimedToday: false, day: state.streakDay, reward: 0, broken: false, blocked: true };

    // Chỉ nối chuỗi khi hôm qua có điểm danh và chưa hết chu kỳ 7 ngày
    const keepStreak = gap === 1 && state.streakDay < 7;
    const day = keepStreak ? state.streakDay + 1 : 1;
    return { claimedToday: false, day, reward: CHECKIN_REWARDS[day - 1], broken: gap !== null && gap > 1, blocked: false };
  }

  function claimCheckin() {
    state = loadState();
    const info = getCheckin();
    if (info.claimedToday || info.blocked) return { ok: false, ...info };
    state.streakDay = info.day;
    state.lastCheckin = today();
    addXu(info.reward, `Điểm danh Ngày ${info.day}`);
    return { ok: true, ...info };
  }

  // Số xu của lần điểm danh kế tiếp (để nhắc "mai quay lại nhận ... xu")
  function nextReward(day) { return CHECKIN_REWARDS[day >= 7 ? 0 : day]; }

  /* Lượt chơi: mỗi ngày 1 lượt miễn phí, thêm 1 lượt thưởng khi tạo/tham gia nhóm mua */
  function playInfo() {
    const now = today();
    if (state.playDate > now || state.lastCheckin > now) return {used:0,total:0,left:0};
    const used = state.playDate === now ? state.playsUsed : 0;
    const total = 1 + (state.bonusDate === now ? 1 : 0);
    return { used, total, left: Math.max(0, total - used) };
  }

  function usePlay() {
    const now = today();
    if (state.playDate !== now) { state.playDate = now; state.playsUsed = 0; }
    state.playsUsed += 1;
    saveState();
  }

  /* Lượt chơi Vịt bay: đếm riêng với Gom nhóm, cũng 1 lượt miễn phí mỗi ngày
     và cũng được tặng thêm 1 lượt khi tạo/tham gia nhóm mua */
  function flyInfo() {
    const now = today();
    if (state.flyDate > now || state.lastCheckin > now) return {used:0,total:0,left:0};
    const used = state.flyDate === now ? state.flyUsed : 0;
    const total = 1 + (state.bonusDate === now ? 1 : 0);
    return { used, total, left: Math.max(0, total - used) };
  }

  function useFly() {
    const now = today();
    if (state.flyDate !== now) { state.flyDate = now; state.flyUsed = 0; }
    state.flyUsed += 1;
    saveState();
  }

  // Đếm số nhóm mua người dùng đang tham gia, đọc từ dữ liệu js/app.js đã lưu sẵn
  function countMyGroups() {
    try {
      const uid = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'uid'));
      const groups = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'groups')) || [];
      return groups.filter(g => Array.isArray(g.members) && g.members.includes(uid)).length;
    } catch { return 0; }
  }

  // Nếu số nhóm tăng so với lần kiểm tra trước thì tặng 1 lượt chơi (tối đa 1 lượt thưởng mỗi ngày)
  function checkBonusPlay() {
    const count = countMyGroups();
    if (state.groupCount === null) { state.groupCount = count; saveState(); return; }
    if (count === state.groupCount) return;

    if (count > state.groupCount && state.bonusDate !== today()) {
      state.bonusDate = today();
      toast('Bạn vừa vào nhóm mua: tặng thêm 1 lượt Gom nhóm và 1 lượt Vịt bay hôm nay!');
    }
    state.groupCount = count;
    saveState();
    refreshAll();
  }

  // Số xu tối đa dùng được cho một đơn có tiền hàng là total (đồng)
  function maxXuForOrder(total) {
    const cap = Math.floor(total * MAX_DISCOUNT_PERCENT / 100 / XU_VALUE);
    const usable = Math.min(state.balance, cap);
    return usable >= MIN_XU_USE ? usable : 0;
  }

  /* ===================================================================
   * 5. GIAO DIỆN CHUNG
   * =================================================================== */
  const ICON_CLOSE = '<svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13"/></svg>';
  const ICON_BACK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2L4 8l6 6"/></svg>';
  const ICON_CLOCK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>';

  // Thông báo nhỏ, dùng lại khung #app-toast có sẵn của website
  let toastTimer;
  function toast(message) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'app-toast show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
  }

  // Còn phần thưởng chưa nhận trong hôm nay hay không (để hiện chấm báo)
  function hasPending() {
    const c = getCheckin();
    return (!c.claimedToday && !c.blocked) || playInfo().left > 0 || flyInfo().left > 0;
  }

  /* Chip xu trên Header, đặt trước nút giỏ hàng */
  function mountChip() {
    document.querySelectorAll('.header-actions').forEach(actions => {
      if (actions.querySelector('.wbr-chip')) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'wbr-chip';
      chip.dataset.wbrOpen = '';
      chip.innerHTML = `${Art.coin(26)}<span data-wbr-chip-text></span>`;
      actions.insertBefore(chip, actions.querySelector('.header-cart'));
    });
  }

  /* Nút nổi "Điểm danh săn quà" ở góc dưới phải */
  function mountFab() {
    if (page === 'checkout.html') return;                      // không làm phiền lúc thanh toán
    if (sessionStorage.getItem(FAB_HIDDEN_KEY) === '1') return; // người dùng đã bấm × trong phiên này
    if (document.querySelector('.wbr-fab')) return;

    const fab = document.createElement('div');
    fab.className = 'wbr-fab';
    fab.innerHTML = `
      <button type="button" class="wbr-fab-main" data-wbr-open aria-label="Điểm danh săn quà">${Art.duck(150)}</button>
      <span class="wbr-fab-dot" data-wbr-dot aria-hidden="true"></span>
      <button type="button" class="wbr-fab-close" data-wbr-hide-fab aria-label="Ẩn nút điểm danh">${ICON_CLOSE}</button>`;
    document.body.appendChild(fab);
    document.body.classList.add('wbr-has-fab'); // để CSS đẩy thông báo lên trên nút nổi
  }

  function hideFab() {
    sessionStorage.setItem(FAB_HIDDEN_KEY, '1');
    document.querySelector('.wbr-fab')?.remove();
    document.body.classList.remove('wbr-has-fab');
    toast('Đã ẩn nút điểm danh. Bấm vào số xu trên thanh đầu trang để mở lại.');
  }

  // Cập nhật mọi nơi đang hiển thị xu sau khi dữ liệu thay đổi
  function refreshAll() {
    document.querySelectorAll('[data-wbr-chip-text]').forEach(el => { el.textContent = `${state.balance} xu`; });
    document.querySelectorAll('.wbr-chip').forEach(el => el.setAttribute('aria-label', `Xu WeBuy: ${state.balance} xu, mở điểm danh`));
    document.querySelectorAll('[data-wbr-dot]').forEach(el => { el.hidden = !hasPending(); });
    if (isOpen() && view === 'hub') renderPopup();
    renderProfileXu();
    renderCheckoutXu();
  }

  /* ===================================================================
   * 6. POPUP
   * =================================================================== */
  let overlay = null;     // lớp nền mờ chứa popup
  let popup = null;       // khung popup
  let view = 'hub';       // 'hub' | 'reward' | 'rules' | 'game' | 'fly'
  let rewardInfo = null;  // nội dung màn Chúc mừng
  let lastFocus = null;   // phần tử đang focus trước khi mở popup

  function ensurePopup() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'wbr-overlay';
    overlay.hidden = true;
    overlay.innerHTML = '<section class="wbr-popup" role="dialog" aria-modal="true" aria-labelledby="wbr-title" tabindex="-1"></section>';
    document.body.appendChild(overlay);
    popup = overlay.querySelector('.wbr-popup');

    // Bấm ra nền mờ thì đóng
    overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });

    // Mọi nút trong popup khai báo hành động bằng data-wbr="..."
    popup.addEventListener('click', e => {
      const btn = e.target.closest('[data-wbr]');
      if (!btn) return;
      const action = btn.dataset.wbr;
      if (action === 'close') closePopup();
      if (action === 'checkin') doCheckin();
      if (action === 'play') startGame();
      if (action === 'fly') startFly();
      if (action === 'rules') showView('rules');
      if (action === 'hub') leaveToHub();
    });
  }

  function isOpen() { return !!overlay && !overlay.hidden; }

  function openPopup() {
    ensurePopup();
    if (isOpen() || otherPopupOpen()) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('wbr-lock'); // khóa cuộn trang phía sau
    showView('hub');
  }

  function closePopup() {
    if (!isOpen()) return;
    if (game && game.running) { finishGame(); return; } // đang chơi dở: kết thúc lượt và trả thưởng
    if (fly && fly.started) { finishFly(); return; }
    cancelGame();
    cancelFly();
    overlay.hidden = true;
    document.body.classList.remove('wbr-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function leaveToHub() {
    if (game && game.running) { finishGame(); return; }
    if (fly && fly.started) { finishFly(); return; }
    cancelGame();
    cancelFly();
    showView('hub');
  }

  function showView(name) {
    view = name;
    renderPopup();
    popup.scrollTop = 0;
    popup.focus();
  }

  function renderPopup() {
    if (view === 'hub') popup.innerHTML = hubHtml();
    if (view === 'reward') popup.innerHTML = rewardHtml();
    if (view === 'rules') popup.innerHTML = rulesHtml();
    if (view === 'game') popup.innerHTML = gameHtml();
    if (view === 'fly') popup.innerHTML = flyHtml();
    popup.dataset.view = view;
  }

  /* ---- Trang chính của popup: số dư, lịch điểm danh, lối vào trò chơi ---- */
  function dayCellHtml(index, info) {
    const day = index + 1;
    const done = info.claimedToday ? day <= info.day : day < info.day;
    const isToday = !info.claimedToday && !info.blocked && day === info.day;

    let cls = 'wbr-day';
    let icon = Art.coin(24);
    let label = `Ngày ${day}`;
    if (done) { cls += ' is-done'; icon = Art.check(26); }
    else if (isToday) { cls += ' is-today'; icon = Art.coin(28); label = 'Hôm nay'; }
    else if (day === 7) { cls += ' is-big'; icon = Art.coinStack(34); }

    return `<div class="${cls}"><b>+${CHECKIN_REWARDS[index]}</b>${icon}<small>${label}</small></div>`;
  }

  function hubHtml() {
    const info = getCheckin();
    const plays = playInfo();
    const cells = CHECKIN_REWARDS.map((_, i) => dayCellHtml(i, info)).join('');

    let button, note;
    if (info.blocked) {
      button = '<button type="button" class="wbr-btn" disabled>Chưa thể điểm danh</button>';
      note = 'Ngày trên thiết bị đang sớm hơn lần điểm danh gần nhất. Hãy kiểm tra lại ngày giờ.';
    } else if (info.claimedToday) {
      button = '<button type="button" class="wbr-btn" disabled>Đã điểm danh hôm nay</button>';
      note = `Bạn đang ở Ngày ${info.day}/7. Mai quay lại nhận ${nextReward(info.day)} xu nha!`;
    } else {
      button = `<button type="button" class="wbr-btn wbr-btn-lime wbr-pulse" data-wbr="checkin">Nhận ngay ${Art.coin(30)} ${info.reward} xu</button>`;
      note = info.broken
        ? 'Bạn đã bỏ lỡ một ngày nên chuỗi bắt đầu lại từ Ngày 1.'
        : `Bạn đang ở Ngày ${info.day}. Bỏ lỡ một ngày là chuỗi về Ngày 1 đó nha!`;
    }

    const flies = flyInfo();
    const totalLeft = plays.left + flies.left;
    const playTag = totalLeft > 0 ? `Còn ${totalLeft} lượt hôm nay` : 'Hết lượt hôm nay';
    const flyButton = flies.left > 0
      ? '<button type="button" class="wbr-btn wbr-btn-lime" data-wbr="fly">Bay thôi</button>'
      : '<button type="button" class="wbr-btn wbr-btn-lime" disabled>Hết lượt</button>';
    const flyHint = flies.left > 0
      ? `Chạm để vịt vỗ cánh, qua mỗi kệ hàng +${FLY.xuPerShelf} xu.`
      : 'Tạo hoặc tham gia một nhóm mua để nhận thêm lượt.';
    const playButton = plays.left > 0
      ? '<button type="button" class="wbr-btn wbr-btn-orange" data-wbr="play">Chơi ngay</button>'
      : '<button type="button" class="wbr-btn wbr-btn-orange" disabled>Hết lượt</button>';
    const playHint = plays.left > 0
      ? 'Bắt đủ 3 bạn là chốt đơn, mỗi nhóm +5 xu.'
      : 'Tạo hoặc tham gia một nhóm mua để nhận thêm lượt.';

    return `
      <header class="wbr-head">
        <span class="wbr-blob wbr-blob-lime" aria-hidden="true"></span>
        <span class="wbr-blob wbr-blob-cream" aria-hidden="true"></span>
        <div class="wbr-head-row">
          <h2 class="wbr-title" id="wbr-title">Xu WeBuy</h2>
          <button type="button" class="wbr-round" data-wbr="close" aria-label="Đóng">${ICON_CLOSE}</button>
        </div>
        <div class="wbr-balance">
          <span class="wbr-wiggle">${Art.coin(54)}</span>
          <strong>${state.balance}</strong><span>xu</span>
        </div>
        <div class="wbr-head-row">
          <span class="wbr-worth">= ${money(state.balance * XU_VALUE)} trừ thẳng khi thanh toán</span>
          <a class="wbr-pill" href="profile.html#my-coins">Lịch sử ›</a>
        </div>
      </header>

      <section class="wbr-card wbr-checkin">
        <div class="wbr-card-tab">Điểm danh nhận xu</div>
        <div class="wbr-days">${cells}</div>
        ${button}
        <p class="wbr-note">${note}</p>
      </section>

      <div class="wbr-section-row">
        <h3>Săn thêm xu ở đây</h3>
        <span class="wbr-tag">${playTag}</span>
      </div>

      <section class="wbr-game-card">
        <span class="wbr-blob wbr-blob-hill" aria-hidden="true"></span>
        <div class="wbr-game-text">
          <span class="wbr-kicker">TRÒ CHƠI MUA CHUNG</span>
          <strong class="wbr-game-name">Gom nhóm</strong>
          <strong class="wbr-game-sub">${GAME.seconds} giây</strong>
          <p>${playHint}</p>
          ${playButton}
        </div>
        <span class="wbr-badge" aria-hidden="true"><small>TỚI</small>${GAME.maxXu} xu</span>
        <span class="wbr-demo wbr-demo-1 wbr-hop">${Art.buddy('meo', 58)}</span>
        <span class="wbr-demo wbr-demo-2 wbr-hop wbr-hop-alt">${Art.buddy('cam', 66)}</span>
        <span class="wbr-demo wbr-demo-3 wbr-hop">${Art.buddy('vit', 58)}</span>
      </section>

      <section class="wbr-game-card wbr-fly-card">
        <span class="wbr-fly-shelf wbr-fly-shelf-1" aria-hidden="true"></span>
        <span class="wbr-fly-shelf wbr-fly-shelf-2" aria-hidden="true"></span>
        <div class="wbr-game-text">
          <span class="wbr-kicker">TRÒ CHƠI MỚI</span>
          <strong class="wbr-game-name">Vịt bay</strong>
          <strong class="wbr-game-sub">săn xu</strong>
          <p>${flyHint}</p>
          ${flyButton}
        </div>
        <span class="wbr-badge" aria-hidden="true"><small>TỚI</small>${FLY.maxXu} xu</span>
        <span class="wbr-demo wbr-fly-demo wbr-hop">${Art.buddy('vit', 62)}</span>
      </section>

      <footer class="wbr-foot">
        <button type="button" class="wbr-link" data-wbr="rules">Thể lệ xu</button>
        <a class="wbr-link" href="profile.html#my-coins">Xem xu ở Hồ sơ</a>
      </footer>`;
  }

  function doCheckin() {
    const result = claimCheckin();
    if (!result.ok) { toast('Hôm nay bạn đã điểm danh rồi. Mai quay lại nha!'); renderPopup(); return; }
    showReward({
      amount: result.reward,
      lead: 'Điểm danh thành công, bạn nhận được',
      sub: `Chuỗi Ngày ${result.day}/7 · Mai quay lại nhận tiếp ${nextReward(result.day)} xu`
    });
  }

  /* ---- Màn Chúc mừng: dùng chung cho điểm danh và trò chơi ---- */
  function showReward(info) {
    rewardInfo = info;
    showView('reward');
  }

  const CONFETTI = [
    [12, 17, 'o', -30], [23, 11, 'l', 20], [38, 8, 'c', -15], [62, 10, 'o', 35], [77, 16, 'l', -25], [86, 26, 'c', 40],
    [8, 31, 'l', 30], [88, 38, 'o', -40], [14, 46, 'c', 15], [82, 50, 'l', 25], [7, 60, 'o', -20], [90, 62, 'c', 30]
  ];

  function rewardHtml() {
    const plays = playInfo();
    const flies = flyInfo();
    const confetti = CONFETTI.map(([x, y, color, rot]) =>
      `<i class="wbr-confetti wbr-confetti-${color}" style="left:${x}%;top:${y}%;transform:rotate(${rot}deg)"></i>`).join('');
    let actions = '<button type="button" class="wbr-btn wbr-btn-lime" data-wbr="hub">Tuyệt vời!</button>';
    if (plays.left > 0) {
      actions = `<button type="button" class="wbr-btn wbr-btn-lime wbr-pulse" data-wbr="play">Chơi Gom nhóm, săn thêm xu</button>
         <button type="button" class="wbr-link wbr-link-light" data-wbr="hub">Để sau</button>`;
    } else if (flies.left > 0) {
      actions = `<button type="button" class="wbr-btn wbr-btn-lime wbr-pulse" data-wbr="fly">Chơi Vịt bay, săn thêm xu</button>
         <button type="button" class="wbr-link wbr-link-light" data-wbr="hub">Để sau</button>`;
    }

    return `
      <div class="wbr-reward">
        ${confetti}
        <button type="button" class="wbr-round wbr-reward-close" data-wbr="close" aria-label="Đóng">${ICON_CLOSE}</button>
        <h2 class="wbr-congrats" id="wbr-title">CHÚC MỪNG!</h2>
        <span class="wbr-hop">${Art.coinStack(170)}</span>
        <p class="wbr-reward-lead">${esc(rewardInfo.lead)}</p>
        <strong class="wbr-reward-amount">+${rewardInfo.amount} xu</strong>
        <p class="wbr-reward-rate"><b>100 xu = ${money(100 * XU_VALUE)}</b> · trừ thẳng vào đơn khi thanh toán</p>
        <p class="wbr-reward-sub">${esc(rewardInfo.sub)}</p>
        ${actions}
      </div>`;
  }

  /* ---- Thể lệ rút gọn (bản đầy đủ nằm ở trang Chính sách) ---- */
  function rulesHtml() {
    return `
      <header class="wbr-head wbr-head-small">
        <div class="wbr-head-row">
          <button type="button" class="wbr-round" data-wbr="hub" aria-label="Quay lại Xu WeBuy">${ICON_BACK}</button>
          <h2 class="wbr-title wbr-title-small" id="wbr-title">Thể lệ Xu WeBuy</h2>
          <button type="button" class="wbr-round" data-wbr="close" aria-label="Đóng">${ICON_CLOSE}</button>
        </div>
      </header>
      <ol class="wbr-rules">
        <li><b>Xu WeBuy</b> là điểm thưởng tặng khi điểm danh và chơi trò chơi. Xu không quy đổi thành tiền mặt, không mua bán, không chuyển cho người khác.</li>
        <li><b>Điểm danh</b> mỗi ngày một lần theo chuỗi 7 ngày: ${CHECKIN_REWARDS.join(', ')} xu. Bỏ lỡ một ngày, chuỗi bắt đầu lại từ Ngày 1; xu đã nhận vẫn giữ nguyên.</li>
        <li><b>Gom nhóm ${GAME.seconds} giây</b>: mỗi ngày một lượt miễn phí, nhận từ ${GAME.minXu} đến ${GAME.maxXu} xu. Tạo hoặc tham gia một nhóm mua trong ngày được tặng thêm một lượt.</li>
        <li><b>Vịt bay săn xu</b>: mỗi ngày một lượt miễn phí (tính riêng với Gom nhóm), qua mỗi kệ hàng được ${FLY.xuPerShelf} xu, nhận từ ${FLY.minXu} đến ${FLY.maxXu} xu. Tạo hoặc tham gia một nhóm mua trong ngày cũng được tặng thêm một lượt.</li>
        <li><b>Một ngày</b> tính từ 00:00 đến 23:59 theo giờ trên thiết bị. Lượt chưa dùng không cộng dồn sang ngày sau.</li>
        <li><b>Dùng xu</b> để trừ tiền khi thanh toán: 1 xu = ${money(XU_VALUE)}, mỗi đơn dùng tối thiểu ${MIN_XU_USE} xu và tối đa ${MAX_DISCOUNT_PERCENT}% tiền hàng.</li>
        <li><b>Bản thử nghiệm</b>: xu lưu trên trình duyệt này, sẽ mất khi xóa dữ liệu trình duyệt và không có giá trị thanh toán thật.</li>
      </ol>
      <footer class="wbr-foot"><button type="button" class="wbr-btn wbr-btn-lime" data-wbr="hub">Đã hiểu</button></footer>`;
  }

  /* ===================================================================
   * 7. TRÒ CHƠI "GOM NHÓM 15 GIÂY"
   * Các bạn mua chung chạy quanh sân. Bấm trúng ai thì bạn đó vào nhóm;
   * đủ 3 bạn là chốt một nhóm (+5 xu). Bấm nhầm người "Mua lẻ" thì mất một bạn.
   * =================================================================== */
  const BUDDY_KINDS = ['cam', 'meo', 'vit', 'mam'];
  const BUDDY_NAMES = { cam: 'Cam', meo: 'Mèo', vit: 'Vịt', mam: 'Mầm', le: 'Mua lẻ' };
  let game = null;

  function gameHtml() {
    return `
      <header class="wbr-head wbr-head-game">
        <span class="wbr-blob wbr-blob-lime" aria-hidden="true"></span>
        <div class="wbr-head-row">
          <button type="button" class="wbr-round" data-wbr="hub" aria-label="Kết thúc và quay lại">${ICON_BACK}</button>
          <h2 class="wbr-title wbr-title-small" id="wbr-title">Gom nhóm ${GAME.seconds} giây</h2>
          <button type="button" class="wbr-round" data-wbr="close" aria-label="Đóng">${ICON_CLOSE}</button>
        </div>
        <div class="wbr-hud">
          <span class="wbr-timer">${ICON_CLOCK}<span data-wbr-time>00:${String(GAME.seconds).padStart(2, '0')}</span></span>
          <span class="wbr-timebar"><i data-wbr-bar></i></span>
          <span class="wbr-score">${Art.coin(26)}<span data-wbr-score>+0</span></span>
        </div>
      </header>

      <section class="wbr-card wbr-group">
        <div class="wbr-group-text">
          <strong>Nhóm đang gom</strong>
          <span data-wbr-group-hint>Bấm vào các bạn đang chạy để rủ vào nhóm</span>
          <small data-wbr-group-done>Đã chốt 0 nhóm</small>
        </div>
        <div class="wbr-slots" data-wbr-slots></div>
        <span class="wbr-group-badge" data-wbr-group-badge aria-hidden="true">0/${GAME.groupSize}</span>
      </section>

      <div class="wbr-field" data-wbr-field>
        <span class="wbr-ring wbr-ring-1" aria-hidden="true"></span>
        <span class="wbr-ring wbr-ring-2" aria-hidden="true"></span>
        <span class="wbr-blob wbr-blob-ground" aria-hidden="true"></span>
        <p class="wbr-field-hint">Mỗi nhóm chốt được +${GAME.xuPerGroup} xu · tối đa ${GAME.maxXu} xu một lượt</p>
        <strong class="wbr-count" data-wbr-count aria-live="assertive">3</strong>
      </div>`;
  }

  function startGame() {
    if (playInfo().left <= 0) { toast('Bạn đã dùng hết lượt hôm nay. Tạo hoặc tham gia nhóm mua để nhận thêm lượt.'); return; }
    cancelGame();
    showView('game');

    game = {
      field: popup.querySelector('[data-wbr-field]'),
      buddies: [],     // các nhân vật đang ở trên sân
      slots: [],       // các bạn đã vào nhóm đang gom
      groups: 0,       // số nhóm đã chốt
      running: false,
      startTime: 0,
      lastFrame: 0,
      frameId: 0,
      countTimer: 0
    };
    renderGroup();

    // Đếm ngược 3, 2, 1 rồi mới bắt đầu
    const countEl = popup.querySelector('[data-wbr-count]');
    let count = 3;
    game.countTimer = setInterval(() => {
      count -= 1;
      if (count > 0) { countEl.textContent = count; return; }
      clearInterval(game.countTimer);
      countEl.remove();
      beginGame();
    }, 700);
  }

  function beginGame() {
    state = loadState();
    if (!playInfo().left) { cancelGame(); showView('hub'); return; }
    usePlay(); // lượt chơi được tính từ lúc trò chơi thật sự bắt đầu
    for (let i = 0; i < GAME.buddies; i++) spawnBuddy(BUDDY_KINDS[i % BUDDY_KINDS.length]);
    spawnBuddy('le');
    game.running = true;
    game.startTime = performance.now();
    game.lastFrame = game.startTime;
    game.frameId = requestAnimationFrame(gameLoop);
  }

  // Tạo một nhân vật ở vị trí ngẫu nhiên với hướng chạy ngẫu nhiên
  function spawnBuddy(kind) {
    const size = GAME.buddySize;
    const maxX = Math.max(1, game.field.clientWidth - size);
    const maxY = Math.max(1, game.field.clientHeight - size - 46); // chừa phần đất phía dưới
    const angle = Math.random() * Math.PI * 2;
    const speed = reduceMotion ? 0 : 70 + Math.random() * 60;      // px mỗi giây

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'wbr-buddy' + (kind === 'le' ? ' is-loner' : '');
    el.setAttribute('aria-label', kind === 'le' ? 'Người mua lẻ, đừng bấm' : `Rủ bạn ${BUDDY_NAMES[kind]} vào nhóm`);
    el.innerHTML = `<span class="wbr-hop${Math.random() < 0.5 ? ' wbr-hop-alt' : ''}">${Art.buddy(kind, size)}</span>` +
      (kind === 'le' ? '<small>Mua lẻ</small>' : '');

    const buddy = { el, kind, size, x: Math.random() * maxX, y: Math.random() * maxY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, caught: false };
    el.style.transform = `translate(${buddy.x}px, ${buddy.y}px)`;

    // pointerdown bắt nhanh hơn click khi mục tiêu đang di chuyển; click để dùng được bàn phím
    el.addEventListener('pointerdown', () => catchBuddy(buddy));
    el.addEventListener('click', () => catchBuddy(buddy));

    game.field.appendChild(el);
    game.buddies.push(buddy);
  }

  // Vòng lặp vẽ: di chuyển nhân vật, cập nhật đồng hồ, hết giờ thì kết thúc
  function gameLoop(now) {
    if (!game || !game.running) return;
    const dt = Math.min(0.05, (now - game.lastFrame) / 1000); // giây trôi qua từ khung hình trước
    game.lastFrame = now;
    const elapsed = (now - game.startTime) / 1000;
    const remaining = GAME.seconds - elapsed;
    const speedUp = 1 + elapsed / GAME.seconds;                // càng về cuối chạy càng nhanh

    const maxX = game.field.clientWidth;
    const maxY = game.field.clientHeight - 46;
    for (const b of game.buddies) {
      b.x += b.vx * dt * speedUp;
      b.y += b.vy * dt * speedUp;
      // Chạm mép sân thì bật ngược lại
      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
      if (b.x > maxX - b.size) { b.x = maxX - b.size; b.vx = -Math.abs(b.vx); }
      if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
      if (b.y > maxY - b.size) { b.y = maxY - b.size; b.vy = -Math.abs(b.vy); }
      b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
    }

    const secondsLeft = Math.max(0, Math.ceil(remaining));
    popup.querySelector('[data-wbr-time]').textContent = '00:' + String(secondsLeft).padStart(2, '0');
    popup.querySelector('[data-wbr-bar]').style.width = Math.max(0, remaining / GAME.seconds * 100) + '%';

    if (remaining <= 0) { finishGame(); return; }
    game.frameId = requestAnimationFrame(gameLoop);
  }

  function catchBuddy(buddy) {
    if (!game || !game.running || buddy.caught) return;
    buddy.caught = true;
    buddy.el.remove();
    game.buddies = game.buddies.filter(b => b !== buddy);

    if (buddy.kind === 'le') {
      // Bấm nhầm người mua lẻ: mất một bạn trong nhóm đang gom
      if (game.slots.length) game.slots.pop();
      popText(buddy, 'Ối! Mất 1 bạn');
      game.field.classList.add('is-shake');
      setTimeout(() => game && game.field.classList.remove('is-shake'), 350);
      respawn('le', 700);
    } else {
      game.slots.push(buddy.kind);
      if (game.slots.length === GAME.groupSize) {
        game.groups += 1;
        game.slots = [];
        popText(buddy, `Chốt đơn! +${GAME.xuPerGroup} xu`);
      }
      respawn(BUDDY_KINDS[Math.floor(Math.random() * BUDDY_KINDS.length)], 350);
    }
    renderGroup();
  }

  // Cho một nhân vật mới xuất hiện sau một khoảng ngắn
  function respawn(kind, delay) {
    const current = game;
    setTimeout(() => { if (game === current && game.running) spawnBuddy(kind); }, delay);
  }

  // Chữ bật lên tại chỗ vừa bấm
  function popText(buddy, text) {
    const el = document.createElement('span');
    el.className = 'wbr-pop';
    el.textContent = text;
    el.style.left = Math.min(buddy.x, game.field.clientWidth - 150) + 'px';
    el.style.top = buddy.y + 'px';
    game.field.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function gameXu() { return Math.min(GAME.maxXu, game.groups * GAME.xuPerGroup); }

  // Vẽ lại ô "Nhóm đang gom" và điểm
  function renderGroup() {
    const slots = [];
    for (let i = 0; i < GAME.groupSize; i++) {
      const kind = game.slots[i];
      slots.push(kind ? `<span class="wbr-slot is-filled">${Art.buddy(kind, 44)}</span>` : '<span class="wbr-slot">?</span>');
    }
    popup.querySelector('[data-wbr-slots]').innerHTML = slots.join('');
    popup.querySelector('[data-wbr-group-badge]').textContent = `${game.slots.length}/${GAME.groupSize}`;
    popup.querySelector('[data-wbr-group-done]').textContent = `Đã chốt ${game.groups} nhóm`;
    popup.querySelector('[data-wbr-score]').textContent = '+' + gameXu();
    const missing = GAME.groupSize - game.slots.length;
    popup.querySelector('[data-wbr-group-hint]').textContent = game.slots.length
      ? `Thêm ${missing} bạn nữa là chốt đơn!`
      : 'Bấm vào các bạn đang chạy để rủ vào nhóm';
  }

  function finishGame() {
    if (!game) return;
    const groups = game.groups;
    const reward = Math.max(GAME.minXu, gameXu());
    stopGameLoop();
    game = null;
    addXu(reward, `Gom nhóm ${GAME.seconds} giây · chốt ${groups} nhóm`);
    showReward({
      amount: reward,
      lead: groups > 0 ? `Bạn chốt được ${groups} nhóm, nhận được` : 'Chưa chốt được nhóm nào, tặng bạn xu an ủi',
      sub: playInfo().left > 0 ? 'Bạn vẫn còn lượt chơi hôm nay' : 'Tạo hoặc tham gia một nhóm mua để nhận thêm lượt chơi'
    });
  }

  function stopGameLoop() {
    if (!game) return;
    game.running = false;
    cancelAnimationFrame(game.frameId);
    clearInterval(game.countTimer);
  }

  // Hủy trò chơi khi chưa bắt đầu (đang đếm ngược): không trừ lượt, không cộng xu
  function cancelGame() {
    stopGameLoop();
    game = null;
  }

  /* ===================================================================
   * 7b. TRÒ CHƠI "VỊT BAY SĂN XU" (kiểu Flappy Bird)
   * Chú vịt bay qua các cặp kệ hàng. Chạm sân chơi (hoặc nhấn Space / ↑) để vỗ cánh.
   * Qua mỗi cặp kệ được FLY.xuPerShelf xu; chạm kệ hoặc rơi xuống đất là hết lượt.
   * Vẽ bằng <canvas> + requestAnimationFrame, vận tốc tính theo thời gian thực
   * nên chạy mượt như nhau trên máy nhanh và máy chậm.
   * =================================================================== */
  let fly = null;
  let duckImg = null; // ảnh chú vịt, tạo một lần từ hình SVG trong rewards-art.js

  function flyHtml() {
    return `
      <header class="wbr-head wbr-head-game">
        <span class="wbr-blob wbr-blob-lime" aria-hidden="true"></span>
        <div class="wbr-head-row">
          <button type="button" class="wbr-round" data-wbr="hub" aria-label="Kết thúc và quay lại">${ICON_BACK}</button>
          <h2 class="wbr-title wbr-title-small" id="wbr-title">Vịt bay săn xu</h2>
          <button type="button" class="wbr-round" data-wbr="close" aria-label="Đóng">${ICON_CLOSE}</button>
        </div>
        <div class="wbr-hud">
          <span class="wbr-timer wbr-fly-count"><span data-wbr-fly-passed>0</span>&nbsp;kệ</span>
          <span class="wbr-timebar" title="Tiến tới ${FLY.maxXu} xu"><i data-wbr-fly-bar style="width:0%"></i></span>
          <span class="wbr-score">${Art.coin(26)}<span data-wbr-fly-score>+0</span></span>
        </div>
      </header>

      <div class="wbr-field wbr-fly-field" data-wbr-fly-field>
        <canvas data-wbr-fly-canvas aria-label="Sân chơi Vịt bay săn xu. Chạm, nhấn phím cách hoặc mũi tên lên để vỗ cánh."></canvas>
        <p class="wbr-field-hint" data-wbr-fly-hint>Chạm sân chơi, nhấn Space hoặc ↑ để vỗ cánh</p>
        <strong class="wbr-count" data-wbr-count aria-live="assertive">3</strong>
      </div>
      <p class="wbr-fly-best">Kỷ lục của bạn: <b>${state.flyBest} kệ</b> · qua mỗi kệ +${FLY.xuPerShelf} xu, tối đa ${FLY.maxXu} xu</p>`;
  }

  function startFly() {
    if (flyInfo().left <= 0) { toast('Bạn đã dùng hết lượt Vịt bay hôm nay. Tạo hoặc tham gia nhóm mua để nhận thêm lượt.'); return; }
    cancelGame();
    cancelFly();
    showView('fly');

    if (!duckImg) {
      duckImg = new Image();
      duckImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Art.buddy('vit', 112).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    }

    const field = popup.querySelector('[data-wbr-fly-field]');
    const canvas = popup.querySelector('[data-wbr-fly-canvas]');
    const w = field.clientWidth, h = field.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);

    fly = {
      field, canvas, ctx, w, h,
      ground: h - 40,                 // mặt đất: phần đất màu kem ở đáy sân
      duck: { x: Math.round(w * 0.28), y: h * 0.42, vy: 0 },
      shelves: [],
      passed: 0,
      started: false,  // đã qua đếm ngược, lượt chơi đã được tính
      waiting: true,   // vịt đang lơ lửng chờ cú chạm đầu tiên
      over: false,
      lastFrame: 0, frameId: 0, countTimer: 0, endTimer: 0, time: 0
    };

    field.addEventListener('pointerdown', e => { e.preventDefault(); flap(); });

    const countEl = popup.querySelector('[data-wbr-count]');
    let count = 3;
    fly.lastFrame = performance.now();
    fly.frameId = requestAnimationFrame(flyLoop); // vẽ sân ngay cả lúc đếm ngược
    fly.countTimer = setInterval(() => {
      count -= 1;
      if (count > 0) { countEl.textContent = count; return; }
      clearInterval(fly.countTimer);
      countEl.remove();
      state = loadState();
      if (!flyInfo().left) { cancelFly(); showView('hub'); return; }
      useFly();          // lượt chơi được tính từ lúc trò chơi thật sự bắt đầu
      fly.started = true;
    }, 700);
  }

  // Vỗ cánh: đặt lại vận tốc bay lên (không cộng dồn) để dễ điều khiển
  function flap() {
    if (!fly || !fly.started || fly.over) return;
    if (fly.waiting) {
      fly.waiting = false;
      const hint = popup.querySelector('[data-wbr-fly-hint]');
      if (hint) hint.hidden = true;
    }
    fly.duck.vy = FLY.flap;
  }

  function addShelf(x) {
    const minTop = 40, maxTop = fly.ground - FLY.gap - 40;
    const prev = fly.shelves.length ? fly.shelves[fly.shelves.length - 1].top : (minTop + maxTop) / 2;
    // Khoảng trống không lệch quá 120px so với cặp kệ trước để luôn bay qua được
    const top = Math.max(minTop, Math.min(maxTop, prev + (Math.random() * 240 - 120)));
    fly.shelves.push({ x, top, passed: false });
  }

  function flyLoop(now) {
    if (!fly) return;
    const dt = Math.min(0.033, (now - fly.lastFrame) / 1000);
    fly.lastFrame = now;
    fly.time += dt;
    const d = fly.duck;

    if (!fly.over) {
      if (!fly.started || fly.waiting) {
        d.y = fly.h * 0.42 + Math.sin(fly.time * 4) * 8;      // lơ lửng nhấp nhô
      } else {
        d.vy = Math.min(FLY.maxFall, d.vy + FLY.gravity * dt);
        d.y += d.vy * dt;
        if (d.y < 16) { d.y = 16; d.vy = 0; }

        // Kệ chạy sang trái, nhanh dần theo số kệ đã qua (tối đa gấp 1,6 lần)
        const speed = FLY.speed * Math.min(1.6, 1 + fly.passed * 0.04);
        for (const s of fly.shelves) s.x -= speed * dt;
        if (fly.shelves.length && fly.shelves[0].x < -FLY.shelfWidth - 10) fly.shelves.shift();
        if (!fly.shelves.length || fly.shelves[fly.shelves.length - 1].x < fly.w - FLY.spacing) addShelf(fly.w + 20);

        for (const s of fly.shelves) {
          if (!s.passed && s.x + FLY.shelfWidth < d.x - FLY.duckSize * 0.3) {
            s.passed = true;
            fly.passed += 1;
            updateFlyHud();
            if (flyXu() >= FLY.maxXu) { fly.over = true; fly.endTimer = setTimeout(finishFly, 500); break; }
          }
        }

        if (!fly.over && flyHit()) {
          fly.over = true;
          fly.field.classList.add('is-shake');
          fly.endTimer = setTimeout(finishFly, 700);
        }
      }
    } else if (d.y < fly.ground - FLY.duckSize * 0.35) {
      d.vy = Math.min(FLY.maxFall, d.vy + FLY.gravity * dt); // vịt rơi xuống sau khi va chạm
      d.y = Math.min(fly.ground - FLY.duckSize * 0.35, d.y + d.vy * dt);
    }

    drawFly();
    fly.frameId = requestAnimationFrame(flyLoop);
  }

  // Va chạm: coi vịt là hình tròn nhỏ hơn hình vẽ một chút để chơi "dễ thở" hơn
  function flyHit() {
    const d = fly.duck, r = FLY.duckSize * 0.36;
    if (d.y + r >= fly.ground) return true;
    for (const s of fly.shelves) {
      const nearX = Math.max(s.x, Math.min(d.x, s.x + FLY.shelfWidth));
      const dx = nearX - d.x;
      if (Math.abs(dx) >= r) continue;
      const topY = Math.min(d.y, s.top);                       // điểm gần nhất trên kệ trên
      const botY = Math.max(d.y, s.top + FLY.gap);             // điểm gần nhất trên kệ dưới
      if (Math.hypot(dx, topY - d.y) < r || Math.hypot(dx, botY - d.y) < r) return true;
    }
    return false;
  }

  function flyXu() { return Math.min(FLY.maxXu, fly.passed * FLY.xuPerShelf); }

  function updateFlyHud() {
    popup.querySelector('[data-wbr-fly-passed]').textContent = fly.passed;
    popup.querySelector('[data-wbr-fly-score]').textContent = '+' + flyXu();
    popup.querySelector('[data-wbr-fly-bar]').style.width = (flyXu() / FLY.maxXu * 100) + '%';
  }

  const C = { orange: '#FD550A', green: '#015D47', lime: '#E0F354', cream: '#FFF6E5', ink: '#0B2A22', line: '#D9CDB4' };

  function drawFly() {
    const { ctx, w, h, ground } = fly;
    ctx.clearRect(0, 0, w, h);

    // Vòng nét đứt trang trí giống sân Gom nhóm, trôi chậm về bên trái
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 243, 84, 0.3)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    const ox = -((fly.time * 20) % (w + 300));
    ctx.beginPath(); ctx.arc(w + 150 + ox, h * 0.35, 120, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.5 + 150 + ox, h * 0.7, 70, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    for (const s of fly.shelves) {
      drawShelf(s.x, 0, s.top, true);
      drawShelf(s.x, s.top + FLY.gap, ground - s.top - FLY.gap + 6, false);
    }

    // Mặt đất màu kem, có vạch chạy để tạo cảm giác đang bay
    ctx.fillStyle = C.cream; ctx.fillRect(0, ground, w, h - ground);
    ctx.fillStyle = C.ink; ctx.fillRect(0, ground, w, 3);
    ctx.fillStyle = C.line;
    const off = fly.started && !fly.waiting && !fly.over ? (fly.time * 150) % 28 : 0;
    for (let x = -off; x < w; x += 28) ctx.fillRect(x, ground + 14, 14, 5);

    // Chú vịt nghiêng theo hướng bay
    const d = fly.duck;
    const angle = fly.waiting || !fly.started ? 0 : Math.max(-0.45, Math.min(1.2, d.vy / 600));
    if (duckImg && duckImg.complete) {
      ctx.save();
      ctx.translate(d.x, d.y); ctx.rotate(angle);
      const size = FLY.duckSize, hgt = size * 62 / 56;
      ctx.drawImage(duckImg, -size / 2, -hgt / 2, size, hgt);
      ctx.restore();
    }
  }

  // Một kệ hàng: thân kem viền đậm, có hộp hàng nhỏ, đầu kệ màu chanh phía khoảng trống
  function drawShelf(x, y, height, fromTop) {
    if (height <= 0) return;
    const { ctx } = fly, w = FLY.shelfWidth;
    ctx.save();
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.cream;
    ctx.fillRect(x + 4, y, w - 8, height); ctx.strokeRect(x + 4, y, w - 8, height);
    // Các tầng kệ và hộp hàng
    ctx.fillStyle = C.orange;
    for (let i = 1; i * 34 < height - 18; i++) {
      const ly = fromTop ? y + height - 18 - i * 34 : y + 18 + i * 34;
      ctx.beginPath(); ctx.moveTo(x + 4, ly); ctx.lineTo(x + w - 4, ly); ctx.stroke();
      ctx.fillRect(x + 12, ly - 14, 14, 14); ctx.strokeRect(x + 12, ly - 14, 14, 14);
    }
    // Đầu kệ
    const capY = fromTop ? y + height - 18 : y;
    ctx.fillStyle = C.lime;
    ctx.fillRect(x, capY, w, 18); ctx.strokeRect(x, capY, w, 18);
    ctx.restore();
  }

  function finishFly() {
    if (!fly) return;
    const passed = fly.passed;
    const reward = Math.max(FLY.minXu, flyXu());
    const reachedMax = flyXu() >= FLY.maxXu;
    stopFlyLoop();
    fly = null;
    if (passed > state.flyBest) { state.flyBest = passed; saveState(); }
    addXu(reward, `Vịt bay săn xu · qua ${passed} kệ`);
    showReward({
      amount: reward,
      lead: reachedMax ? `Vịt bay qua ${passed} kệ, đạt mức xu tối đa!`
        : passed > 0 ? `Vịt bay qua ${passed} kệ hàng, bạn nhận được` : 'Vịt chưa qua kệ nào, tặng bạn xu an ủi',
      sub: `Kỷ lục của bạn: ${state.flyBest} kệ`
    });
  }

  function stopFlyLoop() {
    if (!fly) return;
    cancelAnimationFrame(fly.frameId);
    clearInterval(fly.countTimer);
    clearTimeout(fly.endTimer);
  }

  // Hủy khi chưa bắt đầu (đang đếm ngược): không trừ lượt, không cộng xu
  function cancelFly() {
    stopFlyLoop();
    fly = null;
  }

  /* ===================================================================
   * 8. TRANG HỒ SƠ: khối "Xu của tôi" (cần <div id="profile-coins"> trong profile.html)
   * =================================================================== */
  let showAllHistory = false;

  function renderProfileXu() {
    const box = document.getElementById('profile-coins');
    if (!box) return;

    const info = getCheckin();
    const streak = info.claimedToday ? info.day : Math.max(0, info.day - 1);
    const rows = state.history.slice().reverse();
    const visible = showAllHistory ? rows : rows.slice(0, 10);

    const historyHtml = rows.length
      ? `<div class="wbr-history" role="table" aria-label="Lịch sử xu">
           <div class="wbr-history-row wbr-history-head" role="row">
             <span role="columnheader">Thời gian</span><span role="columnheader">Nội dung</span>
             <span role="columnheader">Thay đổi</span><span role="columnheader">Số dư</span>
           </div>
           ${visible.map(row => `
             <div class="wbr-history-row" role="row">
               <span role="cell">${new Date(row.time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
               <span role="cell">${esc(row.note)}</span>
               <span role="cell" class="${row.amount >= 0 ? 'is-plus' : 'is-minus'}">${row.amount >= 0 ? '+' : '−'}${Math.abs(row.amount)} xu</span>
               <span role="cell">${row.balance}</span>
             </div>`).join('')}
         </div>
         ${rows.length > 10 && !showAllHistory ? '<button type="button" class="wbr-more" data-wbr-more>Xem thêm</button>' : ''}`
      : '<p class="muted">Bạn chưa có xu nào. Điểm danh hôm nay để nhận 10 xu đầu tiên.</p>';

    box.innerHTML = `
      <div class="wbr-wallet">
        <span class="wbr-blob wbr-blob-orange" aria-hidden="true"></span>
        <span class="wbr-wallet-coin">${Art.coin(60)}</span>
        <div class="wbr-wallet-main">
          <strong>${state.balance} xu</strong>
          <span>Tương đương ${money(state.balance * XU_VALUE)} khi thanh toán</span>
        </div>
        <div class="wbr-wallet-streak">
          <span>Chuỗi điểm danh</span>
          <strong>Ngày ${streak} / 7</strong>
        </div>
        <button type="button" class="wbr-btn wbr-btn-lime" data-wbr-open>Mở điểm danh</button>
      </div>
      <h3 class="wbr-history-title">Lịch sử xu</h3>
      ${historyHtml}`;
  }

  /* ===================================================================
   * 9. TRANG THANH TOÁN: dùng xu trừ tiền (cần <div id="checkout-xu"> trong checkout.html)
   * Tính phần giảm trước khi app.js ghi đơn, lịch sử và số dư.
   * =================================================================== */
  let useXu = false;

  // Đọc "Tạm tính hàng hóa" mà js/app.js đã hiển thị
  function checkoutTotal() {
    const el = document.querySelector('#checkout-summary .checkout-total strong');
    return el ? Number(el.textContent.replace(/\D/g, '')) || 0 : 0;
  }

  function renderCheckoutXu() {
    const box = document.getElementById('checkout-xu');
    if (!box) return;

    const total = checkoutTotal();
    if (!total) { box.innerHTML = ''; return; }

    const usable = maxXuForOrder(total);
    if (!usable) useXu = false;
    const discount = usable * XU_VALUE;
    const hint = usable
      ? `Bạn có ${state.balance} xu, dùng được ${usable} xu cho đơn này`
      : `Bạn có ${state.balance} xu. Cần ít nhất ${MIN_XU_USE} xu, điểm danh mỗi ngày để tích thêm nhé.`;

    box.innerHTML = `
      <div class="wbr-pay${usable ? '' : ' is-off'}">
        <span class="wbr-wiggle">${Art.coin(38)}</span>
        <div class="wbr-pay-text">
          <label for="wbr-use-xu">Dùng Xu WeBuy</label>
          <span>${hint}</span>
        </div>
        <span class="wbr-switch">
          <input type="checkbox" id="wbr-use-xu" ${useXu ? 'checked' : ''} ${usable ? '' : 'disabled'}>
          <i aria-hidden="true"></i>
        </span>
      </div>
      ${useXu ? `
        <div class="wbr-pay-line"><span>Giảm từ xu <small>(${usable} xu × ${money(XU_VALUE)})</small></span><strong class="is-minus">−${money(discount)}</strong></div>
        <div class="wbr-pay-total"><span>Tổng thanh toán</span><strong>${money(total - discount)}</strong></div>` : ''}
      <p class="wbr-pay-note">1 xu = ${money(XU_VALUE)}, tối đa ${MAX_DISCOUNT_PERCENT}% tiền hàng mỗi đơn.</p>`;
  }

  function changedWallet(amount, note) {
    if (!amount) return null;
    const wallet = loadState();
    wallet.balance += amount;
    wallet.history.push({time:Date.now(), note, amount, balance:wallet.balance});
    wallet.history = wallet.history.slice(-HISTORY_LIMIT);
    return wallet;
  }
  function orderDiscount(id, subtotal) {
    state = loadState();
    const xuUsed = useXu ? maxXuForOrder(subtotal) : 0;
    return {xuUsed, discount:xuUsed * XU_VALUE, wallet:changedWallet(-xuUsed, `Dùng xu cho đơn #${id}`)};
  }
  function refund(order) {
    return changedWallet(Number(order.xuUsed) || 0, `Hoàn xu cho đơn #${order.id}`);
  }
  /* ===================================================================
   * 10. KHỞI ĐỘNG
   * =================================================================== */
  function otherPopupOpen() {
    return [...document.querySelectorAll(OTHER_POPUP_SELECTOR)].some(el =>
      !(overlay && overlay.contains(el)) && el.getClientRects().length > 0);
  }

  // Tự mở popup một lần mỗi ngày ở trang chủ, sau khi các popup khác (Popup địa điểm) đã đóng
  function scheduleAutoOpen() {
    if (page !== 'index.html') return;
    if (state.autoShown === today() || getCheckin().claimedToday) return;

    let sawOtherPopup = false;
    const tryOpen = () => {
      if (isOpen()) return;
      if (otherPopupOpen()) { sawOtherPopup = true; setTimeout(tryOpen, 600); return; }
      if (sawOtherPopup) { sawOtherPopup = false; setTimeout(tryOpen, 1000); return; } // chờ thêm 1 giây sau khi popup kia đóng
      state.autoShown = today();
      saveState();
      openPopup();
    };
    setTimeout(tryOpen, 1500);
  }

  // Sự kiện bấm chung cho các nút nằm ngoài popup
  document.addEventListener('click', e => {
    if (e.target.closest('[data-wbr-open]')) { openPopup(); return; }
    if (e.target.closest('[data-wbr-hide-fab]')) { hideFab(); return; }
    if (e.target.closest('[data-wbr-more]')) { showAllHistory = true; renderProfileXu(); return; }

  });

  document.addEventListener('change', e => {
    if (e.target.id !== 'wbr-use-xu') return;
    useXu = e.target.checked;
    renderCheckoutXu();
    document.getElementById('wbr-use-xu')?.focus(); // vẽ lại xong thì trả tiêu điểm về công tắc
  });

  document.addEventListener('webuy:groups', checkBonusPlay);

  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { closePopup(); return; }
    // Vịt bay: phím cách hoặc mũi tên lên để vỗ cánh
    if (view === 'fly' && fly && (e.key === ' ' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (!e.repeat) flap();
      return;
    }
    // Giữ tiêu điểm bàn phím bên trong popup
    if (e.key === 'Tab') {
      const items = [...popup.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === popup)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Tab khác của trình duyệt thay đổi dữ liệu thì cập nhật theo
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) { state = loadState(); refreshAll(); }
    if (e.key === STORAGE_PREFIX + 'groups') checkBonusPlay();
  });

  mountChip();
  mountFab();
  checkBonusPlay();
  refreshAll();
  scheduleAutoOpen();

  /* Cho bộ kiểm thử (tests/webuy-tests.js) và cho bạn thử nhanh trên Console, ví dụ:
   *   WeBuyRewards.debugSetToday('2026-11-16')  -> giả lập sang một ngày khác
   *   WeBuyRewards.debugReset()                 -> xóa toàn bộ xu để thử lại từ đầu
   */
  window.WeBuyRewards = {
    getState: () => JSON.parse(JSON.stringify(state)),
    getCheckin,
    orderDiscount,
    updateCheckout:renderCheckoutXu,
    refund,
    sync() { state = loadState(); useXu = false; refreshAll(); document.dispatchEvent(new Event('webuy:wallet')); },
    claimCheckin,
    playInfo,
    flyInfo,
    addXu,
    spendXu,
    maxXuForOrder,
    open: openPopup,
    close: closePopup,
    debugSetToday(key) { fakeToday = key || null; refreshAll(); },
    debugReset() { state = defaultState(); saveState(); refreshAll(); }
  };
})();
