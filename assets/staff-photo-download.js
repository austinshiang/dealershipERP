/* ERP Staff Photo Download v4.14.0
 * SINGLE OWNER: mobile photo long-press and desktop per-photo batch download.
 * Storage: Google Drive. Transport: existing GAS PublicPhotoBridge V4.11.
 * Intentionally no ZIP, no cross-origin direct links, no window.open, no renaming.
 * Browser permission prompts and iOS asynchronous download restrictions still apply.
 */
(function () {
  'use strict';
  if (window.ERP_PHOTO_DOWNLOAD_414) return;
  const VERSION = '4.14.0';
  const MOBILE = window.matchMedia('(pointer: coarse)').matches;
  const MAX_CONCURRENT = 3;
  const MAX_BATCH = 80;
  const MAX_BASE64_CHARS = 9 * 1024 * 1024;
  const MIME_EXT = Object.freeze({'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'});
  const $ = id => document.getElementById(id);
  let busy = false, touchTimer = null, touchStart = null, suppressUntil = 0, saveAgain = null;

  function status(message, done, total) {
    const msg = $('photo-download-status');
    if (msg) msg.textContent = message;
    const host = document.querySelector('.erp46-download-bar');
    if (!host) return;
    let bar = $('erp414-progress');
    if (!bar) {
      bar = document.createElement('progress'); bar.id = 'erp414-progress';
      bar.style.cssText = 'display:block;flex-basis:100%;width:100%;height:12px;margin:7px 0;accent-color:#17835e';
      host.appendChild(bar);
    }
    bar.max = Math.max(1, Number(total) || 1); bar.value = Math.max(0, Number(done) || 0);
  }
  function clearSaveAgain() {
    saveAgain = null;
    const b = $('erp414-save-again'); if (b) b.remove();
  }
  function enableManualSave(result, position) {
    saveAgain = {result, position};
    const host = document.querySelector('.erp46-download-bar');
    if (!host) return;
    let b = $('erp414-save-again');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'erp414-save-again';
      b.className = 'btn-lite'; host.appendChild(b);
    }
    b.textContent = '若沒有下載，點此儲存照片';
  }
  function photoUrls() {
    const thumbs = Array.from(document.querySelectorAll('#thumbs [data-photo] img'));
    const urls = thumbs.length ? thumbs.map(img => img.getAttribute('src')) : [$('featured-img')?.getAttribute('src')];
    return urls.filter(Boolean).slice(0, MAX_BATCH);
  }
  function photoIndex() {
    const selected = document.querySelector('#thumbs [data-photo].selected');
    return Math.max(0, Number(selected?.getAttribute('data-photo') || 0) || 0);
  }
  function driveId(url) {
    const m = String(url || '').match(/(?:[?&]id=|\/file\/d\/|\/d\/)([a-zA-Z0-9_-]{20,})/);
    return m ? m[1] : '';
  }
  function validBridgeOrigin(origin) {
    try {
      const u = new URL(origin);
      return u.protocol === 'https:' && (u.hostname === 'script.google.com' || u.hostname === 'script.googleusercontent.com' || u.hostname.endsWith('.googleusercontent.com'));
    } catch (_) { return false; }
  }
  function bridgeRequest(photoUrl) {
    const id = driveId(photoUrl);
    if (!id) return Promise.reject(Error('照片網址無法解析 Drive 檔案 ID'));
    let address;
    try {
      address = new URL(String(window.ERP_SITE?.ADMIN_URL || ''));
      if (address.protocol !== 'https:' || address.hostname !== 'script.google.com' ||
          !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(address.pathname)) throw Error('後台網址格式錯誤');
    } catch (_) { return Promise.reject(Error('後台 Apps Script 網址未正確設定')); }
    const nonceBytes = new Uint8Array(16);
    window.crypto.getRandomValues(nonceBytes);
    const nonce = Array.from(nonceBytes, v => v.toString(16).padStart(2, '0')).join('');
    address.searchParams.set('staffPhotoBridge', '1');
    address.searchParams.set('photoId', id); address.searchParams.set('nonce', nonce);
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;opacity:0;border:0;pointer-events:none';
      frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
      let settled = false;
      const timer = setTimeout(() => end(Error('讀取逾時；請確認 PublicPhotoBridge 已部署且照片為公開狀態')), 35000);
      function end(error, data) {
        if (settled) return; settled = true; clearTimeout(timer);
        window.removeEventListener('message', onMessage); frame.remove();
        if (error) reject(error); else resolve(data);
      }
      function onMessage(event) {
        if (event.source !== frame.contentWindow || !validBridgeOrigin(event.origin)) return;
        const payload = event.data;
        if (!payload || payload.type !== 'ERP_PUBLIC_PHOTO_V411' || payload.nonce !== nonce) return;
        if (!payload.ok) return end(Error(String(payload.error || '後端拒絕下載')));
        const b64 = String(payload.base64 || '');
        if (!Object.hasOwn(MIME_EXT, String(payload.mime || '')) ||
            b64.length < 4 || b64.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
          return end(Error('傳回的圖片格式或大小不符合要求'));
        }
        end(null, payload);
      }
      window.addEventListener('message', onMessage);
      frame.src = address.href; document.body.appendChild(frame);
    });
  }
  function savePhoto(result, position) {
    const str = atob(result.base64);
    const raw = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) raw[i] = str.charCodeAt(i);
    const mime = result.mime;
    const input = String(result.filename || '').trim();
    // The original filename is retained. Only strip dangerous path/OS characters.
    const cleaned = input.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 160);
    const filename = cleaned && /\.(jpe?g|png|webp|gif)$/i.test(cleaned)
      ? cleaned : `照片_${String(position + 1).padStart(2, '0')}.${MIME_EXT[mime]}`;
    const url = URL.createObjectURL(new Blob([raw], {type: mime}));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function download(mode) {
    if (busy) { status('照片正在下載，請稍候', 0, 1); return; }
    const urls = photoUrls();
    const positions = (mode === 'all' && !MOBILE ? urls.map((url, position) => ({url, position})) :
      [{url: urls[photoIndex()], position: photoIndex()}]).filter(x => x.url);
    if (!positions.length) { status('這台車沒有可下載的照片', 0, 1); return; }
    clearSaveAgain(); busy = true;
    ['download-current-photo', 'download-all-photos'].forEach(id => {if ($(id)) $(id).disabled = true;});
    let cursor = 0, attempted = 0, failures = [];
    status(`正在讀取 0 / ${positions.length} 張照片…`, 0, positions.length);
    async function worker() {
      while (cursor < positions.length) {
        const p = positions[cursor++];
        try {
          const item = await bridgeRequest(p.url);
          savePhoto(item, p.position);
          if (MOBILE) enableManualSave(item, p.position);
        } catch (e) { failures.push(`第 ${p.position + 1} 張：${e?.message || String(e)}`); }
        attempted++;
        status(`已送出 ${attempted} / ${positions.length} 張下載請求${failures.length ? `（${failures.length} 張失敗）` : ''}`,
          attempted, positions.length);
      }
    }
    try {
      await Promise.all(Array.from({length: Math.min(MOBILE ? 1 : MAX_CONCURRENT, positions.length)}, () => worker()));
    } finally {
      busy = false;
      ['download-current-photo', 'download-all-photos'].forEach(id => {if ($(id)) $(id).disabled = false;});
      if (failures.length) status(`有 ${failures.length} 張失敗：${failures.slice(0,2).join('；')}`, attempted, positions.length);
      else status(`已送出 ${attempted} 張下載請求${MOBILE ? '；如未儲存，請點「點此儲存照片」' : '；請查看瀏覽器下載清單並允許多檔下載'}`,
        attempted, positions.length);
    }
  }
  function refreshControls() {
    const all = $('download-all-photos');
    if (all) {
      const label = '↓ 一鍵下載全部照片（逐張）';
      if (all.textContent !== label) all.textContent = label;
      if (MOBILE) all.style.display = 'none';
    }
    const one = $('download-current-photo');
    if (one && one.textContent !== '↓ 下載目前照片') one.textContent = '↓ 下載目前照片';
    const legacy = $('erp47-mobile-save'); if (legacy) legacy.classList.add('hidden');
  }
  // Capture handles any stale legacy staff.js event handlers without opening new tabs.
  document.addEventListener('click', function (ev) {
    const button = ev.target?.closest?.('#download-current-photo,#download-all-photos,#erp47-mobile-download,#erp47-mobile-open,#erp414-save-again');
    if (button) {
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (button.id === 'erp414-save-again') {
        if (saveAgain) savePhoto(saveAgain.result, saveAgain.position);
        return;
      }
      if (button.id === 'erp47-mobile-open') return;
      void download(button.id === 'download-all-photos' && !MOBILE ? 'all' : 'one');
      return;
    }
    if (Date.now() < suppressUntil && ev.target?.closest?.('#featured,#featured-img,#lightbox-img')) {
      ev.preventDefault(); ev.stopImmediatePropagation();
    }
  }, true);
  if (MOBILE) {
    document.addEventListener('touchstart', ev => {
      if (ev.touches.length !== 1 || !ev.target?.closest?.('#featured-img,#lightbox-img')) return;
      const t = ev.touches[0]; touchStart = {x:t.clientX, y:t.clientY};
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => {
        touchTimer = null; suppressUntil = Date.now() + 1500;
        void download('one');
      }, 600);
    }, {capture:true, passive:true});
    document.addEventListener('touchmove', ev => {
      if (!touchStart || ev.touches.length !== 1) return;
      if (Math.hypot(ev.touches[0].clientX - touchStart.x, ev.touches[0].clientY - touchStart.y) > 12) {
        clearTimeout(touchTimer); touchTimer = null;
      }
    }, {capture:true, passive:true});
    for (const evt of ['touchend', 'touchcancel']) document.addEventListener(evt, () => {
      clearTimeout(touchTimer); touchTimer = null; touchStart = null;
    }, {capture:true, passive:true});
    document.addEventListener('contextmenu', ev => {
      if (ev.target?.closest?.('#featured-img,#lightbox-img')) ev.preventDefault();
    }, true);
  }
  const style = document.createElement('style');
  style.textContent = '#erp47-mobile-save{display:none!important}#featured-img,#lightbox-img{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}';
  document.head.appendChild(style);
  const modal = $('modal-body') || document.body;
  const observer = new MutationObserver(refreshControls);
  observer.observe(modal, {childList:true, subtree:false});
  refreshControls();
  window.ERP_PHOTO_DOWNLOAD_414 = Object.freeze({version: VERSION, downloadOne: () => download('one'), downloadAll: () => download('all'), suppressPhotoClick: () => Date.now() < suppressUntil});
})();
