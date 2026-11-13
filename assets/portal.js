'use strict';
(function(){
  const cfg=window.ERP_SITE||{};
  const name=String(cfg.BRAND||'車行 ERP');
  document.getElementById('portal-brand').textContent=name;
  const admin=document.getElementById('admin-entry');
  const url=String(cfg.ADMIN_URL||'');
  if(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(url)){
    admin.href=url;admin.removeAttribute('aria-disabled');admin.rel='noopener noreferrer';
  }else{
    admin.addEventListener('click',e=>e.preventDefault());
    document.getElementById('config-alert').textContent='管理員入口尚未設定。請先修改 site-config.js 中的 ADMIN_URL。';
  }
})();
