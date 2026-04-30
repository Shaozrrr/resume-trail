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
const DEFAULT_COLS=[{id:'company_name',label:'公司',show:true,system:true},{id:'position_title',label:'岗位',show:true,system:true},{id:'position_category',label:'类别',show:true,system:true},{id:'base_location',label:'Base地',show:true,system:true},{id:'status',label:'状态',show:true,system:true},{id:'applied_date',label:'投递日期',show:true,system:true},{id:'waiting',label:'等待',show:true,system:true},{id:'preference_level',label:'偏好',show:true,system:true},{id:'source_channel',label:'渠道',show:true,system:true},{id:'jd',label:'JD',show:true,system:true},{id:'actions',label:'操作',show:true,system:true}];
const AI_CFG={openrouter:{url:'https://openrouter.ai/api/v1/chat/completions',key:'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',models:[{id:'qwen/qwen3-next-80b-a3b-instruct:free',label:'Qwen3 Next 免费版'},{id:'qwen/qwen3-coder:free',label:'Qwen3 Coder 免费版'}]}};

function cloneData(value){
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function normalizeTableColumns(cols){
    const source=Array.isArray(cols)?cloneData(cols):[];
    const systemMap=new Map();
    source.forEach(function(col){if(col&&col.id)systemMap.set(col.id,col);});
    const merged=DEFAULT_COLS.map(function(def){
        return systemMap.has(def.id)?Object.assign({},cloneData(def),systemMap.get(def.id)):cloneData(def);
    });
    const customCols=source.filter(function(col){return col&&col.id&&!DEFAULT_COLS.some(function(def){return def.id===col.id;});});
    const actionIdx=merged.findIndex(function(col){return col.id==='actions';});
    if(actionIdx>=0)merged.splice(actionIdx,0,...customCols);
    else merged.push(...customCols);
    return merged;
}

function normalizeAppRecord(app){
    const source=app||{};
    const timeline=cloneData(source.timeline||source.tl||[]);
    const next=Object.assign({},source,{
        company_name:source.company_name||source.cn||'',
        position_title:source.position_title||source.pt||'',
        position_category:source.position_category||source.pc||'',
        base_location:source.base_location||source.base||'',
        applied_date:source.applied_date||source.ad||'',
        preference_level:source.preference_level||source.pl||'3',
        source_channel:source.source_channel||source.sc||'',
        source_link:source.source_link||'',
        visa_requirement:source.visa_requirement||source.vr||'UNKNOWN',
        timeline:timeline,
        customFields:source.customFields&&typeof source.customFields==='object'?source.customFields:{}
    });
    if(!next.status)next.status=deriveStatus(timeline);
    return next;
}

function getDefaultSettings(){
    var legacy=10;
    try{
        var oldSettings=JSON.parse(localStorage.getItem('rt_set')||'{}');
        if(oldSettings&&oldSettings.weeklyGoal)legacy=parseInt(oldSettings.weeklyGoal)||10;
    }catch(err){}
    return {intlMode:false,weeklyGoal:legacy,profileNickname:'',profileAvatar:''};
}

class Store{
    constructor(){
        this.resetState();
    }
    resetState(){
        this.apps=[];
        this.resumes=[];
        this.refs=[];
        this.logs=[];
        this.settings=getDefaultSettings();
        this.categories=[];
        this.painPoints=[...DEFAULT_PP];
        this.tableCols=cloneData(DEFAULT_COLS);
    }
    snapshot(){
        return {
            apps:cloneData(this.apps),
            resumes:cloneData(this.resumes),
            refs:cloneData(this.refs),
            logs:cloneData(this.logs),
            settings:cloneData(this.settings),
            categories:cloneData(this.categories),
            painPoints:cloneData(this.painPoints),
            tableCols:cloneData(this.tableCols)
        };
    }
    restore(snapshot){
        this.apps=snapshot.apps;
        this.resumes=snapshot.resumes;
        this.refs=snapshot.refs;
        this.logs=snapshot.logs;
        this.settings=Object.assign(getDefaultSettings(),snapshot.settings||{});
        this.categories=snapshot.categories;
        this.painPoints=snapshot.painPoints;
        this.tableCols=snapshot.tableCols;
    }
    async save(reason){
        if(typeof cloudStore!=='undefined'){
            try{
                await cloudStore.saveFrom(this,reason||'store.save');
                return true;
            }catch(e){
                console.error(e);
                if(typeof toast==='function')toast('保存失败，请重试','error');
                return false;
            }
        }
        return true;
    }
    async commit(reason,mutator){
        const prev=this.snapshot();
        try{
            const result=await mutator(this);
            const ok=await this.save(reason);
            if(!ok){
                this.restore(prev);
                return false;
            }
            return typeof result==='undefined'?true:result;
        }catch(err){
            this.restore(prev);
            console.error('[RT store] commit failed',reason,err);
            if(typeof toast==='function')toast('保存失败，请重试','error');
            return false;
        }
    }
    addLog(aid,from,to,rej){
        const log={id:crypto.randomUUID(),app_id:aid,from:from,to:to,rej:rej||null,at:new Date().toISOString()};
        this.logs.push(log);
        return log;
    }
    async addApp(a){
        return this.commit('app.add',draft=>{
            const app=Object.assign({},cloneData(a),{
                id:crypto.randomUUID(),
                created_at:new Date().toISOString()
            });
            app.updated_at=app.created_at;
            if(!app.timeline)app.timeline=[];
            draft.apps.push(app);
            draft.addLog(app.id,null,app.status);
            return app;
        });
    }
    async updateApp(id,u){
        return this.commit('app.update',draft=>{
            const idx=draft.apps.findIndex(a=>a.id===id);
            if(idx<0)return null;
            const old=draft.apps[idx];
            const updates=cloneData(u||{});
            if(updates.status&&updates.status!==old.status)draft.addLog(id,old.status,updates.status,updates._rej);
            delete updates._rej;
            Object.assign(draft.apps[idx],updates,{updated_at:new Date().toISOString()});
            return draft.apps[idx];
        });
    }
    async delApp(id){
        return this.commit('app.delete',draft=>{
            draft.apps=draft.apps.filter(a=>a.id!==id);
            draft.refs=draft.refs.filter(r=>r.app_id!==id);
            draft.logs=draft.logs.filter(l=>l.app_id!==id);
            return true;
        });
    }
    async deleteApps(ids){
        return this.commit('app.bulkDelete',draft=>{
            const idSet=new Set(ids);
            draft.apps=draft.apps.filter(a=>!idSet.has(a.id));
            draft.refs=draft.refs.filter(r=>!idSet.has(r.app_id));
            draft.logs=draft.logs.filter(l=>!idSet.has(l.app_id));
            return true;
        });
    }
    async addResume(r){
        return this.commit('resume.add',draft=>{
            const resume=Object.assign({},cloneData(r),{id:crypto.randomUUID(),at:new Date().toISOString()});
            draft.resumes.push(resume);
            return resume;
        });
    }
    async delResume(id){
        return this.commit('resume.delete',draft=>{
            draft.resumes=draft.resumes.filter(r=>r.id!==id);
            draft.apps=draft.apps.map(app=>app.resume_id===id?Object.assign({},app,{resume_id:null,updated_at:new Date().toISOString()}):app);
            return true;
        });
    }
    async linkResumeToApps(resumeId,appIds){
        return this.commit('resume.linkApps',draft=>{
            const selected=new Set(appIds);
            draft.apps.forEach(app=>{
                if(selected.has(app.id)&&app.resume_id!==resumeId){
                    app.resume_id=resumeId;
                    app.updated_at=new Date().toISOString();
                }else if(!selected.has(app.id)&&app.resume_id===resumeId){
                    app.resume_id=null;
                    app.updated_at=new Date().toISOString();
                }
            });
            return true;
        });
    }
    async addRef(r){
        return this.commit('reflection.add',draft=>{
            const ref=Object.assign({},cloneData(r),{id:crypto.randomUUID(),at:new Date().toISOString()});
            draft.refs.push(ref);
            return ref;
        });
    }
    async updateRef(id,u){
        return this.commit('reflection.update',draft=>{
            const idx=draft.refs.findIndex(r=>r.id===id);
            if(idx<0)return null;
            Object.assign(draft.refs[idx],cloneData(u||{}));
            return draft.refs[idx];
        });
    }
    getApp(id){return this.apps.find(a=>a.id===id);}
    getResume(id){return this.resumes.find(r=>r.id===id);}
    getAppRefs(aid){return this.refs.filter(r=>r.app_id===aid);}
    getAppLogs(aid){return this.logs.filter(l=>l.app_id===aid).sort((a,b)=>new Date(b.at)-new Date(a.at));}
    async addCat(c){
        c=(c||'').trim();
        if(!c)return'';
        const exists=this.categories.includes(c);
        if(exists)return c;
        const ok=await this.commit('category.add',draft=>{
            draft.categories.push(c);
            return c;
        });
        return ok===false?'':c;
    }
    async rmCat(c){
        return this.commit('category.remove',draft=>{
            draft.categories=draft.categories.filter(x=>x!==c);
            return true;
        });
    }
    async addPP(p){
        p=(p||'').trim();
        if(!p)return'';
        const exists=this.painPoints.includes(p);
        if(exists)return p;
        const ok=await this.commit('painPoint.add',draft=>{
            draft.painPoints.push(p);
            return p;
        });
        return ok===false?'':p;
    }
    async rmPP(p){
        return this.commit('painPoint.remove',draft=>{
            draft.painPoints=draft.painPoints.filter(x=>x!==p);
            return true;
        });
    }
    async addCol(name){
        name=(name||'').trim();
        if(!name)return'';
        return this.commit('tableCol.add',draft=>{
            const id='custom_'+Date.now();
            const actIdx=draft.tableCols.findIndex(c=>c.id==='actions');
            const newCol={id:id,label:name,show:true,system:false,custom:true};
            if(actIdx>=0)draft.tableCols.splice(actIdx,0,newCol);
            else draft.tableCols.push(newCol);
            return id;
        });
    }
    async rmCol(id){
        return this.commit('tableCol.remove',draft=>{
            draft.tableCols=draft.tableCols.filter(c=>c.id!==id);
            draft.apps.forEach(a=>{if(a.customFields)delete a.customFields[id];});
            return true;
        });
    }
    async setColumnVisibility(visibleMap){
        return this.commit('tableCol.visibility',draft=>{
            draft.tableCols=draft.tableCols.map(col=>Object.prototype.hasOwnProperty.call(visibleMap,col.id)?Object.assign({},col,{show:!!visibleMap[col.id]}):col);
            return true;
        });
    }
    async setSetting(key,value){
        return this.commit('settings.update',draft=>{
            draft.settings=Object.assign({},draft.settings,{[key]:value});
            return draft.settings;
        });
    }
    async clearAllData(){
        if(typeof cloudStore!=='undefined'&&typeof cloudStore.clearAllData==='function'){
            try{
                await cloudStore.clearAllData(this);
                return true;
            }catch(err){
                console.error('[RT store] clearAllData failed',err);
                if(typeof toast==='function')toast('清空失败，请稍后重试','error');
                return false;
            }
        }
        this.resetState();
        return true;
    }
    async importApps(rows){
        return this.commit('app.import',draft=>{
            rows.forEach(function(d){
                if(d.category&&!draft.categories.includes(d.category))draft.categories.push(d.category);
                const app={
                    company_name:d.company,
                    position_title:d.position,
                    position_category:d.category,
                    status:'APPLIED',
                    applied_date:d.date,
                    preference_level:'3',
                    visa_requirement:'UNKNOWN',
                    timeline:[{name:'已投递',date:d.date}],
                    id:crypto.randomUUID(),
                    created_at:new Date().toISOString()
                };
                app.updated_at=app.created_at;
                draft.apps.push(app);
                draft.addLog(app.id,null,app.status);
            });
            return rows.length;
        });
    }
}
const store=new Store();
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const parseDateSafe=d=>{if(!d)return null;const t=new Date(d);return Number.isNaN(t.getTime())?null:t;};
const daysBtw=(a,b)=>{const start=parseDateSafe(a),end=parseDateSafe(b);if(!start||!end)return null;return Math.floor((end-start)/864e5);};
const fmtD=d=>{const t=parseDateSafe(d);if(!t)return'—';return`${t.getMonth()+1}/${t.getDate()}`;};
const fmtDT=d=>{const t=parseDateSafe(d);if(!t)return'—';return`${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;};
const getSI=k=>STATUSES.find(s=>s.key===k)||STATUSES[0];
const getWait=a=>['OFFER','REJECTED','WITHDRAWN'].includes(a.status)||!a.applied_date?null:daysBtw(a.applied_date,new Date().toISOString().split('T')[0]);
const getAppliedDays=a=>a&&a.applied_date?daysBtw(a.applied_date,new Date().toISOString().split('T')[0]):null;
const stars=n=>'⭐'.repeat(parseInt(n)||1);
const ini=n=>(n||'?')[0].toUpperCase();
function toast(m,t='info'){const c=$('#toast-container'),e=document.createElement('div');e.className=`toast ${t}`;e.textContent=m;c.appendChild(e);setTimeout(()=>{e.style.opacity='0';e.style.transform='translateX(120%)';e.style.transition='all .3s var(--ease)';setTimeout(()=>e.remove(),300);},3000);}
const DEV_DEBUG=location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.search.indexOf('debug=1')>=0;
window.rtDebug={
    enabled:DEV_DEBUG,
    state:{email:'-',userId:'-',sessionExists:'no',lastLoadAt:'-',lastSaveAt:'-',saveResult:'-'},
    panel:null,
    render(){
        if(!this.enabled)return;
        if(!this.panel){
            this.panel=document.createElement('div');
            this.panel.id='rt-debug-panel';
            this.panel.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9999;width:220px;padding:10px 12px;border-radius:8px;background:rgba(15,23,42,.94);color:#e2e8f0;font-size:11px;line-height:1.5;border:1px solid rgba(148,163,184,.28);box-shadow:0 12px 30px rgba(15,23,42,.28);backdrop-filter:blur(8px)';
            document.body.appendChild(this.panel);
        }
        this.panel.innerHTML=`<div style="font-weight:600;margin-bottom:6px;color:#f8fafc">RT Debug</div><div>邮箱: ${this.state.email||'-'}</div><div>user id: ${this.state.userId||'-'}</div><div>session: ${this.state.sessionExists}</div><div>上次加载: ${this.state.lastLoadAt||'-'}</div><div>上次保存: ${this.state.lastSaveAt||'-'}</div><div>保存结果: ${this.state.saveResult||'-'}</div>`;
    },
    update(patch){
        this.state=Object.assign({},this.state,patch||{});
        this.render();
    }
};
window.rtDebug.render();
function syncIntlToggles(){
    if(document.getElementById('toggle-intl-mode'))document.getElementById('toggle-intl-mode').checked=!!store.settings.intlMode;
    if(document.getElementById('profile-toggle-intl-mode'))document.getElementById('profile-toggle-intl-mode').checked=!!store.settings.intlMode;
}

function buildConicGradient(entries){
    const total=Math.max(entries.reduce(function(sum,entry){return sum+entry.value;},0),1);
    let cursor=0;
    return entries.map(function(entry,index){
        const start=cursor/total*360;
        cursor+=entry.value;
        const end=cursor/total*360;
        return `${entry.color||COLORS[index%COLORS.length]} ${start}deg ${end}deg`;
    }).join(', ');
}

function renderBaseDistributionChart(entries,total){
    const target=document.getElementById('base-chart');
    if(!target)return;
    if(!entries.length){
        target.innerHTML='<div class="empty-state compact"><p>暂无</p></div>';
        return;
    }
    const legend=entries.map(function(entry,index){
        const color=COLORS[index%COLORS.length];
        const share=total?Math.round(entry.value/total*100):0;
        return `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span><span class="legend-label">${entry.label}</span><span class="legend-value">${entry.value} · ${share}%</span></div>`;
    }).join('');
    target.innerHTML=`<div class="base-chart-wrap"><div class="base-donut" style="background:conic-gradient(${buildConicGradient(entries.map(function(entry,index){return {value:entry.value,color:COLORS[index%COLORS.length]};}))})"><div class="base-donut-center"><div class="base-donut-total">${total}</div><div class="base-donut-label">岗位</div></div></div><div class="chart-legend">${legend}</div></div>`;
}

function renderSourcePerformanceChart(entries){
    const target=document.getElementById('source-chart');
    if(!target)return;
    if(!entries.length){
        target.innerHTML='<div class="empty-state compact"><p>暂无</p></div>';
        return;
    }
    const maxTotal=Math.max(...entries.map(function(entry){return entry.total;}),1);
    target.innerHTML=`<div class="source-chart-list">${entries.map(function(entry,index){
        const barWidth=Math.max(Math.round(entry.total/maxTotal*100),10);
        const color=COLORS[index%COLORS.length];
        return `<div class="source-chart-row"><div class="source-chart-label">${entry.label}</div><div class="source-chart-track"><div class="source-chart-fill" style="width:${barWidth}%;background:${color}"></div></div><div class="source-chart-metric"><span>投递 ${entry.total}</span><span>推进 ${entry.progress}</span><strong>${entry.rate}%</strong></div></div>`;
    }).join('')}</div>`;
}
function sanitizeAIText(text){
    return String(text||'')
        .replace(/\*/g,'')
        .replace(/\r/g,'')
        .replace(/\n{3,}/g,'\n\n')
        .trim();
}

function getAILocationHint(status,data){
    const message=String((data&&data.error&&data.error.message)||'').toLowerCase();
    if(status===401)return'云端分析暂时不可用，已切换为内置数据分析。';
    if(status===402)return'云端分析暂时不可用，已切换为内置数据分析。';
    if(status===404&&message.includes('no endpoints found'))return'云端分析暂时不可用，已切换为内置数据分析。';
    if(status===429&&message.includes('rate-limited'))return'云端分析暂时不可用，已切换为内置数据分析。';
    if(status===429)return'云端分析暂时不可用，已切换为内置数据分析。';
    return'云端分析暂时不可用，已切换为内置数据分析。';
}

function buildAnalyticsFallback(ap,cs,rs){
    const active=ap.filter(a=>!['OFFER','REJECTED','WITHDRAWN'].includes(a.status));
    const topCategory=Object.entries(cs).sort((a,b)=>{
        const ar=a[1].t?a[1].r/a[1].t:0;
        const br=b[1].t?b[1].r/b[1].t:0;
        return br-ar||b[1].t-a[1].t;
    })[0];
    const sourceStats={};
    ap.forEach(function(app){
        const key=app.source_channel||'未填写';
        if(!sourceStats[key])sourceStats[key]={total:0,progress:0};
        sourceStats[key].total++;
        if(['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(app.status))sourceStats[key].progress++;
    });
    const topSource=Object.entries(sourceStats).sort((a,b)=>b[1].progress-a[1].progress||b[1].total-a[1].total)[0];
    const rejectTop=Object.entries(rs).sort((a,b)=>b[1]-a[1])[0];
    const responseCount=ap.filter(a=>['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length;
    const responseRate=ap.length?Math.round(responseCount/ap.length*100):0;
    const offerCount=ap.filter(a=>a.status==='OFFER').length;
    const topCategoryRate=topCategory&&topCategory[1].t?Math.round(topCategory[1].r/topCategory[1].t*100):0;
    const topSourceRate=topSource&&topSource[1].total?Math.round(topSource[1].progress/topSource[1].total*100):0;
    const rejectLabel=rejectTop?(REJECTION_STAGES[rejectTop[0]]||rejectTop[0]):'暂无稳定失分样本';
    const interviewCount=ap.filter(a=>['ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length;
    const interviewRate=ap.length?Math.round(interviewCount/ap.length*100):0;
    const rejectionShare=rejectTop&&Object.keys(rs).length?Math.round(rejectTop[1]/Math.max(Object.values(rs).reduce((sum,val)=>sum+val,0),1)*100):0;
    return [
        '整体概况',
        `当前共跟踪 ${ap.length} 条投递，收到推进 ${responseCount} 条，整体回复率约 ${responseRate}%，进入面试阶段的占比约 ${interviewRate}%，已获得 ${offerCount} 条 Offer。现阶段需要重点关注的不是投递规模，而是投递到推进之间的转化效率。`,
        topCategory
            ?`${topCategory[0]} 是当前推进最稳定的岗位方向，已投递 ${topCategory[1].t} 条，推进 ${topCategory[1].r} 条，推进率约 ${topCategoryRate}%。${topSource?`与之对应，${topSource[0]} 是当前贡献推进最多的渠道，已投递 ${topSource[1].total} 条，推进 ${topSource[1].progress} 条，转化约 ${topSourceRate}%。`:''}`
            :active.length
                ?'当前样本还在形成过程中，但已经可以从推进记录里观察到部分方向开始出现稳定反馈。后续应继续跟踪哪些岗位与渠道组合能够持续进入笔试和面试阶段。'
                :'当前样本仍不足，建议先完整记录投递、推进与拒绝节点，再做更稳健的判断。',
        `最近的主要失分点集中在 ${rejectLabel}${rejectTop?`，约占已记录失分的 ${rejectionShare}%`:''}。这说明当前最需要处理的不是全面铺开式优化，而是针对高频失分环节做更细致的准备与校正。`,
        '',
        '优化建议',
        rejectTop
            ?`后续应优先提高 ${topCategory?topCategory[0]:'高匹配方向'} 的投递占比，并延续 ${topSource?topSource[0]:'当前有效渠道'} 这类已经证明更容易形成推进的入口。针对 ${REJECTION_STAGES[rejectTop[0]]||rejectTop[0]}，需要把问题拆解、案例展开、结果表达和追问承接整理成更稳定的应答框架，从而提高后续轮次的通过把握。`
            :'建议继续积累更完整的推进与失分样本，再对比不同岗位方向与投递渠道的表现。分析目标不在于填满表格，而在于识别哪一种组合最容易形成稳定推进。',
        '更稳妥的做法，是把时间持续投入到已经出现正反馈的岗位方向和投递渠道，而不是平均分配给所有机会。'
    ].join('\n');
}

function buildReflectionFallback(content){
    const text=String(content||'').trim();
    const sentenceCount=text.split(/[。！？!?]/).filter(Boolean).length;
    const hasMetric=/数据|指标|转化|增长|SQL|A\/B|实验/i.test(text);
    const hasStructure=/用户|场景|拆解|优先级|方案|复盘/i.test(text);
    return [
        '整体判断',
        sentenceCount>=3?'这段复盘信息量已经足够，适合沉淀成可复用答案。':'信息还偏少，建议把问题、回答、追问、反思补完整。',
        '',
        '亮点',
        hasStructure?'你已经有结构化表达意识，这会直接提升复盘质量。':'你已经记录了关键过程，后续只要再补充结构就会更有价值。',
        '',
        '短板',
        hasMetric?'可以继续补充结果导向和业务判断，让回答更像真实工作方案。':'这段内容里缺少量化指标或结果判断，下一次尽量补上数字和取舍理由。',
        '',
        '下一次怎么答',
        '先用一句话定义问题，再拆目标、方案、权衡，最后补结果和复盘动作。'
    ].join('\n');
}

function parseAISections(text){
    return sanitizeAIText(text).split(/\n\s*\n/).map(function(block){
        const lines=block.split('\n').map(function(line){return line.trim();}).filter(Boolean);
        if(!lines.length)return null;
        return {title:lines[0],body:lines.slice(1)};
    }).filter(Boolean);
}

function renderAIBlocks(el,text,variant,meta){
    if(!el)return;
    const sections=parseAISections(text);
    if(!sections.length){
        el.textContent=sanitizeAIText(text);
        return;
    }
    el.innerHTML='';
    const wrap=document.createElement('div');
    wrap.className=`ai-rich-block ai-rich-${variant||'insight'}`;
    if(meta&&meta.badge){
        const metaRow=document.createElement('div');
        metaRow.className='ai-rich-meta';
        if(meta.mode){
            const badge=document.createElement('span');
            badge.className=`ai-rich-badge ${meta.mode==='fallback'?'fallback':'online'}`;
            badge.textContent=meta.label||(meta.mode==='fallback'?'内置数据分析':'云端分析');
            metaRow.appendChild(badge);
        }
        const note=document.createElement('span');
        note.className='ai-rich-note';
        note.textContent=meta.badge;
        metaRow.appendChild(note);
        wrap.appendChild(metaRow);
    }
    sections.forEach(function(section,index){
        const card=document.createElement('section');
        card.className='ai-rich-section';
        card.style.transitionDelay=`${index*90}ms`;
        const title=document.createElement('div');
        title.className='ai-rich-title';
        title.textContent=section.title;
        const body=document.createElement('div');
        body.className='ai-rich-body';
        section.body.forEach(function(line,lineIndex){
            const p=document.createElement('p');
            p.textContent=line;
            p.style.transitionDelay=`${index*90+lineIndex*60+80}ms`;
            body.appendChild(p);
        });
        card.appendChild(title);
        card.appendChild(body);
        wrap.appendChild(card);
    });
    el.appendChild(wrap);
    requestAnimationFrame(function(){
        wrap.querySelectorAll('.ai-rich-section,.ai-rich-body p').forEach(function(node){
            node.classList.add('visible');
        });
    });
}

async function callAI(prompt,fallbackText){
    let lastFailure=null;
    for(const model of AI_CFG.openrouter.models){
        try{
            const r=await fetch(AI_CFG.openrouter.url,{
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'Authorization':`Bearer ${AI_CFG.openrouter.key}`,
                    'HTTP-Referer':location.href,
                    'X-Title':'Resume Trail'
                },
                body:JSON.stringify({
                    model:model.id,
                    messages:[{role:'user',content:prompt}],
                    temperature:0.65,
                    top_p:0.9,
                    max_tokens:700
                })
            });
            const d=await r.json().catch(function(){return null;});
            if(r.ok){
                const text=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
                if(text)return{text:sanitizeAIText(text),mode:'online',label:model.label,badge:`基于 ${model.label} 生成`};
            }else{
                lastFailure={status:r.status,data:d,model:model};
                console.warn('[RT AI] OpenRouter request failed',{model:model.id,status:r.status,data:d});
                if(r.status!==429)break;
            }
        }catch(e){
            lastFailure={error:e,model:model};
            console.warn('[RT AI] OpenRouter fetch error',{model:model.id,error:e});
        }
    }
    if(lastFailure&&lastFailure.error)return{text:sanitizeAIText(fallbackText||'暂时没有可用的分析结果。'),mode:'fallback',label:'内置数据分析',badge:'网络请求失败，已切换为内置数据分析。'};
    if(lastFailure)return{text:sanitizeAIText(fallbackText||'暂时没有可用的分析结果。'),mode:'fallback',label:'内置数据分析',badge:getAILocationHint(lastFailure.status,lastFailure.data)};
    return{text:sanitizeAIText(fallbackText||'暂时没有可用的分析结果。'),mode:'fallback',label:'内置数据分析',badge:'云端分析暂时不可用，已切换为内置数据分析。'};
}
let curView='pipeline',curTab='info';
let tableQuickEdit=false;
let tableSortColumn='created_at';
let tableSortDirection='desc';
let kanbanSortDirection='desc';
const tableSelectedRows=new Set();

function getProfileNickname(){
    return (store.settings&&store.settings.profileNickname)||localStorage.getItem('rt_nickname')||'';
}

function getProfileAvatar(){
    return store&&store.settings&&store.settings.profileAvatar||'';
}

function syncKanbanSortDirection(){
    const btn=document.getElementById('kanban-sort-direction');
    if(btn)btn.textContent=kanbanSortDirection==='desc'?'从大到小':'从小到大';
}

function setTableSort(columnId){
    if(!columnId)return;
    if(tableSortColumn===columnId)tableSortDirection=tableSortDirection==='asc'?'desc':'asc';
    else{
        tableSortColumn=columnId;
        tableSortDirection=['waiting','preference_level','applied_date','created_at'].includes(columnId)?'desc':'asc';
    }
    const dirBtn=document.getElementById('table-sort-direction');
    if(dirBtn)dirBtn.textContent=tableSortDirection==='asc'?'↑':'↓';
    const sortSelect=document.getElementById('table-sort-column');
    if(sortSelect)sortSelect.value=columnId;
    renderTable($('#global-search').value.toLowerCase().trim());
}

function getTableComparableValue(app,colId){
    if(!app)return'';
    if((colId||'').indexOf('custom_')===0)return(app.customFields&&app.customFields[colId])||'';
    switch(colId){
        case'company_name':return app.company_name||'';
        case'position_title':return app.position_title||'';
        case'position_category':return app.position_category||'';
        case'base_location':return app.base_location||'';
        case'status':return getSI(app.status).label;
        case'applied_date':return app.applied_date||'';
        case'waiting':return getWait(app);
        case'preference_level':return parseInt(app.preference_level)||0;
        case'source_channel':return app.source_channel||'';
        case'created_at':return app.created_at||'';
        default:return app[colId]||'';
    }
}

function getTableFilterText(app,colId){
    const value=getTableComparableValue(app,colId);
    if(value===null||typeof value==='undefined')return'';
    return String(value).toLowerCase();
}

function renderSourceCell(td,app){
    const label=app.source_channel||'—';
    if(app.source_link){
        const link=document.createElement('a');
        link.className='source-link';
        link.href=app.source_link;
        link.target='_blank';
        link.rel='noreferrer noopener';
        link.textContent=label;
        link.addEventListener('click',function(e){e.stopPropagation();});
        td.appendChild(link);
    }else{
        td.textContent=label;
    }
}

function renderTableControlOptions(){
    const cols=store.tableCols.filter(c=>c.id!=='actions');
    const filterCol=document.getElementById('table-filter-column');
    const sortCol=document.getElementById('table-sort-column');
    if(filterCol){
        const prev=filterCol.value;
        filterCol.innerHTML='<option value="">筛选列</option>'+cols.filter(c=>c.id!=='jd').map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
        filterCol.value=cols.some(c=>c.id===prev)?prev:'';
    }
    if(sortCol){
        const prevSort=tableSortColumn;
        if(prevSort!=='created_at'&&!cols.some(c=>c.id===prevSort))tableSortColumn='created_at';
        sortCol.innerHTML='<option value="created_at">默认排序</option>'+cols.filter(c=>c.id!=='jd').map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
        sortCol.value=tableSortColumn||'created_at';
    }
    const dirBtn=document.getElementById('table-sort-direction');
    if(dirBtn)dirBtn.textContent=tableSortDirection==='asc'?'↑':'↓';
}

function syncQuickEditPanel(){
    const panel=document.getElementById('table-quick-edit-panel');
    const btn=document.getElementById('table-edit-mode-btn');
    if(panel)panel.classList.toggle('active',tableQuickEdit);
    if(btn){
        btn.textContent=tableQuickEdit?'退出快捷编辑':'快捷编辑';
        btn.classList.toggle('active',tableQuickEdit);
    }
}
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
syncIntlToggles();
async function setIntlMode(enabled){
    const ok=await store.setSetting('intlMode',!!enabled);
    if(ok===false){
        syncIntlToggles();
        return false;
    }
    syncIntlToggles();
    updIntl();
    refresh();
    return true;
}
$('#toggle-intl-mode').addEventListener('change',async e=>{
    const ok=await setIntlMode(e.target.checked);
    if(ok===false){
        return;
    }
});
document.getElementById('profile-toggle-intl-mode')?.addEventListener('change',async e=>{
    const ok=await setIntlMode(e.target.checked);
    if(ok===false)return;
});
function updIntl(){const s=store.settings.intlMode;$$('.intl-field').forEach(el=>el.style.display=s?'':'none');$('#filter-visa').style.display=s?'':'none';}
updIntl();
// 类别下拉填充
function fillCatSelect(selEl,val){
    selEl.innerHTML='<option value="">选择类别</option>';
    store.categories.forEach(c=>{selEl.innerHTML+=`<option value="${c}" ${val===c?'selected':''}>${c}</option>`;});
}
$('#add-category-inline').addEventListener('click',async ()=>{
    const name=prompt('输入新类别名称：');
    if(name&&name.trim()){
        const added=await store.addCat(name.trim());
        if(!added)return;
        fillCatSelect($('#form-category'),name.trim());
        initFilters();
    }
});// ---- 看板 ----
function renderKanban(q=''){
    const b=$('#kanban-board'),fc=$('#filter-category').value,fv=$('#filter-visa').value,ks=$('#kanban-sort').value;
    let apps=store.apps.filter(a=>{if(q&&!a.company_name.toLowerCase().includes(q)&&!a.position_title.toLowerCase().includes(q))return false;if(fc&&a.position_category!==fc)return false;if(fv&&a.visa_requirement!==fv)return false;return true;});
    apps=apps.slice().sort(function(a,b){
        const direction=kanbanSortDirection==='asc'?1:-1;
        if(ks==='preference')return((parseInt(a.preference_level)||0)-(parseInt(b.preference_level)||0))*direction;
        if(ks==='waiting')return(((getWait(a)||-1)-(getWait(b)||-1))*direction);
        if(ks==='applied_days')return(((getAppliedDays(a)||-1)-(getAppliedDays(b)||-1))*direction);
        return((new Date(a.created_at||0).getTime())-(new Date(b.created_at||0).getTime()))*direction;
    });
    b.innerHTML='';
    getKanbanStatuses().forEach(st=>{
        const col=document.createElement('section');col.className='kanban-lane';
        const cards=apps.filter(a=>a.status===st.key);
        col.innerHTML=`<div class="lane-header"><div class="lane-header-top"><span class="lane-title">${st.label}</span><span class="lane-count">${cards.length}</span></div><div class="lane-subtitle">${cards.length?`当前阶段共 ${cards.length} 条记录`:'当前阶段暂无记录'}</div></div><div class="lane-body"><div class="lane-track" data-status="${st.key}"></div><button class="lane-add" type="button">+ 在 ${st.label} 新建</button></div>`;
        const cc=col.querySelector('.lane-track');
        cards.forEach(a=>cc.appendChild(mkCard(a)));
        cc.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
        cc.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
        cc.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');chgStatus(e.dataTransfer.getData('text/plain'),st.key);});
        col.querySelector('.lane-add').addEventListener('click',()=>openAppModal(null,st.key));
        b.appendChild(col);
    });
    $('#view-subtitle').textContent=`${store.apps.length} 条投递`;
}
function mkCard(a){
    const c=document.createElement('div');c.className='kanban-card';c.draggable=true;
    const w=getWait(a),wc=w>30?'danger':w>14?'warn':'',r=a.resume_id?store.getResume(a.resume_id):null;
    const sv=store.settings.intlMode&&a.visa_requirement&&a.visa_requirement!=='UNKNOWN',vi=VISA_MAP[a.visa_requirement]||{};
    let ddl='';if(a.next_deadline){const dl=daysBtw(new Date().toISOString().split('T')[0],a.next_deadline.split('T')[0]);ddl=`<div class="card-ddl ${dl<=3?'urgent':''}"><span>DDL</span><strong>${fmtD(a.next_deadline)}</strong>${a.next_action?`<em>${a.next_action}</em>`:''}</div>`;}
    const dateStr=a.applied_date?fmtD(a.applied_date):'';
    const chips=[
        a.position_category?`<span class="card-chip">${a.position_category}</span>`:'',
        a.base_location?`<span class="card-chip subtle">${a.base_location}</span>`:'',
        a.source_channel?`<span class="card-chip subtle">${a.source_channel}</span>`:''
    ].filter(Boolean).join('');
    c.innerHTML=`<div class="card-top"><div class="card-logo">${ini(a.company_name)}</div><div class="card-info"><div class="card-company">${a.company_name}</div><div class="card-position">${a.position_title}</div></div><div class="card-chevron">›</div></div><div class="card-chips">${chips}</div><div class="card-meta"><span class="card-stars">${stars(a.preference_level)}</span>${dateStr?`<span class="card-date">${dateStr}</span>`:''}${w!==null?`<span class="card-wait ${wc}">${w}天</span>`:''}${sv?`<span class="card-visa ${vi.cls}">${vi.label}</span>`:''}</div>${r?`<div class="card-resume">已关联简历 · ${r.file_name}</div>`:''}${ddl}`;
    c.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',a.id);c.classList.add('dragging');});
    c.addEventListener('dragend',()=>c.classList.remove('dragging'));
    c.addEventListener('click',()=>openDrawer(a.id));
    return c;
}
async function chgStatus(id,ns){const a=store.getApp(id);if(!a||a.status===ns)return;if(ns==='REJECTED'){openRejModal(id);return;}const ok=await store.updateApp(id,{status:ns});if(ok===false)return;if(ns==='OFFER')toast('🎉 Offer！','success');renderKanban($('#global-search').value.toLowerCase().trim());}
let pendRej=null;
function openRejModal(id){pendRej=id;$$('#rejection-options input').forEach(i=>i.checked=false);$('#rejection-modal-overlay').classList.add('active');}
$('#rejection-confirm').addEventListener('click',async ()=>{if(!pendRej)return;const s=$('#rejection-options input:checked');if(!s){toast('请选择','error');return;}const ok=await store.updateApp(pendRej,{status:'REJECTED',_rej:s.value});if(ok===false)return;$('#rejection-modal-overlay').classList.remove('active');pendRej=null;renderKanban($('#global-search').value.toLowerCase().trim());});
$('#rejection-modal-close').addEventListener('click',()=>{$('#rejection-modal-overlay').classList.remove('active');pendRej=null;});

// ---- 表格 ----
function renderTable(q=''){
    renderTableControlOptions();
    const fs=$('#table-filter-status').value;
    const filterColumn=$('#table-filter-column').value;
    const filterValue=$('#table-filter-value').value.toLowerCase().trim();
    const cols=store.tableCols.filter(c=>c.show);
    let apps=store.apps.filter(a=>{
        if(q&&!a.company_name.toLowerCase().includes(q)&&!a.position_title.toLowerCase().includes(q))return false;
        if(fs&&a.status!==fs)return false;
        if(filterColumn&&filterValue&&!getTableFilterText(a,filterColumn).includes(filterValue))return false;
        return true;
    });
    const gb=$('#table-group-by').value,hd=$('#table-header'),bd=$('#table-body');
    hd.innerHTML='';
    if(tableQuickEdit){
        const th=document.createElement('th');
        th.className='table-checkbox-cell';
        th.innerHTML='<input type="checkbox" id="table-select-all">';
        hd.appendChild(th);
    }
    cols.forEach(function(col){
        const th=document.createElement('th');
        const wrap=document.createElement('button');
        wrap.type='button';
        wrap.className='table-header-btn';
        wrap.innerHTML=`<span>${col.label}</span>${tableSortColumn===col.id?`<span class="table-sort-indicator">${tableSortDirection==='asc'?'↑':'↓'}</span>`:''}`;
        wrap.addEventListener('click',function(e){e.stopPropagation();setTableSort(col.id);});
        th.appendChild(wrap);
        if(tableQuickEdit&&col.custom){
            const removeBtn=document.createElement('button');
            removeBtn.type='button';
            removeBtn.className='table-col-remove';
            removeBtn.textContent='×';
            removeBtn.title='删除自定义列';
            removeBtn.addEventListener('click',async function(e){
                e.stopPropagation();
                const ok=await store.rmCol(col.id);
                if(ok===false)return;
                renderTableControlOptions();
                refresh();
            });
            th.appendChild(removeBtn);
        }
        hd.appendChild(th);
    });
    bd.innerHTML='';

    apps.sort(function(a,b){
        const av=getTableComparableValue(a,tableSortColumn);
        const bv=getTableComparableValue(b,tableSortColumn);
        const aNil=av===null||typeof av==='undefined'||av==='';
        const bNil=bv===null||typeof bv==='undefined'||bv==='';
        if(aNil&&bNil)return 0;
        if(aNil)return 1;
        if(bNil)return -1;
        if(typeof av==='number'&&typeof bv==='number')return tableSortDirection==='asc'?av-bv:bv-av;
        if(tableSortColumn==='applied_date'||tableSortColumn==='created_at'){
            const at=new Date(av).getTime()||0;
            const bt=new Date(bv).getTime()||0;
            return tableSortDirection==='asc'?at-bt:bt-at;
        }
        return tableSortDirection==='asc'?String(av).localeCompare(String(bv),'zh-CN'):String(bv).localeCompare(String(av),'zh-CN');
    });

    const render=list=>{list.forEach(a=>bd.appendChild(mkRow(a,cols)));};
    if(gb){
        const groups={};
        apps.forEach(a=>{
            let k=gb==='position_category'?a.position_category||'未分类':gb==='status'?getSI(a.status).label:a.source_channel||'未知';
            if(!groups[k])groups[k]=[];
            groups[k].push(a);
        });
        Object.entries(groups).forEach(([g,items])=>{
            const gr=document.createElement('tr');
            const spanCols=cols.length+(tableQuickEdit?1:0);
            gr.innerHTML=`<td colspan="${spanCols}" style="font-weight:600;color:var(--text-primary);background:var(--bg-tertiary);padding:6px 10px;font-size:11px">${g} (${items.length})</td>`;
            bd.appendChild(gr);
            render(items);
        });
    }else render(apps);

    if(tableQuickEdit){
        document.getElementById('table-select-all')?.addEventListener('change',function(e){
            if(e.target.checked)apps.forEach(app=>tableSelectedRows.add(app.id));
            else tableSelectedRows.clear();
            renderTable($('#global-search').value.toLowerCase().trim());
        });
    }
}
function mkRow(a,cols){
    const tr=document.createElement('tr');const w=getWait(a),si=getSI(a.status);
    if(tableQuickEdit){
        const selTd=document.createElement('td');
        selTd.className='table-checkbox-cell';
        const checkbox=document.createElement('input');
        checkbox.type='checkbox';
        checkbox.checked=tableSelectedRows.has(a.id);
        checkbox.addEventListener('click',function(e){e.stopPropagation();});
        checkbox.addEventListener('change',function(e){
            if(e.target.checked)tableSelectedRows.add(a.id);
            else tableSelectedRows.delete(a.id);
        });
        selTd.appendChild(checkbox);
        tr.appendChild(selTd);
    }
    cols.forEach(col=>{
        const td=document.createElement('td');
        if(col.custom){
            td.textContent=(a.customFields&&a.customFields[col.id])||'—';
            td.addEventListener(tableQuickEdit?'click':'dblclick',e=>{e.stopPropagation();inlineEdit(td,a,col.id,true);});
        }
        else switch(col.id){
            case'company_name':td.style.fontWeight='500';td.style.color='var(--text-primary)';td.textContent=a.company_name;td.addEventListener(tableQuickEdit?'click':'dblclick',e=>{e.stopPropagation();inlineEdit(td,a,'company_name');});break;
            case'position_title':td.textContent=a.position_title;td.addEventListener(tableQuickEdit?'click':'dblclick',e=>{e.stopPropagation();inlineEdit(td,a,'position_title');});break;
            case'position_category':td.textContent=a.position_category||'—';td.addEventListener(tableQuickEdit?'click':'dblclick',e=>{e.stopPropagation();inlineCatSel(td,a);});break;
            case'base_location':td.textContent=a.base_location||'—';td.addEventListener(tableQuickEdit?'click':'dblclick',e=>{e.stopPropagation();inlineEdit(td,a,'base_location');});break;
            case'status':td.innerHTML=`<span class="status-pill ${si.cls}">${si.label}</span>`;if(tableQuickEdit)td.addEventListener('click',e=>{e.stopPropagation();inlineStatusSel(td,a);});break;
            case'applied_date':td.textContent=fmtD(a.applied_date);td.addEventListener(tableQuickEdit?'click':'dblclick',e=>{e.stopPropagation();inlineDateEdit(td,a);});break;
            case'waiting':td.textContent=w!==null?w+'天':'—';break;
            case'preference_level':td.innerHTML=`<span class="pref-display" style="cursor:pointer">${stars(a.preference_level)}</span>`;td.querySelector('.pref-display').addEventListener('click',e=>{e.stopPropagation();prefSelect(td,a);});break;
            case'source_channel':renderSourceCell(td,a);td.addEventListener(tableQuickEdit?'click':'dblclick',e=>{e.stopPropagation();inlineEdit(td,a,'source_channel');});break;
            case'jd':if(a.jd_url)td.innerHTML=`<a class="jd-link-btn" href="${a.jd_url}" target="_blank" onclick="event.stopPropagation()">🔗</a>`;else if(a.jd_image){td.innerHTML=`<span class="jd-img-btn">🖼</span>`;td.querySelector('.jd-img-btn').addEventListener('click',e=>{e.stopPropagation();$('#jd-preview-img').src=a.jd_image;$('#jd-preview-overlay').classList.add('active');});}else td.textContent='—';break;
            case'actions':td.innerHTML=`<button class="td-action-btn" title="查看详情">✏️</button>`;td.querySelector('button').addEventListener('click',e=>{e.stopPropagation();openDrawer(a.id);});break;
        }
        tr.appendChild(td);
    });
    tr.addEventListener('click',function(){if(!tableQuickEdit)openDrawer(a.id);});
    return tr;
}
function inlineEdit(td,a,f,custom=false){const old=custom?(a.customFields?.[f]||''):(a[f]||'');const inp=document.createElement('input');inp.type='text';inp.className='inline-edit';inp.value=old;td.textContent='';td.appendChild(inp);inp.focus();inp.select();const sv=async ()=>{const v=inp.value.trim();if(custom){const nextFields=Object.assign({},a.customFields||{}, {[f]:v});const ok=await store.updateApp(a.id,{customFields:nextFields});if(ok===false)return renderTable($('#global-search').value.toLowerCase().trim());}else if(v!==old){if(f==='position_category'&&v){const added=await store.addCat(v);if(!added)return renderTable($('#global-search').value.toLowerCase().trim());}const ok=await store.updateApp(a.id,{[f]:v});if(ok===false)return renderTable($('#global-search').value.toLowerCase().trim());}renderTable($('#global-search').value.toLowerCase().trim());};inp.addEventListener('blur',sv);inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sv();}if(e.key==='Escape')renderTable($('#global-search').value.toLowerCase().trim());});}
function inlineCatSel(td,a){const sel=document.createElement('select');sel.className='inline-select';sel.innerHTML='<option value="">选择</option>';store.categories.forEach(c=>{sel.innerHTML+=`<option value="${c}" ${a.position_category===c?'selected':''}>${c}</option>`;});sel.innerHTML+='<option value="__NEW__">+ 新增类别...</option>';td.textContent='';td.appendChild(sel);sel.focus();sel.addEventListener('change',async ()=>{if(sel.value==='__NEW__'){const name=prompt('输入新类别名称：');if(name&&name.trim()){const added=await store.addCat(name.trim());if(!added)return renderTable($('#global-search').value.toLowerCase().trim());const ok=await store.updateApp(a.id,{position_category:name.trim()});if(ok!==false)initFilters();}renderTable($('#global-search').value.toLowerCase().trim());}else if(sel.value){const ok=await store.updateApp(a.id,{position_category:sel.value});if(ok!==false)renderTable($('#global-search').value.toLowerCase().trim());}});sel.addEventListener('blur',()=>renderTable($('#global-search').value.toLowerCase().trim()));}
function inlineDateEdit(td,a){const inp=document.createElement('input');inp.type='date';inp.className='inline-edit';inp.value=a.applied_date||'';td.textContent='';td.appendChild(inp);inp.focus();inp.addEventListener('blur',async ()=>{const newDate=inp.value;const updates={applied_date:newDate};if(a.timeline&&a.timeline.length){const nextTimeline=cloneData(a.timeline);const ae=nextTimeline.find(t=>t.name==='已投递');if(ae)ae.date=newDate;updates.timeline=nextTimeline;}const ok=await store.updateApp(a.id,updates);if(ok!==false)renderTable($('#global-search').value.toLowerCase().trim());});inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}if(e.key==='Escape')renderTable($('#global-search').value.toLowerCase().trim());});}
function inlineStatusSel(td,a){const sel=document.createElement('select');sel.className='inline-select';STATUSES.forEach(s=>{sel.innerHTML+=`<option value="${s.key}" ${s.key===a.status?'selected':''}>${s.label}</option>`;});td.innerHTML='';td.appendChild(sel);sel.focus();sel.addEventListener('change',async ()=>{await chgStatus(a.id,sel.value);renderTable($('#global-search').value.toLowerCase().trim());});sel.addEventListener('blur',()=>renderTable($('#global-search').value.toLowerCase().trim()));}
function prefSelect(td,a){const sel=document.createElement('select');sel.className='inline-select';PREF_OPTIONS.forEach(p=>{sel.innerHTML+=`<option value="${p.v}" ${a.preference_level==p.v?'selected':''}>${p.l}</option>`;});td.innerHTML='';td.appendChild(sel);sel.focus();sel.addEventListener('change',async ()=>{const ok=await store.updateApp(a.id,{preference_level:sel.value});if(ok!==false)renderTable($('#global-search').value.toLowerCase().trim());});sel.addEventListener('blur',()=>renderTable($('#global-search').value.toLowerCase().trim()));}
$('#table-group-by').addEventListener('change',()=>renderTable($('#global-search').value.toLowerCase().trim()));
$('#table-filter-status').addEventListener('change',()=>renderTable($('#global-search').value.toLowerCase().trim()));
$('#table-filter-column').addEventListener('change',()=>renderTable($('#global-search').value.toLowerCase().trim()));
$('#table-filter-value').addEventListener('input',()=>renderTable($('#global-search').value.toLowerCase().trim()));
$('#table-sort-column').addEventListener('change',e=>{tableSortColumn=e.target.value||'created_at';renderTable($('#global-search').value.toLowerCase().trim());});
$('#table-sort-direction').addEventListener('click',()=>{tableSortDirection=tableSortDirection==='asc'?'desc':'asc';renderTable($('#global-search').value.toLowerCase().trim());});
$('#filter-category').addEventListener('change',()=>renderKanban($('#global-search').value.toLowerCase().trim()));
$('#filter-visa').addEventListener('change',()=>renderKanban($('#global-search').value.toLowerCase().trim()));
$('#kanban-sort').addEventListener('change',()=>renderKanban($('#global-search').value.toLowerCase().trim()));
$('#kanban-sort-direction').addEventListener('click',()=>{kanbanSortDirection=kanbanSortDirection==='asc'?'desc':'asc';syncKanbanSortDirection();renderKanban($('#global-search').value.toLowerCase().trim());});
$('#table-add-row').addEventListener('click',()=>openAppModal());
$('#table-edit-mode-btn').addEventListener('click',()=>{
    tableQuickEdit=!tableQuickEdit;
    if(!tableQuickEdit)tableSelectedRows.clear();
    syncQuickEditPanel();
    renderTable($('#global-search').value.toLowerCase().trim());
});
$('#table-quick-add-row').addEventListener('click',()=>openAppModal());
$('#table-quick-del-rows').addEventListener('click',async ()=>{
    const ids=Array.from(tableSelectedRows);
    if(!ids.length){toast('请先勾选要删除的行','error');return;}
    if(!confirm(`确定删除 ${ids.length} 条投递？`))return;
    const ok=await store.deleteApps(ids);
    if(ok===false)return;
    tableSelectedRows.clear();
    toast(`已删除 ${ids.length} 条`,'success');
    refresh();
});
$('#table-quick-add-col-btn').addEventListener('click',async ()=>{
    const n=$('#table-quick-col-name').value.trim();
    if(!n)return;
    const ok=await store.addCol(n);
    if(ok===false)return;
    $('#table-quick-col-name').value='';
    renderTableControlOptions();
    refresh();
});
$('#table-quick-col-name').addEventListener('keydown',function(e){
    if(e.key==='Enter'){
        e.preventDefault();
        $('#table-quick-add-col-btn').click();
    }
});
$('#jd-preview-close').addEventListener('click',()=>$('#jd-preview-overlay').classList.remove('active'));
$('#jd-preview-overlay').addEventListener('click',e=>{if(e.target===$('#jd-preview-overlay'))$('#jd-preview-overlay').classList.remove('active');});
const jdZ=$('#jd-paste-zone');let jdImg=null;
jdZ.addEventListener('click',()=>jdZ.focus());
jdZ.addEventListener('paste',e=>{const items=e.clipboardData?.items;if(!items)return;for(let i=0;i<items.length;i++){if(items[i].type.startsWith('image/')){e.preventDefault();const rd=new FileReader();rd.onload=ev=>{jdImg=ev.target.result;jdZ.innerHTML=`<img src="${jdImg}">`;jdZ.classList.add('has-image');};rd.readAsDataURL(items[i].getAsFile());return;}}});
jdZ.addEventListener('dragover',e=>e.preventDefault());
jdZ.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f?.type.startsWith('image/')){const rd=new FileReader();rd.onload=ev=>{jdImg=ev.target.result;jdZ.innerHTML=`<img src="${jdImg}">`;jdZ.classList.add('has-image');};rd.readAsDataURL(f);}});
let editId=null;
function openAppModal(id=null,defSt='APPLIED'){editId=id;const a=id?store.getApp(id):null;$('#modal-title').textContent=a?'编辑投递':'新建投递';$('#form-company').value=a?.company_name||'';$('#form-position').value=a?.position_title||'';fillCatSelect($('#form-category'),a?.position_category||'');$('#form-status').value=a?.status||defSt;$('#form-date').value=a?.applied_date||new Date().toISOString().split('T')[0];$('#form-base').value=a?.base_location||'';$('#form-preference').value=a?.preference_level||'3';$('#form-visa').value=a?.visa_requirement||'UNKNOWN';$('#form-channel').value=a?.source_channel||'';$('#form-channel-link').value=a?.source_link||'';$('#form-salary').value=a?.salary_expectation||'';$('#form-next-action').value=a?.next_action||'';$('#form-deadline').value=a?.next_deadline||'';$('#form-jd-url').value=a?.jd_url||'';$('#form-notes').value=a?.notes||'';jdImg=a?.jd_image||null;if(jdImg){jdZ.innerHTML=`<img src="${jdImg}">`;jdZ.classList.add('has-image');}else{jdZ.innerHTML='<span class="jd-paste-hint">点击后粘贴截图或拖拽图片</span>';jdZ.classList.remove('has-image');}const rs=$('#form-resume');rs.innerHTML='<option value="">不绑定</option>';store.resumes.forEach(r=>{rs.innerHTML+=`<option value="${r.id}" ${a?.resume_id===r.id?'selected':''}>${r.file_name}</option>`;});
// 渲染自定义字段
const cfa=$('#custom-fields-area');cfa.innerHTML='';
const customCols=store.tableCols.filter(c=>c.custom);
if(customCols.length){customCols.forEach(col=>{const val=a?.customFields?.[col.id]||'';cfa.innerHTML+=`<div class="form-group"><label>${col.label}</label><input type="text" class="custom-field-input" data-col-id="${col.id}" value="${val}" placeholder="输入${col.label}..."></div>`;});}
updIntl();$('#modal-overlay').classList.add('active');}
async function saveApp(cont=false){const co=$('#form-company').value.trim(),po=$('#form-position').value.trim(),ca=$('#form-category').value;if(!co||!po||!ca){toast('请填写公司、岗位和类别','error');return;}const appliedDate=$('#form-date').value;const rawSourceLink=$('#form-channel-link').value.trim();const normalizedSourceLink=rawSourceLink&&!/^https?:\/\//i.test(rawSourceLink)?('https://'+rawSourceLink):rawSourceLink;const d={company_name:co,position_title:po,position_category:ca,base_location:$('#form-base').value.trim(),applied_date:appliedDate,resume_id:$('#form-resume').value||null,preference_level:$('#form-preference').value,visa_requirement:$('#form-visa').value,source_channel:$('#form-channel').value.trim(),source_link:normalizedSourceLink,salary_expectation:$('#form-salary').value,next_action:$('#form-next-action').value,next_deadline:$('#form-deadline').value,jd_url:$('#form-jd-url').value,jd_image:jdImg,notes:$('#form-notes').value};
// 收集自定义字段
const cf={};$$('.custom-field-input').forEach(inp=>{cf[inp.dataset.colId]=inp.value.trim();});if(Object.keys(cf).length)d.customFields=cf;
if(editId){const old=store.getApp(editId);d.customFields=Object.assign({},old?.customFields||{},cf);
// 同步投递日期到时间线
if(old.timeline&&old.timeline.length){const nextTimeline=cloneData(old.timeline);const ae=nextTimeline.find(t=>t.name==='已投递');if(ae)ae.date=appliedDate;d.timeline=nextTimeline;}
const ok=await store.updateApp(editId,d);if(!ok){toast('保存失败，请重试','error');return;}toast('已更新','success');}else{d.timeline=[{name:'已投递',date:appliedDate}];d.status=$('#form-status').value||'APPLIED';d.customFields=cf;const ok=await store.addApp(d);if(!ok){toast('保存失败，请重试','error');return;}toast('已创建','success');}if(cont){editId=null;$('#form-company').value='';$('#form-position').value='';$('#form-company').focus();}else{$('#modal-overlay').classList.remove('active');editId=null;}refresh();}
$('#add-application-btn').addEventListener('click',()=>openAppModal());
$('#modal-save').addEventListener('click',()=>saveApp(false));
$('#modal-save-continue').addEventListener('click',()=>saveApp(true));
$('#modal-cancel').addEventListener('click',()=>{$('#modal-overlay').classList.remove('active');editId=null;});
$('#modal-close').addEventListener('click',()=>{$('#modal-overlay').classList.remove('active');editId=null;});

// ---- 侧边栏（时间线可编辑，自定义轮次）----
let curDId=null,tlEditing=false;
function openDrawer(id){curDId=id;tlEditing=false;const a=store.getApp(id);if(!a)return;const si=getSI(a.status);$('#drawer-logo').textContent=ini(a.company_name);$('#drawer-company').textContent=a.company_name;$('#drawer-position').textContent=a.position_title;$('#drawer-status').className=`status-badge ${si.cls}`;$('#drawer-status').textContent=si.label;const w=getWait(a);$('#drawer-meta').textContent=w!==null?`等待${w}天 · ${fmtD(a.applied_date)}`:`${fmtD(a.applied_date)}`;renderDInfo(a);renderDTL(a);renderDRefs(a);$$('.drawer-tab').forEach(t=>t.classList.remove('active'));$$('.drawer-tab-content').forEach(t=>t.classList.remove('active'));$('.drawer-tab[data-tab="info"]').classList.add('active');$('#tab-info').classList.add('active');curTab='info';updDActions();$('#drawer-overlay').classList.add('active');}
function renderDInfo(a){const info=$('#tab-info');info.innerHTML='';const sourceValue=a.source_link?`<a href="${a.source_link}" target="_blank" style="color:var(--blue)">${a.source_channel||a.source_link}</a>`:(a.source_channel||'—');const f=[['岗位类别',a.position_category||'—'],['Base地',a.base_location||'—'],['偏好度',stars(a.preference_level)],['渠道',sourceValue],['薪资',a.salary_expectation||'—'],['下一步',a.next_action||'—'],['DDL',a.next_deadline?fmtDT(a.next_deadline):'—'],['JD',a.jd_url?`<a href="${a.jd_url}" target="_blank" style="color:var(--blue)">${a.jd_url}</a>`:'—'],['备注',a.notes||'—']];if(store.settings.intlMode)f.splice(3,0,['工签',(VISA_MAP[a.visa_requirement]||{}).label||'—']);const res=a.resume_id?store.getResume(a.resume_id):null;if(res)f.splice(2,0,['简历',`📎 ${res.file_name}`]);f.forEach(([l,v])=>{info.innerHTML+=`<div class="info-field"><div class="info-label">${l}</div><div class="info-value">${v}</div></div>`;});if(a.jd_image)info.innerHTML+=`<div class="info-field"><div class="info-label">JD截图</div><div class="info-value"><img src="${a.jd_image}" style="max-width:100%;border-radius:6px;cursor:pointer" onclick="document.getElementById('jd-preview-img').src=this.src;document.getElementById('jd-preview-overlay').classList.add('active')"></div></div>`;}
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
            delBtn.addEventListener('click',async ()=>{const nextTimeline=cloneData(timeline);nextTimeline.splice(i,1);const ok=await store.updateApp(a.id,{timeline:nextTimeline});if(ok!==false){a.timeline=nextTimeline;renderDTL(a,true);}});
            row.appendChild(sel);row.appendChild(dateInp);row.appendChild(delBtn);list.appendChild(row);
        });
        tl.appendChild(list);
        const btns=document.createElement('div');btns.style.cssText='display:flex;gap:6px;margin-top:8px';
        btns.innerHTML=`<button class="btn-ghost btn-sm" id="tl-add">+ 添加轮次</button><button class="btn-primary btn-sm" id="tl-save">保存</button>`;
        tl.appendChild(btns);
        $('#tl-add').addEventListener('click',async ()=>{const nextTimeline=cloneData(timeline);nextTimeline.push({name:'一面',date:''});const ok=await store.updateApp(a.id,{timeline:nextTimeline});if(ok!==false){a.timeline=nextTimeline;renderDTL(a,true);}});
        $('#tl-save').addEventListener('click',async ()=>{
            const nextTimeline=cloneData(timeline);
            $$('#tl-edit select, #tl-edit input').forEach(el=>{const i=parseInt(el.dataset.i),f=el.dataset.f;if(!isNaN(i)&&nextTimeline[i])nextTimeline[i][f]=el.value;});
            // 从时间线推导状态
            const newStatus=deriveStatus(nextTimeline);
            // 同步"已投递"日期到 applied_date
            const appliedEntry=nextTimeline.find(t=>t.name==='已投递');
            const updates={timeline:nextTimeline,status:newStatus};
            if(appliedEntry&&appliedEntry.date)updates.applied_date=appliedEntry.date;
            const ok=await store.updateApp(a.id,updates);
            if(ok===false)return;
            a.timeline=nextTimeline;
            a.status=newStatus;
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
    $('#d-del')?.addEventListener('click',async ()=>{if(confirm('确定删除？')){const ok=await store.delApp(curDId);if(ok===false)return;$('#drawer-overlay').classList.remove('active');refresh();toast('已删除','info');}});
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
        c.querySelector('.del-btn').addEventListener('click',async e=>{e.stopPropagation();if(confirm('删除简历「'+r.file_name+'」？')){const ok=await store.delResume(r.id);if(ok===false)return;renderResumes();toast('已删除','info');}});
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
let currentReflectionMode='text';
function renderPPTags(sel=[]){const el=$('#pain-points-selector');el.innerHTML='';store.painPoints.forEach(p=>{const lb=document.createElement('label');lb.className='tag-check';lb.innerHTML=`<input type="checkbox" value="${p}" ${sel.includes(p)?'checked':''}><span>${p}</span>`;el.appendChild(lb);});}
function resetVoiceUI(){
    const btn=$('#record-btn');
    if(btn)btn.classList.remove('recording');
    if($('#record-label'))$('#record-label').textContent='点击开始转写';
    if($('#record-timer'))$('#record-timer').textContent='00:00';
    if($('#voice-result')){
        $('#voice-result').style.display='none';
        $('#voice-result').textContent='';
    }
}
function openRefModal(refId=null,preAppId=null){
    editRefId=refId;const ref=refId?store.refs.find(r=>r.id===refId):null;
    $('#reflection-modal-title').textContent=ref?'编辑复盘':'新建复盘';
    const sel=$('#reflection-application');sel.innerHTML='<option value="">选择投递...</option>';
    store.apps.filter(a=>a.status!=='WATCHING').forEach(a=>{sel.innerHTML+=`<option value="${a.id}" ${(ref?.app_id===a.id||preAppId===a.id)?'selected':''}>${a.company_name} - ${a.position_title}</option>`;});
    $('#reflection-round').value=ref?.interview_round||'ROUND_1';$('#reflection-content').value=ref?.raw_content||'';
    renderPPTags(ref?.pain_points||[]);
    $$('.star-rating .star').forEach(s=>s.classList.toggle('active',parseInt(s.dataset.val)<=(ref?.self_rating||0)));
    currentReflectionMode='text';
    if(voiceRecognition)voiceRecognition.stop();
    clearInterval(recTimer);recSec=0;voiceTranscriptFinal='';
    resetVoiceUI();
    $('#voice-recorder').style.display='none';$('#reflection-content').style.display='';$$('.mode-btn').forEach(b=>b.classList.remove('active'));$('.mode-btn[data-mode="text"]').classList.add('active');
    $('#reflection-modal-overlay').classList.add('active');
}
$('#add-pain-point-btn').addEventListener('click',async ()=>{const inp=$('#new-pain-point-input'),v=inp.value.trim();if(!v)return;const added=await store.addPP(v);if(!added)return;inp.value='';const cur=[];$$('#pain-points-selector input:checked').forEach(i=>cur.push(i.value));cur.push(v);renderPPTags(cur);});
$('#new-pain-point-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#add-pain-point-btn').click();}});
$$('.mode-btn').forEach(b=>{b.addEventListener('click',()=>{$$('.mode-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentReflectionMode=b.dataset.mode||'text';$('#reflection-content').style.display=currentReflectionMode==='text'?'':'none';$('#voice-recorder').style.display=currentReflectionMode==='voice'?'':'none';if(currentReflectionMode!=='voice'&&voiceRecognition)voiceRecognition.stop();});});
let recTimer=null,recSec=0,voiceRecognition=null,voiceTranscriptFinal='',voiceRecognitionActive=false;
const SpeechRecognitionCtor=window.SpeechRecognition||window.webkitSpeechRecognition||null;
if(SpeechRecognitionCtor){
    voiceRecognition=new SpeechRecognitionCtor();
    voiceRecognition.lang='zh-CN';
    voiceRecognition.continuous=true;
    voiceRecognition.interimResults=true;
    voiceRecognition.onresult=function(event){
        let interim='';
        for(let i=event.resultIndex;i<event.results.length;i++){
            const transcript=(event.results[i][0]&&event.results[i][0].transcript)||'';
            if(event.results[i].isFinal)voiceTranscriptFinal+=transcript;
            else interim+=transcript;
        }
        const combined=(voiceTranscriptFinal+interim).trim();
        $('#reflection-content').value=combined;
        $('#voice-result').style.display=combined?'':'none';
        $('#voice-result').innerHTML=combined?`<div class="voice-result-label">实时转写</div><div>${combined.replace(/\n/g,'<br>')}</div>`:'';
    };
    voiceRecognition.onend=function(){
        voiceRecognitionActive=false;
        clearInterval(recTimer);
        recTimer=null;
        const btn=$('#record-btn');
        if(btn)btn.classList.remove('recording');
        $('#record-label').textContent=voiceTranscriptFinal.trim()?'重新转写':'点击开始转写';
        if($('#voice-result').textContent.trim()){
            $('#voice-result').style.display='';
            if(!$('#voice-result').querySelector('.voice-result-label'))$('#voice-result').innerHTML=`<div class="voice-result-label">转写完成</div><div>${($('#reflection-content').value||'').replace(/\n/g,'<br>')}</div>`;
        }
    };
    voiceRecognition.onerror=function(event){
        voiceRecognitionActive=false;
        clearInterval(recTimer);
        recTimer=null;
        const btn=$('#record-btn');
        if(btn)btn.classList.remove('recording');
        $('#record-label').textContent='点击开始转写';
        if(event&&event.error!=='no-speech')toast('语音转文字暂时不可用，请改用文本输入','error');
    };
}
$('#record-btn').addEventListener('click',async()=>{
    const btn=$('#record-btn');
    if(!voiceRecognition){
        toast('当前浏览器不支持语音转文字，请改用文本输入','error');
        return;
    }
    if(voiceRecognitionActive){
        $('#record-label').textContent='整理中...';
        voiceRecognition.stop();
        return;
    }
    try{
        voiceTranscriptFinal='';
        $('#reflection-content').value='';
        $('#voice-result').style.display='none';
        $('#voice-result').textContent='';
        recSec=0;
        $('#record-timer').textContent='00:00';
        voiceRecognition.start();
        voiceRecognitionActive=true;
        btn.classList.add('recording');
        $('#record-label').textContent='正在转写...';
        recTimer=setInterval(()=>{recSec++;$('#record-timer').textContent=`${String(Math.floor(recSec/60)).padStart(2,'0')}:${String(recSec%60).padStart(2,'0')}`;},1000);
    }catch(e){
        voiceRecognitionActive=false;
        btn.classList.remove('recording');
        clearInterval(recTimer);
        recTimer=null;
        toast('无法启动语音转文字，请检查麦克风权限','error');
    }
});
$$('.star-rating .star').forEach(s=>{s.addEventListener('click',()=>{const v=parseInt(s.dataset.val);$$('.star-rating .star').forEach(x=>x.classList.toggle('active',parseInt(x.dataset.val)<=v));});});
$('#reflection-save').addEventListener('click',async ()=>{const aid=$('#reflection-application').value,round=$('#reflection-round').value,content=$('#reflection-content').value.trim();if(!aid||!round){toast('请选择投递和轮次','error');return;}if(!content){toast('请输入内容','error');return;}const pp=[];$$('#pain-points-selector input:checked').forEach(i=>pp.push(i.value));let sr=0;$$('.star-rating .star.active').forEach(()=>sr++);const d={app_id:aid,interview_round:round,input_type:currentReflectionMode==='voice'?'VOICE':'TEXT',raw_content:content,cleaned_content:content,ai_extracted:null,pain_points:pp,self_rating:sr||null};if(editRefId){const ok=await store.updateRef(editRefId,d);if(ok===false){toast('保存失败，请重试','error');return;}toast('已更新','success');}else{const ok=await store.addRef(d);if(ok===false){toast('保存失败，请重试','error');return;}toast('已保存','success');}if(voiceRecognition)voiceRecognition.stop();$('#reflection-modal-overlay').classList.remove('active');editRefId=null;renderRefs();if(curDId)openDrawer(curDId);});
$('#reflection-cancel').addEventListener('click',()=>{if(voiceRecognition)voiceRecognition.stop();$('#reflection-modal-overlay').classList.remove('active');editRefId=null;});
$('#reflection-modal-close').addEventListener('click',()=>{if(voiceRecognition)voiceRecognition.stop();$('#reflection-modal-overlay').classList.remove('active');editRefId=null;});

// ---- 数据大屏 ----
function renderAnalytics(){
    const apps=store.apps,ap=apps.filter(a=>a.status!=='WATCHING'),ac=apps.filter(a=>!['WATCHING','REJECTED','WITHDRAWN'].includes(a.status));
    const iv=apps.filter(a=>['ROUND_1','ROUND_2','ROUND_3','ROUND_4'].includes(a.status)),of=apps.filter(a=>a.status==='OFFER'),rj=apps.filter(a=>a.status==='REJECTED');
    const rc=apps.filter(a=>['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,rr=ap.length?Math.round(rc/ap.length*100):0;
    $('#stat-cards').innerHTML=`<div class="stat-card"><div class="stat-card-label">总投递</div><div class="stat-card-value">${ap.length}</div></div><div class="stat-card"><div class="stat-card-label">活跃</div><div class="stat-card-value">${ac.length}</div></div><div class="stat-card"><div class="stat-card-label">面试中</div><div class="stat-card-value">${iv.length}</div></div><div class="stat-card"><div class="stat-card-label">Offer</div><div class="stat-card-value" style="color:var(--green)">${of.length}</div></div><div class="stat-card"><div class="stat-card-label">回复率</div><div class="stat-card-value">${rr}%</div></div><div class="stat-card"><div class="stat-card-label">挂了</div><div class="stat-card-value" style="color:var(--red)">${rj.length}</div></div>`;
    const fd=[{l:'投递',c:ap.length,co:'#60a5fa'},{l:'笔试',c:apps.filter(a=>['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#a78bfa'},{l:'一面+',c:apps.filter(a=>['ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#818cf8'},{l:'二面+',c:apps.filter(a=>['ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#fb923c'},{l:'Offer',c:of.length,co:'#4ade80'}];
    const mf=Math.max(fd[0].c,1);$('#funnel-chart').innerHTML=fd.map(d=>`<div class="funnel-stage"><span class="funnel-label">${d.l}</span><div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${Math.max(Math.round(d.c/mf*100),5)}%;background:${d.co}">${d.c}</div></div><span class="funnel-value">${fd[0].c?Math.round(d.c/fd[0].c*100):0}%</span></div>`).join('');
    const cs={};ap.forEach(a=>{const c=a.position_category||'其他';if(!cs[c])cs[c]={t:0,r:0};cs[c].t++;if(['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status))cs[c].r++;});
    const ce=Object.entries(cs).sort((a,b)=>b[1].t-a[1].t||b[1].r-a[1].r||a[0].localeCompare(b[0],'zh-CN')),mc=Math.max(...ce.map(([,v])=>v.t),1);
    $('#category-chart').innerHTML=ce.length?ce.map(([c,v],i)=>`<div class="category-bar-item"><span class="category-name">${c}</span><div class="category-bar-wrap"><div class="category-bar" style="width:${Math.max(Math.round(v.t/mc*100),8)}%;background:${COLORS[i%COLORS.length]};opacity:.78"></div></div><span class="category-rate"><span class="category-rate-meta">${v.t} 投递 / ${v.r} 推进</span><strong>${Math.round(v.r/v.t*100)}%</strong></span></div>`).join(''):'<div class="empty-state"><p>暂无</p></div>';
    const rs={};store.logs.filter(l=>l.to==='REJECTED'&&l.rej).forEach(l=>{rs[l.rej]=(rs[l.rej]||0)+1;});
    const re=Object.entries(rs).sort((a,b)=>b[1]-a[1]),mr=Math.max(...re.map(([,v])=>v),1);
    $('#attribution-chart').innerHTML=re.length?re.map(([s,c])=>`<div class="attribution-item"><span class="attribution-label">${REJECTION_STAGES[s]||s}</span><div class="attribution-bar-wrap"><div class="attribution-bar" style="width:${Math.max(Math.round(c/mr*100),8)}%"></div></div><span class="attribution-count">${c}</span></div>`).join(''):'<div class="empty-state"><p>暂无归因</p></div>';
    const baseStats={};ap.forEach(a=>{const key=a.base_location||'未填写';baseStats[key]=(baseStats[key]||0)+1;});
    const baseEntries=Object.entries(baseStats).sort((a,b)=>b[1]-a[1]).map(function(entry){return{label:entry[0],value:entry[1]};});
    renderBaseDistributionChart(baseEntries,ap.length);
    const sourceStats={};ap.forEach(a=>{const key=a.source_channel||'未填写';if(!sourceStats[key])sourceStats[key]={total:0,progress:0};sourceStats[key].total++;if(['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status))sourceStats[key].progress++;});
    const sourceEntries=Object.entries(sourceStats).sort((a,b)=>{
        const ar=a[1].total? a[1].progress/a[1].total:0;
        const br=b[1].total? b[1].progress/b[1].total:0;
        return b[1].total-a[1].total||b[1].progress-a[1].progress||br-ar;
    }).map(function(entry){
        const name=entry[0],stats=entry[1];
        const rate=stats.total?Math.round(stats.progress/stats.total*100):0;
        return {label:name,total:stats.total,progress:stats.progress,rate:rate};
    });
    renderSourcePerformanceChart(sourceEntries);
    doInsight(ap,cs,rs);
}
async function doInsight(ap,cs,rs){
    const el=$('#insight-content');
    if(ap.length<3){
        el.innerHTML='<div class="empty-state"><p>投递3条以上解锁</p></div>';
        return;
    }
    const result={text:buildAnalyticsFallback(ap,cs,rs),mode:'fallback',label:'内置数据分析',badge:'基于当前投递、推进、失分和渠道数据自动生成。'};
    renderAIBlocks(el,result.text,'insight',result);
}

// ---- 设置 ----
document.getElementById('settings-btn')?.addEventListener('click',()=>{document.getElementById('profile-btn')?.click();});
function renderSetCats(){const el=$('#settings-categories');el.innerHTML='';store.categories.forEach(c=>{const t=document.createElement('span');t.className='settings-tag';t.innerHTML=`${c} <span class="remove-tag">×</span>`;t.querySelector('.remove-tag').addEventListener('click',async ()=>{const ok=await store.rmCat(c);if(ok!==false){renderSetCats();initFilters();}});el.appendChild(t);});}
function renderSetPPs(){const el=$('#settings-painpoints');el.innerHTML='';store.painPoints.forEach(p=>{const t=document.createElement('span');t.className='settings-tag';t.innerHTML=`${p} <span class="remove-tag">×</span>`;t.querySelector('.remove-tag').addEventListener('click',async ()=>{const ok=await store.rmPP(p);if(ok!==false)renderSetPPs();});el.appendChild(t);});}
$('#settings-add-cat').addEventListener('click',async ()=>{const v=$('#settings-new-cat').value.trim();if(v){const added=await store.addCat(v);if(!added)return;$('#settings-new-cat').value='';renderSetCats();initFilters();}});
$('#settings-new-cat').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#settings-add-cat').click();}});
$('#settings-add-pp').addEventListener('click',async ()=>{const v=$('#settings-new-pp').value.trim();if(v){const added=await store.addPP(v);if(!added)return;$('#settings-new-pp').value='';renderSetPPs();}});
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
                case'base_location':return a.base_location||'';
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
$('#clear-confirm-btn').addEventListener('click',async ()=>{if($('#clear-confirm-input').value.trim()==='确定清除数据'){const ok=await store.clearAllData();if(ok===false)return;localStorage.removeItem('rt_set');localStorage.setItem('rt_nickname',getProfileNickname());Object.keys(localStorage).forEach(function(key){if(key.indexOf('n_')===0)localStorage.removeItem(key);});$('#clear-confirm-area').style.display='none';$('#clear-confirm-input').value='';if(document.getElementById('settings-weekly-goal'))document.getElementById('settings-weekly-goal').value=store.settings.weeklyGoal||getDefaultSettings().weeklyGoal;syncIntlToggles();renderSetCats();renderSetPPs();initFilters();renderTableControlOptions();updIntl();refresh();toast('云端数据已重置为演示初始态','success');}else{toast('请输入正确的确认文字','error');}});

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
    $('#resume-link-save').addEventListener('click',async ()=>{
        const selected=[];$$('.rl-check:checked').forEach(c=>selected.push(c.dataset.id));
        const ok=await store.linkResumeToApps(resumeId,selected);
        if(ok===false)return;
        $('#resume-link-overlay').remove();renderResumes();toast('关联已更新','success');
    });
}
function initFilters(){const cs=$('#filter-category');cs.innerHTML='<option value="">全部类别</option>';store.categories.forEach(c=>{cs.innerHTML+=`<option value="${c}">${c}</option>`;});const ss=$('#table-filter-status');const prev=ss.value;ss.innerHTML='<option value="">全部状态</option>';STATUSES.filter(s=>s.key!=='REJECTED').forEach(s=>{ss.innerHTML+=`<option value="${s.key}">${s.label}</option>`;});ss.value=STATUSES.some(s=>s.key===prev&&s.key!=='REJECTED')?prev:'';renderTableControlOptions();}
function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().split('T')[0];}
function buildStarterData(preservedSettings){
    const categories=['产品运营','技术研发','管理咨询','数据分析','金融投行','市场营销'];
    const settings=Object.assign({},getDefaultSettings(),preservedSettings||{});
    const samples=[
        {company_name:'字节跳动',position_title:'产品经理 - 电商增长',position_category:'产品运营',base_location:'北京',applied_date:daysAgo(12),preference_level:'4',source_channel:'Boss直聘',source_link:'https://www.zhipin.com/',timeline:[{name:'已投递',date:daysAgo(12)},{name:'一面',date:daysAgo(5)}],next_action:'准备二面案例题',next_deadline:new Date(Date.now()+3*864e5).toISOString().slice(0,16),notes:'面试官关注增长实验设计。'},
        {company_name:'腾讯',position_title:'数据分析师',position_category:'数据分析',base_location:'深圳',applied_date:daysAgo(6),preference_level:'3',source_channel:'官网',source_link:'https://careers.tencent.com/',timeline:[{name:'已投递',date:daysAgo(6)},{name:'笔试/OA',date:daysAgo(3)}],next_action:'复盘 SQL 与 ABTest',notes:'笔试完成，等待面试通知。'},
        {company_name:'麦肯锡',position_title:'Business Analyst',position_category:'管理咨询',base_location:'上海',applied_date:daysAgo(18),preference_level:'4',source_channel:'官网',source_link:'https://www.mckinsey.com/careers',visa_requirement:'SPONSOR_YES',timeline:[{name:'已投递',date:daysAgo(18)},{name:'笔试/OA',date:daysAgo(10)}],next_action:'刷 case interview',notes:'国际项目较多，适合作为高优先级目标。'},
        {company_name:'阿里巴巴',position_title:'商业分析培训生',position_category:'产品运营',base_location:'杭州',applied_date:daysAgo(4),preference_level:'3',source_channel:'内推',timeline:[{name:'已投递',date:daysAgo(4)}],next_action:'联系内推人确认进度'},
        {company_name:'Google',position_title:'Product Manager',position_category:'产品运营',base_location:'Singapore',applied_date:daysAgo(21),preference_level:'4',source_channel:'LinkedIn',source_link:'https://www.linkedin.com/jobs/',visa_requirement:'SPONSOR_YES',timeline:[{name:'已投递',date:daysAgo(21)},{name:'一面',date:daysAgo(16)},{name:'二面',date:daysAgo(10)},{name:'三面',date:daysAgo(4)}],next_action:'准备 cross-functional 案例',next_deadline:new Date(Date.now()+2*864e5).toISOString().slice(0,16)},
        {company_name:'小红书',position_title:'营销策划',position_category:'市场营销',base_location:'上海',applied_date:daysAgo(14),preference_level:'2',source_channel:'官网',source_link:'https://job.xiaohongshu.com/',timeline:[{name:'已投递',date:daysAgo(14)},{name:'挂了',date:daysAgo(9)}],notes:'已结束，用来演示完整流程与状态回顾。'}
    ];
    const apps=samples.map(function(sample){
        const timeline=cloneData(sample.timeline||[]);
        const app=Object.assign({},sample,{
            id:crypto.randomUUID(),
            status:deriveStatus(timeline),
            visa_requirement:sample.visa_requirement||'UNKNOWN',
            salary_expectation:sample.salary_expectation||'',
            source_link:sample.source_link||'',
            timeline:timeline,
            created_at:new Date().toISOString(),
            updated_at:new Date().toISOString(),
            customFields:{}
        });
        return app;
    });
    const logs=apps.map(function(app){
        return {id:crypto.randomUUID(),app_id:app.id,from:null,to:app.status,rej:app.status==='REJECTED'?'FINAL_FAIL':null,at:new Date().toISOString()};
    });
    const googleApp=apps.find(function(app){return app.company_name==='Google';});
    const refs=googleApp?[{id:crypto.randomUUID(),app_id:googleApp.id,interview_round:'ROUND_2',input_type:'TEXT',raw_content:'产品设计题围绕留学生求职工具的提醒系统展开，思路清晰，但定量指标拆得还不够细。',cleaned_content:'产品设计题围绕留学生求职工具的提醒系统展开，思路清晰，但定量指标拆得还不够细。',ai_extracted:null,pain_points:['Case分析薄弱','准备不足'],self_rating:4,at:new Date().toISOString()}]:[];
    return {
        apps:apps,
        resumes:[],
        refs:refs,
        logs:logs,
        categories:categories,
        pain_points:[...DEFAULT_PP],
        settings:settings,
        table_cols:cloneData(DEFAULT_COLS)
    };
}
window.rtCreateStarterData=buildStarterData;
window.rtShouldSeedStarterData=function(data){
    return !data||(!data.apps?.length&&!data.resumes?.length&&!data.refs?.length&&!data.logs?.length&&!data.categories?.length);
};
function init(){
    initFilters();
    renderTableControlOptions();
    syncKanbanSortDirection();
    syncQuickEditPanel();
    updIntl();
    switchView('pipeline');
}
init();
