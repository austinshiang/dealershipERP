/* ERP V4.11 GitHub staff photo download – background Apps Script bridge */
(function(){
'use strict';
var busy=false, longTimer=null, started=null, suppressClick=0;
function el(id){return document.getElementById(id);}
function driveId(url){var m=String(url||'').match(/(?:[?&]id=|\/file\/d\/|\/d\/)([A-Za-z0-9_-]{20,})/);return m?m[1]:'';}
function photoUrls(){
 var a=Array.from(document.querySelectorAll('#thumbs [data-photo] img')).map(function(x){return x.getAttribute('src');}).filter(Boolean);
 if(a.length)return a;var img=el('featured-img');return img&&img.getAttribute('src')?[img.getAttribute('src')]:[];
}
function selectedIndex(){var n=document.querySelector('#thumbs [data-photo].selected');return n?Math.max(0,Number(n.getAttribute('data-photo'))||0):0;}
function allowedOrigin(origin){try{var u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='script.google.com'||u.hostname==='script.googleusercontent.com'||u.hostname.endsWith('.googleusercontent.com'));}catch(e){return false;}}
function bridgeRequest(url){
 var id=driveId(url);if(!id)return Promise.reject(Error('這張照片無法辨識 Drive ID'));
 var admin=String((window.ERP_SITE||{}).ADMIN_URL||'');
 var u=new URL(admin);
 if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname))return Promise.reject(Error('後台網址設定不正確'));
 var bytes=new Uint8Array(16);crypto.getRandomValues(bytes);var nonce=Array.from(bytes).map(function(n){return n.toString(16).padStart(2,'0');}).join('');
 u.searchParams.set('staffPhotoBridge','1');u.searchParams.set('photoId',id);u.searchParams.set('nonce',nonce);
 return new Promise(function(resolve,reject){
  var finished=false,frame=document.createElement('iframe'),timer;
  frame.style.cssText='position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;border:0;pointer-events:none';
  frame.setAttribute('aria-hidden','true');frame.setAttribute('tabindex','-1');
  function finish(error,result){if(finished)return;finished=true;clearTimeout(timer);window.removeEventListener('message',onMessage);frame.remove();if(error)reject(error);else resolve(result);}
  function onMessage(event){var v=event.data;if(!allowedOrigin(event.origin)||!v||v.type!=='ERP_PUBLIC_PHOTO_V411'||v.nonce!==nonce)return;
    if(!v.ok)return finish(Error(String(v.error||'伺服器拒絕下載')));
    if(!/^image\/(jpeg|png|webp|gif)$/.test(String(v.mime||''))||!String(v.base64||'').match(/^[A-Za-z0-9+/=]+$/)||v.base64.length>9*1024*1024)return finish(Error('圖片內容不正確或檔案過大'));
    finish(null,v);
  }
  window.addEventListener('message',onMessage);
  timer=setTimeout(function(){finish(Error('讀取逾時，請先在 Google Apps Script 部署 V4.11 公開照片橋接頁'));},28000);
  frame.src=u.href;document.body.appendChild(frame);
 });
}
function saveBlob(result,order){
 var b=atob(result.base64),bytes=new Uint8Array(b.length);for(var j=0;j<b.length;j++)bytes[j]=b.charCodeAt(j);
 var blob=new Blob([bytes],{type:result.mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 var ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[result.mime]||'jpg';
 a.href=url;a.download='ERP_car_photo_'+String(order+1).padStart(2,'0')+'.'+ext;a.style.display='none';
 document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},45000);
}
function progress(msg,done,total,error){
 var box=el('photo-download-status');if(box)box.textContent=msg;
 var host=document.querySelector('.erp46-download-bar');if(!host)return;
 var bar=el('staff411-progress');
 if(!bar){bar=document.createElement('progress');bar.id='staff411-progress';bar.style.cssText='display:block;flex-basis:100%;height:12px;width:100%;accent-color:#168866;margin:8px 0 2px';host.appendChild(bar);}
 bar.max=total||1;bar.value=done;bar.title=msg;bar.style.accentColor=error?'#b54d4d':'#168866';
}
async function downloadIndexes(indexes){
 if(busy){progress('已有照片正在下載中',0,0,false);return;}
 var list=photoUrls(),selected=indexes.map(function(i){return {index:i,url:list[i]};}).filter(function(x){return !!x.url;}).slice(0,60);
 if(!selected.length)return;busy=true;
 var buttons=['download-current-photo','download-all-photos'];buttons.forEach(function(id){if(el(id))el(id).disabled=true;});
 var done=0,failed=[];
 progress('正在準備照片下載…',0,selected.length,false);
 for(var i=0;i<selected.length;i++){
  var row=selected[i];progress('正在讀取第 '+(i+1)+' 張照片…',i,selected.length,false);
  try{var file=await bridgeRequest(row.url);saveBlob(file,row.index);}
  catch(e){failed.push('第 '+(row.index+1)+' 張：'+(e.message||String(e)));}
  done++;progress('已處理 '+done+' / '+selected.length+' 張',done,selected.length,false);
  if(i<selected.length-1)await new Promise(function(r){setTimeout(r,220);});
 }
 progress(failed.length?'已完成 '+done+' 張，其中 '+failed.length+' 張失敗：'+failed.slice(0,2).join('；'):'已送出 '+done+' 張下載，請確認瀏覽器下載清單',done,selected.length,failed.length>0);
 buttons.forEach(function(id){if(el(id))el(id).disabled=false;});busy=false;
}
document.addEventListener('click',function(event){
 var target=event.target;if(!target||!target.closest)return;
 var button=target.closest('#download-current-photo,#download-all-photos,#erp47-mobile-download,#erp47-mobile-open');
 if(button){
  event.preventDefault();event.stopImmediatePropagation();
  if(button.id==='erp47-mobile-open')return;
  if(el('erp47-mobile-save'))el('erp47-mobile-save').classList.add('hidden');
  var photos=photoUrls(),indices=button.id==='download-all-photos'?photos.map(function(_,i){return i;}):[selectedIndex()];
  void downloadIndexes(indices);return;
 }
 if(Date.now()<suppressClick&&target.closest('#featured,#featured-img,#lightbox-img')){event.preventDefault();event.stopImmediatePropagation();}
},true);
document.addEventListener('touchstart',function(e){
 if(!e.target||!e.target.closest||!e.target.closest('#featured-img,#lightbox-img')||e.touches.length!==1)return;
 e.stopPropagation();started={x:e.touches[0].clientX,y:e.touches[0].clientY};clearTimeout(longTimer);
 longTimer=setTimeout(function(){suppressClick=Date.now()+1500;void downloadIndexes([selectedIndex()]);longTimer=null;},560);
},{capture:true,passive:true});
document.addEventListener('touchmove',function(e){
 if(!started||!e.touches.length)return;
 if(Math.hypot(e.touches[0].clientX-started.x,e.touches[0].clientY-started.y)>12)clearTimeout(longTimer);
},{capture:true,passive:true});
['touchend','touchcancel'].forEach(function(type){document.addEventListener(type,function(){clearTimeout(longTimer);started=null;},{capture:true,passive:true});});
document.addEventListener('contextmenu',function(e){if(e.target&&e.target.closest&&e.target.closest('#featured-img,#lightbox-img'))e.preventDefault();},true);
var style=document.createElement('style');style.textContent='#erp47-mobile-save{display:none!important}#featured-img,#lightbox-img{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}';document.head.appendChild(style);
})();