'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const cfg=window.ERP_SITE||{};
  const st={cars:[],shown:[],selected:new Set(),car:null,images:[],photo:0,loading:false};
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
  function card(c){const index=st.cars.indexOf(c),status=String(c['販售狀態']||'在庫');const p=carPrice(c);
    return '<article class="car-card '+locClass(c['在庫位子'])+' '+(isSold(c)?'sold-card':'')+'" tabindex="0" role="button" data-car="'+index+'" aria-label="查看 '+safe(c['廠牌']+' '+c['型號'])+' 詳情">'+
      '<div class="image-wrap">'+showPhoto(c)+'<span class="status-badge '+statusClass(status)+'">'+safe(status)+'</span></div>'+
      '<div class="card-info"><div class="tiny-tags"><span class="tiny-tag">'+safe(c['在庫位子']||'未分類位子')+'</span><span class="tiny-tag sale">'+safe(c['售賣形式']||'零售')+'</span></div>'+
      '<h3>'+safe([c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' '))+'</h3><div class="car-meta">'+safe([c['顏色'],c['燃料形式'],mileage(c)].filter(Boolean).join(' · '))+'</div>'+
      '<div class="price-row"><div><strong>'+safe(format(p))+'<small> 萬</small></strong>'+
      (c['新價格']!==''&&c['新價格']!=null&&n(c['新價格'])!==n(c['開價'])&&c['開價']!==''?'<div><del>'+safe(format(c['開價']))+' 萬</del></div>':'')+'</div><span class="age '+ageClass(c)+'">'+safe(ageLabel(c))+'</span></div></div></article>';
  }
  function render(){st.shown=filtered();$('result-count').textContent='符合 '+st.shown.length+' 台車';
    $('count-stock').textContent=st.cars.filter(c=>!isSold(c)).length;
    $('count-reserved').textContent=st.cars.filter(c=>c['販售狀態']==='收訂').length;
    $('count-incoming').textContent=st.cars.filter(c=>c['販售狀態']==='即將到港').length;
    $('car-grid').innerHTML=st.shown.map(card).join('');
    const m=$('message');m.classList.toggle('hidden',st.shown.length>0);
    if(!st.shown.length&&!st.loading){m.textContent=st.cars.length?'目前沒有符合篩選條件的車輛。':'尚未發布車源，請管理員在 Google 後台按「發布員工車源」。';}
  }
  async function load(){if(st.loading)return;st.loading=true;$('refresh').disabled=true;$('result-count').textContent='正在讀取…';
    const m=$('message');m.classList.remove('hidden','error');m.textContent='正在讀取已發布的車輛資料…';
    try{
      const url=String(cfg.STAFF_DATA||'./data/vehicles.json');
      // 員工端只請求同網站內的 JSON，沒有 Google 登入或資料修改 API。
      const parsed=new URL(url,location.href);if(parsed.origin!==location.origin)throw new Error('資料位置必須在相同網站');
      parsed.searchParams.set('t',String(Date.now()));
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),15000);
      let res;
      try{res=await fetch(parsed.href,{cache:'no-store',signal:controller.signal});}
      finally{clearTimeout(timeout);}
      if(!res.ok)throw new Error('HTTP '+res.status);
      const doc=await res.json();if(doc.schemaVersion!==1||!Array.isArray(doc.items))throw new Error('資料格式與版本不符');
      // 前端再次限制欄位：即使 GitHub 被誤放其他資訊，也不予顯示。這不取代後端過濾。
      st.cars=doc.items.map((x,i)=>({
        '廠牌':x['廠牌']||'', '型號':x['型號']||'', '年份':x['年份']||'',
        '排氣量':x['排氣量']||'', '顏色':x['顏色']||'', '里程':x['里程']??'',
        '開價':x['開價']??'', '新價格':x['新價格']??'', '燃料形式':x['燃料形式']||'',
        '在庫位子':x['在庫位子']||'', '售賣形式':x['售賣形式']||'零售',
        '販售狀態':x['販售狀態']||'在庫', '是否認證':x['是否認證']||'',
        '封面圖片':x['封面圖片']||'', '其他照片':x['其他照片']||'',
        '購入日期':x['購入日期']||'', '成交日期':x['成交日期']||'',
        '優惠標籤':x['優惠標籤']||'', '公開配備':x['公開配備']||''
      }));
      $('published-at').textContent=doc.publishedAt?'資料發布：'+String(doc.publishedAt).replace('T',' ').slice(0,16):'尚未發布正式資料';
      rebuildOptions();render();
    }catch(e){st.cars=[];st.shown=[];m.classList.remove('hidden');m.classList.add('error');
      m.textContent='無法讀取員工端車源：'+(e.name==='AbortError'?'等待超過 15 秒，請檢查網路連線':e.message)+'。請確認 data/vehicles.json 已發布到 GitHub Pages，並稍後重試。';
      $('car-grid').innerHTML='';$('result-count').textContent='讀取失敗';
    }finally{st.loading=false;$('refresh').disabled=false;}
  }
  function pair(label,value){return '<div class="detail-pair"><b>'+safe(label)+'</b><span>'+safe(value===''||value===undefined||value===null?'—':value)+'</span></div>';}
  function openCar(index){const c=st.cars[index];if(!c)return;st.car=c;st.images=images(c);st.photo=0;
    $('modal-title').textContent=[c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' ');
    const img=st.images.length?'<img id="featured-img" src="'+safe(st.images[0])+'" alt="車輛照片">':'<span class="no-photo">尚未提供照片</span>';
    const thumbs=st.images.map((u,i)=>'<button type="button" class="thumb '+(i===0?'selected':'')+'" data-photo="'+i+'" aria-label="預覽第 '+(i+1)+' 張照片"><img src="'+safe(u)+'" alt="照片縮圖"></button>').join('');
    const fields=[['在庫位子',c['在庫位子']],['售賣形式',c['售賣形式']],['車輛狀態',c['販售狀態']],['購入日期',c['購入日期']],
      ['在庫天數／銷售期',ageLabel(c)],['年份',c['年份']],['排氣量',c['排氣量']],['顏色',c['顏色']],['里程',mileage(c)],
      ['燃料形式',c['燃料形式']],['開價（萬元）',format(c['開價'])],['新價格（萬元）',format(c['新價格'])],['是否認證',c['是否認證']]];
    $('modal-body').innerHTML='<div id="featured" class="detail-main-photo" role="button" tabindex="0" aria-label="開啟全螢幕照片">'+img+'</div>'+(
      thumbs?'<div id="thumbs" class="detail-thumbs">'+thumbs+'</div>':'')+
      '<div class="detail-summary"><div><span class="eyebrow">'+safe(c['販售狀態'])+' · '+safe(c['售賣形式'])+'</span><h3>'+safe([c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' '))+'</h3></div><div class="detail-price">'+safe(format(carPrice(c)))+' 萬</div></div>'+
      '<div class="detail-grid">'+fields.map(([a,b])=>pair(a,b)).join('')+'</div>'+
      (c['公開配備']?'<h3>車輛特色與配備</h3><div class="detail-note">'+safe(c['公開配備'])+'</div>':'')+
      '<p class="small-muted">公開唯讀快照僅供參考，成交與報價前請向管理員再次核實。</p>';
    $('car-modal').classList.remove('hidden');document.body.style.overflow='hidden';
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
  function printList(){const cars=st.shown; if(!cars.length){alert('沒有可以列印的車輛');return;}
    const pages='<div class="print-intro"><strong>車源清單</strong> · 列印時間 '+safe(new Date().toLocaleString('zh-TW'))+' · 符合 '+cars.length+' 台車</div>'+
    '<div class="print-cards">'+cars.map(c=>'<div class="print-card '+(isSold(c)?'sold':'')+'">'+(
      images(c).length?'<img src="'+safe(images(c)[0])+'" alt="車輛照片">':'')+
      '<h4>'+safe([c['年份'],c['廠牌'],c['型號']].filter(Boolean).join(' '))+'</h4><p>'+safe(c['販售狀態'])+' / '+safe(c['售賣形式'])+' / '+safe(c['在庫位子'])+'</p><p>'+safe(mileage(c))+' · '+safe(ageLabel(c))+'</p><strong>'+safe(format(carPrice(c)))+' 萬</strong></div>').join('')+'</div>';
    $('print-sheet').innerHTML=pages;window.print();
  }
  const adminURL=String(cfg.ADMIN_URL||'');const admin=$('staff-admin-link');
  if(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(adminURL)){
    admin.href=adminURL;admin.removeAttribute('aria-disabled');admin.rel='noopener noreferrer';
  }else admin.addEventListener('click',e=>e.preventDefault());
  $('staff-brand').textContent=String(cfg.BRAND||'車行 ERP');
  $('search').addEventListener('input',render);$('sort').addEventListener('change',render);for(const [id,[_field,label]] of Object.entries(filterDefs))$('filter-'+id).addEventListener('change',()=>{updateFacetLabel(id,label);render();});$('filters-clear').addEventListener('click',()=>{document.querySelectorAll('.multi-menu input[type=checkbox]').forEach(c=>c.checked=false);for(const [id,[_field,label]] of Object.entries(filterDefs))updateFacetLabel(id,label);render();});
  $('refresh').addEventListener('click',load);
  $('car-grid').addEventListener('click',e=>{const card=e.target.closest('[data-car]');if(card)openCar(+card.dataset.car);});
  $('car-grid').addEventListener('keydown',e=>{if(e.key==='Enter'){const card=e.target.closest('[data-car]');if(card)openCar(+card.dataset.car);}});
  $('modal-close').addEventListener('click',closeCar);
  $('car-modal').addEventListener('click',e=>{if(e.target===$('car-modal'))closeCar();});
  $('lightbox-close').addEventListener('click',closeLightbox);
  $('lightbox-prev').addEventListener('click',()=>movePhoto(-1));$('lightbox-next').addEventListener('click',()=>movePhoto(1));
  $('loan-open').addEventListener('click',()=>{$('loan-modal').classList.remove('hidden');calcLoan();});
  $('loan-close').addEventListener('click',()=>$('loan-modal').classList.add('hidden'));
  for(const id of ['loan-price','loan-down','loan-rate','loan-months'])$(id).addEventListener('input',calcLoan);
  $('print-open').addEventListener('click',printList);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeLightbox();$('loan-modal').classList.add('hidden');closeCar();}
    if(!$('lightbox').classList.contains('hidden')){if(e.key==='ArrowLeft')movePhoto(-1);if(e.key==='ArrowRight')movePhoto(1);}});
  load();
})();
