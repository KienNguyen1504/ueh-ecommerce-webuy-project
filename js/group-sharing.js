/* WeBuy – Share groups via Web Share / clipboard / QR URL. Wi-Fi sessions share group state through the local server. */
(() => {
  'use strict';
  const lan = window.WeBuyLan;
  const KEY = 'webuy_demo_v2_groups';
  const products = () => window.WEBUY_PRODUCTS || [];
  const groups = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = msg => { const el = document.getElementById('app-toast'); if (!el) return; el.textContent = msg; el.className = 'app-toast show'; setTimeout(() => el.classList.remove('show'), 3000); };
  const shareUrl = group => {
    const p = products().find(x => String(x.id) === String(group.productId));
    if (!p) return '';
    return new URL(`product-detail.html?id=${encodeURIComponent(p.id)}&group=${encodeURIComponent(group.id)}#group-${encodeURIComponent(group.id)}`, lan?.shareOrigin || location.href).href;
  };
  const openDialog = (group, url) => {
    const root = document.getElementById('app-dialog-root') || (() => { const n=document.createElement('div'); n.id='app-dialog-root'; document.body.append(n); return n; })();
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(url)}`;
    root.innerHTML = `<div class="app-modal-backdrop" data-share-backdrop><section class="app-modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title"><button type="button" class="modal-close" data-share-close aria-label="Đóng">×</button><span class="demo-pill">CHIA SẺ DEMO</span><h2 id="share-title">Chia sẻ nhóm mua</h2><p>Liên kết mở đúng trang sản phẩm và mã nhóm trong URL.</p><div class="share-field"><input id="group-share-link" value="${esc(url)}" readonly><button type="button" data-share-copy>Sao chép</button></div><div class="share-qr-wrap"><img src="${qr}" alt="Mã QR cho liên kết nhóm" loading="lazy"><span>Quét QR để mở liên kết</span></div><p class="share-local-warning">${lan ? 'Bạn bè mở liên kết trên cùng Wi-Fi và bấm Tham gia nhóm để vào chat.' : 'Nhóm trong bản tĩnh lưu bằng localStorage. Dùng bản Wi-Fi để mời bạn bè trên điện thoại khác.'}</p><div class="share-modal-actions"><button class="btn btn-primary" type="button" data-share-native>${navigator.share ? 'Chia sẻ qua ứng dụng' : 'Sao chép liên kết'}</button><button class="btn btn-outline" type="button" data-share-close>Đóng</button></div></section></div>`;
  };
  async function copyText(text) {
    try { if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(text); else { const input=document.createElement('textarea'); input.value=text; input.style.position='fixed'; input.style.opacity='0'; document.body.append(input); input.select(); const ok=document.execCommand('copy'); input.remove(); if(!ok) throw new Error('copy'); } toast('Đã sao chép liên kết nhóm.'); }
    catch { const input=document.getElementById('group-share-link'); input?.focus(); input?.select(); toast('Hãy sao chép liên kết đang được chọn.'); }
  }
  document.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-share-group]');
    if (trigger) {
      const group = groups().find(g => String(g.id) === String(trigger.dataset.shareGroup));
      const url = group && shareUrl(group);
      if (!url) { toast('Không tìm thấy nhóm hoặc sản phẩm tương ứng.'); return; }
      if (navigator.share) {
        try { await navigator.share({ title: 'Nhóm mua trên WeBuy', text: lan ? 'Cùng tham gia nhóm mua của mình trên WeBuy nhé!' : 'Xem nhóm mua chung trên WeBuy (bản demo).', url }); return; }
        catch (err) { if (err?.name === 'AbortError') return; }
      }
      openDialog(group, url);
      const qrImage = document.querySelector('.share-qr-wrap img');
      qrImage?.addEventListener('error', () => {
        const note = document.querySelector('.share-qr-wrap span');
        if (note) note.textContent = 'Không tải được ảnh QR; hãy dùng liên kết để sao chép.';
        qrImage.remove();
      }, { once: true });
      document.getElementById('group-share-link')?.focus();
      return;
    }
    if (event.target.closest('[data-share-copy]')) { const input=document.getElementById('group-share-link'); if(input) await copyText(input.value); }
    if (event.target.closest('[data-share-native]')) {
      const input=document.getElementById('group-share-link');
      if (input && navigator.share) { try { await navigator.share({ title:'Nhóm mua trên WeBuy', url:input.value }); } catch(err) { if(err?.name !== 'AbortError') toast('Không thể mở chức năng chia sẻ trên thiết bị.'); } }
      else if (input) await copyText(input.value);
    }
    if (event.target.closest('[data-share-close]') || event.target.matches('[data-share-backdrop]')) document.getElementById('app-dialog-root')?.replaceChildren();
  });
  const chat = document.createElement('dialog');
  chat.className = 'group-chat';
  chat.setAttribute('aria-labelledby', 'chat-title');
  chat.innerHTML = `<header><button type="button" data-chat-close aria-label="Quay lại">←</button><img alt=""><div><h2 id="chat-title"></h2><small data-chat-status></small></div></header>
    <div class="chat-thread" role="log" aria-live="polite"></div>
    <small class="chat-local" role="status">${lan ? 'Chat nhóm qua Wi-Fi' : 'Chat demo · Lịch sử lưu trên trình duyệt này'}</small>
    <form><label class="sr-only" for="chat-text">Tin nhắn nhóm</label><input id="chat-text" maxlength="1000" autocomplete="off" placeholder="Nhắn cho nhóm…" required><button type="submit">Gửi</button></form>`;
  document.body.append(chat);
  const thread = chat.querySelector('.chat-thread');
  const composer = chat.querySelector('input');
  let activeGroup = '';
  const status = chat.querySelector('.chat-local');
  let remoteMessages = [], generation = 0, fetching = false, retry = null;
  async function fetchMessages() {
    if (!lan || !chat.open || document.hidden || fetching) return;
    const ticket = generation, room = activeGroup;
    fetching = true;
    try {
      let batch;
      do {
        batch = await lan.messages(room, remoteMessages.at(-1)?.seq || 0);
        if (ticket !== generation || !chat.open) return;
        remoteMessages.push(...batch);
        if (batch.length) drawChat();
      } while (batch.length === 100);
      status.textContent = 'Chat nhóm qua Wi-Fi';
    } catch (error) {
      if (ticket === generation) status.textContent = error.message;
    } finally {
      if (ticket === generation) fetching = false;
    }
  }
  if (lan) {
    setInterval(fetchMessages,1000);
    document.addEventListener('visibilitychange',fetchMessages);
    document.addEventListener('webuy:lan-state',()=>{ if (chat.open) drawChat(); });
    window.addEventListener('online',fetchMessages);
  }
  const keyPrefix = () => 'webuy_demo_v2_chat:' + encodeURIComponent(activeGroup) + ':';
  const member = () => {
    const group = groups().find(g => g.id === activeGroup);
    return group?.members?.includes(JSON.parse(localStorage.getItem('webuy_demo_v2_uid'))) ? group : null;
  };
  function drawChat() {
    const group = member();
    if (!group) { if (chat.open) chat.close(); return; }
    const messages = lan ? remoteMessages : Object.keys(localStorage).filter(k => k.startsWith(keyPrefix())).map(k => {
      try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
    }).filter(Boolean).sort((a,b) => a.time - b.time);
    const count = group.members.length + (group.demoCount || 0);
    const deadline = new Date(group.endsAt).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    chat.querySelector('[data-chat-status]').textContent = `${count}/${group.need} thành viên · ${count >= group.need ? 'Đủ người' : Date.now() >= group.endsAt ? 'Đã hết hạn' : 'Chốt ' + deadline}`;
    thread.innerHTML = '<p class="chat-event">Bạn đã tham gia nhóm</p>';
    let day = '';
    for (const message of messages) {
      const date = new Date(message.time);
      const label = date.toLocaleDateString('vi-VN');
      if (day !== label) {
        const el = document.createElement('p'); el.className = 'chat-event'; el.textContent = label; thread.append(el); day = label;
      }
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble' + (message.uid === JSON.parse(localStorage.getItem('webuy_demo_v2_uid')) ? ' mine' : '');
      const sender = document.createElement('b'), content = document.createElement('p'), time = document.createElement('time');
      sender.textContent = message.name; content.textContent = message.text;
      time.textContent = date.toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'});
      bubble.append(sender, content, time); thread.append(bubble);
    }
    thread.scrollTop = thread.scrollHeight;
  }
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-chat-group]');
    if (!button) return;
    activeGroup = button.dataset.chatGroup;
    const group = member(), product = group && products().find(p => p.id === group.productId);
    if (!product) { toast('Hãy tham gia nhóm để mở cuộc trò chuyện.'); return; }
    chat.querySelector('img').src = product.image;
    chat.querySelector('h2').textContent = product.name;
    generation++; remoteMessages = []; fetching = false; retry = null;
    composer.value = ''; composer.disabled = false; chat.querySelector('[type="submit"]').disabled = false;
    chat.showModal(); drawChat(); fetchMessages(); composer.focus();
  });
  chat.querySelector('[data-chat-close]').onclick = () => chat.close();
  chat.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const text = composer.value.trim();
    if (!member()) { chat.close(); return; }
    if (!text) { composer.focus(); return; }
    const name = JSON.parse(localStorage.getItem('webuy_demo_v2_profile') || '{}').name || 'Khách WeBuy';
    const uid = JSON.parse(localStorage.getItem('webuy_demo_v2_uid'));
    if (lan) {
      if (composer.disabled) return;
      const room = activeGroup, ticket = generation;
      if (!retry || retry.text !== text) retry = {requestId:lan.requestId(),text,
        name:(name === 'Khách WeBuy' ? 'Thành viên ' + uid.slice(-4).toUpperCase() : name).slice(0,80)};
      const send = chat.querySelector('[type="submit"]');
      composer.disabled = send.disabled = true;
      try {
        await lan.send(room,retry);
        if (ticket !== generation) return;
        composer.value = ''; retry = null;
        await fetchMessages();
      } catch (error) {
        if (ticket === generation) status.textContent = error.message + ' Tin nhắn còn ở ô soạn.';
      } finally {
        if (ticket === generation) { composer.disabled = send.disabled = false; composer.focus(); }
      }
      return;
    }
    const time = Date.now(), id = crypto.randomUUID?.() || time.toString(36) + Math.random().toString(36).slice(2);
    try { localStorage.setItem(keyPrefix() + id, JSON.stringify({time, uid, name, text})); }
    catch { composer.setCustomValidity('Bộ nhớ đầy. Chưa lưu được tin nhắn.'); composer.reportValidity(); return; }
    composer.value = ''; drawChat(); composer.focus();
  };
  composer.oninput = () => composer.setCustomValidity('');
  window.addEventListener('storage', e => {
    if (chat.open && (!e.key || e.key === KEY || e.key.startsWith(keyPrefix()))) drawChat();
  });
  window.WeBuyGroupSharing = { buildUrl: group => shareUrl(group) };
})();
