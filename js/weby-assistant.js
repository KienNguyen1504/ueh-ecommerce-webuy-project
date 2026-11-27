/* WeBuy group-buy assistant: transparent rule engine using WEBUY_PRODUCTS + localStorage groups. */
(() => {
  'use strict';
  if (document.getElementById('weby-assistant')) return;
  const KEY='webuy_demo_v2_groups', products=()=>window.WEBUY_PRODUCTS||[];
  const money=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0)+'đ';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readGroups=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[];}catch{return[];}};
  const state=g=>{const n=(g.demoCount||0)+(g.members||[]).length;return n>=g.need?'full':Date.now()>g.endsAt?'expired':'open';};
  const findBudget=text=>{const m=norm(text).match(/(\d[\d.,]*)\s*(k|nghin|ngan|trieu|tr|d|dong)?/i);if(!m)return null;let digits=m[1]; if (/^\d{1,3}([.,]\d{3})+$/.test(digits)) digits=digits.replace(/[.,]/g,''); let n=Number(digits.replace(',','.'));if(!Number.isFinite(n))return null;const suffix=(m[2]||'').toLowerCase();if(['k','nghin','ngan'].includes(suffix))n*=1000;else if(['trieu','tr'].includes(suffix))n*=1000000;else if(!suffix&&n<10000)n*=1000;return n>0?n:null;};
  const categoryMatch=text=>{const q=norm(text);const aliases=[['Balo & túi ví',['balo','tui','vi']],['Áo thun',['ao thun','ao']],['Thiết bị gia dụng',['gia dung','binh giu nhiet','den ban','quat']],['Trang sức',['trang suc','day chuyen','nhan','vong tay']],['Thiết bị điện tử',['dien tu','tai nghe','loa','ban phim']],['Sắc đẹp',['sac dep','my pham','kem chong nang','son']]];return aliases.find(([name,terms])=>terms.some(t=>(' '+q.replace(/[^a-z0-9 ]/g,' ')+' ').includes(' '+t+' ')))?.[0]||null;};
  const root=document.createElement('div');root.id='weby-assistant';root.innerHTML=`<button class="assistant-launch" type="button" aria-label="Mở trợ lý mua chung" aria-expanded="false"><span aria-hidden="true">✦</span><b>Trợ lý WeBuy</b></button><section class="assistant-panel" hidden aria-label="Trợ lý mua chung"><header><div><strong>Trợ lý mua chung WeBuy</strong><small>Gợi ý theo catalog & nhóm demo</small></div><button type="button" class="assistant-close" aria-label="Đóng">×</button></header><div class="assistant-messages" aria-live="polite"><div class="assistant-message assistant-bot">Chào bạn! Bạn cho mình biết món cần tìm và ngân sách nhé. Ví dụ: <b>có 300k mua balo</b>.</div></div><form class="assistant-form"><input name="question" placeholder="Ví dụ: có 300k mua balo" autocomplete="off" required><button type="submit">Gửi</button></form><p class="assistant-disclaimer">Trợ lý dùng quy tắc tìm kiếm trên catalog và localStorage; không dùng AI bên ngoài, không tự xác nhận tồn kho.</p></section>`;document.body.append(root);
  const launch=root.querySelector('.assistant-launch'),panel=root.querySelector('.assistant-panel'),messages=root.querySelector('.assistant-messages');
  function append(html,klass='assistant-bot'){const n=document.createElement('div');n.className='assistant-message '+klass;n.innerHTML=html;messages.append(n);messages.scrollTop=messages.scrollHeight;}
  function respond(text){const budget=findBudget(text),category=categoryMatch(text),q=norm(text);let list=products().filter(p=>!category||p.category===category).filter(p=>!budget||Number(p.group)<=budget).sort((a,b)=>Number(a.group)-Number(b.group));
    if(!category&&!budget){list=products().filter(p=>norm(p.name+' '+p.category).split(' ').some(t=>t.length>3&&q.includes(t))).sort((a,b)=>a.group-b.group);}
    const region = (window.WeBuyRegions || []).find(r=>r.code!=='all' && q.includes(norm(r.name).replace(/^tp[. ]+/,'').trim()));
    if (region) {
      const ids = new Set(readGroups().filter(g=>g.regionCode===region.code && state(g)==='open').map(g=>g.productId));
      if (!budget && !category) list = [...products()].sort((a,b)=>a.group-b.group);
      list = list.filter(p=>ids.has(p.id));
      append(`Nhóm đang mở ở ${esc(region.name)}.`);
    }
    if(!list.length){append('Mình chưa tìm thấy sản phẩm phù hợp trong catalog hiện tại. Bạn thử đổi danh mục hoặc tăng ngân sách nhé.','assistant-bot');return;}
    list=list.slice(0,3);const groupList=readGroups();append(`${category?`Mình lọc theo danh mục <b>${esc(category)}</b>. `:''}${budget?`Ngân sách giá nhóm tối đa <b>${money(budget)}</b>. `:''}Có ${list.length} sản phẩm phù hợp trong catalog:`+list.map(p=>{const open=groupList.filter(g=>String(g.productId)===String(p.id)&&state(g)==='open');const reason=budget&&p.group<=budget?`Giá nhóm ${money(p.group)} nằm trong ngân sách`:category?`Cùng danh mục ${p.category}`:'Khớp từ khóa trong catalog';return `<a class="assistant-product" href="product-detail.html?id=${encodeURIComponent(p.id)}"><img src="${esc(p.image)}" alt=""><span><b>${esc(p.name)}</b><small>${money(p.group)} · ${esc(reason)}</small><small>${open.length?`${open.length} nhóm đang mở trong dữ liệu trình duyệt`:'Chưa có nhóm đang mở ghi nhận'}</small></span><i>→</i></a>`;}).join(''));
  }
  launch.addEventListener('click',()=>{panel.hidden=!panel.hidden;launch.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)panel.querySelector('input').focus();});
  root.querySelector('.assistant-close').addEventListener('click',()=>{panel.hidden=true;launch.setAttribute('aria-expanded','false');});
  root.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const input=e.currentTarget.elements.question;const text=input.value.trim();if(!text)return;append(esc(text),'assistant-user');input.value='';respond(text);});
  root.querySelectorAll('.assistant-message img').forEach(img=>img.addEventListener('error',()=>img.removeAttribute('src')));
})();
