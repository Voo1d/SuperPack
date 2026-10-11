
 const names={home:'Главная',inventory:'Склад и партии',production:'Производство',trace:'Карточка партии',labels:'QR и этикетки',analytics:'Аналитика',staff:'Сотрудники'};
 const raw=[{title:'Картон пищевой',id:'RM-2031',date:'11.10.2026',amount:'420 кг',status:'В наличии',kind:'ok',supplier:'Paperline',history:['Поступление: +420 кг · 11.10, 09:24 · Акмал']},{title:'Картон пищевой',id:'RM-2028',date:'08.10.2026',amount:'85 кг',status:'Мало',kind:'warn',supplier:'Paperline',history:['Списание в выпуск FG-1024: −180 кг · 11.10, 08:56','Поступление: +265 кг · 08.10, 10:30']},{title:'Клей пищевой',id:'RM-2019',date:'07.10.2026',amount:'18 кг',status:'Мало',kind:'warn',supplier:'Bondline',history:['Расход на производство: −32 кг · 10.10','Поступление: +50 кг · 07.10']},{title:'Краска зелёная',id:'RM-2014',date:'05.10.2026',amount:'12 кг',status:'Мало',kind:'warn',supplier:'ColorPro',history:['Списание в выпуск FG-1024: −12 кг · 11.10','Поступление: +24 кг · 05.10']},{title:'Плёнка ламинации',id:'RM-2007',date:'03.10.2026',amount:'90 м',status:'Мало',kind:'warn',supplier:'LamiCo',history:['Поступление: +150 м · 03.10']}];
 const finished=[{title:'Бумажные стаканы 250 мл',id:'FG-1024',date:'11.10.2026',amount:'6 000 шт.',pallets:20,units:300,status:'В наличии',kind:'ok',supplier:'Собственный цех',history:['Выпуск: +6 000 шт. · 20 палет × 300 шт. · Зухра','Сырьё: RM-2028 (180 кг), RM-2014 (12 кг)']},{title:'Бумажные пакеты M',id:'FG-1023',date:'10.10.2026',amount:'4 450 шт.',pallets:25,units:178,status:'В наличии',kind:'ok',supplier:'Собственный цех',history:['Выпуск: +4 450 шт. · 25 палет × 178 шт.']},{title:'Коробки для доставки',id:'FG-1022',date:'09.10.2026',amount:'1 970 шт.',pallets:10,units:197,status:'В наличии',kind:'ok',supplier:'Собственный цех',history:['Выпуск: +1 970 шт. · 10 палет × 197 шт.']}];
 const spares=[{title:'Подшипник линии упаковки',id:'SP-0074',date:'06.10.2026',amount:'12 шт.',status:'В наличии',kind:'ok',supplier:'ТехСнаб',history:['Поступление: +12 шт. · 06.10']},{title:'Ремень привода',id:'SP-0068',date:'04.10.2026',amount:'2 шт.',status:'Мало',kind:'warn',supplier:'ТехСнаб',history:['Ремонт оборудования: −1 шт. · 09.10','Поступление: +3 шт. · 04.10']}];
 const other=[{title:'Перчатки рабочие',id:'OT-0018',date:'02.10.2026',amount:'80 пар',status:'В наличии',kind:'ok',supplier:'ХозМаркет',history:['Поступление: +80 пар · 02.10']},{title:'Маркер для этикеток',id:'OT-0019',date:'08.10.2026',amount:'6 шт.',status:'В наличии',kind:'ok',supplier:'ХозМаркет',history:['Поступление: +6 шт. · 08.10']}];
 const inventoryGroups={finished,raw,spares,other};
 const categoryNames={finished:'Готовая продукция',raw:'Сырьё',spares:'Запчасти',other:'Другое'};
 let invFilter='finished', selected=finished[0]; const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 function show(view){ $$('.view').forEach(v=>v.classList.toggle('active',v.id===view)); $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); $('#breadcrumb').textContent=names[view]||'Главная'; window.scrollTo({top:0,behavior:'smooth'}); }
 $$('[data-view],[data-go]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tab){invFilter=b.dataset.tab;renderInventory()}show(b.dataset.view||b.dataset.go)}));
 function toast(t){let el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>el.classList.remove('show'),3300)}
 $$('[data-scan]').forEach(b=>b.addEventListener('click',()=>toast('Сканирование QR будет подключено к Telegram Mini App.')));
 function renderInventory(){
   $$('.inv-tab').forEach(b=>{const active=b.dataset.filter===invFilter;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
   const q=$('#inventorySearch').value.toLowerCase(), low=$('#stockFilter').value==='low';
   const data=inventoryGroups[invFilter].filter(x=>(x.title.toLowerCase().includes(q)||x.id.toLowerCase().includes(q))&&(!low||x.kind==='warn'));
   $('#inventoryRows').innerHTML=data.map(x=>`<tr><td><strong>${x.title}</strong><small>${x.id}${x.pallets?' · '+x.pallets+' палет':''}</small></td><td>${x.date}</td><td><strong>${x.amount}</strong></td><td><span class="chip ${x.kind==='warn'?'warn':''}">${x.status}</span></td><td><button class="table-action" data-lot="${x.id}">История →</button></td></tr>`).join('')||'<tr><td colspan="5">Партии не найдены</td></tr>';
   $$('[data-lot]').forEach(b=>b.onclick=()=>selectLot(b.dataset.lot));
   if(!data.includes(selected)&&data.length)selectLot(data[0].id);
   if(!data.length){$('#lotType').textContent=categoryNames[invFilter];$('#lotTitle').textContent='Нет партий по выбранным условиям';$('#lotDesc').textContent='Измените поиск или фильтр остатков.';$('#lotHistory').replaceChildren();}
 }
 function selectLot(id){
   selected=Object.values(inventoryGroups).flat().find(x=>x.id===id);
   const category=Object.keys(inventoryGroups).find(k=>inventoryGroups[k].includes(selected));
   $('#lotType').textContent=categoryNames[category];
   $('#lotTitle').textContent=selected.title+' · '+id;
   $('#lotDesc').textContent=(category==='finished'?'Произведено ':'Поступило ')+selected.date+' · Источник: '+selected.supplier+' · Остаток: '+selected.amount+(selected.pallets?' · '+selected.pallets+' палет':'');
   $('#lotHistory').replaceChildren();
   selected.history.forEach(h=>{const row=document.createElement('div');row.className='row';row.innerHTML='<span class="iconbox">↗</span><div class="row-main"><strong></strong></div>';row.querySelector('strong').textContent=h;$('#lotHistory').append(row)});
   if(id==='FG-1024'){$('#lotHistory').insertAdjacentHTML('beforeend','<div class="row"><button class="link" data-trace>Открыть связь с сырьём →</button></div>');$('[data-trace]').onclick=()=>show('trace')}
 }
 $$('.inv-tab').forEach(b=>b.onclick=()=>{invFilter=b.dataset.filter;$('#inventorySearch').value='';$('#stockFilter').value='all';renderInventory()});
 $('#inventorySearch').oninput=renderInventory;$('#stockFilter').onchange=renderInventory; renderInventory();selectLot('FG-1024');
 $('#receiveButton').onclick=()=>toast('Форма приёмки будет подключена к учёту в рабочей версии.');
 let addedMaterials=0;function renderMaterials(){let count=2+addedMaterials;$('#materialFields').innerHTML=Array.from({length:count},(_,i)=>`<div class="recipe-row"><div><strong>${['Картон пищевой · RM-2031','Краска зелёная · RM-2014','Клей пищевой · RM-2019'][i]||'Дополнительное сырьё'}</strong><br/><span>Норма: ${[145,10,3][i]||1} ${i===0?'кг':'кг'}</span></div><input class="material-amount" aria-label="Фактический расход материала ${i+1}" type="number" min="0" step="0.01" style="width:73px;border:1px solid #dbe7e2;border-radius:8px;padding:8px" value="${[150,12,3][i]||1}"><b>кг</b></div>`).join('');$('#summaryMaterials').textContent=count+' партии';}renderMaterials(); $('#addMaterial').onclick=()=>{if(addedMaterials>=1){toast('В макете показаны три материала.');return}addedMaterials++;renderMaterials()};
 const products={cup:'Бумажные стаканы 250 мл',bag:'Бумажные пакеты M',box:'Коробки для доставки'};
 const format=n=>Number(n||0).toLocaleString('ru-RU');
 function productionCount(){return Number($('#pallets').value)*Number($('#unitsPerPallet').value)}
 function summary(){
   const pallets=Number($('#pallets').value), per=Number($('#unitsPerPallet').value), total=productionCount();
   $('#summaryProduct').textContent=products[$('#productSelect').value];
   $('#summaryPallets').textContent=format(pallets);
   $('#summaryPerPallet').textContent=format(per)+' шт.';
   $('#actual').textContent=format(total)+' шт.';
   $('.calculated-total small').textContent=format(pallets)+' палет × '+format(per)+' шт.';
   $('#summaryCount').textContent=format($('#planned').value)+' / '+format(total)+' шт.';
   $('#summaryRejects').textContent=format($('#rejects').value)+' шт.';
 }
 ['productSelect','planned','pallets','unitsPerPallet','rejects'].forEach(id=>$('#'+id).addEventListener('input',summary));
 $('#productionDate').value='2026-10-11';
 $('#productionSubmit').onclick=()=>{
   const plan=Number($('#planned').value), pallets=Number($('#pallets').value), per=Number($('#unitsPerPallet').value), rejects=Number($('#rejects').value);
   if(!Number.isSafeInteger(plan)||plan<1||!Number.isSafeInteger(pallets)||pallets<1||!Number.isSafeInteger(per)||per<1||!Number.isSafeInteger(rejects)||rejects<0||!Number.isSafeInteger(productionCount())){
     toast('Проверьте план, палеты, изделия и брак.');return;
   }
   toast('Макет проверки готов. Проведение в базе подключается при разработке.');
 };
 summary();

 const allLots=[...finished,...raw,...spares,...other];
 const byId=id=>allLots.find(x=>x.id===id);
 const asEntry=id=>{const lot=byId(id);return {source:'existing',id,title:lot.title,date:lot.date,pallets:lot.pallets||1,units:lot.units||1,qty:lot.pallets||1}};
 let labelEntries=['FG-1024','FG-1023','FG-1022'].map(asEntry);
 $('#lotLabelButton').onclick=()=>{labelEntries=[asEntry(selected.id)];renderLabelRows()};
 $('#traceLabelButton').onclick=()=>{labelEntries=[asEntry('FG-1024')];renderLabelRows()};
 const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const displayDate=d=>{const parts=String(d||'').split('-');return parts.length===3?parts.reverse().join('.'):d};
 const inputDate=d=>{const parts=String(d||'').split('.');return parts.length===3?parts.reverse().join('-'):d};
 function renderLabelRows(){
   $('#labelRows').innerHTML=labelEntries.map((entry,i)=>{
     const isManual=entry.source==='manual';
     const main=isManual
       ?`<div class="label-fields">
           <label class="field wide">Название товара / материала<input data-field="title" data-row="${i}" value="${escapeHtml(entry.title)}" placeholder="Например, бумажные стаканы"></label>
           <label class="field">Номер партии<input data-field="id" data-row="${i}" value="${escapeHtml(entry.id)}" placeholder="FG-0001"></label>
           <label class="field">Дата<input type="date" data-field="date" data-row="${i}" value="${escapeHtml(inputDate(entry.date))}"></label>
           <label class="field">Количество палет<input type="number" min="1" step="1" data-field="pallets" data-row="${i}" value="${entry.pallets}"></label>
           <label class="field">Изделий в одной палете<input type="number" min="1" step="1" data-field="units" data-row="${i}" value="${entry.units}"></label>
         </div>`
       :`<label class="field" style="margin:0">Партия из учёта
           <select data-existing="${i}">${Object.entries(inventoryGroups).map(([key,items])=>`<optgroup label="${categoryNames[key]}">${items.map(item=>`<option value="${item.id}" ${item.id===entry.id?'selected':''}>${escapeHtml(item.title)} · ${item.id}</option>`).join('')}</optgroup>`).join('')}</select>
         </label><p class="label-meta">${escapeHtml(entry.date)} · ${entry.pallets} палет · ${format(entry.units)} шт. в палете · на складе: ${escapeHtml(byId(entry.id).amount)}</p>`;
     return `<div class="label-entry">
       <div class="label-entry-head"><strong>Позиция ${i+1}</strong><button class="remove" data-remove="${i}" aria-label="Удалить позицию ${i+1}">×</button></div>
       <div class="label-source"><button data-source="existing" data-row="${i}" class="${isManual?'':'active'}">Из склада / производства</button><button data-source="manual" data-row="${i}" class="${isManual?'active':''}">Вручную</button></div>
       ${main}
       <div class="label-qty"><label>Количество QR / этикеток<input type="number" min="1" max="500" step="1" data-qty="${i}" value="${entry.qty}"></label><small>${isManual?'По умолчанию равно числу палет.':'Подставлено из выбранной партии: '+entry.pallets+' палет.'}<br/>Можно изменить перед экспортом.</small></div>
     </div>`;
   }).join('');
   $$('[data-source]').forEach(el=>el.onclick=()=>{
     const i=Number(el.dataset.row), mode=el.dataset.source;
     labelEntries[i]=mode==='manual'?{source:'manual',id:'',title:'',date:'2026-10-11',pallets:1,units:1,qty:1}:asEntry('FG-1024');
     renderLabelRows();
   });
   $$('[data-existing]').forEach(el=>el.onchange=()=>{labelEntries[Number(el.dataset.existing)]=asEntry(el.value);renderLabelRows()});
   $$('[data-field]').forEach(el=>el.oninput=()=>{
     const entry=labelEntries[Number(el.dataset.row)], field=el.dataset.field;
     entry[field]=['pallets','units'].includes(field)?Number(el.value):field==='date'?displayDate(el.value):el.value;
     if(field==='pallets'){entry.qty=Math.max(1,Math.floor(entry.pallets)||1);el.closest('.label-entry').querySelector('[data-qty]').value=entry.qty}
     updateLabels();
   });
   $$('[data-qty]').forEach(el=>el.oninput=()=>{labelEntries[Number(el.dataset.qty)].qty=Number(el.value);updateLabels()});
   $$('[data-remove]').forEach(el=>el.onclick=()=>{if(labelEntries.length===1){toast('Оставьте хотя бы одну позицию.');return}labelEntries.splice(Number(el.dataset.remove),1);renderLabelRows()});
   updateLabels();
 }
 function updateLabels(){
   const count=labelEntries.reduce((sum,x)=>sum+(Number.isSafeInteger(x.qty)&&x.qty>0?x.qty:0),0);
   $('#labelCount').textContent=format(count)+' этикеток';
   const first=labelEntries[0];
   $('#previewProduct').textContent=first.title||'Название товара';
   $('#previewDetails').replaceChildren();
   $('#previewDetails').append(document.createTextNode('Партия: '+(first.id||'—')));
   $('#previewDetails').append(document.createElement('br'));
   $('#previewDetails').append(document.createTextNode('Дата: '+(first.date||'—')));
   $('#previewMeta').textContent='Пример этикетки '+$('#labelSize').value+' · '+($('#labelMode').value==='pallet'?'отдельный QR на палету':'один QR на партию');
   $('#labelExplanation').textContent=$('#labelMode').value==='pallet'
     ?'Обычно число этикеток равно числу палет. Для каждой палеты предполагается отдельный QR, связанный с партией. Изменение числа этикеток не меняет складской остаток.'
     :'Число этикеток по умолчанию равно числу палет, но все наклейки партии будут содержать один QR. Изменение числа этикеток не меняет складской остаток.';
 }
 $('#addLabelRow').onclick=()=>{labelEntries.push(asEntry('FG-1024'));renderLabelRows()};
 $('#labelSize').onchange=updateLabels;$('#labelMode').onchange=updateLabels;renderLabelRows();
 $('#pdfButton').onclick=()=>toast('Экспорт PDF будет работать после подключения генератора QR и базы.');
 $('#pngButton').onclick=()=>toast('PNG будет содержать настоящий сканируемый QR в рабочей версии.');
 // This decorative grid is intentionally not a scannable QR code.
 const qr=$('#qrVisual');for(let i=0;i<225;i++){let x=i%15,y=Math.floor(i/15),finder=(ox,oy)=>{let a=x-ox,b=y-oy;return a>=0&&a<5&&b>=0&&b<5&&(a===0||a===4||b===0||b===4||(a>=2&&a<=2&&b>=2&&b<=2))};let v=finder(0,0)||finder(10,0)||finder(0,10)||((x*17+y*29+x*y*7)%11<5&&!((x<6&&y<6)||(x>8&&y<6)||(x<6&&y>8)));let c=document.createElement('span');if(v)c.innerHTML='<i style="width:100%;height:100%"></i>';qr.appendChild(c)}
 const heights=[28,36,52,43,61,49,72,57,47,68,83,65,74,55,48,80,68,88,78,64,59,75,94,72,85,92,79,100,88,97,76];$('#chart').innerHTML=heights.map(v=>`<div style="height:${v}%"></div>`).join(''); $('#period').onchange=()=>toast('Выбран период: '+$('#period').value);
 $$('[data-approve]').forEach(b=>b.onclick=()=>{const card=b.closest('.staff-card'),name=card.dataset.person;card.remove();toast(name+': доступ разрешён в демонстрации.');});$$('.toggle').forEach(b=>b.onclick=()=>{let on=b.classList.toggle('on');b.setAttribute('aria-pressed',String(on));toast(on?'Доступ включён в демонстрации.':'Доступ выключен в демонстрации.')});$('#inviteButton').onclick=()=>toast('В рабочей версии сотрудник откроет Mini App и появится в заявках.');
