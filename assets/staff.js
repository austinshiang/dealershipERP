'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const cfg=window.ERP_SITE||{};
  const st={cars:[],shown:[],selected:new Set(),car:null,images:[],photo:0,loading:false,staffDoc:null,homeBanners:[],homeIndex:0,homeTimer:null,staffCols:2};
  const safe=v=>String(v===null||v===undefined?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=v=>Number(v)||0;
  const val=id=>$(id)?$(id).value:'';
  const format=v=>v===''||v===undefined||v===null?'—':Number(v).toLocaleString('zh-TW',{maximumFractionDigits:1});
  function safeURL(x){let s=String(x||'').trim();if(!/^https:\/\//i.test(s))return '';return s.replace(/["'<>\s]/g,'');}
  function imageURL(s){s=safeURL(s);if(!s)return '';const m=s.match(/(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|[?&]id=)([\w-]+)/);return m?'https://drive.google.com/thumbnail?id='+encodeURIComponent(m[1])+'&sz=w1200':s;}
  function images(c){return Array.from(new Set([c['封面圖片'],...String(c['其他照片']||'').split(/[\n,;|\t ]+/)].map(imageURL).filter(Boolean)));}
  function showPhoto(c){const list=images(c);return list.length?'<img loading="lazy" src="'+safe(list[0])+'" alt="'+safe(c['廠牌']+' '+c['型號'])+'">':'<span class="no-photo">目前尚無照片</span>';}
  function dayValue(value){if(!value)return null;const m=String(value).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);return isNaN(d.getTime())?null:d;}
  function carDays(c){const from=dayValue(c['購入日期']);if(!from)return null;const to=c['販售狀態']==='售出'?dayValue(c['成交日期']):new Date();if(!to)return null;return Math.max(0,Math.floor((to.getTime()-from.getTime())/86400000));}
  function ageLabel(c){const days=carDays(c);return days===null?'未提供日期':c['販售狀態']==='售出'?'銷售期 '+days+' 天':'在庫 '+days+' 天';}
  function ageClass(c){const days=carDays(c);return days===null?'none':days>=60?'urgent':days>=30?'warn':'';}
  function locClass(value){let h=0;for(const c of String(value||''))h=((h*31)+c.charCodeAt(0))>>>0;return 'loc-'+h%8;}
  function carPrice(c){const value=c['新價格'];return value===''||value===null||value===undefined?c['開價']:value;}
  function statusClass(s){return s==='收訂'?'reserved':s==='即將到港'?'incoming':s==='售出'?'sold':'';}
  function mileage(c){const v=c['里程'];if(v===''||v===null||v===undefined)return '—';let a=parseFloat(v);if(!Number.isFinite(a))return '—';return a.toLocaleString('zh-TW',{maximumFractionDigits:1})+' 萬公里';}
  const PANO_ENGINE_V41='https://austinshiang.github.io/360-Showcase-Engine/';
  function panoramaHref(raw,vehicleTitle){
    const url=safeURL(raw);if(!url)return '';
    try{
      const u=new URL(url);
      if(u.hostname==='austinshiang.github.io'&&u.pathname.toLowerCase().replace(/\/$/,'')==='/360-showcase-engine')return url;
      if(/\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(url)||/^(?:drive\.google\.com|lh3\.googleusercontent\.com)$/.test(u.hostname))
        return PANO_ENGINE_V41+'?url='+encodeURIComponent(url)+'&title='+encodeURIComponent(vehicleTitle||'360° 實境賞車');
      return url;
    }catch(e){return '';}
  }
  function soldDate(c){return String(c['成交日期']||'').trim()||'未登錄';}
  const isSold=c=>c['販售狀態']==='售出';
  function unique(field){return [...new Set(st.cars.map(c=>String(c[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-TW'));}
  const filterDefs={brand:['廠牌','廠牌'],location:['在庫位子','在庫位子'],status:['販售狀態','車輛狀態'],'sale-type':['售賣形式','售賣形式']};
  function selectedFor(id){return Array.from(document.querySelectorAll('#filter-'+id+' input[type="checkbox"]:checked')).map(x=>x.value);}
  function rebuildOptions(){
    for(const [id,[field,label]] of Object.entries(filterDefs)){
      const host=$('filter-'+id);if(!host)continue;
      const previous=host.dataset.initialized?selectedFor(id):id==='status'?['在庫','收訂','即將到港']:[];
      const vals=id==='status'?['在庫','收訂','即將到港','售出']:id==='sale-type'?['零售','寄賣']:unique(field);
      const all=vals.map(v=>'<label class="multi-option"><input type="checkbox" value="'+safe(v)+'" '+(previous.includes(v)?'checked':'')+'><span>'+safe(v)+'</span><small>'+st.cars.filter(c=>(c[field]|| (id==='status'?'在庫':'零售'))===v).length+'</small></label>').join('');
      host.innerHTML=all||'<span class="small-muted">沒有可選項目</span>';host.dataset.initialized='1';
      updateFacetLabel(id,label);
    }
  }
  function updateFacetLabel(id,label){const checked=selectedFor(id);const out=$('filter-label-'+id);if(out)out.textContent=checked.length?label+' · 已選 '+checked.length:label+' · 全部';}
  function filtered(){const q=val('search').trim().toLowerCase();
    const brands=selectedFor('brand'),locations=selectedFor('location'),statuses=selectedFor('status'),forms=selectedFor('sale-type');
    const arr=st.cars.filter(c=>{
      if(brands.length&&!brands.includes(c['廠牌']))return false;
      if(locations.length&&!locations.includes(c['在庫位子']))return false;
      if(forms.length&&!forms.includes(c['售賣形式']||'零售'))return false;
      if(statuses.length&&!statuses.includes(c['販售狀態']||'在庫'))return false;
      if(q&&!['廠牌','型號','年份','顏色','燃料形式','公開配備','在庫位子','優惠標籤'].some(k=>String(c[k]||'').toLowerCase().includes(q)))return false;
      return true;
    });
    const sort=val('sort');if(sort==='price-asc')arr.sort((a,b)=>n(carPrice(a))-n(carPrice(b)));
    else if(sort==='price-desc')arr.sort((a,b)=>n(carPrice(b))-n(carPrice(a)));
    else if(sort==='km')arr.sort((a,b)=>n(a['里程'])-n(b['里程']));
    else if(sort==='age')arr.sort((a,b)=>(carDays(b)||0)-(carDays(a)||0));
    else arr.sort((a,b)=>(dayValue(b['購入日期'])||0)-(dayValue(a['購入日期'])||0));
    return arr;
  }
  // V3.8.3: 以 Google Apps Script 管理後台車卡作為一致的版型參考。
  // 公開快照沒有車號等私人欄位，因此此處不顯示也不嘗試讀取。
  function card(c){
    const index=st.cars.indexOf(c),status=String(c['販售狀態']||'在庫'),p=carPrice(c);
    const name=[c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' ');
    const location=String(c['在庫位子']||'未分類'),sale=String(c['售賣形式']||'零售');
    const original=c['開價'];
    const discounted=c['新價格']!==''&&c['新價格']!=null&&n(c['新價格'])!==n(original)&&original!=='';
    const specs=[
      '里程 '+mileage(c),
      '排氣量 '+String(c['排氣量']||'—'),
      '顏色 '+String(c['顏色']||'—'),
      '燃料 '+String(c['燃料形式']||'—')
    ];
    return '<article class="car-card '+locClass(location)+' '+(isSold(c)?'sold-card':'')+' '+(status==='收訂'?'reserved-card':'')+'" tabindex="0" role="button" data-car="'+index+'" aria-label="查看 '+safe(name)+' 詳情">'+
      '<div class="image-wrap">'+showPhoto(c)+'<span class="status-badge '+statusClass(status)+'">'+safe(status)+'</span>'+(isSold(c)?'<span class="sold-stamp" aria-label="已售出">SOLD<small>已售出</small></span>':'')+'</div>'+
      '<div class="card-info">'+
        '<h3>'+safe(name)+'</h3>'+
        '<div class="tiny-tags"><span class="tiny-tag location-tag">● '+safe(location)+'</span><span class="tiny-tag sale '+(sale==='寄賣'?'consignment':'')+'">'+safe(sale)+'</span>'+(c['優惠標籤']?'<span class="tiny-tag">'+safe(c['優惠標籤'])+'</span>':'')+'</div>'+
        '<div class="card-date"><span>購入 '+safe(c['購入日期']||'—')+'</span><span class="age '+ageClass(c)+'">'+safe(ageLabel(c))+'</span>'+(isSold(c)?'<span class="sold-date">成交日期 '+safe(soldDate(c))+'</span>':'')+'</div>'+
        '<div class="card-specs">'+specs.map(t=>'<span>'+safe(t)+'</span>').join('')+'</div>'+
        '<div class="price-row">'+(discounted?'<div class="old-price">原價 '+safe(format(original))+' 萬</div>':'<span></span>')+'<strong>'+safe(format(p))+'<small> 萬</small></strong></div>'+
      '</div></article>';
  }
  function render(){st.shown=filtered();$('result-count').textContent='符合 '+st.shown.length+' 台車';
    $('count-stock').textContent=st.cars.filter(c=>!isSold(c)).length;
    $('count-reserved').textContent=st.cars.filter(c=>c['販售狀態']==='收訂').length;
    $('count-incoming').textContent=st.cars.filter(c=>c['販售狀態']==='即將到港').length;
    $('car-grid').classList.remove('erp45-cols-1','erp45-cols-2','erp45-cols-4');$('car-grid').classList.add('erp45-cols-'+st.staffCols);$('car-grid').innerHTML=st.shown.map(card).join('');
    const m=$('message');m.classList.toggle('hidden',st.shown.length>0);
    if(!st.shown.length&&!st.loading){m.textContent=st.cars.length?'目前沒有符合篩選條件的車輛。':'尚未發布車源，請管理員在 Google 後台按「發布員工車源」。';}
  }
  // V3.9: Password is a light UI gate only. The JSON itself remains publicly reachable.
  async function sha256Hex(text){
    if(!window.crypto || !crypto.subtle)throw new Error('此瀏覽器不支援安全雜湊，請使用 HTTPS 網址');
    const bytes=new TextEncoder().encode(text);
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    return Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function staffDataUrl(){const url=String(cfg.STAFF_DATA||'./data/vehicles.json');const u=new URL(url,location.href);
    if(u.origin!==location.origin)throw new Error('資料位置必須在相同網站');return u;}
  async function getStaffDoc(){
    const u=staffDataUrl();u.searchParams.set('t',String(Date.now()));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{const r=await fetch(u.href,{cache:'no-store',signal:controller.signal});if(!r.ok)throw new Error('HTTP '+r.status);
      const doc=await r.json();if(doc.schemaVersion!==1||!Array.isArray(doc.items))throw new Error('資料格式與版本不符');return doc;
    }finally{clearTimeout(timer);}
  }
  function showGateMessage(s,error){const el=$('staff-gate-note');el.textContent=s;el.classList.toggle('error',Boolean(error));}
  async function verifyGate(doc,password){const gate=doc.staffAccess;
    if(!gate||gate.configured===false||!/^[a-f0-9]{32}$/.test(String(gate.salt))||!/^[a-f0-9]{64}$/.test(String(gate.verifier)))
      throw new Error('尚未設定員工端入口密碼，請管理員在 Google 後台設定並發布車源。');
    return (await sha256Hex(String(gate.salt)+':'+password))===gate.verifier;
  }
  async function gateLogin(e){e.preventDefault();const p=$('staff-gate-pass').value;if(!/^\d+$/.test(p)){showGateMessage('請輸入純數字密碼',true);return;}
    const b=$('staff-gate-submit');b.disabled=true;showGateMessage('正在驗證已發布的入口密碼…',false);
    try{const doc=await getStaffDoc();if(!await verifyGate(doc,p))throw new Error('密碼錯誤，請向管理員確認。');
      $('staff-gate-pass').value='';$('staff-gate').classList.add('hidden');$('staff-app').classList.remove('hidden');
      st.staffDoc=doc;await load(doc);
    }catch(err){showGateMessage(err.message||String(err),true);}finally{b.disabled=false;}
  }
  function showAnnouncement(text){const value=String(text||'').trim();$('staff-notice').classList.toggle('hidden',!value);$('staff-notice-text').textContent=value;}
  function showHomeV43(){const list=st.homeBanners,root=$('staff-home-photo');if(!root)return;
    if(!list.length){root.innerHTML='<div class="staff-home-empty">DEALERSHIP · VEHICLE SHOWCASE</div>';$('staff-home-counter').textContent='尚無首頁輪播圖';$('staff-home-dots').innerHTML='';return;}
    st.homeIndex=((st.homeIndex%list.length)+list.length)%list.length;
    root.innerHTML='<img src="'+safe(list[st.homeIndex])+'" alt="首頁輪播 '+(st.homeIndex+1)+'" loading="eager">';const photo=root.querySelector('img');photo.addEventListener('error',()=>{root.innerHTML='<div class="staff-home-empty">首頁圖片讀取失敗，請確認 Google Drive 連結共用權限</div>';});
    $('staff-home-counter').textContent=(st.homeIndex+1)+' / '+list.length;
    $('staff-home-dots').innerHTML=list.map((_,i)=>'<button data-staff-dot="'+i+'" type="button" class="'+(i===st.homeIndex?'selected':'')+'" aria-label="第 '+(i+1)+' 張"></button>').join('');
  }
  function setHomeImagesV43(data){st.homeBanners=Array.isArray(data)?data.map(safeURL).filter(Boolean).slice(0,8):[];st.homeIndex=0;showHomeV43();
    if(st.homeTimer)clearInterval(st.homeTimer);st.homeTimer=null;
    if(st.homeBanners.length>1&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)st.homeTimer=setInterval(()=>{if(!$('staff-app').classList.contains('hidden')){st.homeIndex++;showHomeV43();}},5500);
  }

  async function load(prefetched){if(st.loading)return;st.loading=true;$('refresh').disabled=true;$('result-count').textContent='正在讀取…';
    const m=$('message');m.classList.remove('hidden','error');m.textContent='正在讀取已發布的車輛資料…';
    try{
      const doc=prefetched||await getStaffDoc();
      showAnnouncement(doc.announcement);setHomeImagesV43(doc.homeBanners);
      // 前端再次限制欄位：即使 GitHub 被誤放其他資訊，也不予顯示。這不取代後端過濾。
      st.cars=doc.items.map((x,i)=>({
        '廠牌':x['廠牌']||'', '型號':x['型號']||'', '年份':x['年份']||'',
        '排氣量':x['排氣量']||'', '顏色':x['顏色']||'', '里程':x['里程']??'',
        '開價':x['開價']??'', '新價格':x['新價格']??'', '燃料形式':x['燃料形式']||'',
        '照片打包連結':safeURL(x['照片打包連結']),
        '在庫位子':x['在庫位子']||'', '售賣形式':x['售賣形式']||'零售',
        '販售狀態':x['販售狀態']||'在庫', '是否認證':x['是否認證']||'',
        '封面圖片':x['封面圖片']||'', '其他照片':x['其他照片']||'',
        '購入日期':x['購入日期']||'', '成交日期':x['成交日期']||'',
        '優惠標籤':x['優惠標籤']||'', '公開配備':x['公開配備']||'',
        '360網址':x['360網址']||'', '認證書網址':x['認證書網址']||''
      }));
      $('published-at').textContent=doc.publishedAt?'資料發布：'+String(doc.publishedAt).replace('T',' ').slice(0,16):'尚未發布正式資料';
      rebuildOptions();render();
    }catch(e){st.cars=[];st.shown=[];m.classList.remove('hidden');m.classList.add('error');
      m.textContent='無法讀取員工端車源：'+(e.name==='AbortError'?'等待超過 15 秒，請檢查網路連線':e.message)+'。請確認 data/vehicles.json 已發布到 GitHub Pages，並稍後重試。';
      $('car-grid').innerHTML='';$('result-count').textContent='讀取失敗';
    }finally{st.loading=false;$('refresh').disabled=false;}
  }
  function pair(label,value){return '<div class="detail-pair"><b>'+safe(label)+'</b><span>'+safe(value===''||value===undefined||value===null?'—':value)+'</span></div>';}
  // V4.6: 下載公開車輛照片。Google Drive 跨來源禁止讀取時會引導開啟原圖，絕不聲稱打包成功。
  async function downloadOnePhotoV46(index){
    const url=st.images[index];if(!url)return;
    const name='vehicle_photo_'+String(index+1).padStart(2,'0')+'.jpg';
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      let res;try{res=await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal});}finally{clearTimeout(timer);}
      if(!res.ok||!String(res.headers.get('content-type')||'').toLowerCase().startsWith('image/'))throw new Error('照片來源無法直接儲存');
      const blob=await res.blob(),local=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=local;a.download=name;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(local),10000);
    }catch(e){
      alert('Google Drive 限制跨網站直接下載，已改為開啟照片。請在開啟的頁面使用「儲存圖片」。');
      const id=String(url).match(/[?&]id=([A-Za-z0-9_-]{20,})/);
      window.open(id?'https://drive.google.com/file/d/'+id[1]+'/view':url,'_blank','noopener,noreferrer');
    }
  }
  function zipCrc32V46(bytes){let c=-1;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xEDB88320:0);}return (c^(-1))>>>0;}
  function zipArchiveV46(files){
    const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
    const write=(a)=>{parts.push(a);offset+=a.length;};
    function header(size){const b=new Uint8Array(size);return {b,d:new DataView(b.buffer)};}
    for(const file of files){
      const name=encoder.encode(file.name),data=file.bytes,crc=zipCrc32V46(data),start=offset;
      const l=header(30+name.length);l.d.setUint32(0,0x04034b50,true);l.d.setUint16(4,20,true);l.d.setUint16(6,0x0800,true);l.d.setUint16(8,0,true);l.d.setUint32(14,crc,true);l.d.setUint32(18,data.length,true);l.d.setUint32(22,data.length,true);l.d.setUint16(26,name.length,true);l.b.set(name,30);write(l.b);write(data);
      const h=header(46+name.length);h.d.setUint32(0,0x02014b50,true);h.d.setUint16(4,20,true);h.d.setUint16(6,20,true);h.d.setUint16(8,0x0800,true);h.d.setUint32(16,crc,true);h.d.setUint32(20,data.length,true);h.d.setUint32(24,data.length,true);h.d.setUint16(28,name.length,true);h.d.setUint32(42,start,true);h.b.set(name,46);central.push(h.b);
    }
    const centralStart=offset;for(const c of central)write(c);const dirSize=offset-centralStart;
    const e=header(22);e.d.setUint32(0,0x06054b50,true);e.d.setUint16(8,files.length,true);e.d.setUint16(10,files.length,true);e.d.setUint32(12,dirSize,true);e.d.setUint32(16,centralStart,true);write(e.b);
    return new Blob(parts,{type:'application/zip'});
  }
  async function downloadZipV46(){
    if(!st.images.length)return;
    // Preferred path: admin has pre-generated a verified public ZIP in Google Drive.
    const archiveURL=safeURL(st.car?.['照片打包連結']);
    if(archiveURL){
      const link=document.createElement('a');link.href=archiveURL;link.target='_blank';link.rel='noopener noreferrer';document.body.append(link);link.click();link.remove();
      $('photo-download-status').textContent='已開啟由後台產生的照片 ZIP 下載連結。';return;
    }
    const btn=$('download-all-photos'),msg=$('photo-download-status');if(btn.disabled)return;
    btn.disabled=true;let total=0,files=[];
    try{
      if(st.images.length>60)throw new Error('超過 60 張圖片，請分批下載。');
      for(let i=0;i<st.images.length;i++){
        msg.textContent='讀取照片 '+(i+1)+' / '+st.images.length+'…';
        const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),22000);
        let res;try{res=await fetch(st.images[i],{mode:'cors',credentials:'omit',signal:ctrl.signal});}finally{clearTimeout(timer);}
        const mime=String(res.headers.get('content-type')||'').toLowerCase();
        if(!res.ok||!mime.startsWith('image/'))throw new Error('第 '+(i+1)+' 張照片無法取得影像內容');
        const buf=new Uint8Array(await res.arrayBuffer());total+=buf.length;
        if(total>100*1024*1024)throw new Error('圖片合計超過 100 MB，請改為分張下載');
        const ext=mime.includes('png')?'png':mime.includes('webp')?'webp':mime.includes('gif')?'gif':'jpg';
        files.push({name:'vehicle_photo_'+String(i+1).padStart(2,'0')+'.'+ext,bytes:buf});
      }
      msg.textContent='正在建立 ZIP 壓縮包…';
      const blob=zipArchiveV46(files),local=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=local;a.download='vehicle_photos_'+new Date().toISOString().slice(0,10)+'.zip';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(local),20000);
      msg.textContent='ZIP 已建立，共 '+files.length+' 張照片。';
    }catch(e){
      msg.textContent='無法打包：'+(e.name==='TypeError'?'圖片來源拒絕跨網站讀取':e.message)+'。請管理員在後台產生照片 ZIP 並重新發布；也可以先逐張開啟儲存。';
    }finally{btn.disabled=false;}
  }
  function openCar(index){const c=st.cars[index];if(!c)return;st.car=c;st.images=images(c);st.photo=0;
    $('modal-title').textContent=[c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' ');
    const img=st.images.length?'<img id="featured-img" src="'+safe(st.images[0])+'" alt="車輛照片">':'<span class="no-photo">尚未提供照片</span>';
    const thumbs=st.images.map((u,i)=>'<button type="button" class="thumb '+(i===0?'selected':'')+'" data-photo="'+i+'" aria-label="預覽第 '+(i+1)+' 張照片"><img src="'+safe(u)+'" alt="照片縮圖"></button>').join('');
    const fields=[['在庫位子',c['在庫位子']],['售賣形式',c['售賣形式']],['車輛狀態',c['販售狀態']],['購入日期',c['購入日期']],
      ['在庫天數／銷售期',ageLabel(c)],['售出日期',isSold(c)?soldDate(c):'—'],['年份',c['年份']],['排氣量',c['排氣量']],['顏色',c['顏色']],['里程',mileage(c)],
      ['燃料形式',c['燃料形式']],['開價（萬元）',format(c['開價'])],['新價格（萬元）',format(c['新價格'])],['是否認證',c['是否認證']]];
    $('modal-body').innerHTML='<div id="featured" class="detail-main-photo" role="button" tabindex="0" aria-label="開啟全螢幕照片">'+img+'</div>'+(
      thumbs?'<div id="thumbs" class="detail-thumbs">'+thumbs+'</div>':'')+
      '<div class="erp46-download-bar"><button type="button" id="download-current-photo" class="btn-lite" '+(!st.images.length?'disabled':'')+'>↓ 下載目前照片</button><button type="button" id="download-all-photos" class="btn-primary" '+(!st.images.length?'disabled':'')+'>↓ 一鍵打包全部照片（ZIP）</button><span id="photo-download-status" role="status" aria-live="polite"></span></div>'+
      '<div class="detail-summary"><div><span class="eyebrow">'+safe(c['販售狀態'])+' · '+safe(c['售賣形式'])+'</span><h3>'+safe([c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' '))+'</h3></div><div class="detail-price">'+safe(format(carPrice(c)))+' 萬</div></div>'+
      (isSold(c)?'<div class="sold-detail-note">SOLD · 已售出　成交日期：'+safe(soldDate(c))+'</div>':'')+
      '<div class="detail-actions">'+(safeURL(c['認證書網址'])?'<a class="btn-lite" href="'+safe(safeURL(c['認證書網址']))+'" target="_blank" rel="noopener noreferrer">檢視／下載認證書 ↗</a>':'')+(panoramaHref(c['360網址'],[c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' '))?'<a class="btn-lite" href="'+safe(panoramaHref(c['360網址'],[c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' ')))+'" target="_blank" rel="noopener noreferrer">360° 全景賞車 ↗</a>':'')+'</div>'+
      '<div class="detail-grid">'+fields.map(([a,b])=>pair(a,b)).join('')+'</div>'+
      (c['公開配備']?'<h3>車輛特色與配備</h3><div class="detail-note">'+safe(c['公開配備'])+'</div>':'')+
      '<p class="small-muted">公開唯讀快照僅供參考，成交與報價前請向管理員再次核實。</p>';
    $('car-modal').classList.remove('hidden');document.body.style.overflow='hidden';
    $('download-current-photo')?.addEventListener('click',()=>downloadOnePhotoV46(st.photo));
    $('download-all-photos')?.addEventListener('click',downloadZipV46);
    $('featured').addEventListener('click',openLightbox);
    $('featured').addEventListener('keydown',e=>{if(e.key==='Enter')openLightbox();});
    $('thumbs')?.addEventListener('click',e=>{const b=e.target.closest('[data-photo]');if(b)selectPhoto(Number(b.dataset.photo));});
  }
  function selectPhoto(index){if(!st.images.length)return;st.photo=(index+st.images.length)%st.images.length;
    const featured=$('featured-img');if(featured)featured.src=st.images[st.photo];
    document.querySelectorAll('#thumbs [data-photo]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.photo)===st.photo));
  }
  function closeCar(){st.car=null;$('car-modal').classList.add('hidden');document.body.style.overflow='';}
  function openLightbox(){if(!st.images.length)return;$('lightbox').classList.remove('hidden');updateLightbox();}
  function updateLightbox(){if(!st.images.length)return;$('lightbox-img').src=st.images[st.photo];$('lightbox-caption').textContent=(st.photo+1)+' / '+st.images.length;}
  function movePhoto(dir){if(!st.images.length)return;selectPhoto(st.photo+dir);updateLightbox();}
  function closeLightbox(){$('lightbox').classList.add('hidden');}
  function calcLoan(){const car=Number(val('loan-price')),down=Number(val('loan-down')),rate=Number(val('loan-rate')),months=Number(val('loan-months'));
    if(![car,down,rate,months].every(Number.isFinite)||car<=0||down<0||down>car||rate<0||rate>100||months<=0){$('loan-error').textContent='請確認車價、頭期款、年利率與期數。';$('loan-monthly').textContent='—';$('loan-details').textContent='';return;}
    const amount=(car-down)*10000,r=rate/1200,monthly=amount===0?0:r===0?amount/months:amount*r/(1-Math.pow(1+r,-months));
    $('loan-error').textContent='';$('loan-monthly').textContent='NT$ '+Math.round(monthly).toLocaleString('zh-TW');
    $('loan-details').textContent='本金 NT$ '+Math.round(amount).toLocaleString('zh-TW')+' · 總利息 NT$ '+Math.round(Math.max(0,monthly*months-amount)).toLocaleString('zh-TW');
  }
  const printFieldsV45={status:{label:'車輛狀態／售出與否',key:'販售狀態',options:['在庫','收訂','即將到港','售出']},sale:{label:'售賣形式',key:'售賣形式',options:['零售','寄賣']},brand:{label:'廠牌篩選',key:'廠牌'},location:{label:'在庫位置',key:'在庫位子'}};
  let printSelectedV45=null;
  function setupPrintOptionsV45(){
    const all=st.cars;
    for(const spec of Object.values(printFieldsV45))if(!spec.options||spec.key==='廠牌'||spec.key==='在庫位子')spec.options=[...new Set(all.map(c=>String(c[spec.key]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
    printSelectedV45={};for(const [k,v] of Object.entries(printFieldsV45))printSelectedV45[k]=new Set(v.options.filter(opt=>k!=='status'||opt!=='售出'));
    const html=Object.entries(printFieldsV45).map(([kind,spec])=>'<section class="erp45-print-group"><div class="erp45-print-title"><strong>'+safe(spec.label)+'</strong><span><button type="button" data-print-all="'+kind+'">全選</button> / <button type="button" data-print-none="'+kind+'">全取消</button></span></div><div class="erp45-print-checks '+(kind==='brand'||kind==='location'?'erp45-scroll':'')+'">'+spec.options.map(v=>'<label class="erp45-print-check"><input type="checkbox" data-print-kind="'+kind+'" value="'+safe(v)+'" '+(printSelectedV45[kind].has(v)?'checked':'')+'> '+safe(v)+'</label>').join('')+'</div></section>').join('');
    $('staff-print-options').innerHTML=html;
    updatePrintCountV45();
  }
  function selectedPrintCarsV45(){return st.cars.filter(c=>Object.entries(printFieldsV45).every(([k,v])=>printSelectedV45[k]?.has(String(c[v.key]||(k==='sale'?'零售':k==='status'?'在庫':'')))));}
  function updatePrintCountV45(){const count=selectedPrintCarsV45().length;$('staff-print-count').textContent='符合 '+count+' 台車 · A4 直式';$('staff-print-run').disabled=count===0;}
  function openPrintDialogV45(){setupPrintOptionsV45();$('staff-print-modal').classList.remove('hidden');}
  function closePrintDialogV45(){$('staff-print-modal').classList.add('hidden');}
  function printList(){const cars=selectedPrintCarsV45(); if(!cars.length){alert('沒有可以列印的車輛');return;}
    const pages='<div class="staff-print-head"><div class="staff-print-logo">▰</div><div><small>DEALERSHIP INVENTORY REPORT</small><h1>'+safe(String(cfg.BRAND||'車行 ERP'))+'｜'+(new Date().getMonth()+1)+'月 在庫車輛總表</h1><p>A4 直式 · 每排 5 台 · 符合 '+cars.length+' 台</p></div><span>'+safe(new Date().toLocaleDateString('zh-TW'))+'</span></div>'+
    '<div class="print-cards erp45-print-5">'+cars.map(c=>'<div class="print-card '+(isSold(c)?'sold':'')+'">'+(
      images(c).length?'<div class="print-photo"><img src="'+safe(images(c)[0])+'" alt="車輛照片"></div>':'<div class="print-photo print-photo-empty">尚無照片</div>')+
      '<div class="erp45-print-card-body"><h4><small>'+safe(c['廠牌'])+'</small>'+safe([c['年份'],c['型號']].filter(Boolean).join(' '))+'</h4><p>'+safe(c['年份']||'—')+' 年 · '+safe(mileage(c))+'</p><p>'+safe(c['在庫位子']||'—')+' · '+safe(c['販售狀態']||'在庫')+' · '+safe(c['售賣形式']||'零售')+'</p><strong>'+safe(format(carPrice(c)))+'<small> 萬</small></strong></div></div>').join('')+'</div>';
    $('print-sheet').innerHTML=pages;closePrintDialogV45();
    Promise.race([Promise.all([...$('print-sheet').querySelectorAll('img')].map(im=>im.complete?Promise.resolve():new Promise(resolve=>{im.addEventListener('load',resolve,{once:true});im.addEventListener('error',resolve,{once:true});}))),new Promise(resolve=>setTimeout(resolve,2800))]).then(()=>window.print());
  }
  const adminURL=String(cfg.ADMIN_URL||'');const admin=$('staff-admin-link');const gateAdmin=$('gate-admin-link');
  if(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(adminURL)){
    admin.href=adminURL;gateAdmin.href=adminURL;admin.removeAttribute('aria-disabled');admin.rel='noopener noreferrer';
  }else {admin.addEventListener('click',e=>e.preventDefault());gateAdmin.addEventListener('click',e=>e.preventDefault());}
  $('staff-brand').textContent=String(cfg.BRAND||'車行 ERP');
  $('search').addEventListener('input',render);$('sort').addEventListener('change',render);for(const [id,[_field,label]] of Object.entries(filterDefs))$('filter-'+id).addEventListener('change',()=>{updateFacetLabel(id,label);render();});$('filters-clear').addEventListener('click',()=>{document.querySelectorAll('.multi-menu input[type=checkbox]').forEach(c=>c.checked=false);for(const [id,[_field,label]] of Object.entries(filterDefs))updateFacetLabel(id,label);render();});
  $('refresh').addEventListener('click',()=>load());
  $('staff-gate-form').addEventListener('submit',gateLogin);
  $('staff-gate-pass').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,128);});
  $('staff-pin-pad').addEventListener('click',e=>{
    const b=e.target.closest('[data-pin]');if(!b)return;
    const box=$('staff-gate-pass'),v=b.dataset.pin;
    if(v==='clear')box.value='';else if(v==='back')box.value=box.value.slice(0,-1);
    else if(box.value.length<128)box.value+=v;
    box.dispatchEvent(new Event('input',{bubbles:true}));
  });
  $('staff-home-prev').addEventListener('click',()=>{st.homeIndex--;showHomeV43();});$('staff-home-next').addEventListener('click',()=>{st.homeIndex++;showHomeV43();});$('staff-home-dots').addEventListener('click',e=>{const b=e.target.closest('[data-staff-dot]');if(b){st.homeIndex=Number(b.dataset.staffDot);showHomeV43();}});
  $('staff-logout').addEventListener('click',()=>{if(st.homeTimer){clearInterval(st.homeTimer);st.homeTimer=null;}st.cars=[];st.shown=[];st.staffDoc=null;$('car-grid').innerHTML='';$('staff-app').classList.add('hidden');$('staff-gate').classList.remove('hidden');showGateMessage('已離開唯讀模式，請重新輸入入口密碼。',false);});
  $('car-grid').addEventListener('click',e=>{const card=e.target.closest('[data-car]');if(card)openCar(+card.dataset.car);});
  $('car-grid').addEventListener('keydown',e=>{if(e.key==='Enter'){const card=e.target.closest('[data-car]');if(card)openCar(+card.dataset.car);}});
  $('modal-close').addEventListener('click',closeCar);
  $('car-modal').addEventListener('click',e=>{if(e.target===$('car-modal'))closeCar();});
  $('lightbox-close').addEventListener('click',closeLightbox);
  $('lightbox-prev').addEventListener('click',()=>movePhoto(-1));$('lightbox-next').addEventListener('click',()=>movePhoto(1));
  $('loan-open').addEventListener('click',()=>{$('loan-modal').classList.remove('hidden');calcLoan();});
  $('loan-close').addEventListener('click',()=>$('loan-modal').classList.add('hidden'));
  for(const id of ['loan-price','loan-down','loan-rate','loan-months'])$(id).addEventListener('input',calcLoan);
  $('print-open').addEventListener('click',openPrintDialogV45);
  $('staff-grid-layout').addEventListener('change',e=>{st.staffCols=[1,2,4].includes(Number(e.target.value))?Number(e.target.value):2;render();});
  $('staff-print-close').addEventListener('click',closePrintDialogV45);
  $('staff-print-cancel').addEventListener('click',closePrintDialogV45);
  $('staff-print-modal').addEventListener('click',e=>{if(e.target===$('staff-print-modal'))closePrintDialogV45();});
  $('staff-print-run').addEventListener('click',printList);
  $('staff-print-options').addEventListener('change',e=>{const el=e.target.closest('input[data-print-kind]');if(!el)return;const v=printSelectedV45[el.dataset.printKind];if(el.checked)v.add(el.value);else v.delete(el.value);updatePrintCountV45();});
  $('staff-print-options').addEventListener('click',e=>{const b=e.target.closest('[data-print-all],[data-print-none]');if(!b)return;const kind=b.dataset.printAll||b.dataset.printNone;printSelectedV45[kind]=new Set(b.dataset.printAll===undefined?[]:printFieldsV45[kind].options);$('staff-print-options').querySelectorAll('input[data-print-kind="'+kind+'"]').forEach(el=>el.checked=printSelectedV45[kind].has(el.value));updatePrintCountV45();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePrintDialogV45();closeLightbox();$('loan-modal').classList.add('hidden');closeCar();}
    if(!$('lightbox').classList.contains('hidden')){if(e.key==='ArrowLeft')movePhoto(-1);if(e.key==='ArrowRight')movePhoto(1);}});
  showGateMessage('請輸入員工端密碼；若尚未設定，請管理員先到 Google 後台設定並發布。',false);
})();
