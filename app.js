// 履迹 Resume Trail V4
const STATUSES=[{key:'WATCHING',label:'观望中',cls:'status-watching'},{key:'APPLIED',label:'已投递',cls:'status-applied'},{key:'OA_TEST',label:'笔试/OA',cls:'status-oa'},{key:'ROUND_1',label:'一面',cls:'status-round1'},{key:'ROUND_2',label:'二面',cls:'status-final'},{key:'ROUND_3',label:'三面',cls:'status-final'},{key:'ROUND_4',label:'四面',cls:'status-final'},{key:'OFFER',label:'Offer',cls:'status-offer'},{key:'REJECTED',label:'挂了',cls:'status-rejected'},{key:'WITHDRAWN',label:'放弃',cls:'status-withdrawn'}];
// 看板动态列：三面四面仅在有岗位处于该状态时显示
function getKanbanStatuses(){
    const base=STATUSES.filter(s=>!['WITHDRAWN','ROUND_3','ROUND_4'].includes(s.key));
    const hasR3=store.apps.some(a=>a.status==='ROUND_3');
    const hasR4=store.apps.some(a=>a.status==='ROUND_4');
    const result=[];
    base.forEach(s=>{
        result.push(s);
        if(s.key==='ROUND_2'&&hasR3)result.push(STATUSES.find(x=>x.key==='ROUND_3'));
        if(s.key==='ROUND_2'&&hasR4)result.push(STATUSES.find(x=>x.key==='ROUND_4'));
        if(s.key==='ROUND_3'&&hasR4&&!hasR3)result.push(STATUSES.find(x=>x.key==='ROUND_4'));
    });
    return result;
}
const VISA_MAP={SPONSOR_YES:{label:'✅ Sponsor',cls:'visa-green'},SELF_VISA:{label:'🟡 自带工签',cls:'visa-yellow'},NO_SPONSOR:{label:'🔴 不提供',cls:'visa-red'},UNKNOWN:{label:'❓ 未知',cls:'visa-gray'}};
const REJECTION_STAGES={RESUME_SCREEN:'简历筛选挂',OA_FAIL:'笔试挂',ROUND1_BIZ:'一面业务挂',GROUP_INTERVIEW:'群面挂',FINAL_FAIL:'终面挂',HR_FAIL:'HR面挂',OTHER:'其他'};
const ROUND_LABELS={OA_TEST:'笔试/OA',ROUND_1:'一面',ROUND_2:'二面',ROUND_3:'三面',ROUND_4:'四面',GROUP:'群面',HR:'HR面'};
const TL_TO_STATUS={'已投递':'APPLIED','笔试/OA':'OA_TEST','一面':'ROUND_1','二面':'ROUND_2','三面':'ROUND_3','四面':'ROUND_4','Offer':'OFFER','挂了':'REJECTED'};
const TL_OPTIONS=['已投递','笔试/OA','一面','二面','三面','四面','群面','HR面','Offer','挂了'];
// 从时间线推导状态
function deriveStatus(timeline){
    if(!timeline||!timeline.length)return'WATCHING';
    // 找最后一个有状态映射的条目
    for(let i=timeline.length-1;i>=0;i--){
        const s=TL_TO_STATUS[timeline[i].name];
        if(s)return s;
    }
    return'APPLIED';
}
const PREF_OPTIONS=[{v:'1',l:'⭐ 保底'},{v:'2',l:'⭐⭐ 一般'},{v:'3',l:'⭐⭐⭐ 心仪'},{v:'4',l:'⭐⭐⭐⭐ 梦想'}];
const DEFAULT_PP=['表达不清','知识盲区','紧张','准备不足','Case分析薄弱','行为面试不佳','技术题不熟练'];
const COLORS=['#60a5fa','#a78bfa','#4ade80','#fb923c','#f87171','#fbbf24','#34d399','#f472b6','#818cf8','#a3e635'];
const DEFAULT_COLS=[{id:'company_name',label:'公司',show:true,system:true},{id:'position_title',label:'岗位',show:true,system:true},{id:'position_category',label:'类别',show:true,system:true},{id:'status',label:'状态',show:true,system:true},{id:'applied_date',label:'投递日期',show:true,system:true},{id:'waiting',label:'等待',show:true,system:true},{id:'preference_level',label:'偏好',show:true,system:true},{id:'source_channel',label:'渠道',show:true,system:true},{id:'jd',label:'JD',show:true,system:true},{id:'actions',label:'操作',show:true,system:true}];
const AI_CFG={gemini:{url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',key:'AIzaSyDsUzOWf2a8bm6glCA1kxDTkVYWQXh_nqM'},or:{url:'https://openrouter.ai/api/v1/chat/completions',key:'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',model:'openrouter/auto'}};

class Store{
    constructor(){
        // 云端唯一真源：本地只保留运行时内存，不再从 localStorage 读取业务数据
        this.apps=[];
        this.resumes=[];
        this.refs=[];
        this.logs=[];
        this.settings={intlMode:false};
        this.categories=[];
        this.painPoints=[...DEFAULT_PP];
        this.tableCols=[...DEFAULT_COLS];
    }
    async save(){
        if(typeof cloudStore!=='undefined'){
            try{
                await cloudStore.saveFrom(this);
                return true;
            }catch(e){
                console.error(e);
                if(typeof toast==='function')toast('保存失败，请重试','error');
                return false;
            }
        }
        return true;
    }
    async addApp(a){a.id=crypto.randomUUID();a.created_at=new Date().toISOString();a.updated_at=a.created_at;if(!a.timeline)a.timeline=[];this.apps.push(a);this.addLog(a.id,null,a.status);await this.save();return a;}
    async updateApp(id,u){const i=this.apps.findIndex(a=>a.id===id);if(i<0)return null;const o=this.apps[i];if(u.status&&u.status!==o.status)this.addLog(id,o.status,u.status,u._rej);delete u._rej;Object.assign(this.apps[i],u,{updated_at:new Date().toISOString()});await this.save();return this.apps[i];}
    async delApp(id){this.apps=this.apps.filter(a=>a.id!==id);this.refs=this.refs.filter(r=>r.app_id!==id);this.logs=this.logs.filter(l=>l.app_id!==id);await this.save();}
    addLog(aid,from,to,rej){this.logs.push({id:crypto.randomUUID(),app_id:aid,from:from,to:to,rej:rej||null,at:new Date().toISOString()});}
    async addResume(r){r.id=crypto.randomUUID();r.at=new Date().toISOString();this.resumes.push(r);await this.save();return r;}
    async delResume(id){this.resumes=this.resumes.filter(r=>r.id!==id);await this.save();}
    async addRef(r){r.id=crypto.randomUUID();r.at=new Date().toISOString();this.refs.push(r);await this.save();return r;}
    async updateRef(id,u){const i=this.refs.findIndex(r=>r.id===id);if(i<0)return;Object.assign(this.refs[i],u);await this.save();}
    getApp(id){return this.apps.find(a=>a.id===id);}
    getResume(id){return this.resumes.find(r=>r.id===id);}
    getAppRefs(aid){return this.refs.filter(r=>r.app_id===aid);}
    getAppLogs(aid){return this.logs.filter(l=>l.app_id===aid).sort((a,b)=>new Date(b.at)-new Date(a.at));}
    async addCat(c){c=c.trim();if(c&&!this.categories.includes(c)){this.categories.push(c);await this.save();}return c;}
    async rmCat(c){this.categories=this.categories.filter(x=>x!==c);await this.save();}
    async addPP(p){p=p.trim();if(p&&!this.painPoints.includes(p)){this.painPoints.push(p);await this.save();}return p;}
    async rmPP(p){this.painPoints=this.painPoints.filter(x=>x!==p);await this.save();}
    async addCol(name){const id='custom_'+Date.now();const actIdx=this.tableCols.findIndex(c=>c.id==='actions');if(actIdx>=0)this.tableCols.splice(actIdx,0,{id,label:name,show:true,system:false,custom:true});else this.tableCols.push({id,label:name,show:true,system:false,custom:true});await this.save();return id;}
    async rmCol(id){this.tableCols=this.tableCols.filter(c=>c.id!==id);this.apps.forEach(a=>{if(a.customFields)delete a.customFields[id];});await this.save();}
}
const store=new Store();
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const daysBtw=(a,b)=>Math.floor((new Date(b)-new Date(a))/864e5);
const fmtD=d=>{if(!d)return'—';const t=new Date(d);return`${t.getMonth()+1}/${t.getDate()}`;};
const fmtDT=d=>{if(!d)return'—';const t=new Date(d);return`${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;};
const getSI=k=>STATUSES.find(s=>s.key===k)||STATUSES[0];
const getWait=a=>['OFFER','REJECTED','WITHDRAWN'].includes(a.status)||!a.applied_date?null:daysBtw(a.applied_date,new Date().toISOString().split('T')[0]);
const stars=n=>'⭐'.repeat(parseInt(n)||1);
const ini=n=>(n||'?')[0].toUpperCase();
function toast(m,t='info'){const c=$('#toast-container'),e=document.createElement('div');e.className=`toast ${t}`;e.textContent=m;c.appendChild(e);setTimeout(()=>{e.style.opacity='0';e.style.transform='translateX(120%)';e.style.transition='all .3s var(--ease)';setTimeout(()=>e.remove(),300);},3000);}
async function callAI(p){
    try{const r=await fetch(`${AI_CFG.gemini.url}?key=${AI_CFG.gemini.key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:p}]}]})});if(r.ok){const d=await r.json();return d.candidates?.[0]?.content?.parts?.[0]?.text||'完成。';}}catch(e){}
    try{const r=await fetch(AI_CFG.or.url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${AI_CFG.or.key}`,'HTTP-Referer':location.href},body:JSON.stringify({model:AI_CFG.or.model,messages:[{role:'user',content:p}]})});if(r.ok){const d=await r.json();return d.choices?.[0]?.message?.content||'完成。';}}catch(e){}
    return'⚠️ AI 暂不可用';
}
let curView='pipeline',curTab='info';
function switchView(v){
    curView=v;$$('.view').forEach(x=>x.classList.remove('active'));$$('.nav-item[data-view]').forEach(x=>x.classList.remove('active'));
    const vm={pipeline:'view-pipeline',table:'view-table',resumes:'view-resumes',reflections:'view-reflections',calendar:'view-calendar',analytics:'view-analytics'};
    const tm={pipeline:'投递看板',table:'表格视图',resumes:'简历文件舱',reflections:'复盘记录',calendar:'日历',analytics:'数据大屏'};
    $(`#${vm[v]}`)?.classList.add('active');$(`.nav-item[data-view="${v}"]`)?.classList.add('active');
    $('#view-title').textContent=tm[v]||'';$('#view-subtitle').textContent=v==='pipeline'?`${store.apps.length} 条投递`:'';
    if(v==='pipeline')renderKanban();else if(v==='table')renderTable();else if(v==='resumes')renderResumes();else if(v==='reflections')renderRefs();else if(v==='calendar'&&typeof renderCalendar==='function')renderCalendar();else if(v==='analytics')renderAnalytics();
}
$$('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('#global-search').addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();if(curView==='pipeline')renderKanban(q);else if(curView==='table')renderTable(q);});
$('#toggle-intl-mode').checked=store.settings.intlMode;
$('#toggle-intl-mode').addEventListener('change',e=>{store.settings.intlMode=e.target.checked;store.save();updIntl();if(curView==='pipeline')renderKanban();});
function updIntl(){const s=store.settings.intlMode;$$('.intl-field').forEach(el=>el.style.display=s?'':'none');$('#filter-visa').style.display=s?'':'none';}
updIntl();
// 类别下拉填充
function fillCatSelect(selEl,val){
    selEl.innerHTML='<option value="">选择类别</option>';
    store.categories.forEach(c=>{selEl.innerHTML+=`<option value="${c}" ${val===c?'selected':''}>${c}</option>`;});
}
$('#add-category-inline').addEventListener('click',()=>{
    const name=prompt('输入新类别名称：');
    if(name&&name.trim()){store.addCat(name.trim());fillCatSelect($('#form-category'),name.trim());initFilters();}
});// ---- 看板 ----
function renderKanban(q=''){
    const b=$('#kanban-board'),fc=$('#filter-category').value,fv=$('#filter-visa').value;
    let apps=store.apps.filter(a=>{if(q&&!a.company_name.toLowerCase().includes(q)&&!a.position_title.toLowerCase().includes(q))return false;if(fc&&a.position_category!==fc)return false;if(fv&&a.visa_requirement!==fv)return false;return true;});
    b.innerHTML='';
    getKanbanStatuses().forEach(st=>{
        const col=document.createElement('div');col.className='kanban-column';
        const cards=apps.filter(a=>a.status===st.key);
        col.innerHTML=`<div class="column-header"><span class="column-title">${st.label}</span><span class="column-count">${cards.length}</span></div><div class="column-cards" data-status="${st.key}"></div><button class="column-add">+ 新建</button>`;
        const cc=col.querySelector('.column-cards');
        cards.forEach(a=>cc.appendChild(mkCard(a)));
        cc.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
        cc.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
        cc.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');chgStatus(e.dataTransfer.getData('text/plain'),st.key);});
        col.querySelector('.column-add').addEventListener('click',()=>openAppModal(null,st.key));
        b.appendChild(col);
    });
    $('#view-subtitle').textContent=`${store.apps.length} 条投递`;
}
function mkCard(a){
    const c=document.createElement('div');c.className='kanban-card';c.draggable=true;
    const w=getWait(a),wc=w>30?'danger':w>14?'warn':'',r=a.resume_id?store.getResume(a.resume_id):null;
    const sv=store.settings.intlMode&&a.visa_requirement&&a.visa_requirement!=='UNKNOWN',vi=VISA_MAP[a.visa_requirement]||{};
    let ddl='';if(a.next_deadline){const dl=daysBtw(new Date().toISOString().split('T')[0],a.next_deadline.split('T')[0]);ddl=`<div class="card-ddl ${dl<=3?'urgent':''}">⏰ ${fmtD(a.next_deadline)} ${a.next_action||''}</div>`;}
    const dateStr=a.applied_date?fmtD(a.applied_date):'';
    c.innerHTML=`<div class="card-top"><div class="card-logo">${ini(a.company_name)}</div><div class="card-info"><div class="card-company">${a.company_name}</div><div class="card-position">${a.position_title}</div></div></div><div class="card-meta"><span class="card-stars">${stars(a.preference_level)}</span>${dateStr?`<span style="opacity:.5">${dateStr}</span>`:''}${w!==null?`<span class="card-wait ${wc}">${w}天</span>`:''}${sv?`<span class="card-visa ${vi.cls}">${vi.label}</span>`:''}</div>${r?`<div class="card-resume">📎 ${r.file_name}</div>`:''}${ddl}`;
    c.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',a.id);c.classList.add('dragging');});
    c.addEventListener('dragend',()=>c.classList.remove('dragging'));
    c.addEventListener('click',()=>openDrawer(a.id));
    return c;
}
function chgStatus(id,ns){const a=store.getApp(id);if(!a||a.status===ns)return;if(ns==='REJECTED'){openRejModal(id);return;}store.updateApp(id,{status:ns});if(ns==='OFFER')toast('🎉 Offer！','success');renderKanban($('#global-search').value.toLowerCase().trim());}
let pendRej=null;
function openRejModal(id){pendRej=id;$$('#rejection-options input').forEach(i=>i.checked=false);$('#rejection-modal-overlay').classList.add('active');}
$('#rejection-confirm').addEventListener('click',()=>{if(!pendRej)return;const s=$('#rejection-options input:checked');if(!s){toast('请选择','error');return;}store.updateApp(pendRej,{status:'REJECTED',_rej:s.value});$('#rejection-modal-overlay').classList.remove('active');pendRej=null;renderKanban($('#global-search').value.toLowerCase().trim());});
$('#rejection-modal-close').addEventListener('click',()=>{$('#rejection-modal-overlay').classList.remove('active');pendRej=null;});

// ---- 表格 ----
function renderTable(q=''){
    const fs=$('#table-filter-status').value,cols=store.tableCols.filter(c=>c.show);
    let apps=store.apps.filter(a=>{if(q&&!a.company_name.toLowerCase().includes(q)&&!a.position_title.toLowerCase().includes(q))return false;if(fs&&a.status!==fs)return false;return true;});
    const gb=$('#table-group-by').value,hd=$('#table-header'),bd=$('#table-body');
    hd.innerHTML=cols.map(c=>`<th>${c.label}</th>`).join('');bd.innerHTML='';
    const render=list=>{list.forEach(a=>bd.appendChild(mkRow(a,cols)));};
    if(gb){const groups={};apps.forEach(a=>{let k=gb==='position_category'?a.position_category||'未分类':gb==='status'?getSI(a.status).label:a.source_channel||'未知';if(!groups[k])groups[k]=[];groups[k].push(a);});Object.entries(groups).forEach(([g,items])=>{const gr=document.createElement('tr');gr.innerHTML=`<td colspan="${cols.length}" style="font-weight:600;color:var(--text-primary);background:var(--bg-tertiary);padding:6px 10px;font-size:11px">${g} (${items.length})</td>`;bd.appendChild(gr);render(items);});}
    else{apps.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));render(apps);}
}
function mkRow(a,cols){
    const tr=document.createElement('tr');const w=getWait(a),si=getSI(a.status);
    cols.forEach(col=>{
        const td=document.createElement('td');
        if(col.custom){td.textContent=(a.customFields&&a.customFields[col.id])||'—';td.addEventListener('dblclick',e=>{e.stopPropagation();inlineEdit(td,a,col.id,true);});}
        else switch(col.id){
            case'company_name':td.style.fontWeight='500';td.style.color='var(--text-primary)';td.textContent=a.company_name;td.addEventListener('dblclick',e=>{e.stopPropagation();inlineEdit(td,a,'company_name');});break;
            case'position_title':td.textContent=a.position_title;td.addEventListener('dblclick',e=>{e.stopPropagation();inlineEdit(td,a,'position_title');});break;
            case'position_category':td.textContent=a.position_category||'—';td.addEventListener('dblclick',e=>{e.stopPropagation();inlineCatSel(td,a);});break;
            case'status':td.innerHTML=`<span class="status-pill ${si.cls}">${si.label}</span>`;break;
            case'applied_date':td.textContent=fmtD(a.applied_date);td.addEventListener('dblclick',e=>{e.stopPropagation();inlineDateEdit(td,a);});break;
            case'waiting':td.textContent=w!==null?w+'天':'—';break;
            case'preference_level':td.innerHTML=`<span class="pref-display" style="cursor:pointer">${stars(a.preference_level)}</span>`;td.querySelector('.pref-display').addEventListener('click',e=>{e.stopPropagation();prefSelect(td,a);});break;
            case'source_channel':td.textContent=a.source_channel||'—';td.addEventListener('dblclick',e=>{e.stopPropagation();inlineEdit(td,a,'source_channel');});break;
            case'jd':if(a.jd_url)td.innerHTML=`<a class="jd-link-btn" href="${a.jd_url}" target="_blank" onclick="event.stopPropagation()">🔗</a>`;else if(a.jd_image){td.innerHTML=`<span class="jd-img-btn">🖼</span>`;td.querySelector('.jd-img-btn').addEventListener('click',e=>{e.stopPropagation();$('#jd-preview-img').src=a.jd_image;$('#jd-preview-overlay').classList.add('active');});}else td.textContent='—';break;
            case'actions':td.innerHTML=`<button class="td-action-btn" title="查看详情">✏️</button>`;td.querySelector('button').addEventListener('click',e=>{e.stopPropagation();openDrawer(a.id);});break;
        }
        tr.appendChild(td);
    });
    return tr;
}
function inlineEdit(td,a,f,custom=false){const old=custom?(a.customFields?.[f]||''):(a[f]||'');const inp=document.createElement('input');inp.type='text';inp.className='inline-edit';inp.value=old;td.textContent='';td.appendChild(inp);inp.focus();inp.select();const sv=()=>{const v=inp.value.trim();if(custom){if(!a.customFields)a.customFields={};a.customFields[f]=v;store.updateApp(a.id,{customFields:a.customFields});}else if(v!==old){store.updateApp(a.id,{[f]:v});if(f==='position_category'&&v)store.addCat(v);}renderTable($('#global-search').value.toLowerCase().trim());};inp.addEventListener('blur',sv);inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sv();}if(e.key==='Escape')renderTable($('#global-search').value.toLowerCase().trim());});}
function inlineCatSel(td,a){const sel=document.createElement('select');sel.className='inline-select';sel.innerHTML='<option value="">选择</option>';store.categories.forEach(c=>{sel.innerHTML+=`<option value="${c}" ${a.position_category===c?'selected':''}>${c}</option>`;});sel.innerHTML+='<option value="__NEW__">+ 新增类别...</option>';td.textContent='';td.appendChild(sel);sel.focus();sel.addEventListener('change',()=>{if(sel.value==='__NEW__'){const name=prompt('输入新类别名称：');if(name&&name.trim()){store.addCat(name.trim());store.updateApp(a.id,{position_category:name.trim()});initFilters();}renderTable($('#global-search').value.toLowerCase().trim());}else if(sel.value){store.updateApp(a.id,{position_category:sel.value});renderTable($('#global-search').value.toLowerCase().trim());}});sel.addEventListener('blur',()=>renderTable($('#global-search').value.toLowerCase().trim()));}
function inlineDateEdit(td,a){const inp=document.createElement('input');inp.type='date';inp.className='inline-edit';inp.value=a.applied_date||'';td.textContent='';td.appendChild(inp);inp.focus();inp.addEventListener('blur',async ()=>{const newDate=inp.value;const updates={applied_date:newDate};if(a.timeline&&a.timeline.length){const ae=a.timeline.find(t=>t.name==='已投递');if(ae)ae.date=newDate;updates.timeline=a.timeline;}await store.updateApp(a.id,updates);renderTable($('#global-search').value.toLowerCase().trim());});inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}if(e.key==='Escape')renderTable($('#global-search').value.toLowerCase().trim());});}
function inlineStatusSel(td,a){const sel=document.createElement('select');sel.className='inline-select';STATUSES.forEach(s=>{sel.innerHTML+=`<option value="${s.key}" ${s.key===a.status?'selected':''}>${s.label}</option>`;});td.innerHTML='';td.appendChild(sel);sel.focus();sel.addEventListener('change',()=>{chgStatus(a.id,sel.value);renderTable($('#global-search').value.toLowerCase().trim());});sel.addEventListener('blur',()=>renderTable($('#global-search').value.toLowerCase().trim()));}
function prefSelect(td,a){const sel=document.createElement('select');sel.className='inline-select';PREF_OPTIONS.forEach(p=>{sel.innerHTML+=`<option value="${p.v}" ${a.preference_level==p.v?'selected':''}>${p.l}</option>`;});td.innerHTML='';td.appendChild(sel);sel.focus();sel.addEventListener('change',()=>{store.updateApp(a.id,{preference_level:sel.value});renderTable($('#global-search').value.toLowerCase().trim());});sel.addEventListener('blur',()=>renderTable($('#global-search').value.toLowerCase().trim()));}
$('#table-group-by').addEventListener('change',()=>renderTable($('#global-search').value.toLowerCase().trim()));
$('#table-filter-status').addEventListener('change',()=>renderTable($('#global-search').value.toLowerCase().trim()));
$('#filter-category').addEventListener('change',()=>renderKanban($('#global-search').value.toLowerCase().trim()));
$('#filter-visa').addEventListener('change',()=>renderKanban($('#global-search').value.toLowerCase().trim()));
$('#table-add-row').addEventListener('click',()=>openAppModal());
$('#table-edit-mode-btn').addEventListener('click',()=>{
    // 列管理
    const list=$('#columns-list');list.innerHTML='';store.tableCols.forEach((c,i)=>{const lb=document.createElement('label');lb.innerHTML=`<input type="checkbox" ${c.show?'checked':''} data-idx="${i}"><span>${c.label}</span>${!c.system?`<span class="remove-tag" style="margin-left:auto;cursor:pointer;color:var(--text-muted)">🗑</span>`:''}`;lb.querySelector('.remove-tag')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();store.rmCol(c.id);$('#table-edit-mode-btn').click();});list.appendChild(lb);});
    // 行管理
    const rl=$('#rows-batch-list');rl.innerHTML='';
    store.apps.forEach(a=>{const row=document.createElement('label');row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border-light);font-size:12px;cursor:pointer';row.innerHTML=`<input type="checkbox" class="row-check" data-id="${a.id}"><span style="font-weight:500;color:var(--text-primary)">${a.company_name}</span><span style="color:var(--text-secondary)">${a.position_title}</span><span class="status-pill ${getSI(a.status).cls}" style="margin-left:auto;font-size:10px">${getSI(a.status).label}</span>`;rl.appendChild(row);});
    $('#rows-selected-count').textContent='';
    rl.addEventListener('change',()=>{const cnt=$$('.row-check:checked').length;$('#rows-selected-count').textContent=cnt?`已选 ${cnt} 条`:'';});
    $('#columns-modal-overlay').classList.add('active');
});
$('#rows-add-btn')?.addEventListener('click',()=>{$('#columns-modal-overlay').classList.remove('active');openAppModal();});
$('#rows-batch-del-btn')?.addEventListener('click',()=>{const ids=[];$$('.row-check:checked').forEach(c=>ids.push(c.dataset.id));if(!ids.length){toast('请先勾选要删除的行','error');return;}if(!confirm(`确定删除 ${ids.length} 条投递？`))return;ids.forEach(id=>store.delApp(id));toast(`已删除 ${ids.length} 条`,'success');$('#table-edit-mode-btn').click();refresh();});
$('#add-col-btn').addEventListener('click',async ()=>{const n=$('#new-col-name').value.trim();if(!n)return;await store.addCol(n);$('#new-col-name').value='';$('#table-edit-mode-btn').click();});
$('#columns-done').addEventListener('click',async ()=>{$$('#columns-list input[type="checkbox"]').forEach(inp=>{const i=parseInt(inp.dataset.idx);if(!isNaN(i))store.tableCols[i].show=inp.checked;});await store.save();$('#columns-modal-overlay').classList.remove('active');renderTable($('#global-search').value.toLowerCase().trim());});
$('#columns-modal-close').addEventListener('click',()=>$('#columns-modal-overlay').classList.remove('active'));
$('#jd-preview-close').addEventListener('click',()=>$('#jd-preview-overlay').classList.remove('active'));
$('#jd-preview-overlay').addEventListener('click',e=>{if(e.target===$('#jd-preview-overlay'))$('#jd-preview-overlay').classList.remove('active');});
const jdZ=$('#jd-paste-zone');let jdImg=null;
jdZ.addEventListener('click',()=>jdZ.focus());
jdZ.addEventListener('paste',e=>{const items=e.clipboardData?.items;if(!items)return;for(let i=0;i<items.length;i++){if(items[i].type.startsWith('image/')){e.preventDefault();const rd=new FileReader();rd.onload=ev=>{jdImg=ev.target.result;jdZ.innerHTML=`<img src="${jdImg}">`;jdZ.classList.add('has-image');};rd.readAsDataURL(items[i].getAsFile());return;}}});
jdZ.addEventListener('dragover',e=>e.preventDefault());
jdZ.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f?.type.startsWith('image/')){const rd=new FileReader();rd.onload=ev=>{jdImg=ev.target.result;jdZ.innerHTML=`<img src="${jdImg}">`;jdZ.classList.add('has-image');};rd.readAsDataURL(f);}});
let editId=null;
function openAppModal(id=null,defSt='APPLIED'){editId=id;const a=id?store.getApp(id):null;$('#modal-title').textContent=a?'编辑投递':'新建投递';$('#form-company').value=a?.company_name||'';$('#form-position').value=a?.position_title||'';fillCatSelect($('#form-category'),a?.position_category||'');$('#form-status').value=a?.status||defSt;$('#form-date').value=a?.applied_date||new Date().toISOString().split('T')[0];$('#form-preference').value=a?.preference_level||'3';$('#form-visa').value=a?.visa_requirement||'UNKNOWN';$('#form-channel').value=a?.source_channel||'';$('#form-salary').value=a?.salary_expectation||'';$('#form-next-action').value=a?.next_action||'';$('#form-deadline').value=a?.next_deadline||'';$('#form-jd-url').value=a?.jd_url||'';$('#form-notes').value=a?.notes||'';jdImg=a?.jd_image||null;if(jdImg){jdZ.innerHTML=`<img src="${jdImg}">`;jdZ.classList.add('has-image');}else{jdZ.innerHTML='<span class="jd-paste-hint">点击后粘贴截图或拖拽图片</span>';jdZ.classList.remove('has-image');}const rs=$('#form-resume');rs.innerHTML='<option value="">不绑定</option>';store.resumes.forEach(r=>{rs.innerHTML+=`<option value="${r.id}" ${a?.resume_id===r.id?'selected':''}>${r.file_name}</option>`;});
// 渲染自定义字段
const cfa=$('#custom-fields-area');cfa.innerHTML='';
const customCols=store.tableCols.filter(c=>c.custom);
if(customCols.length){customCols.forEach(col=>{const val=a?.customFields?.[col.id]||'';cfa.innerHTML+=`<div class="form-group"><label>${col.label}</label><input type="text" class="custom-field-input" data-col-id="${col.id}" value="${val}" placeholder="输入${col.label}..."></div>`;});}
updIntl();$('#modal-overlay').classList.add('active');}
async function saveApp(cont=false){const co=$('#form-company').value.trim(),po=$('#form-position').value.trim(),ca=$('#form-category').value;if(!co||!po||!ca){toast('请填写公司、岗位和类别','error');return;}const appliedDate=$('#form-date').value;const d={company_name:co,position_title:po,position_category:ca,applied_date:appliedDate,resume_id:$('#form-resume').value||null,preference_level:$('#form-preference').value,visa_requirement:$('#form-visa').value,source_channel:$('#form-channel').value,salary_expectation:$('#form-salary').value,next_action:$('#form-next-action').value,next_deadline:$('#form-deadline').value,jd_url:$('#form-jd-url').value,jd_image:jdImg,notes:$('#form-notes').value};
// 收集自定义字段
const cf={};$$('.custom-field-input').forEach(inp=>{cf[inp.dataset.colId]=inp.value.trim();});if(Object.keys(cf).length)d.customFields=cf;
if(editId){const old=store.getApp(editId);d.customFields=Object.assign({},old?.customFields||{},cf);
// 同步投递日期到时间线
if(old.timeline&&old.timeline.length){const ae=old.timeline.find(t=>t.name==='已投递');if(ae)ae.date=appliedDate;d.timeline=old.timeline;}
const ok=await store.updateApp(editId,d);if(!ok){toast('保存失败，请重试','error');return;}toast('已更新','success');}else{d.timeline=[{name:'已投递',date:appliedDate}];d.status='APPLIED';d.customFields=cf;const ok=await store.addApp(d);if(!ok){toast('保存失败，请重试','error');return;}toast('已创建','success');}if(cont){editId=null;$('#form-company').value='';$('#form-position').value='';$('#form-company').focus();}else{$('#modal-overlay').classList.remove('active');editId=null;}refresh();}
$('#add-application-btn').addEventListener('click',()=>openAppModal());
$('#modal-save').addEventListener('click',()=>saveApp(false));
$('#modal-save-continue').addEventListener('click',()=>saveApp(true));
$('#modal-cancel').addEventListener('click',()=>{$('#modal-overlay').classList.remove('active');editId=null;});
$('#modal-close').addEventListener('click',()=>{$('#modal-overlay').classList.remove('active');editId=null;});

// ---- 侧边栏（时间线可编辑，自定义轮次）----
let curDId=null,tlEditing=false;
function openDrawer(id){curDId=id;tlEditing=false;const a=store.getApp(id);if(!a)return;const si=getSI(a.status);$('#drawer-logo').textContent=ini(a.company_name);$('#drawer-company').textContent=a.company_name;$('#drawer-position').textContent=a.position_title;$('#drawer-status').className=`status-badge ${si.cls}`;$('#drawer-status').textContent=si.label;const w=getWait(a);$('#drawer-meta').textContent=w!==null?`等待${w}天 · ${fmtD(a.applied_date)}`:`${fmtD(a.applied_date)}`;renderDInfo(a);renderDTL(a);renderDRefs(a);$$('.drawer-tab').forEach(t=>t.classList.remove('active'));$$('.drawer-tab-content').forEach(t=>t.classList.remove('active'));$('.drawer-tab[data-tab="info"]').classList.add('active');$('#tab-info').classList.add('active');curTab='info';updDActions();$('#drawer-overlay').classList.add('active');}
function renderDInfo(a){const info=$('#tab-info');info.innerHTML='';const f=[['岗位类别',a.position_category||'—'],['偏好度',stars(a.preference_level)],['渠道',a.source_channel||'—'],['薪资',a.salary_expectation||'—'],['下一步',a.next_action||'—'],['DDL',a.next_deadline?fmtDT(a.next_deadline):'—'],['JD',a.jd_url?`<a href="${a.jd_url}" target="_blank" style="color:var(--blue)">${a.jd_url}</a>`:'—'],['备注',a.notes||'—']];if(store.settings.intlMode)f.splice(2,0,['工签',(VISA_MAP[a.visa_requirement]||{}).label||'—']);const res=a.resume_id?store.getResume(a.resume_id):null;if(res)f.splice(1,0,['简历',`📎 ${res.file_name}`]);f.forEach(([l,v])=>{info.innerHTML+=`<div class="info-field"><div class="info-label">${l}</div><div class="info-value">${v}</div></div>`;});if(a.jd_image)info.innerHTML+=`<div class="info-field"><div class="info-label">JD截图</div><div class="info-value"><img src="${a.jd_image}" style="max-width:100%;border-radius:6px;cursor:pointer" onclick="document.getElementById('jd-preview-img').src=this.src;document.getElementById('jd-preview-overlay').classList.add('active')"></div></div>`;}
function renderDTL(a,edit=false){
    const tl=$('#tab-timeline');tl.innerHTML='';
    const timeline=a.timeline||[];
    if(edit){
        tl.innerHTML='<div style="margin-bottom:10px;font-size:12px;color:var(--text-secondary)">编辑面试流程（状态会自动跟随最新轮次）：</div>';
        const list=document.createElement('div');list.id='tl-edit';
        timeline.forEach((item,i)=>{
            const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:6px';
            const sel=document.createElement('select');sel.className='inline-select';sel.style.flex='1';sel.dataset.i=String(i);sel.dataset.f='name';
            TL_OPTIONS.forEach(o=>{sel.innerHTML+=`<option value="${o}" ${item.name===o?'selected':''}>${o}</option>`;});
            const dateInp=document.createElement('input');dateInp.type='date';dateInp.className='inline-edit';dateInp.style.width='130px';dateInp.value=item.date||'';dateInp.dataset.i=String(i);dateInp.dataset.f='date';
            const isFirst=i===0&&item.name==='已投递';
            const delBtn=document.createElement('button');delBtn.className='td-action-btn';delBtn.textContent='×';delBtn.style.visibility=isFirst?'hidden':'visible';
            delBtn.addEventListener('click',()=>{timeline.splice(i,1);store.updateApp(a.id,{timeline});renderDTL(a,true);});
            row.appendChild(sel);row.appendChild(dateInp);row.appendChild(delBtn);list.appendChild(row);
        });
        tl.appendChild(list);
        const btns=document.createElement('div');btns.style.cssText='display:flex;gap:6px;margin-top:8px';
        btns.innerHTML=`<button class="btn-ghost btn-sm" id="tl-add">+ 添加轮次</button><button class="btn-primary btn-sm" id="tl-save">保存</button>`;
        tl.appendChild(btns);
        $('#tl-add').addEventListener('click',()=>{timeline.push({name:'一面',date:''});store.updateApp(a.id,{timeline});renderDTL(a,true);});
        $('#tl-save').addEventListener('click',async ()=>{
            $$('#tl-edit select, #tl-edit input').forEach(el=>{const i=parseInt(el.dataset.i),f=el.dataset.f;if(!isNaN(i)&&timeline[i])timeline[i][f]=el.value;});
            // 从时间线推导状态
            const newStatus=deriveStatus(timeline);
            // 同步"已投递"日期到 applied_date
            const appliedEntry=timeline.find(t=>t.name==='已投递');
            const updates={timeline,status:newStatus};
            if(appliedEntry&&appliedEntry.date)updates.applied_date=appliedEntry.date;
            await store.updateApp(a.id,updates);
            tlEditing=false;
            // 刷新侧边栏头部状态
            const si=getSI(newStatus);$('#drawer-status').className=`status-badge ${si.cls}`;$('#drawer-status').textContent=si.label;
            renderDTL(a);updDActions();refresh();toast('已保存','success');
        });
    }else{
        // 统一显示时间线
        if(!timeline.length){tl.innerHTML='<div class="empty-state"><p>暂无记录</p><span>点击编辑添加面试轮次</span></div>';return;}
        timeline.forEach(item=>{
            if(!item.name)return;
            const sk=TL_TO_STATUS[item.name];
            const dc=item.name==='Offer'?'active':item.name==='挂了'?'rejected':'';
            tl.innerHTML+=`<div class="timeline-item"><div class="timeline-dot ${dc}"></div><div class="timeline-content"><div class="timeline-status">${item.name}</div><div class="timeline-time">${item.date?fmtD(item.date):'—'}</div></div></div>`;
        });
    }
}
function renderDRefs(a){const rt=$('#tab-reflections');const refs=store.getAppRefs(a.id);rt.innerHTML=refs.length?'':'<div class="empty-state"><p>暂无复盘</p></div>';refs.forEach(ref=>{const rl=ROUND_LABELS[ref.interview_round]||ref.interview_round;const c=document.createElement('div');c.className='reflection-card';c.style.marginBottom='8px';c.innerHTML=`<div class="reflection-card-header"><span class="reflection-card-round">${rl}</span><span style="font-size:10px;color:var(--text-muted)">${fmtDT(ref.at)}</span></div><div class="reflection-card-content">${ref.cleaned_content||ref.raw_content||''}</div>${ref.pain_points?.length?`<div class="reflection-card-footer">${ref.pain_points.map(p=>`<span class="pain-tag">${p}</span>`).join('')}</div>`:''}`;c.addEventListener('click',()=>openRefModal(ref.id));rt.appendChild(c);});}
function updDActions(){
    const acts=$('#drawer-actions');
    if(curTab==='info')acts.innerHTML='<button class="btn-secondary" id="d-edit">编辑详情</button><button class="btn-danger" id="d-del">删除</button>';
    else if(curTab==='timeline')acts.innerHTML=`<button class="btn-secondary" id="d-edit">${tlEditing?'取消编辑':'编辑时间线'}</button><button class="btn-danger" id="d-del">删除</button>`;
    else acts.innerHTML='<button class="btn-primary" id="d-newref">+ 新建复盘</button><button class="btn-danger" id="d-del">删除</button>';
    $('#d-edit')?.addEventListener('click',()=>{
        if(curTab==='info'){$('#drawer-overlay').classList.remove('active');openAppModal(curDId);}
        else if(curTab==='timeline'){tlEditing=!tlEditing;const a=store.getApp(curDId);renderDTL(a,tlEditing);updDActions();}
    });
    $('#d-newref')?.addEventListener('click',()=>openRefModal(null,curDId));
    $('#d-del')?.addEventListener('click',()=>{if(confirm('确定删除？')){store.delApp(curDId);$('#drawer-overlay').classList.remove('active');refresh();toast('已删除','info');}});
}
$$('.drawer-tab').forEach(t=>{t.addEventListener('click',()=>{$$('.drawer-tab').forEach(x=>x.classList.remove('active'));$$('.drawer-tab-content').forEach(x=>x.classList.remove('active'));t.classList.add('active');$(`#tab-${t.dataset.tab}`).classList.add('active');curTab=t.dataset.tab;updDActions();});});
$('#drawer-close').addEventListener('click',()=>$('#drawer-overlay').classList.remove('active'));
$('#drawer-overlay').addEventListener('click',e=>{if(e.target===$('#drawer-overlay'))$('#drawer-overlay').classList.remove('active');});
function refresh(){const q=$('#global-search').value.toLowerCase().trim();if(curView==='pipeline')renderKanban(q);else if(curView==='table')renderTable(q);else if(curView==='resumes')renderResumes();else if(curView==='reflections')renderRefs();else if(curView==='calendar'&&typeof renderCalendar==='function')renderCalendar();else if(curView==='analytics')renderAnalytics();}
// ---- 简历 ----
function renderResumes(){
    const g=$('#resumes-grid');
    if(!store.resumes.length){g.innerHTML='<div class="empty-state"><p>还没有简历</p><span>上传第一份简历吧</span></div>';return;}
    g.innerHTML='';
    store.resumes.forEach(r=>{
        const linked=store.apps.filter(a=>a.resume_id===r.id);
        const c=document.createElement('div');c.className='resume-card';
        const gradients=['linear-gradient(135deg,rgba(96,165,250,.15),rgba(167,139,250,.1))','linear-gradient(135deg,rgba(74,222,128,.12),rgba(96,165,250,.1))','linear-gradient(135deg,rgba(251,146,60,.12),rgba(248,113,113,.08))','linear-gradient(135deg,rgba(167,139,250,.15),rgba(244,114,182,.1))'];
        const gi=store.resumes.indexOf(r)%gradients.length;
        c.innerHTML=`<div class="resume-card-banner" style="background:${gradients[gi]}"><div class="resume-icon-lg">📄</div></div><div class="resume-card-body"><div class="resume-card-name">${r.file_name}</div><div class="resume-card-meta">${fmtDT(r.at)} · ${r.file_type||'PDF'}${r.size?(' · '+(r.size/1024).toFixed(0)+'KB'):''}</div>${linked.length?`<div class="resume-card-linked">关联 <span>${linked.length}</span> 条投递：${linked.slice(0,3).map(a=>a.company_name+' '+a.position_title).join('、')}${linked.length>3?'...':''}</div>`:`<div class="resume-card-linked" style="color:var(--text-muted)">未关联投递</div>`}${r.tags?.length?`<div class="resume-card-tags">${r.tags.map(t=>`<span class="resume-tag">${t}</span>`).join('')}</div>`:''}<div class="resume-card-actions">${r.data_url?`<button class="resume-action-btn preview-btn">👁 预览</button>`:''}<button class="resume-action-btn link-btn">🔗 关联岗位</button><button class="resume-action-btn del-btn" style="flex:0;padding:7px 12px;color:var(--red)">🗑</button></div></div>`;
        c.querySelector('.preview-btn')?.addEventListener('click',e=>{e.stopPropagation();if(r.data_url)window.open(r.data_url,'_blank');else toast('无预览数据，请重新上传','error');});
        c.querySelector('.link-btn').addEventListener('click',e=>{e.stopPropagation();openResumeLinkModal(r.id);});
        c.querySelector('.del-btn').addEventListener('click',e=>{e.stopPropagation();if(confirm('删除简历「'+r.file_name+'」？')){store.delResume(r.id);renderResumes();toast('已删除','info');}});
        g.appendChild(c);
    });
}
$('#upload-resume-btn').addEventListener('click',()=>{$('#resume-name').value='';$('#resume-tags').value='';$('#resume-file-input').value='';$('#resume-modal-overlay').classList.add('active');});
$('#upload-zone').addEventListener('click',()=>$('#resume-file-input').click());
$('#upload-zone').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('dragover');});
$('#upload-zone').addEventListener('dragleave',e=>e.currentTarget.classList.remove('dragover'));
$('#upload-zone').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);});
let selFile=null;
$('#resume-file-input').addEventListener('change',e=>{if(e.target.files[0])handleFile(e.target.files[0]);});
function handleFile(f){if(f.size>10485760){toast('超过10MB','error');return;}if(!f.name.match(/\.(pdf|docx)$/i)){toast('仅PDF/DOCX','error');return;}selFile=f;$('#resume-name').value=f.name.replace(/\.(pdf|docx)$/i,'');$('#upload-zone').querySelector('p').textContent=`已选: ${f.name}`;}
$('#resume-save').addEventListener('click',async ()=>{const n=$('#resume-name').value.trim();if(!n){toast('请输入名称','error');return;}const tags=$('#resume-tags').value.split(',').map(t=>t.trim()).filter(Boolean);const rd={file_name:n,orig:selFile?.name||n,file_type:selFile?.name?.endsWith('.pdf')?'PDF':'DOCX',size:selFile?.size||0,tags,data_url:null};if(selFile){const reader=new FileReader();reader.onload=async e=>{rd.data_url=e.target.result;const ok=await store.addResume(rd);if(!ok){toast('保存失败，请重试','error');return;}toast('已上传','success');$('#resume-modal-overlay').classList.remove('active');selFile=null;renderResumes();};reader.readAsDataURL(selFile);}else{const ok=await store.addResume(rd);if(!ok){toast('保存失败，请重试','error');return;}toast('已保存','success');$('#resume-modal-overlay').classList.remove('active');renderResumes();}});
$('#resume-cancel').addEventListener('click',()=>{$('#resume-modal-overlay').classList.remove('active');selFile=null;});
$('#resume-modal-close').addEventListener('click',()=>{$('#resume-modal-overlay').classList.remove('active');selFile=null;});

// ---- 复盘 ----
let editRefId=null;
function renderRefs(){
    const l=$('#reflections-list');
    if(!store.refs.length){l.innerHTML='<div class="empty-state"><p>还没有复盘</p><span>面试后记录一下吧</span></div>';return;}
    l.innerHTML='';
    // 按公司+岗位分组
    const groups={};
    [...store.refs].sort((a,b)=>new Date(b.at)-new Date(a.at)).forEach(ref=>{
        const app=store.getApp(ref.app_id);
        const key=app?`${app.company_name}|||${app.position_title}`:'未知|||未知';
        if(!groups[key])groups[key]={app,refs:[]};
        groups[key].refs.push(ref);
    });
    Object.values(groups).forEach(g=>{
        const header=document.createElement('div');
        header.style.cssText='font-size:13px;font-weight:600;color:var(--text-primary);padding:10px 0 6px;border-bottom:1px solid var(--border-light);margin-bottom:8px;display:flex;align-items:center;gap:8px';
        header.innerHTML=`<span style="width:28px;height:28px;border-radius:6px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--text-tertiary);border:1px solid var(--border);flex-shrink:0">${ini(g.app?.company_name||'?')}</span>${g.app?g.app.company_name+' · '+g.app.position_title:'未知'}<span style="font-size:11px;color:var(--text-muted);font-weight:400">${g.refs.length}条</span>`;
        l.appendChild(header);
        g.refs.forEach(ref=>{
            const rl=ROUND_LABELS[ref.interview_round]||ref.interview_round;
            const c=document.createElement('div');c.className='reflection-card';
            c.innerHTML=`<div class="reflection-card-header"><span class="reflection-card-round">${rl}</span><span style="font-size:10px;color:var(--text-muted)">${fmtDT(ref.at)}</span></div><div class="reflection-card-content">${ref.cleaned_content||ref.raw_content||''}</div><div class="reflection-card-footer">${ref.self_rating?`<span>${'★'.repeat(ref.self_rating)}${'☆'.repeat(5-ref.self_rating)}</span>`:''}${ref.pain_points?.map(p=>`<span class="pain-tag">${p}</span>`).join('')||''}</div>`;
            c.addEventListener('click',()=>openRefModal(ref.id));l.appendChild(c);
        });
    });
}
$('#new-reflection-btn').addEventListener('click',()=>openRefModal(null));
function renderPPTags(sel=[]){const el=$('#pain-points-selector');el.innerHTML='';store.painPoints.forEach(p=>{const lb=document.createElement('label');lb.className='tag-check';lb.innerHTML=`<input type="checkbox" value="${p}" ${sel.includes(p)?'checked':''}><span>${p}</span>`;el.appendChild(lb);});}
function openRefModal(refId=null,preAppId=null){
    editRefId=refId;const ref=refId?store.refs.find(r=>r.id===refId):null;
    $('#reflection-modal-title').textContent=ref?'编辑复盘':'新建复盘';
    const sel=$('#reflection-application');sel.innerHTML='<option value="">选择投递...</option>';
    store.apps.filter(a=>a.status!=='WATCHING').forEach(a=>{sel.innerHTML+=`<option value="${a.id}" ${(ref?.app_id===a.id||preAppId===a.id)?'selected':''}>${a.company_name} - ${a.position_title}</option>`;});
    $('#reflection-round').value=ref?.interview_round||'ROUND_1';$('#reflection-content').value=ref?.raw_content||'';
    renderPPTags(ref?.pain_points||[]);
    $$('.star-rating .star').forEach(s=>s.classList.toggle('active',parseInt(s.dataset.val)<=(ref?.self_rating||0)));
    $('#ai-analysis-section').style.display=ref?.ai_extracted?'':'none';if(ref?.ai_extracted)$('#ai-analysis-content').textContent=ref.ai_extracted;
    $('#voice-recorder').style.display='none';$('#reflection-content').style.display='';$$('.mode-btn').forEach(b=>b.classList.remove('active'));$('.mode-btn[data-mode="text"]').classList.add('active');
    $('#reflection-modal-overlay').classList.add('active');
}
$('#add-pain-point-btn').addEventListener('click',()=>{const inp=$('#new-pain-point-input'),v=inp.value.trim();if(!v)return;store.addPP(v);inp.value='';const cur=[];$$('#pain-points-selector input:checked').forEach(i=>cur.push(i.value));cur.push(v);renderPPTags(cur);});
$('#new-pain-point-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#add-pain-point-btn').click();}});
$$('.mode-btn').forEach(b=>{b.addEventListener('click',()=>{$$('.mode-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#reflection-content').style.display=b.dataset.mode==='text'?'':'none';$('#voice-recorder').style.display=b.dataset.mode==='voice'?'':'none';});});
let mediaRec=null,audioChunks=[],recTimer=null,recSec=0;
$('#record-btn').addEventListener('click',async()=>{const btn=$('#record-btn');if(mediaRec?.state==='recording'){mediaRec.stop();btn.classList.remove('recording');$('#record-label').textContent='处理中...';clearInterval(recTimer);return;}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});mediaRec=new MediaRecorder(stream);audioChunks=[];recSec=0;mediaRec.ondataavailable=e=>audioChunks.push(e.data);mediaRec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());$('#voice-result').style.display='';$('#voice-result').textContent='录音完成';$('#reflection-content').value='（录音完成，请编辑）';$('#reflection-content').style.display='';$('#record-label').textContent='重新录音';};mediaRec.start();btn.classList.add('recording');$('#record-label').textContent='录音中...';recTimer=setInterval(()=>{recSec++;$('#record-timer').textContent=`${String(Math.floor(recSec/60)).padStart(2,'0')}:${String(recSec%60).padStart(2,'0')}`;},1000);}catch(e){toast('无法访问麦克风','error');}});
$$('.star-rating .star').forEach(s=>{s.addEventListener('click',()=>{const v=parseInt(s.dataset.val);$$('.star-rating .star').forEach(x=>x.classList.toggle('active',parseInt(x.dataset.val)<=v));});});
$('#reflection-ai-btn').addEventListener('click',async()=>{const c=$('#reflection-content').value.trim();if(!c||c.length<10){toast('请先输入内容','error');return;}$('#ai-analysis-section').style.display='';$('#ai-analysis-content').innerHTML='<div class="insight-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>分析中...</span></div>';$('#ai-analysis-content').textContent=await callAI(`求职面试教练。分析：1.考点 2.回答 3.改进\n\n${c}\n\n简洁中文。`);});
$('#reflection-save').addEventListener('click',async ()=>{const aid=$('#reflection-application').value,round=$('#reflection-round').value,content=$('#reflection-content').value.trim();if(!aid||!round){toast('请选择投递和轮次','error');return;}if(!content){toast('请输入内容','error');return;}const pp=[];$$('#pain-points-selector input:checked').forEach(i=>pp.push(i.value));let sr=0;$$('.star-rating .star.active').forEach(()=>sr++);const aiC=$('#ai-analysis-content').textContent,aiOk=aiC&&!aiC.includes('分析中');const d={app_id:aid,interview_round:round,input_type:'TEXT',raw_content:content,cleaned_content:content,ai_extracted:aiOk?aiC:null,pain_points:pp,self_rating:sr||null};if(editRefId){const ok=await store.updateRef(editRefId,d);if(ok===false){toast('保存失败，请重试','error');return;}toast('已更新','success');}else{const ok=await store.addRef(d);if(ok===false){toast('保存失败，请重试','error');return;}toast('已保存','success');}$('#reflection-modal-overlay').classList.remove('active');editRefId=null;renderRefs();if(curDId)openDrawer(curDId);});
$('#reflection-cancel').addEventListener('click',()=>{$('#reflection-modal-overlay').classList.remove('active');editRefId=null;});
$('#reflection-modal-close').addEventListener('click',()=>{$('#reflection-modal-overlay').classList.remove('active');editRefId=null;});

// ---- 数据大屏 ----
function renderAnalytics(){
    const apps=store.apps,ap=apps.filter(a=>a.status!=='WATCHING'),ac=apps.filter(a=>!['WATCHING','REJECTED','WITHDRAWN'].includes(a.status));
    const iv=apps.filter(a=>['ROUND_1','ROUND_2','ROUND_3','ROUND_4'].includes(a.status)),of=apps.filter(a=>a.status==='OFFER'),rj=apps.filter(a=>a.status==='REJECTED');
    const rc=apps.filter(a=>['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,rr=ap.length?Math.round(rc/ap.length*100):0;
    $('#stat-cards').innerHTML=`<div class="stat-card"><div class="stat-card-label">总投递</div><div class="stat-card-value">${ap.length}</div></div><div class="stat-card"><div class="stat-card-label">活跃</div><div class="stat-card-value">${ac.length}</div></div><div class="stat-card"><div class="stat-card-label">面试中</div><div class="stat-card-value">${iv.length}</div></div><div class="stat-card"><div class="stat-card-label">Offer</div><div class="stat-card-value" style="color:var(--green)">${of.length}</div></div><div class="stat-card"><div class="stat-card-label">回复率</div><div class="stat-card-value">${rr}%</div></div><div class="stat-card"><div class="stat-card-label">挂了</div><div class="stat-card-value" style="color:var(--red)">${rj.length}</div></div>`;
    const fd=[{l:'投递',c:ap.length,co:'#60a5fa'},{l:'笔试',c:apps.filter(a=>['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#a78bfa'},{l:'一面+',c:apps.filter(a=>['ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#818cf8'},{l:'二面+',c:apps.filter(a=>['ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#fb923c'},{l:'Offer',c:of.length,co:'#4ade80'}];
    const mf=Math.max(fd[0].c,1);$('#funnel-chart').innerHTML=fd.map(d=>`<div class="funnel-stage"><span class="funnel-label">${d.l}</span><div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${Math.max(Math.round(d.c/mf*100),5)}%;background:${d.co}">${d.c}</div></div><span class="funnel-value">${fd[0].c?Math.round(d.c/fd[0].c*100):0}%</span></div>`).join('');
    const cs={};ap.forEach(a=>{const c=a.position_category||'其他';if(!cs[c])cs[c]={t:0,r:0};cs[c].t++;if(['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status))cs[c].r++;});
    const ce=Object.entries(cs).sort((a,b)=>(b[1].r/b[1].t)-(a[1].r/a[1].t)),mc=Math.max(...ce.map(([,v])=>v.t),1);
    $('#category-chart').innerHTML=ce.length?ce.map(([c,v],i)=>`<div class="category-bar-item"><span class="category-name">${c}</span><div class="category-bar-wrap"><div class="category-bar" style="width:${Math.max(Math.round(v.t/mc*100),8)}%;background:${COLORS[i%COLORS.length]};opacity:.7"></div></div><span class="category-rate">${Math.round(v.r/v.t*100)}%(${v.t})</span></div>`).join(''):'<div class="empty-state"><p>暂无</p></div>';
    const rs={};store.logs.filter(l=>l.to==='REJECTED'&&l.rej).forEach(l=>{rs[l.rej]=(rs[l.rej]||0)+1;});
    const re=Object.entries(rs).sort((a,b)=>b[1]-a[1]),mr=Math.max(...re.map(([,v])=>v),1);
    $('#attribution-chart').innerHTML=re.length?re.map(([s,c])=>`<div class="attribution-item"><span class="attribution-label">${REJECTION_STAGES[s]||s}</span><div class="attribution-bar-wrap"><div class="attribution-bar" style="width:${Math.max(Math.round(c/mr*100),8)}%"></div></div><span class="attribution-count">${c}</span></div>`).join(''):'<div class="empty-state"><p>暂无归因</p></div>';
    doInsight(ap,cs,rs);
}
async function doInsight(ap,cs,rs){const el=$('#insight-content');if(ap.length<3){el.innerHTML='<div class="empty-state"><p>投递3条以上解锁</p></div>';return;}el.innerHTML='<div class="insight-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>分析中...</span></div>';const cS=Object.entries(cs).map(([c,v])=>`${c}:投${v.t}回${v.r}`).join(';'),rS=Object.entries(rs).map(([s,c])=>`${REJECTION_STAGES[s]||s}:${c}`).join(';');el.textContent=await callAI(`求职顾问。总投${ap.length}，类别:${cS||'无'}，归因:${rS||'无'}。3-5条简洁中文建议。`);}

// ---- 设置 ----
$('#settings-btn').addEventListener('click',()=>{renderSetCats();renderSetPPs();$('#clear-confirm-area').style.display='none';$('#clear-confirm-input').value='';$('#settings-modal-overlay').classList.add('active');});
function renderSetCats(){const el=$('#settings-categories');el.innerHTML='';store.categories.forEach(c=>{const t=document.createElement('span');t.className='settings-tag';t.innerHTML=`${c} <span class="remove-tag">×</span>`;t.querySelector('.remove-tag').addEventListener('click',()=>{store.rmCat(c);renderSetCats();initFilters();});el.appendChild(t);});}
function renderSetPPs(){const el=$('#settings-painpoints');el.innerHTML='';store.painPoints.forEach(p=>{const t=document.createElement('span');t.className='settings-tag';t.innerHTML=`${p} <span class="remove-tag">×</span>`;t.querySelector('.remove-tag').addEventListener('click',()=>{store.rmPP(p);renderSetPPs();});el.appendChild(t);});}
$('#settings-add-cat').addEventListener('click',async ()=>{const v=$('#settings-new-cat').value.trim();if(v){await store.addCat(v);$('#settings-new-cat').value='';renderSetCats();initFilters();}});
$('#settings-new-cat').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#settings-add-cat').click();}});
$('#settings-add-pp').addEventListener('click',async ()=>{const v=$('#settings-new-pp').value.trim();if(v){await store.addPP(v);$('#settings-new-pp').value='';renderSetPPs();}});
$('#settings-new-pp').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#settings-add-pp').click();}});
$('#settings-export').addEventListener('click',()=>{
    // 导出为 CSV (Excel 兼容)
    const cols=store.tableCols.filter(c=>c.show&&c.id!=='actions');
    let csv='\uFEFF'+cols.map(c=>c.label).join(',')+'\n';
    store.apps.forEach(a=>{
        const row=cols.map(col=>{
            if(col.custom)return(a.customFields?.[col.id]||'').replace(/,/g,'，');
            switch(col.id){
                case'company_name':return a.company_name||'';
                case'position_title':return a.position_title||'';
                case'position_category':return a.position_category||'';
                case'status':return getSI(a.status).label;
                case'applied_date':return a.applied_date||'';
                case'waiting':const w=getWait(a);return w!==null?w+'天':'';
                case'preference_level':return['','保底','一般','心仪','梦想'][parseInt(a.preference_level)||0]||'';
                case'source_channel':return a.source_channel||'';
                case'jd':return a.jd_url||'';
                default:return'';
            }
        });
        csv+=row.join(',')+'\n';
    });
    const b=new Blob([csv],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const el=document.createElement('a');el.href=u;el.download='履迹-投递记录.csv';el.click();URL.revokeObjectURL(u);toast('已导出 Excel','success');
});
$('#settings-clear').addEventListener('click',()=>{$('#clear-confirm-area').style.display='';$('#clear-confirm-input').value='';$('#clear-confirm-input').focus();});
$('#clear-confirm-btn').addEventListener('click',()=>{if($('#clear-confirm-input').value.trim()==='确定清除数据'){localStorage.clear();location.reload();}else{toast('请输入正确的确认文字','error');}});
$('#settings-done').addEventListener('click',()=>$('#settings-modal-overlay').classList.remove('active'));
$('#settings-modal-close').addEventListener('click',()=>$('#settings-modal-overlay').classList.remove('active'));

// ---- 初始化 ----
// 简历批量关联
function openResumeLinkModal(resumeId){
    const resume=store.getResume(resumeId);if(!resume)return;
    const linked=store.apps.filter(a=>a.resume_id===resumeId).map(a=>a.id);
    let html=`<div class="modal-overlay active" id="resume-link-overlay" style="z-index:110"><div class="modal"><div class="modal-header"><h2>关联投递 · ${resume.file_name}</h2><button class="modal-close" id="resume-link-close">&times;</button></div><div class="modal-body"><p class="modal-desc">勾选要关联此简历的投递：</p><div id="resume-link-list" style="max-height:300px;overflow-y:auto">`;
    store.apps.forEach(a=>{const checked=linked.includes(a.id)?'checked':'';html+=`<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border-light);cursor:pointer;font-size:12px"><input type="checkbox" class="rl-check" data-id="${a.id}" ${checked}><span style="font-weight:500;color:var(--text-primary)">${a.company_name}</span><span style="color:var(--text-secondary)">${a.position_title}</span></label>`;});
    html+=`</div></div><div class="modal-footer"><button class="btn-primary" id="resume-link-save">保存关联</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',html);
    $('#resume-link-close').addEventListener('click',()=>$('#resume-link-overlay').remove());
    $('#resume-link-overlay').addEventListener('click',e=>{if(e.target===$('#resume-link-overlay'))$('#resume-link-overlay').remove();});
    $('#resume-link-save').addEventListener('click',()=>{
        const selected=new Set();$$('.rl-check:checked').forEach(c=>selected.add(c.dataset.id));
        store.apps.forEach(a=>{if(selected.has(a.id)){if(a.resume_id!==resumeId)store.updateApp(a.id,{resume_id:resumeId});}else{if(a.resume_id===resumeId)store.updateApp(a.id,{resume_id:null});}});
        $('#resume-link-overlay').remove();renderResumes();toast('关联已更新','success');
    });
}
function initFilters(){const cs=$('#filter-category');cs.innerHTML='<option value="">全部类别</option>';store.categories.forEach(c=>{cs.innerHTML+=`<option value="${c}">${c}</option>`;});const ss=$('#table-filter-status');ss.innerHTML='<option value="">全部状态</option>';STATUSES.forEach(s=>{ss.innerHTML+=`<option value="${s.key}">${s.label}</option>`;});}
function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().split('T')[0];}
function addSample(){
    ['产品运营','技术研发','管理咨询','数据分析','金融投行','市场营销','设计'].forEach(c=>store.addCat(c));
    const samples=[
        {cn:'字节跳动',pt:'产品经理-电商',pc:'产品运营',ad:daysAgo(12),pl:'4',sc:'Boss直聘',tl:[{name:'已投递',date:daysAgo(12)},{name:'一面',date:daysAgo(5)}]},
        {cn:'腾讯',pt:'数据分析师',pc:'数据分析',ad:daysAgo(5),pl:'3',sc:'官网',tl:[{name:'已投递',date:daysAgo(5)}]},
        {cn:'麦肯锡',pt:'咨询Associate',pc:'管理咨询',ad:daysAgo(18),pl:'4',sc:'官网',vr:'SPONSOR_YES',tl:[{name:'已投递',date:daysAgo(18)},{name:'笔试/OA',date:daysAgo(10)}]},
        {cn:'阿里巴巴',pt:'产品运营',pc:'产品运营',ad:daysAgo(3),pl:'3',sc:'内推',tl:[{name:'已投递',date:daysAgo(3)}]},
        {cn:'Goldman Sachs',pt:'IB Analyst',pc:'金融投行',ad:daysAgo(25),pl:'4',sc:'官网',vr:'SPONSOR_YES',tl:[{name:'已投递',date:daysAgo(25)},{name:'一面',date:daysAgo(18)},{name:'挂了',date:daysAgo(15)}]},
        {cn:'美团',pt:'供应链培训生',pc:'产品运营',ad:'',pl:'2',sc:'',tl:[]},
        {cn:'Google',pt:'Product Manager',pc:'产品运营',ad:daysAgo(20),pl:'4',sc:'LinkedIn',vr:'SPONSOR_YES',tl:[{name:'已投递',date:daysAgo(20)},{name:'一面',date:daysAgo(15)},{name:'二面',date:daysAgo(10)},{name:'三面',date:daysAgo(5)}]},
        {cn:'小红书',pt:'市场营销',pc:'市场营销',ad:daysAgo(8),pl:'2',sc:'Boss直聘',tl:[{name:'已投递',date:daysAgo(8)}]},
        {cn:'贝恩咨询',pt:'咨询顾问',pc:'管理咨询',ad:daysAgo(30),pl:'4',sc:'内推',tl:[{name:'已投递',date:daysAgo(30)},{name:'笔试/OA',date:daysAgo(25)},{name:'一面',date:daysAgo(20)},{name:'二面',date:daysAgo(15)},{name:'Offer',date:daysAgo(8)}]},
        {cn:'网易',pt:'UI设计师',pc:'设计',ad:daysAgo(15),pl:'2',sc:'牛客',tl:[{name:'已投递',date:daysAgo(15)},{name:'挂了',date:daysAgo(10)}]}
    ];
    samples.forEach(s=>{
        const status=deriveStatus(s.tl);
        store.addApp({company_name:s.cn,position_title:s.pt,position_category:s.pc,status:status,applied_date:s.ad,preference_level:s.pl,source_channel:s.sc,visa_requirement:s.vr||'UNKNOWN',timeline:s.tl});
    });
    const ga=store.apps.find(a=>a.company_name==='Google');
    if(ga)store.addRef({app_id:ga.id,interview_round:'ROUND_1',input_type:'TEXT',raw_content:'产品设计题：为老年人设计社交App。用了用户画像+场景分析，但商业模式不够深入。',cleaned_content:'产品设计题：为老年人设计社交App。用了用户画像+场景分析，但商业模式不够深入。',pain_points:['准备不足','知识盲区'],self_rating:3});
    store.save();initFilters();
}
function init(){
    initFilters();
    updIntl();
    // 只有在未登录且明确需要演示数据时才使用样例
    var hasSession=!!localStorage.getItem('rt_session');
    if(!hasSession&& !store.apps.length) addSample();
    switchView('pipeline');
}
init();