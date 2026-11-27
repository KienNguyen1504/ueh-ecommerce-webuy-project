// Notifications for group memberships and the local rewards wallet.
(() => {
  const actions = document.querySelector('.header-actions');
  if (!actions) return;
  const prefix = 'webuy_demo_v2_';
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(prefix + key)) ?? fallback; } catch { return fallback; }
  }
  const bell = document.createElement('button');
  bell.className = 'notice-bell'; bell.type = 'button'; bell.setAttribute('aria-haspopup','dialog');
  bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5zM10 20a2 2 0 0 0 4 0"/></svg><span hidden></span>';
  actions.insertBefore(bell,actions.querySelector('.header-cart'));
  const panel = document.createElement('dialog'); panel.className = 'notice-panel'; panel.setAttribute('aria-labelledby','notice-title');
  panel.innerHTML = `<header><div><small>WeBuy · Demo</small><h2 id="notice-title">Thông báo</h2></div><button type="button" aria-label="Đóng">×</button></header>
    <div class="notice-list"></div><footer><button type="button" data-notice-read>Đọc tất cả</button><button type="button" data-notice-clear>Xóa tất cả</button></footer>`;
  document.body.append(panel);
  let items = [];
  function refresh() {
    const uid = read('uid',null), wallet = read('rewards',{}), now = new Date();
    const today = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    const events = [];
    if (!wallet.lastCheckin || wallet.lastCheckin < today) events.push({id:'daily-'+today,title:'Bạn còn lượt điểm danh hôm nay',url:'profile.html#profile-coins'});
    for (const h of (wallet.history || []).slice().reverse()) {
      events.push({id:JSON.stringify([h.time,h.note,h.balance]),title:h.note + ' · ' + (h.amount>0?'+':'') + h.amount + ' xu',url:'profile.html#profile-coins'});
    }
    const groupHistory = read('groupNotices',{});
    let changed = false;
    for (const g of read('groups',[]).filter(g => g.members?.includes(uid))) {
      const p = window.WEBUY_PRODUCTS?.find(p => p.id === g.productId);
      if (!p) continue;
      const left = g.need - g.members.length - (g.demoCount || 0);
      const state = left <= 0 ? 'Đã đủ người' : now >= g.endsAt ? 'Đã hết hạn' : left === 1 ? 'Chỉ còn thiếu 1 người' : '';
      const id = g.id+'-'+state;
      if (state && !groupHistory[id]) {
        groupHistory[id] = {id,title:p.name+' · '+state,url:'product-detail.html?id='+encodeURIComponent(p.id)+'&group='+encodeURIComponent(g.id)+'#group-'+encodeURIComponent(g.id)};
        changed = true;
      }
    }
    events.push(...Object.values(groupHistory).reverse());
    if (changed) localStorage.setItem(prefix+'groupNotices', JSON.stringify(groupHistory));
    const flags = read('noticeFlags',{});
    items = events.filter(item => flags[item.id] !== 'deleted');
    const unread = items.filter(item => flags[item.id] !== 'read').length;
    bell.setAttribute('aria-label',`Thông báo · ${unread} chưa đọc`);
    const badge = bell.querySelector('span'); badge.hidden = !unread; badge.textContent = unread > 9 ? '9+' : unread;
    const list = panel.querySelector('.notice-list');
    list.replaceChildren();
    for (const item of items) {
      const link = document.createElement('a'); link.href = item.url; link.textContent = item.title; link.dataset.id = item.id;
      link.classList.toggle('unread',flags[item.id] !== 'read'); list.append(link);
    }
    if (!items.length) list.textContent = 'Bạn chưa có thông báo.';
    panel.querySelector('[data-notice-read]').disabled = !unread;
    panel.querySelector('[data-notice-clear]').disabled = !items.length;
  }
  function mark(ids,value) {
    const flags = read('noticeFlags',{});
    for (const id of ids) flags[id] = value;
    localStorage.setItem(prefix+'noticeFlags',JSON.stringify(flags));
    refresh();
  }
  panel.querySelector('header button').onclick = () => panel.close();
  panel.querySelector('[data-notice-read]').onclick = () => mark(items.map(i=>i.id),'read');
  panel.querySelector('[data-notice-clear]').onclick = () => mark(items.map(i=>i.id),'deleted');
  panel.querySelector('.notice-list').onclick = e => {
    const a=e.target.closest('a'); if (!a) return;
    e.preventDefault(); const url=a.href; mark([a.dataset.id],'read'); panel.close(); location.href=url;
  };
  bell.onclick = () => {
    if ([...document.querySelectorAll('[aria-modal="true"],dialog[open]')].some(el=>el.getClientRects().length)) return;
    refresh(); panel.showModal();
  };
  for (const name of ['webuy:wallet','webuy:groups']) document.addEventListener(name,refresh);
  window.addEventListener('storage',e=>{if (!e.key || ['groups','rewards','noticeFlags'].some(k=>e.key===prefix+k)) refresh();});
  window.addEventListener('focus',refresh);
  setInterval(refresh,60000);
  refresh();
})();
