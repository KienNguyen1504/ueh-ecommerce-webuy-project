(() => {
  'use strict';
  const prefix = 'webuy_demo_v2_';
  const initial = JSON.parse(document.getElementById('lan-state').textContent);
  let revision = -1;
  let sharedProducts = [];
  async function call(path, body) {
    let response;
    try {
      response = await fetch('/api/groups' + path, {
        method:body === undefined ? 'GET' : 'POST', cache:'no-store',
        headers:body === undefined ? {} : {'Content-Type':'application/json'},
        body:body === undefined ? undefined : JSON.stringify(body),
        signal:AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
      });
    } catch {
      throw new Error('Mất kết nối với máy chủ Wi-Fi. Hãy kiểm tra mạng rồi thử lại.');
    }
    if (response.status === 204) return null;
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Máy chủ chưa xử lý được thao tác.');
    return value;
  }
  function addProducts(catalog) {
    if (!catalog) return;
    for (const p of sharedProducts) if (!catalog.some(item => item.id === p.id)) catalog.push(p);
  }
  function apply(state) {
    if (!state || state.revision <= revision) return;
    revision = state.revision;
    sharedProducts = state.products;
    addProducts(window.WEBUY_PRODUCTS);
    localStorage.setItem(prefix+'uid', JSON.stringify(state.uid));
    localStorage.setItem(prefix+'groups', JSON.stringify(state.groups));
    document.dispatchEvent(new Event('webuy:lan-state'));
  }
  apply(initial);
  function requestId() {
    return Array.from(crypto.getRandomValues(new Uint32Array(4)), n=>n.toString(16).padStart(8,'0')).join('');
  }
  async function change(path, data) {
    const result = await call(path,data);
    apply(result.state);
    return result.id;
  }
  async function create(product, region, hours) {
    const key = 'webuy_lan_create_' + product.id;
    const id = sessionStorage.getItem(key) || requestId();
    sessionStorage.setItem(key,id);
    const result = await change('',{productId:product.id,product:product.shopId ? product : undefined,region,hours,requestId:id});
    sessionStorage.removeItem(key);
    return result;
  }
  async function syncNow() { apply(await call('?since='+revision)); }
  let polling = false;
  async function refresh() {
    if (document.hidden || polling) return;
    polling = true;
    try { await syncNow(); }
    catch { return; } // Keep the last snapshot while disconnected.
    finally { polling = false; }
  }
  window.WeBuyLan = {
    create, requestId, addProducts, refresh, syncNow, shareOrigin:initial.shareOrigin || location.origin,
    join:id=>change('/'+encodeURIComponent(id)+'/join',{}),
    leave:id=>change('/'+encodeURIComponent(id)+'/leave',{}),
    messages:(id,after)=>call('/'+encodeURIComponent(id)+'/messages?after='+after),
    send:(id,message)=>call('/'+encodeURIComponent(id)+'/messages',message)
  };
  setInterval(refresh,1500);
  for (const name of ['online','pageshow','focus']) window.addEventListener(name,refresh);
  document.addEventListener('visibilitychange',refresh);
})();
