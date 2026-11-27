/* Shared navigation links for new frontend areas. */
(() => {
  'use strict';
  const nav=document.querySelector('.primary-nav');
  if(nav){
    const links=[['seller-center.html','Kênh người bán','seller'],['groups.html','Nhóm mua','groups'],['reverse-bidding.html','Đấu giá ngược','bidding']];
    links.forEach(([href,label,key])=>{if(!nav.querySelector(`a[href="${href}"]`)){const a=document.createElement('a');a.className='nav-item';a.href=href;a.dataset.featureNav=key;a.textContent=label;nav.append(a);}});
    const file=location.pathname.split('/').pop();
    if(file==='groups.html'||file==='reverse-bidding.html'){nav.querySelectorAll('.nav-item').forEach(a=>a.classList.remove('is-active'));const active=nav.querySelector(`a[href="${file}"]`);active?.classList.add('is-active');active?.setAttribute('aria-current','page');}
  }
})();
