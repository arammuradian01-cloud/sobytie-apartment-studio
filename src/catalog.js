const money=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n)+' ₽';
export async function setupCatalog(){
 const dialog=document.querySelector('#catalog'),body=document.querySelector('#catalog-body');
 const data=await(await fetch(import.meta.env.BASE_URL+'project/catalog.json?v=T05E03')).json();
 let edits={};try{edits=JSON.parse(localStorage.getItem('sobytie-P04-budget')||'{}');}catch{}
 const val=(r,k)=>edits[r.id]?.[k]??r[k];let filter='Все';
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const stats=node('div',undefined,'budget-summary');body.append(stats);
 const exclusions=node('p','Комплектация включает мебель, технику, свет, текстиль, сантехнику и резерв на доставку/сборку. Отделочные материалы посчитаны отдельно. Строительные работы, сети, двери, окна и климат в эти суммы не входят.','fineprint');body.append(exclusions);
 const bar=node('div',undefined,'catalog-filters');body.append(bar);
 const grid=node('div',undefined,'catalog-grid');body.append(grid);
 const summary=()=>{
  const main=data.rows.filter(r=>!r.alternative&&r.group!=='Отделка');
  const sum=kind=>main.filter(r=>r.price_kind===kind).reduce((a,r)=>a+val(r,'price')*val(r,'quantity'),0);
  const finish=data.rows.filter(r=>!r.alternative&&r.group==='Отделка').reduce((a,r)=>a+val(r,'price')*val(r,'quantity'),0);
  stats.replaceChildren();
  for(const [label,n]of [['Позиции с публичными ценами',sum('catalog')],['Проектные резервы',sum('reserve')],['Ориентир комплектации',sum('catalog')+sum('reserve')],['Материалы отделки · отдельно',finish]]){const box=node('div');box.append(node('span',label),node('strong',money(n)));stats.append(box);}
 };
 function render(){
  grid.replaceChildren();bar.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  for(const r of data.rows.filter(r=>filter==='Все'||filter==='Альтернативы'?filter==='Все'?!r.alternative:r.alternative:r.group===filter&&!r.alternative)){
   const card=node('article',undefined,'product-card');card.dataset.product=r.id;
   card.append(node('span',r.id+' · '+r.group,'product-code'),node('h3',r.name),node('p',r.dimensions,'product-size'));
   const status=r.alternative?'Альтернатива · вне итога':r.price_kind==='catalog'?'Публичная цена · 09.11.2026':'Предварительный резерв · не котировка';card.append(node('span',status,'price-status '+r.price_kind),node('p',r.note));
   const fields=node('div',undefined,'product-fields');
   for(const [key,label]of [['quantity','Количество, '+r.unit],['price','Цена, ₽ / '+r.unit]]){
    const wrap=node('label',label),input=node('input');input.type='number';input.min='0';input.step=key==='quantity'&&r.unit==='м²'?'.01':'1';input.value=val(r,key);input.setAttribute('aria-label',label+' — '+r.name);
    input.oninput=()=>{if(input.value===''||!Number.isFinite(Number(input.value))||Number(input.value)<0)return;edits[r.id]??={};edits[r.id][key]=Number(input.value);try{localStorage.setItem('sobytie-P04-budget',JSON.stringify(edits));}catch{}summary();subtotal.textContent=money(val(r,'quantity')*val(r,'price'));};wrap.append(input);fields.append(wrap);
   }
   const subtotal=node('strong',money(val(r,'quantity')*val(r,'price')),'product-total');card.append(fields,subtotal);
   if(r.url){const a=node('a','Открыть карточку и проверить цену ↗');a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
   if(r.spec_url){const a=node('a','Размеры и ограничения производителя ↗');a.href=r.spec_url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
   grid.append(card);
  }
  summary();
 }
 for(const name of ['Все','Мебель','Техника','Свет','Текстиль','Сантехника','Логистика','Отделка','Альтернативы']){const b=node('button',name);b.dataset.filter=name;b.onclick=()=>{filter=name;render();};bar.append(b);}
 const reset=node('button','Сбросить мои изменения','reset-budget');reset.onclick=()=>{edits={};try{localStorage.removeItem('sobytie-P04-budget');}catch{}render();};body.append(reset,node('p','Изменения сохраняются только в этом браузере. Они не меняют опубликованную XLSX-ведомость, геометрию модели и не создают заказ. Позиции — кандидаты для выбора; окончательные артикулы и монтажные схемы ещё согласуются.','fineprint'));
 render();return{data,render,dialog};
}
