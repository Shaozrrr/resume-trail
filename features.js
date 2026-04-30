// features.js - 日历、排序、导入、可定制看板

// ---- 看板排序 ----
const ks=$('#kanban-sort');
if(ks)ks.addEventListener('change',()=>{if(typeof renderKanban==='function')renderKanban($('#global-search').value.toLowerCase().trim());});
window.sortKanbanCards=function(cards){
    const sort=ks?ks.value:'';if(!sort)return cards;
    return cards.sort((a,b)=>{
        if(sort==='preference')return(parseInt(b.preference_level)||0)-(parseInt(a.preference_level)||0);
        if(sort==='waiting'){return(getWait(b)||0)-(getWait(a)||0);}
        if(sort==='deadline'){return(a.next_deadline||'9999').localeCompare(b.next_deadline||'9999');}
        return 0;
    });
};

// ---- 日历视图 ----
let calDate=new Date(),calView='month';
function toDateKey(date){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function renderCalendar(){
    const grid=$('#calendar-grid'),title=$('#cal-title');if(!grid||!title)return;
    const y=calDate.getFullYear(),m=calDate.getMonth();
    if(calView==='month'){
        title.textContent=`${y}年${m+1}月`;
        const first=new Date(y,m,1),startDay=first.getDay();
        const monthStart=new Date(y,m,1-startDay);
        let html='<div class="cal-header"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="cal-days">';
        for(let i=0;i<42;i++){
            const current=new Date(monthStart);
            current.setDate(monthStart.getDate()+i);
            const ds=toDateKey(current);
            const today=toDateKey(new Date())===ds;
            const adjacent=current.getMonth()!==m;
            const evts=getEventsForDate(ds);
            html+=`<div class="cal-day ${today?'today':''} ${adjacent?'adjacent':''}" data-date="${ds}"><span class="cal-day-num">${current.getDate()}</span>${evts.map(e=>`<div class="cal-event" style="background:${e.color}" title="${e.company} · ${e.position}">${e.company.slice(0,4)} ${e.label}</div>`).join('')}</div>`;
        }
        html+='</div>';grid.innerHTML=html;
    }else{
        const dow=calDate.getDay(),ws=new Date(calDate);ws.setDate(ws.getDate()-dow);
        const we=new Date(ws.getTime()+6*864e5);
        title.textContent=`${ws.getMonth()+1}/${ws.getDate()} - ${we.getMonth()+1}/${we.getDate()}`;
        const dayN=['日','一','二','三','四','五','六'];
        let html='<div class="cal-week">';
        for(let i=0;i<7;i++){
            const d=new Date(ws.getTime()+i*864e5),ds=toDateKey(d);
            const today=toDateKey(new Date())===ds;
            const evts=getEventsForDate(ds);
            html+=`<div class="cal-week-day ${today?'today':''}"><div class="cal-week-header"><span>${dayN[i]}</span><span class="cal-day-num">${d.getDate()}</span></div>${evts.map(e=>`<div class="cal-event-lg" style="border-left:3px solid ${e.color}"><div style="font-weight:500;font-size:12px">${e.company}</div><div style="font-size:10px;color:var(--text-muted)">${e.position} · ${e.label}</div></div>`).join('')}</div>`;
        }
        html+='</div>';grid.innerHTML=html;
    }
    renderUpcoming();
}
function getEventsForDate(ds){
    const evts=[];if(typeof store==='undefined')return evts;
    const colors={'笔试/OA':'#a78bfa','一面':'#60a5fa','二面':'#818cf8','三面':'#f472b6','四面':'#fb923c','群面':'#34d399','HR面':'#fbbf24','Offer':'#4ade80','挂了':'#f87171'};
    store.apps.forEach(a=>{
        if(a.timeline)a.timeline.forEach(t=>{if(t.date===ds&&t.name!=='已投递')evts.push({label:t.name,company:a.company_name,position:a.position_title,color:colors[t.name]||'#60a5fa'});});
        if(a.next_deadline&&a.next_deadline.startsWith(ds))evts.push({label:'DDL'+(a.next_action?' '+a.next_action:''),company:a.company_name,position:a.position_title,color:'#f87171'});
    });
    return evts;
}
function renderUpcoming(){
    const list=$('#cal-upcoming-list');if(!list||typeof store==='undefined')return;
    const today=toDateKey(new Date());const up=[];
    store.apps.forEach(a=>{
        if(a.timeline)a.timeline.forEach(t=>{if(t.date&&t.date>=today&&t.name!=='已投递')up.push({date:t.date,text:`${a.company_name} · ${a.position_title} · ${t.name}`});});
        if(a.next_deadline){const dd=a.next_deadline.split('T')[0];if(dd>=today)up.push({date:dd,text:`${a.company_name} · ${a.next_action||'DDL'}`});}
    });
    up.sort((a,b)=>a.date.localeCompare(b.date));
    list.innerHTML=up.length?up.slice(0,8).map(e=>{const days=Math.floor((new Date(e.date)-new Date(today))/864e5);const urg=days<=1?'color:var(--red)':days<=3?'color:var(--orange)':'color:var(--text-secondary)';return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:12px"><span style="width:50px;flex-shrink:0;${urg};font-weight:500">${days===0?'今天':days===1?'明天':days+'天后'}</span><span style="color:var(--text-primary);flex:1">${e.text}</span><span style="font-size:10px;color:var(--text-muted)">${e.date.slice(5)}</span></div>`;}).join(''):'<div style="font-size:12px;color:var(--text-muted);padding:16px 0;text-align:center">暂无即将到来的事件</div>';
}
const cp=$('#cal-prev'),cn=$('#cal-next');
if(cp)cp.addEventListener('click',()=>{if(calView==='month')calDate.setMonth(calDate.getMonth()-1);else calDate.setDate(calDate.getDate()-7);renderCalendar();});
if(cn)cn.addEventListener('click',()=>{if(calView==='month')calDate.setMonth(calDate.getMonth()+1);else calDate.setDate(calDate.getDate()+7);renderCalendar();});
$$('.cal-view-btn').forEach(b=>{b.addEventListener('click',()=>{$$('.cal-view-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');calView=b.dataset.calview;renderCalendar();});});

// ---- 浏览器通知 ----
function checkNotif(){
    if(!('Notification' in window)||typeof store==='undefined')return;
    if(Notification.permission==='default')Notification.requestPermission();
    if(Notification.permission!=='granted')return;
    const today=toDateKey(new Date()),tmr=toDateKey(new Date(Date.now()+864e5));
    store.apps.forEach(a=>{if(a.next_deadline){const dd=a.next_deadline.split('T')[0];if(dd===today||dd===tmr){const k='n_'+a.id+'_'+dd;if(!localStorage.getItem(k)){new Notification('履迹 · 提醒',{body:`${a.company_name} · ${a.next_action||'DDL'}${dd===today?' 今天到期！':' 明天到期！'}`});localStorage.setItem(k,'1');}}}});
}
setTimeout(checkNotif,2000);

// ---- 批量导入 ----
const ib=$('#import-btn');if(ib)ib.addEventListener('click',()=>{$('#import-paste').value='';$('#import-preview').style.display='none';$('#import-modal-overlay').classList.add('active');});
$('#import-modal-close')?.addEventListener('click',()=>$('#import-modal-overlay').classList.remove('active'));
$('#import-cancel')?.addEventListener('click',()=>$('#import-modal-overlay').classList.remove('active'));
$('#import-upload-zone')?.addEventListener('click',()=>$('#import-file-input').click());
$('#import-file-input')?.addEventListener('change',e=>{const f=e.target.files[0];if(f){const rd=new FileReader();rd.onload=ev=>{$('#import-paste').value=ev.target.result;parseImport();};rd.readAsText(f);}});
$('#import-paste')?.addEventListener('input',parseImport);
let importData=[];
function parseImport(){
    const text=$('#import-paste').value.trim();if(!text){$('#import-preview').style.display='none';importData=[];return;}
    importData=[];text.split('\n').filter(l=>l.trim()).forEach(line=>{const p=line.split(/[,\t|;]/).map(s=>s.trim()).filter(Boolean);if(p.length>=2)importData.push({company:p[0],position:p[1],category:p[2]||'',date:p[3]||new Date().toISOString().split('T')[0]});});
    if(importData.length){$('#import-preview').style.display='';$('#import-count').textContent=importData.length;$('#import-preview-list').innerHTML=importData.slice(0,10).map(d=>'<div style="padding:3px 0;border-bottom:1px solid var(--border-light)">'+d.company+' · '+d.position+'</div>').join('');}
}
$('#import-confirm')?.addEventListener('click',async function(){
    if(!importData.length){toast('没有数据','error');return;}
    const ok=await store.importApps(importData);
    if(ok===false)return;
    if(typeof initFilters==='function')initFilters();if(typeof refresh==='function')refresh();
    toast('已导入 '+importData.length+' 条','success');$('#import-modal-overlay').classList.remove('active');importData=[];
});
