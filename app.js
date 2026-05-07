// 履迹 Resume Trail V4
const STATUSES=[{key:'WATCHING',label:'观望中',cls:'status-watching'},{key:'APPLIED',label:'已投递',cls:'status-applied'},{key:'OA_TEST',label:'笔试/OA',cls:'status-oa'},{key:'ROUND_1',label:'一面',cls:'status-round1'},{key:'ROUND_2',label:'二面',cls:'status-final'},{key:'ROUND_3',label:'三面',cls:'status-final'},{key:'ROUND_4',label:'四面',cls:'status-final'},{key:'OFFER',label:'Offer',cls:'status-offer'},{key:'REJECTED',label:'流程终止',cls:'status-rejected'},{key:'WITHDRAWN',label:'放弃',cls:'status-withdrawn'}];
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
const REJECTION_STAGES={RESUME_SCREEN:'简历筛选阶段',OA_FAIL:'笔试阶段',ROUND1_BIZ:'一面阶段',GROUP_INTERVIEW:'群面阶段',FINAL_FAIL:'终面阶段',HR_FAIL:'HR 面阶段',OTHER:'其他原因'};
const ROUND_LABELS={OA_TEST:'笔试/OA',ROUND_1:'一面',ROUND_2:'二面',ROUND_3:'三面',ROUND_4:'四面',GROUP:'群面',HR:'HR面'};
const TL_TO_STATUS={'已投递':'APPLIED','笔试/OA':'OA_TEST','一面':'ROUND_1','二面':'ROUND_2','三面':'ROUND_3','四面':'ROUND_4','Offer':'OFFER','挂了':'REJECTED','未通过':'REJECTED','流程终止':'REJECTED'};
const TL_OPTIONS=['已投递','笔试/OA','一面','二面','三面','四面','群面','HR面','Offer','流程终止'];
const STATUS_TO_TL={APPLIED:'已投递',OA_TEST:'笔试/OA',ROUND_1:'一面',ROUND_2:'二面',ROUND_3:'三面',ROUND_4:'四面',OFFER:'Offer',REJECTED:'流程终止'};
const TIMELINE_STAGE_ORDER={'已投递':0,'笔试/OA':1,'一面':2,'群面':2,'HR面':2,'二面':3,'三面':4,'四面':5,'Offer':6,'未通过':7,'挂了':7,'流程终止':7};
function getTimelineNameForStatus(status){
    return STATUS_TO_TL[status]||'';
}
function parseTimelineDateValue(value){
    if(!value)return null;
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return null;
    return date.getTime();
}
function compareTimelineItems(a,b){
    const aTime=parseTimelineDateValue(a?.date);
    const bTime=parseTimelineDateValue(b?.date);
    if(aTime!==null&&bTime!==null&&aTime!==bTime)return aTime-bTime;
    if(aTime===null&&bTime!==null)return -1;
    if(aTime!==null&&bTime===null)return 1;
    const aOrder=TIMELINE_STAGE_ORDER[a?.name]??999;
    const bOrder=TIMELINE_STAGE_ORDER[b?.name]??999;
    if(aOrder!==bOrder)return aOrder-bOrder;
    return String(a?.name||'').localeCompare(String(b?.name||''),'zh-CN');
}
function sortTimeline(items){
    return cloneData(items||[]).filter(item=>item&&item.name).sort(compareTimelineItems);
}
function getLatestTimelineEntry(timeline){
    const ordered=sortTimeline(timeline).filter(item=>TL_TO_STATUS[item.name]);
    return ordered.length?ordered[ordered.length-1]:null;
}
function validateTimelineChronology(timeline){
    const ordered=sortTimeline(timeline);
    let maxRank=-1;
    for(let i=0;i<ordered.length;i++){
        const item=ordered[i];
        const rank=TIMELINE_STAGE_ORDER[item.name];
        const currentTime=parseTimelineDateValue(item.date);
        if(typeof rank!=='number'||currentTime===null)continue;
        if(rank<maxRank){
            return `${item.name} 的时间不能早于前一阶段，请检查时间线顺序。`;
        }
        maxRank=Math.max(maxRank,rank);
    }
    return '';
}
// 从时间线推导状态
function deriveStatus(timeline){
    const latest=getLatestTimelineEntry(timeline);
    if(!latest)return'WATCHING';
    return TL_TO_STATUS[latest.name]||'APPLIED';
}
const PREF_OPTIONS=[{v:'1',l:'⭐ 保底'},{v:'2',l:'⭐⭐ 一般'},{v:'3',l:'⭐⭐⭐ 心仪'},{v:'4',l:'⭐⭐⭐⭐ 梦想'}];
const DEFAULT_PP=['表达不清','知识盲区','紧张','准备不足','Case分析薄弱','行为面试不佳','技术题不熟练'];
const COLORS=['#60a5fa','#a78bfa','#4ade80','#fb923c','#f87171','#fbbf24','#34d399','#f472b6','#818cf8','#a3e635'];
const DEFAULT_COLS=[{id:'company_name',label:'公司',show:true,system:true},{id:'position_title',label:'岗位',show:true,system:true},{id:'position_category',label:'类别',show:true,system:true},{id:'base_location',label:'Base地',show:true,system:true},{id:'status',label:'状态',show:true,system:true},{id:'applied_date',label:'投递日期',show:true,system:true},{id:'waiting',label:'等待',show:true,system:true},{id:'preference_level',label:'偏好',show:true,system:true},{id:'source_channel',label:'渠道',show:true,system:true},{id:'jd',label:'JD',show:true,system:true},{id:'actions',label:'操作',show:true,system:true}];
const RT_GUEST_MODE_KEY='rt_guest_mode';
const RT_GUEST_DATA_KEY='rt_guest_data';

function cloneData(value){
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function escapeHTML(value){
    return String(value??'').replace(/[&<>"']/g,function(char){
        return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]);
    });
}

function safeHttpUrl(value){
    const text=String(value||'').trim();
    if(!text)return'';
    try{
        const url=new URL(text,location.origin);
        return /^https?:$/i.test(url.protocol)?url.href:'';
    }catch(err){
        return'';
    }
}

function createEl(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(typeof text!=='undefined')el.textContent=text;
    return el;
}

function getAnalyticsBaseProps(extra){
    return Object.assign({
        guest_mode:!!(window.rtGuestStore&&window.rtGuestStore.isEnabled&&window.rtGuestStore.isEnabled()),
        current_view:typeof curView==='string'&&curView?curView:'login',
        device_type:window.innerWidth<=720?'mobile':'desktop'
    },extra||{});
}

window.rtTrackEvent=function(name,props){
    if(!window.rtAnalytics||typeof window.rtAnalytics.capture!=='function')return false;
    return window.rtAnalytics.capture(name,getAnalyticsBaseProps(props));
};

window.rtIdentifyUser=function(user,props){
    if(!window.rtAnalytics||typeof window.rtAnalytics.identify!=='function'||!user||!user.id)return false;
    return window.rtAnalytics.identify(user.id,Object.assign({
        email:user.email||'',
        device_type:window.innerWidth<=720?'mobile':'desktop'
    },props||{}));
};

function appendTextLines(target,text){
    String(text||'').split('\n').forEach(function(line,index){
        if(index)target.appendChild(document.createElement('br'));
        target.appendChild(document.createTextNode(line));
    });
}

function renderVoiceResult(label,text){
    const box=$('#voice-result');
    if(!box)return;
    const value=String(text||'').trim();
    box.textContent='';
    box.style.display=value?'':'none';
    if(!value)return;
    box.appendChild(createEl('div','voice-result-label',label));
    const body=createEl('div');
    appendTextLines(body,value);
    box.appendChild(body);
}

function buildReflectionCard(ref,showRating){
    const rl=ROUND_LABELS[ref.interview_round]||ref.interview_round;
    const card=createEl('div','reflection-card');
    const header=createEl('div','reflection-card-header');
    header.appendChild(createEl('span','reflection-card-round',rl));
    const time=createEl('span');
    time.style.cssText='font-size:10px;color:var(--text-muted)';
    time.textContent=fmtDT(ref.at);
    header.appendChild(time);
    card.appendChild(header);
    card.appendChild(createEl('div','reflection-card-content',ref.cleaned_content||ref.raw_content||''));
    const footer=createEl('div','reflection-card-footer');
    if(showRating&&ref.self_rating){
        footer.appendChild(createEl('span','',`${'★'.repeat(ref.self_rating)}${'☆'.repeat(5-ref.self_rating)}`));
    }
    (ref.pain_points||[]).forEach(function(point){
        footer.appendChild(createEl('span','pain-tag',point));
    });
    if(footer.childNodes.length)card.appendChild(footer);
    return card;
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
    const timeline=sortTimeline(source.timeline||source.tl||[]);
    const latestTimeline=getLatestTimelineEntry(timeline);
    const next=Object.assign({},source,{
        company_name:source.company_name||source.cn||'',
        position_title:source.position_title||source.pt||'',
        position_category:source.position_category||source.pc||'',
        base_location:source.base_location||source.base||'',
        applied_date:source.applied_date||source.ad||'',
        current_status_date:source.current_status_date||source.csd||latestTimeline?.date||source.applied_date||source.ad||'',
        preference_level:source.preference_level||source.pl||'3',
        source_channel:source.source_channel||source.sc||'',
        source_link:source.source_link||'',
        visa_requirement:source.visa_requirement||source.vr||'UNKNOWN',
        timeline:timeline,
        customFields:source.customFields&&typeof source.customFields==='object'?source.customFields:{}
    });
    const appliedEntry=timeline.find(item=>item.name==='已投递');
    if(appliedEntry&&appliedEntry.date)next.applied_date=appliedEntry.date;
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

window.rtGuestStore={
    isEnabled:function(){
        return localStorage.getItem(RT_GUEST_MODE_KEY)==='1';
    },
    enable:function(){
        localStorage.setItem(RT_GUEST_MODE_KEY,'1');
    },
    disable:function(){
        localStorage.removeItem(RT_GUEST_MODE_KEY);
    },
    load:function(){
        try{
            const raw=localStorage.getItem(RT_GUEST_DATA_KEY);
            return raw?JSON.parse(raw):null;
        }catch(err){
            console.warn('[RT guest] load failed',err);
            return null;
        }
    },
    save:function(store){
        const payload={
            apps:cloneData(store.apps),
            resumes:cloneData(store.resumes),
            refs:cloneData(store.refs),
            logs:cloneData(store.logs),
            settings:cloneData(store.settings),
            categories:cloneData(store.categories),
            pain_points:cloneData(store.painPoints),
            table_cols:cloneData(store.tableCols)
        };
        localStorage.setItem(RT_GUEST_DATA_KEY,JSON.stringify(payload));
        return true;
    },
    clear:function(){
        localStorage.removeItem(RT_GUEST_DATA_KEY);
    },
    ensureData:function(){
        let data=this.load();
        if(!data||window.rtShouldSeedStarterData&&window.rtShouldSeedStarterData(data)){
            data=window.rtCreateStarterData?window.rtCreateStarterData({profileNickname:localStorage.getItem('rt_nickname')||'',profileAvatar:''}):null;
            if(data)localStorage.setItem(RT_GUEST_DATA_KEY,JSON.stringify(data));
        }
        return data;
    }
};

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
        if(window.rtGuestStore&&window.rtGuestStore.isEnabled()){
            try{
                window.rtGuestStore.save(this);
                return true;
            }catch(err){
                console.error('[RT guest] save failed',reason,err);
                if(typeof toast==='function')toast('本地保存失败，请重试','error');
                return false;
            }
        }
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
        const result=await this.commit('app.add',draft=>{
            const app=Object.assign({},cloneData(a),{
                id:crypto.randomUUID(),
                created_at:new Date().toISOString()
            });
            app.updated_at=app.created_at;
            if(!app.timeline)app.timeline=[];
            app.timeline=sortTimeline(app.timeline);
            app.status=app.status||deriveStatus(app.timeline);
            app.current_status_date=app.current_status_date||getLatestTimelineEntry(app.timeline)?.date||app.applied_date||'';
            draft.apps.push(app);
            draft.addLog(app.id,null,app.status);
            return app;
        });
        if(result&&result!==false&&window.rtTrackEvent){
            window.rtTrackEvent('rt_application_created',{
                status:result.status||'APPLIED',
                category:result.position_category||'',
                source_channel:result.source_channel||'',
                has_resume:!!result.resume_id
            });
        }
        return result;
    }
    async updateApp(id,u){
        return this.commit('app.update',draft=>{
            const idx=draft.apps.findIndex(a=>a.id===id);
            if(idx<0)return null;
            const old=draft.apps[idx];
            const updates=cloneData(u||{});
            if(updates.timeline)updates.timeline=sortTimeline(updates.timeline);
            if(updates.timeline&&!updates.status)updates.status=deriveStatus(updates.timeline);
            if(updates.timeline&&!updates.current_status_date)updates.current_status_date=getLatestTimelineEntry(updates.timeline)?.date||old.current_status_date||old.applied_date||'';
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
        const result=await this.commit('resume.add',draft=>{
            const now=new Date().toISOString();
            const maxOrder=draft.resumes.reduce(function(max,resume){
                return Math.max(max,Number.isFinite(resume.sort_order)?resume.sort_order:-1);
            },-1);
            const resume=Object.assign({},cloneData(r),{id:crypto.randomUUID(),at:now,updated_at:now,sort_order:maxOrder+1});
            draft.resumes.push(resume);
            return resume;
        });
        if(result&&result!==false&&window.rtTrackEvent){
            window.rtTrackEvent('rt_resume_created',{
                file_type:result.file_type||'',
                has_file:!!result.data_url,
                tag_count:(result.tags||[]).length
            });
            if(result.data_url){
                window.rtTrackEvent('rt_resume_uploaded',{
                    file_type:result.file_type||'',
                    size_kb:result.size?Math.round(result.size/1024):0
                });
            }
        }
        return result;
    }
    async updateResume(id,patch){
        return this.commit('resume.update',draft=>{
            const idx=draft.resumes.findIndex(r=>r.id===id);
            if(idx<0)return null;
            draft.resumes[idx]=Object.assign({},draft.resumes[idx],cloneData(patch||{}),{updated_at:new Date().toISOString()});
            return draft.resumes[idx];
        });
    }
    async delResume(id){
        return this.commit('resume.delete',draft=>{
            draft.resumes=draft.resumes.filter(r=>r.id!==id);
            draft.apps=draft.apps.map(app=>app.resume_id===id?Object.assign({},app,{resume_id:null,updated_at:new Date().toISOString()}):app);
            return true;
        });
    }
    async reorderResumes(ids){
        return this.commit('resume.reorder',draft=>{
            const orderMap=new Map(ids.map(function(id,index){return[id,index];}));
            draft.resumes=draft.resumes.slice().sort(function(a,b){
                const ai=orderMap.has(a.id)?orderMap.get(a.id):Number.MAX_SAFE_INTEGER;
                const bi=orderMap.has(b.id)?orderMap.get(b.id):Number.MAX_SAFE_INTEGER;
                return ai-bi;
            }).map(function(resume,index){
                return Object.assign({},resume,{sort_order:index});
            });
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
        const result=await this.commit('reflection.add',draft=>{
            const ref=Object.assign({},cloneData(r),{id:crypto.randomUUID(),at:new Date().toISOString()});
            draft.refs.push(ref);
            return ref;
        });
        if(result&&result!==false&&window.rtTrackEvent){
            window.rtTrackEvent('rt_reflection_created',{
                interview_round:result.interview_round||'',
                input_type:result.input_type||'TEXT',
                pain_point_count:(result.pain_points||[]).length
            });
        }
        return result;
    }
    async updateRef(id,u){
        return this.commit('reflection.update',draft=>{
            const idx=draft.refs.findIndex(r=>r.id===id);
            if(idx<0)return null;
            Object.assign(draft.refs[idx],cloneData(u||{}));
            return draft.refs[idx];
        });
    }
    async delRef(id){
        return this.commit('reflection.delete',draft=>{
            draft.refs=draft.refs.filter(r=>r.id!==id);
            return true;
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
        if(window.rtGuestStore&&window.rtGuestStore.isEnabled()){
            this.resetState();
            const starter=window.rtGuestStore.ensureData();
            if(starter){
                this.apps=(starter.apps||[]).map(normalizeAppRecord);
                this.resumes=cloneData(starter.resumes||[]);
                this.refs=cloneData(starter.refs||[]);
                this.logs=cloneData(starter.logs||[]);
                this.settings=Object.assign(getDefaultSettings(),starter.settings||{});
                this.categories=cloneData(starter.categories||[]);
                this.painPoints=cloneData(starter.pain_points||DEFAULT_PP);
                this.tableCols=normalizeTableColumns(starter.table_cols||DEFAULT_COLS);
            }
            window.rtGuestStore.save(this);
            return true;
        }
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
        const result=await this.commit('app.import',draft=>{
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
        if(result&&result!==false&&window.rtTrackEvent){
            window.rtTrackEvent('rt_application_imported',{
                row_count:result
            });
        }
        return result;
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
        this.panel.textContent='';
        const title=createEl('div','', 'RT Debug');
        title.style.cssText='font-weight:600;margin-bottom:6px;color:#f8fafc';
        this.panel.appendChild(title);
        [
            `邮箱: ${this.state.email||'-'}`,
            `user id: ${this.state.userId||'-'}`,
            `session: ${this.state.sessionExists}`,
            `上次加载: ${this.state.lastLoadAt||'-'}`,
            `上次保存: ${this.state.lastSaveAt||'-'}`,
            `保存结果: ${this.state.saveResult||'-'}`
        ].forEach(line=>this.panel.appendChild(createEl('div','',line)));
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
    target.textContent='';
    const wrap=createEl('div','base-chart-wrap');
    const donut=createEl('div','base-donut');
    donut.style.background=`conic-gradient(${buildConicGradient(entries.map(function(entry,index){return {value:entry.value,color:COLORS[index%COLORS.length]};}))})`;
    const center=createEl('div','base-donut-center');
    center.appendChild(createEl('div','base-donut-total',String(total)));
    center.appendChild(createEl('div','base-donut-label','岗位'));
    donut.appendChild(center);
    wrap.appendChild(donut);
    const legend=createEl('div','chart-legend');
    entries.forEach(function(entry,index){
        const item=createEl('div','legend-item');
        const dot=createEl('span','legend-dot');
        dot.style.background=COLORS[index%COLORS.length];
        item.appendChild(dot);
        item.appendChild(createEl('span','legend-label',entry.label));
        item.appendChild(createEl('span','legend-value',`${entry.value} · ${total?Math.round(entry.value/total*100):0}%`));
        legend.appendChild(item);
    });
    wrap.appendChild(legend);
    target.appendChild(wrap);
}

function renderSourcePerformanceChart(entries){
    const target=document.getElementById('source-chart');
    if(!target)return;
    if(!entries.length){
        target.innerHTML='<div class="empty-state compact"><p>暂无</p></div>';
        return;
    }
    const topEntries=entries.slice(0,6);
    target.textContent='';
    const shell=createEl('div','source-donut-shell');
    const donut=createEl('div','source-donut');
    donut.style.background=`conic-gradient(${buildConicGradient(topEntries.map(function(entry,index){return {value:entry.total,color:COLORS[index%COLORS.length]};}))})`;
    const center=createEl('div','source-donut-center');
    center.appendChild(createEl('div','source-donut-total',String(topEntries.reduce(function(sum,entry){return sum+entry.total;},0))));
    center.appendChild(createEl('div','source-donut-label','总投递数'));
    donut.appendChild(center);
    shell.appendChild(donut);
    const list=createEl('div','source-metric-list');
    const head=createEl('div','source-metric-head');
    head.innerHTML='<span>渠道</span><span>投递</span><span>推进</span><span>转化</span>';
    list.appendChild(head);
    topEntries.forEach(function(entry,index){
        const row=createEl('div','source-metric-row');
        const left=createEl('div','source-metric-left');
        const dot=createEl('span','source-metric-dot');
        dot.style.background=COLORS[index%COLORS.length];
        left.appendChild(dot);
        left.appendChild(createEl('div','source-metric-name',entry.label));
        row.appendChild(left);
        row.appendChild(createEl('strong','source-metric-count',String(entry.total)));
        row.appendChild(createEl('strong','source-metric-count',String(entry.progress)));
        row.appendChild(createEl('strong','source-stat-rate',`${entry.rate}%`));
        list.appendChild(row);
    });
    shell.appendChild(list);
    target.appendChild(shell);
}

function createSvgEl(tag,attrs){
    const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs||{}).forEach(function(pair){
        const key=pair[0],value=pair[1];
        if(typeof value!=='undefined'&&value!==null)el.setAttribute(key,String(value));
    });
    return el;
}

let analyticsTrendGranularity='day';

function buildTrendRange(apps,granularity='day'){
    const today=new Date();
    today.setHours(0,0,0,0);
    const points=new Map();
    function hit(dateStr,key){
        if(!dateStr)return;
        const d=new Date(dateStr);
        if(Number.isNaN(d.getTime()))return;
        d.setHours(0,0,0,0);
        let bucketKey='';
        let label='';
        if(granularity==='month'){
            bucketKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            label=`${String(d.getMonth()+1).padStart(2,'0')}月`;
        }else if(granularity==='week'){
            const start=new Date(d);
            start.setDate(d.getDate()-d.getDay());
            bucketKey=start.toISOString().split('T')[0];
            const end=new Date(start);
            end.setDate(start.getDate()+6);
            label=`${String(start.getMonth()+1).padStart(2,'0')}/${String(start.getDate()).padStart(2,'0')}`;
        }else{
            bucketKey=d.toISOString().split('T')[0];
            label=`${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
        }
        if(!points.has(bucketKey))points.set(bucketKey,{key:bucketKey,label:label,applied:0,interview:0});
        points.get(bucketKey)[key]++;
    }
    apps.forEach(function(app){
        hit(app.applied_date,'applied');
        (app.timeline||[]).forEach(function(item){
            if(['一面','二面','三面','四面','群面','HR面'].includes(item.name))hit(item.date,'interview');
        });
    });
    if(granularity==='month'){
        const result=[];
        for(let i=5;i>=0;i--){
            const d=new Date(today.getFullYear(),today.getMonth()-i,1);
            const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const entry=points.get(key)||{applied:0,interview:0,label:`${String(d.getMonth()+1).padStart(2,'0')}月`};
            result.push({label:entry.label,applied:entry.applied,interview:entry.interview});
        }
        return result;
    }
    if(granularity==='week'){
        const result=[];
        const startWeek=new Date(today);
        startWeek.setDate(today.getDate()-today.getDay()-7*7);
        startWeek.setHours(0,0,0,0);
        for(let i=0;i<8;i++){
            const bucket=new Date(startWeek);
            bucket.setDate(startWeek.getDate()+i*7);
            const key=bucket.toISOString().split('T')[0];
            const entry=points.get(key)||{applied:0,interview:0,label:`${String(bucket.getMonth()+1).padStart(2,'0')}/${String(bucket.getDate()).padStart(2,'0')}`};
            result.push({label:entry.label,applied:entry.applied,interview:entry.interview});
        }
        return result;
    }
    const result=[];
    const start=new Date(today);
    start.setDate(today.getDate()-27);
    for(let i=0;i<28;i++){
        const bucket=new Date(start);
        bucket.setDate(start.getDate()+i);
        const key=bucket.toISOString().split('T')[0];
        const entry=points.get(key)||{applied:0,interview:0,label:`${String(bucket.getMonth()+1).padStart(2,'0')}/${String(bucket.getDate()).padStart(2,'0')}`};
        result.push({label:entry.label,applied:entry.applied,interview:entry.interview});
    }
    return result;
}

function renderTrendChart(series){
    const target=document.getElementById('trend-chart');
    if(!target)return;
    if(!series.length){
        target.innerHTML='<div class="empty-state compact"><p>暂无趋势</p></div>';
        return;
    }
    const width=560,height=220,pad={t:18,r:14,b:30,l:36};
    const innerW=width-pad.l-pad.r,innerH=height-pad.t-pad.b;
    const maxVal=Math.max(1,...series.map(function(item){return Math.max(item.applied,item.interview);}));
    const stepX=series.length>1?innerW/(series.length-1):0;
    const yFor=function(value){return pad.t+innerH-(value/maxVal)*innerH;};
    const xFor=function(index){return pad.l+index*stepX;};
    const buildPath=function(key){
        return series.map(function(item,index){
            return `${index?'L':'M'} ${xFor(index).toFixed(1)} ${yFor(item[key]).toFixed(1)}`;
        }).join(' ');
    };
    const svg=createSvgEl('svg',{viewBox:`0 0 ${width} ${height}`,class:'trend-chart-svg',preserveAspectRatio:'none'});
    [0,.25,.5,.75,1].forEach(function(tick){
        const y=pad.t+innerH-(innerH*tick);
        svg.appendChild(createSvgEl('line',{x1:pad.l,y1:y,x2:width-pad.r,y2:y,class:'trend-grid-line'}));
        const label=Math.round(maxVal*tick);
        const text=createSvgEl('text',{x:pad.l-8,y:y+4,class:'trend-axis-label','text-anchor':'end'});
        text.textContent=String(label);
        svg.appendChild(text);
    });
    let xTicks=[];
    if(analyticsTrendGranularity==='month'){
        xTicks=series.map(function(_,index){return index;});
    }else if(analyticsTrendGranularity==='week'){
        xTicks=[0,2,4,6,series.length-1].filter(function(v,i,a){
            return v<series.length&&a.indexOf(v)===i;
        });
    }else{
        xTicks=[0,7,14,21,series.length-1].filter(function(v,i,a){
            return v<series.length&&a.indexOf(v)===i;
        });
    }
    xTicks.forEach(function(index){
        const x=xFor(index);
        const text=createSvgEl('text',{x:x,y:height-8,class:'trend-axis-label','text-anchor':'middle'});
        text.textContent=series[index].label;
        svg.appendChild(text);
    });
    const appliedPath=createSvgEl('path',{d:buildPath('applied'),class:'trend-line applied'});
    const interviewPath=createSvgEl('path',{d:buildPath('interview'),class:'trend-line interview'});
    svg.appendChild(appliedPath);
    svg.appendChild(interviewPath);
    ['applied','interview'].forEach(function(key){
        const color=key==='applied'?'#8b5cf6':'#4ade80';
        const last=series[series.length-1];
        svg.appendChild(createSvgEl('circle',{cx:xFor(series.length-1),cy:yFor(last[key]),r:4,fill:color,class:'trend-point'}));
    });
    target.textContent='';
    const shell=createEl('div','trend-chart-shell');
    const topBar=createEl('div','trend-chart-topbar');
    const legend=createEl('div','trend-chart-legend');
    [['投递数','applied'],['面试数','interview']].forEach(function(item){
        const badge=createEl('div','trend-legend-item');
        badge.appendChild(createEl('span',`trend-legend-dot ${item[1]}`));
        badge.appendChild(createEl('span','',item[0]));
        legend.appendChild(badge);
    });
    topBar.appendChild(legend);
    shell.appendChild(topBar);
    shell.appendChild(svg);
    target.appendChild(shell);
}

function renderCityDistributionChart(entries){
    const target=document.getElementById('city-chart');
    if(!target)return;
    if(!entries.length){
        target.innerHTML='<div class="empty-state compact"><p>暂无城市分布</p></div>';
        return;
    }
    const top=entries.slice(0,6);
    const maxValue=Math.max(...top.map(function(entry){return entry.value;}),1);
    target.textContent='';
    const chart=createEl('div','city-chart');
    top.forEach(function(entry,index){
        const item=createEl('div','city-bar-item');
        item.appendChild(createEl('div','city-bar-value',String(entry.value)));
        const col=createEl('div','city-bar-column');
        const bar=createEl('div','city-bar-fill');
        bar.style.height=`${Math.max(18,Math.round(entry.value/maxValue*100))}%`;
        bar.style.background=`linear-gradient(180deg, ${COLORS[index%COLORS.length]}, rgba(99,102,241,.38))`;
        col.appendChild(bar);
        item.appendChild(col);
        item.appendChild(createEl('div','city-bar-label',entry.label));
        chart.appendChild(item);
    });
    target.appendChild(chart);
}

function renderFunnelChart(entries){
    const target=document.getElementById('funnel-chart');
    if(!target)return;
    if(!entries.length){
        target.innerHTML='<div class="empty-state compact"><p>暂无漏斗</p></div>';
        return;
    }
    const topCount=Math.max(entries[0].c,1);
    target.textContent='';
    const wrap=createEl('div','funnel-modern');
    const visual=createEl('div','funnel-visual');
    const svg=createSvgEl('svg',{viewBox:'0 0 360 236',class:'funnel-svg',preserveAspectRatio:'xMidYMid meet'});
    const defs=createSvgEl('defs');
    svg.appendChild(defs);
    const shadow=createSvgEl('filter',{id:'funnelShadow',x:'-40%',y:'-40%',width:'180%',height:'180%'});
    shadow.appendChild(createSvgEl('feDropShadow',{dx:'0',dy:'20',stdDeviation:'18','flood-color':'#05070c','flood-opacity':'0.42'}));
    defs.appendChild(shadow);
    const centerX=156;
    const topY=18;
    const segH=34;
    const gap=7;
    const widths=[236,188,142,102,60];
    svg.appendChild(createSvgEl('path',{
        d:'M 38 18 L 274 18 L 196 223 L 116 223 Z',
        fill:'rgba(255,255,255,.018)',
        stroke:'rgba(255,255,255,.055)',
        'stroke-width':'1'
    }));
    entries.forEach(function(entry,index){
        const nextWidth=widths[index+1]||22;
        const y=topY+index*(segH+gap);
        const topW=widths[index];
        const bottomW=nextWidth;
        const gradient=createSvgEl('linearGradient',{id:`funnelGrad${index}`,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
        gradient.appendChild(createSvgEl('stop',{offset:'0%','stop-color':entry.co,'stop-opacity':'0.98'}));
        gradient.appendChild(createSvgEl('stop',{offset:'56%','stop-color':entry.co,'stop-opacity':'0.76'}));
        gradient.appendChild(createSvgEl('stop',{offset:'100%','stop-color':entry.co,'stop-opacity':'0.5'}));
        defs.appendChild(gradient);
        const sheen=createSvgEl('linearGradient',{id:`funnelSheen${index}`,x1:'0%',y1:'0%',x2:'100%',y2:'0%'});
        sheen.appendChild(createSvgEl('stop',{offset:'0%','stop-color':'#ffffff','stop-opacity':'0.24'}));
        sheen.appendChild(createSvgEl('stop',{offset:'38%','stop-color':'#ffffff','stop-opacity':'0.08'}));
        sheen.appendChild(createSvgEl('stop',{offset:'100%','stop-color':'#ffffff','stop-opacity':'0'}));
        defs.appendChild(sheen);
        const points=[
            `${centerX-topW/2},${y}`,
            `${centerX+topW/2},${y}`,
            `${centerX+bottomW/2},${y+segH}`,
            `${centerX-bottomW/2},${y+segH}`
        ].join(' ');
        svg.appendChild(createSvgEl('polygon',{points:points,fill:`url(#funnelGrad${index})`,class:'funnel-polygon',filter:'url(#funnelShadow)'}));
        svg.appendChild(createSvgEl('polygon',{points:points,fill:`url(#funnelSheen${index})`,opacity:index===0?'.72':'.5'}));
        svg.appendChild(createSvgEl('polygon',{points:points,fill:'none',stroke:'rgba(255,255,255,.14)','stroke-width':'0.9'}));
        svg.appendChild(createSvgEl('line',{
            x1:centerX-topW/2+14,
            y1:y+1,
            x2:centerX+topW/2-14,
            y2:y+1,
            stroke:'rgba(255,255,255,.11)',
            'stroke-width':'1'
        }));
    });
    visual.appendChild(svg);
    const metrics=createEl('div','funnel-metrics');
    const head=createEl('div','funnel-metric-head');
    head.innerHTML='<span>阶段</span><span>数量</span><span>占比</span>';
    metrics.appendChild(head);
    entries.forEach(function(entry){
        const row=createEl('div','funnel-metric-row');
        const nameWrap=createEl('div','funnel-metric-name-wrap');
        const dot=createEl('span','funnel-metric-dot');
        dot.style.background=entry.co;
        nameWrap.appendChild(dot);
        nameWrap.appendChild(createEl('span','funnel-metric-name',entry.l));
        row.appendChild(nameWrap);
        row.appendChild(createEl('strong','funnel-metric-count',String(entry.c)));
        row.appendChild(createEl('strong','funnel-metric-rate',`${Math.round(entry.c/topCount*100)}%`));
        metrics.appendChild(row);
    });
    wrap.appendChild(visual);
    wrap.appendChild(metrics);
    target.appendChild(wrap);
}

function renderCategoryChart(entries){
    const target=document.getElementById('category-chart');
    if(!target)return;
    if(!entries.length){
        target.innerHTML='<div class="empty-state compact"><p>暂无</p></div>';
        return;
    }
    const maxTotal=Math.max(...entries.map(function(entry){return entry.total;}),1);
    target.textContent='';
    const list=createEl('div','category-metric-list');
    const head=createEl('div','category-metric-head');
    head.innerHTML='<span>类别</span><span>推进势能</span><span>投递</span><span>推进</span><span>转化</span>';
    list.appendChild(head);
    entries.forEach(function(entry,index){
        const row=createEl('div','category-metric-row');
        row.appendChild(createEl('div','category-name',entry.label));
        const track=createEl('div','category-bar-wrap');
        const fill=createEl('div','category-bar');
        fill.style.width=`${Math.max(Math.round(entry.total/maxTotal*100),12)}%`;
        fill.style.background=COLORS[index%COLORS.length];
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(createEl('strong','category-metric-count',String(entry.total)));
        row.appendChild(createEl('strong','category-metric-count',String(entry.progress)));
        row.appendChild(createEl('strong','category-stat-rate',`${entry.rate}%`));
        list.appendChild(row);
    });
    target.appendChild(list);
}

function sanitizeAIText(text){
    return String(text||'')
        .replace(/\*/g,'')
        .replace(/\r/g,'')
        .replace(/\n{3,}/g,'\n\n')
        .trim();
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
    return {
        text:sanitizeAIText(fallbackText||'暂时没有可用的分析结果。'),
        mode:'fallback',
        label:'内置数据分析',
        badge:'当前版本仅使用本地内置分析，不会在前端暴露第三方模型密钥。'
    };
}
let curView='pipeline',curTab='info';
let tableQuickEdit=false;
let tableSortColumn='created_at';
let tableSortDirection='desc';
let kanbanSortDirection='desc';
const tableSelectedRows=new Set();
const PROGRESS_STATUSES=['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'];
const INTERVIEW_STATUSES=['ROUND_1','ROUND_2','ROUND_3','ROUND_4'];
const ACTIVE_STATUSES=['APPLIED','OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4'];
const REFLECTION_TEMPLATES={
    OA_TEST:['题型和时间分配是什么','哪类题最不稳','复盘后要补哪一个知识点','下次遇到同类题怎么处理'],
    ROUND_1:['面试官真正考察的能力是什么','哪个项目案例最能支撑这个岗位','回答里最弱的一段是什么','下次开头、案例和结论怎么调整'],
    ROUND_2:['这一轮更关注业务判断还是协作深度','对方追问集中在哪个细节','哪个决策或指标没有讲透','下次如何把取舍和结果讲得更稳'],
    ROUND_3:['高层或负责人最关心的风险是什么','你的长期匹配度有没有讲清楚','哪个回答缺少商业结果','下次要补哪类证据'],
    ROUND_4:['最终轮最关键的判断点是什么','薪资、意愿和稳定性有没有表达清楚','还有哪个顾虑没有解除','后续跟进时要强调什么'],
    GROUP:['组内分工和你的角色是什么','你在哪个节点推动了讨论','有没有抢话或沉默的问题','下次如何更自然地建立影响力'],
    HR:['动机、薪资、时间和稳定性表达是否一致','哪些问题回答得过于模糊','对公司和岗位的意愿有没有落地','后续沟通要补充什么']
};

function todayKey(){
    return new Date().toISOString().split('T')[0];
}

function addDaysKey(days){
    const d=new Date();
    d.setDate(d.getDate()+days);
    return d.toISOString().split('T')[0];
}

function isProgressStatus(status){
    return PROGRESS_STATUSES.includes(status);
}

function isInterviewStatus(status){
    return INTERVIEW_STATUSES.includes(status);
}

function isActiveStatus(status){
    return ACTIVE_STATUSES.includes(status);
}

function getFollowupState(app){
    if(!app||!isActiveStatus(app.status))return null;
    const today=todayKey();
    if(app.next_followup_date&&app.next_followup_date<=today)return{type:'due',label:'待跟进'};
    const wait=getWait(app);
    if(wait!==null&&wait>=7&&!app.last_followup_date)return{type:'stale',label:`${wait}天无反馈`};
    return null;
}

function getResumePerformance(resumeId){
    const linked=store.apps.filter(a=>a.resume_id===resumeId);
    const progressed=linked.filter(a=>isProgressStatus(a.status));
    const interviews=linked.filter(a=>isInterviewStatus(a.status)||a.status==='OFFER');
    const offers=linked.filter(a=>a.status==='OFFER');
    return {linked:linked.length,progress:progressed.length,interviews:interviews.length,offers:offers.length};
}

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
    const href=safeHttpUrl(app.source_link);
    if(href){
        const link=document.createElement('a');
        link.className='source-link';
        link.href=href;
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
        filterCol.textContent='';
        const placeholder=document.createElement('option');
        placeholder.value='';
        placeholder.textContent='筛选列';
        filterCol.appendChild(placeholder);
        cols.filter(c=>c.id!=='jd').forEach(function(col){
            const option=document.createElement('option');
            option.value=col.id;
            option.textContent=col.label;
            filterCol.appendChild(option);
        });
        filterCol.value=cols.some(c=>c.id===prev)?prev:'';
    }
    if(sortCol){
        const prevSort=tableSortColumn;
        if(prevSort!=='created_at'&&!cols.some(c=>c.id===prevSort))tableSortColumn='created_at';
        sortCol.textContent='';
        const defaultOption=document.createElement('option');
        defaultOption.value='created_at';
        defaultOption.textContent='默认排序';
        sortCol.appendChild(defaultOption);
        cols.filter(c=>c.id!=='jd').forEach(function(col){
            const option=document.createElement('option');
            option.value=col.id;
            option.textContent=col.label;
            sortCol.appendChild(option);
        });
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
function initSidebarBrand(){
    const brand=document.getElementById('sidebar-brand');
    if(!brand||brand.dataset.bound==='1')return;
    brand.dataset.bound='1';
    const prefersReducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion)return;
    let rafId=0;
    let targetX=0;
    let targetY=0;
    let currentX=0;
    let currentY=0;
    function render(){
        currentX+=(targetX-currentX)*0.18;
        currentY+=(targetY-currentY)*0.18;
        brand.style.setProperty('--brand-shift-x',`${currentX*5}px`);
        brand.style.setProperty('--brand-shift-y',`${currentY*5}px`);
        brand.style.setProperty('--brand-tilt-x',`${currentX*8}deg`);
        brand.style.setProperty('--brand-tilt-y',`${-currentY*8}deg`);
        if(Math.abs(targetX-currentX)>0.01||Math.abs(targetY-currentY)>0.01){
            rafId=requestAnimationFrame(render);
        }else{
            rafId=0;
        }
    }
    function queueRender(){
        if(!rafId)rafId=requestAnimationFrame(render);
    }
    brand.addEventListener('pointermove',function(e){
        const rect=brand.getBoundingClientRect();
        const px=(e.clientX-rect.left)/rect.width-.5;
        const py=(e.clientY-rect.top)/rect.height-.5;
        targetX=Math.max(-1,Math.min(1,px));
        targetY=Math.max(-1,Math.min(1,py));
        queueRender();
    });
    brand.addEventListener('pointerleave',function(){
        targetX=0;
        targetY=0;
        queueRender();
    });
    brand.addEventListener('blur',function(){
        targetX=0;
        targetY=0;
        queueRender();
    },true);
}
function switchView(v){
    curView=v;$$('.view').forEach(x=>x.classList.remove('active'));$$('.nav-item[data-view]').forEach(x=>x.classList.remove('active'));
    const vm={pipeline:'view-pipeline',table:'view-table',resumes:'view-resumes',reflections:'view-reflections',calendar:'view-calendar',analytics:'view-analytics'};
    const tm={pipeline:'投递看板',table:'表格视图',resumes:'简历文件舱',reflections:'复盘记录',calendar:'日历',analytics:'数据大屏'};
    $(`#${vm[v]}`)?.classList.add('active');$(`.nav-item[data-view="${v}"]`)?.classList.add('active');
    $('#view-title').textContent=tm[v]||'';$('#view-subtitle').textContent=v==='pipeline'?`${store.apps.length} 条投递`:'';
    if(v==='pipeline')renderKanban();else if(v==='table')renderTable();else if(v==='resumes')renderResumes();else if(v==='reflections')renderRefs();else if(v==='calendar'&&typeof renderCalendar==='function')renderCalendar();else if(v==='analytics')renderAnalytics();
    if(window.rtAnalytics&&typeof window.rtAnalytics.capture==='function'){
        window.rtAnalytics.capture('rt_view_changed',getAnalyticsBaseProps({
            view:v,
            application_count:store.apps.length,
            resume_count:store.resumes.length,
            reflection_count:store.refs.length
        }));
    }
}
$$('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
initSidebarBrand();
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
    selEl.textContent='';
    const placeholder=document.createElement('option');
    placeholder.value='';
    placeholder.textContent='选择类别';
    selEl.appendChild(placeholder);
    store.categories.forEach(function(c){
        const option=document.createElement('option');
        option.value=c;
        option.selected=val===c;
        option.textContent=c;
        selEl.appendChild(option);
    });
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
    let ddl='';if(a.next_deadline){const dl=daysBtw(new Date().toISOString().split('T')[0],a.next_deadline.split('T')[0]);ddl=`<div class="card-ddl ${dl<=3?'urgent':''}"><span>DDL</span><strong>${fmtD(a.next_deadline)}</strong>${a.next_action?`<em>${escapeHTML(a.next_action)}</em>`:''}</div>`;}
    const dateStr=a.applied_date?fmtD(a.applied_date):'';
    const chips=[
        a.position_category?`<span class="card-chip">${escapeHTML(a.position_category)}</span>`:'',
        a.base_location?`<span class="card-chip subtle">${escapeHTML(a.base_location)}</span>`:'',
        a.source_channel?`<span class="card-chip subtle">${escapeHTML(a.source_channel)}</span>`:''
    ].filter(Boolean).join('');
    const followup=getFollowupState(a);
    c.innerHTML=`<div class="card-top"><div class="card-logo">${ini(a.company_name)}</div><div class="card-info"><div class="card-company">${escapeHTML(a.company_name)}</div><div class="card-position">${escapeHTML(a.position_title)}</div></div><div class="card-chevron">›</div></div><div class="card-chips">${chips}${followup?`<span class="card-chip followup">${escapeHTML(followup.label)}</span>`:''}</div><div class="card-meta"><span class="card-stars">${stars(a.preference_level)}</span>${dateStr?`<span class="card-date">${dateStr}</span>`:''}${w!==null?`<span class="card-wait ${wc}">${w}天</span>`:''}${sv?`<span class="card-visa ${vi.cls}">${escapeHTML(vi.label)}</span>`:''}</div>${r?`<div class="card-resume">已关联简历 · ${escapeHTML(r.file_name)}</div>`:''}${ddl}`;
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
        wrap.appendChild(createEl('span','',col.label));
        if(tableSortColumn===col.id)wrap.appendChild(createEl('span','table-sort-indicator',tableSortDirection==='asc'?'↑':'↓'));
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
            const td=document.createElement('td');
            td.colSpan=spanCols;
            td.style.cssText='font-weight:600;color:var(--text-primary);background:var(--bg-tertiary);padding:6px 10px;font-size:11px';
            td.textContent=`${g} (${items.length})`;
            gr.appendChild(td);
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
            case'jd':{const jdHref=safeHttpUrl(a.jd_url);if(jdHref){const link=document.createElement('a');link.className='jd-link-btn';link.href=jdHref;link.target='_blank';link.rel='noreferrer noopener';link.textContent='🔗';link.addEventListener('click',function(e){e.stopPropagation();});td.appendChild(link);}else if(a.jd_image){td.innerHTML=`<span class="jd-img-btn">🖼</span>`;td.querySelector('.jd-img-btn').addEventListener('click',e=>{e.stopPropagation();$('#jd-preview-img').src=a.jd_image;$('#jd-preview-overlay').classList.add('active');});}else td.textContent='—';break;}
            case'actions':td.innerHTML=`<button class="td-action-btn" title="查看详情">✏️</button>`;td.querySelector('button').addEventListener('click',e=>{e.stopPropagation();openDrawer(a.id);});break;
        }
        tr.appendChild(td);
    });
    tr.addEventListener('click',function(){if(!tableQuickEdit)openDrawer(a.id);});
    return tr;
}
function inlineEdit(td,a,f,custom=false){const old=custom?(a.customFields?.[f]||''):(a[f]||'');const inp=document.createElement('input');inp.type='text';inp.className='inline-edit';inp.value=old;td.textContent='';td.appendChild(inp);inp.focus();inp.select();const sv=async ()=>{const v=inp.value.trim();if(custom){const nextFields=Object.assign({},a.customFields||{}, {[f]:v});const ok=await store.updateApp(a.id,{customFields:nextFields});if(ok===false)return renderTable($('#global-search').value.toLowerCase().trim());}else if(v!==old){if(f==='position_category'&&v){const added=await store.addCat(v);if(!added)return renderTable($('#global-search').value.toLowerCase().trim());}const ok=await store.updateApp(a.id,{[f]:v});if(ok===false)return renderTable($('#global-search').value.toLowerCase().trim());}renderTable($('#global-search').value.toLowerCase().trim());};inp.addEventListener('blur',sv);inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sv();}if(e.key==='Escape')renderTable($('#global-search').value.toLowerCase().trim());});}
function inlineCatSel(td,a){const sel=document.createElement('select');sel.className='inline-select';const empty=document.createElement('option');empty.value='';empty.textContent='选择';sel.appendChild(empty);store.categories.forEach(function(c){const option=document.createElement('option');option.value=c;option.selected=a.position_category===c;option.textContent=c;sel.appendChild(option);});const addNew=document.createElement('option');addNew.value='__NEW__';addNew.textContent='+ 新增类别...';sel.appendChild(addNew);td.textContent='';td.appendChild(sel);sel.focus();sel.addEventListener('change',async ()=>{if(sel.value==='__NEW__'){const name=prompt('输入新类别名称：');if(name&&name.trim()){const added=await store.addCat(name.trim());if(!added)return renderTable($('#global-search').value.toLowerCase().trim());const ok=await store.updateApp(a.id,{position_category:name.trim()});if(ok!==false)initFilters();}renderTable($('#global-search').value.toLowerCase().trim());}else if(sel.value){const ok=await store.updateApp(a.id,{position_category:sel.value});if(ok!==false)renderTable($('#global-search').value.toLowerCase().trim());}});sel.addEventListener('blur',()=>renderTable($('#global-search').value.toLowerCase().trim()));}
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
function renderJdDropzone(imageSrc){
    jdZ.textContent='';
    if(imageSrc){
        const img=document.createElement('img');
        img.src=imageSrc;
        jdZ.appendChild(img);
        jdZ.classList.add('has-image');
        return;
    }
    jdZ.appendChild(createEl('span','jd-paste-hint','点击后粘贴截图或拖拽图片'));
    jdZ.classList.remove('has-image');
}
jdZ.addEventListener('click',()=>jdZ.focus());
jdZ.addEventListener('paste',e=>{const items=e.clipboardData?.items;if(!items)return;for(let i=0;i<items.length;i++){if(items[i].type.startsWith('image/')){e.preventDefault();const rd=new FileReader();rd.onload=ev=>{jdImg=ev.target.result;renderJdDropzone(jdImg);};rd.readAsDataURL(items[i].getAsFile());return;}}});
jdZ.addEventListener('dragover',e=>e.preventDefault());
jdZ.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f?.type.startsWith('image/')){const rd=new FileReader();rd.onload=ev=>{jdImg=ev.target.result;renderJdDropzone(jdImg);};rd.readAsDataURL(f);}});
let editId=null;
function syncTimelineFromForm(oldTimeline,status,appliedDate,statusDate){
    const nextTimeline=sortTimeline(oldTimeline||[]);
    const appliedValue=appliedDate||'';
    const appliedEntry=nextTimeline.find(item=>item.name==='已投递');
    if(appliedValue){
        if(appliedEntry)appliedEntry.date=appliedValue;
        else nextTimeline.push({name:'已投递',date:appliedValue});
    }
    const timelineName=getTimelineNameForStatus(status);
    if(status&&status!=='WATCHING'&&status!=='APPLIED'&&timelineName){
        const resolvedStatusDate=statusDate||appliedValue||new Date().toISOString().split('T')[0];
        const previousStatus=deriveStatus(oldTimeline||[]);
        const sameStageEntries=nextTimeline.filter(item=>item.name===timelineName);
        const latestSameStage=sameStageEntries.length?sortTimeline(sameStageEntries).at(-1):null;
        if(previousStatus===status&&latestSameStage){
            latestSameStage.date=resolvedStatusDate;
        }else if(!nextTimeline.some(item=>item.name===timelineName&&item.date===resolvedStatusDate)){
            nextTimeline.push({name:timelineName,date:resolvedStatusDate});
        }
    }
    return sortTimeline(nextTimeline);
}
function getStatusDateForApp(app){
    if(!app)return'';
    if(app.current_status_date)return app.current_status_date;
    const latest=getLatestTimelineEntry(app.timeline||[]);
    return latest?.date||app.applied_date||'';
}
function setFieldValue(id,value){
    const element=$(id);
    if(element)element.value=value??'';
}
function openAppModal(id=null,defSt='APPLIED'){editId=id;const a=id?store.getApp(id):null;$('#modal-title').textContent=a?'编辑投递':'新建投递';$('#form-company').value=a?.company_name||'';$('#form-position').value=a?.position_title||'';fillCatSelect($('#form-category'),a?.position_category||'');$('#form-status').value=a?.status||defSt;$('#form-status-date').value=getStatusDateForApp(a)||(a?.applied_date||new Date().toISOString().split('T')[0]);$('#form-date').value=a?.applied_date||new Date().toISOString().split('T')[0];$('#form-base').value=a?.base_location||'';$('#form-preference').value=a?.preference_level||'3';$('#form-visa').value=a?.visa_requirement||'UNKNOWN';$('#form-channel').value=a?.source_channel||'';$('#form-channel-link').value=a?.source_link||'';$('#form-salary').value=a?.salary_expectation||'';$('#form-next-action').value=a?.next_action||'';$('#form-deadline').value=a?.next_deadline||'';setFieldValue('#form-contact',a?.contact_name||'');setFieldValue('#form-next-followup',a?.next_followup_date||'');setFieldValue('#form-last-followup',a?.last_followup_date||'');setFieldValue('#form-followup-note',a?.followup_note||'');$('#form-jd-url').value=a?.jd_url||'';$('#form-notes').value=a?.notes||'';jdImg=a?.jd_image||null;renderJdDropzone(jdImg);const rs=$('#form-resume');rs.textContent='';const emptyOpt=document.createElement('option');emptyOpt.value='';emptyOpt.textContent='不绑定';rs.appendChild(emptyOpt);store.resumes.forEach(r=>{const opt=document.createElement('option');opt.value=r.id;opt.selected=a?.resume_id===r.id;opt.textContent=r.file_name;rs.appendChild(opt);});
// 渲染自定义字段
const cfa=$('#custom-fields-area');cfa.innerHTML='';
const customCols=store.tableCols.filter(c=>c.custom);
if(customCols.length){customCols.forEach(col=>{const val=a?.customFields?.[col.id]||'';const group=createEl('div','form-group');group.appendChild(createEl('label','',col.label));const input=document.createElement('input');input.type='text';input.className='custom-field-input';input.dataset.colId=col.id;input.value=val;input.placeholder=`输入${col.label}...`;group.appendChild(input);cfa.appendChild(group);});}
updIntl();$('#modal-overlay').classList.add('active');}
async function saveApp(cont=false){const co=$('#form-company').value.trim(),po=$('#form-position').value.trim(),ca=$('#form-category').value;if(!co||!po||!ca){toast('请填写公司、岗位和类别','error');return;}const selectedStatus=$('#form-status').value||'APPLIED';const statusDate=$('#form-status-date').value||'';const appliedDate=$('#form-date').value;if(!appliedDate){toast('请填写投递日期','error');return;}if(selectedStatus!=='WATCHING'&&!statusDate){toast('请填写当前状态日期','error');return;}const rawSourceLink=$('#form-channel-link').value.trim();const normalizedSourceLink=rawSourceLink&&!/^https?:\/\//i.test(rawSourceLink)?('https://'+rawSourceLink):rawSourceLink;const d={company_name:co,position_title:po,position_category:ca,base_location:$('#form-base').value.trim(),applied_date:appliedDate,current_status_date:statusDate||appliedDate,resume_id:$('#form-resume').value||null,preference_level:$('#form-preference').value,visa_requirement:$('#form-visa').value,source_channel:$('#form-channel').value.trim(),source_link:normalizedSourceLink,salary_expectation:$('#form-salary').value,next_action:$('#form-next-action').value,next_deadline:$('#form-deadline').value,contact_name:$('#form-contact')?.value.trim()||'',next_followup_date:$('#form-next-followup')?.value||'',last_followup_date:$('#form-last-followup')?.value||'',followup_note:$('#form-followup-note')?.value.trim()||'',jd_url:$('#form-jd-url').value,jd_image:jdImg,notes:$('#form-notes').value,status:selectedStatus};
// 收集自定义字段
const cf={};$$('.custom-field-input').forEach(inp=>{cf[inp.dataset.colId]=inp.value.trim();});if(Object.keys(cf).length)d.customFields=cf;
if(editId){const old=store.getApp(editId);d.customFields=Object.assign({},old?.customFields||{},cf);
        d.timeline=syncTimelineFromForm(old?.timeline||[],selectedStatus,appliedDate,statusDate);
        const timelineError=validateTimelineChronology(d.timeline);
        if(timelineError){toast(timelineError,'error');return;}
        d.status=deriveStatus(d.timeline);
        d.current_status_date=getLatestTimelineEntry(d.timeline)?.date||statusDate||appliedDate;
const ok=await store.updateApp(editId,d);if(!ok){toast('保存失败，请重试','error');return;}toast('已更新','success');}else{d.timeline=syncTimelineFromForm([],selectedStatus,appliedDate,statusDate);const timelineError=validateTimelineChronology(d.timeline);if(timelineError){toast(timelineError,'error');return;}d.status=deriveStatus(d.timeline);d.current_status_date=getLatestTimelineEntry(d.timeline)?.date||statusDate||appliedDate;d.customFields=cf;const ok=await store.addApp(d);if(!ok){toast('保存失败，请重试','error');return;}toast('已创建','success');}if(cont){editId=null;$('#form-company').value='';$('#form-position').value='';$('#form-company').focus();}else{$('#modal-overlay').classList.remove('active');editId=null;}refresh();}
$('#add-application-btn').addEventListener('click',()=>openAppModal());
$('#modal-save').addEventListener('click',()=>saveApp(false));
$('#modal-save-continue').addEventListener('click',()=>saveApp(true));
$('#modal-cancel').addEventListener('click',()=>{$('#modal-overlay').classList.remove('active');editId=null;});
$('#modal-close').addEventListener('click',()=>{$('#modal-overlay').classList.remove('active');editId=null;});
$('#form-status')?.addEventListener('change',function(){
    if(this.value==='APPLIED'){
        $('#form-status-date').value=$('#form-date').value||$('#form-status-date').value;
    }
});
$('#form-date')?.addEventListener('change',function(){
    if($('#form-status').value==='APPLIED'){
        $('#form-status-date').value=this.value;
    }
});

// ---- 侧边栏（时间线可编辑，自定义轮次）----
let curDId=null,tlEditing=false;
function openDrawer(id){curDId=id;tlEditing=false;const a=store.getApp(id);if(!a)return;const si=getSI(a.status);$('#drawer-logo').textContent=ini(a.company_name);$('#drawer-company').textContent=a.company_name;$('#drawer-position').textContent=a.position_title;$('#drawer-status').className=`status-badge ${si.cls}`;$('#drawer-status').textContent=si.label;const w=getWait(a);$('#drawer-meta').textContent=w!==null?`等待${w}天 · ${fmtD(a.applied_date)}`:`${fmtD(a.applied_date)}`;renderDInfo(a);renderDTL(a);renderDRefs(a);$$('.drawer-tab').forEach(t=>t.classList.remove('active'));$$('.drawer-tab-content').forEach(t=>t.classList.remove('active'));$('.drawer-tab[data-tab="info"]').classList.add('active');$('#tab-info').classList.add('active');curTab='info';updDActions();$('#drawer-overlay').classList.add('active');}
function renderDInfo(a){
    const info=$('#tab-info');
    info.innerHTML='';
    const followupState=getFollowupState(a);
    const fields=[
        {label:'岗位类别',text:a.position_category||'—'},
        {label:'Base地',text:a.base_location||'—'},
        {label:'当前阶段日期',text:a.current_status_date?fmtD(a.current_status_date):'—'},
        {label:'偏好度',text:stars(a.preference_level)},
        {label:'渠道',text:a.source_channel||'—',link:safeHttpUrl(a.source_link),linkText:a.source_channel||a.source_link},
        {label:'薪资',text:a.salary_expectation||'—'},
        {label:'下一步',text:a.next_action||'—'},
        {label:'DDL',text:a.next_deadline?fmtDT(a.next_deadline):'—'},
        {label:'联系人',text:a.contact_name||'—'},
        {label:'下次跟进',text:a.next_followup_date?fmtD(a.next_followup_date):'—'},
        {label:'跟进备注',text:a.followup_note||followupState?.label||'—'},
        {label:'JD',text:a.jd_url||'—',link:safeHttpUrl(a.jd_url),linkText:a.jd_url},
        {label:'备注',text:a.notes||'—'}
    ];
    if(store.settings.intlMode)fields.splice(3,0,{label:'工签',text:(VISA_MAP[a.visa_requirement]||{}).label||'—'});
    const res=a.resume_id?store.getResume(a.resume_id):null;
    if(res)fields.splice(2,0,{label:'简历',text:`📎 ${res.file_name}`});
    fields.forEach(function(field){
        const row=createEl('div','info-field');
        row.appendChild(createEl('div','info-label',field.label));
        const value=createEl('div','info-value');
        if(field.link){
            const link=document.createElement('a');
            link.href=field.link;
            link.target='_blank';
            link.rel='noopener noreferrer';
            link.style.color='var(--blue)';
            link.textContent=field.linkText||field.link;
            value.appendChild(link);
        }else{
            value.textContent=field.text;
        }
        row.appendChild(value);
        info.appendChild(row);
    });
    if(a.jd_image){
        const row=createEl('div','info-field');
        row.appendChild(createEl('div','info-label','JD截图'));
        const value=createEl('div','info-value');
        const img=document.createElement('img');
        img.src=a.jd_image;
        img.style.cssText='max-width:100%;border-radius:6px;cursor:pointer';
        img.addEventListener('click',function(){
            document.getElementById('jd-preview-img').src=this.src;
            document.getElementById('jd-preview-overlay').classList.add('active');
        });
        value.appendChild(img);
        row.appendChild(value);
        info.appendChild(row);
    }
}
function renderDTL(a,edit=false){
    const tl=$('#tab-timeline');tl.innerHTML='';
    const timeline=sortTimeline(a.timeline||[]);
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
            const nextTimeline=sortTimeline(timeline);
            $$('#tl-edit select, #tl-edit input').forEach(el=>{const i=parseInt(el.dataset.i),f=el.dataset.f;if(!isNaN(i)&&nextTimeline[i])nextTimeline[i][f]=el.value;});
            const orderedTimeline=sortTimeline(nextTimeline);
            const timelineError=validateTimelineChronology(orderedTimeline);
            if(timelineError){toast(timelineError,'error');return;}
            // 从时间线推导状态
            const newStatus=deriveStatus(orderedTimeline);
            // 同步"已投递"日期到 applied_date
            const appliedEntry=orderedTimeline.find(t=>t.name==='已投递');
            const latestEntry=getLatestTimelineEntry(orderedTimeline);
            const updates={timeline:orderedTimeline,status:newStatus,current_status_date:latestEntry?.date||a.current_status_date||a.applied_date||''};
            if(appliedEntry&&appliedEntry.date)updates.applied_date=appliedEntry.date;
            const ok=await store.updateApp(a.id,updates);
            if(ok===false)return;
            a.timeline=orderedTimeline;
            a.status=newStatus;
            a.current_status_date=updates.current_status_date;
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
            const dc=item.name==='Offer'?'active':(item.name==='挂了'||item.name==='未通过'||item.name==='流程终止')?'rejected':'';
            tl.innerHTML+=`<div class="timeline-item"><div class="timeline-dot ${dc}"></div><div class="timeline-content"><div class="timeline-status">${item.name}</div><div class="timeline-time">${item.date?fmtD(item.date):'—'}</div></div></div>`;
        });
    }
}
function renderDRefs(a){
    const rt=$('#tab-reflections');
    const refs=store.getAppRefs(a.id);
    rt.innerHTML=refs.length?'':'<div class="empty-state"><p>暂无复盘</p></div>';
    refs.forEach(function(ref){
        const c=buildReflectionCard(ref,false);
        c.style.marginBottom='8px';
        c.addEventListener('click',()=>openRefModal(ref.id));
        rt.appendChild(c);
    });
}
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
function renderResumeStats(){
    const statsEl=$('#resumes-stats');
    if(!statsEl)return;
    const total=store.resumes.length;
    statsEl.innerHTML=total?`<span class="resume-stat-pill"><strong>${total}</strong> 份简历</span>`:'';
}

const resumePreviewUrls=new Set();

async function makeResumePreviewUrl(dataUrl){
    const response=await fetch(dataUrl);
    if(!response.ok)throw new Error('preview fetch failed');
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    resumePreviewUrls.add(url);
    return url;
}

function releaseResumePreviewUrl(url,delay){
    setTimeout(function(){
        if(!resumePreviewUrls.has(url))return;
        URL.revokeObjectURL(url);
        resumePreviewUrls.delete(url);
    },delay||120000);
}

async function openResumePreview(resume){
    if(!resume?.data_url){
        toast('无预览数据，请重新上传','error');
        return;
    }
    const type=(resume.file_type||'').toUpperCase();
    if(type!=='PDF'){
        const link=document.createElement('a');
        link.href=resume.data_url;
        link.download=resume.orig||`${resume.file_name||'resume'}.docx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast('当前仅支持 PDF 直接预览，已为你下载文件','info');
        return;
    }
    const popup=window.open('','_blank');
    if(!popup){
        toast('浏览器拦截了预览窗口，请允许弹窗后重试','error');
        return;
    }
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(resume.file_name||'简历预览')}</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;height:100%;background:#0a0a0c;color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Display\",\"PingFang SC\",sans-serif}body{display:flex;align-items:center;justify-content:center}p{font-size:14px;color:#a1a1aa}</style></head><body><p>正在打开简历预览...</p></body></html>`);
    popup.document.close();
    try{
        const previewUrl=await makeResumePreviewUrl(resume.data_url);
        popup.location.replace(previewUrl);
        releaseResumePreviewUrl(previewUrl);
    }catch(err){
        popup.document.body.innerHTML='<p>预览打开失败，请重新上传这份简历后再试。</p>';
        console.error('[RT resume] preview failed',err);
        toast('预览打开失败，请重试','error');
    }
}

const resumeRailState={dragging:false,startX:0,startScrollLeft:0,moved:false,justDragged:false};
const resumeReorderState={active:false,draggingId:null,card:null,placeholder:null,grid:null,ghost:null,startX:0,startY:0,lastClientX:0,lastClientY:0,pointerOffsetX:0,pointerOffsetY:0,targetGhostX:0,targetGhostY:0,currentGhostX:0,currentGhostY:0,lastSwapTrackX:0,lastSwapAt:0,lastSwapDirection:0,swapStreak:0,ghostFrame:0,moved:false,autoScrollFrame:0,justReorderedUntil:0};

function getOrderedResumes(){
    return [...store.resumes].sort(function(a,b){
        const aOrder=Number.isFinite(a.sort_order)?a.sort_order:store.resumes.indexOf(a);
        const bOrder=Number.isFinite(b.sort_order)?b.sort_order:store.resumes.indexOf(b);
        if(aOrder!==bOrder)return aOrder-bOrder;
        return new Date(a.at||0)-new Date(b.at||0);
    });
}

function clearResumeDropMarkers(){
    $$('.resume-card, .resume-drop-slot').forEach(function(card){
        card.classList.remove('drop-before','drop-after','is-placeholder');
    });
}

function stopResumeGhostAnimation(){
    if(!resumeReorderState.ghostFrame)return;
    cancelAnimationFrame(resumeReorderState.ghostFrame);
    resumeReorderState.ghostFrame=0;
}

function stopResumeAutoScroll(){
    if(!resumeReorderState.autoScrollFrame)return;
    cancelAnimationFrame(resumeReorderState.autoScrollFrame);
    resumeReorderState.autoScrollFrame=0;
}

function tickResumeAutoScroll(){
    const grid=resumeReorderState.grid||$('#resumes-grid');
    if(!grid||!resumeReorderState.active){
        stopResumeAutoScroll();
        return;
    }
    const rect=grid.getBoundingClientRect();
    const edge=104;
    let delta=0;
    if(resumeReorderState.lastClientX<rect.left+edge){
        const ratio=(rect.left+edge-resumeReorderState.lastClientX)/edge;
        delta=-(8+Math.round(Math.min(1,ratio)*12));
    }else if(resumeReorderState.lastClientX>rect.right-edge){
        const ratio=(resumeReorderState.lastClientX-(rect.right-edge))/edge;
        delta=8+Math.round(Math.min(1,ratio)*12);
    }
    if(delta!==0){
        grid.scrollLeft+=delta;
        placeResumeCardByPointer(resumeReorderState.lastClientX);
    }
    resumeReorderState.autoScrollFrame=requestAnimationFrame(tickResumeAutoScroll);
}

function ensureResumeAutoScroll(){
    if(resumeReorderState.autoScrollFrame)return;
    resumeReorderState.autoScrollFrame=requestAnimationFrame(tickResumeAutoScroll);
}

function updateResumeDropMarkers(){
    clearResumeDropMarkers();
    const placeholder=resumeReorderState.placeholder;
    if(!placeholder)return;
    placeholder.classList.add('is-placeholder');
    if(placeholder.previousElementSibling)placeholder.previousElementSibling.classList.add('drop-after');
    else if(placeholder.nextElementSibling)placeholder.nextElementSibling.classList.add('drop-before');
}

function positionResumeGhost(){
    const ghost=resumeReorderState.ghost;
    if(!ghost)return;
    const targetX=resumeReorderState.targetGhostX;
    const targetY=resumeReorderState.targetGhostY;
    const nextX=resumeReorderState.currentGhostX+(targetX-resumeReorderState.currentGhostX)*0.17;
    const nextY=resumeReorderState.currentGhostY+(targetY-resumeReorderState.currentGhostY)*0.17;
    resumeReorderState.currentGhostX=nextX;
    resumeReorderState.currentGhostY=nextY;
    const vx=targetX-nextX;
    const tilt=Math.max(-1.4,Math.min(1.4,vx*.02));
    ghost.style.transform=`translate3d(${nextX}px,${nextY}px,0) scale(1.016) rotate(${tilt}deg)`;
    if(Math.abs(targetX-nextX)>0.4||Math.abs(targetY-nextY)>0.4){
        resumeReorderState.ghostFrame=requestAnimationFrame(positionResumeGhost);
    }else{
        resumeReorderState.currentGhostX=targetX;
        resumeReorderState.currentGhostY=targetY;
        ghost.style.transform=`translate3d(${targetX}px,${targetY}px,0) scale(1.016) rotate(0deg)`;
        resumeReorderState.ghostFrame=0;
    }
}

function setResumeGhostTarget(clientX,clientY){
    resumeReorderState.targetGhostX=clientX-resumeReorderState.pointerOffsetX;
    resumeReorderState.targetGhostY=clientY-resumeReorderState.pointerOffsetY;
    if(!resumeReorderState.ghostFrame)resumeReorderState.ghostFrame=requestAnimationFrame(positionResumeGhost);
}

function animateResumeRailReflow(grid,mutate){
    const cards=[...grid.querySelectorAll('.resume-card')];
    const firstRects=new Map(cards.map(function(card){return[card.dataset.resumeId,card.getBoundingClientRect()];}));
    mutate();
    const nextCards=[...grid.querySelectorAll('.resume-card')];
    nextCards.forEach(function(card){
        const first=firstRects.get(card.dataset.resumeId);
        if(!first)return;
        const last=card.getBoundingClientRect();
        const dx=first.left-last.left;
        const dy=first.top-last.top;
        if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
        card.style.transition='none';
        card.style.transform=`translate3d(${dx}px,${dy}px,0)`;
        card.getBoundingClientRect();
        requestAnimationFrame(function(){
            card.style.transition='transform 420ms cubic-bezier(.18,.88,.24,1)';
            card.style.transform='';
            const cleanup=function(){
                card.style.transition='';
                card.removeEventListener('transitionend',cleanup);
            };
            card.addEventListener('transitionend',cleanup);
        });
    });
}

function placeResumeCardByPointer(clientX){
    const grid=resumeReorderState.grid;
    const placeholder=resumeReorderState.placeholder;
    if(!grid||!placeholder)return;
    const placeholderRect=placeholder.getBoundingClientRect();
    const ghostLeft=clientX-resumeReorderState.pointerOffsetX;
    const ghostCenter=ghostLeft+placeholderRect.width/2;
    const pointerTrackX=clientX+grid.scrollLeft;
    const now=Date.now();
    const swapCooldown=now-resumeReorderState.lastSwapAt;
    const swapTravel=pointerTrackX-resumeReorderState.lastSwapTrackX;
    const direction=swapTravel===0?0:(swapTravel>0?1:-1);
    const continuingSameDirection=direction!==0&&direction===resumeReorderState.lastSwapDirection;
    const streak=continuingSameDirection?resumeReorderState.swapStreak:0;
    const previous=placeholder.previousElementSibling;
    const next=placeholder.nextElementSibling;
    if(previous){
        const prevRect=previous.getBoundingClientRect();
        const prevThreshold=prevRect.left+prevRect.width*(0.44-(Math.min(streak,3)*0.03));
        const minSwapTravel=34+(continuingSameDirection?streak*22:0);
        if(ghostCenter<prevThreshold&&swapTravel<-minSwapTravel&&swapCooldown>(continuingSameDirection?105:72)){
            animateResumeRailReflow(grid,function(){
                grid.insertBefore(placeholder,previous);
                updateResumeDropMarkers();
            });
            resumeReorderState.lastSwapTrackX=pointerTrackX;
            resumeReorderState.lastSwapAt=now;
            resumeReorderState.lastSwapDirection=-1;
            resumeReorderState.swapStreak=continuingSameDirection?streak+1:1;
            return;
        }
    }
    if(next){
        const nextRect=next.getBoundingClientRect();
        const nextThreshold=nextRect.left+nextRect.width*(0.485+(Math.min(streak,3)*0.08));
        const minSwapTravel=8+(continuingSameDirection?streak*42:0);
        if(ghostCenter>nextThreshold&&swapTravel>minSwapTravel&&swapCooldown>(continuingSameDirection?142:38)){
            animateResumeRailReflow(grid,function(){
                grid.insertBefore(placeholder,next.nextElementSibling);
                updateResumeDropMarkers();
            });
            resumeReorderState.lastSwapTrackX=pointerTrackX;
            resumeReorderState.lastSwapAt=now;
            resumeReorderState.lastSwapDirection=1;
            resumeReorderState.swapStreak=continuingSameDirection?streak+1:1;
            return;
        }
    }
    if(direction!==resumeReorderState.lastSwapDirection&&Math.abs(swapTravel)>14){
        resumeReorderState.swapStreak=0;
    }
    updateResumeDropMarkers();
}

function beginResumeReorder(card,id,e){
    const grid=$('#resumes-grid');
    if(!grid||resumeReorderState.active)return;
    const rect=card.getBoundingClientRect();
    const ghost=card.cloneNode(true);
    const placeholder=document.createElement('div');
    ghost.classList.add('resume-drag-ghost');
    ghost.style.width=`${rect.width}px`;
    ghost.style.height=`${rect.height}px`;
    placeholder.className='resume-card resume-drop-slot';
    placeholder.dataset.resumeId=id;
    placeholder.style.width=`${rect.width}px`;
    placeholder.style.height=`${rect.height}px`;
    placeholder.setAttribute('aria-hidden','true');
    card.replaceWith(placeholder);
    document.body.appendChild(ghost);
    resumeRailState.dragging=false;
    grid.classList.remove('is-dragging');
    resumeReorderState.active=true;
    resumeReorderState.draggingId=id;
    resumeReorderState.card=card;
    resumeReorderState.placeholder=placeholder;
    resumeReorderState.grid=grid;
    resumeReorderState.ghost=ghost;
    resumeReorderState.startX=e.clientX;
    resumeReorderState.startY=e.clientY;
    resumeReorderState.lastClientX=e.clientX;
    resumeReorderState.lastClientY=e.clientY;
    resumeReorderState.pointerOffsetX=e.clientX-rect.left;
    resumeReorderState.pointerOffsetY=e.clientY-rect.top;
    resumeReorderState.targetGhostX=rect.left;
    resumeReorderState.targetGhostY=rect.top;
    resumeReorderState.currentGhostX=rect.left;
    resumeReorderState.currentGhostY=rect.top;
    resumeReorderState.lastSwapTrackX=e.clientX+grid.scrollLeft;
    resumeReorderState.lastSwapAt=Date.now();
    resumeReorderState.lastSwapDirection=0;
    resumeReorderState.swapStreak=0;
    resumeReorderState.moved=false;
    grid.classList.add('is-reordering');
    document.body.style.userSelect='none';
    ghost.style.transform=`translate3d(${rect.left}px,${rect.top}px,0) scale(1.016) rotate(0deg)`;
    setResumeGhostTarget(e.clientX,e.clientY);
    updateResumeDropMarkers();
    ensureResumeAutoScroll();
    document.addEventListener('pointermove',onResumeReorderMove);
    document.addEventListener('pointerup',onResumeReorderEnd);
    document.addEventListener('pointercancel',onResumeReorderEnd);
}

function onResumeReorderMove(e){
    if(!resumeReorderState.active)return;
    e.preventDefault();
    resumeReorderState.lastClientX=e.clientX;
    resumeReorderState.lastClientY=e.clientY;
    if(Math.abs(e.clientX-resumeReorderState.startX)>1)resumeReorderState.moved=true;
    setResumeGhostTarget(e.clientX,e.clientY);
    placeResumeCardByPointer(e.clientX);
}

async function onResumeReorderEnd(){
    if(!resumeReorderState.active)return;
    document.removeEventListener('pointermove',onResumeReorderMove);
    document.removeEventListener('pointerup',onResumeReorderEnd);
    document.removeEventListener('pointercancel',onResumeReorderEnd);
    stopResumeAutoScroll();
    stopResumeGhostAnimation();
    const grid=resumeReorderState.grid;
    const card=resumeReorderState.card;
    const placeholder=resumeReorderState.placeholder;
    const ghost=resumeReorderState.ghost;
    const moved=resumeReorderState.moved;
    const ids=grid?[...grid.children].map(function(cardEl){return cardEl.dataset.resumeId;}):[];
    const targetRect=placeholder?placeholder.getBoundingClientRect():null;
    clearResumeDropMarkers();
    grid?.classList.remove('is-reordering');
    document.body.style.userSelect='';
    if(ghost&&targetRect){
        ghost.style.transition='transform 320ms cubic-bezier(.16,1,.3,1),opacity 280ms ease,filter 280ms ease';
        ghost.style.transform=`translate3d(${targetRect.left}px,${targetRect.top}px,0) scale(.995) rotate(0deg)`;
        ghost.style.opacity='0';
        ghost.style.filter='saturate(1.02) blur(.2px)';
    }
    if(placeholder&&card)placeholder.replaceWith(card);
    resumeReorderState.active=false;
    resumeReorderState.draggingId=null;
    resumeReorderState.card=null;
    resumeReorderState.placeholder=null;
    resumeReorderState.grid=null;
    resumeReorderState.ghost=null;
    resumeReorderState.targetGhostX=0;
    resumeReorderState.targetGhostY=0;
    resumeReorderState.currentGhostX=0;
    resumeReorderState.currentGhostY=0;
    resumeReorderState.lastSwapTrackX=0;
    resumeReorderState.lastSwapAt=0;
    resumeReorderState.lastSwapDirection=0;
    resumeReorderState.swapStreak=0;
    resumeReorderState.justReorderedUntil=Date.now()+180;
    setTimeout(function(){ghost?.remove();},320);
    if(moved&&ids.length){
        const ok=await store.reorderResumes(ids);
        if(ok!==false){
            toast('顺序已更新','success');
            return;
        }
    }
    renderResumes();
}

function bindResumeRailDrag(){
    const grid=$('#resumes-grid');
    if(!grid||grid.dataset.dragBound==='1')return;
    grid.dataset.dragBound='1';
    grid.addEventListener('pointerdown',function(e){
        if(e.pointerType==='mouse'&&e.button!==0)return;
        if(!store.resumes.length)return;
        if(resumeReorderState.active)return;
        if(e.target.closest('.resume-drag-handle, .resume-action-btn, .resume-inline-edit, button, input, textarea, select, a'))return;
        resumeRailState.dragging=true;
        resumeRailState.moved=false;
        resumeRailState.startX=e.clientX;
        resumeRailState.startScrollLeft=grid.scrollLeft;
        grid.classList.add('is-dragging');
        grid.setPointerCapture?.(e.pointerId);
    });
    grid.addEventListener('pointermove',function(e){
        if(!resumeRailState.dragging)return;
        const dx=e.clientX-resumeRailState.startX;
        if(Math.abs(dx)>6)resumeRailState.moved=true;
        grid.scrollLeft=resumeRailState.startScrollLeft-dx;
    });
    function stopDrag(e){
        if(!resumeRailState.dragging)return;
        resumeRailState.dragging=false;
        grid.classList.remove('is-dragging');
        grid.releasePointerCapture?.(e.pointerId);
        if(resumeRailState.moved){
            resumeRailState.justDragged=true;
            setTimeout(function(){resumeRailState.justDragged=false;},80);
        }
    }
    grid.addEventListener('pointerup',stopDrag);
    grid.addEventListener('pointercancel',stopDrag);
    grid.addEventListener('pointerleave',function(e){
        if(e.pointerType==='mouse')stopDrag(e);
    });
    grid.addEventListener('click',function(e){
        if(!resumeRailState.justDragged)return;
        e.preventDefault();
        e.stopPropagation();
    },true);
}

function parseResumeTags(value){
    return String(value||'').split(/[，,]/).map(function(tag){return tag.trim();}).filter(Boolean);
}

async function withButtonBusy(button,task,busyText){
    if(!button)return await task();
    if(button.dataset.busy==='1')return false;
    const originalText=button.textContent;
    button.dataset.busy='1';
    button.disabled=true;
    button.classList.add('is-busy');
    if(busyText)button.textContent=busyText;
    try{
        return await task();
    }finally{
        button.dataset.busy='0';
        button.disabled=false;
        button.classList.remove('is-busy');
        button.textContent=originalText;
    }
}

function resetResumeUploadZone(){
    const zone=$('#upload-zone');
    zone.dataset.mode='create';
    zone.querySelector('p').textContent='拖拽或点击选择';
    zone.querySelector('.upload-hint').textContent='PDF/DOCX ≤ 10MB';
}

function resetResumeModal(){
    $('#resume-modal-title').textContent='上传简历';
    $('#resume-save').textContent='保存简历';
    $('#resume-name').value='';
    $('#resume-tags').value='';
    $('#resume-notes').value='';
    $('#resume-file-input').value='';
    selFile=null;
    editingResumeId=null;
    resetResumeUploadZone();
}

function openResumeCreateModal(){
    resetResumeModal();
    $('#resume-modal-overlay').classList.add('active');
}

function openResumeEditModal(id){
    const resume=store.getResume(id);
    if(!resume)return;
    resetResumeModal();
    editingResumeId=id;
    $('#resume-modal-title').textContent='编辑简历资料';
    $('#resume-save').textContent='更新资料';
    $('#resume-name').value=resume.file_name||'';
    $('#resume-tags').value=(resume.tags||[]).join(', ');
    $('#resume-notes').value=resume.notes||'';
    const zone=$('#upload-zone');
    zone.dataset.mode='edit';
    zone.querySelector('p').textContent=resume.orig?`当前文件：${resume.orig}`:'可选：补充文件';
    zone.querySelector('.upload-hint').textContent='可重新上传以替换原文件，标签和备注可直接修改';
    $('#resume-modal-overlay').classList.add('active');
}

function renderResumes(){
    const g=$('#resumes-grid');
    bindResumeRailDrag();
    renderResumeStats();
    const query=($('#resume-search')?.value||'').toLowerCase().trim();
    g.classList.remove('is-empty');
    if(!store.resumes.length){
        g.classList.add('is-empty');
        g.innerHTML='<div class="empty-state resume-empty-state"><p>还没有简历</p><span>上传第一份简历吧</span></div>';
        return;
    }
    const resumes=getOrderedResumes().filter(function(r){
        if(!query)return true;
        const haystack=[r.file_name,r.orig,r.notes,(r.tags||[]).join(' ')].join(' ').toLowerCase();
        return haystack.includes(query);
    });
    if(!resumes.length){
        g.classList.add('is-empty');
        g.innerHTML='<div class="empty-state resume-empty-state"><p>没有匹配结果</p><span>试试换个关键词，或者补充更清晰的标签和备注</span></div>';
        return;
    }
    g.innerHTML='';
    resumes.forEach(r=>{
        const linked=store.apps.filter(a=>a.resume_id===r.id);
        const perf=getResumePerformance(r.id);
        const c=document.createElement('div');c.className='resume-card';
        const gradients=['linear-gradient(135deg,rgba(96,165,250,.15),rgba(167,139,250,.1))','linear-gradient(135deg,rgba(74,222,128,.12),rgba(96,165,250,.1))','linear-gradient(135deg,rgba(251,146,60,.12),rgba(248,113,113,.08))','linear-gradient(135deg,rgba(167,139,250,.15),rgba(244,114,182,.1))'];
        const gi=store.resumes.indexOf(r)%gradients.length;
        const tagHTML=(r.tags||[]).length?`<div class="resume-card-tags">${r.tags.map(t=>`<span class="resume-tag">${escapeHTML(t)}</span>`).join('')}</div>`:'<div class="resume-card-tags is-empty"><span class="resume-tag resume-tag-ghost">暂无标签</span></div>';
        const noteHTML=(r.notes||'').trim()?`<div class="resume-card-note">${escapeHTML(r.notes)}</div>`:'<div class="resume-card-note is-empty">还没有备注，适合补充岗位方向、版本重点和使用建议。</div>';
        const linkedText=linked.length?`${linked.length} 条已关联`:'未关联投递';
        const linkedList=linked.length?`<div class="resume-linked-scroller">${linked.map(function(a){
            return `<div class="resume-linked-item"><div class="resume-linked-company">${escapeHTML(a.company_name)}</div><div class="resume-linked-role">${escapeHTML(a.position_title)}</div></div>`;
        }).join('')}</div>`:'<div class="resume-linked-empty">建议补上适用岗位，后面回看会轻松很多。</div>';
        const previewDisabled=!(r.data_url&&(r.file_type||'').toUpperCase()==='PDF');
        c.dataset.resumeId=r.id;
        c.innerHTML=`<div class="resume-card-banner" style="background:${gradients[gi]}"><div class="resume-card-banner-top"><span class="resume-file-chip">${escapeHTML(r.file_type||'文件')}</span><span class="resume-linked-chip">${linkedText}</span></div><div class="resume-icon-lg">📄</div></div><div class="resume-card-body"><div class="resume-card-head"><div><div class="resume-card-name">${escapeHTML(r.file_name)}</div><div class="resume-card-meta">${fmtDT(r.updated_at||r.at)}${r.updated_at&&r.updated_at!==r.at?' 更新':''}${r.size?(' · '+(r.size/1024).toFixed(0)+'KB'):''}</div></div><div class="resume-card-controls"><button class="resume-drag-handle" type="button" title="拖动排序"><span>⋮⋮</span><em>拖动排序</em></button><button class="resume-inline-edit" type="button">编辑资料</button></div></div><div class="resume-performance"><span><strong>${perf.linked}</strong>投递</span><span><strong>${perf.progress}</strong>推进</span><span><strong>${perf.interviews}</strong>面试</span></div><div class="resume-card-support">${tagHTML}${noteHTML}</div><div class="resume-card-linked"><div class="resume-linked-head"><span>适用记录</span>${linked.length?`<em>横向滑动查看全部</em>`:''}</div>${linkedList}</div><div class="resume-card-actions"><button class="resume-action-btn preview-btn${previewDisabled?' is-disabled':''}" ${previewDisabled?'disabled aria-disabled="true"':''}>预览</button><button class="resume-action-btn link-btn">关联岗位</button><button class="resume-action-btn edit-btn">修改标签备注</button><button class="resume-action-btn del-btn resume-action-danger">删除</button></div></div>`;
        c.addEventListener('click',()=>{if(Date.now()<resumeReorderState.justReorderedUntil)return;openResumeEditModal(r.id);});
        c.querySelector('.resume-drag-handle').addEventListener('pointerdown',function(e){
            e.preventDefault();
            e.stopPropagation();
            beginResumeReorder(c,r.id,e);
        });
        c.querySelector('.preview-btn')?.addEventListener('click',async e=>{e.stopPropagation();await withButtonBusy(e.currentTarget,async ()=>{await openResumePreview(r);});});
        c.querySelector('.link-btn').addEventListener('click',async e=>{e.stopPropagation();await withButtonBusy(e.currentTarget,async ()=>openResumeLinkModal(r.id));});
        c.querySelector('.resume-inline-edit').addEventListener('click',e=>{e.stopPropagation();openResumeEditModal(r.id);});
        c.querySelector('.edit-btn').addEventListener('click',e=>{e.stopPropagation();openResumeEditModal(r.id);});
        c.querySelector('.del-btn').addEventListener('click',async e=>{e.stopPropagation();await withButtonBusy(e.currentTarget,async ()=>{if(confirm('删除简历「'+r.file_name+'」？')){const ok=await store.delResume(r.id);if(ok===false)return;renderResumes();toast('已删除','info');}},'删除中...');});
        g.appendChild(c);
    });
}
$('#upload-resume-btn').addEventListener('click',openResumeCreateModal);
$('#resume-search')?.addEventListener('input',renderResumes);
$('#upload-zone').addEventListener('click',()=>$('#resume-file-input').click());
$('#upload-zone').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('dragover');});
$('#upload-zone').addEventListener('dragleave',e=>e.currentTarget.classList.remove('dragover'));
$('#upload-zone').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);});
let selFile=null;
let editingResumeId=null;
$('#resume-file-input').addEventListener('change',e=>{if(e.target.files[0])handleFile(e.target.files[0]);});
function handleFile(f){
    if(f.size>10485760){toast('超过10MB','error');return;}
    if(!f.name.match(/\.(pdf|docx)$/i)){toast('仅PDF/DOCX','error');return;}
    selFile=f;
    if(!editingResumeId||!$('#resume-name').value.trim())$('#resume-name').value=f.name.replace(/\.(pdf|docx)$/i,'');
    $('#upload-zone').querySelector('p').textContent=`已选: ${f.name}`;
    $('#upload-zone').querySelector('.upload-hint').textContent=editingResumeId?'松手后会替换原文件，标签和备注会保留':'文件已就绪，可以继续补充标签和备注';
}
async function persistResumeDraft(payload){
    if(editingResumeId){
        const ok=await store.updateResume(editingResumeId,payload);
        if(!ok){toast('更新失败，请重试','error');return false;}
        toast('已更新','success');
    }else{
        const ok=await store.addResume(payload);
        if(!ok){toast('保存失败，请重试','error');return false;}
        toast(selFile?'已上传':'已保存','success');
    }
    $('#resume-modal-overlay').classList.remove('active');
    resetResumeModal();
    renderResumes();
    return true;
}
$('#resume-save').addEventListener('click',async e=>{await withButtonBusy(e.currentTarget,async ()=>{
    const n=$('#resume-name').value.trim();
    if(!n){toast('请输入名称','error');return;}
    if(!editingResumeId&&!selFile){toast('请先选择简历文件','error');return;}
    const tags=parseResumeTags($('#resume-tags').value);
    const notes=$('#resume-notes').value.trim();
    const current=editingResumeId?store.getResume(editingResumeId):null;
    const basePayload={file_name:n,tags,notes};
    if(selFile){
        const payload=Object.assign({},basePayload,{orig:selFile.name,file_type:selFile.name.toLowerCase().endsWith('.pdf')?'PDF':'DOCX',size:selFile.size,data_url:null});
        const reader=new FileReader();
        reader.onload=async e=>{
            payload.data_url=e.target.result;
            await persistResumeDraft(payload);
        };
        reader.readAsDataURL(selFile);
        return;
    }
    if(editingResumeId&&current){
        await persistResumeDraft(basePayload);
        return;
    }
    await persistResumeDraft(Object.assign({},basePayload,{orig:n,file_type:'文件',size:0,data_url:null}));
},editingResumeId?'更新中...':'保存中...');});
$('#resume-cancel').addEventListener('click',()=>{$('#resume-modal-overlay').classList.remove('active');resetResumeModal();});
$('#resume-modal-close').addEventListener('click',()=>{$('#resume-modal-overlay').classList.remove('active');resetResumeModal();});

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
        const badge=createEl('span','',ini(g.app?.company_name||'?'));
        badge.style.cssText='width:28px;height:28px;border-radius:6px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--text-tertiary);border:1px solid var(--border);flex-shrink:0';
        header.appendChild(badge);
        header.appendChild(document.createTextNode(g.app?`${g.app.company_name} · ${g.app.position_title}`:'未知'));
        const count=createEl('span','',`${g.refs.length}条`);
        count.style.cssText='font-size:11px;color:var(--text-muted);font-weight:400';
        header.appendChild(count);
        l.appendChild(header);
        g.refs.forEach(ref=>{
            const c=buildReflectionCard(ref,true);
            const cardHeader=c.querySelector('.reflection-card-header');
            const rightWrap=createEl('div','reflection-card-header-right');
            const timeNode=cardHeader.querySelector('span:last-child');
            if(timeNode)rightWrap.appendChild(timeNode);
            const delBtn=createEl('button','reflection-delete-btn','删除');
            delBtn.type='button';
            delBtn.addEventListener('click',async function(e){
                e.stopPropagation();
                if(!confirm('删除这条复盘记录？'))return;
                const ok=await store.delRef(ref.id);
                if(ok===false)return;
                renderRefs();
                if(curDId)openDrawer(curDId);
                toast('复盘已删除','info');
            });
            rightWrap.appendChild(delBtn);
            cardHeader.appendChild(rightWrap);
            c.addEventListener('click',()=>openRefModal(ref.id));l.appendChild(c);
        });
    });
}
$('#new-reflection-btn').addEventListener('click',()=>openRefModal(null));
let currentReflectionMode='text';
function renderPPTags(sel=[]){
    const el=$('#pain-points-selector');
    el.innerHTML='';
    store.painPoints.forEach(function(p){
        const lb=createEl('label','tag-check');
        const input=document.createElement('input');
        input.type='checkbox';
        input.value=p;
        input.checked=sel.includes(p);
        lb.appendChild(input);
        lb.appendChild(createEl('span','',p));
        el.appendChild(lb);
    });
}
function renderReflectionTemplate(round){
    const box=$('#reflection-template');
    if(!box)return;
    const qs=REFLECTION_TEMPLATES[round]||REFLECTION_TEMPLATES.ROUND_1;
    box.innerHTML=`<div class="reflection-template-head"><span>复盘模板</span><button type="button" id="reflection-template-apply">套用</button></div><div class="reflection-template-list">${qs.map(q=>`<span>${q}</span>`).join('')}</div>`;
    $('#reflection-template-apply').addEventListener('click',function(){
        const target=$('#reflection-content');
        const template=qs.map(q=>`${q}：`).join('\n');
        target.value=target.value.trim()?`${target.value.trim()}\n\n${template}`:template;
        target.focus();
    });
}
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
    const sel=$('#reflection-application');
    sel.textContent='';
    const placeholder=document.createElement('option');
    placeholder.value='';
    placeholder.textContent='选择投递...';
    sel.appendChild(placeholder);
    store.apps.filter(a=>a.status!=='WATCHING').forEach(function(a){
        const option=document.createElement('option');
        option.value=a.id;
        option.selected=ref?.app_id===a.id||preAppId===a.id;
        option.textContent=`${a.company_name} - ${a.position_title}`;
        sel.appendChild(option);
    });
    $('#reflection-round').value=ref?.interview_round||'ROUND_1';$('#reflection-content').value=ref?.raw_content||'';
    renderReflectionTemplate($('#reflection-round').value);
    renderPPTags(ref?.pain_points||[]);
    $$('.star-rating .star').forEach(s=>s.classList.toggle('active',parseInt(s.dataset.val)<=(ref?.self_rating||0)));
    currentReflectionMode='text';
    if(voiceRecognition)voiceRecognition.stop();
    clearInterval(recTimer);recSec=0;voiceTranscriptFinal='';
    resetVoiceUI();
    $('#voice-recorder').style.display='none';$('#reflection-content').style.display='';$$('.mode-btn').forEach(b=>b.classList.remove('active'));$('.mode-btn[data-mode="text"]').classList.add('active');
    $('#reflection-modal-overlay').classList.add('active');
}
$('#reflection-round').addEventListener('change',function(){renderReflectionTemplate(this.value);});
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
        renderVoiceResult('实时转写',combined);
    };
    voiceRecognition.onend=function(){
        voiceRecognitionActive=false;
        clearInterval(recTimer);
        recTimer=null;
        const btn=$('#record-btn');
        if(btn)btn.classList.remove('recording');
        $('#record-label').textContent=voiceTranscriptFinal.trim()?'重新转写':'点击开始转写';
        if($('#voice-result').textContent.trim()){
            renderVoiceResult('转写完成',$('#reflection-content').value||'');
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
    $('#stat-cards').innerHTML=`<div class="stat-card"><div class="stat-card-label">总投递</div><div class="stat-card-value">${ap.length}</div></div><div class="stat-card"><div class="stat-card-label">活跃</div><div class="stat-card-value">${ac.length}</div></div><div class="stat-card"><div class="stat-card-label">面试中</div><div class="stat-card-value">${iv.length}</div></div><div class="stat-card"><div class="stat-card-label">Offer</div><div class="stat-card-value" style="color:var(--green)">${of.length}</div></div><div class="stat-card"><div class="stat-card-label">回复率</div><div class="stat-card-value">${rr}%</div></div><div class="stat-card"><div class="stat-card-label">流程终止</div><div class="stat-card-value" style="color:var(--red)">${rj.length}</div></div>`;
    const fd=[{l:'投递',c:ap.length,co:'#60a5fa'},{l:'笔试',c:apps.filter(a=>['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#a78bfa'},{l:'一面+',c:apps.filter(a=>['ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#818cf8'},{l:'二面+',c:apps.filter(a=>['ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status)).length,co:'#fb923c'},{l:'Offer',c:of.length,co:'#4ade80'}];
    renderFunnelChart(fd);
    const cs={};ap.forEach(a=>{const c=a.position_category||'其他';if(!cs[c])cs[c]={t:0,r:0};cs[c].t++;if(['OA_TEST','ROUND_1','ROUND_2','ROUND_3','ROUND_4','OFFER'].includes(a.status))cs[c].r++;});
    const ce=Object.entries(cs).sort((a,b)=>b[1].t-a[1].t||b[1].r-a[1].r||a[0].localeCompare(b[0],'zh-CN')).map(function(entry){
        const name=entry[0],stats=entry[1];
        return {label:name,total:stats.t,progress:stats.r,rate:stats.t?Math.round(stats.r/stats.t*100):0};
    });
    renderCategoryChart(ce);
    const rs={};store.logs.filter(l=>l.to==='REJECTED'&&l.rej).forEach(l=>{rs[l.rej]=(rs[l.rej]||0)+1;});
    const baseStats={};ap.forEach(a=>{const key=a.base_location||'未填写';baseStats[key]=(baseStats[key]||0)+1;});
    const baseEntries=Object.entries(baseStats).sort((a,b)=>b[1]-a[1]).map(function(entry){return{label:entry[0],value:entry[1]};});
    renderTrendChart(buildTrendRange(ap,analyticsTrendGranularity));
    renderCityDistributionChart(baseEntries);
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
    const result={text:buildAnalyticsFallback(ap,cs,rs)};
    renderAIBlocks(el,result.text,'insight');
}

$$('#trend-granularity .chart-segment').forEach(function(button){
    button.addEventListener('click',function(){
        if(analyticsTrendGranularity===button.dataset.granularity)return;
        analyticsTrendGranularity=button.dataset.granularity||'day';
        $$('#trend-granularity .chart-segment').forEach(function(item){
            item.classList.toggle('is-active',item===button);
        });
        if(curView==='analytics')renderAnalytics();
    });
});

// ---- 设置 ----
document.getElementById('settings-btn')?.addEventListener('click',()=>{document.getElementById('profile-btn')?.click();});
function renderSetCats(){
    const el=$('#settings-categories');
    el.innerHTML='';
    store.categories.forEach(function(c){
        const t=createEl('span','settings-tag');
        t.appendChild(document.createTextNode(c+' '));
        const remove=createEl('span','remove-tag','×');
        remove.addEventListener('click',async ()=>{const ok=await store.rmCat(c);if(ok!==false){renderSetCats();initFilters();}});
        t.appendChild(remove);
        el.appendChild(t);
    });
}
function renderSetPPs(){
    const el=$('#settings-painpoints');
    el.innerHTML='';
    store.painPoints.forEach(function(p){
        const t=createEl('span','settings-tag');
        t.appendChild(document.createTextNode(p+' '));
        const remove=createEl('span','remove-tag','×');
        remove.addEventListener('click',async ()=>{const ok=await store.rmPP(p);if(ok!==false)renderSetPPs();});
        t.appendChild(remove);
        el.appendChild(t);
    });
}
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
    $('#resume-link-save').addEventListener('click',async e=>{await withButtonBusy(e.currentTarget,async ()=>{
        const selected=[];$$('.rl-check:checked').forEach(c=>selected.push(c.dataset.id));
        const ok=await store.linkResumeToApps(resumeId,selected);
        if(ok===false)return;
        $('#resume-link-overlay').remove();renderResumes();toast('关联已更新','success');
    },'保存中...');});
}
function initFilters(){const cs=$('#filter-category');cs.textContent='';const catPlaceholder=document.createElement('option');catPlaceholder.value='';catPlaceholder.textContent='全部类别';cs.appendChild(catPlaceholder);store.categories.forEach(function(c){const option=document.createElement('option');option.value=c;option.textContent=c;cs.appendChild(option);});const ss=$('#table-filter-status');const prev=ss.value;ss.textContent='';const statusPlaceholder=document.createElement('option');statusPlaceholder.value='';statusPlaceholder.textContent='全部状态';ss.appendChild(statusPlaceholder);STATUSES.filter(s=>s.key!=='REJECTED').forEach(function(s){const option=document.createElement('option');option.value=s.key;option.textContent=s.label;ss.appendChild(option);});ss.value=STATUSES.some(s=>s.key===prev&&s.key!=='REJECTED')?prev:'';renderTableControlOptions();}
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
        {company_name:'小红书',position_title:'营销策划',position_category:'市场营销',base_location:'上海',applied_date:daysAgo(14),preference_level:'2',source_channel:'官网',source_link:'https://job.xiaohongshu.com/',timeline:[{name:'已投递',date:daysAgo(14)},{name:'流程终止',date:daysAgo(9)}],notes:'已结束，用来演示完整流程与状态回顾。'}
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
