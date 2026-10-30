/* WeBuy interactive prototype — browser-only state, no API or payment gateway. */
(() => {
  'use strict';
  const products = window.WEBUY_PRODUCTS || [];
  const storagePrefix = 'webuy_demo_v2_';
  const CATEGORIES = { 'all':'Tất cả', 'balo':'Balo & túi ví', 'ao-thun':'Áo thun', 'gia-dung':'Thiết bị gia dụng', 'trang-suc':'Trang sức' };
  const safe = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';
  const get = (key, fallback) => { try { const val = localStorage.getItem(storagePrefix + key); return val ? JSON.parse(val) : fallback; } catch { return fallback; } };
  const put = (key, value) => { try { localStorage.setItem(storagePrefix + key, JSON.stringify(value)); } catch { console.warn('WeBuy demo: không thể lưu dữ liệu trên trình duyệt hiện tại.'); } };
  const uid = (() => { let id = get('uid',null); if(!id) { id='u-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);put('uid',id); } return id; })();
  const product = id => products.find(x => x.id === String(id));
  const page = location.pathname.split('/').pop() || 'index.html';
  let toastTimer;
  const flash = (message, type='ok') => {
    const el=document.getElementById('app-toast');if(!el)return;
    el.textContent=message;el.className='app-toast show '+(type==='error'?'is-error':'');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3600);
  };
  const seedGroups = () => products.map((p,i)=>({id:'demo-'+p.id,productId:p.id,need:p.minMembers,members:[],demoCount:p.initialMembers,endsAt:Date.now()+([18,12,20,9,16,14,17,11][i]*3600000),createdAt:Date.now(),isDemo:true}));
  let groups = get('groups', null);
  if(!Array.isArray(groups)){groups=seedGroups();put('groups',groups);}
  const saveGroups = () => put('groups',groups);
  let cart = get('cart', []);
  if(!Array.isArray(cart))cart=[];
  const saveCart = ()=>{put('cart',cart);refreshHeader();};
  const groupCount=g => (g.demoCount||0)+(g.members||[]).length;
  const groupState=g => Date.now()>g.endsAt ? (groupCount(g)>=g.need?'success':'expired') : groupCount(g)>=g.need?'success':'open';
  const timeLeft = g=>{let n=Math.max(0,Math.ceil((g.endsAt-Date.now())/3600000));return n?`Còn khoảng ${n} giờ`:'Đã hết hạn';};
  const currentProfile = ()=>get('profile',{name:'Khách WeBuy',email:'',phone:'',address:''});
  const updateAvatar = () => {
    const p=currentProfile();let initials=(p.name||'WeBuy').trim().split(/\s+/).slice(-2).map(x=>x[0]).join('').toUpperCase();
    document.querySelectorAll('[data-avatar]').forEach(el=>el.textContent=initials||'WB');
  };
  const refreshHeader=()=>{
    const n=cart.reduce((sum,item)=>sum+Math.max(1,Number(item.quantity)||1),0);
    document.querySelectorAll('[data-cart-count]').forEach(el=>{el.textContent=n>99?'99+':String(n);el.setAttribute('aria-label',`${n} sản phẩm trong giỏ hàng`);});
    updateAvatar();
  };
  const detailLink = p => `product-detail.html?id=${encodeURIComponent(p.id)}`;
  const addCart=(pId,kind='retail',groupId=null,qty=1)=>{
    const p=product(pId);if(!p)return;
    qty=Math.max(1,Math.min(99,Number(qty)||1));
    const match=cart.find(x=>x.productId===p.id&&x.kind===kind&&x.groupId===groupId);
    if(match)match.quantity=Math.min(99,match.quantity+qty);
    else cart.push({productId:p.id,kind,groupId,quantity:qty,addedAt:Date.now()});
    saveCart();flash(`Đã thêm ${p.name} vào giỏ hàng.`);
  };
  const joinGroup=(gId)=>{
    const g=groups.find(x=>x.id===gId);if(!g){flash('Không tìm thấy nhóm mua.','error');return;}
    if(Date.now()>g.endsAt){flash('Nhóm đã hết thời gian tham gia.','error');return;}
    if((g.members||[]).includes(uid)){flash('Bạn đã tham gia nhóm này. Xem tại Hồ sơ.');return;}
    if(groupCount(g)>=g.need){flash('Nhóm đã đủ thành viên. Hãy tạo nhóm mới.','error');return;}
    g.members.push(uid);saveGroups();
    if(!cart.some(x=>x.kind==='group'&&x.groupId===g.id))cart.push({productId:g.productId,kind:'group',groupId:g.id,quantity:1,addedAt:Date.now()});
    saveCart();flash(groupState(g)==='success'?'Nhóm đã đủ thành viên! Sản phẩm đã sẵn sàng trong giỏ.':'Đã tham gia nhóm! Theo dõi tiến độ trong Hồ sơ.');
    renderDetail();renderCart();renderProfile();refreshProductProgress();
  };
  const createGroup=(pId)=>{
    const p=product(pId);if(!p)return;
    const id='group-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    groups.push({id,productId:pId,need:p.minMembers,members:[uid],demoCount:0,endsAt:Date.now()+24*3600000,createdAt:Date.now(),isDemo:false});
    saveGroups();cart.push({productId:pId,kind:'group',groupId:id,quantity:1,addedAt:Date.now()});saveCart();
    renderDetail();renderProfile();
    showDialog(`<span class="dialog-icon">✦</span><h2>Đã tạo nhóm mua!</h2><p>Nhóm <strong>${safe(p.name)}</strong> đang có <b>1/${p.minMembers}</b> thành viên. Bản demo cho phép bạn mô phỏng có thêm thành viên tại trang chi tiết sản phẩm. Liên kết chỉ dùng minh họa, chưa thể mời người dùng khác thật sự.</p><div class="share-field"><input value="${safe(new URL(detailLink(p)+'&group='+encodeURIComponent(id),location.href).href)}" id="new-group-link" readonly><button type="button" data-copy-group="${safe(id)}">Sao chép</button></div><p class="muted">Dữ liệu nhóm hiện chỉ lưu trên trình duyệt này, liên kết chưa đồng bộ được giữa các thiết bị.</p><a class="btn btn-primary" href="profile.html">Theo dõi nhóm của tôi</a>`);
  };
  const showDialog=content=>{
    const root=document.getElementById('app-dialog-root');if(!root)return;
    root.innerHTML=`<div class="app-modal-backdrop"><section class="app-modal" role="dialog" aria-modal="true" aria-label="Thông tin nhóm mua"><button type="button" class="modal-close" data-close-dialog aria-label="Đóng">×</button>${content}</section></div>`;
    root.querySelector('[data-close-dialog]')?.focus();
  };
  const closeDialog=()=>{const root=document.getElementById('app-dialog-root');if(root)root.innerHTML='';};
  const refreshProductProgress=()=>{
    document.querySelectorAll('article.product-card[data-product-id]').forEach(card=>{
      const p=product(card.dataset.productId);if(!p)return;
      const g=groups.find(g=>g.id==='demo-'+p.id);if(!g)return;
      const count=groupCount(g),state=groupState(g);
      const stat=card.querySelector('.group-stats > span:first-child b');if(stat)stat.textContent=`${count}/${g.need}`;
      const progress=card.querySelector('.progress-track > span');if(progress)progress.style.width=Math.min(100,Math.round(count/g.need*100))+'%';
      const time=card.querySelector('.group-stats > span:nth-child(2)');if(time){const svg=time.querySelector('svg');time.textContent=' '+timeLeft(g);if(svg)time.prepend(svg);}
      if(state==='success')card.classList.add('group-complete');
    });
    const live=document.querySelector('.live-card');if(live){
      const g=groups.find(g=>g.id==='demo-1');if(g){
        const n=groupCount(g);const label=live.querySelector('.live-team b');if(label)label.textContent=`${n}/${g.need} thành viên hợp lệ`;
        const track=live.querySelector('.progress-track > span');if(track)track.style.width=Math.min(100,n/g.need*100)+'%';
        const time=live.querySelector('.live-card-foot > span');if(time){const svg=time.querySelector('svg');time.textContent=' '+timeLeft(g);if(svg)time.prepend(svg);}
      }
    }
  };
  const renderCatalog=()=>{
    if(page!=='products.html')return;
    const searchParams=new URLSearchParams(location.search);
    let filter=searchParams.get('category')||'all'; if(!CATEGORIES[filter]) filter='all';
    const keyword=(searchParams.get('q')||'').trim();
    const input=document.getElementById('catalog-q');if(input)input.value=keyword;
    document.querySelectorAll('[data-filter]').forEach(b=>{
      let isActive=b.dataset.filter===filter;b.classList.toggle('is-selected',isActive);b.setAttribute('aria-pressed',String(isActive));
    });
    let visible=0;
    document.querySelectorAll('[data-product-id]').forEach(card=>{
      const p=product(card.dataset.productId);if(!p)return;
      const matchCat=filter==='all'||p.category===CATEGORIES[filter];
      const matchQ=!keyword||(p.name+' '+p.category).toLocaleLowerCase('vi-VN').includes(keyword.toLocaleLowerCase('vi-VN'));
      card.hidden=!(matchCat&&matchQ);
      if(!card.hidden)visible++;
    });
    const count=document.getElementById('catalog-count');if(count)count.textContent=`Hiển thị ${visible}/${products.length} sản phẩm${filter!=='all'?' · '+CATEGORIES[filter]:''}`;
    const empty=document.getElementById('empty-search');if(empty)empty.hidden=visible!==0;
  };
  const setCategory=(cat)=>{
    const searchParams=new URLSearchParams(location.search);
    if(cat==='all')searchParams.delete('category');else searchParams.set('category',cat);
    const query=searchParams.toString();history.replaceState(null,'',location.pathname+(query?'?'+query:''));renderCatalog();
  };
  const renderDetail=()=>{
    if(page!=='product-detail.html')return;
    const params=new URLSearchParams(location.search),p=product(params.get('id')||'1')||products[0];if(!p)return;
    const setText=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value;};
    document.title=p.name+' | WeBuy';setText('#detail-title',p.name);setText('#detail-category',p.category.toUpperCase()+' · SẢN PHẨM');
    setText('#detail-retail-price',money(p.retail));setText('#detail-group-price',money(p.group));setText('#detail-group-min',`Áp dụng khi nhóm đạt ít nhất ${p.minMembers} thành viên`);
    setText('#detail-summary',`${p.name} thuộc danh mục ${p.category}. Khám phá lựa chọn mua lẻ hoặc mua chung cùng WeBuy để nhận mức giá phù hợp.`);
    document.querySelectorAll('.breadcrumb span').forEach((el,i)=>{if(i===1)el.textContent=p.name;});
    const im=document.getElementById('detail-product-image');if(im){im.src=p.image;im.alt=p.name;}
    const desc=document.querySelector('.details-description');
    if(desc){
      const heading=desc.querySelector('.description-grid h2'),paragraph=desc.querySelector('.description-grid > div:first-child > p:last-of-type');
      if(heading)heading.textContent=p.id==='1'?'Đơn giản, tiện dụng và dễ phối đồ.':'Khám phá lựa chọn phù hợp với bạn.';
      if(paragraph)paragraph.textContent=`${p.name} được giới thiệu trên WeBuy dưới hình thức mua lẻ hoặc mua chung. Hình ảnh, mô tả và mức giá hiện phục vụ minh họa cho đồ án.`;
      const spec=desc.querySelector('.spec-table tbody');if(spec)spec.innerHTML=`<tr><th>Tên sản phẩm</th><td>${safe(p.name)}</td></tr><tr><th>Danh mục</th><td>${safe(p.category)}</td></tr><tr><th>Giá mua lẻ</th><td>${money(p.retail)}</td></tr><tr><th>Giá mua chung</th><td>${money(p.group)} (từ ${p.minMembers} người)</td></tr><tr><th>Tình trạng</th><td>Dữ liệu minh họa, chưa có giao dịch thật</td></tr>`;
    }
    const table=document.getElementById('dynamic-tiers');if(table){table.innerHTML=`<h2>So sánh giá theo hình thức mua</h2><table class="tier-table"><thead><tr><th>Hình thức</th><th>Điều kiện</th><th>Giá / sản phẩm</th></tr></thead><tbody><tr><td>Mua lẻ</td><td>1 người</td><td>${money(p.retail)}</td></tr><tr class="is-tier"><td>Mua chung</td><td>Từ ${p.minMembers} người</td><td>${money(p.group)}</td></tr></tbody></table><p class="table-note">Giá mua chung chỉ áp dụng khi nhóm đủ số thành viên trong thời hạn. Đây là dữ liệu demo.</p>`;}
    const currentGroups=groups.filter(g=>g.productId===p.id).sort((a,b)=>(groupState(a)==='open'?0:1)-(groupState(b)==='open'?0:1));
    const open=currentGroups.filter(g=>groupState(g)==='open');
    const mainGroup=open[0]||currentGroups[0];
    if(mainGroup){
      setText('#group-preview-count',`${groupCount(mainGroup)}/${mainGroup.need} thành viên`);
      const progress=document.getElementById('group-preview-progress');if(progress)progress.style.width=Math.min(100,groupCount(mainGroup)/mainGroup.need*100)+'%';
      const bottom=document.getElementById('group-preview-bottom');if(bottom)bottom.innerHTML=`<span>${safe(timeLeft(mainGroup))}</span><span>${groupState(mainGroup)==='success'?'Đã đủ thành viên':groupState(mainGroup)==='expired'?'Đã kết thúc':`Cần thêm ${Math.max(0,mainGroup.need-groupCount(mainGroup))} thành viên`}</span>`;
    }
    const list=document.getElementById('available-groups');
    if(list){
      list.innerHTML=currentGroups.map(g=>{
        const state=groupState(g),n=groupCount(g),joined=g.members.includes(uid);
        return `<article class="available-group"><div class="group-row"><div><strong>${g.isDemo?'Nhóm cộng đồng':'Nhóm '+safe(g.id.slice(-6).toUpperCase())}</strong><span class="group-state state-${state}">${state==='open'?'Đang mở':state==='success'?'Đủ thành viên':'Đã hết hạn'}</span></div><b>${n}/${g.need}</b></div><div class="mini-track"><span style="width:${Math.min(100,n/g.need*100)}%"></span></div><div class="group-row group-foot"><small>${safe(timeLeft(g))} · ${joined?'Bạn đã tham gia':'Giá nhóm '+money(p.group)}</small>${joined?'<a href="profile.html" class="group-action-link">Đã tham gia ✓</a>':state==='open'?`<button type="button" data-join-group="${safe(g.id)}" class="group-action-link">Tham gia nhóm →</button>`:'<span class="muted">Đã đóng</span>'}</div>${!g.isDemo && joined && state==='open'?`<button type="button" class="simulate-member" data-simulate-member="${safe(g.id)}">+ Mô phỏng 1 thành viên mới (demo)</button>`:''}</article>`;
      }).join('')||'<p class="muted">Chưa có nhóm nào. Hãy tạo nhóm mới để bắt đầu.</p>';
    }
    const join=document.getElementById('join-group-btn');if(join){join.dataset.joinGroup=open[0]?.id||'';join.disabled=!open.length;join.textContent=open.length?'Tham gia nhóm':'Chưa có nhóm đang mở';}
    const newGroup=params.get('group');if(newGroup&&groups.some(g=>g.id===newGroup)){
      const target=list?.querySelector(`[data-join-group="${CSS.escape(newGroup)}"]`);if(target){target.classList.add('attention-pulse');}
    }
    document.getElementById('create-group-btn')?.setAttribute('data-create-group',p.id);
    document.getElementById('buy-retail-btn')?.setAttribute('data-buy-retail',p.id);
    document.getElementById('detail-add-cart')?.setAttribute('data-add-detail-cart',p.id);
  };
  const renderCart=()=>{
    if(page!=='cart.html')return;
    const list=document.getElementById('cart-items');if(!list)return;
    if(!cart.length){list.innerHTML='<div class="empty-panel"><span class="empty-emoji">🧺</span><h2>Giỏ hàng của bạn đang trống</h2><p>Khám phá những món đồ bạn thích và thêm vào giỏ hàng nhé.</p><a class="btn btn-primary" href="products.html">Khám phá sản phẩm</a></div>';}
    else list.innerHTML=cart.map((item,i)=>{
      const p=product(item.productId);if(!p)return '';
      const g=groups.find(v=>v.id===item.groupId),status=item.kind==='group'?(g?groupState(g):'expired'):'retail';
      const pending=item.kind==='group'&&status!=='success';
      return `<article class="cart-item"><a href="${detailLink(p)}"><img src="${safe(p.image)}" alt="${safe(p.name)}"></a><div class="cart-item-main"><a class="cart-item-title" href="${detailLink(p)}">${safe(p.name)}</a><span class="cart-kind">${item.kind==='retail'?'Mua lẻ':'Mua chung · Nhóm '+safe((g?.id||'').slice(-6).toUpperCase())}</span><span class="cart-item-state ${pending?'is-pending':''}">${item.kind==='retail'?'Sẵn sàng xác nhận':status==='success'?'Nhóm đủ thành viên · Sẵn sàng xác nhận':status==='expired'?'Nhóm hết hạn · Chưa đủ thành viên':`Đang chờ đủ thành viên (${groupCount(g)}/${g.need})`}</span><div class="cart-item-bottom"><div class="qty-inline"><button type="button" data-cart-minus="${i}" aria-label="Giảm số lượng" ${item.kind==='group'?'disabled title="Mỗi thành viên giữ một suất trong nhóm"':''}>−</button><span>${item.quantity}</span><button type="button" data-cart-plus="${i}" aria-label="Tăng số lượng" ${item.kind==='group'?'disabled title="Mỗi thành viên giữ một suất trong nhóm"':''}>+</button></div><button class="plain-danger" type="button" data-cart-remove="${i}">Xóa khỏi giỏ</button></div></div><strong class="cart-line-price">${money((item.kind==='retail'?p.retail:p.group)*item.quantity)}</strong></article>`;
    }).join('');
    let ready=0,pending=0,readyTotal=0;
    cart.forEach(item=>{const p=product(item.productId),g=groups.find(x=>x.id===item.groupId);if(!p)return;if(item.kind==='retail'||(g&&groupState(g)==='success')){ready++;readyTotal+=(item.kind==='retail'?p.retail:p.group)*item.quantity;}else pending++;});
    document.getElementById('cart-subtotal').textContent=money(readyTotal);
    document.getElementById('cart-ready-count').textContent=ready+' sản phẩm sẵn sàng';
    const n=document.getElementById('cart-pending-note');if(n)n.textContent=pending?`${pending} mục mua chung đang chờ đủ thành viên hoặc đã hết hạn, không tính vào tiền tạm tính.`:'Các sản phẩm sẵn sàng được tính trong tạm tính.';
    const a=document.getElementById('cart-checkout');if(a){a.classList.toggle('is-disabled',ready===0);a.setAttribute('aria-disabled',String(ready===0));a.textContent=ready?'Tiếp tục xác nhận đơn hàng →':'Chưa có sản phẩm sẵn sàng';}
    refreshHeader();
  };
  const renderCheckout=()=>{
    if(page!=='checkout.html')return;
    const list=document.getElementById('checkout-summary');if(!list)return;
    const ready=cart.filter(item=>{let g=groups.find(x=>x.id===item.groupId);return item.kind==='retail'||(g&&groupState(g)==='success');});
    if(!ready.length){document.getElementById('checkout-form').hidden=true;list.innerHTML='<div class="empty-panel"><h2>Chưa có sản phẩm có thể xác nhận</h2><p>Giỏ hàng mua lẻ hoặc nhóm đã đủ thành viên mới có thể chuyển sang bước này.</p><a class="btn btn-outline" href="cart.html">Quay về giỏ hàng</a></div>';return;}
    let total=0;list.innerHTML=ready.map(it=>{const p=product(it.productId);const price=it.kind==='retail'?p.retail:p.group;total+=price*it.quantity;return `<div class="checkout-line"><span>${safe(p.name)} <small>× ${it.quantity} · ${it.kind==='retail'?'Mua lẻ':'Mua chung'}</small></span><strong>${money(price*it.quantity)}</strong></div>`;}).join('')+`<div class="checkout-total"><span>Tạm tính hàng hóa</span><strong>${money(total)}</strong></div><p class="muted">Phí vận chuyển và thanh toán thực tế chưa tích hợp trong bản demo.</p>`;
    const p=currentProfile();for(const key of ['name','phone','address','email']){const inp=document.querySelector(`[name="${key}"]`);if(inp&&p[key])inp.value=p[key];}
  };
  const renderProfile=()=>{
    if(page!=='profile.html')return;
    const p=currentProfile();
    for(const key of ['name','email','phone','address']){const input=document.querySelector(`[name="${key}"]`);if(input&&document.activeElement!==input)input.value=p[key]||'';}
    const short=document.getElementById('profile-avatar');if(short)short.textContent=(p.name||'WeBuy').trim().split(/\s+/).slice(-2).map(x=>x[0]).join('').toUpperCase();
    const greet=document.getElementById('profile-display-name');if(greet)greet.textContent=p.name||'Khách WeBuy';
    const list=document.getElementById('profile-groups');if(list){
      const mine=groups.filter(g=>(g.members||[]).includes(uid));
      list.innerHTML=mine.length?mine.map(g=>{const pr=product(g.productId);const status=groupState(g);return `<div class="activity-line"><img src="${safe(pr.image)}" alt=""><div><a href="${detailLink(pr)}"><strong>${safe(pr.name)}</strong></a><small>Nhóm ${safe(g.id.slice(-6).toUpperCase())} · ${groupCount(g)}/${g.need} thành viên</small><span class="group-state state-${status}">${status==='open'?'Đang chờ thêm người':status==='success'?'Đã đủ thành viên': 'Nhóm hết hạn'}</span></div><a href="${detailLink(pr)}">Chi tiết →</a></div>`;}).join(''):'<p class="muted">Bạn chưa tham gia nhóm nào. <a href="products.html">Khám phá sản phẩm →</a></p>';
    }
    const orders=get('orders',[]),orderbox=document.getElementById('profile-orders');
    if(orderbox)orderbox.innerHTML=orders.length?orders.slice().reverse().map(o=>`<article class="order-item"><div class="group-row"><b>Đơn #${safe(o.id)}</b><span class="group-state state-open">Đơn demo · Chưa xử lý</span></div><small>${safe(o.date)} · ${o.items.length} dòng sản phẩm</small><strong>${money(o.total)}</strong></article>`).join(''):'<p class="muted">Chưa có đơn hàng demo nào được xác nhận.</p>';
  };
  document.addEventListener('click',e=>{
    const target=e.target.closest('button,a');if(!target)return;
    if(target.matches('[data-filter]'))setCategory(target.dataset.filter);
    if(target.matches('#clear-filters')){history.replaceState(null,'',location.pathname);renderCatalog();document.getElementById('catalog-q').value='';}
    if(target.matches('[data-add-cart]'))addCart(target.dataset.addCart);
    if(target.matches('[data-add-detail-cart]'))addCart(target.dataset.addDetailCart,'retail',null,document.getElementById('detail-qty')?.value||1);
    if(target.matches('[data-buy-retail]')){addCart(target.dataset.buyRetail,'retail',null,document.getElementById('detail-qty')?.value||1);location.href='cart.html';}
    if(target.matches('[data-join-group]')){if(target.dataset.joinGroup)joinGroup(target.dataset.joinGroup);}
    if(target.matches('[data-create-group]'))createGroup(target.dataset.createGroup);
    if(target.matches('[data-simulate-member]')){
      const g=groups.find(v=>v.id===target.dataset.simulateMember);
      if(!g||g.isDemo||!g.members.includes(uid)||groupState(g)!=='open')return;
      g.demoCount=(g.demoCount||0)+1;saveGroups();renderDetail();renderProfile();refreshProductProgress();renderCart();
      flash(groupState(g)==='success'?'Nhóm demo đã đủ thành viên. Bạn có thể xác nhận mục mua chung trong giỏ.':'Đã mô phỏng thêm 1 thành viên.');
    }

    if(target.matches('[data-cart-remove]')){
      const idx=Number(target.dataset.cartRemove),item=cart[idx];
      if(item?.kind==='group'){const g=groups.find(x=>x.id===item.groupId);if(g){g.members=g.members.filter(x=>x!==uid);saveGroups();}}
      cart.splice(idx,1);saveCart();renderCart();flash('Đã xóa sản phẩm khỏi giỏ.');
    }
    if(target.matches('[data-cart-plus],[data-cart-minus]')){const idx=Number(target.dataset.cartPlus??target.dataset.cartMinus),it=cart[idx];if(!it||it.kind==='group')return;it.quantity=Math.max(1,Math.min(99,it.quantity+(target.hasAttribute('data-cart-plus')?1:-1)));saveCart();renderCart();}
    if(target.matches('#qty-plus,#qty-minus')){const input=document.getElementById('detail-qty');input.value=Math.max(1,Math.min(99,(Number(input.value)||1)+(target.id==='qty-plus'?1:-1)));}
    if(target.matches('[data-close-dialog]')||e.target.classList?.contains('app-modal-backdrop'))closeDialog();
    if(target.matches('[data-copy-group]')){
      const id=target.dataset.copyGroup,p=product(groups.find(g=>g.id===id)?.productId);if(!p)return;
      const url=new URL(detailLink(p)+'&group='+encodeURIComponent(id),location.href).href;
      if(navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(()=>flash('Đã sao chép đường dẫn (chỉ dùng minh họa trên cùng trình duyệt).')).catch(()=>flash('Hãy sao chép liên kết ở ô bên trên.','error'));
      else {const input=document.getElementById('new-group-link');input?.select();document.execCommand?.('copy');flash('Đã chọn liên kết để sao chép.');}
    }
    if(target.matches('#cart-checkout')&&target.getAttribute('aria-disabled')==='true')e.preventDefault();
  });
  document.addEventListener('submit',e=>{
    if(e.target.id==='catalog-search'){
      e.preventDefault();let q=document.getElementById('catalog-q').value.trim();const params=new URLSearchParams(location.search);
      q?params.set('q',q):params.delete('q');history.replaceState(null,'',location.pathname+(params.toString()?'?'+params.toString():''));renderCatalog();
    }
    if(e.target.id==='profile-form'){
      e.preventDefault();const f=e.target;const values=Object.fromEntries(new FormData(f));
      if(!values.name?.trim()){flash('Vui lòng nhập tên hiển thị.','error');return;}
      const profile={name:values.name.trim(),email:(values.email||'').trim(),phone:(values.phone||'').trim(),address:(values.address||'').trim()};
      put('profile',profile);updateAvatar();renderProfile();flash('Đã lưu hồ sơ demo trên trình duyệt.');
    }
    if(e.target.id==='checkout-form'){
      e.preventDefault();const f=e.target;
      if(!f.reportValidity())return;
      const ready=cart.filter(item=>item.kind==='retail'||groups.some(g=>g.id===item.groupId&&groupState(g)==='success'));
      if(!ready.length){flash('Không có sản phẩm đủ điều kiện xác nhận.','error');return;}
      const values=Object.fromEntries(new FormData(f));
      if(!values.name?.trim()||!values.phone?.trim()||!values.address?.trim()){flash('Vui lòng nhập đầy đủ thông tin nhận hàng.','error');return;}
      const total=ready.reduce((sum,it)=>{const p=product(it.productId);return sum+(it.kind==='retail'?p.retail:p.group)*it.quantity;},0);
      const id='WB'+String(Date.now()).slice(-9);
      const orders=get('orders',[]);orders.push({id,date:new Date().toLocaleString('vi-VN'),items:ready.map(x=>({...x})),total,shipping:{name:values.name,phone:values.phone,address:values.address},status:'demo'});put('orders',orders);
      cart=cart.filter(it=>!ready.includes(it));saveCart();put('profile',{...currentProfile(),name:values.name.trim(),phone:values.phone.trim(),address:values.address.trim()});
      showDialog(`<span class="dialog-icon">✓</span><h2>Đã lưu đơn hàng demo</h2><p>Mã đơn <strong>${safe(id)}</strong> với tổng tiền hàng <strong>${money(total)}</strong> đã được lưu trên trình duyệt. Đây là bước mô phỏng xác nhận đặt hàng, <strong>chưa phát sinh giao dịch, thu tiền hoặc giao hàng thực tế</strong>.</p><a href="profile.html" class="btn btn-primary">Xem lịch sử đơn demo</a>`);
      renderCheckout();refreshHeader();
    }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog();});
  window.addEventListener('storage',e=>{if(e.key?.startsWith(storagePrefix)){groups=get('groups',seedGroups());cart=get('cart',[]);refreshHeader();refreshProductProgress();renderDetail();renderCart();renderProfile();}});
  refreshHeader();refreshProductProgress();renderCatalog();renderDetail();renderCart();renderCheckout();renderProfile();
})();
