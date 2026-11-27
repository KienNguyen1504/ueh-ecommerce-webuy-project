/* Group Hub – reads the same browser-demo groups and shared WEBUY_PRODUCTS catalog. */
(() => {
  'use strict';
  const GROUP_KEY='webuy_demo_v2_groups', LOCATION_KEY='webuy_demo_v2_location';
  const products=window.WEBUY_PRODUCTS||[];
  const money=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0)+'đ';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const regions = window.WeBuyRegions.map(r => [r.code,r.name]);
  function readGroups() {
    try { return JSON.parse(localStorage.getItem(GROUP_KEY)) || []; } catch { return []; }
  }
  const state=g=>{const count=(Number(g.demoCount)||0)+(Array.isArray(g.members)?g.members.length:0);return count>=Number(g.need)?'full':Date.now()>Number(g.endsAt)?'expired':'open';};
  const left=g=>{const ms=Math.max(0,Number(g.endsAt)-Date.now());if(!ms)return 'Đã hết hạn';const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h?`Còn ${h} giờ ${m} phút`:`Còn ${Math.max(1,m)} phút`;};
  const count=g=>(Number(g.demoCount)||0)+(Array.isArray(g.members)?g.members.length:0);
  const filters={category:'all',region:'all',one:false};
  const grid=document.getElementById('groups-grid');
  function render(){
    const filtered=readGroups().map(g=>({g,p:products.find(p=>String(p.id)===String(g.productId))})).filter(x=>x.p)
      .filter(({g,p})=>filters.category==='all'||p.category===filters.category)
      .filter(({g})=>filters.region==='all'||(g.regionCode||'all')===filters.region)
      .filter(({g})=>!filters.one||(state(g)==='open'&&Number(g.need)-count(g)===1));
    document.getElementById('groups-count').textContent=`${filtered.length} nhóm phù hợp`;
    grid.innerHTML=filtered.length?filtered.map(({g,p})=>{const n=count(g),s=state(g),remain=Math.max(0,Number(g.need)-n);return `<article class="hub-group-card"><a class="hub-group-image" href="product-detail.html?id=${encodeURIComponent(p.id)}&group=${encodeURIComponent(g.id)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"><span class="hub-state state-${s}">${s==='open'?'Đang mở':s==='full'?'Đã đủ người':'Đã hết hạn'}</span></a><div class="hub-card-body"><span class="hub-category">${esc(p.category)}</span><h2><a href="product-detail.html?id=${encodeURIComponent(p.id)}&group=${encodeURIComponent(g.id)}">${esc(p.name)}</a></h2><div class="hub-price"><strong>${money(p.group)}</strong><del>${money(p.retail)}</del></div><div class="hub-progress"><span style="width:${Math.min(100,n/Math.max(1,g.need)*100)}%"></span></div><div class="hub-facts"><span>${n}/${g.need} thành viên</span><span>${remain?`Thiếu ${remain} người`:'Đã đủ thành viên'}</span></div><div class="hub-facts"><span>📍 ${esc(regions.find(r=>r[0]===(g.regionCode||'all'))?.[1]||'Toàn quốc')}</span><span>⏱ ${left(g)}</span></div><div class="hub-cta"><a class="hub-card-action hub-card-action-primary" href="product-detail.html?id=${encodeURIComponent(p.id)}&group=${encodeURIComponent(g.id)}">${s==='open'?'Xem & tham gia':s==='full'?'Xem nhóm':'Xem nhóm'}</a><button type="button" class="hub-card-action hub-card-action-share" data-share-group="${esc(g.id)}" aria-label="Chia sẻ nhóm ${esc(p.name)}">Chia sẻ cho bạn bè</button>${(g.members || []).includes(JSON.parse(localStorage.getItem("webuy_demo_v2_uid"))) ? `<button class="hub-card-action" type="button" data-chat-group="${esc(g.id)}">Chat nhóm</button>` : ""}</div><small class="hub-demo-note">${g.isDemo?'Nhóm mẫu DEMO':window.WeBuyLan?'Nhóm qua Wi-Fi':'Nhóm tạo trong trình duyệt này'} · Giá nhóm là dữ liệu minh họa</small></div></article>`;}).join(''):`<div class="feature-empty hub-empty"><span aria-hidden="true">◎</span><h2>Chưa có nhóm phù hợp</h2><p>Thử đổi danh mục hoặc khu vực để tìm thêm nhóm mua.</p><button type="button" class="btn btn-primary" id="groups-reset">Xóa bộ lọc</button><a class="btn btn-outline" href="products.html">Tìm sản phẩm</a></div>`;
    grid.querySelectorAll('img').forEach(img=>{
      const host=img.closest('.hub-group-image');
      if(host&&!img.complete)host.classList.add('is-loading');
      img.addEventListener('load',()=>host?.classList.remove('is-loading'),{once:true});
      img.addEventListener('error',()=>{host?.classList.remove('is-loading');img.removeAttribute('src');host?.classList.add('image-fallback');},{once:true});
      if(img.complete&&img.naturalWidth>0)host?.classList.remove('is-loading');
    });
  }
  const cat=document.getElementById('groups-category');
  (window.WEBUY_CATEGORIES||[]).forEach(c=>{const o=document.createElement('option');o.value=c.name;o.textContent=c.name;cat.append(o);});
  regions.filter(([v])=>v!=='all').forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;document.getElementById('groups-region').append(o);});
  cat.addEventListener('change',()=>{filters.category=cat.value;render();});
  document.getElementById('groups-region').addEventListener('change',e=>{filters.region=e.target.value;render();});
  document.getElementById('groups-one').addEventListener('change',e=>{filters.one=e.target.checked;render();});
  grid.addEventListener('click',e=>{if(e.target.closest('#groups-reset')){filters.category='all';filters.region='all';filters.one=false;cat.value='all';document.getElementById('groups-region').value='all';document.getElementById('groups-one').checked=false;render();}});
  function syncRegion() {
    try { filters.region = JSON.parse(localStorage.getItem(LOCATION_KEY))?.code || 'all'; } catch { filters.region = 'all'; }
    document.getElementById('groups-region').value = filters.region;
    render();
  }
  document.addEventListener('webuy:location', syncRegion);
  document.addEventListener('webuy:groups', render);
  window.addEventListener('storage', e => {
    if (e.key === GROUP_KEY) render();
    if (e.key === LOCATION_KEY) syncRegion();
  });
  syncRegion();
})();
