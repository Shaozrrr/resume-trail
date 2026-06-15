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
const ROUND_LABELS={OA_TEST:'笔试/OA',ROUND_1:'一面',ROUND_2:'二面',ROUND_3:'三面',ROUND_4:'四面',GROUP:'群面',HR:'HR面',MOCK_INTERVIEW:'模拟面试'};
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
const RT_GUEST_IDENTITY_KEY='rt_guest_identity_id';
const RT_ACCOUNT_CACHE_KEY='rt_account_cache';
const RT_PENDING_GUEST_MIGRATION_KEY='rt_pending_guest_migration';
const RT_RESOLVED_GUEST_MIGRATION_KEY='rt_resolved_guest_migration';
const RT_THEME_MODE_KEY='rt_theme_mode';
const RT_THEME_DIRTY_KEY='rt_theme_dirty';
const HIDDEN_VISA_VALUE='UNKNOWN';
const PREPARE_SESSION_HISTORY_LIMIT=5;
const PREPARE_INTELLIGENCE_CACHE_KEY='rt_prepare_intelligence_cache_v1';
const PREPARE_INTELLIGENCE_TIMEOUT_MS=2200;
const PREPARE_JD_READER_TIMEOUT_MS=10000;
const JOB_BOARD_TIMEOUT_MS=8500;
const JOB_BOARD_REGIONS=[
    {key:'mainland',label:'中国大陆'},
    {key:'hongkong',label:'香港'},
    {key:'northamerica',label:'北美'},
    {key:'other',label:'其他地区'}
];
const JOB_BOARD_GREENHOUSE_SOURCES=[
    {company:'Figma',board:'figma'},
    {company:'Stripe',board:'stripe'},
    {company:'Databricks',board:'databricks'},
    {company:'Airbnb',board:'airbnb'},
    {company:'Coinbase',board:'coinbase'},
    {company:'Asana',board:'asana'},
    {company:'Instacart',board:'instacart'}
];
const JOB_BOARD_REMOTE_TABLE='rt_public_job_board_cache';
const JOB_BOARD_REMOTE_JOBS_TABLE='rt_public_job_board_jobs';
const JOB_BOARD_REMOTE_CACHE_KEY='default';
const JOB_BOARD_CACHE_MAX_AGE_MS=24*60*60*1000;
const JOB_BOARD_SHARED_BUCKET='rt-shared';
const JOB_BOARD_SHARED_CACHE_PATH='jobs/job-board-cache.json';

function cloneData(value){
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}
function normalizePrepareSessionCollection(list){
    return (Array.isArray(list)?list:[])
        .filter(function(item){
            return item&&typeof item==='object'&&item.id;
        })
        .sort(function(a,b){
            return new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime();
        })
        .slice(0,PREPARE_SESSION_HISTORY_LIMIT)
        .map(function(item){
            return Object.assign({},item,{
                outputs:normalizePrepareOutputsPayload(item.outputs),
                updated_at:item.updated_at||item.created_at||new Date().toISOString()
            });
        });
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

function createLocalId(prefix){
    if(window.crypto&&typeof window.crypto.randomUUID==='function')return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}

function getGuestIdentityId(){
    try{
        const current=localStorage.getItem(RT_GUEST_IDENTITY_KEY);
        if(current)return current;
        const next=createLocalId('guest');
        localStorage.setItem(RT_GUEST_IDENTITY_KEY,next);
        return next;
    }catch(err){
        return createLocalId('guest');
    }
}
function resetGuestIdentityId(){
    try{
        localStorage.removeItem(RT_GUEST_IDENTITY_KEY);
    }catch(err){}
}
function getGuestMigrationDataSignature(data){
    const source=data&&typeof data==='object'?data:{};
    const collect=function(list){
        return Array.isArray(list)?list:[];
    };
    const signatures=[
        collect(source.apps).length,
        collect(source.resumes).length,
        collect(source.prepare_sessions).length,
        collect(source.refs).length,
        collect(source.logs).length,
        collect(source.categories).length
    ];
    const samples=[
        collect(source.apps)[0]?.id||'',
        collect(source.resumes)[0]?.id||'',
        collect(source.prepare_sessions)[0]?.id||'',
        collect(source.refs)[0]?.id||'',
        collect(source.logs)[0]?.id||''
    ];
    return `${signatures.join('-')}|${samples.join('|')}`;
}

function readCachedAccount(){
    try{
        const raw=localStorage.getItem(RT_ACCOUNT_CACHE_KEY);
        return raw?JSON.parse(raw):null;
    }catch(err){
        return null;
    }
}

function writeCachedAccount(account){
    try{
        if(!account){
            localStorage.removeItem(RT_ACCOUNT_CACHE_KEY);
            return;
        }
        localStorage.setItem(RT_ACCOUNT_CACHE_KEY,JSON.stringify(account));
    }catch(err){}
}

function markGuestMigrationPending(meta){
    try{
        const guestData=window.rtGuestStore&&typeof window.rtGuestStore.load==='function'
            ? window.rtGuestStore.load()
            : null;
        const payload=Object.assign({
            guest_id:getGuestIdentityId(),
            created_at:new Date().toISOString(),
            data_signature:getGuestMigrationDataSignature(guestData)
        },meta||{});
        localStorage.setItem(RT_PENDING_GUEST_MIGRATION_KEY,JSON.stringify(payload));
        return payload;
    }catch(err){
        return null;
    }
}

function readGuestMigrationPending(){
    try{
        const raw=localStorage.getItem(RT_PENDING_GUEST_MIGRATION_KEY);
        return raw?JSON.parse(raw):null;
    }catch(err){
        return null;
    }
}

function clearGuestMigrationPending(){
    try{
        localStorage.removeItem(RT_PENDING_GUEST_MIGRATION_KEY);
    }catch(err){}
}
function readResolvedGuestMigration(){
    try{
        const raw=localStorage.getItem(RT_RESOLVED_GUEST_MIGRATION_KEY);
        return raw?JSON.parse(raw):null;
    }catch(err){
        return null;
    }
}
function markResolvedGuestMigration(meta){
    try{
        const guestData=window.rtGuestStore&&typeof window.rtGuestStore.load==='function'
            ? window.rtGuestStore.load()
            : null;
        const payload=Object.assign({
            guest_id:getGuestIdentityId(),
            resolved_at:new Date().toISOString(),
            data_signature:getGuestMigrationDataSignature(guestData)
        },meta||{});
        localStorage.setItem(RT_RESOLVED_GUEST_MIGRATION_KEY,JSON.stringify(payload));
        return payload;
    }catch(err){
        return null;
    }
}
function hasResolvedGuestMigration(meta){
    const resolved=readResolvedGuestMigration();
    if(!resolved||!meta)return false;
    return resolved.guest_id===meta.guest_id&&resolved.data_signature===meta.data_signature;
}
function clearResolvedGuestMigration(){
    try{
        localStorage.removeItem(RT_RESOLVED_GUEST_MIGRATION_KEY);
    }catch(err){}
}

window.rtGetGuestIdentityId=getGuestIdentityId;
window.rtResetGuestIdentityId=resetGuestIdentityId;
window.rtReadCachedAccount=readCachedAccount;
window.rtWriteCachedAccount=writeCachedAccount;
window.rtMarkGuestMigrationPending=markGuestMigrationPending;
window.rtReadGuestMigrationPending=readGuestMigrationPending;
window.rtClearGuestMigrationPending=clearGuestMigrationPending;
window.rtMarkResolvedGuestMigration=markResolvedGuestMigration;
window.rtReadResolvedGuestMigration=readResolvedGuestMigration;
window.rtHasResolvedGuestMigration=hasResolvedGuestMigration;
window.rtClearResolvedGuestMigration=clearResolvedGuestMigration;
window.rtGetAccountMembershipLabel=getAccountMembershipLabel;
window.rtGetAccountEntitlementText=getAccountEntitlementText;
window.rtOpenPrepareUpgradeModal=openPrepareUpgradeModal;

function getAnalyticsAuthMode(){
    return !!(window.rtGuestStore&&window.rtGuestStore.isEnabled&&window.rtGuestStore.isEnabled())?'guest':'email';
}

function getAnalyticsBaseProps(extra){
    return Object.assign({
        guest_mode:!!(window.rtGuestStore&&window.rtGuestStore.isEnabled&&window.rtGuestStore.isEnabled()),
        auth_mode:getAnalyticsAuthMode(),
        current_view:typeof curView==='string'&&curView?curView:'login',
        device_type:window.innerWidth<=720?'mobile':'desktop',
        theme_mode:getStoredThemeMode()
    },extra||{});
}

function normalizeThemeMode(mode){
    return mode==='light'?'light':'dark';
}

function getStoredThemeMode(){
    try{
        const stored=localStorage.getItem(RT_THEME_MODE_KEY);
        if(stored==='light'||stored==='dark')return stored;
    }catch(err){}
    return document.documentElement.dataset.theme==='light'?'light':'dark';
}

function rememberThemeMode(mode){
    try{
        localStorage.setItem(RT_THEME_MODE_KEY,normalizeThemeMode(mode));
    }catch(err){}
}

function markThemeDirty(mode){
    rememberThemeMode(mode);
    try{
        localStorage.setItem(RT_THEME_DIRTY_KEY,'1');
    }catch(err){}
}

function clearThemeDirty(){
    try{
        localStorage.removeItem(RT_THEME_DIRTY_KEY);
    }catch(err){}
}

function isThemeDirty(){
    try{
        return localStorage.getItem(RT_THEME_DIRTY_KEY)==='1';
    }catch(err){
        return false;
    }
}

function syncThemeToggle(){
    const mode=getStoredThemeMode();
    const nextMode=mode==='dark'?'light':'dark';
    document.querySelectorAll('.theme-toggle').forEach(function(toggle){
        const icon=toggle.querySelector('.theme-toggle-icon');
        const text=toggle.querySelector('.theme-toggle-text');
        if(icon)icon.textContent=nextMode==='light'?'☀︎':'☾';
        if(text)text.textContent=nextMode==='light'?'浅色模式':'深色模式';
        toggle.setAttribute('aria-label',nextMode==='light'?'切换浅色模式':'切换深色模式');
        toggle.dataset.mode=mode;
    });
}

function syncThemeToggleVisibility(isLoggedIn){
    const loginToggle=document.getElementById('theme-toggle-login');
    const appToggle=document.getElementById('theme-toggle-app');
    if(loginToggle)loginToggle.style.display=isLoggedIn?'none':'inline-flex';
    if(appToggle)appToggle.style.display=isLoggedIn?'inline-flex':'none';
}

function applyThemeMode(mode,options){
    const normalized=normalizeThemeMode(mode);
    document.documentElement.dataset.theme=normalized;
    document.documentElement.style.colorScheme=normalized;
    if(!options||options.remember!==false)rememberThemeMode(normalized);
    syncThemeToggle();
    window.dispatchEvent(new CustomEvent('rt:themechange',{detail:{mode:normalized}}));
    return normalized;
}

async function setThemeMode(mode,options){
    const normalized=applyThemeMode(mode,options);
    const shouldPersist=!options||options.persist!==false;
    if(!shouldPersist){
        markThemeDirty(normalized);
        return true;
    }
    if(typeof store!=='undefined'&&store&&store.settings){
        const current=normalizeThemeMode(store.settings.themeMode||getDefaultSettings().themeMode);
        if(current!==normalized&&typeof store.setSetting==='function'){
            const ok=await store.setSetting('themeMode',normalized);
            if(ok===false){
                applyThemeMode(current,{remember:true});
                return false;
            }
        }
        if(store.settings)store.settings.themeMode=normalized;
        clearThemeDirty();
        if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_theme_changed',{theme_mode:normalized});
        return true;
    }
    markThemeDirty(normalized);
    return true;
}

async function syncThemeModeWithStore(){
    if(typeof store==='undefined'||!store||!store.settings)return applyThemeMode(getStoredThemeMode(),{remember:true});
    const localMode=getStoredThemeMode();
    const storeMode=normalizeThemeMode(store.settings.themeMode||getDefaultSettings().themeMode);
    if(isThemeDirty()){
        if(localMode!==storeMode&&typeof store.setSetting==='function'){
            const ok=await store.setSetting('themeMode',localMode);
            if(ok!==false){
                store.settings.themeMode=localMode;
                clearThemeDirty();
                return applyThemeMode(localMode,{remember:true});
            }
        }
        clearThemeDirty();
    }
    store.settings.themeMode=storeMode;
    return applyThemeMode(storeMode,{remember:true});
}

window.rtSetThemeMode=setThemeMode;
window.rtSyncThemeModeWithStore=syncThemeModeWithStore;
window.rtApplyThemeMode=applyThemeMode;
window.rtSyncThemeToggleVisibility=syncThemeToggleVisibility;

window.rtTrackEvent=function(name,props){
    const payload=getAnalyticsBaseProps(props);
    const tracked=!!(window.rtAnalytics&&typeof window.rtAnalytics.capture==='function'&&window.rtAnalytics.capture(name,payload));
    if(window.rtAccountService&&typeof window.rtAccountService.logEvent==='function'){
        window.rtAccountService.logEvent(name,payload).catch(function(err){
            console.warn('[RT account] logEvent failed',name,err);
        });
    }
    return tracked;
};

window.rtIdentifyUser=function(user,props){
    if(!window.rtAnalytics||typeof window.rtAnalytics.identify!=='function'||!user||!user.id)return false;
    return window.rtAnalytics.identify(user.id,Object.assign({
        email:user.email||'',
        auth_mode:getAnalyticsAuthMode(),
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
function parseReflectionStructuredContent(ref){
    const question=normalizePrepareText(ref?.question_text||ref?.reflection_question||'');
    const answer=normalizePrepareText(ref?.answer_text||ref?.reflection_answer||'');
    const review=normalizePrepareText(ref?.reflection_text||ref?.ai_extracted||'');
    if(question||answer||review){
        return{question,answer,review};
    }
    const raw=normalizePrepareText(ref?.raw_content||'');
    const questionMatch=raw.match(/(?:问题|题目|面试官问|Q)：([\s\S]*?)(?:\n+回答：|\n+你的回答：|\n+复盘：|$)/);
    const answerMatch=raw.match(/(?:回答|你的回答|A)：([\s\S]*?)(?:\n+复盘：|$)/);
    const reviewMatch=raw.match(/(?:复盘|总结|点评)：([\s\S]*)$/);
    return{
        question:normalizePrepareText(questionMatch?.[1]||''),
        answer:normalizePrepareText(answerMatch?.[1]||''),
        review:normalizePrepareText(reviewMatch?.[1]||'')
    };
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
    return {intlMode:false,weeklyGoal:legacy,profileNickname:'',profileAvatar:'',themeMode:getStoredThemeMode()};
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
            prepare_sessions:cloneData(store.prepareSessions),
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
        this.prepareSessions=[];
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
            prepareSessions:cloneData(this.prepareSessions),
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
        this.prepareSessions=normalizePrepareSessionCollection(snapshot.prepareSessions||[]);
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
    getPrepareSession(id){return this.prepareSessions.find(s=>s.id===id);}
    getAppRefs(aid){return this.refs.filter(r=>r.app_id===aid);}
    getAppLogs(aid){return this.logs.filter(l=>l.app_id===aid).sort((a,b)=>new Date(b.at)-new Date(a.at));}
    async addPrepareSession(session){
        return this.commit('prepare.add',draft=>{
            const now=new Date().toISOString();
            const next=Object.assign({
                id:crypto.randomUUID(),
                source_type:'manual',
                application_id:null,
                company_name:'',
                role_name:'',
                role_category:'',
                jd_text:'',
                jd_url:'',
                resume_id:null,
                resume_name:'',
                resume_text:'',
                resume_file_meta:null,
                status:'draft',
                outputs:null,
                generated_at:null,
                created_at:now,
                updated_at:now
            },cloneData(session||{}));
            draft.prepareSessions.unshift(next);
            draft.prepareSessions=normalizePrepareSessionCollection(draft.prepareSessions);
            return next;
        });
    }
    async updatePrepareSession(id,patch){
        return this.commit('prepare.update',draft=>{
            const idx=draft.prepareSessions.findIndex(s=>s.id===id);
            if(idx<0)return null;
            draft.prepareSessions[idx]=Object.assign({},draft.prepareSessions[idx],cloneData(patch||{}),{updated_at:new Date().toISOString()});
            draft.prepareSessions=normalizePrepareSessionCollection(draft.prepareSessions);
            return draft.prepareSessions.find(function(item){return item.id===id;})||null;
        });
    }
    async delPrepareSession(id){
        return this.commit('prepare.delete',draft=>{
            draft.prepareSessions=draft.prepareSessions.filter(s=>s.id!==id);
            return true;
        });
    }
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
                this.prepareSessions=normalizePrepareSessionCollection(starter.prepare_sessions||[]);
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
            this.panel.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9999;width:220px;padding:10px 12px;border-radius:8px;background:rgba(15,23,42,.94);color:#e2e8f0;font-size:11px;line-height:1.5;border:1px solid rgba(148,163,184,.28);box-shadow:0 12px 30px rgba(15,23,42,.28);backdrop-filter:blur(8px);pointer-events:none';
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
    const lightTheme=getStoredThemeMode()==='light';
    const topCount=Math.max(entries[0].c,1);
    target.textContent='';
    const wrap=createEl('div','funnel-modern');
    const visual=createEl('div','funnel-visual');
    const svg=createSvgEl('svg',{viewBox:'0 0 360 236',class:'funnel-svg',preserveAspectRatio:'xMidYMid meet'});
    const defs=createSvgEl('defs');
    svg.appendChild(defs);
    const shadow=createSvgEl('filter',{id:'funnelShadow',x:'-40%',y:'-40%',width:'180%',height:'180%'});
    shadow.appendChild(createSvgEl('feDropShadow',{dx:'0',dy:'20',stdDeviation:'18','flood-color':lightTheme?'#cbd5e1':'#05070c','flood-opacity':lightTheme?'0.24':'0.42'}));
    defs.appendChild(shadow);
    const centerX=156;
    const topY=18;
    const segH=34;
    const gap=7;
    const widths=[236,188,142,102,60];
    svg.appendChild(createSvgEl('path',{
        d:'M 38 18 L 274 18 L 196 223 L 116 223 Z',
        fill:lightTheme?'rgba(15,23,42,.035)':'rgba(255,255,255,.018)',
        stroke:lightTheme?'rgba(148,163,184,.28)':'rgba(255,255,255,.055)',
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
        sheen.appendChild(createSvgEl('stop',{offset:'0%','stop-color':lightTheme?'#ffffff':'#ffffff','stop-opacity':lightTheme?'0.52':'0.24'}));
        sheen.appendChild(createSvgEl('stop',{offset:'38%','stop-color':'#ffffff','stop-opacity':lightTheme?'0.14':'0.08'}));
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
        svg.appendChild(createSvgEl('polygon',{points:points,fill:'none',stroke:lightTheme?'rgba(255,255,255,.86)':'rgba(255,255,255,.14)','stroke-width':'0.9'}));
        svg.appendChild(createSvgEl('line',{
            x1:centerX-topW/2+14,
            y1:y+1,
            x2:centerX+topW/2-14,
            y2:y+1,
            stroke:lightTheme?'rgba(255,255,255,.74)':'rgba(255,255,255,.11)',
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
let curView='table',curTab='info';
let tableQuickEdit=false;
let tableSortColumn='created_at';
let tableSortDirection='desc';
let kanbanSortDirection='desc';
let viewModeTransitionToken=0;
const prepareState={
    mode:'application',
    screen:'compose',
    composeStep:'entry',
    selectedSessionId:null,
    lastOpenedSessionId:'',
    selectedApplicationId:'',
    activeTab:'research',
    questionPane:'list',
    companyOverviewMode:'simple',
    selectedQuestionId:null,
    selectedFramework:'STAR',
    questionGroupLoadingKey:'',
    showResumePreview:false,
    showJdPreview:false,
    manualResumeFile:null,
    appSupplementFile:null,
    manualResumeParse:{status:'idle',text:'',message:''},
    appSupplementParse:{status:'idle',text:'',message:''},
    freeQuestionText:'',
    appSupplement:{
        jdText:'',
        jdUrl:'',
        resumeId:'',
        resumeText:''
    },
    manualDraft:{
        companyName:'',
        roleName:'',
        jdUrl:'',
        jdText:'',
        resumeId:'',
        resumeText:''
    },
    sessionLoading:false,
    sessionError:'',
    answerLoading:false,
    answerError:'',
    loadingKind:'',
    loadingStartedAt:0,
    loadingFrame:0,
    supplementalExperienceDraft:'',
    showSupplementModal:false,
    jdReaderLoadingKey:'',
    jdReaderError:''
};
const prepareMockState={
    sessionId:'',
    questions:[],
    currentIndex:0,
    currentAnswer:'',
    currentFeedback:null,
    history:[],
    currentQuestionLoading:false,
    submitLoading:false,
    error:'',
    stage:'setup',
    questionMode:'generated',
    feedbackMode:'per_question',
    customQuestionDraft:'',
    customQuestions:[],
    finalFeedback:null,
    transcriptMode:'text',
    voiceActive:false,
    transcriptText:'',
    recorderTimer:null,
    recorderSeconds:0,
    recognition:null,
    showResumeGate:false
};
const jobBoardState={
    query:'',
    activeRegion:'all',
    page:1,
    pageSize:60,
    loading:false,
    error:'',
    jobs:[],
    searched:false,
    lastFetchedAt:'',
    bootstrapped:false,
    sourceLabel:'',
    cacheReady:false,
    cachePromise:null,
    jobsVersion:'',
    regionCounts:{},
    filteredCacheKey:'',
    filteredJobs:[],
    bodyAnimationToken:0
};
const PREPARE_SPEECH_RECOGNITION_CTOR=window.SpeechRecognition||window.webkitSpeechRecognition||null;
const PREP_MIN_JD_LENGTH=60;
const PREPARE_RUNTIME_CONFIG_KEY='rt_prepare_runtime_config';
const PREPARE_WEB_LOOKUP_CACHE_KEY='rt_prepare_web_lookup_cache';
const PREPARE_DIRECT_TOOL_ROUNDS=3;
const PREPARE_DIRECT_TOOL_MAX_CALLS=3;
const PREPARE_WEB_LOOKUP_TIMEOUT_MS=1800;
const PREPARE_MEMBERSHIP_PLANS=[
    {key:'monthly',label:'9.9 / 30天',price:'¥9.9 / 30天',summary:'适合持续刷题和阶段性冲刺准备',membershipTier:'monthly'},
    {key:'lifetime',label:'49.9 买断',price:'¥49.9 买断',summary:'一次开通，长期使用',membershipTier:'lifetime'}
];
const DEFAULT_BILLING_CONFIG={
    provider:'支付宝',
    mode:'supabase_edge',
    functionName:'stripe-create-checkout',
    note:'仅支持支付宝，支付成功后会自动开通对应会员权益。',
    plans:{
        monthly:{
            label:'9.9 / 30天',
            methods:[
                {key:'alipay',label:'支付宝'}
            ]
        },
        lifetime:{
            label:'49.9 买断',
            methods:[
                {key:'alipay',label:'支付宝'}
            ]
        }
    }
};
const PREP_FRAMEWORKS=[
    {key:'STAR',label:'STAR',description:'适合讲经历。把背景、任务、行动、结果讲完整。',useCase:'最适合项目案例、行为题、经历追问。'},
    {key:'PREP',label:'PREP',description:'适合讲观点。先亮结论，再给理由和例子。',useCase:'适合“你怎么看”“为什么这么判断”这类题。'},
    {key:'PAR',label:'PAR',description:'适合讲成果。围绕问题、行动、结果展开。',useCase:'适合强调推进效果、个人贡献和业务结果。'},
    {key:'SCQA',label:'SCQA',description:'适合结构化分析。用背景、冲突、问题、答案展开。',useCase:'适合 case、业务拆解、复杂场景判断。'},
    {key:'FREE',label:'自由回答',description:'适合你自由追问。直接输入问题，生成一版可开讲的回答骨架。',useCase:'适合临场追问、补充题、反问准备。'}
];
const PREPARE_KNOWN_TERM_BRIEFS=[
    {
        id:'openclaw',
        aliases:['openclaw','open claw'],
        display:'OpenClaw',
        meaning:'公开资料里，OpenClaw 是一类开源 AI Agent / 数字员工平台，强调在本地或自有环境运行，连接模型、工具和操作系统去执行任务，而不只是对话。',
        prep_direction:'如果 JD 提到它，面试官通常在看你是否理解 Agent 的任务规划、工具调用、自动化工作流、权限控制和安全边界，而不是只会聊大模型概念。',
        interview_focus:[
            '准备解释 Agent 和普通对话式大模型的区别',
            '准备你是否做过自动化流程、工具编排、工作流设计或权限边界管理',
            '如果没有实操，也要能说明企业为什么偏好本地/私有部署 Agent'
        ],
        sources:[
            'OpenClaw Docs：What is OpenClaw',
            '证券时报：从聊天到干活，AI圈新宠“龙虾”走红'
        ]
    },
    {
        id:'lobster',
        aliases:['龙虾','小龙虾'],
        display:'龙虾（OpenClaw）',
        meaning:'“龙虾”是中文语境里对 OpenClaw 的常见昵称，来源于项目图标和 “Claw” 的视觉联想；很多报道会直接把“龙虾”当作 OpenClaw 的大众叫法。',
        prep_direction:'如果 JD 用“龙虾”而不是 OpenClaw，回答时要主动把它翻译回 AI Agent / 自动化执行平台，避免把它当成单独的新名词。',
        interview_focus:[
            '先把“龙虾”翻译成 OpenClaw / AI Agent 体系',
            '围绕部署、使用门槛、执行能力与安全风险来讲',
            '不要把它理解成单纯聊天机器人或内容生成工具'
        ],
        sources:[
            '证券时报：所谓“龙虾”就是安装和运行 OpenClaw',
            '齐鲁壹点：OpenClaw 的中文昵称——龙虾'
        ]
    },
    {
        id:'raise_lobster',
        aliases:['养虾','养龙虾'],
        display:'养虾 / 养龙虾',
        meaning:'“养虾”在中文社区通常不是养殖，而是指部署、配置、持续运行、调优和维护 OpenClaw 这类 Agent 系统的过程。',
        prep_direction:'如果 JD 或面试官提到“养虾”，重点不是玩梗，而是在看你是否理解 Agent 的安装、配置、模型接入、记忆/上下文、稳定性和成本控制。',
        interview_focus:[
            '准备说明从安装到可用需要哪些关键步骤',
            '准备讲模型配置、工具配置、权限和稳定性问题',
            '准备讲为什么企业场景会关心成本、维护和风控'
        ],
        sources:[
            '行业百科：OpenClaw 为什么叫养虾',
            '证券时报：养龙虾就是安装和运行 OpenClaw'
        ]
    },
    {
        id:'shrimp_expert',
        aliases:['养虾达人','养虾人','云上养虾人'],
        display:'养虾达人',
        meaning:'“养虾达人/养虾人”通常指对 OpenClaw 这类 Agent 的部署、调优、工作流设计更熟的实践者或重度用户，不是水产语境。',
        prep_direction:'如果岗位提到这类人群，通常是在指 Agent 生态里的 advanced users / builders，回答要贴近技术落地、工具使用深度和场景复用能力。',
        interview_focus:[
            '把它理解成 AI Agent 生态的重度用户或建设者',
            '准备你是否做过工作流复用、模板化或能力沉淀',
            '如果没有直接经历，就讲你如何快速从用户视角切进到产品视角'
        ],
        sources:[
            'OpenClaw 社区/媒体语境中的“养虾人”',
            '齐鲁壹点、央视网关于“养虾热”的报道'
        ]
    },
    {
        id:'agent_skill',
        aliases:['skill','skills'],
        display:'Skill',
        requiresAny:['openclaw','龙虾','agent','智能体'],
        meaning:'在 Agent 生态里，skill 通常指可复用能力包，往往封装了提示词、工具调用、工作流或连接器，不是泛泛的“个人技能”二字。',
        prep_direction:'如果 JD 把 skill 放在 Agent 语境里，回答要往“能力封装、复用、调用门槛和生态扩展”上靠，而不是只说候选人的软硬技能。',
        interview_focus:[
            '区分 Agent skill 与个人 skill set',
            '准备解释为什么企业会把能力做成可复用模块',
            '准备讲标准化、复用率、接入成本和生态扩展'
        ],
        sources:[
            'OpenClaw Docs：Skills / Plugins / Tools 相关目录'
        ]
    },
    {
        id:'meituan_lobster_install',
        aliases:['龙虾安装'],
        display:'龙虾安装',
        requiresAny:['美团'],
        meaning:'公开报道里，“龙虾安装”指围绕 OpenClaw 部署的安装/代部署服务入口，反映的是 Agent 从极客工具走向服务商品化的趋势。',
        prep_direction:'如果美团相关 JD 提到它，更值得讲的是平台如何把复杂的 Agent 部署流程服务化、标准化、可交易化。',
        interview_focus:[
            '从“技术能力”转译到“服务商品化”和“履约体验”',
            '思考用户是谁：个人极客、商家、企业还是平台服务商',
            '思考平台怎么降低接入门槛并控制售后与风险'
        ],
        sources:[
            '证券时报：美团“龙虾安装”相关报道'
        ]
    }
];

function isGuestExperienceMode(){
    return !!(window.rtGuestStore&&window.rtGuestStore.isEnabled&&window.rtGuestStore.isEnabled());
}

function getPrepareBillingConfig(){
    const runtime=window.RT_BILLING_CONFIG||{};
    const normalizeMethods=function(methods){
        const list=Array.isArray(methods)?methods:[];
        const alipay=list.find(function(method){
            return normalizePrepareText(method&&method.key||'').toLowerCase()==='alipay';
        });
        return [alipay||{key:'alipay',label:'支付宝'}];
    };
    return {
        provider:runtime.provider||DEFAULT_BILLING_CONFIG.provider,
        mode:runtime.mode||DEFAULT_BILLING_CONFIG.mode,
        functionName:runtime.functionName||DEFAULT_BILLING_CONFIG.functionName,
        note:DEFAULT_BILLING_CONFIG.note,
        plans:{
            monthly:{
                label:runtime?.plans?.monthly?.label||DEFAULT_BILLING_CONFIG.plans.monthly.label,
                methods:normalizeMethods(
                    Array.isArray(runtime?.plans?.monthly?.methods)&&runtime.plans.monthly.methods.length
                        ? runtime.plans.monthly.methods
                        : DEFAULT_BILLING_CONFIG.plans.monthly.methods
                )
            },
            lifetime:{
                label:runtime?.plans?.lifetime?.label||DEFAULT_BILLING_CONFIG.plans.lifetime.label,
                methods:normalizeMethods(
                    Array.isArray(runtime?.plans?.lifetime?.methods)&&runtime.plans.lifetime.methods.length
                        ? runtime.plans.lifetime.methods
                        : DEFAULT_BILLING_CONFIG.plans.lifetime.methods
                )
            }
        }
    };
}

function getAccountMembershipKey(account){
    if(!account)return'trial';
    if(account.is_lifetime||account.membership_tier==='lifetime')return'lifetime';
    if(account.membership_tier==='monthly')return'monthly';
    return'trial';
}

function getMembershipRemainingDays(account){
    if(!account||!account.membership_expires_at)return null;
    const expiresAt=new Date(account.membership_expires_at).getTime();
    if(Number.isNaN(expiresAt))return null;
    return Math.max(0,Math.ceil((expiresAt-Date.now())/86400000));
}

function getAccountMembershipLabel(account){
    const membership=getAccountMembershipKey(account);
    if(membership==='lifetime')return'永久会员';
    if(membership==='monthly')return'月会员';
    return'试用中';
}

function getPrepareQuotaSnapshot(account){
    const trial=1;
    const used=typeof account?.used_prepare_credits==='number'&&account.used_prepare_credits>=0
        ?account.used_prepare_credits
        :0;
    const authMode=account?.auth_mode||((account?.auth_user_id||account?.email)?'registered':'guest');
    const bonus=authMode==='registered'?1:0;
    const total=trial+bonus;
    const remaining=Math.max(total-used,0);
    return{trial,bonus,used,total,remaining,authMode};
}

function getAccountEntitlementText(account){
    if(!account)return'当前账号信息还没同步完成。';
    const membership=getAccountMembershipKey(account);
    if(membership==='lifetime')return'永久会员，准备功能不限次。';
    if(membership==='monthly'){
        const remainingDays=getMembershipRemainingDays(account);
        const baseText=remainingDays===null?'月会员，准备功能不限次。':(remainingDays>0
            ? `月会员还剩 ${remainingDays} 天。`
            : '月会员已到期。');
        return baseText;
    }
    const quota=getPrepareQuotaSnapshot(account);
    if(quota.authMode==='registered'){
        return `当前可用 ${quota.remaining}/${quota.total} 次。`;
    }
    return `当前可用 ${quota.remaining}/1 次。注册后再送 1 次。`;
}

function accountHasFormalAccess(account){
    if(!account)return false;
    if(account.has_paid_access)return true;
    if(account.is_lifetime||account.membership_tier==='lifetime')return true;
    if(account.membership_tier==='monthly'){
        if(!account.membership_expires_at)return true;
        const expiry=new Date(account.membership_expires_at).getTime();
        return !Number.isNaN(expiry)&&expiry>Date.now();
    }
    return false;
}

function renderPrepareAccessBanner(account,options){
    const opts=Object.assign({showRegister:false},options||{});
    const membershipLabel=getAccountMembershipLabel(account);
    const quota=getPrepareQuotaSnapshot(account);
    const isGuest=isGuestExperienceMode();
    const hasPaidAccess=accountHasFormalAccess(account);
    const noTrialLeft=!hasPaidAccess&&quota.remaining<=0;
    const detailText=noTrialLeft
        ? (isGuest
            ? '试用机会已经用完了。要不要现在充值继续用，或者先注册再领 1 次额外准备机会？'
            : '试用机会已经用完了。要不要现在充值继续使用这套准备工作台？')
        : getAccountEntitlementText(account);
    const ctaText=membershipLabel==='月会员'
        ? '续费 / 升级'
        : (membershipLabel==='永久会员'
            ? ''
            : (noTrialLeft?'去充值':'开通会员'));
    const supportingText=membershipLabel==='月会员'
        ? '可续 30 天，或升级永久会员。'
        : '';
    if(opts.compactPaid&&hasPaidAccess&&!noTrialLeft){
        return `
            <div class="prepare-access-banner is-compact">
                <div class="prepare-access-banner-copy">
                    <strong>${escapeHTML(membershipLabel)}</strong>
                    <p>${escapeHTML(detailText)}${supportingText?` ${escapeHTML(supportingText)}`:''}</p>
                </div>
                <div class="prepare-access-banner-actions">
                    <span class="prepare-access-badge">${escapeHTML(membershipLabel)}</span>
                    ${membershipLabel==='lifetime'
                        ? ''
                        : `<button type="button" class="btn-secondary btn-sm" id="prepare-banner-upgrade">${escapeHTML(ctaText)}</button>`}
                </div>
            </div>
        `;
    }
    return `
        <div class="prepare-access-banner${noTrialLeft?' is-paywall':''}">
            <div class="prepare-access-banner-copy">
                <strong>${escapeHTML(noTrialLeft?'试用次数已用完':`准备权益：${membershipLabel}`)}</strong>
                <p>${escapeHTML(detailText)}${supportingText?` ${escapeHTML(supportingText)}`:''}</p>
            </div>
            <div class="prepare-access-banner-actions">
                <span class="prepare-access-badge">${escapeHTML(noTrialLeft?'试用已用完':membershipLabel)}</span>
                ${opts.showRegister&&isGuest?'<button type="button" class="btn-secondary btn-sm" id="prepare-banner-register">先注册账号</button>':''}
                ${membershipLabel==='永久会员'
                    ? ''
                    : `<button type="button" class="btn-primary btn-sm" id="prepare-banner-upgrade">${escapeHTML(ctaText)}</button>`}
            </div>
        </div>
    `;
}

async function openMembershipCheckout(planKey,methodKey){
    const config=getPrepareBillingConfig();
    const methods=config?.plans?.[planKey]?.methods||[];
    const method=methods.find(item=>item&&item.key===methodKey)||null;
    const href=safeHttpUrl(method&&method.href||'');
    if(typeof window.rtTrackEvent==='function'){
        window.rtTrackEvent('rt_membership_checkout_clicked',{
            plan:planKey,
            method:methodKey,
            guest_mode:isGuestExperienceMode(),
            provider:config.provider||'Hosted Checkout'
        });
    }
    if(isGuestExperienceMode()&&typeof window.rtStartUpgradeRegistration==='function'){
        closePrepareUpgradeModal();
        window.rtStartUpgradeRegistration();
        return;
    }
    if((config.mode||'')==='supabase_edge'&&window.rtAccountService&&typeof window.rtAccountService.startMembershipCheckout==='function'){
        try{
            await window.rtAccountService.startMembershipCheckout(planKey,{
                methodKey:methodKey,
                functionName:config.functionName||'stripe-create-checkout'
            });
            closePrepareUpgradeModal();
            return;
        }catch(error){
            toast(error instanceof Error?error.message:String(error),'error');
            return;
        }
    }
    if(!href){
        toast('支付还没配置完成。请先在 Stripe 和 Supabase 后台补齐结账与 Webhook 配置。','error');
        return;
    }
    window.open(href,'_blank','noopener');
    closePrepareUpgradeModal();
}

function closePrepareUpgradeModal(){
    $('#prepare-upgrade-overlay')?.classList.remove('active');
}

function openPrepareUpgradeModal(accessPayload){
    const overlay=$('#prepare-upgrade-overlay');
    if(!overlay)return;
    const account=accessPayload&&accessPayload.account||window.rtReadCachedAccount&&window.rtReadCachedAccount()||null;
    const membership=getAccountMembershipKey(account);
    if(membership==='lifetime'){
        toast('当前账号已经是永久会员，无需再次开通。','success');
        return;
    }
    const quota=getPrepareQuotaSnapshot(account);
    const hasPaid=!!(account&&account.has_paid_access);
    const title=$('#prepare-upgrade-title');
    const desc=$('#prepare-upgrade-desc');
    const meta=$('#prepare-upgrade-meta');
    const cards=$('#prepare-upgrade-plans');
    const guestHint=$('#prepare-upgrade-guest-hint');
    const paymentNote=$('#prepare-upgrade-payment-note');
    const registerBtn=$('#prepare-upgrade-register');
    const billingConfig=getPrepareBillingConfig();
    if(title)title.textContent=membership==='monthly'
        ?'升级或续费会员'
        :(quota.remaining>0?'准备体验说明':'试用次数已用完');
    if(desc)desc.textContent=membership==='monthly'
        ? '月会员可继续续费或升级永久会员。'
        : (quota.remaining>0
            ? `当前可用 ${quota.remaining}/${quota.total} 次。`
            : '这套准备的试用机会已经用完了，要不要现在开通继续使用？');
    if(meta)meta.textContent=membership==='monthly'
        ? getAccountEntitlementText(account)
        : (quota.remaining>0
            ? `已用 ${quota.used} 次，还剩 ${quota.remaining} 次。`
            : (isGuestExperienceMode()
                ? '当前体验额度已用完。你也可以先注册，再领取 1 次额外准备机会。'
                : '当前试用额度已全部使用，开通后可继续生成准备、问题与回答。'));
    if(guestHint){
        guestHint.style.display=isGuestExperienceMode()?'':'none';
        guestHint.textContent='体验模式可先注册，注册后再继续。';
    }
    if(paymentNote){
        paymentNote.style.display='block';
        paymentNote.textContent=`支付方式：${billingConfig.note}`;
    }
    if(registerBtn)registerBtn.style.display=isGuestExperienceMode()?'inline-flex':'none';
    if(cards){
        const visiblePlans=membership==='monthly'
            ? PREPARE_MEMBERSHIP_PLANS.filter(plan=>plan.membershipTier==='monthly'||plan.membershipTier==='lifetime')
            : PREPARE_MEMBERSHIP_PLANS;
        cards.innerHTML=visiblePlans.map(function(plan){
            const configPlan=billingConfig?.plans?.[plan.membershipTier]||{};
            const methods=configPlan.methods||[];
            return `<div class="prepare-upgrade-plan">
                <span class="prepare-upgrade-plan-kicker">${escapeHTML(configPlan.label||plan.label)}</span>
                <strong>${escapeHTML(plan.price)}</strong>
                <span>${escapeHTML(plan.summary)}</span>
                <div class="prepare-upgrade-plan-methods">
                    ${methods.map(function(method){
                        const href=safeHttpUrl(method&&method.href||'');
                        const edgeMode=(billingConfig.mode||'')==='supabase_edge';
                        return `<button type="button" class="prepare-upgrade-method-btn${href||edgeMode?'':' is-disabled'}" data-upgrade-plan="${plan.membershipTier}" data-upgrade-method="${escapeHTML(method.key||'')}">${escapeHTML(method.label||'支付')}</button>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('');
        $$('[data-upgrade-plan]').forEach(function(button){
            button.addEventListener('click',function(){
                const plan=this.dataset.upgradePlan||'monthly';
                const method=this.dataset.upgradeMethod||'alipay';
                openMembershipCheckout(plan,method);
            });
        });
    }
    overlay.classList.add('active');
}

async function ensurePrepareExperienceAccess(sessionKey){
    if(!window.rtAccountService||typeof window.rtAccountService.consumePrepareAccess!=='function'){
        return {allowed:true,account:window.rtReadCachedAccount&&window.rtReadCachedAccount()||null};
    }
    try{
        const access=await window.rtAccountService.consumePrepareAccess(sessionKey);
        if(access&&accountHasFormalAccess(access.account||null)){
            return Object.assign({},access,{allowed:true});
        }
        if(access&&access.allowed===false)openPrepareUpgradeModal(access);
        return access||{allowed:true};
    }catch(error){
        const cachedAccount=window.rtReadCachedAccount&&window.rtReadCachedAccount()||null;
        if(accountHasFormalAccess(cachedAccount)){
            return {allowed:true,account:cachedAccount,recoveredFromError:true};
        }
        toast(error instanceof Error?error.message:String(error),'error');
        return {allowed:false,error:error instanceof Error?error.message:String(error)};
    }
}
$('#prepare-upgrade-close')?.addEventListener('click',closePrepareUpgradeModal);
$('#prepare-upgrade-dismiss')?.addEventListener('click',closePrepareUpgradeModal);
$('#prepare-upgrade-overlay')?.addEventListener('click',function(event){
    if(event.target===event.currentTarget)closePrepareUpgradeModal();
});
$('#prepare-upgrade-register')?.addEventListener('click',function(){
    closePrepareUpgradeModal();
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_prepare_upgrade_register_clicked',{entry:'prepare_paywall'});
    if(typeof window.rtStartUpgradeRegistration==='function')window.rtStartUpgradeRegistration();
});

async function handleBillingReturnState(){
    let url;
    try{
        url=new URL(window.location.href);
    }catch(error){
        return;
    }
    const status=url.searchParams.get('billing');
    if(!status)return;
    const plan=url.searchParams.get('plan')||'monthly';
    if(status==='success'){
        toast(plan==='lifetime'?'支付成功，永久会员已开通。':'支付成功，30 天会员已开通。','success');
        if(window.rtAccountService&&typeof window.rtAccountService.ensureAccount==='function'){
            window.rtAccountService.ensureAccount({input_source_channel:'billing_return'}).catch(function(err){
                console.warn('[RT billing] refresh account after payment failed',err);
            });
        }
    }else if(status==='cancel'){
        toast('你已取消支付，稍后仍可继续开通。','info');
    }else if(status==='error'){
        toast('支付结果还没同步完成，请稍后刷新个人中心查看。','error');
    }
    url.searchParams.delete('billing');
    url.searchParams.delete('plan');
    window.history.replaceState({},document.title,url.toString());
}
const PREPARE_ANALYSIS_PLAYBOOKS=[
    {
        id:'general_role',
        name:'通用岗位拆解',
        triggers:[],
        checklist:[
            '先判断岗位服务的核心业务目标，而不是只复述 JD',
            '拆清楚目标用户、使用场景、关键流程和成功指标',
            '把岗位要求映射成能力项、证据项和高风险追问项'
        ]
    },
    {
        id:'resume_mapping',
        name:'简历证据映射',
        triggers:[],
        checklist:[
            '每个结论都要有简历证据支撑，优先使用动作、结果和数字',
            '如果简历没有直接证据，要明确写缺口和补挖方向',
            '回答骨架必须区分真实经历、可迁移能力和待补素材'
        ]
    },
    {
        id:'agent_ai',
        name:'AI Agent / 企业AI产品',
        triggers:['openclaw','龙虾','养虾','养龙虾','智能体','agent','automation','workflow','skill','skills','数字员工'],
        checklist:[
            '判断产品是在做对话、执行、编排还是平台生态',
            '拆清楚任务规划、工具调用、上下文/记忆、权限边界和人工接管机制',
            '评估企业价值时优先看效率提升、流程自动化、复用能力、安全风险和落地门槛'
        ]
    },
    {
        id:'enterprise_b2b',
        name:'企业服务 / B2B',
        triggers:['企业服务','财务数字化','saas','b2b','风控','报销','对账','erp','crm'],
        checklist:[
            '区分购买者、管理员、真实使用者三类角色',
            '分析接入成本、部署方式、权限体系、合规和售后交付',
            '优先回答标准化、ROI、复购和规模化复制'
        ]
    },
    {
        id:'growth_ecommerce',
        name:'增长 / 电商产品',
        triggers:['增长','电商','gmv','转化','留存','商家','供给','营销','活动'],
        checklist:[
            '先拆流量、转化、留存、供给和履约等增长杠杆',
            '明确核心指标和次级指标，不要只说抽象增长',
            '同时看用户价值、商家价值和平台效率'
        ]
    }
];
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
    if(btn){
        const isDesc=kanbanSortDirection==='desc';
        btn.textContent=isDesc?'↓':'↑';
        btn.setAttribute('aria-label',isDesc?'排序方向：从大到小':'排序方向：从小到大');
        btn.setAttribute('title',isDesc?'排序方向：从大到小':'排序方向：从小到大');
    }
}

function setTableSort(columnId){
    if(!columnId)return;
    if(tableSortColumn===columnId)tableSortDirection=tableSortDirection==='asc'?'desc':'asc';
    else{
        tableSortColumn=columnId;
        tableSortDirection=['waiting','preference_level','applied_date','created_at'].includes(columnId)?'desc':'asc';
    }
    renderTable(getBoardSearchQuery());
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

function getBoardSearchQuery(){
    return '';
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
    const sortCol=document.getElementById('table-sort-column');
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
function getPrepareSessionsSorted(){
    return normalizePrepareSessionCollection(store.prepareSessions);
}
let prepareHistoryTrimmedOnce=false;
function ensurePrepareSessionHistoryLimit(){
    const normalized=normalizePrepareSessionCollection(store.prepareSessions);
    if(normalized.length===store.prepareSessions.length&&prepareHistoryTrimmedOnce)return;
    const changed=normalized.length!==store.prepareSessions.length||normalized.some(function(item,index){
        return store.prepareSessions[index]?.id!==item.id;
    });
    if(!changed){
        prepareHistoryTrimmedOnce=true;
        return;
    }
    store.prepareSessions=normalized;
    prepareHistoryTrimmedOnce=true;
    void store.save('prepare.trimHistory');
}
function getPrepareSelectedSession(){
    ensurePrepareSessionHistoryLimit();
    const sessions=getPrepareSessionsSorted();
    if(!sessions.length){
        prepareState.selectedSessionId=null;
        prepareState.lastOpenedSessionId='';
        return null;
    }
    const current=prepareState.selectedSessionId?store.getPrepareSession(prepareState.selectedSessionId):null;
    if(current)return current;
    resetPrepareWorkspaceState(sessions[0].id);
    return sessions[0];
}
function getPrepareLinkedApp(session){
    return session&&session.application_id?store.getApp(session.application_id):null;
}
function getPrepareLinkedResume(session){
    if(!session)return null;
    if(session.resume_id)return store.getResume(session.resume_id);
    return null;
}
function getStoredPrepareRuntimeConfig(){
    try{
        const raw=localStorage.getItem(PREPARE_RUNTIME_CONFIG_KEY);
        return raw?JSON.parse(raw):{};
    }catch(error){
        return{};
    }
}
function savePrepareRuntimeConfig(patch){
    const next=Object.assign({},getStoredPrepareRuntimeConfig(),patch||{});
    try{
        localStorage.setItem(PREPARE_RUNTIME_CONFIG_KEY,JSON.stringify(next));
    }catch(error){}
    return next;
}
function getPrepareConfig(){
    const isLocalPreview=location.protocol==='file:'||/^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
    const defaults={
        mode:isLocalPreview?'server':'supabase_edge',
        functionName:'prepare-ai',
        apiBase:'http://127.0.0.1:8788',
        directBaseUrl:'https://api.deepseek.com',
        provider:'DeepSeek',
        model:'deepseek-v4-flash',
        apiKey:''
    };
    const runtime=window.RT_PREPARE_CONFIG||{};
    const stored=getStoredPrepareRuntimeConfig();
    return Object.assign({},defaults,runtime,stored,{model:'deepseek-v4-flash'});
}
function getPrepareApiBase(){
    return String(getPrepareConfig().apiBase||'http://127.0.0.1:8788').replace(/\/+$/,'');
}
function getPrepareDirectBase(){
    return String(getPrepareConfig().directBaseUrl||'https://api.deepseek.com').replace(/\/+$/,'');
}
function normalizePrepareText(value){
    return String(value||'').trim();
}
function hasPrepareUsableJd(value){
    return normalizePrepareText(value).length>=PREP_MIN_JD_LENGTH;
}
function getPrepareFrameworkMeta(key){
    return PREP_FRAMEWORKS.find(item=>item.key===key)||PREP_FRAMEWORKS[0];
}
function inferPrepareQuestionFrameworks(question){
    const type=normalizePrepareText(question?.question_type||'').toLowerCase();
    const text=normalizePrepareText(question?.question||'');
    let recommended=[];
    let defaultFramework='PREP';
    let reason='这道题更适合先亮判断，再按结构展开。';
    if(type==='reverse_question'||/反问|问面试官|你可以问|要问面试官/.test(text)){
        recommended=['PREP','SCQA'];
        defaultFramework='PREP';
        reason='这类题属于反问环节，重点不是回答，而是先把问题问清楚、问到位。';
    }else
    if(type==='resume_deep_dive'||type==='behavioral'||/讲.*经历|哪一段经历|举例|项目|具体负责|最后结果|冲突|失败|成就|影响别人|资源有限|压力|挫折|带领|领导/.test(text)){
        recommended=['STAR','PAR','PREP'];
        defaultFramework='STAR';
        reason='这道题核心在经历与结果，优先用 STAR 或 PAR 把背景、动作和结果讲扎实。';
    }else if(type==='case'||/怎么拆|如何判断|你会怎么做|指标|下滑|策略|优先级|为什么/.test(text)){
        recommended=['SCQA','PREP','PAR'];
        defaultFramework='SCQA';
        reason='这道题更看结构化判断，SCQA 或 PREP 会比 STAR 更自然。';
    }else if(type==='role_understanding'||type==='company_fit'||/为什么是|怎么理解|怎么看|为什么想来/.test(text)){
        recommended=['PREP','SCQA'];
        defaultFramework='PREP';
        reason='这类题先讲观点和判断更重要，不适合硬套 STAR。';
    }else{
        recommended=['PREP','SCQA','PAR'];
        defaultFramework='PREP';
        reason='这类题更适合先给观点，再补逻辑和例子。';
    }
    return{
        recommended_frameworks:recommended,
        default_framework:defaultFramework,
        framework_reason:reason
    };
}
function getPrepareReverseQuestions(session){
    return getPrepareAllQuestions(session).filter(function(question){
        const meta=normalizePrepareQuestionRecord(question);
        return meta.question_type==='reverse_question'||meta.source==='reverse';
    }).map(normalizePrepareQuestionRecord);
}
function normalizePrepareQuestionRecord(question){
    const base=Object.assign({},question||{});
    const inferred=inferPrepareQuestionFrameworks(base);
    const allowed=(Array.isArray(base.recommended_frameworks)?base.recommended_frameworks:[])
        .map(function(item){return normalizePrepareText(item).toUpperCase();})
        .filter(function(item){return ['STAR','PREP','PAR','SCQA'].includes(item);});
    base.recommended_frameworks=allowed.length?allowed:inferred.recommended_frameworks;
    base.default_framework=['STAR','PREP','PAR','SCQA'].includes(normalizePrepareText(base.default_framework).toUpperCase())?normalizePrepareText(base.default_framework).toUpperCase():inferred.default_framework;
    if(!base.recommended_frameworks.includes(base.default_framework))base.default_framework=base.recommended_frameworks[0]||inferred.default_framework;
    base.framework_reason=normalizePrepareText(base.framework_reason||inferred.framework_reason);
    return base;
}
function getPrepareQuestionFrameworks(question){
    return normalizePrepareQuestionRecord(question).recommended_frameworks||['PREP','SCQA'];
}
function getPrepareQuestionDefaultFramework(question){
    return normalizePrepareQuestionRecord(question).default_framework||getPrepareQuestionFrameworks(question)[0]||'PREP';
}
function frameworkMetaFromSelection(selectedFramework,availableFrameworks){
    const current=normalizePrepareText(selectedFramework).toUpperCase();
    const allowed=(availableFrameworks||[]).filter(Boolean);
    if(current&&allowed.includes(current))return current;
    return allowed[0]||'PREP';
}
function getPrepareFreeQuestionKey(text){
    return `free::${normalizePrepareText(text)}`;
}
function getPrepareModelOptions(){
    return[
        {key:'deepseek-v4-flash',label:'V4 Flash',desc:'更快，适合快速试跑和改写。'}
    ];
}
let prepareLoadingTicker=null;
function startPrepareLoading(kind){
    prepareState.loadingKind=kind||'session';
    prepareState.loadingStartedAt=Date.now();
    prepareState.loadingFrame=0;
    syncPrepareLoadingTicker();
}
function stopPrepareLoading(){
    prepareState.loadingKind='';
    prepareState.loadingStartedAt=0;
    prepareState.loadingFrame=0;
    syncPrepareLoadingTicker();
}
function syncPrepareLoadingTicker(){
    const shouldRun=(prepareState.sessionLoading||prepareState.answerLoading)&&curView==='prepare';
    if(shouldRun&&!prepareLoadingTicker){
        prepareLoadingTicker=window.setInterval(function(){
            prepareState.loadingFrame+=1;
            if(curView==='prepare')renderPrepare();
        },900);
    }else if(!shouldRun&&prepareLoadingTicker){
        window.clearInterval(prepareLoadingTicker);
        prepareLoadingTicker=null;
    }
}
function getPrepareLoadingDescriptor(kind){
    const elapsed=Math.max(0,Date.now()-(prepareState.loadingStartedAt||Date.now()));
    const phaseCursor=Math.floor(elapsed/1900);
    const streamCursor=Math.floor(elapsed/1400);
    const descriptors={
        session:{
            badge:'Preparing',
            title:'正在编织这场面试的准备工作台',
            subtitle:'我们会先读 JD 和简历，再拆业务、抓重点、生成问题与回答骨架。',
            phases:[
                {title:'读取岗位与简历',detail:'校验 JD、抓取简历证据、建立岗位上下文。'},
                {title:'联网核实业务名词',detail:'补足专有名词、平台名、业务语境与公开背景。'},
                {title:'映射经历与风险',detail:'筛出最该讲的经历、缺口和高风险追问点。'},
                {title:'编排完整工作台',detail:'落出背调、重点、问题和回答骨架。'}
            ],
            stream:[
                '正在拆解岗位目标、核心场景与业务链路…',
                '正在把简历里的动作、结果和指标映射到岗位要求…',
                '正在联网确认专有名词、平台能力与真实业务语境…',
                '正在生成更像面试现场的追问与回答结构…'
            ]
        },
        answer:{
            badge:'Shaping',
            title:'正在打磨一版可直接开讲的回答骨架',
            subtitle:'这次会优先回扣简历证据、岗位目标和面试官真正想验证的点。',
            phases:[
                {title:'定位题目意图',detail:'先判断这是经历题、判断题、还是 case 题。'},
                {title:'提取简历证据',detail:'优先使用真实经历、结果数字与可迁移能力。'},
                {title:'补足公开背景',detail:'遇到陌生术语时先查，再决定回答角度。'},
                {title:'组织表达结构',detail:'按模板输出主线、要点和表达提醒。'}
            ],
            stream:[
                '正在把问题翻译成面试官真正要验证的能力…',
                '正在从简历里挑最能撑住这题的证据与数字…',
                '正在把公开背景和岗位语境压进回答主线…',
                '正在压缩成更自然、更能开口的表达节奏…'
            ]
        }
    };
    const config=descriptors[kind]||descriptors.session;
    return{
        badge:config.badge,
        title:config.title,
        subtitle:config.subtitle,
        phases:config.phases.map(function(phase,index){
            return Object.assign({},phase,{
                state:index<phaseCursor?'done':index===phaseCursor?'active':'idle'
            });
        }),
        streamText:config.stream[streamCursor%config.stream.length],
        skeletonCount:kind==='answer'?3:4
    };
}
function renderPrepareLoadingScene(kind){
    const descriptor=getPrepareLoadingDescriptor(kind);
    return `
        <div class="prepare-stream-shell">
            <div class="prepare-stream-orb prepare-stream-orb-a"></div>
            <div class="prepare-stream-orb prepare-stream-orb-b"></div>
            <div class="prepare-stream-head">
                <span class="prepare-stream-badge">${escapeHTML(descriptor.badge)}</span>
                <h3>${escapeHTML(descriptor.title)}</h3>
                <p>${escapeHTML(descriptor.subtitle)}</p>
            </div>
            <div class="prepare-stream-live">
                <span class="prepare-stream-live-dot"></span>
                <strong>实时生成中</strong>
                <em>${escapeHTML(descriptor.streamText)}</em>
            </div>
            <div class="prepare-stream-phases">
                ${descriptor.phases.map(function(phase,index){
                    return `
                        <div class="prepare-stream-phase is-${phase.state}">
                            <span>${index+1}</span>
                            <div>
                                <strong>${escapeHTML(phase.title)}</strong>
                                <p>${escapeHTML(phase.detail)}</p>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="prepare-stream-skeleton">
                ${Array.from({length:descriptor.skeletonCount}).map(function(_,index){
                    return `<div class="prepare-stream-card"><i class="prepare-stream-line w-${index%4}"></i><i class="prepare-stream-line w-${(index+1)%4}"></i><i class="prepare-stream-line w-${(index+2)%4}"></i></div>`;
                }).join('')}
            </div>
        </div>
    `;
}
function normalizeResumeExtractedText(value){
    return String(value||'')
        .replace(/\r\n?/g,'\n')
        .replace(/\u0000/g,'')
        .replace(/\bHYPERLINK\s+"[^"]*"/gi,'')
        .replace(/\bTOC\s+\\o\s+"[^"]*"/gi,'')
        .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g,'$1$2')
        .replace(/([\u4e00-\u9fff])\s+([，。；：！？、])/g,'$1$2')
        .replace(/([（(])\s+([\u4e00-\u9fffA-Za-z0-9])/g,'$1$2')
        .replace(/([\u4e00-\u9fffA-Za-z0-9])\s+([）)])/g,'$1$2')
        .replace(/[ \t]+\n/g,'\n')
        .replace(/\n{3,}/g,'\n\n')
        .trim();
}
function scorePrepareExtractedTextQuality(value){
    const text=normalizeResumeExtractedText(value);
    if(!text)return 0;
    const visible=text.replace(/\s+/g,'');
    const total=visible.length||1;
    const meaningful=(visible.match(/[A-Za-z0-9\u00C0-\u024F\u4e00-\u9fff]/g)||[]).length;
    const suspicious=(visible.match(/[\uFFFD\uE000-\uF8FF]/g)||[]).length;
    const lines=text.split('\n').filter(Boolean);
    const denseLines=lines.filter(function(line){
        return /[A-Za-z0-9\u4e00-\u9fff]{4,}/.test(line);
    }).length;
    const meaningfulRatio=meaningful/total;
    const suspiciousPenalty=suspicious/total;
    const lineBonus=Math.min(.2,denseLines/Math.max(1,lines.length||1)*.2);
    return meaningfulRatio-suspiciousPenalty+lineBonus;
}
function normalizePrepareLookupText(value){
    return String(value||'').toLowerCase().replace(/\s+/g,' ').trim();
}
function prepareTextIncludesAlias(haystack,alias){
    const source=normalizePrepareLookupText(haystack);
    const target=normalizePrepareLookupText(alias);
    if(!source||!target)return false;
    return source.includes(target);
}
function getPrepareKnownTermBriefs(input){
    const combinedText=[
        input?.company_name,
        input?.role_name,
        input?.role_category,
        input?.jd_text,
        input?.resume_text
    ].filter(Boolean).join('\n');
    return PREPARE_KNOWN_TERM_BRIEFS.filter(function(brief){
        const hasAlias=(brief.aliases||[]).some(function(alias){
            return prepareTextIncludesAlias(combinedText,alias);
        });
        if(!hasAlias)return false;
        const required=(brief.requiresAny||[]);
        if(!required.length)return true;
        return required.some(function(alias){
            return prepareTextIncludesAlias(combinedText,alias);
        });
    }).map(function(brief){
        return{
            term:brief.display,
            aliases:brief.aliases||[],
            meaning:brief.meaning,
            prep_direction:brief.prep_direction,
            interview_focus:brief.interview_focus||[],
            sources:brief.sources||[]
        };
    });
}
function getPrepareAnalysisPlaybooks(input){
    const combinedText=[
        input?.company_name,
        input?.role_name,
        input?.role_category,
        input?.jd_text,
        input?.resume_text
    ].filter(Boolean).join('\n');
    return PREPARE_ANALYSIS_PLAYBOOKS.filter(function(playbook){
        const triggers=playbook.triggers||[];
        if(!triggers.length)return true;
        return triggers.some(function(trigger){
            return prepareTextIncludesAlias(combinedText,trigger);
        });
    }).map(function(playbook){
        return{
            name:playbook.name,
            checklist:playbook.checklist||[]
        };
    });
}
function decodePrepareHtml(value){
    const raw=String(value||'');
    if(!raw)return'';
    const el=document.createElement('textarea');
    el.innerHTML=raw.replace(/<br\s*\/?>/gi,'\n');
    return normalizePrepareText(el.value||el.textContent||'');
}
function normalizePrepareLookupQuery(value){
    return String(value||'').replace(/\s+/g,' ').trim();
}
function getPrepareLookupCache(){
    try{
        const raw=localStorage.getItem(PREPARE_WEB_LOOKUP_CACHE_KEY);
        return raw?JSON.parse(raw):{};
    }catch(error){
        return{};
    }
}
function readPrepareLookupCache(query){
    const key=normalizePrepareLookupQuery(query).toLowerCase();
    if(!key)return null;
    const cache=getPrepareLookupCache();
    return cache[key]||null;
}
function writePrepareLookupCache(query,payload){
    const key=normalizePrepareLookupQuery(query).toLowerCase();
    if(!key||!payload)return;
    const cache=getPrepareLookupCache();
    cache[key]=Object.assign({cached_at:new Date().toISOString()},payload);
    const entries=Object.entries(cache).sort(function(a,b){
        return new Date(b[1]?.cached_at||0).getTime()-new Date(a[1]?.cached_at||0).getTime();
    }).slice(0,24);
    const next={};
    entries.forEach(function(entry){
        next[entry[0]]=entry[1];
    });
    try{
        localStorage.setItem(PREPARE_WEB_LOOKUP_CACHE_KEY,JSON.stringify(next));
    }catch(error){}
}
async function fetchPrepareLookupJson(url,label){
    let response;
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeoutId=controller?setTimeout(function(){
        try{controller.abort();}catch(error){}
    },PREPARE_WEB_LOOKUP_TIMEOUT_MS):null;
    try{
        response=await fetch(url,{
            headers:{Accept:'application/json'},
            signal:controller?controller.signal:undefined
        });
    }catch(error){
        throw new Error(`${label} 请求失败`);
    }finally{
        if(timeoutId)clearTimeout(timeoutId);
    }
    const data=await response.json().catch(function(){return{};});
    if(!response.ok){
        throw new Error(`${label} 请求失败（${response.status}）`);
    }
    return data||{};
}
async function fetchPrepareTextWithTimeout(url,label,timeoutMs){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeoutId=controller?setTimeout(function(){
        try{controller.abort();}catch(error){}
    },timeoutMs||PREPARE_INTELLIGENCE_TIMEOUT_MS):null;
    try{
        const response=await fetch(url,{
            headers:{Accept:'text/plain, text/markdown, application/json;q=0.9, */*;q=0.8'},
            signal:controller?controller.signal:undefined
        });
        const text=await response.text().catch(function(){return'';});
        if(!response.ok)throw new Error(`${label||'请求'}失败（${response.status}）`);
        return text;
    }finally{
        if(timeoutId)clearTimeout(timeoutId);
    }
}
function normalizePrepareUrl(value){
    const raw=normalizePrepareText(value);
    if(!raw)return'';
    return /^https?:\/\//i.test(raw)?raw:`https://${raw}`;
}
function buildPrepareJdReaderUrls(rawUrl){
    const url=normalizePrepareUrl(rawUrl);
    if(!url)return[];
    const stripped=url.replace(/^https?:\/\//i,'').replace(/^\/+/,'');
    const urls=[
        `https://r.jina.ai/http://${stripped}`,
        `https://r.jina.ai/http://${url}`
    ];
    return [...new Set(urls)];
}
function normalizePrepareReaderText(value){
    return String(value||'')
        .replace(/\r\n?/g,'\n')
        .replace(/^Title:\s*/gim,'')
        .replace(/^URL Source:\s*.*$/gim,'')
        .replace(/^Markdown Content:\s*/gim,'')
        .replace(/!\[[^\]]*]\([^)]+\)/g,'')
        .replace(/\[[^\]]+]\((?:mailto:|tel:|javascript:)[^)]+\)/gi,'')
        .replace(/\n{3,}/g,'\n\n')
        .trim()
        .slice(0,16000);
}
function buildPrepareJdExtractionMessages(rawUrl,rawText){
    const payload={
        jd_url:normalizePrepareUrl(rawUrl),
        raw_text:normalizePrepareReaderText(rawText)
    };
    return[
        {
            role:'system',
            content:'你是中文招聘信息清洗助手。任务是从网页抓取出来的脏文本里，只保留真正的 JD 正文，并剔除导航、页脚、版权、推荐职位、广告、公司百科、投递按钮文案、乱码、重复段落和无关说明。保留内容优先级：岗位职责、任职要求、加分项、团队介绍、工作地点、汇报对象、核心业务场景。输出必须是纯 JSON，不要 markdown，不要代码块，不要额外解释。schema: {"jd_text":"string"}。要求：1）结果必须是可直接粘贴到面试准备里的 JD 正文；2）不要总结，不要改写成点评，只做提纯；3）如果原文里混有英文、符号或轻微乱码，按最自然的招聘语义修正；4）如果某段明显不是 JD，就删掉；5）如果抓取文本里只有一部分像 JD，也只保留那一部分。'
        },
        {
            role:'user',
            content:`请提纯这段 JD 抓取文本：\n${JSON.stringify(payload,null,2)}`
        }
    ];
}
async function extractPrepareJdTextWithAI(rawUrl,rawText){
    const cleanedRaw=normalizePrepareReaderText(rawText);
    if(cleanedRaw.length<PREP_MIN_JD_LENGTH)return cleanedRaw;
    const output=await requestPrepareCustomAI(
        buildPrepareJdExtractionMessages(rawUrl,cleanedRaw),
        'jd_extract',
        {jd_url:normalizePrepareUrl(rawUrl),raw_text:cleanedRaw}
    );
    const candidate=normalizePrepareReaderText(output?.jd_text||output?.content||output?.text||'');
    if(candidate.length>=PREP_MIN_JD_LENGTH)return candidate;
    throw new Error('AI 没有提取出足够完整的 JD 正文。');
}
async function readPrepareJdFromUrl(rawUrl){
    const attempts=buildPrepareJdReaderUrls(rawUrl);
    if(!attempts.length)throw new Error('请先填 JD 链接。');
    let lastError=null;
    for(const url of attempts){
        try{
            const rawText=normalizePrepareReaderText(await fetchPrepareTextWithTimeout(url,'JD 链接读取',PREPARE_JD_READER_TIMEOUT_MS));
            if(rawText.length>=PREP_MIN_JD_LENGTH){
                try{
                    return await extractPrepareJdTextWithAI(rawUrl,rawText);
                }catch(error){
                    return rawText;
                }
            }
        }catch(error){
            lastError=error;
        }
    }
    throw new Error(lastError instanceof Error?lastError.message:'没有从这个链接读到足够完整的 JD，请手动粘贴正文。');
}
function readPrepareIntelligenceCache(){
    try{
        const raw=localStorage.getItem(PREPARE_INTELLIGENCE_CACHE_KEY);
        return raw?JSON.parse(raw):{};
    }catch(error){
        return{};
    }
}
function writePrepareIntelligenceCache(key,payload){
    if(!key||!payload)return;
    const cache=readPrepareIntelligenceCache();
    cache[key]=Object.assign({cached_at:new Date().toISOString()},payload);
    const entries=Object.entries(cache).sort(function(a,b){
        return new Date(b[1]?.cached_at||0).getTime()-new Date(a[1]?.cached_at||0).getTime();
    }).slice(0,16);
    const next={};
    entries.forEach(function(entry){next[entry[0]]=entry[1];});
    try{localStorage.setItem(PREPARE_INTELLIGENCE_CACHE_KEY,JSON.stringify(next));}catch(error){}
}
function getPrepareIntelligenceCacheKey(input){
    const base=[
        input?.company_name,
        input?.role_name,
        String(input?.jd_text||'').slice(0,700),
        String(input?.resume_text||'').slice(0,700),
        normalizePrepareText(input?.supplemental_experience_summary||'')
    ].join('|').toLowerCase();
    let hash=0;
    for(let index=0;index<base.length;index+=1){
        hash=(hash*31+base.charCodeAt(index))>>>0;
    }
    return `intel_${hash.toString(36)}`;
}
function splitPrepareEvidenceFragments(text){
    return String(text||'')
        .replace(/\r\n?/g,'\n')
        .split(/\n+|(?<=[。；.!?？])\s+/)
        .map(function(item){return normalizePrepareText(item).replace(/^[-•*]\s*/,'');})
        .filter(function(item){return item.length>=18;})
        .slice(0,90);
}
function getPrepareTokenSet(text){
    const raw=String(text||'').toLowerCase();
    const words=(raw.match(/[a-z][a-z0-9+#.-]{2,}|[\u4e00-\u9fa5]{2,8}/g)||[])
        .filter(function(token){
            return !/^(the|and|for|with|from|this|that|your|我们|负责|相关|能力|岗位|公司|团队|项目)$/.test(token);
        });
    return new Set(words);
}
function scorePrepareTextOverlap(source,target){
    const sourceSet=getPrepareTokenSet(source);
    const targetSet=getPrepareTokenSet(target);
    if(!sourceSet.size||!targetSet.size)return 0;
    let hit=0;
    targetSet.forEach(function(token){
        if(sourceSet.has(token)||[...sourceSet].some(function(item){return item.includes(token)||token.includes(item);}))hit+=1;
    });
    return hit/Math.max(6,targetSet.size);
}
function buildPrepareSemanticEvidence(input){
    const target=[input?.role_name,input?.role_category,input?.jd_text].filter(Boolean).join('\n');
    const supplemental=(Array.isArray(input?.supplemental_experiences)?input.supplemental_experiences:[])
        .map(function(item){return item?.content||item?.text||item?.summary||'';})
        .join('\n');
    const fragments=splitPrepareEvidenceFragments([input?.resume_text,supplemental,input?.supplemental_experience_summary].filter(Boolean).join('\n'));
    return fragments.map(function(fragment){
        return{
            text:fragment.slice(0,260),
            score:Number(scorePrepareTextOverlap(fragment,target).toFixed(3)),
            matched_to:normalizePrepareText(input?.role_name||'岗位要求')
        };
    }).filter(function(item){return item.score>0;})
        .sort(function(a,b){return b.score-a.score;})
        .slice(0,10);
}
function buildPrepareRoleStandardLocal(input){
    const jd=normalizePrepareText(input?.jd_text||'');
    const role=normalizePrepareText(input?.role_name||input?.role_category||'目标岗位');
    const combined=`${role}\n${jd}`;
    const rules=[
        {key:'需求与用户洞察',re:/需求|用户|访谈|调研|痛点|场景|PRD|产品方案|需求文档/i,checks:['能把 JD 中的目标用户、业务场景和真实痛点讲清楚','准备 1 套从调研到需求优先级排序的判断口径']},
        {key:'AI / Agent 产品落地',re:/AI|Agent|智能体|大模型|LLM|Copilot|Skill|Prompt|提示词|模型/i,checks:['说明 AI 能力边界、失败兜底、评估指标和上线节奏','准备一个把通用 AI 能力迁移到岗位业务场景的方案']},
        {key:'数据与指标验证',re:/数据|指标|漏斗|增长|留存|转化|分析|A\/B|实验|BI/i,checks:['定义成功指标、过程指标和反向风险指标','准备如何用数据验证功能是否真的创造价值']},
        {key:'跨团队推进',re:/协作|推动|沟通|研发|算法|设计|业务|跨团队|stakeholder/i,checks:['讲清需求如何被研发、算法、业务共同理解','准备冲突处理、范围收敛和节奏管理案例']},
        {key:'业务与行业理解',re:/金融|财务|支付|风控|电商|企业|SaaS|合规|交易|供应链|运营/i,checks:['补齐岗位所在业务链路、核心角色和典型成本/风险','准备把产品动作翻译成业务价值的表达']},
        {key:'商业化与用户增长',re:/商业|收入|付费|会员|增长|获客|留存|活跃|生命周期/i,checks:['准备用户分层、价值主张和转化路径','说明如何找到增长瓶颈并设计实验']},
        {key:'项目管理与交付',re:/上线|落地|交付|迭代|项目管理|排期|版本|质量/i,checks:['准备从目标拆解、排期、验收到复盘的完整流程','明确自己在项目里的角色边界和决策依据']}
    ];
    const matched=rules.filter(function(rule){return rule.re.test(combined);});
    const selected=(matched.length?matched:rules.slice(0,4)).slice(0,6);
    return{
        role,
        capabilities:selected.map(function(rule){return rule.key;}),
        interview_checks:selected.flatMap(function(rule){return rule.checks;}).slice(0,10),
        source:'local_jd_capability_map'
    };
}
async function fetchPrepareEscoHints(input){
    const query=normalizePrepareText(input?.role_name||input?.role_category||'product manager');
    if(!query)return[];
    try{
        const data=await fetchPrepareLookupJson(`https://ec.europa.eu/esco/api/search?text=${encodeURIComponent(query)}&type=skill&language=en&limit=6`,'ESCO 技能标准');
        return (data?._embedded?.results||data?.results||[]).slice(0,6).map(function(item){
            return{
                title:normalizePrepareText(item?.title||item?.preferredLabel?.en||item?.preferredLabel||''),
                description:normalizePrepareText(item?.description?.en||item?.description||''),
                source:'ESCO'
            };
        }).filter(function(item){return item.title;});
    }catch(error){
        return[];
    }
}
async function fetchPrepareCompanyIntel(input){
    const company=normalizePrepareText(input?.company_name||'');
    if(!company)return[];
    const queries=[
        {query:`${company} 公司 业务 最新`,intent:'公司业务和近期重点',language:'zh'},
        {query:`${company} ${normalizePrepareText(input?.role_name||'')} 面试 产品`,intent:'岗位和面试语境',language:'zh'}
    ];
    const settled=await Promise.allSettled(queries.map(async function(query){
        const raw=await runPrepareWebLookup(query);
        const parsed=JSON.parse(raw||'{}');
        return summarizePrepareLookupPayload(parsed);
    }));
    return settled.map(function(result){return result.status==='fulfilled'?result.value:null;})
        .filter(Boolean)
        .slice(0,2);
}
async function buildPrepareIntelligenceDigest(input,kind){
    const cacheKey=getPrepareIntelligenceCacheKey(input);
    const cached=readPrepareIntelligenceCache()[cacheKey];
    if(cached&&Date.now()-new Date(cached.cached_at||0).getTime()<1000*60*60*12)return cached;
    const roleStandard=buildPrepareRoleStandardLocal(input);
    const semanticEvidence=buildPrepareSemanticEvidence(input);
    const [escoHints,companyIntel]=await Promise.all([
        fetchPrepareEscoHints(input),
        kind==='answer'?Promise.resolve([]):fetchPrepareCompanyIntel(input)
    ]);
    const payload={
        role_standard:roleStandard,
        external_skill_standard:escoHints,
        semantic_evidence:semanticEvidence,
        company_intelligence:companyIntel,
        usage_note:'生成重点、问题和回答时，先按 role_standard 判断 JD 要求，再用 semantic_evidence 选择最匹配的真实经历，避免固定套模板或总引用最近经历。'
    };
    writePrepareIntelligenceCache(cacheKey,payload);
    return payload;
}
async function buildPrepareAugmentedPayload(payload,kind){
    try{
        const intelligence=await buildPrepareIntelligenceDigest(payload,kind||'session');
        return Object.assign({},payload,{intelligence_context:intelligence});
    }catch(error){
        return Object.assign({},payload,{intelligence_context:{error:'外部增强暂时不可用，已按本地 JD 与简历继续生成。'}});
    }
}
async function fetchJobBoardJson(url,label,options){
    const timeoutMs=options&&options.timeoutMs?options.timeoutMs:JOB_BOARD_TIMEOUT_MS;
    const fetchOptions=Object.assign({},options||{});
    if(Object.prototype.hasOwnProperty.call(fetchOptions,'timeoutMs'))delete fetchOptions.timeoutMs;
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeoutId=controller?setTimeout(function(){
        try{controller.abort();}catch(error){}
    },timeoutMs):null;
    try{
        const response=await fetch(url,Object.assign({
            headers:{Accept:'application/json'},
            signal:controller?controller.signal:undefined
        },fetchOptions));
        const data=await response.json().catch(function(){return{};});
        if(!response.ok)throw new Error(`${label||'职位源'} 请求失败（${response.status}）`);
        return data||{};
    }finally{
        if(timeoutId)clearTimeout(timeoutId);
    }
}
async function fetchJobBoardText(url,label,options){
    const timeoutMs=options&&options.timeoutMs?options.timeoutMs:JOB_BOARD_TIMEOUT_MS;
    const fetchOptions=Object.assign({},options||{});
    if(Object.prototype.hasOwnProperty.call(fetchOptions,'timeoutMs'))delete fetchOptions.timeoutMs;
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeoutId=controller?setTimeout(function(){
        try{controller.abort();}catch(error){}
    },timeoutMs):null;
    try{
        const response=await fetch(url,Object.assign({
            headers:{Accept:'text/plain, application/json;q=0.9, */*;q=0.8'},
            signal:controller?controller.signal:undefined
        },fetchOptions));
        const text=await response.text();
        if(!response.ok)throw new Error(`${label||'职位源'} 请求失败（${response.status}）`);
        return text||'';
    }finally{
        if(timeoutId)clearTimeout(timeoutId);
    }
}
function buildJinaMirrorUrl(url){
    return `https://r.jina.ai/http://${String(url||'').replace(/^https?:\/\//i,'')}`;
}
function parseJobBoardJsonText(text){
    const raw=String(text||'').trim().replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'');
    if(!raw)return{};
    try{
        return JSON.parse(raw);
    }catch(error){
        const startCandidates=['{','['].map(function(token){
            const index=raw.indexOf(token);
            return index===-1?Number.POSITIVE_INFINITY:index;
        });
        const jsonStart=Math.min.apply(null,startCandidates);
        const jsonEnd=Math.max(raw.lastIndexOf('}'),raw.lastIndexOf(']'));
        if(!Number.isFinite(jsonStart)||jsonEnd<=jsonStart)throw error;
        return JSON.parse(raw.slice(jsonStart,jsonEnd+1));
    }
}
function classifyJobRegion(value){
    const text=String(value||'').toLowerCase();
    if(/香港|hong kong|\bhk\b/.test(text))return'hongkong';
    if(/中国|china|mainland|北京|上海|深圳|广州|杭州|成都|南京|苏州|武汉|西安|厦门|珠海|东莞|天津|重庆/.test(text))return'mainland';
    if(/united states|usa|u\.s\.| us |canada|north america|new york|san francisco|seattle|boston|austin|chicago|toronto|vancouver|california|remote.*(us|canada|north america)/.test(` ${text} `))return'northamerica';
    return'other';
}
function normalizeJobBoardText(value){
    return decodePrepareHtml(String(value||''))
        .replace(/<[^>]+>/g,' ')
        .replace(/\u00a0/g,' ')
        .replace(/&nbsp;/gi,' ')
        .replace(/&amp;/gi,'&')
        .replace(/&mdash;/gi,'—')
        .replace(/\s+/g,' ')
        .trim();
}
function normalizeJobPosting(input){
    const title=normalizePrepareText(input.title);
    const company=normalizePrepareText(input.company);
    const location=normalizePrepareText(input.location);
    const url=normalizePrepareText(input.url);
    if(!title||!company||!url)return null;
    const region=input.region||classifyJobRegion(`${location} ${company}`);
    return{
        id:`job_${company}_${title}_${url}`.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g,'_').slice(0,120),
        title,
        company,
        location,
        region,
        source:normalizePrepareText(input.source||'公开职位 API'),
        url,
        jd_text:normalizePrepareText(input.jd_text||''),
        summary:normalizeJobBoardText(input.summary||input.jd_text||'').slice(0,220),
        updated_at:normalizePrepareText(input.updated_at||''),
        first_seen_at:normalizePrepareText(input.first_seen_at||''),
        last_seen_at:normalizePrepareText(input.last_seen_at||'')
    };
}
function isJobBoardPostingVisible(job){
    const sixtyDaysMs=60*24*60*60*1000;
    const candidates=[job&&job.updated_at,job&&job.last_seen_at,job&&job.first_seen_at]
        .map(function(value){return Date.parse(String(value||''));})
        .filter(Number.isFinite);
    if(!candidates.length)return true;
    return Date.now()-Math.max.apply(null,candidates)<=sixtyDaysMs;
}
function getJobBoardRegionLabel(regionKey){
    const region=JOB_BOARD_REGIONS.find(function(item){return item.key===regionKey;});
    return region&&region.label||'其他地区';
}
function getJobBoardVisibleSummary(job){
    const text=normalizeJobBoardText(job&&job.summary||job&&job.jd_text||'');
    return text.length>108?`${text.slice(0,108)}…`:text;
}
function jobMatchesQuery(job,query){
    const q=normalizePrepareText(query).toLowerCase();
    if(!q)return true;
    return [job.title,job.company,job.location,job.summary,job.jd_text].join(' ').toLowerCase().includes(q);
}
function dedupeJobPostings(items){
    const seen=new Set();
    return(items||[]).filter(function(job){
        if(!job)return false;
        const key=`${job.company}|${job.title}|${job.location}|${job.url}`.toLowerCase();
        if(seen.has(key))return false;
        seen.add(key);
        return true;
    });
}
function compareJobBoardAlpha(a,b){
    const locale=['zh-Hans-CN','en'];
    const companyCmp=String(a.company||'').localeCompare(String(b.company||''),locale,{numeric:true,sensitivity:'base'});
    if(companyCmp)return companyCmp;
    const titleCmp=String(a.title||'').localeCompare(String(b.title||''),locale,{numeric:true,sensitivity:'base'});
    if(titleCmp)return titleCmp;
    const locationCmp=String(a.location||'').localeCompare(String(b.location||''),locale,{numeric:true,sensitivity:'base'});
    if(locationCmp)return locationCmp;
    return String(a.url||'').localeCompare(String(b.url||''),locale,{numeric:true,sensitivity:'base'});
}
function sortJobBoardPostings(items){
    const regionRank={mainland:0,hongkong:1,northamerica:2,other:3};
    return(items||[]).slice().sort(function(a,b){
        const regionCmp=(regionRank[a.region]??9)-(regionRank[b.region]??9);
        if(regionCmp)return regionCmp;
        return compareJobBoardAlpha(a,b);
    });
}
function buildJobBoardRegionCounts(items){
    const counts={mainland:0,hongkong:0,northamerica:0,other:0};
    (items||[]).forEach(function(job){
        const key=job&&job.region||'other';
        counts[key]=(counts[key]||0)+1;
    });
    return counts;
}
function normalizeJobBoardCachePayload(payload){
    const raw=payload&&typeof payload==='object'?payload:{};
    const jobs=sortJobBoardPostings(
        dedupeJobPostings(
            (Array.isArray(raw.jobs)?raw.jobs:[])
                .map(function(item){
                    if(item&&item.title&&item.company&&item.url)return normalizeJobPosting(item);
                    return null;
                })
                .filter(Boolean)
                .filter(isJobBoardPostingVisible)
        )
    );
    return{
        jobs,
        updated_at:normalizePrepareText(raw.updated_at||raw.last_refreshed_at||''),
        source_label:normalizePrepareText(raw.source_label||raw.source||'职位池'),
        source_count:Number(raw.source_count||0)||0
    };
}
async function fetchRemoteJobBoardCache(){
    const url=`${SUPABASE_URL}/rest/v1/${JOB_BOARD_REMOTE_TABLE}?select=payload,updated_at&cache_key=eq.${encodeURIComponent(JOB_BOARD_REMOTE_CACHE_KEY)}&limit=1`;
    const result=await sb.requestJson(url,{
        headers:{
            apikey:SUPABASE_KEY,
            Authorization:`Bearer ${SUPABASE_KEY}`
        }
    });
    if(!result.ok)throw new Error(result.error||'职位缓存读取失败');
    const row=Array.isArray(result.data)?result.data[0]:null;
    if(!row||!row.payload)return null;
    const payload=normalizeJobBoardCachePayload(Object.assign({},row.payload,{
        updated_at:row.payload?.updated_at||row.updated_at||row.payload?.last_refreshed_at||''
    }));
    return payload.jobs.length?payload:null;
}
async function fetchRemoteJobBoardRows(){
    const pageSize=1000;
    const jobs=[];
    let latestSeenAt='';
    for(let offset=0;offset<40000;offset+=pageSize){
        const url=`${SUPABASE_URL}/rest/v1/${JOB_BOARD_REMOTE_JOBS_TABLE}?select=job,last_seen_at&order=company.asc,title.asc&limit=${pageSize}&offset=${offset}`;
        const result=await sb.requestJson(url,{
            headers:{
                apikey:SUPABASE_KEY,
                Authorization:`Bearer ${SUPABASE_KEY}`
            }
        });
        if(!result.ok){
            if(result.status===404)return null;
            throw new Error(result.error||'云端职位池读取失败');
        }
        const rows=Array.isArray(result.data)?result.data:[];
        if(!rows.length)break;
        rows.forEach(function(row){
            const job=row&&row.job&&typeof row.job==='object'?row.job:null;
            if(!job)return;
            const normalized=normalizeJobPosting(Object.assign({},job,{
                last_seen_at:job.last_seen_at||row.last_seen_at||''
            }));
            if(normalized&&isJobBoardPostingVisible(normalized)){
                jobs.push(normalized);
            }
            const seenAt=normalizePrepareText(row.last_seen_at||job.last_seen_at||job.updated_at||'');
            if(seenAt&&Date.parse(seenAt)>Date.parse(latestSeenAt||0))latestSeenAt=seenAt;
        });
        if(rows.length<pageSize)break;
    }
    const normalizedJobs=sortJobBoardPostings(dedupeJobPostings(jobs));
    return normalizedJobs.length?{
        jobs:normalizedJobs,
        updated_at:latestSeenAt||new Date().toISOString(),
        source_label:'云端每日职位池',
        source_count:new Set(normalizedJobs.map(function(job){return job.source;}).filter(Boolean)).size
    }:null;
}
function getBundledJobBoardCache(){
    if(!window.RT_JOB_BOARD_CACHE)return null;
    const payload=normalizeJobBoardCachePayload(window.RT_JOB_BOARD_CACHE);
    return payload.jobs.length?payload:null;
}
async function fetchBundledJobBoardCacheJson(){
    const response=await fetch(`assets/job-board-cache.json?t=${Date.now()}`,{
        method:'GET',
        cache:'no-store'
    });
    if(!response.ok)return null;
    const payload=normalizeJobBoardCachePayload(await response.json().catch(function(){return{};}));
    return payload.jobs.length?payload:null;
}
function buildSharedStoragePublicUrl(bucket,objectPath){
    const encoded=String(objectPath||'')
        .split('/')
        .filter(Boolean)
        .map(function(segment){return encodeURIComponent(segment);})
        .join('/');
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}`;
}
async function fetchSharedJobBoardCache(){
    const response=await fetch(`${buildSharedStoragePublicUrl(JOB_BOARD_SHARED_BUCKET,JOB_BOARD_SHARED_CACHE_PATH)}?t=${Date.now()}`,{
        method:'GET',
        cache:'no-store'
    });
    if(response.status===404)return null;
    if(!response.ok){
        throw new Error(`职位缓存读取失败（${response.status}）`);
    }
    const payload=normalizeJobBoardCachePayload(await response.json().catch(function(){return{};}));
    return payload.jobs.length?payload:null;
}
function getJobBoardPayloadTime(payload){
    const timestamp=Date.parse(payload&&payload.updated_at||'');
    return Number.isFinite(timestamp)?timestamp:0;
}
function pickBestJobBoardCachePayload(payloads){
    const candidates=(payloads||[]).filter(function(payload){
        return payload&&Array.isArray(payload.jobs)&&payload.jobs.length;
    });
    if(!candidates.length)return null;
    return candidates.sort(function(a,b){
        const timeDelta=getJobBoardPayloadTime(b)-getJobBoardPayloadTime(a);
        if(Math.abs(timeDelta)>60*1000)return timeDelta;
        return (b.jobs.length||0)-(a.jobs.length||0);
    })[0];
}
async function loadJobBoardCache(force){
    if(jobBoardState.cacheReady&&!force)return jobBoardState.jobs;
    if(jobBoardState.cachePromise&&!force)return jobBoardState.cachePromise;
    jobBoardState.cachePromise=(async function(){
        const bundledPayload=getBundledJobBoardCache();
        const results=await Promise.allSettled([
            fetchRemoteJobBoardRows(),
            fetchSharedJobBoardCache(),
            fetchRemoteJobBoardCache(),
            fetchBundledJobBoardCacheJson()
        ]);
        const payloads=[bundledPayload];
        results.forEach(function(result,index){
            if(result.status==='fulfilled'){
                payloads.push(result.value);
                return;
            }
            const label=['remote rows','shared storage','remote table','bundled json'][index]||'cache';
            console.warn(`[jobs] ${label} cache unavailable`,result.reason);
        });
        const payload=pickBestJobBoardCachePayload(payloads);
        if(!payload){
            jobBoardState.jobs=[];
            jobBoardState.lastFetchedAt='';
            jobBoardState.sourceLabel='';
            jobBoardState.regionCounts={};
            jobBoardState.jobsVersion='';
            jobBoardState.filteredCacheKey='';
            jobBoardState.filteredJobs=[];
            jobBoardState.cacheReady=false;
            throw new Error('职位缓存暂时为空，请先运行缓存同步。');
        }
        jobBoardState.jobs=payload.jobs;
        jobBoardState.lastFetchedAt=payload.updated_at||'';
        jobBoardState.sourceLabel=payload.source_label||'职位池';
        jobBoardState.page=1;
        jobBoardState.regionCounts=buildJobBoardRegionCounts(payload.jobs);
        jobBoardState.jobsVersion=`${jobBoardState.lastFetchedAt}|${payload.jobs.length}`;
        jobBoardState.filteredCacheKey='';
        jobBoardState.filteredJobs=[];
        jobBoardState.cacheReady=true;
        return payload.jobs;
    })().finally(function(){
        jobBoardState.cachePromise=null;
    });
    return jobBoardState.cachePromise;
}
function getVisibleJobBoardJobs(query){
    const normalizedQuery=normalizePrepareText(query||jobBoardState.query);
    const cacheKey=`${jobBoardState.jobsVersion}|${jobBoardState.activeRegion}|${normalizedQuery}`;
    if(jobBoardState.filteredCacheKey===cacheKey&&Array.isArray(jobBoardState.filteredJobs)){
        return jobBoardState.filteredJobs;
    }
    const jobs=(jobBoardState.jobs||[]).filter(function(job){
        return jobBoardState.activeRegion==='all'||job.region===jobBoardState.activeRegion;
    }).filter(function(job){
        return jobMatchesQuery(job,normalizedQuery);
    });
    jobBoardState.filteredCacheKey=cacheKey;
    jobBoardState.filteredJobs=jobs;
    return jobs;
}
async function fetchZhaopinJson(url,label){
    const mirrored=await fetchJobBoardText(buildJinaMirrorUrl(url),`${label} 镜像`,{
        timeoutMs:16000
    });
    return parseJobBoardJsonText(mirrored);
}
function getZhaopinJobUrl(item){
    const direct=safeHttpUrl(item.positionURL||item.jobUrl||item.url||'');
    if(direct)return direct;
    const number=normalizePrepareText(item.number||item.positionNumber||item.jobNumber||'');
    return number&&/^\d+$/.test(number)?`https://jobs.zhaopin.com/${number}.htm`:'https://www.zhaopin.com/';
}
function mapZhaopinJob(item){
    if(!item||typeof item!=='object')return null;
    const labels=[
        ...(Array.isArray(item.jobLabels)?item.jobLabels:[]),
        ...(Array.isArray(item.welfareTagList)?item.welfareTagList:[])
    ].map(function(label){
        return typeof label==='string'?label:(label?.name||label?.value||'');
    }).filter(Boolean);
    return normalizeJobPosting({
        title:item.jobName||item.positionName||item.jobTitle||item.name,
        company:item.companyName||item.company?.name||item.companyTitle||item.company?.title,
        location:[
            item.cityName,
            item.areaDistrictName,
            item.workCity,
            item.workingCity,
            item.regionCity
        ].filter(Boolean).join(' · '),
        source:'智联招聘 API',
        url:getZhaopinJobUrl(item),
        jd_text:[
            item.jobSummary,
            item.positionLabel,
            labels.join(' / ')
        ].filter(Boolean).join('\n\n'),
        summary:[
            item.jobSummary,
            item.salaryReal,
            item.workingExp?.name||item.workingExpName,
            item.education?.name||item.educationName
        ].filter(Boolean).join(' · '),
        updated_at:item.updateDate||item.refreshTime||item.createTime||''
    });
}
async function fetchTencentJobs(query){
    const keyword=normalizePrepareText(query);
    const tasks=Array.from({length:JOB_BOARD_TENCENT_MAX_PAGES},function(_,index){
        const page=index+1;
        const url=`https://careers.tencent.com/tencentcareer/api/post/Query?timestamp=${Date.now()+page}&keyword=${encodeURIComponent(keyword)}&pageIndex=${page}&pageSize=${JOB_BOARD_TENCENT_PAGE_SIZE}&language=zh-cn&area=cn`;
        return fetchJobBoardText(buildJinaMirrorUrl(url),`腾讯招聘 API 镜像 第 ${page} 页`,{
            timeoutMs:16000
        });
    });
    const settled=await Promise.allSettled(tasks);
    return settled.flatMap(function(result){
        if(result.status!=='fulfilled')return[];
        const data=parseJobBoardJsonText(result.value);
        const posts=data?.Data?.Posts||data?.data?.posts||[];
        return posts.map(function(item){
            const postId=normalizePrepareText(item.PostId||item.postId||'');
            return normalizeJobPosting({
                title:item.RecruitPostName||item.postName||item.title,
                company:'腾讯',
                location:[item.CountryName,item.LocationName,item.WorkPlace].filter(Boolean).join(' · '),
                source:'腾讯招聘 API',
                url:postId?`https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(postId)}`:'https://careers.tencent.com/search.html',
                jd_text:[item.Responsibility,item.Requirement].filter(Boolean).join('\n\n'),
                summary:item.Responsibility||item.Requirement||''
            });
        }).filter(Boolean);
    }).filter(function(job){
        return jobMatchesQuery(job,keyword);
    });
}
async function fetchZhaopinJobs(query){
    const keyword=normalizePrepareText(query);
    const tasks=Array.from({length:JOB_BOARD_MAINLAND_MAX_PAGES},function(_,index){
        const start=index*JOB_BOARD_MAINLAND_PAGE_SIZE;
        const url=`https://fe-api.zhaopin.com/c/i/sou?pageSize=${JOB_BOARD_MAINLAND_PAGE_SIZE}&cityId=489&kw=${encodeURIComponent(keyword)}&start=${start}`;
        return fetchZhaopinJson(url,`智联招聘 API 偏移 ${start}`);
    });
    const settled=await Promise.allSettled(tasks);
    return settled.flatMap(function(result){
        if(result.status!=='fulfilled')return[];
        const list=result.value?.data?.results||result.value?.data?.list||result.value?.data?.positions||result.value?.results||result.value?.list||[];
        return(Array.isArray(list)?list:[]).map(mapZhaopinJob).filter(Boolean);
    }).filter(function(job){
        return jobMatchesQuery(job,keyword);
    });
}
async function fetchGreenhouseJobs(source,query){
    try{
        const data=await fetchJobBoardJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`,`${source.company} Greenhouse`);
        return (data?.jobs||[]).map(function(item){
            return normalizeJobPosting({
                title:item.title,
                company:source.company,
                location:item.location?.name||'',
                source:'Greenhouse API',
                url:item.absolute_url,
                jd_text:normalizeJobBoardText(item.content||''),
                updated_at:item.updated_at||''
            });
        }).filter(Boolean).filter(function(job){return jobMatchesQuery(job,query);});
    }catch(error){
        return[];
    }
}
async function fetchRemotiveJobs(query){
    const keyword=normalizePrepareText(query);
    try{
        const data=await fetchJobBoardJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}`,'Remotive API');
        return (data?.jobs||[]).slice(0,40).map(function(item){
            return normalizeJobPosting({
                title:item.title,
                company:item.company_name,
                location:item.candidate_required_location||'Remote',
                region:classifyJobRegion(item.candidate_required_location||'Remote'),
                source:'Remotive API',
                url:item.url,
                jd_text:normalizeJobBoardText(item.description||''),
                updated_at:item.publication_date||''
            });
        }).filter(Boolean).filter(function(job){
            return job.region==='northamerica'&&jobMatchesQuery(job,keyword);
        });
    }catch(error){
        return[];
    }
}
async function fetchJobBoardResults(query){
    const keyword=normalizePrepareText(query);
    const tasks=[
        fetchTencentJobs(keyword),
        fetchZhaopinJobs(keyword),
        fetchRemotiveJobs(keyword),
        ...JOB_BOARD_GREENHOUSE_SOURCES.map(function(source){return fetchGreenhouseJobs(source,keyword);})
    ];
    const settled=await Promise.allSettled(tasks);
    return sortJobBoardPostings(dedupeJobPostings(settled.flatMap(function(result){
        return result.status==='fulfilled'?(result.value||[]):[];
    })));
}
function flattenPrepareDuckTopics(topics,bucket){
    (topics||[]).forEach(function(topic){
        if(Array.isArray(topic?.Topics)&&topic.Topics.length){
            flattenPrepareDuckTopics(topic.Topics,bucket);
            return;
        }
        const text=normalizePrepareText(topic?.Text||topic?.Result||'');
        const url=normalizePrepareText(topic?.FirstURL||'');
        if(text||url){
            bucket.push({
                title:text.split(' - ')[0]||text,
                snippet:text,
                url,
                source:'DuckDuckGo'
            });
        }
    });
}
async function fetchPrepareDuckDuckGoResults(query){
    const data=await fetchPrepareLookupJson(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1&skip_disambig=1`,'DuckDuckGo');
    const results=[];
    const abstractText=normalizePrepareText(data?.AbstractText||'');
    if(abstractText){
        results.push({
            title:normalizePrepareText(data?.Heading||query),
            snippet:abstractText,
            url:normalizePrepareText(data?.AbstractURL||''),
            source:normalizePrepareText(data?.AbstractSource||'DuckDuckGo')
        });
    }
    flattenPrepareDuckTopics(data?.RelatedTopics||[],results);
    return results.slice(0,4);
}
async function fetchPrepareWikipediaResults(query,language){
    const searchData=await fetchPrepareLookupJson(`https://${language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=2`,`Wikipedia(${language})`);
    const hits=(searchData?.query?.search||[]).slice(0,2);
    const results=[];
    for(const hit of hits){
        const title=normalizePrepareText(hit?.title||'');
        if(!title)continue;
        let summaryText='';
        let pageUrl=`https://${language}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
        try{
            const summaryData=await fetchPrepareLookupJson(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,`Wikipedia 摘要(${language})`);
            summaryText=normalizePrepareText(summaryData?.extract||'');
            pageUrl=normalizePrepareText(summaryData?.content_urls?.desktop?.page||pageUrl);
        }catch(error){}
        const snippet=decodePrepareHtml(hit?.snippet||'');
        results.push({
            title,
            snippet:summaryText||snippet,
            url:pageUrl,
            source:`Wikipedia (${language})`
        });
    }
    return results.filter(function(item){
        return item.title&&item.snippet;
    });
}
function dedupePrepareLookupResults(items){
    const seen=new Set();
    return(items||[]).filter(function(item){
        const key=normalizePrepareLookupText(`${item?.title||''} ${item?.url||''}`);
        if(!key||seen.has(key))return false;
        seen.add(key);
        return true;
    });
}
async function runPrepareWebLookup(args){
    const query=normalizePrepareLookupQuery(args?.query||args);
    const intent=normalizePrepareText(args?.intent||'确认术语或业务背景');
    const language=normalizePrepareText(args?.language||'zh').toLowerCase()==='en'?'en':'zh';
    if(!query){
        return JSON.stringify({query:'',intent,language,results:[],note:'没有提供可检索的 query。'});
    }
    const cached=readPrepareLookupCache(query);
    if(cached){
        return JSON.stringify(Object.assign({},cached,{cache_hit:true}));
    }
    const languages=language==='zh'?['zh','en']:['en','zh'];
    const resultSets=await Promise.allSettled([
        fetchPrepareDuckDuckGoResults(query),
        fetchPrepareWikipediaResults(query,languages[0]),
        fetchPrepareWikipediaResults(query,languages[1])
    ]);
    const merged=dedupePrepareLookupResults(resultSets.flatMap(function(result){
        return result.status==='fulfilled'?(result.value||[]):[];
    })).slice(0,6);
    const errors=resultSets.filter(function(result){
        return result.status==='rejected';
    }).map(function(result){
        return result.reason instanceof Error?result.reason.message:String(result.reason);
    }).slice(0,2);
    const payload={
        query,
        intent,
        language,
        results:merged.map(function(item){
            return{
                title:item.title,
                snippet:item.snippet,
                source:item.source,
                url:item.url
            };
        }),
        note:merged.length?'这些是公开资料检索结果，请优先基于结果理解术语、公司、产品与业务语境，再结合 JD 与简历作答。':'公开检索暂时没有找到高质量结果，请降低结论置信度，并在输出里明确哪些地方仍需面试确认。',
        limitations:errors.length?errors:[]
    };
    writePrepareLookupCache(query,payload);
    return JSON.stringify(payload);
}
function getPrepareDirectTools(){
    return[
        {
            type:'function',
            function:{
                name:'web_lookup',
                description:'Search public web and encyclopedia sources for unfamiliar proper nouns, company names, products, platforms, slang, business terms, competitors, and recent business context. Always call this before guessing.',
                parameters:{
                    type:'object',
                    properties:{
                        query:{type:'string',description:'The exact term, company, product, or short search phrase that needs external grounding.'},
                        intent:{type:'string',description:'What you want to confirm, for example: term meaning, company business, product context, recent focus, competitor, or market position.'},
                        language:{type:'string',description:'Preferred result language. Use zh for Chinese context and en for English context.'}
                    },
                    required:['query','intent','language'],
                    additionalProperties:false
                }
            }
        }
    ];
}
async function executePrepareToolCall(toolCall){
    const name=toolCall?.function?.name||'';
    const argsText=toolCall?.function?.arguments||'{}';
    let args={};
    try{
        args=JSON.parse(argsText||'{}');
    }catch(error){
        args={query:'',intent:'',language:'zh'};
    }
    if(name==='web_lookup'){
        return runPrepareWebLookup(args);
    }
    return JSON.stringify({error:`未知工具：${name}`});
}
function extractPrepareLookupQueries(input){
    const queries=[];
    const seen=new Set();
    const knownBriefs=getPrepareKnownTermBriefs(input)||[];
    function pushQuery(value){
        const text=normalizePrepareLookupQuery(value);
        const key=text.toLowerCase();
        if(!text||seen.has(key))return;
        if(findPrepareKnownTermBrief(text,knownBriefs))return;
        seen.add(key);
        queries.push(text);
    }
    pushQuery(input?.company_name);
    if(input?.company_name&&input?.role_name)pushQuery(`${input.company_name} ${input.role_name}`);
    const jdText=String(input?.jd_text||'');
    const englishTerms=[...new Set((jdText.match(/\b[A-Za-z][A-Za-z0-9_-]{3,}\b/g)||[]))]
        .filter(function(term){
            return !/^(with|from|that|this|have|will|must|need|good|team|work|data|user|role|goal|product|growth|market|business|model|deepseek)$/i.test(term);
        })
        .slice(0,3);
    englishTerms.forEach(pushQuery);
    const chineseTerms=[...new Set((jdText.match(/[\u4e00-\u9fa5A-Za-z]{2,12}(?:平台|系统|产品|项目|助手|达人|智能体|工作流|引擎|中台|机器人)/g)||[]))].slice(0,2);
    chineseTerms.forEach(pushQuery);
    return queries.slice(0,4);
}
function summarizePrepareLookupPayload(payload){
    const results=(payload?.results||[]).slice(0,3).map(function(item){
        return{
            title:item.title,
            snippet:item.snippet,
            source:item.source,
            url:item.url
        };
    });
    return{
        query:payload?.query||'',
        intent:payload?.intent||'',
        results,
        note:payload?.note||''
    };
}
async function buildPrepareExternalResearchDigest(input,kind){
    const prepareConfig=getPrepareConfig();
    if((prepareConfig.model||'').includes('flash')&&kind!=='answer'){
        return [];
    }
    const allQueries=extractPrepareLookupQueries(input);
    const queries=allQueries.slice(0,1);
    const results=await Promise.allSettled(queries.map(async function(query){
        const raw=await runPrepareWebLookup({
            query,
            intent:kind==='answer'?'补足回答里的术语、平台与业务背景':'补足岗位、公司、平台、术语与业务背景',
            language:'zh'
        });
        const parsed=JSON.parse(raw||'{}');
        return parsed?.results?.length?summarizePrepareLookupPayload(parsed):null;
    }));
    return results.map(function(result){
        return result.status==='fulfilled'?result.value:null;
    }).filter(Boolean).slice(0,3);
}
function buildPrepareLookupAugmentedMessages(messages,lookupDigest){
    if(!lookupDigest?.length)return cloneData(messages||[]);
    const next=cloneData(messages||[]);
    next.splice(1,0,{
        role:'system',
        content:`下面是已经联网检索并整理好的公开背景，请优先使用这些资料理解公司、业务、平台名、产品名和行业黑话，再结合 JD 与简历生成结果。external_web_research=${JSON.stringify(lookupDigest,null,2)}`
    });
    return next;
}
function findPrepareKnownTermBrief(keyword,briefs){
    const text=normalizePrepareText(keyword);
    if(!text)return null;
    return(briefs||[]).find(function(brief){
        return prepareTextIncludesAlias(text,brief.term)||brief.aliases.some(function(alias){
            return prepareTextIncludesAlias(text,alias)||prepareTextIncludesAlias(alias,text);
        });
    })||null;
}
function getPrepareFileExtension(name){
    const match=String(name||'').toLowerCase().match(/\.([a-z0-9]+)$/);
    return match?match[1]:'';
}
function decodePrepareHtmlEntities(value){
    const textarea=document.createElement('textarea');
    textarea.innerHTML=String(value||'');
    return textarea.value;
}
const PREPARE_PDFJS_CDN_SOURCES=[
    {
        script:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
    },
    {
        script:'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
        cMapUrl:'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        standardFontDataUrl:'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
    },
    {
        script:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        cMapUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        standardFontDataUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
    }
];
let preparePdfjsLoadPromise=null;
function bytesToPrepareLatin1(bytes){
    return new TextDecoder('latin1').decode(bytes);
}
function loadPrepareRemoteScript(url){
    return new Promise(function(resolve,reject){
        const existing=[...document.querySelectorAll('script[data-rt-prepare-pdfjs]')].find(function(node){
            return node.src===url;
        });
        if(existing){
            if(existing.dataset.failed==='true'){
                existing.remove();
            }else{
            if(existing.dataset.loaded==='true'){
                resolve();
                return;
            }
            existing.addEventListener('load',function(){resolve();},{once:true});
            existing.addEventListener('error',function(){reject(new Error(`加载失败：${url}`));},{once:true});
            return;
            }
        }
        const script=document.createElement('script');
        let settled=false;
        const timeout=window.setTimeout(function(){
            if(settled)return;
            settled=true;
            reject(new Error(`加载超时：${url}`));
        },8000);
        script.async=true;
        script.src=url;
        script.dataset.rtPreparePdfjs='true';
        script.onload=function(){
            if(settled)return;
            settled=true;
            window.clearTimeout(timeout);
            script.dataset.loaded='true';
            resolve();
        };
        script.onerror=function(){
            if(settled)return;
            settled=true;
            window.clearTimeout(timeout);
            script.dataset.failed='true';
            reject(new Error(`加载失败：${url}`));
        };
        document.head.appendChild(script);
    });
}
async function ensurePreparePdfjsLoaded(){
    if(globalThis.pdfjsLib?.getDocument){
        return{
            pdfjs:globalThis.pdfjsLib,
            assets:globalThis.__RT_PREPARE_PDFJS_ASSETS||PREPARE_PDFJS_CDN_SOURCES[0]
        };
    }
    if(preparePdfjsLoadPromise)return preparePdfjsLoadPromise;
    preparePdfjsLoadPromise=(async function(){
        let lastError=null;
        for(const source of PREPARE_PDFJS_CDN_SOURCES){
            try{
                await loadPrepareRemoteScript(source.script);
                if(globalThis.pdfjsLib?.getDocument){
                    globalThis.__RT_PREPARE_PDFJS_ASSETS=source;
                    return{
                        pdfjs:globalThis.pdfjsLib,
                        assets:source
                    };
                }
            }catch(error){
                lastError=error;
            }
        }
        throw lastError||new Error('PDF 解析器加载失败');
    })().catch(function(error){
        preparePdfjsLoadPromise=null;
        throw error;
    });
    return preparePdfjsLoadPromise;
}
async function inflatePrepareBytes(bytes,format){
    if(typeof DecompressionStream==='undefined'){
        throw new Error('当前浏览器不支持压缩流解码');
    }
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    const buffer=await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
}
async function inflatePreparePdfStream(bytes){
    const attempts=['deflate-raw','deflate'];
    let lastError=null;
    for(const format of attempts){
        try{
            return await inflatePrepareBytes(bytes,format);
        }catch(error){
            lastError=error;
        }
    }
    throw lastError||new Error('PDF 压缩流解码失败');
}
function decodePreparePdfLiteralString(value){
    let result='';
    for(let index=0;index<value.length;index+=1){
        const char=value[index];
        if(char!=='\\'){
            result+=char;
            continue;
        }
        index+=1;
        const next=value[index]||'';
        if(!next)break;
        if(next==='n')result+='\n';
        else if(next==='r')result+='\r';
        else if(next==='t')result+='\t';
        else if(next==='b')result+='\b';
        else if(next==='f')result+='\f';
        else if(next==='('||next===')'||next==='\\')result+=next;
        else if(/[0-7]/.test(next)){
            let octal=next;
            for(let step=0;step<2;step+=1){
                const peek=value[index+1];
                if(peek&&/[0-7]/.test(peek)){
                    octal+=peek;
                    index+=1;
                }else break;
            }
            result+=String.fromCharCode(parseInt(octal,8));
        }else if(next==='\n'||next==='\r'){
            if(next==='\r'&&value[index+1]==='\n')index+=1;
        }else{
            result+=next;
        }
    }
    return result;
}
function decodePreparePdfHexString(value){
    const clean=value.replace(/\s+/g,'');
    if(!clean)return'';
    const normalized=clean.length%2===0?clean:`${clean}0`;
    const bytes=new Uint8Array(normalized.length/2);
    for(let index=0;index<normalized.length;index+=2){
        bytes[index/2]=parseInt(normalized.slice(index,index+2),16)||0;
    }
    if(bytes.length>=2&&bytes[0]===0xFE&&bytes[1]===0xFF){
        let text='';
        for(let index=2;index+1<bytes.length;index+=2){
            text+=String.fromCharCode((bytes[index]<<8)|bytes[index+1]);
        }
        return text;
    }
    return new TextDecoder('latin1').decode(bytes);
}
function extractPreparePdfTextOperators(section){
    const fragments=[];
    const literalRegex=/\((?:\\.|[^\\()])*\)\s*Tj/g;
    const hexRegex=/<[0-9A-Fa-f\s]+>\s*Tj/g;
    const arrayRegex=/\[(?:\\.|[^\]])*?\]\s*TJ/g;
    const pushLiteral=function(match){
        const text=decodePreparePdfLiteralString(match.slice(1,match.lastIndexOf(')')));
        if(text)fragments.push(text);
    };
    const pushHex=function(match){
        const start=match.indexOf('<');
        const end=match.indexOf('>',start+1);
        if(start<0||end<0)return;
        const text=decodePreparePdfHexString(match.slice(start+1,end));
        if(text)fragments.push(text);
    };
    const pushArray=function(match){
        const inner=match.slice(1,match.lastIndexOf(']'));
        const parts=[];
        inner.replace(/\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g,function(token){
            if(token.startsWith('('))parts.push(decodePreparePdfLiteralString(token.slice(1,-1)));
            else if(token.startsWith('<'))parts.push(decodePreparePdfHexString(token.slice(1,-1)));
            return token;
        });
        const text=parts.join(' ').trim();
        if(text)fragments.push(text);
    };
    section.replace(literalRegex,function(match){
        pushLiteral(match);
        return match;
    });
    section.replace(hexRegex,function(match){
        pushHex(match);
        return match;
    });
    section.replace(arrayRegex,function(match){
        pushArray(match);
        return match;
    });
    return fragments;
}
function extractPreparePdfTextFromContent(content){
    const sections=[];
    content.replace(/BT[\s\S]*?ET/g,function(block){
        sections.push(block);
        return block;
    });
    const textParts=sections.flatMap(extractPreparePdfTextOperators).map(normalizeResumeExtractedText).filter(Boolean);
    return normalizeResumeExtractedText(textParts.join('\n'));
}
async function extractResumeTextFromPdfBytesFallback(bytes){
    const raw=bytesToPrepareLatin1(bytes);
    const texts=[];
    const streamRegex=/stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    while((match=streamRegex.exec(raw))){
        const streamStart=match.index+match[0].indexOf(match[1]);
        const streamEnd=streamStart+match[1].length;
        const prefix=raw.slice(Math.max(0,match.index-240),match.index);
        let decoded='';
        try{
            if(/\/FlateDecode/.test(prefix)){
                decoded=bytesToPrepareLatin1(await inflatePreparePdfStream(bytes.slice(streamStart,streamEnd)));
            }else{
                decoded=match[1];
            }
        }catch(error){
            continue;
        }
        const extracted=extractPreparePdfTextFromContent(decoded);
        if(extracted)texts.push(extracted);
    }
    const merged=normalizeResumeExtractedText(texts.join('\n\n'));
    if(merged)return merged;
    const plainMatches=(raw.match(/\((?:\\.|[^\\()]){3,}\)/g)||[])
        .map(function(token){return decodePreparePdfLiteralString(token.slice(1,-1));})
        .map(normalizeResumeExtractedText)
        .filter(function(token){
            return token&&/[\u4e00-\u9fa5A-Za-z]{2,}/.test(token);
        });
    return normalizeResumeExtractedText(plainMatches.join('\n'));
}
async function extractResumeTextFromPdfBytes(bytes){
    let bestText='';
    let pdfjsAssets=null;
    try{
        const pdfjsState=await ensurePreparePdfjsLoaded();
        const pdfjs=pdfjsState?.pdfjs;
        pdfjsAssets=pdfjsState?.assets||null;
        if(!pdfjs)throw new Error('pdfjs unavailable');
        const loadingTask=pdfjs.getDocument({
            data:bytes,
            disableWorker:true,
            useWorkerFetch:false,
            isEvalSupported:false,
            cMapUrl:pdfjsAssets?.cMapUrl,
            cMapPacked:true,
            standardFontDataUrl:pdfjsAssets?.standardFontDataUrl,
            disableFontFace:true
        });
        const pdf=await loadingTask.promise;
        const pages=[];
        for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber+=1){
            const page=await pdf.getPage(pageNumber);
            const textContent=await page.getTextContent();
            const flatTokens=(textContent.items||[]).map(function(item){
                return normalizePrepareText(item?.str||'');
            }).filter(Boolean);
            const lines=[];
            let currentLine='';
            let lastY=null;
            (textContent.items||[]).forEach(function(item){
                const text=normalizePrepareText(item?.str||'');
                const y=Array.isArray(item?.transform)?Math.round(item.transform[5]):null;
                if(lastY!==null&&y!==null&&Math.abs(y-lastY)>4&&currentLine){
                    lines.push(currentLine.trim());
                    currentLine='';
                }
                if(text)currentLine+=(currentLine?' ':'')+text;
                if(item?.hasEOL&&currentLine){
                    lines.push(currentLine.trim());
                    currentLine='';
                }
                if(y!==null)lastY=y;
            });
            if(currentLine)lines.push(currentLine.trim());
            const structuredText=normalizeResumeExtractedText(lines.filter(Boolean).join('\n'));
            const flatText=normalizeResumeExtractedText(flatTokens.join(' '));
            const pageText=structuredText.length>=Math.max(80,Math.round(flatText.length*0.45))?structuredText:flatText;
            pages.push(pageText);
        }
        bestText=normalizeResumeExtractedText(pages.join('\n\n'));
    }catch(error){}
    const fallbackText=await extractResumeTextFromPdfBytesFallback(bytes).catch(function(){return'';});
    const bestScore=scorePrepareExtractedTextQuality(bestText);
    const fallbackScore=scorePrepareExtractedTextQuality(fallbackText);
    if(fallbackScore>bestScore)bestText=fallbackText;
    if(!bestText||scorePrepareExtractedTextQuality(bestText)<0.28){
        throw new Error('这份 PDF 没有读出可用正文。请优先上传可复制文本的 PDF；如果是扫描版或导出异常，建议重新导出后再传。');
    }
    return bestText;
}
function readPrepareUint16LE(view,offset){
    return view.getUint16(offset,true);
}
function readPrepareUint32LE(view,offset){
    return view.getUint32(offset,true);
}
function findPrepareZipEocd(bytes){
    const minOffset=Math.max(0,bytes.length-65557);
    for(let offset=bytes.length-22;offset>=minOffset;offset-=1){
        if(bytes[offset]===0x50&&bytes[offset+1]===0x4b&&bytes[offset+2]===0x05&&bytes[offset+3]===0x06){
            return offset;
        }
    }
    return-1;
}
function listPrepareZipEntries(bytes){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const eocdOffset=findPrepareZipEocd(bytes);
    if(eocdOffset<0)throw new Error('DOCX 文件结构无效');
    const totalEntries=readPrepareUint16LE(view,eocdOffset+10);
    let cursor=readPrepareUint32LE(view,eocdOffset+16);
    const decoder=new TextDecoder('utf-8');
    const entries=[];
    for(let index=0;index<totalEntries&&cursor+46<=bytes.length;index+=1){
        if(readPrepareUint32LE(view,cursor)!==0x02014b50)break;
        const compression=readPrepareUint16LE(view,cursor+10);
        const compressedSize=readPrepareUint32LE(view,cursor+20);
        const fileNameLength=readPrepareUint16LE(view,cursor+28);
        const extraLength=readPrepareUint16LE(view,cursor+30);
        const commentLength=readPrepareUint16LE(view,cursor+32);
        const localHeaderOffset=readPrepareUint32LE(view,cursor+42);
        const fileNameStart=cursor+46;
        const fileNameEnd=fileNameStart+fileNameLength;
        const name=decoder.decode(bytes.slice(fileNameStart,fileNameEnd));
        entries.push({name,compression,compressedSize,localHeaderOffset});
        cursor=fileNameEnd+extraLength+commentLength;
    }
    return entries;
}
async function inflatePrepareRawBytes(bytes){
    return inflatePrepareBytes(bytes,'deflate-raw');
}
async function extractPrepareZipEntry(bytes,entry){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(readPrepareUint32LE(view,entry.localHeaderOffset)!==0x04034b50){
        throw new Error('DOCX 本地文件头无效');
    }
    const fileNameLength=readPrepareUint16LE(view,entry.localHeaderOffset+26);
    const extraLength=readPrepareUint16LE(view,entry.localHeaderOffset+28);
    const dataStart=entry.localHeaderOffset+30+fileNameLength+extraLength;
    const dataEnd=dataStart+entry.compressedSize;
    const payload=bytes.slice(dataStart,dataEnd);
    if(entry.compression===0)return payload;
    if(entry.compression===8)return inflatePrepareRawBytes(payload);
    throw new Error('DOCX 使用了当前不支持的压缩方式');
}
function convertPrepareDocxXmlToText(xml){
    const plain=String(xml||'')
        .replace(/<w:tab[^>]*\/>/gi,'\t')
        .replace(/<w:br[^>]*\/>/gi,'\n')
        .replace(/<\/w:p>/gi,'\n')
        .replace(/<\/w:tr>/gi,'\n')
        .replace(/<[^>]+>/g,'')
        .replace(/&nbsp;/g,' ');
    return normalizeResumeExtractedText(decodePrepareHtmlEntities(plain));
}
async function extractResumeTextFromDocxBytes(bytes){
    const entries=listPrepareZipEntries(bytes).filter(function(entry){
        return/^word\/(document|header\d+|footer\d+)\.xml$/i.test(entry.name);
    });
    if(!entries.length)throw new Error('DOCX 里没有找到正文内容');
    const decoder=new TextDecoder('utf-8');
    const parts=[];
    for(const entry of entries){
        const payload=await extractPrepareZipEntry(bytes,entry);
        const text=convertPrepareDocxXmlToText(decoder.decode(payload));
        if(text)parts.push(text);
    }
    return normalizeResumeExtractedText(parts.join('\n\n'));
}
async function extractResumeTextFromBytes(bytes,fileName,fileType){
    const extension=getPrepareFileExtension(fileName);
    if(extension==='pdf'||String(fileType||'').toLowerCase().includes('pdf')){
        return extractResumeTextFromPdfBytes(bytes);
    }
    if(extension==='docx'||String(fileType||'').toLowerCase().includes('wordprocessingml')){
        return extractResumeTextFromDocxBytes(bytes);
    }
    if(['txt','md'].includes(extension)||String(fileType||'').startsWith('text/')){
        return normalizeResumeExtractedText(new TextDecoder('utf-8').decode(bytes));
    }
    if(extension==='doc'){
        throw new Error('暂不支持直接读取 .doc，请改用 PDF、DOCX、TXT 或 Markdown');
    }
    throw new Error('暂不支持这份简历格式，请改用 PDF、DOCX、TXT 或 Markdown');
}
async function extractResumeTextFromFile(file){
    if(!file)return'';
    const bytes=new Uint8Array(await file.arrayBuffer());
    return extractResumeTextFromBytes(bytes,file.name,file.type||'');
}
async function readBlobAsDataUrl(blob){
    return await new Promise(function(resolve,reject){
        const reader=new FileReader();
        reader.onload=function(event){
            resolve(String(event?.target?.result||''));
        };
        reader.onerror=function(){
            reject(reader.error||new Error('文件读取失败'));
        };
        reader.readAsDataURL(blob);
    });
}
function dataUrlToPrepareBytes(dataUrl){
    const raw=String(dataUrl||'');
    const base64Index=raw.indexOf('base64,');
    if(base64Index<0)throw new Error('简历文件内容无效');
    const binary=atob(raw.slice(base64Index+7));
    const bytes=new Uint8Array(binary.length);
    for(let index=0;index<binary.length;index+=1){
        bytes[index]=binary.charCodeAt(index);
    }
    return bytes;
}
async function extractResumeTextFromStoredResume(resume){
    if(!resume?.data_url)return'';
    const bytes=dataUrlToPrepareBytes(resume.data_url);
    return extractResumeTextFromBytes(bytes,resume.orig||resume.file_name||'',resume.file_type||'');
}
function mergePrepareResumeTexts(primaryText,secondaryText){
    const primary=normalizeResumeExtractedText(primaryText);
    const secondary=normalizeResumeExtractedText(secondaryText);
    if(!primary)return secondary;
    if(!secondary)return primary;
    if(primary.includes(secondary))return primary;
    return `${primary}\n\n用户补充重点：\n${secondary}`;
}
function getPrepareResumeMetaText(file,parseState,emptyText){
    if(!file)return emptyText;
    const sizeText=file.size?` · ${(file.size/1024).toFixed(0)}KB`:'';
    if(parseState?.status==='ready')return`${file.name}${sizeText} · 已读取正文 ${parseState.text.length} 字`;
    if(parseState?.status==='reading')return`${file.name}${sizeText} · 正在读取正文…`;
    if(parseState?.status==='error')return`${file.name}${sizeText} · 读取失败：${parseState.message}`;
    return`${file.name}${sizeText} · 生成前会先读取正文`;
}
function getPrepareResumeParseState(kind){
    return kind==='application'?prepareState.appSupplementParse:prepareState.manualResumeParse;
}
function setPrepareResumeParseState(kind,nextState){
    const value=Object.assign({status:'idle',text:'',message:''},nextState||{});
    if(kind==='application')prepareState.appSupplementParse=value;
    else prepareState.manualResumeParse=value;
}
function refreshPrepareResumeMetaLabel(kind){
    const meta=kind==='application'?$('#prepare-app-file-meta'):$('#prepare-manual-file-meta');
    const file=kind==='application'?prepareState.appSupplementFile:prepareState.manualResumeFile;
    const emptyText=kind==='application'
        ?'上传后会先读取正文，读不到不会开始分析。'
        :'上传后会先读取正文，读不到不会开始分析。';
    if(meta)meta.textContent=getPrepareResumeMetaText(file,getPrepareResumeParseState(kind),emptyText);
}
async function warmPrepareResumeFileParse(kind,file){
    if(!file){
        setPrepareResumeParseState(kind,{status:'idle',text:'',message:''});
        refreshPrepareResumeMetaLabel(kind);
        return;
    }
    setPrepareResumeParseState(kind,{status:'reading',text:'',message:''});
    refreshPrepareResumeMetaLabel(kind);
    try{
        const text=await extractResumeTextFromFile(file);
        const currentFile=kind==='application'?prepareState.appSupplementFile:prepareState.manualResumeFile;
        if(currentFile!==file)return;
        setPrepareResumeParseState(kind,{status:'ready',text,message:''});
    }catch(error){
        const currentFile=kind==='application'?prepareState.appSupplementFile:prepareState.manualResumeFile;
        if(currentFile!==file)return;
        setPrepareResumeParseState(kind,{
            status:'error',
            text:'',
            message:error instanceof Error?error.message:String(error)
        });
    }
    refreshPrepareResumeMetaLabel(kind);
    if(curView==='prepare')renderPrepare();
}
async function resolvePrepareLinkedResumeContext(linkedResume){
    if(!linkedResume)return{text:'',source:'',verified:false,resumeName:'',fileMeta:null};
    const extracted=normalizeResumeExtractedText(linkedResume.extracted_text||'');
    if(extracted){
        return{
            text:extracted,
            source:'linked_resume_file',
            verified:true,
            resumeName:linkedResume.file_name||'',
            fileMeta:linkedResume.size?{name:linkedResume.file_name||'',size:linkedResume.size,type:linkedResume.file_type||'application/octet-stream'}:null
        };
    }
    if(linkedResume.data_url){
        try{
            const text=await extractResumeTextFromStoredResume(linkedResume);
            if(!text)throw new Error('没有读出有效正文');
            await store.updateResume(linkedResume.id,{
                extracted_text:text,
                extracted_at:new Date().toISOString(),
                extraction_status:'ready',
                extraction_error:''
            });
            return{
                text,
                source:'linked_resume_file',
                verified:true,
                resumeName:linkedResume.file_name||'',
                fileMeta:linkedResume.size?{name:linkedResume.file_name||'',size:linkedResume.size,type:linkedResume.file_type||'application/octet-stream'}:null
            };
        }catch(error){
            throw new Error(`已绑定简历「${linkedResume.file_name||'当前简历'}」，但没能读出正文。请把它重新上传为 PDF、DOCX、TXT 或 Markdown 后再试。`);
        }
    }
    const notes=normalizeResumeExtractedText(linkedResume.notes||'');
    return{
        text:notes,
        source:notes?'linked_resume_notes':'',
        verified:false,
        resumeName:linkedResume.file_name||'',
        fileMeta:linkedResume.size?{name:linkedResume.file_name||'',size:linkedResume.size,type:linkedResume.file_type||'application/octet-stream'}:null
    };
}
async function resolvePrepareResumeContext(options){
    const resumeFile=options?.resumeFile||null;
    const linkedResume=options?.linkedResume||null;
    const resumeSummary=normalizeResumeExtractedText(options?.resumeSummary||'');
    const resumeNameFallback=normalizePrepareText(options?.resumeNameFallback||'');
    if(resumeFile){
        let fileText='';
        try{
            fileText=await extractResumeTextFromFile(resumeFile);
        }catch(error){
            const message=error instanceof Error?error.message:String(error);
            throw new Error(`已选简历文件「${resumeFile.name}」，但没能读出正文。${message}`);
        }
        if(!fileText){
            throw new Error(`已选简历文件「${resumeFile.name}」，但没有读出有效正文。请换一份更清晰的 PDF、DOCX、TXT 或 Markdown。`);
        }
        return{
            resume_name:resumeFile.name,
            resume_text:mergePrepareResumeTexts(fileText,resumeSummary),
            resume_file_meta:{name:resumeFile.name,size:resumeFile.size,type:resumeFile.type||'application/octet-stream'},
            resume_source:'uploaded_file',
            resume_verified:true
        };
    }
    if(linkedResume){
        const linkedContext=await resolvePrepareLinkedResumeContext(linkedResume);
        const mergedText=mergePrepareResumeTexts(linkedContext.text,resumeSummary);
        if(mergedText){
            return{
                resume_name:linkedContext.resumeName||resumeNameFallback,
                resume_text:mergedText,
                resume_file_meta:linkedContext.fileMeta,
                resume_source:linkedContext.verified?'linked_resume_file':(resumeSummary&&linkedContext.text?'linked_resume_notes_plus_summary':linkedContext.source||'manual_summary'),
                resume_verified:!!linkedContext.verified
            };
        }
    }
    if(resumeSummary){
        return{
            resume_name:resumeNameFallback,
            resume_text:resumeSummary,
            resume_file_meta:null,
            resume_source:'manual_summary',
            resume_verified:false
        };
    }
    return{
        resume_name:resumeNameFallback,
        resume_text:'',
        resume_file_meta:null,
        resume_source:'',
        resume_verified:false
    };
}
function getPrepareResumeStatus(session){
    const linkedResume=getPrepareLinkedResume(session);
    const hasLinkedExtracted=Boolean(normalizeResumeExtractedText(linkedResume?.extracted_text||''));
    const resumeText=normalizeResumeExtractedText(session?.resume_text||linkedResume?.extracted_text||linkedResume?.notes||'');
    const verified=Boolean(session?.resume_verified||hasLinkedExtracted||session?.resume_source==='uploaded_file'||session?.resume_source==='linked_resume_file');
    if(verified&&resumeText)return{label:`简历正文已读取 · ${resumeText.length} 字`,verified:true};
    if(resumeText)return{label:`当前基于简历摘要 · ${resumeText.length} 字`,verified:false};
    return{label:'未读取到简历正文',verified:false};
}
function getPrepareResumePreviewData(options){
    const parseText=normalizeResumeExtractedText(options?.parseText||'');
    const linkedText=normalizeResumeExtractedText(options?.linkedText||'');
    const summaryText=normalizeResumeExtractedText(options?.summaryText||'');
    const primaryText=parseText||linkedText;
    const previewText=mergePrepareResumeTexts(primaryText,summaryText);
    const verified=Boolean(primaryText);
    let sourceLabel='';
    if(parseText)sourceLabel='上传文件正文';
    else if(linkedText)sourceLabel='已绑定简历正文';
    else if(summaryText)sourceLabel='简历摘要';
    const statusLabel=verified?`正文已读取 · ${primaryText.length} 字`:summaryText?`当前仅摘要 · ${summaryText.length} 字`:'未读取到可用简历内容';
    return{
        text:previewText,
        primaryText,
        summaryText,
        verified,
        sourceLabel,
        statusLabel
    };
}
function renderPrepareResumePreviewCard(preview,options){
    if(!preview?.text)return'';
    const title=options?.title||'简历上下文';
    const hint=options?.hint||'生成时会优先使用这里的正文与补充摘要。';
    const bodyText=preview.text.length>4000?`${preview.text.slice(0,4000)}\n\n……已截断显示，生成时仍会使用完整正文。`:preview.text;
    return `
        <div class="prepare-resume-preview-card prepare-field-full">
            <div class="prepare-resume-preview-head">
                <div>
                    <div class="prepare-section-kicker">${escapeHTML(title)}</div>
                    <strong>${escapeHTML(preview.sourceLabel||'简历内容')}</strong>
                </div>
                <div class="prepare-resume-preview-meta">
                    <span>${escapeHTML(preview.statusLabel)}</span>
                    <span>${preview.verified?'已校验正文':'待补更完整正文'}</span>
                </div>
            </div>
            <p>${escapeHTML(hint)}</p>
            <div class="prepare-resume-preview-body"><pre>${escapeHTML(bodyText)}</pre></div>
        </div>
    `;
}
function renderPrepareResumePreviewOverlay(preview){
    if(!prepareState.showResumePreview||!preview?.text)return'';
    return `
        <div class="prepare-resume-overlay" id="prepare-resume-overlay">
            <div class="prepare-resume-sheet">
                <div class="prepare-resume-sheet-head">
                    <div>
                        <div class="prepare-section-kicker">Resume Context</div>
                        <h3>本次分析实际使用的简历内容</h3>
                        <p>${escapeHTML(preview.sourceLabel||'简历正文')} · ${escapeHTML(preview.statusLabel||'')}</p>
                    </div>
                    <button type="button" class="btn-secondary btn-sm" id="prepare-close-resume-preview">收起</button>
                </div>
                <div class="prepare-resume-sheet-body">
                    <pre>${escapeHTML(preview.text)}</pre>
                </div>
            </div>
        </div>
    `;
}
function renderPrepareJdPreviewOverlay(session){
    const jdText=normalizePrepareText(session?.jd_text||'');
    if(!prepareState.showJdPreview||!jdText)return'';
    return `
        <div class="prepare-resume-overlay" id="prepare-jd-overlay">
            <div class="prepare-resume-sheet">
                <div class="prepare-resume-sheet-head">
                    <div>
                        <div class="prepare-section-kicker">JD Context</div>
                        <h3>本次分析实际使用的 JD 原文</h3>
                        <p>${escapeHTML(session?.company_name||'目标公司')} · ${escapeHTML(session?.role_name||'目标岗位')} · ${jdText.length} 字</p>
                    </div>
                    <button type="button" class="btn-secondary btn-sm" id="prepare-close-jd-preview">收起</button>
                </div>
                <div class="prepare-resume-sheet-body">
                    <pre>${escapeHTML(jdText)}</pre>
                </div>
            </div>
        </div>
    `;
}
function isPrepareLikelyInternalTerm(keyword){
    const text=normalizePrepareText(keyword);
    if(!text)return false;
    if(/openclaw|龙虾/i.test(text))return true;
    if(/^[A-Za-z][A-Za-z0-9_-]{4,}$/.test(text)&&!/\b(ai|agent|sql|prd|okr|kpi|api|crm|erp)\b/i.test(text))return true;
    return false;
}
function sanitizePrepareKeywordTranslationItem(item){
    const keyword=normalizePrepareText(item?.jd_keyword||'关键词');
    if(isPrepareLikelyInternalTerm(keyword)){
        return{
            jd_keyword:keyword,
            meaning:'当前公开资料里还没有足够稳定的信息完成准确定义，需要在面试里把它追问成明确的业务对象、产品形态或平台能力。',
            prep_direction:'回答时先讲你能对应上的相似能力或业务场景，再主动确认它服务谁、解决什么问题、怎么衡量价值。'
        };
    }
    return{
        jd_keyword:keyword,
        meaning:normalizePrepareText(item?.meaning||'需要结合 JD 原文继续确认。'),
        prep_direction:normalizePrepareText(item?.prep_direction||'面试前把这个词放回真实业务场景里理解。')
    };
}
function sanitizePrepareTextList(list,fallback,maxItems){
    const primary=(Array.isArray(list)?list:[]).map(function(item){
        return normalizePrepareText(item);
    }).filter(Boolean);
    const uniquePrimary=[...new Set(primary)];
    if(uniquePrimary.length)return uniquePrimary.slice(0,maxItems||uniquePrimary.length);
    const backup=(Array.isArray(fallback)?fallback:[]).map(function(item){
        return normalizePrepareText(item);
    }).filter(Boolean);
    const uniqueBackup=[...new Set(backup)];
    return uniqueBackup.slice(0,maxItems||uniqueBackup.length);
}
function normalizePrepareCompareKey(value){
    return normalizePrepareText(value).replace(/\s+/g,'').replace(/[，。；、,.!?？！（）()\-_"'“”‘’:/]/g,'').toLowerCase();
}
function inferPrepareEvidenceType(text){
    const source=normalizePrepareText(text);
    if(/论文|研究|课题|文献|访谈|田野|政治学|学术/.test(source))return'RESEARCH';
    if(/社团|学生会|组织|活动|招募|宣传|策划/.test(source))return'CAMPUS';
    if(/实习|兼职|项目|上线|交付|需求|prd|产品/.test(source.toLowerCase()))return'PROJECT';
    if(/数据|sql|分析|指标|问卷|统计/.test(source.toLowerCase()))return'DATA';
    return'GENERAL';
}
function summarizePrepareEvidenceTitle(text,index){
    const source=normalizePrepareText(text);
    if(!source)return`经历线索 ${index+1}`;
    if(/论文|研究|课题|文献|访谈|田野|政治学|学术/.test(source))return'论文 / 研究项目';
    if(/社团|学生会|组织|活动|招募|宣传|策划/.test(source))return'校园 / 社团经历';
    if(/实习|兼职|项目|上线|交付|需求|prd|产品/.test(source.toLowerCase()))return'项目 / 实习经历';
    if(/数据|sql|分析|指标|问卷|统计/.test(source.toLowerCase()))return'分析 / 调研经历';
    return source.length>18?`${source.slice(0,18)}...`:source;
}
function isPrepareResumeBoilerplate(text){
    const source=normalizePrepareText(text);
    if(!source)return true;
    return /^(教育背景|教育经历|个人评价|自我评价|技能|技能特长|获奖经历|荣誉奖励|基本信息|联系方式|简历|resume|个人简历|求职意向)$/i.test(source);
}
function isPrepareGenericExperienceItem(item){
    const section=normalizePrepareText(item?.resume_section);
    const reason=normalizePrepareText(item?.why_match);
    const highlights=sanitizePrepareTextList(item?.highlight_points,[],6).join(' ');
    const genericSection=/^(resume\s*\d+|经历线索\s*\d+|当前简历缺少直接证据)$/i.test(section);
    const genericReason=/未必与.+直接同题|可迁移能力线索|关键在于把真实动作、判断和结果补挖出来/.test(reason);
    const genericHighlights=/先回忆这段里你有没有做过调研|把它改写成“问题是什么|如果这段离岗位较远/.test(highlights);
    return genericSection||genericReason||genericHighlights;
}
function getPrepareJdFocusAngles(jdText){
    const source=normalizePrepareText(jdText).toLowerCase();
    const cues=[];
    const push=(label,keywords)=>{
        if(cues.includes(label))return;
        if(keywords.some(keyword=>source.includes(keyword.toLowerCase())))cues.push(label);
    };
    push('需求挖掘',['需求','访谈','调研','用户研究','痛点','洞察','问题定义']);
    push('PRD/方案撰写',['prd','需求文档','方案','原型','文档','写作','说明书']);
    push('AI Skill/产品落地',['skill','agent','workflow','工作流','智能体','copilot','插件','工具']);
    push('漏斗/指标验证',['漏斗','转化','留存','指标','埋点','a/b','ab','数据','增长']);
    push('跨团队推进',['跨团队','协作','研发','算法','设计','运营','业务','推进']);
    push('行业/业务理解',['行业','竞品','商业模式','业务','生态','市场','调研']);
    return cues.slice(0,4);
}
function getPrepareJdFocusLabel(jdAngles, fallback){
    const angles=(Array.isArray(jdAngles)?jdAngles:[]).filter(Boolean);
    if(angles.length)return angles.join(' / ');
    return fallback||'需求挖掘 / 方案表达 / 结果验证';
}
function getPreparePriorityBaseAngles(session){
    const jdAngles=getPrepareJdFocusAngles(session?.jd_text||'');
    if(jdAngles.length)return jdAngles.slice(0,3);
    const lens=getPrepareLens(session||{});
    if(lens.key==='product')return['需求挖掘','PRD/方案撰写','漏斗/指标验证'];
    if(lens.key==='data')return['漏斗/指标验证','行业/业务理解','跨团队推进'];
    if(lens.key==='operations'||lens.key==='pm')return['跨团队推进','行业/业务理解','漏斗/指标验证'];
    return['行业/业务理解','跨团队推进','漏斗/指标验证'];
}
function hasPrepareAngleSupport(session,angle){
    const snapshot=getPrepareResumeSnapshot(session||{});
    const text=normalizePrepareText([
        snapshot.raw_text||'',
        session?.resume_text||'',
        getPrepareSupplementalExperienceSummary(session||{})
    ].join(' ')).toLowerCase();
    if(!text)return false;
    const rules={
        '需求挖掘':/访谈|调研|问卷|痛点|需求|洞察|问题定义/,
        'PRD/方案撰写':/prd|方案|原型|需求文档|改进文档|说明书/,
        'AI Skill/产品落地':/skill|agent|workflow|工作流|智能体|产品化|上线|调用/,
        '漏斗/指标验证':/漏斗|留存|转化|指标|埋点|a\/b|ab|分析|提升|回升/,
        '跨团队推进':/跨团队|协同|推进|研发|算法|设计|业务|运营|对接/,
        '行业/业务理解':/行业|竞品|商业模式|市场|生态|财务|风控|报销|对账|合规/
    };
    const pattern=rules[angle];
    return pattern?pattern.test(text):false;
}
function buildPrepareJdPriorityBlueprint(session){
    const angles=getPreparePriorityBaseAngles(session);
    const makeItem=function(angle){
        const supported=hasPrepareAngleSupport(session,angle);
        const prefix=supported?'强化':'补齐';
        switch(angle){
            case'需求挖掘':
                return{
                    title:`${prefix}需求挖掘与问题定义`,
                    reason:supported?'这是 JD 里的直接要求，面试官通常会继续追问需求信号来自哪里、优先级为什么这样排。':'这是 JD 的高频要求，也是最容易在追问里暴露薄弱点的部分，面试前要先把需求来源和判断口径补齐。',
                    what_to_prepare:[
                        '准备 2 到 3 类需求信号：用户反馈、业务目标、数据异常分别说明什么',
                        '准备优先级判断口径：影响面、紧急度、实现成本、验证周期',
                        '准备一个这轮先做、另一轮后做的取舍例子'
                    ]
                };
            case'PRD/方案撰写':
                return{
                    title:`${prefix}方案结构与交付口径`,
                    reason:supported?'JD 提到方案、文档或产品表达时，面试官会重点看你能不能把目标、流程、边界和验收标准讲完整。':'这块如果表达不完整，面试里很容易只剩空泛想法，提前把方案结构和交付口径准备扎实会稳很多。',
                    what_to_prepare:[
                        '把方案讲成四段：目标、主流程、异常处理、验收标准',
                        '准备一段版本取舍：为什么先做这个版本、暂时不做什么',
                        '准备和研发/设计对齐时最容易卡住的一处细节'
                    ]
                };
            case'AI Skill/产品落地':
                return{
                    title:`${prefix}Skill 设计与落地表达`,
                    reason:supported?'JD 写到 Skill、Agent 或工作流时，核心是看你能不能讲清输入、处理逻辑、输出结果和上线后的稳定性。':'这块通常会被深挖到很细，提前把 Skill 的输入、规则、兜底和质量标准讲顺，现场会稳很多。',
                    what_to_prepare:[
                        '准备一条完整链路：输入是什么、核心处理逻辑是什么、输出给谁看',
                        '准备质量标准：准确性、稳定性、响应时长、人工介入率',
                        '准备可复用口径：哪些模块能迁到新场景，哪些必须重做'
                    ]
                };
            case'漏斗/指标验证':
                return{
                    title:`${prefix}指标验证与结果口径`,
                    reason:supported?'JD 提到指标、转化或留存时，面试官会继续问你看了哪些数据、怎么验证变化、结果有没有业务意义。':'这块如果口径不清，现场很容易被追问卡住，最好把核心指标、辅助指标和验证方式提前定下来。',
                    what_to_prepare:[
                        '把主链路拆成 3 到 4 个关键环节，明确每一层看什么指标',
                        '准备核心指标和辅助指标的定义口径、统计周期和样本范围',
                        '准备一次验证方法：改了什么、看多久、怎么判断有效'
                    ]
                };
            case'跨团队推进':
                return{
                    title:`${prefix}跨团队推进与协作节奏`,
                    reason:supported?'JD 强调协作推进时，面试官通常会看你怎么分工、怎么收敛分歧、怎么把节奏推进到交付。':'这是非常容易被追问的能力项，提前把角色分工、卡点处理和里程碑讲清楚会更有说服力。',
                    what_to_prepare:[
                        '准备一版角色分工：产品、研发、设计、算法、业务各自负责什么',
                        '准备一次分歧处理：意见不一致时怎么收敛到可执行方案',
                        '准备推进节奏：里程碑、灰度范围、回滚条件'
                    ]
                };
            case'行业/业务理解':
            default:
                return{
                    title:`${prefix}业务场景与行业理解`,
                    reason:supported?'JD 只要涉及业务场景、行业理解或竞品判断，面试官就会看你能不能把场景说具体、把业务关系说清楚。':'这块往往决定面试官会不会把你当成能快速上手的人，最好把业务流程、场景痛点和判断口径先准备完整。',
                    what_to_prepare:[
                        '把业务场景讲具体：谁在用、在哪一步卡住、结果怎么衡量',
                        '准备 1 到 2 个高频业务流程，说明每一步的关键判断',
                        '准备为什么这家公司现在要做这件事，以及你觉得最难的环节'
                    ]
                };
        }
    };
    return angles.map(makeItem).slice(0,3);
}
function buildPrepareExperienceExample(entry,roleName,jdAngles){
    const focusLabel=getPrepareJdFocusLabel(jdAngles);
    switch(entry?.type){
        case'RESEARCH':
            return `例如：如果这段是论文/研究，就别只讲“我做了研究”，而要讲“我先用 ${jdAngles[0]||'用户访谈/资料检索'} 定义问题，再把发现整理成 ${jdAngles.includes('PRD/方案撰写')?'一页 PRD / 方案':'结构化结论'}，最后用反馈、采纳结果或答辩表现验证；这说明我能把陌生问题翻译成产品语言，也能和 ${roleName} 需要的判断方式对上”。`;
        case'CAMPUS':
            return `例如：如果这段是社团/校园项目，就讲“我先把目标拆成时间表、分工和交付物，再协调不同同学推进，最后用结果或反馈收尾；如果 JD 里强调 ${focusLabel}，你就把这段翻成‘我不是只参与活动，而是能组织资源、推进节奏、收束结果’”。`;
        case'DATA':
            return `例如：如果这段里有问卷、统计或数据分析，就讲“我先看样本/指标里最关键的异常，再据此判断问题出在哪、给出什么动作建议；如果 JD 里强调 ${focusLabel}，这段就不要停在‘做过分析’，而要补成‘分析→判断→动作→验证’”。`;
        case'PROJECT':
            return `例如：如果这段本身就是项目/实习，就直接讲“目标是什么、你具体负责什么、你做了哪些判断和推进、最后结果如何”，并明确对齐 JD 里的 ${focusLabel}；如果其中有用户访谈、需求整理、PRD、Skill 开发或漏斗优化，就一定把那条链路讲出来，这就是你最接近 ${roleName} 的证据。`;
        default:
            return `例如：把这段讲成“当时要解决什么问题、你怎么整理信息、怎么推动事情往前走、最后交付了什么”，再补一句“它对应 JD 里的 ${focusLabel}，最能证明我在 ${roleName} 需要的协作推进和结构化表达上是能上手的”。`;
    }
}
function buildPrepareExperienceFollowups(entry,roleName,jdAngles){
    const focusLabel=getPrepareJdFocusLabel(jdAngles);
    const highestValueAction=(function(){
        const segments=[];
        const labels=new Set(jdAngles||[]);
        if(labels.has('需求挖掘'))segments.push('用户访谈/痛点提炼');
        if(labels.has('PRD/方案撰写'))segments.push('一页 PRD / 需求说明');
        if(labels.has('AI Skill/产品落地'))segments.push('最小 Skill / Workflow demo');
        if(labels.has('漏斗/指标验证'))segments.push('指标 / 漏斗验证');
        if(labels.has('跨团队推进'))segments.push('跨团队推进记录');
        if(labels.has('行业/业务理解'))segments.push('竞品 / 行业判断记录');
        if(!segments.length)segments.push('问题定义 → 动作 → 结果');
        return `先把这段补成一条完整故事：${segments.join(' → ')}，这样你在 ${roleName} 面试里就能直接回答“我不是只懂概念，我能把事情做出来”。`;
    })();
    switch(entry?.type){
        case'RESEARCH':
            return[
                highestValueAction,
                '把论文/研究里最像产品工作的动作单独写出来：定义问题、查资料、搭框架、写结论、做汇报。',
                '补一个可验证结果，例如导师反馈、是否被采纳、完成周期、答辩结果或引用的核心结论。',
                `如果这段仍然偏学术，面试前补做一个 ${roleName} 相关的小案例，例如“${focusLabel} + 一页方案 / demo / 验证指标”。`
            ];
        case'CAMPUS':
            return[
                highestValueAction,
                '把活动目标、分工人数、排期、你解决过的卡点写清楚，不要只说“参与过”。',
                '补一个结果，例如到场人数、完成率、满意度、传播效果、周期缩短或执行效率提升。',
                `可以把这段包装成“我最接近产品推进的经历”，再补一个你最近为 ${roleName} 做的学习或 demo。`
            ];
        case'DATA':
            return[
                highestValueAction,
                '把你看过哪些数据、如何得出判断、最后给了什么建议说具体。',
                '补一个结果，例如判断被采纳、报告被使用、结论影响了后续动作。',
                `再加一个 ${roleName} 相关的小练习，把“分析”延伸到“方案建议”，说服力会强很多。`
            ];
        case'PROJECT':
            return[
                highestValueAction,
                '把你负责的判断节点和推进动作写实，不要只写团队做了什么。',
                '补一个结果数字，哪怕只是时间、效率、交付完成度或反馈改善。',
                `最后用一句话说明：为什么这段就是你最能支撑 ${roleName} 的例子。`
            ];
        default:
            return[
                highestValueAction,
                '先把这段里最像“扛事”的动作找出来，不要泛泛描述经历背景。',
                '补一个最小结果，不一定非得是商业指标，也可以是交付、反馈、完成度或影响范围。',
                `如果这段还是太弱，就并上一个最近新做的 ${roleName} 相关案例，再一起讲。`
            ];
    }
}
function buildPreparePriorityFromExperience(item,session,index){
    const section=normalizePrepareText(item?.resume_section||`关键经历 ${index+1}`);
    const matches=getPrepareExperienceSpecificJdMatch(item,session);
    const concreteBullets=getPrepareConcreteExperienceBullets(item);
    const followups=getPrepareExperienceFollowupPrompts(item);
    const title=index===0?`第一张牌先打 ${section}`:index===1?`第二张牌补上 ${section}`:`把 ${section} 变成加分项`;
    const reason=concreteBullets.length
        ?`${section} 不是泛化相关，而是已经能直接支撑 JD 中的 ${matches.join(' / ')||'关键要求'}。面试时优先讲这段，最容易让面试官快速建立“你能上手”的判断。`
        :`${section} 是你当前最能直接对上 JD 的经历之一，面试里应该优先拿它证明你能把岗位要求做成结果。`;
    const what=[
        concreteBullets.length
            ?`先把这 1 到 2 个点讲透：${concreteBullets.slice(0,2).join('；')}。`
            :`先把 ${section} 拆成“问题 / 判断 / 动作 / 结果”四步，不要只报任务名。`,
        concreteBullets[2]
            ?`如果时间够，再补 ${concreteBullets[2]}，把结果验证或业务影响讲完整。`
            :'一定补清楚你亲自负责到哪一步，以及结果有没有数字或反馈证明。',
        followups[0]
            ?`高概率追问会落在这里：${followups[0].replace(/[？?]+$/,'')}。`
            :`最后用一句话把这段收回到 ${session.role_name||'当前岗位'} 需要的能力上。`
    ];
    return{title,reason,what_to_prepare:what.filter(Boolean).slice(0,4)};
}
function buildPrepareGapPriority(session,bestExperiences,riskWarnings){
    const roleName=normalizePrepareText(session?.role_name||'当前岗位');
    const matches=[...new Set(bestExperiences.flatMap(function(item){
        return getPrepareExperienceSpecificJdMatch(item,session);
    }))];
    const missingAngles=getPrepareJdFocusAngles(session?.jd_text||'').filter(function(angle){
        return !matches.includes(angle);
    });
    const topRisk=riskWarnings[0];
    return{
        title:'最后补位最容易被追问的缺口',
        reason:missingAngles.length
            ?`你现有经历已经能撑起一部分 JD，但 ${missingAngles.join(' / ')} 这几块还是最容易被面试官追问。这里不是让你回避，而是提前准备怎么补、怎么迁移。`
            :`已有经历已经能覆盖大部分 JD，但面试官仍会继续追问“为什么你能在这个岗位快速上手”，所以最后要准备一段补位表达。`,
        what_to_prepare:[
            missingAngles.length?`把 ${missingAngles[0]} 准备成“已有经历怎么迁移 + 面试前补了什么最小案例/学习”的说法。`:`准备一段“已有经历如何迁移到新场景”的回答。`,
            topRisk?`优先防这个坑：${topRisk.title}。${topRisk.avoidance_tip}`:`提前准备一段“如果让我把这套能力迁到财务场景，我会怎么做”的回答。`,
            `结尾别只说“我愿意学”，要说“我已经有哪段经历、补了什么、入职后会先抓什么”。`
        ]
    };
}
function synthesizePreparePriorities(session,bestExperiences,riskWarnings){
    const priorities=bestExperiences.slice(0,2).map(function(item,index){
        return buildPreparePriorityFromExperience(item,session,index);
    });
    priorities.push(buildPrepareGapPriority(session,bestExperiences,riskWarnings));
    return priorities.filter(function(item){
        return item.title&&item.reason&&item.what_to_prepare?.length;
    }).slice(0,3);
}
function hasPrepareSpecificPriorityReference(item,bestExperiences,session){
    const text=[item?.title,item?.reason].concat(item?.what_to_prepare||[]).join(' ');
    const normalized=normalizePrepareText(text).toLowerCase();
    if(!normalized)return false;
    if(bestExperiences.some(function(exp){
        const section=normalizePrepareText(exp.resume_section||'').toLowerCase();
        return section&&normalized.includes(section);
    }))return true;
    return /antalpha|bacera|resume trail|履迹|skill|agent|prd|留存|漏斗|访谈|财务|风控|对账|报销/.test(normalized);
}
function sanitizePrepareFocus(output,session){
    const fallbackFocus=buildPrepareOutputsFallback(session||{}).focus||{};
    const currentFocus=output?.focus||{};
    const rawPrepPriorities=((currentFocus.prep_priorities||[]).length?currentFocus.prep_priorities:fallbackFocus.prep_priorities||[]).map(function(item,index){
        return{
            title:normalizePrepareText(item?.title||`准备重点 ${index+1}`),
            reason:normalizePrepareText(item?.reason||''),
            what_to_prepare:sanitizePrepareTextList(item?.what_to_prepare,[],4)
        };
    }).filter(function(item){
        return item.title||item.reason||item.what_to_prepare.length;
    });
    const currentExperiences=((currentFocus.best_experiences||[]).length?currentFocus.best_experiences:fallbackFocus.best_experiences||[]).map(function(item,index){
        const fallbackItem=(fallbackFocus.best_experiences||[])[index]||(fallbackFocus.best_experiences||[])[0]||{};
        return{
            resume_section:normalizePrepareText(item?.resume_section||fallbackItem.resume_section||`经历线索 ${index+1}`),
            why_match:normalizePrepareText(item?.why_match||fallbackItem.why_match||'这段内容可以先当作可迁移能力线索来准备。'),
            highlight_points:sanitizePrepareTextList(item?.highlight_points,fallbackItem.highlight_points,4),
            possible_followups:sanitizePrepareTextList(item?.possible_followups,fallbackItem.possible_followups,4)
        };
    }).filter(function(item){
        return item.resume_section&&item.why_match&&(item.highlight_points.length||item.possible_followups.length);
    });
    const bestExperiences=[];
    const seenExperienceKeys=new Set();
    currentExperiences.forEach(function(item){
        if(isPrepareGenericExperienceItem(item))return;
        const compareKey=normalizePrepareCompareKey(`${item.resume_section} ${item.why_match}`);
        if(!compareKey||seenExperienceKeys.has(compareKey))return;
        seenExperienceKeys.add(compareKey);
        bestExperiences.push(item);
    });
    if(!bestExperiences.length){
        (fallbackFocus.best_experiences||[]).forEach(function(item){
            const compareKey=normalizePrepareCompareKey(`${item.resume_section} ${item.why_match}`);
            if(!compareKey||seenExperienceKeys.has(compareKey))return;
            seenExperienceKeys.add(compareKey);
            bestExperiences.push(item);
        });
    }
    const riskWarnings=((currentFocus.risk_warnings||[]).length?currentFocus.risk_warnings:fallbackFocus.risk_warnings||[]).map(function(item,index){
        const fallbackItem=(fallbackFocus.risk_warnings||[])[index]||{};
        return{
            title:normalizePrepareText(item?.title||fallbackItem.title||`风险提示 ${index+1}`),
            description:normalizePrepareText(item?.description||fallbackItem.description||'这块如果讲不清，面试官会自然追问。'),
            avoidance_tip:normalizePrepareText(item?.avoidance_tip||fallbackItem.avoidance_tip||'提前准备一版更具体的表达。')
        };
    }).filter(function(item){
        return item.title&&item.description&&item.avoidance_tip;
    });
    const priorityBlueprint=buildPrepareJdPriorityBlueprint(session||{});
    const prepPriorities=priorityBlueprint.map(function(item,index){
        const currentItem=rawPrepPriorities[index]||{};
        const joined=[currentItem.title,currentItem.reason].concat(currentItem.what_to_prepare||[]).join(' ');
        const polluted=/简历|经历|实习|项目经历|项目里|这段经历|右边|讲哪段|哪段经历|第一段|第二张牌|补位/.test(joined);
        const tooGeneric=/准备重点|讲清楚|说清楚|泛泛|能力|这块/.test(currentItem.title||'')&&!(currentItem.what_to_prepare||[]).length;
        if(!currentItem.title||polluted||tooGeneric)return item;
        return{
            title:normalizePrepareText(currentItem.title||item.title),
            reason:polluted||!currentItem.reason?item.reason:normalizePrepareText(currentItem.reason),
            what_to_prepare:polluted||!(currentItem.what_to_prepare||[]).length?item.what_to_prepare:sanitizePrepareTextList(currentItem.what_to_prepare,item.what_to_prepare,4)
        };
    }).slice(0,3);
    return{
        prep_priorities:prepPriorities,
        best_experiences:bestExperiences.slice(0,3),
        risk_warnings:riskWarnings
    };
}
function normalizePrepareOutputsPayload(output){
    if(!output)return{};
    if(typeof output==='string'){
        try{
            const parsed=JSON.parse(output);
            return parsed&&typeof parsed==='object'?parsed:{};
        }catch(error){
            return{};
        }
    }
    return output&&typeof output==='object'?output:{};
}
function sanitizePrepareOutputs(output,session){
    const next=cloneData(normalizePrepareOutputsPayload(output));
    const knownBriefs=getPrepareKnownTermBriefs(session||{});
    const keywordTranslation=(next?.research?.keyword_translation||[]).map(function(item){
        const brief=findPrepareKnownTermBrief(item?.jd_keyword,knownBriefs);
        if(brief){
            return{
                jd_keyword:brief.term,
                meaning:brief.meaning,
                prep_direction:brief.prep_direction
            };
        }
        return sanitizePrepareKeywordTranslationItem(item);
    });
    knownBriefs.forEach(function(brief){
        const exists=keywordTranslation.some(function(item){
            return findPrepareKnownTermBrief(item.jd_keyword,[brief]);
        });
        if(!exists){
            keywordTranslation.unshift({
                jd_keyword:brief.term,
                meaning:brief.meaning,
                prep_direction:brief.prep_direction
            });
        }
    });
    next.research=Object.assign({},next.research||{},{keyword_translation:keywordTranslation});
    next.focus=sanitizePrepareFocus(next,session);
    const questionGroups=(next?.questions?.question_groups||[]).map(function(group){
        const groupName=normalizePrepareText(group?.group_name||'');
        return Object.assign({},group,{
            group_name:/反问/.test(groupName)?'反问环节':groupName,
            questions:(group?.questions||[]).map(function(question){
                return normalizePrepareQuestionRecord(question);
            })
        });
    });
    next.questions=Object.assign({},next.questions||{},{question_groups:questionGroups});
    next.meta=Object.assign({},next.meta||{});
    if(next.meta.summary){
        next.meta.summary=String(next.meta.summary).replace(/空白简历/g,'简历信息不足');
    }
    return next;
}
function isPrepareCompanyFitQuestion(question){
    const text=normalizePrepareText(question?.question||'');
    const type=normalizePrepareText(question?.question_type||'');
    return type==='company_fit'||/为什么(想来|选择|投递|加入).*(公司|团队)|为什么是.*(公司|团队)|为什么来我们公司|为什么选择我们|为什么投我们/.test(text);
}
function getPrepareQuestionExperienceKeywords(question){
    const text=normalizePrepareText(question?.question||'');
    const lower=text.toLowerCase();
    const keywords=[];
    const push=function(keyword){
        if(keyword&&!keywords.includes(keyword))keywords.push(keyword);
    };
    if(/skill|agent|tool/.test(lower)){push('skill');push('agent');}
    if(/prd|需求|访谈|痛点|功能优先级|产品/.test(text)){push('需求');push('prd');push('访谈');}
    if(/漏斗|留存|转化|增长|指标|数据|分析/.test(text)){push('漏斗');push('留存');push('数据');}
    if(/竞品|洞察/.test(text)){push('竞品');}
    if(/协作|产研|算法|设计|推进/.test(text)){push('协作');push('推进');}
    if(/财务|报销|对账|风控/.test(text)){push('财务');push('风控');}
    if(/项目|上线|落地/.test(text)){push('落地');push('上线');}
    return keywords;
}
function selectPrepareRelevantExperiences(experiences,question){
    const list=(Array.isArray(experiences)?experiences:[]).filter(function(item){
        return item&&normalizePrepareText(item.resume_section)!=='当前简历缺少直接证据';
    });
    if(!list.length)return[];
    const companyFit=isPrepareCompanyFitQuestion(question);
    const text=normalizePrepareText(question?.question||'');
    const normalizedQuestion=normalizePrepareText(text).toLowerCase();
    const keywords=getPrepareQuestionExperienceKeywords(question);
    const scored=list.map(function(item,index){
        const haystack=[item.resume_section,item.why_match].concat(item.highlight_points||[]).concat(item.possible_followups||[]).join(' ');
        const normalizedHaystack=normalizePrepareText(haystack).toLowerCase();
        let score=0;
        const section=normalizePrepareText(item.resume_section||'');
        if(section&&normalizedQuestion.includes(section.toLowerCase()))score+=80;
        keywords.forEach(function(keyword){
            if(normalizedHaystack.includes(keyword.toLowerCase()))score+=18;
        });
        if(/被调用|留存|提升|转化|上线|输出prd|访谈|风控|对账|报销|竞品|协作|推进/.test(haystack))score+=12;
        if(companyFit){
            if(/产品|需求|落地|技能|skill|agent|协作|数据|增长|访谈/.test(haystack))score+=16;
            if(/留存|调用|上线|prd/.test(haystack))score+=10;
        }
        if((question?.question_type||'')==='resume_deep_dive')score+=10;
        return{item,score,index};
    }).sort(function(a,b){
        if(b.score!==a.score)return b.score-a.score;
        return a.index-b.index;
    });
    return scored.map(function(entry){return entry.item;});
}
function getPrepareQuestionMatchedExperiences(source,question){
    const experiences=Array.isArray(source)
        ?source
        :Array.isArray(source?.focus?.best_experiences)
            ?source.focus.best_experiences
            :[];
    return selectPrepareRelevantExperiences(experiences,question).slice(0,3);
}
function getPrepareQuestionGroups(session){
    const normalizedOutputs=session?.outputs?sanitizePrepareOutputs(session.outputs,session):null;
    return normalizedOutputs?.questions?.question_groups||[];
}
function buildPrepareFallbackRenderSession(session){
    return Object.assign({},session,{
        outputs:sanitizePrepareOutputs(buildPrepareOutputsFallback(session),session)
    });
}
function resetPrepareWorkspaceState(sessionId){
    prepareState.selectedSessionId=sessionId||null;
    prepareState.lastOpenedSessionId=sessionId||'';
    prepareState.activeTab='research';
    prepareState.questionPane='list';
    prepareState.selectedQuestionId=null;
    prepareState.selectedFramework='STAR';
    prepareState.questionGroupLoadingKey='';
    prepareState.answerLoading=false;
    prepareState.answerError='';
    prepareState.showSupplementModal=false;
    prepareState.showJdPreview=false;
    prepareState.showResumePreview=false;
    prepareState.freeQuestionText='';
}
function renderPrepareWorkbenchFallback(session){
    const fallbackSession=buildPrepareFallbackRenderSession(session);
    resetPrepareWorkspaceState(session?.id||'');
    return renderPrepareWorkbench(fallbackSession);
}
function renderPrepareTabByKey(activeTab,session){
    switch(activeTab){
        case 'focus':
            return renderPrepareFocus(session);
        case 'questions':
            return renderPrepareQuestions(session);
        case 'mock':
            return renderPrepareMockInterview(session);
        case 'research':
        default:
            return renderPrepareResearch(session);
    }
}
function syncPrepareApplicationDraft(appId){
    prepareState.selectedApplicationId=appId||'';
    const app=appId?store.getApp(appId):null;
    prepareState.appSupplement={
        jdText:app?.jd_text||'',
        jdUrl:app?.jd_url||'',
        resumeId:app?.resume_id||'',
        resumeText:''
    };
    prepareState.appSupplementFile=null;
    prepareState.appSupplementParse={status:'idle',text:'',message:''};
}
function getPrepareApplicationDraft(app){
    if(!app)return null;
    const supplement=prepareState.appSupplement||{};
    const resumeId=app.resume_id||supplement.resumeId||'';
    const linkedResume=resumeId?store.getResume(resumeId):null;
    const resumeText=normalizePrepareText(supplement.resumeText||linkedResume?.extracted_text||linkedResume?.notes||'');
    const resumeFileMeta=prepareState.appSupplementFile?{
        name:prepareState.appSupplementFile.name,
        size:prepareState.appSupplementFile.size,
        type:prepareState.appSupplementFile.type||'application/octet-stream'
    }:null;
    const jdText=normalizePrepareText(supplement.jdText||app.jd_text);
    const jdUrl=normalizePrepareText(supplement.jdUrl||app.jd_url);
    const hasResumeContext=Boolean(linkedResume||resumeText||resumeFileMeta);
    return{
        jdText,
        jdUrl,
        resumeId:linkedResume?.id||'',
        linkedResume,
        resumeText,
        resumeFileMeta,
        requiresJd:!hasPrepareUsableJd(jdText),
        requiresResume:!hasResumeContext
    };
}
function getPrepareSessionPayload(session){
    const linkedResume=getPrepareLinkedResume(session);
    const supplementalExperiences=getPrepareSupplementalExperiences(session);
    const supplementalSummary=getPrepareSupplementalExperienceSummary(session);
    const mergedResumeText=mergePrepareResumeTexts(session.resume_text||linkedResume?.extracted_text||linkedResume?.notes||'',supplementalSummary);
    return{
        company_name:session.company_name||'',
        role_name:session.role_name||'',
        role_category:session.role_category||'',
        jd_text:session.jd_text||'',
        jd_url:session.jd_url||'',
        resume_name:linkedResume?.file_name||session.resume_name||'',
        resume_text:mergedResumeText,
        resume_file_meta:session.resume_file_meta||null,
        resume_source:session.resume_source||'',
        resume_verified:!!session.resume_verified,
        supplemental_experiences:supplementalExperiences,
        supplemental_experience_summary:supplementalSummary
    };
}
function normalizePrepareSupplementalExperience(item){
    const source=typeof item==='string'?{text:item}:Object.assign({},item||{});
    const text=normalizePrepareText(source.text||source.content||'');
    if(!text)return null;
    return{
        id:source.id||createLocalId('prepare_exp'),
        text,
        question_id:source.question_id||source.questionId||'',
        source:source.source||'manual',
        created_at:source.created_at||new Date().toISOString()
    };
}
function getPrepareSupplementalExperiences(session){
    return Array.isArray(session?.supplemental_experiences)
        ?session.supplemental_experiences.map(normalizePrepareSupplementalExperience).filter(Boolean)
        :[];
}
function getPrepareSupplementalExperienceSummary(session){
    const items=getPrepareSupplementalExperiences(session);
    if(!items.length)return'';
    return items.map(function(item,index){
        return `${index+1}. ${item.text}`;
    }).join('\n');
}
async function updatePrepareSupplementalExperiences(sessionId,updater){
    const session=store.getPrepareSession(sessionId);
    if(!session)return false;
    const current=getPrepareSupplementalExperiences(session);
    const next=typeof updater==='function'?updater(current):current;
    return store.updatePrepareSession(sessionId,{
        supplemental_experiences:next.map(normalizePrepareSupplementalExperience).filter(Boolean)
    });
}
async function addPrepareSupplementalExperience(sessionId,text,meta){
    const item=normalizePrepareSupplementalExperience(Object.assign({},meta||{},{text}));
    if(!item)return false;
    return updatePrepareSupplementalExperiences(sessionId,function(current){
        return [item,...current].slice(0,12);
    });
}
async function removePrepareSupplementalExperience(sessionId,experienceId){
    return updatePrepareSupplementalExperiences(sessionId,function(current){
        return current.filter(function(item){return item.id!==experienceId;});
    });
}
function getPrepareResumeSnapshot(session){
    const linkedResume=getPrepareLinkedResume(session);
    const rawText=normalizePrepareText(mergePrepareResumeTexts(
        session.resume_text||linkedResume?.extracted_text||linkedResume?.notes||'',
        getPrepareSupplementalExperienceSummary(session)
    ));
    const tags=(linkedResume?.tags||[]).map(item=>normalizePrepareText(item)).filter(Boolean);
    const fragments=rawText.split(/[\n。；;]+/).map(item=>normalizePrepareText(item)).filter(Boolean);
    const metricEvidence=fragments.filter(item=>/\d/.test(item)).slice(0,6);
    const actionEvidence=fragments.filter(item=>/(负责|主导|推动|搭建|分析|优化|增长|策略|产品|运营|项目|协调|落地|上线|复盘)/.test(item)).slice(0,6);
    const evidenceLines=[...new Set([...tags,...metricEvidence,...actionEvidence,...fragments.slice(0,8)])].slice(0,8);
    const gaps=[];
    if(!rawText)gaps.push('当前没有可用的简历摘要或项目描述，无法确认可直接举证的经历。');
    if(evidenceLines.length<3)gaps.push('当前简历线索偏少，建议补充项目背景、你的动作、结果数字和个人贡献。');
    return{
        resume_name:linkedResume?.file_name||session.resume_name||'未命名简历',
        raw_text:rawText,
        tags,
        evidence_lines:evidenceLines,
        metric_evidence:metricEvidence,
        gaps
    };
}
function getPrepareSessionStatusLabel(session){
    switch(session?.status){
        case'generated':return'已生成';
        case'error':return'生成失败';
        case'pending':return'准备中';
        default:return'草稿';
    }
}
function safeParsePrepareJson(text){
    const raw=String(text||'').trim();
    if(!raw)throw new Error('AI 返回为空');
    const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate=(fenced?fenced[1]:raw).trim();
    try{
        return JSON.parse(candidate);
    }catch(error){
        const start=candidate.indexOf('{');
        const end=candidate.lastIndexOf('}');
        if(start>=0&&end>start){
            return JSON.parse(candidate.slice(start,end+1));
        }
        throw error;
    }
}
function getPrepareMessageText(message){
    if(typeof message?.content==='string')return message.content;
    if(Array.isArray(message?.content)){
        return message.content.map(function(part){
            if(typeof part==='string')return part;
            if(part?.type==='text'&&typeof part.text==='string')return part.text;
            if(typeof part?.content==='string')return part.content;
            return'';
        }).join('\n').trim();
    }
    if(typeof message?.text==='string')return message.text;
    if(typeof message?.reasoning_content==='string'&&message.reasoning_content.includes('{'))return message.reasoning_content;
    return'';
}
function buildPrepareSessionMessagesClient(input){
    const resumeSnapshot=getPrepareResumeSnapshot(input);
    const knownTermBriefs=getPrepareKnownTermBriefs(input);
    const analysisPlaybooks=getPrepareAnalysisPlaybooks(input);
    const payload={
        company_name:normalizePrepareText(input.company_name||'目标公司'),
        role_name:normalizePrepareText(input.role_name||'目标岗位'),
        role_category:normalizePrepareText(input.role_category),
        jd_text:normalizePrepareText(input.jd_text),
        jd_url:normalizePrepareText(input.jd_url),
        resume_name:normalizePrepareText(input.resume_name),
        resume_text:normalizePrepareText(input.resume_text),
        resume_file_meta:input.resume_file_meta||null,
        resume_snapshot:resumeSnapshot,
        supplemental_experiences:input.supplemental_experiences||[],
        supplemental_experience_summary:normalizePrepareText(input.supplemental_experience_summary),
        external_term_briefs:knownTermBriefs,
        analysis_playbooks:analysisPlaybooks,
        intelligence_context:input.intelligence_context||{}
    };
    return[
        {
            role:'system',
            content:'你是资深中文产品经理与面试教练，任务是为求职者生成高度可执行的面试准备工作台。输出必须是纯 JSON，不要 markdown，不要代码块，不要额外解释。系统可能已经提供 external_web_research 公开检索背景；只要它存在，就必须优先使用这些资料理解陌生专有名词、平台名、产品名、公司业务、行业黑话与近期语境，禁止凭感觉猜。intelligence_context 是额外增强层：role_standard 用来判断 JD 真正考什么，semantic_evidence 用来挑最贴题的简历/补充经历证据，company_intelligence 和 external_skill_standard 用来补业务与岗位标准。只要它存在，必须优先参考它来避免模板化、重复化和总引用最近经历。强约束：1）先深度阅读 resume_snapshot，再读 JD；2）external_term_briefs 是已经核实过的公开术语情报，只要它提供了定义，就应该直接使用，禁止再写成“看起来像”“可能是”；3）analysis_playbooks 是必须复用的专业分析框架，先按这些 checklist 做结构化判断，再组织输出；4）focus.best_experiences 只能引用 resume_snapshot.evidence_lines、semantic_evidence 或 resume_text 里真实出现过的经历线索，禁止捏造项目、职位、数字和职责；5）如果简历里没有直接匹配岗位的内容，不要假装有匹配，请明确写出缺口，并在 highlight_points / possible_followups 里告诉用户应该补挖什么经历；6）best_experiences 最多返回 3 条，而且每条都必须绑定不同的真实线索，禁止把同一套泛化建议换个标题重复写；7）当匹配度低时，至少给 1 条“可以这样讲”的具体表达示例，而不是只给抽象提醒；8）所有问题和建议都必须尽量回扣 JD；9）如果 external_term_briefs、external_web_research 和 intelligence_context 都没有覆盖某个专有名词，才标注为“待确认术语”；10）keyword_translation 必须专业、准确、可执行，优先解释业务含义和面试重点；11）每道 question 都要判断最适合的回答框架，返回 recommended_frameworks、default_framework、framework_reason，不要把不适合的框架硬塞进去；12）meta.lens 要短，控制在 10 个汉字内，例如“产品增长准备”“数据分析准备”；13）questions.question_groups 必须混合 JD 题、简历深挖、行为面 / 宝洁八大问、场景 / case、反问环节，不要所有问题都只来自 JD 原文；14）focus.best_experiences 每条都要说明对应 JD 的哪一项、怎么展开、还缺什么细节要补清楚；highlight_points 至少要覆盖“对应 JD”“怎么展开”“还缺什么证据/细节”“可以直接开讲的示例句”四层信息，不要只给抽象提醒；15）best_experiences 要优先覆盖不同的真实经历板块，例如不同实习、不同项目，不要把多段经历揉成一条泛泛总结；resume_section 要尽量写成具体经历名，让前端可以按经历分组展示；16）prep_priorities 必须百分百围绕 JD 的职责、能力、业务理解和高频追问来写，简历只能作为判断“哪些点该强化、哪些点该补齐”的后台依据，禁止在 prep_priorities 里出现简历、经历、实习、项目、哪段经历、怎么讲某段经历这类表述；17）prep_priorities 要写成专业面试老师会给出的准备建议，重点是“面试官会怎么追问、你要准备什么判断口径、业务理解、指标定义和表达边界”，不要写固定模板句；18）best_experiences 的四个维度不要每条都写成同一套模板，必须引用该经历自己的具体成果、动作或数字。当匹配度低时，必须给出至少 1 条“可以这样讲”的具体表达示例，以及“可以补做什么 / 补学什么 / 怎么包装”的建议。输出字段必须严格符合 schema：{"research":{"company_overview":{"one_liner":"string","business_lines":["string"],"products_services":["string"],"business_model":"string","market_position":"string","recent_focus":["string"]},"role_analysis":{"role_type":"string","target_capabilities":["string"],"business_context":"string","interviewer_focus":["string"]},"keyword_translation":[{"jd_keyword":"string","meaning":"string","prep_direction":"string"}]},"focus":{"prep_priorities":[{"title":"string","reason":"string","what_to_prepare":["string"]}],"best_experiences":[{"resume_section":"string","why_match":"string","highlight_points":["string"],"possible_followups":["string"]}],"risk_warnings":[{"title":"string","description":"string","avoidance_tip":"string"}]},"questions":{"question_groups":[{"group_name":"string","questions":[{"id":"string","question":"string","question_type":"string","source":"string","importance":"high|medium","recommended_frameworks":["STAR|PREP|PAR|SCQA"],"default_framework":"STAR|PREP|PAR|SCQA","framework_reason":"string"}]}]},"meta":{"lens":"string","summary":"string","provider":"string","model":"string"}}'
        },
        {
            role:'user',
            content:`请基于以下准备会话信息生成面试准备工作台 JSON：\n${JSON.stringify(payload,null,2)}`
        }
    ];
}
function buildPrepareAnswerMessagesClient(input){
    const resumeSnapshot=getPrepareResumeSnapshot(input);
    const knownTermBriefs=getPrepareKnownTermBriefs(input);
    const analysisPlaybooks=getPrepareAnalysisPlaybooks(input);
    const matchedExperiences=getPrepareQuestionMatchedExperiences(input.prep_focus||[],input);
    const payload={
        company_name:normalizePrepareText(input.company_name||'目标公司'),
        role_name:normalizePrepareText(input.role_name||'目标岗位'),
        role_category:normalizePrepareText(input.role_category),
        jd_text:normalizePrepareText(input.jd_text),
        resume_name:normalizePrepareText(input.resume_name),
        resume_text:normalizePrepareText(input.resume_text),
        resume_snapshot:resumeSnapshot,
        prep_focus:input.prep_focus||[],
        prep_keywords:input.prep_keywords||[],
        supplemental_experiences:input.supplemental_experiences||[],
        supplemental_experience_summary:normalizePrepareText(input.supplemental_experience_summary),
        external_term_briefs:knownTermBriefs,
        analysis_playbooks:analysisPlaybooks,
        intelligence_context:input.intelligence_context||{},
        question:normalizePrepareText(input.question),
        question_type:normalizePrepareText(input.question_type),
        source:normalizePrepareText(input.source),
        question_matched_experiences:matchedExperiences,
        recommended_frameworks:input.recommended_frameworks||[],
        default_framework:normalizePrepareText(input.default_framework),
        framework_type:normalizePrepareText(input.framework_type||'STAR')
    };
    return[
        {
            role:'system',
            content:'你是资深面试教练。任务是基于公司、岗位、JD、简历内容，为一条具体问题生成“回答骨架”，但这版骨架必须足够接近现场可直接开口，不要只给空泛提纲。输出必须是纯 JSON，不要 markdown，不要代码块，不要额外解释。所有文案为简体中文。系统可能已经提供 external_web_research 公开检索背景；只要它存在，就必须优先使用这些资料理解陌生专有名词、平台名、产品名、公司业务和行业黑话，禁止凭感觉猜。intelligence_context.semantic_evidence 是针对本题选择证据的优先参考，role_standard 是判断岗位要考什么的优先参考。recommended_frameworks / default_framework 是上一步对这道题筛过的更适合框架，你要顺着这个判断来组织，不要把明显不合适的结构硬套进去。强约束：1）先从 resume_snapshot、prep_focus、semantic_evidence 和 question_matched_experiences 里找证据，再组织答案；2）external_term_briefs 是已核实的公开术语情报，只要里面有定义，就直接按该定义使用，不要再写成模糊猜测；3）analysis_playbooks 是必须复用的专业回答框架与判断维度，先按 checklist 判断，再组织输出；4）suggested_points 必须优先引用真实简历线索，禁止编造项目、角色、结果数字；5）如果当前简历没有足够证据回答这题，要明确指出缺口，并建议用户补挖哪类经历，而不是强行写像真的内容；6）如果 question 涉及 external_term_briefs 里的术语，回答重点要放在业务理解、产品判断和可迁移能力，而不是空泛概念；7）如果 external_term_briefs、external_web_research 和 intelligence_context 都没有覆盖问题里的关键术语，才用“待确认术语”表达不确定性；8）如果是自由提问，请直接围绕用户输入的问题作答，不要强行套默认问法；9）copyable_outline 不能写成 Point/Reason/Example 这种模板标题，必须是一段 120 到 220 字、用户可以直接说出口的中文回答；10）如果题目像“如何定义 Skill 的质量标准 / 如何保证可复用性”这种业务判断题，必须直接给出你的判断维度和落地做法，不要只写“先讲背景、再讲动作”；11）如果问题是“为什么来我们公司 / 为什么选择我们 / 为什么想加入”，先回答公司和岗位吸引力，再挑 1 段最相关经历做证明，禁止把整段回答写成最近一段实习复述；12）不要机械默认 prep_focus 第一条或最近经历。每道题都要重新判断最匹配的经历；如果另一段项目或实习更贴题，就切换到那一段；13）如果题目更看业务理解、岗位判断或公司动机，回答主体应该是你的判断，经历只用来做短证据，不要把经历写成主角。输出 schema：{"question_id":"string","framework_type":"string","structure":[{"section":"string","guidance":"string","suggested_points":["string"]}],"delivery_tips":["string"],"copyable_outline":"string","resume_evidence_used":["string"],"gap_note":"string"}'
        },
        {
            role:'user',
            content:`请基于以下信息生成回答骨架 JSON：\n${JSON.stringify(payload,null,2)}`
        }
    ];
}
async function requestPrepareDirectAI(messages,input,kind){
    const config=getPrepareConfig();
    const apiKey=normalizePrepareText(config.apiKey);
    if(!apiKey)throw new Error('浏览器直连模式需要先填写 DeepSeek API Key。');
    const lookupDigest=await buildPrepareExternalResearchDigest(input||{},kind||'session');
    const conversation=buildPrepareLookupAugmentedMessages(messages,lookupDigest);
    const attemptConfigs=[
        {jsonMode:true,maxTokens:kind==='answer'?2400:5200},
        {jsonMode:false,maxTokens:kind==='answer'?2600:5600}
    ];
    for(const attempt of attemptConfigs){
        let response;
        try{
            response=await fetch(`${getPrepareDirectBase()}/chat/completions`,{
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'Authorization':`Bearer ${apiKey}`
                },
                body:JSON.stringify({
                    model:config.model||'deepseek-v4-flash',
                    temperature:0.2,
                    stream:false,
                    max_tokens:attempt.maxTokens,
                    response_format:attempt.jsonMode?{type:'json_object'}:{type:'text'},
                    thinking:{type:'disabled'},
                    messages:conversation
                })
            });
        }catch(error){
            throw new Error('浏览器直连请求失败。请确认网络正常，并检查 DeepSeek 是否允许当前浏览器直接访问。');
        }
        const data=await response.json().catch(()=>({}));
        if(!response.ok){
            throw new Error(data?.error?.message||data?.error||`DeepSeek 请求失败（${response.status}）`);
        }
        const message=data?.choices?.[0]?.message||{};
        const content=getPrepareMessageText(message)||String(data?.choices?.[0]?.text||'').trim();
        if(!content)continue;
        try{
            const output=safeParsePrepareJson(content);
            return Object.assign({},output,{
                meta:Object.assign({},output?.meta||{},{
                    provider:'DeepSeek',
                    model:config.model||'deepseek-v4-flash',
                    source:'direct'
                })
            });
        }catch(error){
            continue;
        }
    }
    throw new Error('DeepSeek 这次没有稳定返回结构化结果。我已经自动重试过安全路径，你可以再点一次重新生成。');
}
async function requestPrepareEdgeAI(messages,kind){
    if(!window.rtAccountService||typeof window.rtAccountService.invokeFunction!=='function'){
        throw new Error('线上 AI 服务还没初始化完成，请稍后刷新重试。');
    }
    const config=getPrepareConfig();
    const payload=await window.rtAccountService.invokeFunction(config.functionName||'prepare-ai',{
        kind:kind||'session',
        model:config.model||'deepseek-v4-flash',
        messages:messages
    });
    if(!payload||typeof payload!=='object'||!payload.output){
        throw new Error('AI 服务返回为空，请重新生成一次。');
    }
    return payload.output;
}
async function requestPrepareCustomAI(messages,kind,payload){
    if(getPrepareConfig().mode==='supabase_edge'){
        return requestPrepareEdgeAI(messages,kind);
    }
    if(getPrepareConfig().mode==='direct'){
        return requestPrepareDirectAI(messages,payload||{},kind);
    }
    const response=await fetch(`${getPrepareApiBase()}/api/prepare/custom`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            kind:kind||'session',
            messages:messages
        })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data?.ok||!data?.output)throw new Error(data?.error||'AI 服务生成失败');
    return data.output;
}
function buildPrepareQuestionGroupMessagesClient(session,group){
    const groupName=normalizePrepareText(group?.group_name||'问题题型');
    const payload={
        company_name:normalizePrepareText(session.company_name||'目标公司'),
        role_name:normalizePrepareText(session.role_name||'目标岗位'),
        role_category:normalizePrepareText(session.role_category||''),
        jd_text:normalizePrepareText(session.jd_text||''),
        resume_name:normalizePrepareText(getPrepareLinkedResume(session)?.file_name||session.resume_name||''),
        resume_text:normalizePrepareText(session.resume_text||''),
        supplemental_experiences:getPrepareSupplementalExperiences(session),
        supplemental_experience_summary:getPrepareSupplementalExperienceSummary(session),
        prep_focus:session.outputs?.focus||{},
        question_groups:session.outputs?.questions?.question_groups||[],
        target_group:groupName,
        target_questions:Array.isArray(group?.questions)?group.questions.map(function(item){
            return{
                id:item?.id||'',
                question:normalizePrepareText(item?.question||''),
                question_type:normalizePrepareText(item?.question_type||''),
                source:normalizePrepareText(item?.source||''),
                importance:normalizePrepareText(item?.importance||'medium')
            };
        }):[]
    };
    return[
        {
            role:'system',
            content:'你是资深面试教练，任务是针对指定题型重新生成 3 道更具体、更可回答的面试题。输出必须是纯 JSON，不要 markdown，不要代码块，不要额外解释。要求：1）所有文案简体中文；2）严格围绕当前 JD 和简历上下文；3）不要复用已有题目；4）如果题型是“反问环节”，题目必须是候选人要反问面试官的问题，不要写成让候选人回答的问题；5）如果题型是简历深挖，要尽量绑定简历中真实线索；6）如果题型是行为面，优先覆盖冲突、成就、失败、压力、取舍；7）如果题型是场景题，优先覆盖业务判断、指标、方案和收尾；8）每道题都要带 recommended_frameworks、default_framework、framework_reason；9）questions 必须正好 3 条。输出 schema：{"group_name":"string","questions":[{"id":"string","question":"string","question_type":"string","source":"string","importance":"high|medium","recommended_frameworks":["STAR","PREP","PAR","SCQA"],"default_framework":"STAR|PREP|PAR|SCQA","framework_reason":"string"}]}'
        },
        {
            role:'user',
            content:`请基于以下准备会话信息，为题型「${groupName}」重新生成 3 道问题：\n${JSON.stringify(payload,null,2)}`
        }
    ];
}
function buildPrepareMockFeedbackMessagesClient(session,question,answer,history){
    const payload={
        company_name:normalizePrepareText(session.company_name||'目标公司'),
        role_name:normalizePrepareText(session.role_name||'目标岗位'),
        role_category:normalizePrepareText(session.role_category||''),
        jd_text:normalizePrepareText(session.jd_text||''),
        resume_name:normalizePrepareText(getPrepareLinkedResume(session)?.file_name||session.resume_name||''),
        resume_text:normalizePrepareText(session.resume_text||''),
        supplemental_experiences:getPrepareSupplementalExperiences(session),
        supplemental_experience_summary:getPrepareSupplementalExperienceSummary(session),
        question:{
            id:question?.id||'',
            question:normalizePrepareText(question?.question||''),
            question_type:normalizePrepareText(question?.question_type||''),
            source:normalizePrepareText(question?.source||'')
        },
        answer:normalizePrepareText(answer||''),
        answer_history:Array.isArray(history)?history.slice(-4).map(function(item){
            return{
                question:normalizePrepareText(item?.question||''),
                answer:normalizePrepareText(item?.answer||''),
                feedback:normalizePrepareText(item?.feedback?.overall_feedback||item?.feedback||'')
            };
        }):[]
    };
    return[
        {
            role:'system',
            content:'你是资深面试教练，任务是对模拟面试中的单轮回答给出点评和建议，并输出可直接保存到复盘知识库的结构化 JSON。输出必须是纯 JSON，不要 markdown，不要代码块，不要额外解释。要求：1）所有文案简体中文；2）必须结合当前 JD 和简历上下文；3）点评要具体到“哪里说得好、哪里没说清、哪里需要补证据”；4）如果回答空泛，要指出应该补挖什么经历、补做什么最小案例、补学什么技能，以及怎么包装；5）建议必须能直接用于下一轮修改；6）如果是反问题，就点评问题本身是否问对了面试官，不要把它当作候选人回答题；7）输出 schema：{"overall_feedback":"string","strengths":["string"],"gaps":["string"],"suggestions":["string"],"follow_up_question":"string","pain_points":["string"],"self_rating":1,"reflection_summary":"string"}'
        },
        {
            role:'user',
            content:`请基于以下信息点评这轮模拟面试回答：\n${JSON.stringify(payload,null,2)}`
        }
    ];
}
function isPrepareReverseQuestionGroup(group){
    const groupName=normalizePrepareText(group?.group_name||'');
    if(/反问/.test(groupName))return true;
    const questions=Array.isArray(group?.questions)?group.questions:[];
    return !!questions.length&&questions.every(function(item){
        const question=normalizePrepareQuestionRecord(item);
        return question.question_type==='reverse_question'
            ||question.source==='reverse'
            ||/反问|问面试官|你可以问|要问面试官/.test(normalizePrepareText(question.question||''));
    });
}
function getPrepareQuestionSourceLabel(question){
    return question.source==='jd'?'来自 JD':question.source==='resume'?'来自简历':question.source==='behavioral'?'来自行为面':question.source==='custom'?'来自自定义问题':question.source==='reverse'?'反问环节':'来自岗位信息';
}
function shouldShowPrepareQuestionSource(group){
    const labels=(Array.isArray(group?.questions)?group.questions:[]).map(function(item){
        return getPrepareQuestionSourceLabel(normalizePrepareQuestionRecord(item));
    }).filter(Boolean);
    if(!labels.length)return false;
    const unique=[...new Set(labels)];
    if(unique.length===1&&(unique[0]==='来自岗位信息'||unique[0]==='来自 JD'))return false;
    return true;
}
function arePrepareQuestionSetsEquivalent(currentQuestions,nextQuestions){
    const currentKeys=(Array.isArray(currentQuestions)?currentQuestions:[]).map(function(item){
        return normalizePrepareCompareKey(item?.question||'');
    }).filter(Boolean);
    const nextKeys=(Array.isArray(nextQuestions)?nextQuestions:[]).map(function(item){
        return normalizePrepareCompareKey(item?.question||'');
    }).filter(Boolean);
    if(!currentKeys.length||!nextKeys.length||currentKeys.length!==nextKeys.length)return false;
    return currentKeys.every(function(key,index){
        return key===nextKeys[index];
    });
}
function hasPrepareQuestionOverlap(currentQuestions,nextQuestions){
    const currentKeys=new Set((Array.isArray(currentQuestions)?currentQuestions:[]).map(function(item){
        return normalizePrepareCompareKey(item?.question||'');
    }).filter(Boolean));
    return (Array.isArray(nextQuestions)?nextQuestions:[]).some(function(item){
        return currentKeys.has(normalizePrepareCompareKey(item?.question||''));
    });
}
async function requestPrepareSessionAI(session){
    const payload=await buildPrepareAugmentedPayload(getPrepareSessionPayload(session),'session');
    if(getPrepareConfig().mode==='supabase_edge'){
        return requestPrepareEdgeAI(buildPrepareSessionMessagesClient(payload),'session');
    }
    if(getPrepareConfig().mode==='direct'){
        return requestPrepareDirectAI(buildPrepareSessionMessagesClient(payload),payload,'session');
    }
    return requestPrepareCustomAI(buildPrepareSessionMessagesClient(payload),'session',payload);
}
async function requestPrepareAnswerAI(session,question,framework){
    const safeFocus=sanitizePrepareFocus(session.outputs||{},session);
    const payload=await buildPrepareAugmentedPayload(Object.assign({},getPrepareSessionPayload(session),{
        question_id:question.id,
        question:question.question,
        question_type:question.question_type||'',
        source:question.source||'',
        recommended_frameworks:question.recommended_frameworks||[],
        default_framework:question.default_framework||'',
        framework_type:framework||'STAR',
        prep_focus:safeFocus.best_experiences||[],
        prep_keywords:session.outputs?.research?.keyword_translation||[]
    }),'answer');
    if(getPrepareConfig().mode==='supabase_edge'){
        return requestPrepareEdgeAI(buildPrepareAnswerMessagesClient(payload),'answer');
    }
    if(getPrepareConfig().mode==='direct'){
        return requestPrepareDirectAI(buildPrepareAnswerMessagesClient(payload),payload,'answer');
    }
    return requestPrepareCustomAI(buildPrepareAnswerMessagesClient(payload),'answer',payload);
}
async function requestPrepareQuestionGroupAI(session,group){
    const payload=Object.assign({},getPrepareSessionPayload(session),{
        target_group:normalizePrepareText(group?.group_name||'问题题型'),
        target_questions:Array.isArray(group?.questions)?group.questions.map(function(item){
            return{
                id:item?.id||'',
                question:normalizePrepareText(item?.question||''),
                question_type:normalizePrepareText(item?.question_type||''),
                source:normalizePrepareText(item?.source||''),
                importance:normalizePrepareText(item?.importance||'medium')
            };
        }):[],
        prep_focus:sanitizePrepareFocus(session.outputs||{},session),
        question_groups:session.outputs?.questions?.question_groups||[]
    });
    let output=await requestPrepareCustomAI(buildPrepareQuestionGroupMessagesClient(session,group),'question_group',payload);
    if(arePrepareQuestionSetsEquivalent(group?.questions,output?.questions)||hasPrepareQuestionOverlap(group?.questions,output?.questions)){
        const retryMessages=buildPrepareQuestionGroupMessagesClient(session,group).concat([
            {
                role:'user',
                content:'上一版生成结果和现有题目重复了。请彻底换掉这 3 道题，禁止沿用原题句式、核心问法、关键词顺序和场景描述；3 道题都必须是全新的。'
            }
        ]);
        output=await requestPrepareCustomAI(retryMessages,'question_group',payload);
    }
    return output;
}
async function requestPrepareMockFeedbackAI(session,question,answer,history){
    const payload=Object.assign({},getPrepareSessionPayload(session),{
        question:question,
        answer:normalizePrepareText(answer||''),
        answer_history:Array.isArray(history)?history:[]
    });
    return requestPrepareCustomAI(buildPrepareMockFeedbackMessagesClient(session,question,answer,history),'answer',payload);
}
function buildPrepareMockSummaryMessagesClient(session,history){
    const payload={
        company_name:normalizePrepareText(session.company_name||'目标公司'),
        role_name:normalizePrepareText(session.role_name||'目标岗位'),
        role_category:normalizePrepareText(session.role_category||''),
        jd_text:normalizePrepareText(session.jd_text||''),
        resume_name:normalizePrepareText(getPrepareLinkedResume(session)?.file_name||session.resume_name||''),
        resume_text:normalizePrepareText(session.resume_text||''),
        supplemental_experiences:getPrepareSupplementalExperiences(session),
        supplemental_experience_summary:getPrepareSupplementalExperienceSummary(session),
        answer_history:Array.isArray(history)?history.slice(-6).map(function(item){
            return{
                question:normalizePrepareText(item?.question||''),
                answer:normalizePrepareText(item?.answer||''),
                feedback:item?.feedback||null
            };
        }):[]
    };
    return[
        {
            role:'system',
            content:'你是资深面试教练。现在要对一整场模拟面试做总结点评，并输出可直接写入复盘知识库的结构化 JSON。输出必须是纯 JSON，不要 markdown，不要代码块，不要额外解释。要求：1）所有文案简体中文；2）必须结合 JD、简历、用户补充经历和整场回答历史；3）先总结这场模拟里的共性问题，再给最优先的改法；4）如果回答里空泛，要明确指出应该补挖什么经历、补做什么最小案例、补学什么技能，以及怎么包装；5）pain_points 里只保留最影响面试结果的 3 到 5 个点；6）reflection_summary 要能直接放进复盘。输出 schema：{"overall_feedback":"string","strengths":["string"],"gaps":["string"],"suggestions":["string"],"pain_points":["string"],"self_rating":1,"reflection_summary":"string","next_steps":["string"]}'
        },
        {
            role:'user',
            content:`请基于以下整场模拟面试记录输出总结点评 JSON：\n${JSON.stringify(payload,null,2)}`
        }
    ];
}
async function requestPrepareMockSummaryAI(session,history){
    const payload=Object.assign({},getPrepareSessionPayload(session),{
        answer_history:Array.isArray(history)?history:[]
    });
    return requestPrepareCustomAI(buildPrepareMockSummaryMessagesClient(session,history),'answer',payload);
}
function getPrepareSummaryText(session){
    const linkedResume=getPrepareLinkedResume(session);
    const fragments=[
        session.company_name,
        session.role_name,
        session.role_category,
        session.jd_text,
        session.resume_text,
        linkedResume?.file_name,
        linkedResume?.notes,
        (linkedResume?.tags||[]).join(' ')
    ];
    return fragments.filter(Boolean).join(' ').toLowerCase();
}
function getPrepareLens(session){
    const text=getPrepareSummaryText(session);
    const lensDefs=[
        {key:'product',label:'产品 / 增长',summary:'更看重业务判断、用户理解、拆解问题与推动落地。',keywords:['产品','product','增长','growth','用户','留存','转化','策略']},
        {key:'operations',label:'运营 / 项目推进',summary:'更看重执行节奏、跨团队协作、活动或流程推进。',keywords:['运营','operation','活动','内容','社群','流程','推进','项目']},
        {key:'data',label:'数据 / 分析',summary:'更看重指标理解、分析框架、业务洞察和表达结论。',keywords:['数据','analysis','analytics','sql','指标','建模','分析','dashboard']},
        {key:'strategy',label:'商业分析 / 策略',summary:'更看重结构化思考、case 拆解和商业判断。',keywords:['商业','strategy','咨询','分析师','市场','行业','规划','case']},
        {key:'pm',label:'项目 / 协调',summary:'更看重多方沟通、项目节奏和复杂事项收束能力。',keywords:['项目','program','跨部门','stakeholder','协同','交付','上线']}
    ];
    const scored=lensDefs.map(function(def){
        const score=def.keywords.reduce((total,keyword)=>total+(text.includes(keyword)?1:0),0);
        return{def,score};
    }).sort((a,b)=>b.score-a.score);
    return scored[0].score>0?scored[0].def:lensDefs[0];
}
function buildPrepareKeywordTranslation(session,lens){
    const jd=session.jd_text||'';
    const knownBriefs=getPrepareKnownTermBriefs(session);
    if(knownBriefs.length){
        return knownBriefs.slice(0,4).map(function(brief){
            return{
                jd_keyword:brief.term,
                meaning:brief.meaning,
                prep_direction:brief.prep_direction
            };
        });
    }
    const dictionary=[
        {key:'跨部门',meaning:'说明岗位需要在信息不完整的情况下推动多人协同。',direction:'准备一个你对齐目标、推进节奏、处理分歧的案例。'},
        {key:'数据',meaning:'说明面试官会关注你如何看指标、找问题、给判断。',direction:'准备一个从指标到结论再到动作的完整例子。'},
        {key:'增长',meaning:'说明岗位会关注转化、留存、用户价值或规模化。',direction:'准备一个你如何定义目标、拆增长杠杆、衡量结果的案例。'},
        {key:'策略',meaning:'说明岗位会考你如何做判断、取舍与优先级。',direction:'准备一个你如何比较选项并解释取舍的故事。'},
        {key:'owner',meaning:'说明岗位强调独立负责和结果交付。',direction:'准备一个你主导推进并拿到清晰结果的项目。'},
        {key:'communication',meaning:'说明岗位会看表达、协作和影响力。',direction:'准备一个你和不同角色对齐目标并拿到支持的经历。'},
        {key:'sql',meaning:'说明岗位需要较强的数据动手与验证能力。',direction:'准备一个你自己下钻数据、找到问题并推动动作的例子。'},
        {key:'用户',meaning:'说明岗位会看你是否真的理解用户需求与场景。',direction:'准备一个你如何理解用户并改变方案的案例。'}
    ];
    const hits=dictionary.filter(item=>jd.toLowerCase().includes(item.key.toLowerCase())).slice(0,4);
    if(hits.length)return hits.map(item=>({jd_keyword:item.key,meaning:item.meaning,prep_direction:item.direction}));
    return[
        {jd_keyword:lens.label,meaning:`这份岗位更偏向 ${lens.label} 视角，面试官会先确认你是否理解业务与角色价值。`,prep_direction:'准备一段 60 秒岗位理解，回答这个岗位为什么存在、解决什么问题。'},
        {jd_keyword:'结果表达',meaning:'JD 没有写明的部分，往往会通过追问结果来判断真实水平。',prep_direction:'把你最相关的一段经历补齐目标、动作、结果和复盘。'},
        {jd_keyword:'协作与判断',meaning:'大多数岗位最终都会回到推进和判断能力。',prep_direction:'准备一个你处理分歧、推进复杂事项的故事。'}
    ];
}
function getPrepareResumeSignals(session){
    const snapshot=getPrepareResumeSnapshot(session);
    const rawFragments=String(snapshot.raw_text||'').split(/[\n。；;]+/).map(function(item){
        return normalizePrepareText(item);
    }).filter(Boolean);
    const candidateTexts=[...new Set([...(snapshot.evidence_lines||[]),...rawFragments])]
        .filter(function(item){
            return item.length>=8&&!isPrepareResumeBoilerplate(item);
        })
        .slice(0,3);
    const entries=candidateTexts.map(function(text,index){
        return{
            title:summarizePrepareEvidenceTitle(text,index),
            text,
            type:inferPrepareEvidenceType(text)
        };
    });
    const hasConcreteEntries=entries.length>0;
    if(!entries.length){
        entries.push({
            title:'当前简历缺少直接证据',
            text:'当前简历缺少直接证据',
            type:'GAP'
        });
    }
    return{
        fileName:snapshot.resume_name||session.resume_name||'当前简历',
        entries,
        hasConcreteEntries,
        evidenceLines:snapshot.evidence_lines||[]
    };
}
function buildPrepareOutputsFallback(session){
    const lens=getPrepareLens(session);
    const translation=buildPrepareKeywordTranslation(session,lens);
    const resumeSignals=getPrepareResumeSignals(session);
    const jdText=normalizePrepareText(session?.jd_text||'');
    const jdAngles=getPrepareJdFocusAngles(jdText);
    const isProductRole=/产品|product|pm/i.test(normalizePrepareText(session?.role_name||''))||jdAngles.some(function(item){
        return['需求挖掘','PRD/方案撰写','AI Skill/产品落地','漏斗/指标验证'].includes(item);
    });
    const companyName=session.company_name||'目标公司';
    const roleName=session.role_name||'目标岗位';
    const category=session.role_category||lens.label;
    const experiences=resumeSignals.entries.map(function(entry){
        const isGap=entry?.type==='GAP'||entry?.text==='当前简历缺少直接证据';
        const bridgeLabel=isProductRole
            ?'需求挖掘、PRD 撰写、Skill/方案落地和漏斗验证'
            :lens.key==='data'
                ?'数据分析、结构化判断和业务拆解'
                :(lens.key==='operations'||lens.key==='pm'
                    ?'协作推进、节奏管理和复杂事项收束'
                    :lens.key==='strategy'
                        ?'研究分析、信息整合和商业判断'
                        :'用户理解、问题拆解和方案表达');
        const jdFocusLabel=getPrepareJdFocusLabel(jdAngles);
        const exampleText=buildPrepareExperienceExample(entry,roleName,jdAngles);
        const followupHints=buildPrepareExperienceFollowups(entry,roleName,jdAngles);
        const concreteExample=exampleText.replace(/^例如：/,'');
        return{
            resume_section:isGap?'当前简历缺少直接证据':entry.title,
            why_match:isGap?`当前简历里还没有能直接支撑 ${roleName} 的经历素材，但你可以先从现有背景里补出一条最接近 JD 的线索，再把它讲成“问题定义 → 动作 → 结果”的故事。`:(
                isProductRole
                    ?`这段最适合拿来对应 JD 里的 ${jdFocusLabel}。它不一定是完整的 AI 产品经历，但它已经覆盖了“用户问题 → 需求/方案 → 落地验证”的关键链路。你要做的是把动作、判断、结果拆开讲清楚。`
                    :`这段内容未必与 ${roleName} 直接同题，但它是你简历里目前最能翻译成 ${bridgeLabel} 的一条真实线索。你要把它讲成“我怎么判断、怎么推进、最后带来什么变化”，而不是只讲做过什么。`
            ),
            highlight_points:[
                `对应 JD：${jdFocusLabel || '先把岗位要求翻译成具体工作动作'}`,
                isGap?'先补一段你亲自做过的项目 / 协作 / 研究经历，别空讲能力':`原始线索：${entry.text}`,
                `展开方式：把这段拆成“问题是什么、你怎么判断、你做了什么、结果如何”，并且明确你本人负责的那一步。`,
                `可以这样讲：${concreteExample}`,
                isGap?'结果补强：至少补 1 个可验证结果，比如数字、反馈、采纳记录、效率提升或周期变化':`这段最能证明你的 ${bridgeLabel}，但要再补一句你是怎么把它落到岗位动作上的。`
            ],
            possible_followups:[
                ...(isGap?[
                    `这段经历里你最能证明自己扛事的动作是什么？有没有你独立推进、组织材料、做判断或推动交付的部分？`,
                    `最终结果有没有任何可验证的数字、反馈、采纳记录、老师/同事评价或后续影响？`,
                    `如果没有直接相关经历，面试前 3 到 7 天内你能补做什么最小案例，来证明你对 ${roleName} 的理解？`,
                    `如果岗位强调 ${jdFocusLabel || '需求 / 方案 / 验证'}，你能不能补一个一页 PRD、一个最小 demo、一个验证表或一个复盘页？`
                ]:followupHints),
                isProductRole
                    ?`包装时不要只说“我做过类似经历”，而要直接讲“我这段最接近 JD 里的 ${jdFocusLabel}，我已经补了哪些学习或实操；如果时间够，我还会补一页最小 PRD / 需求说明、一个 demo 或一个验证指标”。`
                    :`包装时不要说“虽然我没做过”。改成“我最接近 ${roleName} 的例子是这段，它证明了我的 ${bridgeLabel}，同时我已经补了哪些学习或实操”。`
            ],
            raw:entry.text
        };
    });
    const companyOverview={
        one_liner:`围绕 ${companyName} 的这次准备，建议先从 ${lens.label} 视角理解业务，再把你的经历映射到 ${roleName} 的结果目标上。`,
        business_lines:[
            `先确认 ${companyName} 的核心收入或核心产品来自哪里，再判断这个岗位更靠近哪条业务线。`,
            `如果 JD 更强调 ${category}，优先准备与业务增长、效率提升或协同推进相关的案例。`
        ],
        products_services:[
            '梳理 1 到 2 个你最可能在面试里被提到的产品或服务，并准备自己的观察。',
            '如果这是平台型业务，准备用户、供给、转化三者之间的关系理解。'
        ],
        business_model:`优先用“用户是谁、价值在哪里、结果如何衡量”来理解这家公司，不要只背品牌介绍。`,
        market_position:`面试时不需要百科式地复述行业排名，但要能说清楚它和同类公司相比更像哪一类竞争者。`,
        recent_focus:[
            `把 JD 里的关键词翻译成业务动作，例如 ${translation[0].jd_keyword} 对应的真实工作场景是什么。`,
            '如果岗位强调协作或 owner，准备一个你真正扛事并推动落地的故事。'
        ]
    };
    const roleAnalysis={
        role_type:lens.label,
        target_capabilities:[
            '业务理解',
            '结构化表达',
            '结果导向',
            lens.key==='data'?'数据分析':'协作推进',
            lens.key==='product'?'问题拆解':'角色适配'
        ],
        business_context:`这个岗位更像是站在 ${lens.label} 的位置，帮助业务做出判断并推动动作，而不是只完成单点执行。`,
        interviewer_focus:[
            `你是否理解 ${roleName} 真正服务的业务目标`,
            '你讲的经历是否和岗位要求有直接映射',
            '你能不能把行动、结果和个人贡献说清楚'
        ]
    };
    const prepPriorities=buildPrepareJdPriorityBlueprint(session);
    const riskWarnings=[
        {title:'不要只讲公司印象',description:'如果只停留在品牌层面，面试官很难判断你是否理解这份岗位。',avoidance_tip:'把公司认知翻译成“这个岗位为什么存在、要解决什么问题”。'},
        {title:'不要只讲过程',description:'很多候选人在项目经历里说了很多动作，却没有清楚交代结果。',avoidance_tip:'每段经历至少准备一组结果数字，或明确的变化描述。'},
        {title:'避免角色模糊',description:'如果讲不清你自己到底负责什么，面试官会质疑真实贡献。',avoidance_tip:'始终把“我负责什么、我做了什么、我改变了什么”拆开说。'},
        {title:'低匹配时不要只说“我愿意学”',description:`当简历和 ${roleName} 不完全匹配时，只表达兴趣远远不够，面试官会更在意你已经补了什么、做了什么。`,avoidance_tip:'准备一段“我从已有背景里迁移了什么 + 我额外补做了什么 + 现在能怎么上手”的回答。'}
    ];
    const baseQuestions=[
        {
            group_name:'公司与岗位理解',
            questions:[
                {id:'company-fit',question:`为什么是 ${companyName}，而不是同类公司的其他岗位？`,question_type:'company_fit',source:'company',importance:'high'},
                {id:'role-understanding',question:`你怎么理解 ${roleName} 这份岗位的核心价值？`,question_type:'role_understanding',source:'role',importance:'high'},
                {id:'capability-proof',question:`如果只用一段经历证明你适合 ${roleName}，你会选哪一段？为什么？`,question_type:'company_fit',source:'resume',importance:'high'}
            ]
        },
        {
            group_name:'简历深挖',
            questions:experiences.slice(0,3).map(function(exp,index){
                return{id:`resume-deep-${index}`,question:`请把“${exp.raw}”这段经历讲深一点：你具体负责什么、怎么判断方向、最后结果如何？`,question_type:'resume_deep_dive',source:'resume',importance:index===0?'high':'medium'};
            })
        },
        {
            group_name:'行为面 / 宝洁八大问',
            questions:[
                {id:'behavior-1',question:'请讲一个你最有成就感的经历，为什么你觉得它最能代表你？',question_type:'behavioral',source:'behavioral',importance:'high'},
                {id:'behavior-2',question:'请讲一个你和别人有分歧、但最后把事情推进下去的经历。',question_type:'behavioral',source:'behavioral',importance:'high'},
                {id:'behavior-3',question:'请讲一个你做错了、或者结果不如预期的经历，你后来怎么处理的？',question_type:'behavioral',source:'behavioral',importance:'high'},
                {id:'behavior-4',question:'请讲一个你在资源有限、时间很紧的情况下做取舍的经历。',question_type:'behavioral',source:'behavioral',importance:'medium'}
            ]
        },
        {
            group_name:'场景 / case / 业务题',
            questions:[
                {id:'scenario-1',question:`如果你入职后第一个月需要快速判断 ${roleName} 最该先抓的事情，你会怎么拆？`,question_type:'case',source:'jd',importance:'high'},
                {id:'scenario-2',question:lens.key==='data'?'如果某个核心指标突然下滑，你会如何验证原因并给出动作建议？':'如果业务目标没有达成，你会如何判断是策略问题、执行问题还是资源问题？',question_type:'case',source:'jd',importance:'high'},
                {id:'scenario-3',question:'如果你需要协调多个角色一起推进，但大家优先级不一致，你会怎么推动？',question_type:'behavioral',source:'role',importance:'medium'}
            ]
        },
        {
            group_name:'反问环节',
            questions:[
                {id:'reverse-1',question:'如果我入职，前 30 天最希望我先交付什么，团队最看重的第一个结果是什么？',question_type:'reverse_question',source:'reverse',importance:'medium'},
                {id:'reverse-2',question:'这个岗位最常见的失败点是什么，你们通常怎么判断候选人能不能提前避开？',question_type:'reverse_question',source:'reverse',importance:'medium'},
                {id:'reverse-3',question:'如果你看我的背景，最希望我再补强哪一块能力，才能更快上手？',question_type:'reverse_question',source:'reverse',importance:'medium'}
            ]
        }
    ];
    baseQuestions.forEach(function(group){
        group.questions=(group.questions||[]).map(normalizePrepareQuestionRecord);
    });
    return{
        research:{company_overview:companyOverview,role_analysis:roleAnalysis,keyword_translation:translation},
        focus:{prep_priorities:prepPriorities,best_experiences:experiences,risk_warnings:riskWarnings},
        questions:{question_groups:baseQuestions},
        meta:{lens:lens.label,summary:`围绕 ${companyName} · ${roleName} 生成了一套 ${lens.label} 视角的准备框架。`}
    };
}
function getPrepareAllQuestions(session){
    return getPrepareQuestionGroups(session).flatMap(group=>group.questions||[]);
}
function getPrepareSelectedQuestion(session,options){
    const opts=Object.assign({fallback:true},options||{});
    const questions=getPrepareAllQuestions(session);
    if(!questions.length){
        prepareState.selectedQuestionId=null;
        return null;
    }
    const matched=questions.find(question=>question.id===prepareState.selectedQuestionId);
    if(matched)return matched;
    if(!opts.fallback)return null;
    prepareState.selectedQuestionId=questions[0].id;
    return questions[0];
}
function buildPrepareAnswerFrameworkFallback(session,question,framework){
    const ctx=buildPrepareOutputsFallback(session);
    const rankedExperiences=getPrepareQuestionMatchedExperiences(ctx,question);
    const primaryExperience=rankedExperiences[0]||ctx.focus.best_experiences[0];
    const secondaryExperience=rankedExperiences[1]||null;
    const jdKeyword=ctx.research.keyword_translation[0];
    const matchedBrief=findPrepareKnownTermBrief(question?.question||'',getPrepareKnownTermBriefs(session));
    const primaryConcreteBullets=getPrepareConcreteExperienceBullets(primaryExperience);
    const secondaryConcreteBullets=getPrepareConcreteExperienceBullets(secondaryExperience);
    const matchedAngles=getPrepareExperienceSpecificJdMatch(primaryExperience,session);
    const resumeEvidence=rankedExperiences.slice(0,2).map(function(item){
        return item?.raw||item?.resume_section;
    }).filter(Boolean);
    const supplementalSummary=getPrepareSupplementalExperienceSummary(session);
    const gapNote=primaryExperience?.resume_section==='当前简历缺少直接证据'?'这题当前缺少能直接支撑的简历证据，建议先补挖一段更贴近岗位目标的经历，再把结果和个人贡献讲具体。':'';
    const commonTips=[
        `回答时记得把内容拉回 ${session.role_name||'目标岗位'} 的目标，而不是停在泛化经历描述。`,
        '尽量加入可验证的数字、结果变化或判断依据。',
        '如果面试官继续追问，优先补你的个人贡献与取舍。'
    ];
    if(supplementalSummary){
        commonTips.unshift('你已经补充了额外经历素材，回答时优先挑最能证明“动作 + 结果”的那一段来讲。');
    }
    if(matchedBrief){
        commonTips.unshift(`如果提到「${matchedBrief.term}」，先用一句话把它翻译成真实业务概念，再回到你对 Agent / 工作流 / 产品落地的理解。`);
    }
    const directDraft=(function(){
        const roleName=normalizePrepareText(session.role_name||'这个岗位');
        const companyName=normalizePrepareText(session.company_name||'这家公司');
        const experienceLabel=normalizePrepareText(primaryExperience?.resume_section||'最接近的一段经历');
        const evidenceLine=primaryConcreteBullets[0]||primaryExperience?.why_match||'一段最贴题的经历';
        const resultLine=primaryConcreteBullets[1]||secondaryConcreteBullets[0]||'可验证的结果';
        const matchedAngleText=matchedAngles.length?matchedAngles.join('、'):`${roleName} 最看重的能力`;
        if(isPrepareCompanyFitQuestion(question)){
            return `我想加入 ${companyName}，核心还是这份 ${roleName} 和我已经做过的事情是顺着的。这个岗位要的不只是对 AI 有兴趣，而是能把需求判断、方案落地和结果验证串起来。我最能证明这一点的是 ${experienceLabel}：我实际做过 ${evidenceLine}，后面也拿到了 ${resultLine}。所以吸引我的不是公司名字本身，而是这里能把我已经验证过的能力放到更完整、更有规模的产品场景里。`;
        }
        if(/质量标准|可复用|复用性|quality/.test(question?.question||'')){
            return `如果让我定义 Skill 的质量标准，我会直接看三件事。第一是结果准不准，像 ${experienceLabel} 里我会先看它能不能稳定完成 ${primaryConcreteBullets[0]||'核心任务'}，错误会集中在哪些步骤。第二是用起来顺不顺，我会看输入输出是不是标准化，边界条件是不是写清楚，换个相邻场景时要不要大改。第三是上线后的表现，我会盯调用成功率、人工兜底比例、用户反馈和关键业务指标。落地时我会先把通用规则拆出来，再用 10 到 20 个真实 case 回测，最后根据异常 case 持续补规则。`;
        }
        if(/openclaw|agent|skill|tool/.test((question?.question||'').toLowerCase())){
            return `我的理解是 Agent 负责把任务拆开、决定每一步怎么走，Skill 是可复用的能力模块，Tool 是底层执行工具。真正在产品里落地时，我会先把场景拆成固定步骤，再把高频动作沉淀成 Skill，例如 ${jdKeyword?.jd_keyword||'信息提取、规则判断、结果回写'}。这和我在 ${experienceLabel} 里做过的事情很接近，因为我当时实际负责过 ${evidenceLine}，后面又用 ${resultLine} 去验证这套设计有没有跑通。`;
        }
        return `我会用 ${experienceLabel} 来回答这题。它和题目最贴近的地方是，我做过 ${matchedAngleText} 相关的事，具体就是 ${evidenceLine}。当时我先判断清楚问题和优先级，再推进关键动作，最后拿到了 ${resultLine}。这段内容能证明我已经把相关能力做成过结果。`;
    })();
    const map={
        STAR:{
            structure:[
                {section:'Situation',guidance:'先用 2 到 3 句话交代背景：业务场景、目标和当时的限制。',suggested_points:[`主案例优先用「${primaryExperience?.raw||'你最相关的一段经历'}」。`,'交代当时为什么这个问题重要。']},
                {section:'Task',guidance:'明确你当时真正负责的任务，而不是团队共同目标。',suggested_points:['把你的角色说清楚','说明你需要解决的核心问题']},
                {section:'Action',guidance:'重点讲你的判断、动作和推进方式。',suggested_points:[`结合 JD 关键词「${jdKeyword?.jd_keyword||'结果表达'}」说明你为什么这么做。`,'讲一到两个关键动作，不要流水账。']},
                {section:'Result',guidance:'最后一定要回到结果和复盘。',suggested_points:['补充数字或明确变化','说明这段经历为什么适合当前岗位']},
            ],
            delivery_tips:commonTips,
            copyable_outline:directDraft
        },
        PREP:{
            structure:[
                {section:'Point',guidance:'先给结论，不要绕。',suggested_points:[`直接回答你为什么适合 ${session.role_name||'这个岗位'}`,'一句话亮明观点']},
                {section:'Reason',guidance:'解释你为什么得出这个结论。',suggested_points:['从岗位要求和你的经历匹配度讲','点出 2 个最关键的能力']},
                {section:'Example',guidance:'举最能证明结论的一段经历。',suggested_points:[`优先使用「${primaryExperience?.raw||'最相关经历'}」`,secondaryExperience?.raw?`如果主案例不够，再补一句「${secondaryExperience.raw}」去兜结果或场景。`:'例子里必须有动作和结果']},
                {section:'Point',guidance:'最后收回结论。',suggested_points:['把经历和岗位需要的能力再次连接起来']}
            ],
            delivery_tips:commonTips,
            copyable_outline:directDraft
        },
        PAR:{
            structure:[
                {section:'Problem',guidance:'先定义问题，说明你为什么要介入。',suggested_points:['问题是什么','为什么重要']},
                {section:'Action',guidance:'讲你如何推进、如何判断、如何协调。',suggested_points:['你的关键动作','你的取舍','你解决的卡点']},
                {section:'Result',guidance:'讲结果和影响。',suggested_points:['结果数字','后续影响','为什么说明你适合这个岗位']}
            ],
            delivery_tips:commonTips,
            copyable_outline:directDraft
        },
        SCQA:{
            structure:[
                {section:'Situation',guidance:'先说背景和业务环境。',suggested_points:['业务在什么阶段','为什么这个问题重要']},
                {section:'Complication',guidance:'讲清冲突或复杂性。',suggested_points:['为什么这件事难','有哪些限制']},
                {section:'Question',guidance:'把真正的问题亮出来。',suggested_points:['核心要判断什么','核心要解决什么']},
                {section:'Answer',guidance:'给你的拆解和答案。',suggested_points:[`结合 ${session.role_name||'岗位'} 视角给出清晰结构`,'用两到三层逻辑回答']}
            ],
            delivery_tips:commonTips,
            copyable_outline:directDraft
        },
        FREE:{
            structure:[
                {section:'开场',guidance:'先回答问题，不要铺垫太久。',suggested_points:['先给结论','明确你最想让面试官记住什么']},
                {section:'主体',guidance:'用一段最相关经历或判断展开。',suggested_points:['说动作','说结果','说个人贡献',...(supplementalSummary?['优先从你刚补充的经历素材里挑最贴题的一段。']:[])]},
                {section:'收束',guidance:'最后把内容拉回岗位匹配。',suggested_points:[`说明这段内容为什么能证明你适合 ${session.role_name||'这个岗位'}`]}
            ],
            delivery_tips:commonTips,
            copyable_outline:directDraft
        }
    };
    const current=map[framework]||map.STAR;
    if(matchedBrief&&current.structure?.[0]){
        current.structure[0].suggested_points.unshift(`如果问题里出现「${matchedBrief.term}」，可以先说明：它在公开语境里通常指 ${matchedBrief.meaning}`);
    }
    return{
        question_id:question.id,
        framework_type:framework,
        structure:current.structure,
        delivery_tips:current.delivery_tips,
        copyable_outline:current.copyable_outline,
        resume_evidence_used:resumeEvidence,
        gap_note:gapNote
    };
}
function shouldReplacePrepareOutlineWithDraft(outline){
    const text=normalizePrepareText(outline);
    if(!text)return true;
    return /^(Situation|Task|Action|Result|Point|Reason|Example|Problem|Complication|Question|Answer)[:：]/.test(text)
        || /^先回答问题/.test(text)
        || text.length<50;
}
function polishPrepareCopyableOutline(outline,fallbackOutline){
    let text=normalizePrepareText(outline||fallbackOutline||'');
    if(!text)return normalizePrepareText(fallbackOutline||'');
    text=text
        .replace(/如果让我直接回答这题[，,。]?\s*/g,'')
        .replace(/所以这题我不会泛泛讲经历[，,]?而是/g,'这道题我会')
        .replace(/我不会泛泛讲经历[，,]?而是/g,'我会')
        .replace(/不是([^，。；;]{1,24})[，,]?而是/g,'重点是')
        .replace(/不只是([^，。；;]{1,24})[，,]?而是/g,'核心是')
        .replace(/这说明我/g,'这能证明我')
        .replace(/首先[，,]\s*/g,'')
        .replace(/其次[，,]\s*/g,'接着，')
        .replace(/最后[，,]\s*/g,'收尾时，')
        .replace(/\s+/g,' ')
        .trim();
    return text||normalizePrepareText(fallbackOutline||'');
}
function normalizePrepareAnswerOutput(answer,session,question,framework){
    const fallback=buildPrepareAnswerFrameworkFallback(session,question,framework);
    const directDraft=fallback.copyable_outline;
    const structure=(Array.isArray(answer?.structure)&&answer.structure.length?answer.structure:fallback.structure).map(function(part,index){
        const fallbackPart=fallback.structure[index]||fallback.structure[0]||{section:`部分 ${index+1}`,guidance:'',suggested_points:[]};
        return{
            section:normalizePrepareText(part?.section||fallbackPart.section||`部分 ${index+1}`),
            guidance:normalizePrepareText(part?.guidance||fallbackPart.guidance||''),
            suggested_points:sanitizePrepareTextList(part?.suggested_points,fallbackPart.suggested_points,4)
        };
    });
    return{
        question_id:question.id,
        framework_type:framework,
        structure:structure,
        delivery_tips:sanitizePrepareTextList(answer?.delivery_tips,fallback.delivery_tips,4),
        copyable_outline:polishPrepareCopyableOutline(shouldReplacePrepareOutlineWithDraft(answer?.copyable_outline)?directDraft:answer?.copyable_outline,directDraft),
        resume_evidence_used:sanitizePrepareTextList(answer?.resume_evidence_used,fallback.resume_evidence_used,4),
        gap_note:normalizePrepareText(answer?.gap_note||fallback.gap_note),
        source:answer?.source||'ai'
    };
}
async function generatePrepareOutputs(session){
    const aiOutput=sanitizePrepareOutputs(await requestPrepareSessionAI(session),session);
    return Object.assign({},aiOutput,{
        meta:Object.assign({},aiOutput.meta||{},{
            provider:aiOutput?.meta?.provider||getPrepareConfig().provider,
            model:aiOutput?.meta?.model||getPrepareConfig().model,
            source:'ai'
        }),
        answer_cache:aiOutput.answer_cache||{}
    });
}
async function generatePrepareAnswerFramework(session,question,framework){
    const cached=session?.outputs?.answer_cache?.[question.id]?.[framework];
    if(cached)return cached;
    const aiAnswer=await requestPrepareAnswerAI(session,question,framework);
    return normalizePrepareAnswerOutput(Object.assign({},aiAnswer,{source:'ai'}),session,question,framework);
}
async function hydratePrepareSessionResumeContext(session){
    if(!session)return session;
    const linkedResume=getPrepareLinkedResume(session);
    if(!linkedResume)return session;
    const supplementalSummary=['manual_summary','linked_resume_notes','linked_resume_notes_plus_summary'].includes(session.resume_source)?session.resume_text:'';
    const resolved=await resolvePrepareResumeContext({
        linkedResume,
        resumeSummary:supplementalSummary,
        resumeNameFallback:session.resume_name
    });
    const patch={
        resume_name:resolved.resume_name||session.resume_name||linkedResume.file_name||'',
        resume_text:resolved.resume_text,
        resume_file_meta:resolved.resume_file_meta||session.resume_file_meta||null,
        resume_source:resolved.resume_source,
        resume_verified:resolved.resume_verified
    };
    const hasChanged=['resume_name','resume_text','resume_source','resume_verified'].some(function(key){
        return JSON.stringify(session[key]??null)!==JSON.stringify(patch[key]??null);
    })||JSON.stringify(session.resume_file_meta||null)!==JSON.stringify(patch.resume_file_meta||null);
    if(!hasChanged)return session;
    await store.updatePrepareSession(session.id,patch);
    return store.getPrepareSession(session.id)||Object.assign({},session,patch);
}
async function createPrepareSessionFromApp(appId){
    const app=store.getApp(appId);
    if(!app)return null;
    const existing=store.prepareSessions.find(session=>session.source_type==='application'&&session.application_id===appId);
    if(existing){
        resetPrepareWorkspaceState(existing.id);
        prepareState.screen='workspace';
        return existing;
    }
    const draft=getPrepareApplicationDraft(app);
    if(!draft||draft.requiresJd){
        toast(`请先补完整 JD 文本，至少 ${PREP_MIN_JD_LENGTH} 个字后再生成。`,'error');
        return null;
    }
    if(draft.requiresResume){
        toast('这条投递还没有简历信息。请先选择已有简历、上传临时简历，或填写简历摘要。','error');
        return null;
    }
    let resumeContext;
    try{
        resumeContext=await resolvePrepareResumeContext({
            linkedResume:draft.linkedResume,
            resumeFile:prepareState.appSupplementFile,
            resumeSummary:draft.resumeText,
            resumeNameFallback:draft.linkedResume?.file_name||''
        });
    }catch(error){
        toast(error instanceof Error?error.message:String(error),'error');
        return null;
    }
    if(!normalizePrepareText(resumeContext.resume_text)){
        toast('没有读到可用的简历正文。请上传可读取的 PDF / DOCX / TXT / Markdown，或至少补一段简历摘要后再生成。','error');
        return null;
    }
    const sessionId=crypto.randomUUID();
    const access=await ensurePrepareExperienceAccess(sessionId);
    if(!access||access.allowed===false)return null;
    const payload={
        id:sessionId,
        source_type:'application',
        application_id:app.id,
        company_name:app.company_name||'',
        role_name:app.position_title||'',
        role_category:app.position_category||'',
        jd_text:draft.jdText,
        jd_url:draft.jdUrl,
        resume_id:draft.linkedResume?.id||null,
        resume_name:resumeContext.resume_name,
        resume_text:resumeContext.resume_text,
        resume_file_meta:resumeContext.resume_file_meta,
        resume_source:resumeContext.resume_source,
        resume_verified:resumeContext.resume_verified,
        status:'pending',
        error_message:''
    };
    const session=await store.addPrepareSession(payload);
    if(!session)return null;
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_prepare_session_created',{
        source_type:'application',
        company_name:app.company_name||'',
        role_name:app.position_title||''
    });
    prepareState.screen='workspace';
    resetPrepareWorkspaceState(session.id);
    prepareState.sessionLoading=true;
    prepareState.sessionError='';
    startPrepareLoading('session');
    renderPrepare();
    try{
        const outputs=await generatePrepareOutputs(session);
        await store.updatePrepareSession(session.id,{outputs,generated_at:new Date().toISOString(),status:'generated',error_message:''});
        const next=store.getPrepareSession(session.id);
        prepareState.appSupplementFile=null;
        prepareState.appSupplementParse={status:'idle',text:'',message:''};
        const fileInput=$('#prepare-app-file');
        if(fileInput)fileInput.value='';
        prepareState.sessionLoading=false;
        stopPrepareLoading();
        return next;
    }catch(error){
        const message=error instanceof Error?error.message:String(error);
        prepareState.sessionLoading=false;
        stopPrepareLoading();
        prepareState.sessionError=message;
        await store.updatePrepareSession(session.id,{status:'error',error_message:message,generated_at:new Date().toISOString()});
        renderPrepare();
        toast(message,'error');
        return store.getPrepareSession(session.id);
    }
}
async function createManualPrepareSession(){
    const companyName=normalizePrepareText(prepareState.manualDraft.companyName);
    const roleName=normalizePrepareText(prepareState.manualDraft.roleName);
    const jdText=normalizePrepareText(prepareState.manualDraft.jdText);
    const resumeId=normalizePrepareText(prepareState.manualDraft.resumeId);
    const resumeText=normalizePrepareText(prepareState.manualDraft.resumeText);
    if(!companyName||!roleName){
        toast('请至少填写公司和岗位。','error');
        return null;
    }
    if(!hasPrepareUsableJd(jdText)){
        toast(`JD 文本太短了。请至少粘贴 ${PREP_MIN_JD_LENGTH} 个字，避免生成失真内容。`,'error');
        return null;
    }
    const file=prepareState.manualResumeFile;
    const linkedResume=resumeId?store.getResume(resumeId):null;
    let resumeContext;
    try{
        resumeContext=await resolvePrepareResumeContext({
            linkedResume,
            resumeFile:file,
            resumeSummary:resumeText,
            resumeNameFallback:linkedResume?.file_name||file?.name||''
        });
    }catch(error){
        toast(error instanceof Error?error.message:String(error),'error');
        return null;
    }
    if(!normalizePrepareText(resumeContext.resume_text)){
        toast('没有读到可用的简历正文。请上传可读取的 PDF / DOCX / TXT / Markdown，或至少补一段简历摘要后再生成。','error');
        return null;
    }
    const sessionId=crypto.randomUUID();
    const access=await ensurePrepareExperienceAccess(sessionId);
    if(!access||access.allowed===false)return null;
    const payload={
        id:sessionId,
        source_type:'manual',
        application_id:null,
        company_name:companyName,
        role_name:roleName,
        role_category:'',
        jd_text:jdText,
        jd_url:normalizePrepareText(prepareState.manualDraft.jdUrl),
        resume_id:linkedResume?.id||null,
        resume_name:resumeContext.resume_name,
        resume_text:resumeContext.resume_text,
        resume_file_meta:resumeContext.resume_file_meta,
        resume_source:resumeContext.resume_source,
        resume_verified:resumeContext.resume_verified,
        status:'pending',
        error_message:''
    };
    const session=await store.addPrepareSession(payload);
    if(!session)return null;
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_prepare_session_created',{
        source_type:'manual',
        company_name:companyName,
        role_name:roleName
    });
    prepareState.screen='workspace';
    resetPrepareWorkspaceState(session.id);
    prepareState.sessionLoading=true;
    prepareState.sessionError='';
    prepareState.screen='workspace';
    startPrepareLoading('session');
    renderPrepare();
    try{
        const outputs=await generatePrepareOutputs(session);
        await store.updatePrepareSession(session.id,{outputs,generated_at:new Date().toISOString(),status:'generated',error_message:''});
        const next=store.getPrepareSession(session.id);
        prepareState.manualResumeFile=null;
        prepareState.manualResumeParse={status:'idle',text:'',message:''};
        prepareState.manualDraft={companyName:'',roleName:'',jdUrl:'',jdText:'',resumeId:'',resumeText:''};
        prepareState.sessionLoading=false;
        stopPrepareLoading();
        const fileInput=$('#prepare-manual-file');
        if(fileInput)fileInput.value='';
        return next;
    }catch(error){
        const message=error instanceof Error?error.message:String(error);
        prepareState.manualResumeFile=null;
        prepareState.manualResumeParse={status:'idle',text:'',message:''};
        prepareState.sessionLoading=false;
        stopPrepareLoading();
        prepareState.sessionError=message;
        await store.updatePrepareSession(session.id,{status:'error',error_message:message,generated_at:new Date().toISOString()});
        renderPrepare();
        toast(message,'error');
        return store.getPrepareSession(session.id);
    }finally{
        const fileInput=$('#prepare-manual-file');
        if(fileInput)fileInput.value='';
    }
}
async function regeneratePrepareSession(sessionId){
    let session=store.getPrepareSession(sessionId);
    if(!session)return;
    if(!hasPrepareUsableJd(session.jd_text)){
        toast(`这套准备会话缺少完整 JD。请补齐至少 ${PREP_MIN_JD_LENGTH} 个字后再重新生成。`,'error');
        return;
    }
    try{
        session=await hydratePrepareSessionResumeContext(session);
    }catch(error){
        toast(error instanceof Error?error.message:String(error),'error');
        return;
    }
    if(!normalizePrepareText(session.resume_text||'')){
        toast('这套准备会话还没有可用的简历正文。请补一份能被读取的简历，再重新生成。','error');
        return;
    }
    prepareState.sessionLoading=true;
    prepareState.sessionError='';
    startPrepareLoading('session');
    renderPrepare();
    try{
        const outputs=await generatePrepareOutputs(session);
        await store.updatePrepareSession(session.id,{outputs,generated_at:new Date().toISOString(),status:'generated',error_message:''});
        resetPrepareWorkspaceState(session.id);
        prepareState.sessionLoading=false;
        stopPrepareLoading();
        renderPrepare();
        toast('已重新生成准备工作台','success');
    }catch(error){
        const message=error instanceof Error?error.message:String(error);
        prepareState.sessionLoading=false;
        stopPrepareLoading();
        prepareState.sessionError=message;
        await store.updatePrepareSession(session.id,{status:'error',error_message:message,generated_at:new Date().toISOString()});
        renderPrepare();
        toast(message,'error');
    }
}
function renderPrepareResearch(session){
    const research=session.outputs?.research;
    if(!research)return'<div class="prepare-empty">先生成一套准备工作台，再查看背调。</div>';
    const companyOverview=research.company_overview||{};
    const roleAnalysis=research.role_analysis||{};
    const keywordTranslation=Array.isArray(research.keyword_translation)?research.keyword_translation.filter(Boolean):[];
    const businessLines=Array.isArray(companyOverview.business_lines)?companyOverview.business_lines:[];
    const productsServices=Array.isArray(companyOverview.products_services)?companyOverview.products_services:[];
    const recentFocus=Array.isArray(companyOverview.recent_focus)?companyOverview.recent_focus:[];
    const targetCapabilities=Array.isArray(roleAnalysis.target_capabilities)?roleAnalysis.target_capabilities.filter(Boolean):[];
    const isDetailed=prepareState.companyOverviewMode==='detailed';
    return `
        <div class="prepare-grid prepare-grid-two">
            <article class="prepare-card-surface prepare-section-shell${isDetailed?' prepare-card-span-all':''}">
                <div class="prepare-shell-head">
                    <div>
                        <div class="prepare-section-kicker">公司与业务速览</div>
                    </div>
                    <div class="prepare-view-switch" role="tablist" aria-label="公司与业务速览视图切换">
                        <button type="button" class="prepare-view-btn${!isDetailed?' is-active':''}" data-prepare-company-mode="simple">简单版</button>
                        <button type="button" class="prepare-view-btn${isDetailed?' is-active':''}" data-prepare-company-mode="detailed">详尽版</button>
                    </div>
                </div>
                <h3>${escapeHTML(session.company_name||'目标公司')}</h3>
                <p>${escapeHTML(companyOverview.one_liner||'')}</p>
                ${isDetailed?`
                    <div class="prepare-detail-stack">
                        <section class="prepare-detail-item">
                            <strong>核心业务线</strong>
                            <ul class="prepare-bullet-list">${businessLines.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>
                        </section>
                        ${productsServices.length?`
                            <section class="prepare-detail-item">
                                <strong>产品与服务</strong>
                                <ul class="prepare-bullet-list">${productsServices.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>
                            </section>
                        `:''}
                        ${companyOverview.business_model?`
                            <section class="prepare-detail-item">
                                <strong>商业模式</strong>
                                <p>${escapeHTML(companyOverview.business_model)}</p>
                            </section>
                        `:''}
                        ${companyOverview.market_position?`
                            <section class="prepare-detail-item">
                                <strong>市场位置</strong>
                                <p>${escapeHTML(companyOverview.market_position)}</p>
                            </section>
                        `:''}
                        ${recentFocus.length?`
                            <section class="prepare-detail-item">
                                <strong>近期重点</strong>
                                <ul class="prepare-bullet-list">${recentFocus.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>
                            </section>
                        `:''}
                    </div>
                `:`
                    <ul class="prepare-bullet-list">
                        ${businessLines.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}
                    </ul>
                `}
            </article>
            <article class="prepare-card-surface prepare-section-shell prepare-role-analysis-card${isDetailed?' prepare-card-span-all':''}">
                ${isDetailed?`
                    <div class="prepare-role-analysis-copy">
                        <div class="prepare-section-kicker">岗位视角拆解</div>
                        <h3>${escapeHTML(roleAnalysis.role_type||session.role_name||'岗位拆解')}</h3>
                        <p>${escapeHTML(roleAnalysis.business_context||'这套会话生成得比较早，岗位拆解信息不完整。建议重新生成一次拿到最新版分析。')}</p>
                    </div>
                    <div class="prepare-role-analysis-skills">
                        <strong>面试官重点验证</strong>
                        <div class="prepare-token-row">${(targetCapabilities.length?targetCapabilities:['岗位理解','表达清晰','结果导向']).map(item=>`<span class="prepare-token">${escapeHTML(item)}</span>`).join('')}</div>
                    </div>
                `:`
                    <div class="prepare-section-kicker">岗位视角拆解</div>
                    <h3>${escapeHTML(roleAnalysis.role_type||session.role_name||'岗位拆解')}</h3>
                    <p>${escapeHTML(roleAnalysis.business_context||'这套会话生成得比较早，岗位拆解信息不完整。建议重新生成一次拿到最新版分析。')}</p>
                    <div class="prepare-token-row">${(targetCapabilities.length?targetCapabilities:['岗位理解','表达清晰','结果导向']).map(item=>`<span class="prepare-token">${escapeHTML(item)}</span>`).join('')}</div>
                `}
            </article>
        </div>
        <article class="prepare-card-surface prepare-section-shell">
            <div class="prepare-section-kicker">JD 关键词翻译</div>
            <div class="prepare-translation-list">
                ${(keywordTranslation.length?keywordTranslation:[{jd_keyword:'建议重新生成',meaning:'这套旧会话缺少完整的 JD 关键词拆解。',prep_direction:'点一次重新生成，拿到最新版背调和关键词翻译。'}]).map(item=>`
                    <div class="prepare-translation-item">
                        <div class="prepare-translation-key">${escapeHTML(item.jd_keyword)}</div>
                        <div class="prepare-translation-body">
                            <p>${escapeHTML(item.meaning)}</p>
                            <span>${escapeHTML(item.prep_direction)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </article>
    `;
}
function getPrepareExperienceGroupMeta(section){
    const text=normalizePrepareText(section).toLowerCase();
    if(/实习|intern|internship|任职|工作|公司|分析师|产品经理|运营|业务/.test(text)){
        return {
            key:'internship',
            label:'实习 / 工作经历',
            description:'优先把每段实习里最贴近岗位职责的那部分单独拆开讲。'
        };
    }
    if(/项目|project|side project|课程|作品|毕设|毕业设计|创业/.test(text)){
        return {
            key:'project',
            label:'项目经历',
            description:'把项目里你真正做判断、推动和拿结果的部分单独拎出来。'
        };
    }
    if(/社团|学生会|校园|志愿|组织|活动/.test(text)){
        return {
            key:'campus',
            label:'校园 / 组织经历',
            description:'如果没有强相关实习，就把可迁移的组织推进能力讲扎实。'
        };
    }
    return {
        key:'other',
        label:'其他可迁移经历',
        description:'这些经历不一定直接对口，但可以翻译成岗位需要的判断力和执行力。'
    };
}

function groupPrepareFocusExperiences(experiences){
    const order=['internship','project','campus'];
    const groups=new Map();
    const otherItems=[];
    (experiences||[]).forEach(function(item){
        const meta=getPrepareExperienceGroupMeta(item.resume_section||'');
        if(meta.key==='other'){
            otherItems.push(item);
            return;
        }
        if(!groups.has(meta.key)){
            groups.set(meta.key,Object.assign({},meta,{items:[]}));
        }
        groups.get(meta.key).items.push(item);
    });
    const ordered=order.map(function(key){
        return groups.get(key)||null;
    }).filter(Boolean);
    if(!ordered.length&&otherItems.length){
        ordered.push({
            key:'other',
            label:'其他可迁移经历',
            description:'当前只能先从这些线索里挑最接近岗位要求的经历来讲。',
            items:otherItems
        });
    }
    return ordered;
}

function breakdownPrepareExperienceHighlights(points){
    const buckets={jd:[],expand:[],gap:[],example:[],extra:[]};
    (points||[]).forEach(function(point){
        const text=normalizePrepareText(point);
        if(!text)return;
        if(/对应\s*JD|对应岗位|对应要求|直接对应|匹配的是|JD/.test(text)){
            buckets.jd.push(text);
            return;
        }
        if(/怎么展开|怎么讲|展开|先讲|围绕|结构|讲法|展开成/.test(text)){
            buckets.expand.push(text);
            return;
        }
        if(/还缺|缺口|补清|补齐|补上|证据|细节|数字|量化|没讲清/.test(text)){
            buckets.gap.push(text);
            return;
        }
        if(/示例|可以这样讲|可以直接讲|直接开讲|开场可以说|你可以说/.test(text)){
            buckets.example.push(text);
            return;
        }
        buckets.extra.push(text);
    });
    return buckets;
}
function getPrepareConcreteExperienceBullets(item){
    const buckets=breakdownPrepareExperienceHighlights(item?.highlight_points||[]);
    const raw=[].concat(buckets.extra||[]).map(function(point){
        return normalizePrepareText(String(point||'').replace(/^原始线索[:：]\s*/,''));
    }).filter(function(point){
        return point&&!/[？?]$/.test(point)&&!/^\s*(先补|展开方式|结果补强)/.test(point);
    });
    return [...new Set(raw)].slice(0,4);
}
function getPrepareExperienceFollowupPrompts(item){
    return sanitizePrepareTextList(item?.possible_followups,[],6).map(function(point){
        return normalizePrepareText(point.replace(/[？?]+$/,''));
    }).filter(Boolean);
}
function getPrepareExperienceSpecificJdMatch(item,session){
    const concreteBullets=getPrepareConcreteExperienceBullets(item);
    const source=[item?.why_match].concat(item?.highlight_points||[]).concat(concreteBullets).join(' ');
    const text=normalizePrepareText(source).toLowerCase();
    const matches=[];
    const push=function(label,pattern){
        if(matches.includes(label))return;
        if(pattern.test(text))matches.push(label);
    };
    push('需求挖掘',/访谈|痛点|需求|洞察|问题定义|问卷|调研/);
    push('PRD/方案撰写',/prd|方案|原型|文档|需求说明|改进文档/);
    push('AI Skill/产品落地',/skill|agent|workflow|智能体|开发3项skill|调用超|产品化/);
    push('漏斗/指标验证',/漏斗|留存|转化|指标|埋点|次日留存|提升\d+|回升/);
    push('跨团队推进',/协同|推进|跨团队|产研|研发|设计|业务|对接/);
    push('财务/风控场景理解',/财务|风控|报销|对账|入金|合规|异常交易/);
    if(!matches.length){
        return (getPrepareJdFocusAngles(session?.jd_text||'').slice(0,3));
    }
    return matches.slice(0,4);
}
function getPrepareSemanticTags(text){
    const normalized=normalizePrepareText(text).toLowerCase();
    const tags=[];
    const push=function(label,pattern){
        if(tags.includes(label))return;
        if(pattern.test(normalized))tags.push(label);
    };
    push('user_research',/访谈|调研|问卷|痛点|洞察|用户声音|用户反馈/);
    push('problem_definition',/需求|问题定义|核心价值|场景定义|拆解/);
    push('prd',/prd|方案|原型|需求文档|改进文档|方案撰写/);
    push('skill_agent',/skill|agent|workflow|工作流|智能体|tool/);
    push('delivery',/上线|落地|交付|推动|推进|产研|协同|开发/);
    push('metrics',/漏斗|留存|转化|指标|埋点|提升\d+|回升|调用超|3000/);
    push('finance_risk',/财务|风控|报销|对账|入金|合规|异常交易|稳定币/);
    push('operations',/运营|体验优化|客诉|闭环|规则|阈值/);
    return tags;
}
function getPrepareExperienceAnglesFromText(text,session){
    const normalized=normalizePrepareText(text).toLowerCase();
    const angles=[];
    const push=function(label,pattern){
        if(angles.includes(label))return;
        if(pattern.test(normalized))angles.push(label);
    };
    push('需求挖掘',/访谈|痛点|需求|洞察|问题定义|问卷|调研/);
    push('PRD/方案撰写',/prd|方案|原型|文档|需求说明|改进文档/);
    push('AI Skill/产品落地',/skill|agent|workflow|智能体|产品化|调用超/);
    push('漏斗/指标验证',/漏斗|留存|转化|指标|埋点|提升\d+|回升/);
    push('跨团队推进',/协同|推进|跨团队|产研|研发|设计|业务|对接/);
    push('财务/风控理解',/财务|风控|报销|对账|入金|合规|异常交易/);
    return angles.length?angles:getPrepareExperienceSpecificJdMatch({ why_match:text },session).slice(0,2);
}
function isPrepareExperienceTemplateLine(text){
    const normalized=normalizePrepareText(text);
    if(!normalized)return true;
    return /这段经历最值得拿来对 JD 的|这段经历最适合对应 JD 里的|建议按这个顺序讲|展开时别只报岗位名|可以直接讲|先说这段经历对应 JD|按[“"'「]?[场情]景\s*\/\s*判断\s*\/\s*动作\s*\/\s*结果|别只报任务名|先亮一句结论|高概率会被追问/.test(normalized);
}
function getPrepareJdRequirementCatalog(session){
    const catalog=[];
    const seen=new Set();
    const add=function(label,source){
        const normalized=normalizePrepareText(label);
        if(!normalized)return;
        const key=normalizePrepareCompareKey(normalized);
        if(!key||seen.has(key))return;
        seen.add(key);
        catalog.push({
            label:normalized,
            source,
            tags:getPrepareSemanticTags(normalized),
            angles:getPrepareExperienceAnglesFromText(normalized,session)
        });
    };
    const research=session?.outputs?.research||{};
    (research?.role_analysis?.target_capabilities||[]).forEach(function(item){
        add(item,'capability');
    });
    (research?.keyword_translation||[]).forEach(function(item){
        add(item?.jd_keyword,'keyword');
    });
    normalizePrepareText(session?.jd_text||'')
        .split(/[\n。；;]/)
        .map(function(part){ return normalizePrepareText(part); })
        .filter(function(part){
            return part&&part.length>=6&&part.length<=36&&/负责|要求|需要|熟悉|能力|经验|优化|设计|分析|协同|风控|财务|技能|skill|agent/i.test(part);
        })
        .slice(0,8)
        .forEach(function(item){
            add(item,'jd_text');
        });
    return catalog.slice(0,10);
}
function analyzePrepareExperienceAgainstJd(item,session,concreteBullets){
    const safeBullets=Array.isArray(concreteBullets)?concreteBullets:[];
    const requirements=getPrepareJdRequirementCatalog(session);
    const matches=[];
    safeBullets.slice(0,4).forEach(function(point){
        const bulletTags=getPrepareSemanticTags(point);
        const bulletAngles=getPrepareExperienceAnglesFromText(point,session);
        requirements.forEach(function(req){
            const sharedTags=req.tags.filter(function(tag){ return bulletTags.includes(tag); });
            const sharedAngles=req.angles.filter(function(angle){ return bulletAngles.includes(angle); });
            const exactTermBonus=sharedTags.length?2:0;
            const score=sharedTags.length*4+sharedAngles.length*2+exactTermBonus;
            if(score<=0)return;
            matches.push({
                requirement:req.label,
                bullet:point,
                score,
                direct:sharedTags.length>0,
                sharedTags,
                sharedAngles
            });
        });
    });
    const bestByRequirement=new Map();
    matches.forEach(function(match){
        const existing=bestByRequirement.get(match.requirement);
        if(!existing||match.score>existing.score){
            bestByRequirement.set(match.requirement,match);
        }
    });
    const ranked=[...bestByRequirement.values()].sort(function(a,b){
        return b.score-a.score;
    });
    return ranked.slice(0,3);
}
function buildPrepareExperienceJdBullets(item,session,concreteBullets){
    const mappings=analyzePrepareExperienceAgainstJd(item,session,concreteBullets);
    if(mappings.length){
        return mappings.map(function(match){
            if(match.direct){
                return `JD 提到「${match.requirement}」时，最该拿出来的是「${match.bullet}」。这条是直接命中，因为它已经能听出你做过 ${match.sharedAngles.join('、')||'相关判断和落地'}。`;
            }
            return `JD 里有「${match.requirement}」这一项时，这段更适合作为可迁移证据来讲：先用「${match.bullet}」证明你做过相近的判断和推进，再补一句它怎么迁到当前岗位场景。`;
        });
    }
    return concreteBullets.slice(0,3).map(function(point,index){
        const angles=getPrepareExperienceAnglesFromText(point,session).slice(0,2);
        if(index===0){
            return `这条最适合当第一张牌：「${point}」。先把它讲透，面试官才能迅速听到你在 ${angles.join('、')||'岗位关键能力'} 上的底子。`;
        }
        if(index===1){
            return `第二张牌可以放「${point}」，它更适合证明你不是只会判断，也真的把事情往下推进过。`;
        }
        return `最后用「${point}」收结果，把前面讲的能力落到可验证的变化上。`;
    });
}
function buildPrepareExperienceSummary(item,session,concreteBullets){
    const existing=normalizePrepareText(item?.why_match||'');
    if(existing&&!isPrepareExperienceTemplateLine(existing))return existing;
    const mappings=analyzePrepareExperienceAgainstJd(item,session,concreteBullets);
    if(mappings.length>=2){
        const first=mappings[0];
        const second=mappings[1];
        return `${first.requirement} 这类题，优先用「${first.bullet}」起手；如果面试官继续往下追，再接「${second.bullet}」把落地动作或结果补全。`;
    }
    if(mappings.length===1){
        const only=mappings[0];
        return `这段最适合拿来回答「${only.requirement}」相关的问题，核心证据就是「${only.bullet}」。`;
    }
    if(concreteBullets.length>=2){
        return `别整段平铺，优先抓「${concreteBullets[0]}」和「${concreteBullets[1]}」这两句，它们更容易撑起一段有说服力的面试回答。`;
    }
    if(concreteBullets.length===1){
        return `这段真正值得讲的是「${concreteBullets[0]}」，把这句背后的判断和结果讲深比泛泛讲职责有用得多。`;
    }
    return '这段不要按岗位职责复述，挑一件最能说明你判断和推进能力的具体事来讲。';
}
function buildPrepareExperienceExpandBullets(item,session,concreteBullets,actionSummary){
    const section=normalizePrepareText(item?.resume_section||'这段经历');
    if(concreteBullets.length>=3){
        return [
            `开头直接抛 ${concreteBullets[0]}，先把当时看到的问题和你的判断立住。`,
            `中段重点讲 ${concreteBullets[1]}，这里要把你怎么拆、怎么推进、和谁协同说具体。`,
            `结尾用 ${concreteBullets[2]} 收住，顺手补上数字口径和你自己负责到哪一步。`
        ];
    }
    if(concreteBullets.length===2){
        return [
            `先拿 ${concreteBullets[0]} 起手，把为什么要做这件事讲清楚。`,
            `后面把 ${concreteBullets[1]} 讲成结果段，重点放在你的主动作和最终变化。`
        ];
    }
    if(concreteBullets.length===1){
        return [
            `别平铺整段 ${section}，就围绕 ${concreteBullets[0]} 往下深挖。`,
            `这道题最值钱的是把 ${actionSummary} 讲成一条完整链路：问题、判断、动作、结果。`
        ];
    }
    return [
        `别从岗位名和职责概述讲起，直接挑 ${section} 里最能说明 ${actionSummary} 的一件事。`,
        '整段回答只保留一条主线：你怎么判断、怎么推进、最后拿到了什么结果。'
    ];
}
function rewritePrepareFollowupPrompt(point){
    const normalized=normalizePrepareText(point).replace(/[？?]+$/,'');
    if(!normalized)return'';
    if(/质量标准|可复用/.test(normalized)){
        return '把 Skill 质量标准准备成 3 个维度再去答：效果准不准、运行稳不稳、换场景后哪些模块还能复用。';
    }
    if(/留存.*计算|指标变化|样本量|口径/.test(normalized)){
        return '把留存提升的口径准备清楚：比较的是哪段时间、样本量多大、有没有同步看激活率或转化率。';
    }
    if(/迁移到财务场景|财务场景/.test(normalized)){
        return '不要只说“可以迁移到财务场景”。至少准备一个报销审核、对账或风控预警版本，把输入、规则、输出讲完整。';
    }
    if(/量化体验优化|客诉率|体验优化效果/.test(normalized)){
        return '把体验优化补成能量化的结果，比如关键步骤耗时、成功率、客诉率或人工介入率。';
    }
    if(/风控规则|平衡安全与用户体验/.test(normalized)){
        return '把风控设计拆成两层：先拦什么风险，再用什么阈值和兜底流程把误伤控制住。';
    }
    if(/异常交易预警/.test(normalized)){
        return '如果被问到异常交易预警，不要泛讲模型，直接说监控哪些信号、何时触发、触发后谁处理。';
    }
    if(/优先级|哪些方法/.test(normalized)){
        return '把需求优先级的判断依据补出来，例如访谈频次、影响面、实现成本和上线后的验证指标。';
    }
    if(/上线后用户反馈|迭代了哪些功能/.test(normalized)){
        return '最好准备一轮上线后的真实反馈，再补一条你因此改过什么功能，不然整段会像停在方案阶段。';
    }
    return normalized;
}
function buildPrepareFollowupAnswer(point,item,session){
    const normalized=normalizePrepareText(point).replace(/[？?]+$/,'');
    if(!normalized)return'';
    const section=normalizePrepareText(item?.resume_section||'这段经历');
    const concreteBullets=getPrepareConcreteExperienceBullets(item);
    const firstBullet=concreteBullets[0]||'我当时先确认了用户最核心的问题';
    const secondBullet=concreteBullets[1]||'随后把方案往下推进并落地';
    const jdMatches=getPrepareExperienceSpecificJdMatch(item,session);
    const leadMatch=jdMatches[0]||'岗位要求';
    if(/产研团队|产研协作|需求被理解|研发理解|设计理解|协作时如何确保/.test(normalized)){
        return `在 ${section} 里，我通常会先把需求写成一页能落地的方案，里面只保留四件事：目标用户是谁、当前卡在哪一步、这次版本只解决什么、上线后看什么指标。拿我这段经历来说，我会先把「${firstBullet}」整理成场景和痛点，再把「${secondBullet}」拆成页面流程、输入输出、异常处理和验收标准。和研发、设计开评审时，我会逐条过“这一步用户看到什么、系统返回什么、什么情况下要兜底”，评审结束后把结论沉到 PRD 和任务单里。这样后面开发、测试、上线看的都是同一套口径，需求基本不会在执行中跑偏。`;
    }
    if(/竞品分析|关键洞察|竞品里看到什么|发现了什么/.test(normalized)){
        return `我在 ${section} 做竞品分析时，重点看了三类内容：第一是用户从进入到拿到结果要走几步，第二是结果页展示的内容够不够直接，第三是它有没有把高频动作做成模板或捷径。我最后得到的洞察是，用户真正关心的是更快拿到结果，不是先学习一堆复杂功能，所以我会把首次可用时间和关键动作完成率看得更重。放到这段经历里，这个洞察直接影响了我的方案取舍，我会优先做「${firstBullet}」对应的主路径优化，再把「${secondBullet}」放进后续迭代，这样更容易在短周期内看到转化和留存变化。`;
    }
    if(/功能优先级|需求优先级|优先级/.test(normalized)){
        return `我在 ${section} 里排优先级时，主要看四个维度：这个问题出现得频不频繁、它是不是卡在主路径、解决后能不能带来明确业务收益、以及当前团队两周内能不能做完验证。按这个标准，我会先做「${firstBullet}」这一类直接影响主流程的需求，因为它最容易同时验证用户价值和 ${leadMatch}。像体验细节、边缘场景和加分功能，我会放到第二阶段，等主链路跑通、指标稳定后再接着迭代。`;
    }
    if(/算法工程师|算法同学|模型同学|协作.*冲突|冲突.*解决/.test(normalized)){
        return `我和算法同学协作时，一般会先把目标拆成双方都能接受的三个指标：用户侧看是否真的节省时间或提升完成率，模型侧看准确率和稳定性，工程侧看响应时间和接入成本。比如在 ${section} 这段经历里，我会先用「${firstBullet}」确认真实需求，再把「${secondBullet}」拆成一版最小可验证方案，约定测试集、通过阈值、灰度范围和回滚条件。这样讨论会围绕具体结果展开，算法知道什么精度可以上线，产品也知道什么体验会被用户接受，冲突通常能很快收敛到一版可执行方案。`;
    }
    if(/漏斗分析|哪些指标|验证假设|如何验证/.test(normalized)){
        return `我在 ${section} 做漏斗分析时，会先把链路拆成曝光、点击进入、完成第一次关键动作、次日回来继续使用这四层，然后逐层找掉点。像这段经历里，我会先看「${firstBullet}」对应环节的进入率和完成率，再看用户是不是在「${secondBullet}」之前流失得最多。验证假设时，我会一次只改一个变量，比如先上预设模板，再看关键动作完成率和次日留存有没有同步提升；如果次日留存从 18% 到 30%，同时关键动作完成率也明显抬升，我就会把这次改动认定为有效，并继续扩灰。`;
    }
    if(/重新设计|做什么改进|怎么改进|重做/.test(normalized)){
        return `如果让我重做 ${section} 这段产品，我会先补三件事。第一，把「${firstBullet}」这部分抽成标准化输入和输出，后面换业务场景时可以直接复用；第二，在「${secondBullet}」对应流程里补一层质量评分和人工反馈入口，方便持续校准结果；第三，把埋点提前补齐，至少把首次成功率、平均完成时长和复用率跑出来。这样下一轮迭代会更清楚地提升产品的稳定性、效率和可复制性。`;
    }
    if(/质量标准|可复用/.test(normalized)){
        return '我会把 Skill 的质量标准拆成四层来讲。第一层是结果质量，比如同一输入多次运行的输出是否稳定，关键字段提取是否准确；第二层是过程稳定性，比如异常输入、缺字段、接口超时的时候有没有兜底；第三层是业务有效性，比如用户会不会真的调用、调用后有没有解决问题；第四层是可复用性，也就是输入结构、规则模块和输出格式能不能迁到别的场景。落地上我会准备标准输入样本、异常样本和灰度数据看板，用调用量、成功率、人工介入率和复用率一起评估。';
    }
    if(/留存.*计算|指标变化|样本量|口径/.test(normalized)){
        return '我会直接把计算口径讲清楚：比如留存提升 12%，指的是新模板上线前后各取 7 天，统计首次进入该功能的新用户，比较次日留存率从 18% 提升到 30%，样本量大概在几百人规模。除了留存，我还会一起补两个辅助指标，一个是首次关键动作完成率，一个是用户从进入到拿到结果的平均时长。这样面试官能清楚知道这个 12% 对应的是哪批用户、哪个时间窗口，以及用户行为发生了什么变化。';
    }
    if(/迁移到财务场景|财务场景/.test(normalized)){
        return `如果把 ${section} 里的能力迁到财务场景，我会直接举报销审核这个例子来讲。输入是发票、报销单和公司制度，规则层判断金额区间、票据真伪、费用归类和审批路径，输出层给出通过、打回或补资料建议。对我来说，这和我在原项目里做「${firstBullet}」和「${secondBullet}」的逻辑是一致的，都是先把高频问题拆清楚，再把规则和流程做成可复用的模块，最后用实际调用和处理效率去验证效果。`;
    }
    if(/量化体验优化|客诉率|体验优化效果/.test(normalized)){
        return '我会把体验优化效果讲成一组指标。主指标看关键步骤成功率或转化率，辅助指标看完成时长、客诉率和人工介入率。比如一个改版上线后，如果关键流程完成率从 62% 提到 74%，平均完成时长缩短 20%，相关客诉量一周内下降 15%，我就会把这三组数据一起讲出来。这样面试官能直接听到这次优化改善了哪个环节、改善了多少。';
    }
    if(/风控规则|平衡安全与用户体验/.test(normalized)){
        return '我会先把风控规则拆成三层。第一层是必须直接拦截的高风险条件，比如异常金额、黑名单账户和明显伪造信息；第二层是进入人工复核的中风险条件，比如历史行为异常但证据不充分；第三层是允许用户补材料继续走流程的低风险条件。这样设计的好处是，真正高风险会被马上挡住，正常用户大部分可以顺畅通过，只有少数边缘情况进入人工处理，安全和体验都能兼顾。';
    }
    if(/异常交易预警/.test(normalized)){
        return '如果让我设计异常交易预警，我会先盯四类信号：短时间高频交易、金额突然放大、同设备多账户切换、以及账户之间异常关联。规则触发后分三级处理，低风险先提醒并记录，中风险进入人工复核，高风险直接冻结相关操作并要求补充材料。面试里我会把整条处置链条讲完整，包括谁来接警、多久处理完、最后怎么回写结果。';
    }
    if(/上线后用户反馈|迭代了哪些功能/.test(normalized)){
        return `上线后我会先把反馈分成三类：主路径有没有卡点、结果质量够不够好、以及哪些功能根本没人用。围绕 ${section} 这段经历，我会优先跟着「${firstBullet}」这条主线看问题，再决定下一轮是优化「${secondBullet}」对应流程，还是补一个更明确的引导和模板。如果用户反馈集中在首次上手难，我会先缩短首次完成路径；如果反馈集中在结果不稳定，我会先补质量校验和兜底。`;
    }
    return `如果面试官追问这块，我会直接从 ${section} 里最硬的两步开始讲：先说「${firstBullet}」，把我当时怎么判断问题说清楚；再说「${secondBullet}」，把推进、落地和结果交代完整。这样回答会非常具体，面试官也能直接把这段经历和 ${leadMatch} 连起来。`;
}
function renderPrepareFollowupAdvice(item,session){
    const prompts=sanitizePrepareTextList(item?.possible_followups,[],6);
    if(!prompts.length)return'';
    return `
        <details class="prepare-followup-block">
            <summary class="prepare-followup-toggle">
                <strong>补挖 / 补做 / 包装建议</strong>
                <span class="prepare-followup-toggle-icon" aria-hidden="true"></span>
            </summary>
            <div class="prepare-followup-qa-list">
                ${prompts.map(function(point){
                    const question=normalizePrepareText(point);
                    const answer=buildPrepareFollowupAnswer(question,item,session);
                    return `
                        <section class="prepare-followup-qa-item">
                            <h4>${escapeHTML(question)}</h4>
                            <p>${escapeHTML(answer)}</p>
                        </section>
                    `;
                }).join('')}
            </div>
        </details>
    `;
}
function resolvePrepareExperienceSection(preferred,fallback){
    const cleaned=sanitizePrepareTextList(preferred,[],6).filter(function(point){
        return !isPrepareExperienceTemplateLine(point);
    });
    return cleaned.length?cleaned:fallback;
}
function buildPrepareExperienceSpecificExample(item,session,concreteBullets){
    const section=normalizePrepareText(item?.resume_section||'这段经历');
    const jdMatch=getPrepareExperienceSpecificJdMatch(item,session).join(' / ');
    if(concreteBullets.length>=3){
        return `我会把 ${section} 讲成一条完整链路：先说 ${concreteBullets[0]}，让面试官先听懂问题和判断；中间重点放在 ${concreteBullets[1]}，把我真正做过的设计、推进和落地讲出来；最后用 ${concreteBullets[2]} 收尾，把 ${jdMatch||'岗位要求'} 这几项能力用结果压实。`;
    }
    if(concreteBullets.length>=2){
        return `这段别讲成流水账。更好的讲法是先把 ${concreteBullets[0]} 抛出来，再接 ${concreteBullets[1]}，这样需求判断和落地结果都会自然带出，也更容易对上 ${jdMatch||'岗位要求'}。`;
    }
    if(concreteBullets.length===1){
        return `这段最该抓住的是 ${concreteBullets[0]}。只要把这一步背后的判断、推进动作和结果讲清楚，已经足够撑起一段有说服力的回答。`;
    }
    return `把 ${section} 里最能说明你的那件事挑出来，照着“问题为什么成立 -> 你怎么判断 -> 你做了什么 -> 最后结果怎样”这一条线去讲。`;
}
function inferPrepareExperienceActionSummary(item,session){
    const source=[item?.resume_section,item?.why_match].concat(item?.highlight_points||[]).join(' ');
    const text=normalizePrepareText(source).toLowerCase();
    const jdAngles=getPrepareJdFocusAngles(session?.jd_text||'');
    if(/skill|agent|workflow|工作流|智能体|tool/.test(text))return'Skill / Agent 方案设计与落地';
    if(/访谈|调研|痛点|洞察|需求/.test(text))return'用户访谈、需求挖掘和问题定义';
    if(/prd|需求文档|方案|原型|文档/.test(text))return'PRD / 方案梳理和表达';
    if(/漏斗|留存|转化|指标|埋点|a\/b|ab|数据/.test(text))return'漏斗分析、指标判断和优化推进';
    if(/竞品|行业|矩阵|研究|分析/.test(text))return'竞品分析和业务判断';
    if(/风控|合规|财务|对账|报销/.test(text))return'业务规则梳理与风险判断';
    return jdAngles[0]||'问题拆解和推进落地';
}
function buildPrepareExperienceDisplayDetails(item,session){
    const details=breakdownPrepareExperienceHighlights(item?.highlight_points||[]);
    const actionSummary=inferPrepareExperienceActionSummary(item,session);
    const concreteBullets=getPrepareConcreteExperienceBullets(item);
    const followupPrompts=getPrepareExperienceFollowupPrompts(item);
    const synthesized={
        jd:buildPrepareExperienceJdBullets(item,session,concreteBullets),
        expand:buildPrepareExperienceExpandBullets(item,session,concreteBullets,actionSummary),
        gap:[followupPrompts.length
            ?followupPrompts.slice(0,3).map(rewritePrepareFollowupPrompt).filter(Boolean)
            :[
                '先把你亲自负责到哪一步说死，不要把团队共同完成的结果全算在自己头上。',
                '结果别只留一句“效果不错”，至少准备一个数字、一个反馈来源和一个你当时的判断依据。'
            ]],
        example:[buildPrepareExperienceSpecificExample(item,session,concreteBullets)]
    };
    const dedupedExtra=(details.extra||[]).filter(function(point){
        const normalized=normalizePrepareText(point);
        return normalized&&!concreteBullets.includes(normalized)&&!isPrepareExperienceTemplateLine(normalized);
    });
    return{
        jd:resolvePrepareExperienceSection(details.jd,synthesized.jd),
        expand:resolvePrepareExperienceSection(details.expand,synthesized.expand),
        gap:resolvePrepareExperienceSection(details.gap,synthesized.gap),
        example:resolvePrepareExperienceSection(details.example,synthesized.example),
        extra:dedupedExtra
    };
}

function renderPrepareExperienceDetailBlock(title,items,fallbacks){
    const resolvedItems=(items&&items.length?items:fallbacks||[]).filter(Boolean);
    if(!resolvedItems.length)return'';
    return `
        <section class="prepare-experience-detail">
            <strong>${escapeHTML(title)}</strong>
            <ul class="prepare-bullet-list prepare-bullet-list-subtle">${resolvedItems.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>
        </section>
    `;
}

function renderPrepareFocus(session){
    const hasFocus=!!session.outputs?.focus;
    const focus=sanitizePrepareFocus(session.outputs||{},session);
    if(!hasFocus&&!focus.best_experiences.length&&!focus.prep_priorities.length&&!focus.risk_warnings.length)return'<div class="prepare-empty">先生成一套准备工作台，再查看准备重点。</div>';
    const experienceGroups=groupPrepareFocusExperiences(focus.best_experiences);
    return `
        <div class="prepare-grid prepare-grid-two">
            <article class="prepare-card-surface prepare-section-shell">
                <div class="prepare-section-kicker">准备优先级</div>
                <div class="prepare-stack-list">
                    ${focus.prep_priorities.map(item=>`
                        <section class="prepare-priority">
                            <h3>${escapeHTML(item.title)}</h3>
                            <p>${escapeHTML(item.reason)}</p>
                            <ul class="prepare-bullet-list">${item.what_to_prepare.map(point=>`<li>${escapeHTML(point)}</li>`).join('')}</ul>
                        </section>
                    `).join('')}
                </div>
                ${focus.risk_warnings.length?`
                    <div class="prepare-focus-risk-block">
                        <div class="prepare-section-kicker">风险提示</div>
                        <div class="prepare-warning-grid">
                            ${focus.risk_warnings.map(item=>`
                                <section class="prepare-warning-card">
                                    <h3>${escapeHTML(item.title)}</h3>
                                    <p>${escapeHTML(item.description)}</p>
                                    <span>${escapeHTML(item.avoidance_tip)}</span>
                                </section>
                            `).join('')}
                        </div>
                    </div>
                `:''}
            </article>
            <article class="prepare-card-surface prepare-section-shell">
                <div class="prepare-section-kicker">最该讲的经历</div>
                <div class="prepare-focus-groups">
                    ${experienceGroups.length?experienceGroups.map(group=>`
                        <section class="prepare-focus-group">
                            <div class="prepare-stack-list">
                                ${group.items.map(function(item){
                                    const details=buildPrepareExperienceDisplayDetails(item,session);
                                    const summary=buildPrepareExperienceSummary(item,session,getPrepareConcreteExperienceBullets(item));
                                    return `
                                        <section class="prepare-experience">
                                            <h3>${escapeHTML(item.resume_section)}</h3>
                                            <p>${escapeHTML(summary)}</p>
                                            <div class="prepare-experience-detail-grid">
                                                ${renderPrepareExperienceDetailBlock('对应 JD',details.jd,[])}
                                                ${renderPrepareExperienceDetailBlock('怎么展开',details.expand,[])}
                                                ${renderPrepareExperienceDetailBlock('还要补清楚',details.gap,[])}
                                                ${renderPrepareExperienceDetailBlock('开口版本',details.example,[])}
                                                ${details.extra.length?renderPrepareExperienceDetailBlock('还能再补',details.extra,[]):''}
                                            </div>
                                            ${renderPrepareFollowupAdvice(item,session)}
                                        </section>
                                    `;
                                }).join('')}
                            </div>
                        </section>
                    `).join(''):'<div class="prepare-empty">还没抽取到可讲经历，建议先补一段实习、项目或校园经历线索。</div>'}
                </div>
            </article>
        </div>
    `;
}
function renderPrepareQuestions(session){
    return renderPrepareAnswers(session);
}
async function replacePrepareAnswerCache(sessionId,cacheKey,framework,nextAnswer){
    const current=store.getPrepareSession(sessionId);
    if(!current?.outputs)return false;
    const answerCache=cloneData(current.outputs.answer_cache||{});
    answerCache[cacheKey]=Object.assign({},answerCache[cacheKey]||{},{
        [framework]:nextAnswer
    });
    await store.updatePrepareSession(sessionId,{
        outputs:Object.assign({},current.outputs,{answer_cache:answerCache})
    });
    return true;
}
async function ensurePrepareAnswer(sessionId,questionId,framework){
    const session=store.getPrepareSession(sessionId);
    if(!session||!session.outputs)return;
    const groups=getPrepareQuestionGroups(session);
    const rawQuestion=groups.flatMap(group=>group.questions||[]).find(item=>item.id===questionId);
    const question=rawQuestion?normalizePrepareQuestionRecord(rawQuestion):null;
    if(!question)return;
    if(question.question_type==='reverse_question')return;
    framework=frameworkMetaFromSelection(framework,question.recommended_frameworks);
    const existing=session.outputs.answer_cache?.[questionId]?.[framework];
    if(existing)return;
    prepareState.answerLoading=true;
    prepareState.answerError='';
    startPrepareLoading('answer');
    renderPrepare();
    try{
        const answer=await generatePrepareAnswerFramework(session,question,framework);
        const current=store.getPrepareSession(sessionId);
        if(!current||!current.outputs)return;
        const answerCache=cloneData(current.outputs.answer_cache||{});
        answerCache[questionId]=Object.assign({},answerCache[questionId]||{},{
            [framework]:answer
        });
        await store.updatePrepareSession(sessionId,{
            outputs:Object.assign({},current.outputs,{answer_cache:answerCache})
        });
        prepareState.answerLoading=false;
        stopPrepareLoading();
        renderPrepare();
    }catch(error){
        prepareState.answerLoading=false;
        stopPrepareLoading();
        prepareState.answerError=error instanceof Error?error.message:String(error);
        renderPrepare();
        toast(prepareState.answerError,'error');
    }
}
async function regeneratePrepareAnswer(sessionId,question,framework){
    const session=store.getPrepareSession(sessionId);
    if(!session||!session.outputs||!question)return;
    framework=frameworkMetaFromSelection(framework,question.recommended_frameworks);
    prepareState.answerLoading=true;
    prepareState.answerError='';
    startPrepareLoading('answer');
    renderPrepare();
    try{
        const nextAnswer=normalizePrepareAnswerOutput(Object.assign({},await requestPrepareAnswerAI(session,question,framework),{source:'ai'}),session,question,framework);
        await replacePrepareAnswerCache(sessionId,question.id,framework,nextAnswer);
        prepareState.answerLoading=false;
        stopPrepareLoading();
        renderPrepare();
        toast('已重新生成回答','success');
    }catch(error){
        prepareState.answerLoading=false;
        stopPrepareLoading();
        prepareState.answerError=error instanceof Error?error.message:String(error);
        renderPrepare();
        toast(prepareState.answerError,'error');
    }
}
async function ensurePrepareFreeAnswer(sessionId){
    const session=store.getPrepareSession(sessionId);
    const questionText=normalizePrepareText(prepareState.freeQuestionText);
    if(!session||!session.outputs)return;
    if(!questionText){
        toast('先输入你想追问的问题。','error');
        return;
    }
    const cacheKey=getPrepareFreeQuestionKey(questionText);
    const existing=session.outputs.answer_cache?.[cacheKey]?.FREE;
    if(existing){
        renderPrepare();
        return;
    }
    prepareState.answerLoading=true;
    prepareState.answerError='';
    startPrepareLoading('answer');
    renderPrepare();
    try{
        const answer=await generatePrepareAnswerFramework(session,{
            id:cacheKey,
            question:questionText,
            question_type:'free',
            source:'custom'
        },'FREE');
        const current=store.getPrepareSession(sessionId);
        if(!current||!current.outputs)return;
        const answerCache=cloneData(current.outputs.answer_cache||{});
        answerCache[cacheKey]=Object.assign({},answerCache[cacheKey]||{},{FREE:answer});
        await store.updatePrepareSession(sessionId,{
            outputs:Object.assign({},current.outputs,{answer_cache:answerCache})
        });
        prepareState.answerLoading=false;
        stopPrepareLoading();
        renderPrepare();
    }catch(error){
        prepareState.answerLoading=false;
        stopPrepareLoading();
        prepareState.answerError=error instanceof Error?error.message:String(error);
        renderPrepare();
        toast(prepareState.answerError,'error');
    }
}
async function regeneratePrepareFreeAnswer(sessionId){
    const session=store.getPrepareSession(sessionId);
    const questionText=normalizePrepareText(prepareState.freeQuestionText);
    if(!session||!session.outputs)return;
    if(!questionText){
        toast('先输入你想追问的问题。','error');
        return;
    }
    const cacheKey=getPrepareFreeQuestionKey(questionText);
    const question={
        id:cacheKey,
        question:questionText,
        question_type:'free',
        source:'custom'
    };
    prepareState.answerLoading=true;
    prepareState.answerError='';
    startPrepareLoading('answer');
    renderPrepare();
    try{
        const nextAnswer=normalizePrepareAnswerOutput(Object.assign({},await requestPrepareAnswerAI(session,question,'FREE'),{source:'ai'}),session,question,'FREE');
        await replacePrepareAnswerCache(sessionId,cacheKey,'FREE',nextAnswer);
        prepareState.answerLoading=false;
        stopPrepareLoading();
        renderPrepare();
        toast('已重新生成回答','success');
    }catch(error){
        prepareState.answerLoading=false;
        stopPrepareLoading();
        prepareState.answerError=error instanceof Error?error.message:String(error);
        renderPrepare();
        toast(prepareState.answerError,'error');
    }
}
function renderPrepareAnswerBody(answer){
    const structure=Array.isArray(answer?.structure)?answer.structure.filter(Boolean):[];
    const resumeEvidence=Array.isArray(answer?.resume_evidence_used)?answer.resume_evidence_used.filter(Boolean):[];
    const deliveryTips=Array.isArray(answer?.delivery_tips)?answer.delivery_tips.filter(Boolean):[];
    const outline=normalizePrepareText(answer?.copyable_outline||'');
    return `
        <div class="prepare-section-kicker">回答骨架</div>
        ${resumeEvidence.length?`
            <div class="prepare-answer-evidence">
                <div class="prepare-section-kicker">简历依据</div>
                <div class="prepare-token-row">${resumeEvidence.map(item=>`<span class="prepare-token">${escapeHTML(item)}</span>`).join('')}</div>
            </div>
        `:''}
        ${answer.gap_note?`<div class="prepare-inline-notice prepare-answer-gap-note">${escapeHTML(answer.gap_note)}</div>`:''}
        <div class="prepare-answer-structure">
            ${structure.map(part=>`
                <div class="prepare-answer-block">
                    <h3>${escapeHTML(part.section)}</h3>
                    <p>${escapeHTML(part.guidance)}</p>
                    <ul class="prepare-bullet-list">${(Array.isArray(part.suggested_points)?part.suggested_points:[]).map(point=>`<li>${escapeHTML(point)}</li>`).join('')}</ul>
                </div>
            `).join('')}
        </div>
        <div class="prepare-answer-footer">
            <div class="prepare-answer-panel prepare-answer-tips-card">
                <div class="prepare-section-kicker">表达提醒</div>
                <ul class="prepare-bullet-list">${deliveryTips.map(tip=>`<li>${escapeHTML(tip)}</li>`).join('')}</ul>
            </div>
            <div class="prepare-answer-panel prepare-answer-outline-card">
                <div class="prepare-answer-panel-head">
                    <div class="prepare-section-kicker">可直接回答</div>
                    <button type="button" class="btn-secondary btn-sm" id="prepare-copy-outline">复制回答</button>
                </div>
                <div class="prepare-answer-outline">
                    <pre>${escapeHTML(outline)}</pre>
                </div>
            </div>
        </div>
    `;
}
function renderPrepareSupplementalExperienceCard(session,options){
    const compact=!!options?.compact;
    const bare=!!options?.bare;
    const modalSimple=!!options?.modalSimple;
    const items=getPrepareSupplementalExperiences(session);
    const draft=normalizePrepareText(prepareState.supplementalExperienceDraft);
    const note=compact
        ?'补进去后，这道题和后面的回答都能优先调用。'
        :'这段素材会进入整套准备工作台，后面生成题目、回答和模拟点评时都能调用。';
    const recentItems=items.slice(0,compact?3:12);
    if(modalSimple){
        return `
            <section class="prepare-supplement-card prepare-supplement-card-bare prepare-supplement-card-modal-simple">
                <div class="prepare-supplement-capsule prepare-supplement-capsule-simple">
                    <div class="prepare-supplement-capsule-input">
                        <textarea id="prepare-supplemental-input-global" rows="4" placeholder="例如：我做过用户访谈、梳理过漏斗、协调过研发/设计、推动过上线，并拿到过结果变化。">${escapeHTML(draft)}</textarea>
                    </div>
                    <div class="prepare-supplement-capsule-actions">
                        <button type="button" class="btn-primary btn-sm" id="prepare-supplemental-add-global">添加经历</button>
                        <span class="prepare-supplement-hint">尽量写“动作 + 结果 + 证据”，别只写任务名。</span>
                    </div>
                </div>
                ${recentItems.length?`
                    <div class="prepare-supplement-list">
                        ${recentItems.map(function(item){
                            return `
                                <div class="prepare-supplement-item">
                                    <strong>${escapeHTML(item.text)}</strong>
                                    <button type="button" class="prepare-supplement-remove" data-prepare-supplement-remove="${escapeHTML(item.id)}" aria-label="删除经历">×</button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `:`<div class="prepare-supplement-empty">先补一条经历，后面生成题目和回答时就能直接用。</div>`}
            </section>
        `;
    }
    const content=`
        <section class="prepare-card-surface prepare-supplement-card${compact?' is-compact':''}">
            <div class="prepare-supplement-head">
                <div>
                    <div class="prepare-section-kicker">补充经历库</div>
                    <h3>${compact?'补一条你这题想讲的经历':'把你想讲的经历先收进经历库'}</h3>
                    <p>${escapeHTML(note)}</p>
                </div>
                <span class="prepare-supplement-count">${items.length||0} 条</span>
            </div>
            <div class="prepare-supplement-capsule${compact?'':' prepare-supplement-capsule-simple'}">
                <div class="prepare-supplement-capsule-input">
                    <textarea id="prepare-supplemental-input-global" rows="${compact?2:3}" placeholder="${compact?'例如：我访谈 20 位用户后改流程，把转化提到 31%。':'例如：我做过用户访谈、梳理过漏斗、协调过研发/设计、推动过上线，并拿到过结果变化。'}">${escapeHTML(draft)}</textarea>
                </div>
                <div class="prepare-supplement-capsule-actions">
                    <button type="button" class="btn-primary btn-sm" id="prepare-supplemental-add-global">添加经历</button>
                    ${compact?'<span class="prepare-supplement-hint">补完后重新生成，这条经历会被优先纳入。</span>':'<span class="prepare-supplement-hint">尽量写“动作 + 结果 + 证据”，别只写任务名。</span>'}
                </div>
            </div>
            ${recentItems.length?`
                <div class="prepare-supplement-list${compact?' is-capsule-list':''}">
                    ${recentItems.map(function(item){
                        return `
                            <div class="prepare-supplement-item">
                                <strong>${escapeHTML(item.text)}</strong>
                                <button type="button" class="prepare-supplement-remove" data-prepare-supplement-remove="${escapeHTML(item.id)}" aria-label="删除经历">×</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `:'<div class="prepare-supplement-empty">先补一条经历，后面再生成题目和回答时就能直接用。</div>'}
        </section>
    `;
    return bare?content.replace(/^<section class="prepare-card-surface prepare-supplement-card[^"]*">/,'<section class="prepare-supplement-card prepare-supplement-card-bare">'):content;
}
function renderPrepareSupplementHub(session){
    return `
        <div class="prepare-grid">
            <section class="prepare-card-surface prepare-section-shell">
                ${renderPrepareSupplementalExperienceCard(session,{compact:false})}
            </section>
        </div>
    `;
}

function renderPrepareSupplementTrigger(session){
    const items=getPrepareSupplementalExperiences(session);
    return `
        <div class="prepare-answer-supplement-trigger">
            <button type="button" class="btn-secondary btn-sm" data-prepare-open-supplement="1">补充经历</button>
            <span>${items.length?`已存 ${items.length} 条，点开就能补到这道题里。`:'这道题想临时补一段经历，可以点这里再记进去。'}</span>
        </div>
    `;
}

function renderPrepareSupplementModal(session){
    return `
        <div class="modal-overlay${prepareState.showSupplementModal?' active':''}" id="prepare-supplement-overlay">
            <div class="modal modal-lg prepare-supplement-modal">
                <div class="modal-header">
                    <div>
                        <h2>补充经历</h2>
                        <p>把这道题想提到的经历补进来，后面生成回答和模拟点评会优先调用。</p>
                    </div>
                    <button class="modal-close" id="prepare-supplement-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${renderPrepareSupplementalExperienceCard(session,{compact:false,bare:true,modalSimple:true})}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" id="prepare-supplement-done">我补好了</button>
                </div>
            </div>
        </div>
    `;
}

function hasPrepareMockProgress(session){
    if(!session||prepareMockState.sessionId!==session.id)return false;
    if(prepareMockState.stage==='summary')return true;
    if(prepareMockState.stage==='interview'&&prepareMockState.questions.length)return true;
    return prepareMockState.currentIndex>0
        || !!normalizePrepareText(prepareMockState.currentAnswer)
        || !!prepareMockState.currentFeedback
        || !!prepareMockState.finalFeedback
        || (Array.isArray(prepareMockState.history)&&prepareMockState.history.length>0);
}

function renderPrepareQuestionsList(session){
    const questions=getPrepareQuestionGroups(session);
    const introText='这些问题会混合 JD、简历深挖、行为面 / 宝洁八大问、场景题和反问环节。点题后会直接进入回答页，不再把答案堆在列表下面。';
    return `
        <div class="prepare-question-page">
            <section class="prepare-card-surface prepare-question-toolbox">
                <div class="prepare-question-toolbox-copy">
                    <div class="prepare-section-kicker">自定义问题</div>
                    <h3>把你担心被问到的题写出来，AI 直接帮你生成回答骨架</h3>
                    <p>${escapeHTML(introText)}</p>
                </div>
                <div class="prepare-question-toolbox-panel">
                    <label class="prepare-field prepare-custom-question-field">
                        <span>你觉得考官会问什么</span>
                        <textarea id="prepare-custom-question-input" rows="5" placeholder="例如：如果面试官追问我为什么转产品，我应该怎么答？">${escapeHTML(prepareState.freeQuestionText)}</textarea>
                        <em>不是让 AI 帮你出题，而是你先把题目写出来，它再帮你起草回答。</em>
                    </label>
                    <div class="prepare-custom-question-actions">
                        <button type="button" class="btn-primary" id="prepare-custom-question-generate">生成回答骨架</button>
                        <button type="button" class="btn-secondary" id="prepare-custom-question-clear">清空</button>
                    </div>
                </div>
            </section>
            ${!questions.length?'<div class="prepare-empty prepare-question-empty">先生成一套准备工作台，再查看模拟问题。</div>':''}
            ${questions.map(function(group,groupIndex){
                const isReverseGroup=isPrepareReverseQuestionGroup(group);
                const showSourceLabel=shouldShowPrepareQuestionSource(group);
                return `
                    <section class="prepare-card-surface prepare-section-shell">
                        <div class="prepare-question-group-head">
                            <div class="prepare-section-kicker">${escapeHTML(group.group_name)}</div>
                            <button type="button" class="prepare-question-group-refresh-btn${prepareState.questionGroupLoadingKey===String(groupIndex)?' is-loading':''}" data-prepare-question-group="${groupIndex}" ${prepareState.questionGroupLoadingKey===String(groupIndex)?'disabled':''} aria-label="重新生成 3 个" title="重新生成 3 个"><svg class="prepare-refresh-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v6h-6"/></svg></button>
                        </div>
                        <div class="prepare-question-list${isReverseGroup?' is-static':''}">
                            ${group.questions.map(function(rawQuestion){
                                const question=normalizePrepareQuestionRecord(rawQuestion);
                                const sourceLabel=getPrepareQuestionSourceLabel(question);
                                if(isReverseGroup){
                                    return `
                                        <div class="prepare-question-card prepare-question-card-static prepare-question-card-reverse" aria-label="${escapeHTML(question.question)}">
                                            <div class="prepare-question-main">
                                                <strong>${escapeHTML(question.question)}</strong>
                                            </div>
                                        </div>
                                    `;
                                }
                                return `
                                    <button class="prepare-question-card${prepareState.selectedQuestionId===question.id&&prepareState.questionPane==='answer'?' is-active':''}" type="button" data-prepare-question="${question.id}">
                                        <div class="prepare-question-main">
                                            <strong>${escapeHTML(question.question)}</strong>
                                            ${showSourceLabel?`<span>${escapeHTML(sourceLabel)}</span>`:''}
                                            ${question.question_type==='reverse_question'?'':`
                                                <div class="prepare-question-frameworks">
                                                    ${question.recommended_frameworks.map(function(framework){
                                                        return `<i>${escapeHTML(getPrepareFrameworkMeta(framework).label)}</i>`;
                                                    }).join('')}
                                                </div>
                                            `}
                                        </div>
                                        <em class="prepare-question-card-action" aria-hidden="true" title="进入回答页">›</em>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </section>
                `;
            }).join('')}
        </div>
    `;
}
function renderPrepareAnswerPageLead(meta){
    const pageTitle=meta?.title||'回答页';
    const pageDesc=meta?.description||'这道题已经单独展开，回答会在这个页面里生成和修改。';
    const pageTag=meta?.tag||'问题回答';
    return `
        <section class="prepare-card-surface prepare-answer-page-lead">
            <div class="prepare-answer-page-copy">
                <div class="prepare-section-kicker">${escapeHTML(pageTag)}</div>
                <h3>${escapeHTML(pageTitle)}</h3>
                <p>${escapeHTML(pageDesc)}</p>
            </div>
        </section>
    `;
}
function renderPrepareAnswers(session){
    const questionPane=prepareState.questionPane||'list';
    if(questionPane!=='answer'){
        return renderPrepareQuestionsList(session);
    }
    const selectedQuestion=prepareState.selectedQuestionId?getPrepareSelectedQuestion(session,{fallback:false}):null;
    const questionMeta=selectedQuestion?normalizePrepareQuestionRecord(selectedQuestion):null;
    const isFreeQuestion=prepareState.selectedFramework==='FREE'&&!questionMeta;
    const isReverseQuestion=!!(questionMeta&&(questionMeta.question_type==='reverse_question'||questionMeta.source==='reverse'));
    const availableFrameworks=questionMeta?questionMeta.recommended_frameworks:PREP_FRAMEWORKS.filter(function(item){return item.key!=='FREE';}).map(function(item){return item.key;});
    const framework=frameworkMetaFromSelection(prepareState.selectedFramework,isFreeQuestion?['FREE']:availableFrameworks);
    if(!prepareState.selectedFramework||prepareState.selectedFramework!==framework)prepareState.selectedFramework=framework;
    const frameworkMeta=getPrepareFrameworkMeta(framework);
    const questionSource=questionMeta?escapeHTML(questionMeta.source==='jd'?'来自 JD':questionMeta.source==='resume'?'来自简历':questionMeta.source==='behavioral'?'来自行为面':questionMeta.source==='custom'?'来自自定义问题':questionMeta.source==='reverse'?'反问环节':'来自岗位信息'):'';
    const backButton=`<button type="button" class="prepare-back-btn" id="prepare-answer-back">← 返回题目列表</button>`;
    if(framework==='FREE'){
        const freeQuestion=normalizePrepareText(prepareState.freeQuestionText);
        const rawAnswer=session.outputs?.answer_cache?.[getPrepareFreeQuestionKey(freeQuestion)]?.FREE;
        const freeQuestionMeta={
            id:getPrepareFreeQuestionKey(freeQuestion||'free_question'),
            question:freeQuestion||'自定义问题',
            question_type:'free',
            source:'custom'
        };
        const answer=rawAnswer?normalizePrepareAnswerOutput(rawAnswer,session,freeQuestionMeta,'FREE'):rawAnswer;
        return `
            <div class="prepare-answer-page">
                <div class="prepare-answer-flow">
                <section class="prepare-card-surface prepare-answer-hero-card">
                    <div class="prepare-answer-hero-copy">
                        <div class="prepare-section-kicker">自由追问</div>
                        <h3>${escapeHTML(frameworkMeta.label)}</h3>
                        <p>${escapeHTML(frameworkMeta.description)}</p>
                        <span>${escapeHTML(frameworkMeta.useCase||'')}</span>
                    </div>
                    <div class="prepare-answer-hero-actions">
                        <div class="prepare-answer-top-actions">${backButton}</div>
                        <label class="prepare-field prepare-free-field">
                            <span>你想怎么问</span>
                            <textarea id="prepare-free-question" rows="5" placeholder="例如：如果面试官追问我为什么转产品，我应该怎么答？">${escapeHTML(prepareState.freeQuestionText)}</textarea>
                            <em>会基于当前 JD、简历和你补充的经历素材来生成。</em>
                        </label>
                        <div class="prepare-entry-actions prepare-answer-actions">
                            <button type="button" class="btn-primary" id="prepare-generate-free-answer">生成自由回答</button>
                            <button type="button" class="btn-secondary" id="prepare-regenerate-free-answer">重新生成回答</button>
                        </div>
                        ${renderPrepareSupplementTrigger(session)}
                    </div>
                </section>
                <section class="prepare-card-surface prepare-answer-surface${prepareState.answerLoading?' prepare-loading-panel':''}">
                    ${prepareState.answerError?`<div class="prepare-inline-notice is-error">${escapeHTML(prepareState.answerError)}</div>`:''}
                    ${prepareState.answerLoading?renderPrepareLoadingScene('answer'):answer?renderPrepareAnswerBody(answer):'<div class="prepare-empty">先输入一个问题，再生成回答骨架。</div>'}
                </section>
                </div>
            </div>
        `;
    }
    if(isReverseQuestion){
        const reverseQuestions=getPrepareReverseQuestions(session);
        return `
            <div class="prepare-answer-page">
                <div class="prepare-answer-flow">
                <section class="prepare-card-surface prepare-answer-hero-card">
                    <div class="prepare-answer-hero-copy">
                        <div class="prepare-section-kicker">面试尾声可直接发问</div>
                        <h3>挑 1 到 2 句最有信息量的就够了</h3>
                        <p>这里不分析、不拆框架，只保留能直接问出口的问题。</p>
                    </div>
                    <div class="prepare-answer-hero-actions">
                        <div class="prepare-answer-top-actions">${backButton}</div>
                    </div>
                </section>
                <section class="prepare-card-surface prepare-answer-surface">
                    <div class="prepare-reverse-list">
                        ${(reverseQuestions.length?reverseQuestions:[questionMeta]).map(function(item,index){
                            return `
                                <section class="prepare-reverse-item">
                                    <strong>问题 ${index+1}</strong>
                                    <p>${escapeHTML(item.question)}</p>
                                </section>
                            `;
                        }).join('')}
                    </div>
                </section>
                </div>
            </div>
        `;
    }
    if(!questionMeta){
        return `
            <div class="prepare-answer-page">
                <div class="prepare-answer-flow">
                <section class="prepare-card-surface prepare-answer-hero-card">
                    <div class="prepare-answer-hero-copy">
                        <div class="prepare-section-kicker">回答页</div>
                        <h3>先从题目列表里点一道题</h3>
                        <p>回答页会单独展开，不再跟着题目列表挤在一起。</p>
                        <span>你也可以先去补一段经历，再回来生成答案。</span>
                    </div>
                    <div class="prepare-answer-hero-actions">
                        <div class="prepare-answer-top-actions">${backButton}</div>
                        ${renderPrepareSupplementTrigger(session)}
                    </div>
                </section>
                <section class="prepare-card-surface prepare-answer-surface">
                    <div class="prepare-empty">先在题目列表里选一道题，再生成回答骨架。</div>
                </section>
                </div>
            </div>
        `;
    }
    const rawAnswer=session.outputs?.answer_cache?.[questionMeta.id]?.[framework];
    const answer=rawAnswer?normalizePrepareAnswerOutput(rawAnswer,session,questionMeta,framework):rawAnswer;
    const frameworkPills=availableFrameworks.map(function(key){
        const item=getPrepareFrameworkMeta(key);
        return `<button type="button" class="prepare-framework-btn${framework===item.key?' is-active':''}" data-prepare-framework="${item.key}">${escapeHTML(item.label)}</button>`;
    }).join('');
    const answerMeta=`
        <section class="prepare-card-surface prepare-answer-hero-card">
            <div class="prepare-answer-hero-copy">
                <div class="prepare-section-kicker">回答策略</div>
                <h3>${escapeHTML(questionMeta.question)}</h3>
                <p>${escapeHTML(questionMeta.framework_reason||'')}</p>
                <span>${questionSource}</span>
            </div>
            <div class="prepare-answer-hero-actions">
                <div class="prepare-answer-top-actions">${backButton}</div>
                <div class="prepare-answer-intro">
                    <div class="prepare-section-kicker">当前模板</div>
                    <h3>${escapeHTML(frameworkMeta.label)}</h3>
                    <p>${escapeHTML(frameworkMeta.description)}</p>
                    <span>${escapeHTML(frameworkMeta.useCase||'')}</span>
                </div>
                <div class="prepare-entry-actions prepare-answer-actions">
                    <button type="button" class="btn-secondary" id="prepare-regenerate-answer">重新生成回答</button>
                </div>
                <div class="prepare-framework-switch" role="tablist">${frameworkPills}</div>
                        ${renderPrepareSupplementTrigger(session)}
            </div>
        </section>
    `;
    if(prepareState.answerLoading&&!answer){
        return `
            <div class="prepare-answer-page">
                <div class="prepare-answer-flow">
                ${answerMeta}
                <section class="prepare-card-surface prepare-answer-surface prepare-loading-panel">
                    ${renderPrepareLoadingScene('answer')}
                </section>
                </div>
            </div>
        `;
    }
    if(!answer){
        return `
            <div class="prepare-answer-page">
                <div class="prepare-answer-flow">
                ${answerMeta}
                <section class="prepare-card-surface prepare-answer-surface">
                    ${prepareState.answerError?`<div class="prepare-inline-notice is-error">${escapeHTML(prepareState.answerError)}</div>`:''}
                    <div class="prepare-empty">回答骨架还没生成出来。${prepareState.answerError?'修复后再点模板重新生成。':'点击模板或问题后会自动生成。'}</div>
                </section>
                </div>
            </div>
        `;
    }
    return `
        <div class="prepare-answer-page">
            <div class="prepare-answer-flow">
            ${answerMeta}
            <section class="prepare-card-surface prepare-answer-surface">
                ${renderPrepareAnswerBody(answer)}
            </section>
            </div>
        </div>
    `;
}
function buildPrepareGeneratedMockInterviewQuestions(session){
    const allQuestions=getPrepareAllQuestions(session).filter(function(question){
        const meta=normalizePrepareQuestionRecord(question);
        return meta.question_type!=='reverse_question';
    });
    const pickFirst=function(predicate){
        return allQuestions.find(function(question){
            return predicate(normalizePrepareQuestionRecord(question));
        })||null;
    };
    const picks=[
        pickFirst(function(question){return question.question_type==='company_fit'||question.source==='company'||question.source==='jd';}),
        pickFirst(function(question){return question.question_type==='resume_deep_dive'||question.source==='resume';}),
        pickFirst(function(question){return question.question_type==='behavioral'||question.source==='behavioral';}),
        pickFirst(function(question){return question.question_type==='case'||question.source==='jd';})
    ].filter(Boolean);
    const seen=new Set();
    const unique=picks.filter(function(question){
        if(seen.has(question.id))return false;
        seen.add(question.id);
        return true;
    });
    if(unique.length>=4)return unique.slice(0,4);
    allQuestions.forEach(function(question){
        if(unique.length>=4)return;
        if(seen.has(question.id))return;
        seen.add(question.id);
        unique.push(question);
    });
    return unique.slice(0,4);
}
function buildPrepareMockInterviewQuestions(session){
    if(prepareMockState.questionMode==='custom'){
        const customQuestions=(prepareMockState.customQuestions||[]).map(function(item,index){
            const text=normalizePrepareText(item?.question||item||'');
            if(!text)return null;
            return normalizePrepareQuestionRecord({
                id:item?.id||createLocalId('custom_mock'),
                question:text,
                question_type:item?.question_type||'behavioral',
                source:'custom',
                importance:item?.importance||'high',
                recommended_frameworks:item?.recommended_frameworks||[],
                default_framework:item?.default_framework||'PREP',
                framework_reason:item?.framework_reason||'这是你自己定义的问题，建议先亮结论，再举例或给结构化回答。'
            });
        }).filter(Boolean);
        return customQuestions.length?customQuestions:[];
    }
    return buildPrepareGeneratedMockInterviewQuestions(session);
}
function resetPrepareMockInterviewState(session){
    const rememberedQuestionMode=prepareMockState.questionMode||'generated';
    const rememberedFeedbackMode=prepareMockState.feedbackMode||'per_question';
    const rememberedCustomQuestions=prepareMockState.sessionId===session?.id?cloneData(prepareMockState.customQuestions||[]):[];
    prepareMockState.sessionId=session?.id||'';
    prepareMockState.questions=buildPrepareGeneratedMockInterviewQuestions(session);
    prepareMockState.currentIndex=0;
    prepareMockState.currentAnswer='';
    prepareMockState.currentFeedback=null;
    prepareMockState.history=[];
    prepareMockState.currentQuestionLoading=false;
    prepareMockState.submitLoading=false;
    prepareMockState.error='';
    prepareMockState.stage='setup';
    prepareMockState.finalFeedback=null;
    prepareMockState.questionMode=rememberedQuestionMode;
    prepareMockState.feedbackMode=rememberedFeedbackMode;
    prepareMockState.customQuestionDraft='';
    prepareMockState.customQuestions=rememberedCustomQuestions;
    prepareMockState.transcriptMode='text';
    prepareMockState.voiceActive=false;
    prepareMockState.transcriptText='';
    prepareMockState.showResumeGate=false;
    prepareMockState.recorderSeconds=0;
    if(prepareMockState.recorderTimer){
        clearInterval(prepareMockState.recorderTimer);
        prepareMockState.recorderTimer=null;
    }
    if(prepareMockState.recognition){
        try{prepareMockState.recognition.stop();}catch(error){}
    }
}
function startPrepareMockInterview(session){
    const questions=buildPrepareMockInterviewQuestions(session);
    prepareMockState.sessionId=session?.id||'';
    prepareMockState.questions=questions;
    prepareMockState.currentIndex=0;
    prepareMockState.currentAnswer='';
    prepareMockState.currentFeedback=null;
    prepareMockState.history=[];
    prepareMockState.currentQuestionLoading=false;
    prepareMockState.submitLoading=false;
    prepareMockState.error='';
    prepareMockState.stage='interview';
    prepareMockState.finalFeedback=null;
    prepareMockState.transcriptMode='text';
    prepareMockState.voiceActive=false;
    prepareMockState.transcriptText='';
    prepareMockState.showResumeGate=false;
    prepareMockState.recorderSeconds=0;
    if(prepareMockState.recorderTimer){
        clearInterval(prepareMockState.recorderTimer);
        prepareMockState.recorderTimer=null;
    }
    if(prepareMockState.recognition){
        try{prepareMockState.recognition.stop();}catch(error){}
    }
}
function getCurrentPrepareMockQuestion(){
    return prepareMockState.questions[prepareMockState.currentIndex]||null;
}
function renderPrepareMockVoiceResult(label,text){
    const value=normalizePrepareText(text);
    return `
        <div class="voice-result" id="prepare-mock-voice-result" style="${value?'':'display:none'}">
            ${value?`<div class="voice-result-label">${escapeHTML(label)}</div><div>${escapeHTML(value)}</div>`:''}
        </div>
    `;
}
function getPrepareAnswerPageMeta(session){
    const selectedQuestion=prepareState.selectedQuestionId?getPrepareSelectedQuestion(session,{fallback:false}):null;
    const questionMeta=selectedQuestion?normalizePrepareQuestionRecord(selectedQuestion):null;
    const freeQuestion=normalizePrepareText(prepareState.freeQuestionText);
    if(prepareState.selectedFramework==='FREE'&&freeQuestion){
        return {
            kicker:'自定义问题回答页',
            title:freeQuestion,
            detail:'问题列表已收起，这里只保留这道题的回答骨架与补充经历。'
        };
    }
    if(questionMeta){
        return {
            kicker:questionMeta.question_type==='reverse_question'?'反问环节':'问题回答页',
            title:questionMeta.question_type==='reverse_question'?'反问环节':questionMeta.question,
            detail:questionMeta.question_type==='reverse_question'?'这里是单独的反问环节页面。':'问题列表已收起，这里是单独的回答页。'
        };
    }
    return {
        kicker:'问题回答页',
        title:'回答页',
        detail:'这里不会再把回答挂在题目列表底部。'
    };
}
function renderPrepareMockInterview(session){
    if(prepareMockState.sessionId!==session?.id){
        resetPrepareMockInterviewState(session);
    }
    const linkedApp=session.application_id?store.getApp(session.application_id):null;
    const companyLabel=linkedApp?`${linkedApp.company_name} · ${linkedApp.position_title}`:`${session.company_name||'当前准备会话'} · ${session.role_name||'目标岗位'}`;
    const generatedQuestions=buildPrepareGeneratedMockInterviewQuestions(session);
    const questions=buildPrepareMockInterviewQuestions(session);
    const total=questions.length;
    const currentQuestion=getCurrentPrepareMockQuestion();
    const finished=total>0&&prepareMockState.currentIndex>=total;
    const feedback=prepareMockState.currentFeedback;
    const feedbackModeLabel=prepareMockState.feedbackMode==='end'?'全部结束再点评':'每题都点评';
    const questionModeLabel=prepareMockState.questionMode==='custom'?'自己出题':'生成题目';
    if(prepareMockState.showResumeGate&&hasPrepareMockProgress(session)){
        const progressText=prepareMockState.stage==='summary'
            ? `上一轮已经完成，共 ${total||prepareMockState.questions.length||0} 题。`
            : `你已经做到第 ${Math.min((prepareMockState.currentIndex||0)+1,total||prepareMockState.questions.length||1)} 题，共 ${total||prepareMockState.questions.length||0} 题。`;
        return `
            <div class="prepare-mock-workbench">
                <section class="prepare-card-surface prepare-section-shell prepare-mock-resume-card">
                    <div class="prepare-mock-header-copy">
                        <div class="prepare-section-kicker">模拟面试</div>
                        <h3>继续上次练习，或者开一轮新的模拟</h3>
                        <p>${escapeHTML(companyLabel)} · ${escapeHTML(questionModeLabel)} · ${escapeHTML(feedbackModeLabel)}</p>
                    </div>
                    <div class="prepare-inline-notice">${escapeHTML(progressText)}</div>
                    <div class="prepare-mock-actions">
                        <button type="button" class="btn-primary" id="prepare-mock-resume">继续上次练习</button>
                        <button type="button" class="btn-secondary" id="prepare-mock-new-round">开一轮新模拟</button>
                        <button type="button" class="btn-secondary btn-sm" id="prepare-mock-open-setup">修改题目模式和点评方式</button>
                    </div>
                </section>
                ${prepareMockState.stage==='summary'&&prepareMockState.finalFeedback?renderPrepareMockFeedbackCard(prepareMockState.finalFeedback):''}
            </div>
        `;
    }
    if(prepareMockState.stage==='setup'){
        const canStart=prepareMockState.questionMode==='custom'?questions.length>0:generatedQuestions.length>0;
        return `
            <div class="prepare-mock-workbench prepare-mock-setup">
                <section class="prepare-card-surface prepare-section-shell prepare-mock-header prepare-mock-header-setup">
                    <div class="prepare-mock-header-copy">
                        <div class="prepare-section-kicker">模拟面试</div>
                        <h3>先选题目模式和点评方式，再开始练习</h3>
                        <p>${escapeHTML(companyLabel)}</p>
                    </div>
                </section>
                <section class="prepare-card-surface prepare-section-shell prepare-mock-setup-panel">
                    <div class="prepare-mock-setup-grid">
                        <div class="prepare-mock-choice-card">
                            <div class="prepare-section-kicker">题目来源</div>
                            <div class="prepare-choice-group" role="tablist">
                                <button type="button" class="prepare-choice-btn${prepareMockState.questionMode==='generated'?' is-active':''}" data-prepare-mock-mode-choice="generated">生成模拟面试题目</button>
                                <button type="button" class="prepare-choice-btn${prepareMockState.questionMode==='custom'?' is-active':''}" data-prepare-mock-mode-choice="custom">自己想问题自己回答</button>
                            </div>
                            <p>生成题目会围绕岗位、简历和行为面来出题；自己出题适合你已经知道面试官可能会怎么问。</p>
                        </div>
                        <div class="prepare-mock-choice-card">
                            <div class="prepare-section-kicker">点评方式</div>
                            <div class="prepare-choice-group" role="tablist">
                                <button type="button" class="prepare-choice-btn${prepareMockState.feedbackMode==='per_question'?' is-active':''}" data-prepare-mock-feedback-mode="per_question">一个问题一个点评</button>
                                <button type="button" class="prepare-choice-btn${prepareMockState.feedbackMode==='end'?' is-active':''}" data-prepare-mock-feedback-mode="end">全部结束再点评</button>
                            </div>
                            <p>前者会边答边点评，后者会等你整场答完后给一次总评。</p>
                        </div>
                    </div>
                    ${prepareMockState.questionMode==='custom'?`
                        <div class="prepare-mock-custom-box">
                            <label class="prepare-field">
                                <span>你来出题</span>
                                <textarea id="prepare-mock-custom-question-input" rows="4" placeholder="例如：请讲一个你推动跨团队协作的经历。">${escapeHTML(prepareMockState.customQuestionDraft)}</textarea>
                                <em>把你想自己回答的问题先写下来，再点“添加题目”。</em>
                            </label>
                            <div class="prepare-mock-actions prepare-mock-actions-left">
                                <button type="button" class="btn-primary" id="prepare-mock-add-custom-question">添加题目</button>
                            </div>
                            <div class="prepare-mock-custom-list">
                                ${prepareMockState.customQuestions.length?prepareMockState.customQuestions.map(function(item,index){
                                    const text=normalizePrepareText(item?.question||item||'');
                                    const itemId=item?.id||`mock_custom_${index}`;
                                    return `
                                        <div class="prepare-mock-custom-item">
                                            <strong>${escapeHTML(text)}</strong>
                                            <button type="button" class="prepare-mock-custom-remove" data-prepare-mock-custom-remove="${escapeHTML(itemId)}" aria-label="删除题目">×</button>
                                        </div>
                                    `;
                                }).join(''):'<div class="prepare-empty prepare-mock-custom-empty">先添加 1 到 3 个你想自己回答的问题。</div>'}
                            </div>
                        </div>
                    `:''}
                </section>
                <div class="prepare-mock-setup-footer">
                    <div class="prepare-mock-actions">
                        <button type="button" class="btn-primary" id="prepare-mock-start" ${canStart?'':'disabled'}>${canStart?'开始模拟面试':'先补齐题目'}</button>
                    </div>
                </div>
            </div>
        `;
    }
    if(prepareMockState.stage==='summary'){
        const finalFeedback=prepareMockState.finalFeedback||feedback;
        return `
            <div class="prepare-mock-workbench">
                <section class="prepare-card-surface prepare-section-shell prepare-mock-finished">
                    <div class="prepare-section-kicker">模拟面试完成</div>
                    <h3>这场模拟已经结束</h3>
                    <p>${escapeHTML(companyLabel)} · ${escapeHTML(feedbackModeLabel)}。</p>
                    <div class="prepare-mock-progress">
                        <span>已完成 ${total} / ${total}</span>
                    </div>
                    <div class="prepare-mock-actions">
                        <button type="button" class="btn-secondary" id="prepare-mock-back-setup">重新设置</button>
                        <button type="button" class="btn-primary" id="prepare-mock-restart">再来一轮</button>
                    </div>
                </section>
                ${finalFeedback?renderPrepareMockFeedbackCard(finalFeedback):'<div class="prepare-empty">总结点评还在生成中。</div>'}
            </div>
        `;
    }
    const saveHint=linkedApp?'提交后会写入这条投递的复盘。':'提交后会按公司和岗位写入复盘，不会落到未知分组。';
    if(!total){
        return `
            <div class="prepare-empty">这套工作台里还没有可用的题目，先回到“问题”页重新生成一次。</div>
        `;
    }
    if(!currentQuestion){
        return `
            <div class="prepare-empty">当前这轮模拟的题目状态有点乱了。点一次“重新设置”或“重新开始”，我们会立刻把题面重建好。</div>
        `;
    }
    if(finished){
        if(prepareMockState.feedbackMode==='end'&&!prepareMockState.finalFeedback){
            return `
                <div class="prepare-mock-workbench">
                    <section class="prepare-card-surface prepare-section-shell prepare-mock-finished">
                        <div class="prepare-section-kicker">模拟面试完成</div>
                        <h3>已完成全部回答，正在生成总评</h3>
                        <p>这次会一次性点评整场表现，并写入复盘。</p>
                        <div class="prepare-mock-progress">
                            <span>已完成 ${total} / ${total}</span>
                        </div>
                    </section>
                </div>
            `;
        }
        return `
            <div class="prepare-mock-workbench">
                <section class="prepare-card-surface prepare-section-shell prepare-mock-finished">
                    <div class="prepare-section-kicker">模拟面试完成</div>
                    <h3>这场模拟已经答完了</h3>
                    <p>你可以回看每轮点评，或者直接点“重新开始”再来一轮，把不顺的题目打磨到能稳定输出。</p>
                    <div class="prepare-mock-progress">
                        <span>已完成 ${total} / ${total}</span>
                    </div>
                    <div class="prepare-mock-actions">
                        <button type="button" class="btn-secondary" id="prepare-mock-back-setup">重新设置</button>
                        <button type="button" class="btn-primary" id="prepare-mock-restart">重新开始</button>
                    </div>
                </section>
                ${feedback?renderPrepareMockFeedbackCard(feedback):''}
            </div>
        `;
    }
    const question=normalizePrepareQuestionRecord(currentQuestion);
    const feedbackPanel=feedback?renderPrepareMockFeedbackCard(feedback):'';
    return `
        <div class="prepare-mock-workbench">
            <section class="prepare-card-surface prepare-section-shell prepare-mock-header prepare-mock-header-live">
                <div class="prepare-mock-header-copy">
                    <div class="prepare-section-kicker">模拟面试</div>
                    <h3>按真实面试节奏一题一答，答完后 AI 会给点评和建议，并自动写入复盘</h3>
                    <p>${escapeHTML(linkedApp?`${linkedApp.company_name} · ${linkedApp.position_title}`:session.company_name||'当前准备会话')}</p>
                </div>
                <div class="prepare-mock-header-actions">
                    <button type="button" class="btn-secondary btn-sm" id="prepare-mock-back-setup">重新设置</button>
                    <button type="button" class="btn-secondary btn-sm" id="prepare-mock-restart">重新开始</button>
                    <button type="button" class="btn-secondary btn-sm" id="prepare-mock-next" ${prepareMockState.currentIndex>=questions.length?'disabled':''}>下一题</button>
                </div>
            </section>
            ${prepareMockState.error?`<div class="prepare-inline-notice is-error">${escapeHTML(prepareMockState.error)}</div>`:''}
            <section class="prepare-card-surface prepare-section-shell prepare-mock-question-card">
                <div class="prepare-mock-progress">
                    <span>第 ${prepareMockState.currentIndex+1} 题 / 共 ${total} 题</span>
                    <em>${escapeHTML(question.question_type==='reverse_question'?'反问环节':(question.question_type||'模拟题'))}</em>
                </div>
                <h3>${escapeHTML(question.question)}</h3>
                <p>${escapeHTML(question.framework_reason||'先把回答说完整，再补结果和证据。')}</p>
                <div class="prepare-token-row">
                    ${(question.recommended_frameworks||[]).map(function(key){
                        const item=getPrepareFrameworkMeta(key);
                        return `<span class="prepare-token">${escapeHTML(item.label)}</span>`;
                    }).join('')}
                </div>
            </section>
            <section class="prepare-card-surface prepare-section-shell prepare-mock-answer-card">
                <div class="prepare-mock-answer-card-head">
                    <div>
                        <div class="prepare-section-kicker">你的回答</div>
                        <p>可以直接打字，也可以语音转文字。尽量把背景、动作、判断和结果都说完整。</p>
                    </div>
                    <div class="input-mode-toggle">
                        <button type="button" class="mode-btn${prepareMockState.transcriptMode==='text'?' active':''}" data-prepare-mock-mode="text">📝 文本</button>
                        <button type="button" class="mode-btn${prepareMockState.transcriptMode==='voice'?' active':''}" data-prepare-mock-mode="voice">🎙️ 语音</button>
                    </div>
                </div>
                <div class="prepare-mock-answer-shell">
                    <textarea id="prepare-mock-answer" rows="7" placeholder="先口述再补写都可以，尽量用你自己的表达，不要直接抄答案。">${escapeHTML(prepareMockState.currentAnswer)}</textarea>
                    <div id="prepare-mock-voice-recorder" class="prepare-mock-voice-card" style="${prepareMockState.transcriptMode==='voice'?'':'display:none'}">
                        <button class="record-btn" id="prepare-mock-record-btn" type="button"><span class="record-icon"></span><span id="prepare-mock-record-label">${prepareMockState.voiceActive?'正在转写...':'点击开始转写'}</span></button>
                        <div id="prepare-mock-record-timer" class="record-timer">${String(Math.floor(prepareMockState.recorderSeconds/60)).padStart(2,'0')}:${String(prepareMockState.recorderSeconds%60).padStart(2,'0')}</div>
                        ${renderPrepareMockVoiceResult('实时转写',prepareMockState.transcriptText)}
                    </div>
                </div>
                <div class="prepare-mock-answer-meta">
                    <div class="prepare-inline-notice">${escapeHTML(saveHint)}</div>
                    <div class="prepare-mock-save-chip">复盘会自动带入：${escapeHTML(linkedApp?.company_name||session.company_name||'当前公司')} · ${escapeHTML(linkedApp?.position_title||session.role_name||'目标岗位')}</div>
                </div>
                <div class="prepare-mock-actions">
                    <button type="button" class="btn-primary" id="prepare-mock-submit" ${prepareMockState.submitLoading?'disabled':''}>提交并点评</button>
                    <button type="button" class="btn-secondary" id="prepare-mock-skip" ${prepareMockState.submitLoading?'disabled':''}>跳过这题</button>
                </div>
            </section>
            ${feedbackPanel}
        </div>
    `;
}
function renderPrepareMockFeedbackCard(feedback){
    const strengths=Array.isArray(feedback.strengths)?feedback.strengths:[];
    const gaps=Array.isArray(feedback.gaps)?feedback.gaps:[];
    const suggestions=Array.isArray(feedback.suggestions)?feedback.suggestions:[];
    const painPoints=Array.isArray(feedback.pain_points)?feedback.pain_points:[];
    const nextSteps=Array.isArray(feedback.next_steps)?feedback.next_steps:[];
    return `
        <section class="prepare-card-surface prepare-section-shell prepare-mock-feedback-card">
            <div class="prepare-mock-feedback-hero">
                <div>
                    <div class="prepare-section-kicker">AI 点评</div>
                    <h3>${escapeHTML(feedback.overall_feedback||feedback.reflection_summary||'这轮回答的点评')}</h3>
                </div>
                ${typeof feedback.self_rating==='number'?`<div class="prepare-mock-score-pill">建议得分 ${Math.max(1,Math.min(5,feedback.self_rating))}/5</div>`:''}
            </div>
            <div class="prepare-mock-feedback-grid">
                <div class="prepare-answer-block prepare-mock-feedback-column">
                    <strong>做得好的地方</strong>
                    <ul class="prepare-bullet-list">${strengths.map(item=>`<li>${escapeHTML(item)}</li>`).join('')||'<li>这轮还没有提炼出明显优势。</li>'}</ul>
                </div>
                <div class="prepare-answer-block prepare-mock-feedback-column">
                    <strong>还需要补的地方</strong>
                    <ul class="prepare-bullet-list">${gaps.map(item=>`<li>${escapeHTML(item)}</li>`).join('')||'<li>先补上更具体的动作、证据和结果。</li>'}</ul>
                </div>
            </div>
            <div class="prepare-answer-block prepare-mock-feedback-primary">
                <strong>下一轮怎么改</strong>
                <ul class="prepare-bullet-list">${suggestions.map(item=>`<li>${escapeHTML(item)}</li>`).join('')||'<li>把回答重写成“问题是什么、你怎么判断、你做了什么、结果如何”。</li>'}</ul>
            </div>
            ${nextSteps.length?`
                <div class="prepare-answer-block prepare-mock-feedback-secondary">
                    <strong>下一步行动</strong>
                    <ul class="prepare-bullet-list">${nextSteps.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>
                </div>
            `:''}
            ${painPoints.length?`
                <div class="prepare-followup-block prepare-mock-feedback-pain">
                    <strong>可写入复盘的失分点</strong>
                    <ul class="prepare-bullet-list prepare-bullet-list-subtle">${painPoints.map(item=>`<li>${escapeHTML(item)}</li>`).join('')}</ul>
                </div>
            `:''}
            ${feedback.follow_up_question?`
                <div class="prepare-inline-notice prepare-mock-followup-inline">下一轮可以继续追问：${escapeHTML(feedback.follow_up_question)}</div>
            `:''}
        </section>
    `;
}
function renderPrepareWorkbench(session){
    const normalizedOutputs=normalizePrepareOutputsPayload(session?.outputs);
    const renderSession=session?.outputs?Object.assign({},session,{outputs:sanitizePrepareOutputs(normalizedOutputs,session)}):session;
    const linkedApp=getPrepareLinkedApp(session);
    const linkedResume=getPrepareLinkedResume(session);
    const account=window.rtReadCachedAccount&&window.rtReadCachedAccount()||null;
    const resumeStatus=getPrepareResumeStatus(session);
    const resumePreview=getPrepareResumePreviewData({
        linkedText:linkedResume?.extracted_text,
        summaryText:mergePrepareResumeTexts(session.resume_text,getPrepareSupplementalExperienceSummary(session))
    });
    const generatedAt=session.generated_at?fmtDT(session.generated_at):'刚刚生成';
    const generationMeta=renderSession.outputs?.meta||{};
    const prepareConfig=getPrepareConfig();
    const modelOptions=getPrepareModelOptions();
    const activeModel=modelOptions.find(option=>option.key===(generationMeta.model||prepareConfig.model))||modelOptions[0];
    const summaryText=generationMeta.summary||'围绕当前岗位整理一套背调、重点、问题与回答骨架。';
    const jdPreviewText=normalizePrepareText(session.jd_text||'');
    const supplementCount=getPrepareSupplementalExperiences(session).length;
    const activeTab=(prepareState.activeTab==='answers'||prepareState.activeTab==='supplement')?'questions':prepareState.activeTab;
    let tabContent=`
        <div class="prepare-state-panel${session.error_message?' is-error':''}">
            <div class="prepare-section-kicker">${session.error_message?'生成失败':'准备中'}</div>
            <h3>${session.error_message?'这套准备暂时没生成出来':'这套准备会话还在等待生成'}</h3>
            <p>${escapeHTML(session.error_message||'点右上角重新生成后，我们会基于 JD 与简历重新整理一套工作台。')}</p>
            <ul class="prepare-bullet-list">
                <li>确认 JD 文本足够完整，最好直接粘贴岗位原文。</li>
                <li>如果有简历摘要，尽量补上关键经历和结果。</li>
                <li>信息补齐后重新生成，就不会靠猜测补内容。</li>
            </ul>
        </div>
    `;
    if(renderSession.outputs){
        try{
            tabContent=renderPrepareTabByKey(activeTab,renderSession);
        }catch(error){
            console.warn('prepare workbench tab render failed',error);
            try{
                tabContent=renderPrepareTabByKey(activeTab,buildPrepareFallbackRenderSession(session));
            }catch(fallbackError){
                console.warn('prepare fallback tab render failed',fallbackError);
                tabContent=renderPrepareResearch(buildPrepareFallbackRenderSession(session));
            }
        }
    }
    const isAnswerMode=activeTab==='questions'&&prepareState.questionPane==='answer';
    return `
        <div class="prepare-workbench${isAnswerMode?' is-answer-mode':''}">
            <div class="prepare-workbench-head">
                <div>
                    <h2>${escapeHTML(session.company_name||'目标公司')} · ${escapeHTML(session.role_name||'目标岗位')}</h2>
                    <p>${escapeHTML(session.role_category||generationMeta.lens||'准备工作台')} · ${escapeHTML(linkedResume?.file_name||session.resume_name||'未绑定简历')} · ${generatedAt}</p>
                    <div class="prepare-workbench-summary">${escapeHTML(summaryText)}</div>
                    <div class="prepare-session-meta prepare-session-meta-secondary">
                        <span>${escapeHTML(generationMeta.provider||prepareConfig.provider||'DeepSeek')}</span>
                        <span>${escapeHTML(activeModel.label)}</span>
                        <span>${hasPrepareUsableJd(session.jd_text)?'JD 已就位':'JD 需要补齐'}</span>
                        <span>${escapeHTML(resumeStatus.label)}</span>
                    </div>
                </div>
                <div class="prepare-workbench-actions">
                    ${resumePreview.text?'<button type="button" class="btn-secondary btn-sm" id="prepare-open-resume-preview">查看简历正文</button>':''}
                    ${jdPreviewText?'<button type="button" class="btn-secondary btn-sm" id="prepare-open-jd-preview">查看JD正文</button>':''}
                    <button type="button" class="btn-secondary btn-sm" data-prepare-open-supplement="1">补充经历${supplementCount?` · ${supplementCount}`:''}</button>
                    <button type="button" class="btn-secondary btn-sm" id="prepare-regenerate">重新生成</button>
                    ${linkedApp?'<button type="button" class="btn-secondary btn-sm" id="prepare-open-app">查看投递</button>':''}
                </div>
            </div>
            ${prepareState.sessionError?`<div class="prepare-inline-notice is-error">${escapeHTML(prepareState.sessionError)}</div>`:''}
            ${renderPrepareAccessBanner(account,{showRegister:true,compactPaid:true})}
            ${isAnswerMode?'':`
                <div class="prepare-tabs">
                    <button type="button" class="prepare-tab${prepareState.activeTab==='research'?' is-active':''}" data-prepare-tab="research">背调</button>
                    <button type="button" class="prepare-tab${prepareState.activeTab==='focus'?' is-active':''}" data-prepare-tab="focus">重点</button>
                    <button type="button" class="prepare-tab${prepareState.activeTab==='questions'?' is-active':''}" data-prepare-tab="questions">问题</button>
                    <button type="button" class="prepare-tab${activeTab==='mock'?' is-active':''}" data-prepare-tab="mock">模拟面试</button>
                </div>
            `}
            <div class="prepare-tab-panel${isAnswerMode?' is-answer-mode':''}">
                ${tabContent}
            </div>
            ${renderPrepareResumePreviewOverlay(resumePreview)}
            ${renderPrepareJdPreviewOverlay(session)}
            ${renderPrepareSupplementModal(session)}
        </div>
    `;
}
function renderJobsView(filterText){
    const root=$('#jobs-root');
    if(!root)return;
    const q=normalizePrepareText(filterText||jobBoardState.query);
    const jobs=getVisibleJobBoardJobs(q);
    const totalPages=Math.max(1,Math.ceil(jobs.length/(jobBoardState.pageSize||80)));
    const currentPage=Math.min(Math.max(jobBoardState.page||1,1),totalPages);
    jobBoardState.page=currentPage;
    const startIndex=(currentPage-1)*(jobBoardState.pageSize||80);
    const pageJobs=jobs.slice(startIndex,startIndex+(jobBoardState.pageSize||80));
    const regionCounts=jobBoardState.regionCounts||{};
    const metaLabel=q?`当前匹配 ${jobs.length} 个岗位`:`当前收录 ${jobs.length} 个岗位`;
    const bodyTransitionClass=jobBoardState.bodyAnimationToken?' jobs-results-panel--enter':'';
    root.innerHTML=`
        <section class="jobs-shell">
            <div class="jobs-hero">
                <div class="jobs-hero-copy">
                    <div class="section-kicker">职位发现</div>
                    <h2>真实职位发现</h2>
                    <p class="jobs-hero-meta">默认展示已经同步好的真实岗位，留空会直接按地区查看全部。</p>
                </div>
            </div>
            <div class="jobs-board-surface">
                <div class="jobs-toolbar">
                    <label class="jobs-query-field">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        <input type="text" id="jobs-query" value="${escapeHTML(jobBoardState.query)}" placeholder="搜公司或岗位，留空默认显示全部。">
                    </label>
                    <div class="jobs-region-tabs">
                        <button type="button" class="jobs-region-tab${jobBoardState.activeRegion==='all'?' is-active':''}" data-jobs-region="all">全部</button>
                        ${JOB_BOARD_REGIONS.map(function(region){
                            const count=regionCounts[region.key]||0;
                            return `<button type="button" class="jobs-region-tab${jobBoardState.activeRegion===region.key?' is-active':''}" data-jobs-region="${region.key}">${escapeHTML(region.label)}${count?` <span>${count}</span>`:''}</button>`;
                        }).join('')}
                    </div>
                </div>
                <div class="jobs-meta-row">
                    <span>${escapeHTML(metaLabel)}</span>
                    <span>第 ${currentPage} / ${totalPages} 页</span>
                </div>
                <div class="jobs-results-panel${bodyTransitionClass}">
                ${jobBoardState.error?`<div class="jobs-error">${escapeHTML(jobBoardState.error)}</div>`:''}
                ${jobBoardState.loading?`
                    <div class="jobs-loading">
                        <span></span>
                        <strong>正在整理职位列表…</strong>
                    </div>
                `:(!jobBoardState.searched?`
                    <div class="jobs-empty">
                        <strong>准备加载职位列表</strong>
                        <span>这里展示的是已经同步好的职位数据，不会在用户进入时现场抓取。</span>
                    </div>
                `:(jobs.length?`
                    <div class="jobs-table-wrap">
                        <div class="jobs-table-shell">
                            <div class="jobs-table-head">
                                <span>地区</span>
                                <span>公司</span>
                                <span>岗位</span>
                                <span>Base</span>
                                <span>来源</span>
                                <span></span>
                            </div>
                            <div class="jobs-table-body">
                                ${pageJobs.map(function(job,index){return renderJobRow(job,index);}).join('')}
                            </div>
                        </div>
                        <div class="jobs-pagination">
                            <button type="button" class="btn-secondary btn-sm" data-jobs-page="prev" ${currentPage<=1?'disabled':''}>上一页</button>
                            <span class="jobs-pagination-meta">显示 ${jobs.length?startIndex+1:0}-${Math.min(startIndex+pageJobs.length,jobs.length)} / ${jobs.length}</span>
                            <button type="button" class="btn-secondary btn-sm" data-jobs-page="next" ${currentPage>=totalPages?'disabled':''}>下一页</button>
                        </div>
                    </div>
                `:`
                    <div class="jobs-empty">
                        <strong>没有搜到匹配岗位</strong>
                        <span>职位池里暂时没有这组关键词，试试更通用的公司名或岗位名。</span>
                    </div>
                `))}
                </div>
            </div>
        </section>
    `;
    $('#jobs-query')?.addEventListener('input',function(){
        jobBoardState.query=this.value;
    });
    $('#jobs-query')?.addEventListener('keydown',function(event){
        if(event.key==='Enter'){
            event.preventDefault();
            void runJobBoardSearch();
        }
    });
    $$('[data-jobs-region]').forEach(function(button){
        button.addEventListener('click',function(){
            jobBoardState.activeRegion=this.dataset.jobsRegion||'all';
            jobBoardState.page=1;
            jobBoardState.bodyAnimationToken=Date.now();
            renderJobsView();
        });
    });
    $$('[data-jobs-page]').forEach(function(button){
        button.addEventListener('click',function(){
            const direction=this.dataset.jobsPage;
            if(direction==='prev'&&jobBoardState.page>1)jobBoardState.page-=1;
            if(direction==='next'&&jobBoardState.page<totalPages)jobBoardState.page+=1;
            jobBoardState.bodyAnimationToken=Date.now();
            renderJobsView();
        });
    });
    $$('[data-job-import]').forEach(function(button){
        button.addEventListener('click',function(event){
            event.preventDefault();
            event.stopPropagation();
            openJobPostingInAppModal(this.dataset.jobImport||'');
        });
    });
    if(!jobBoardState.bootstrapped&&!jobBoardState.loading&&!jobBoardState.searched&&curView==='jobs'){
        jobBoardState.bootstrapped=true;
        setTimeout(function(){
            if(curView==='jobs')void runJobBoardSearch({query:'',forceReload:false});
        },0);
    }
    if(jobBoardState.bodyAnimationToken){
        window.requestAnimationFrame(function(){
            jobBoardState.bodyAnimationToken=0;
        });
    }
}
function renderJobRow(job,index){
    const rowIndex=Math.max(0,Math.min(Number(index)||0,12));
    return `
        <article class="job-row" style="--row-index:${rowIndex}">
            <div class="job-region-pill" data-region="${escapeHTML(job.region||'other')}">${escapeHTML(getJobBoardRegionLabel(job.region))}</div>
            <div class="job-company-cell">
                <strong>${escapeHTML(job.company)}</strong>
                ${job.updated_at?`<span>${escapeHTML(fmtD(job.updated_at))}</span>`:''}
            </div>
            <div class="job-title-cell">
                <strong>${escapeHTML(job.title)}</strong>
                ${job.summary?`<span>${escapeHTML(getJobBoardVisibleSummary(job))}</span>`:''}
            </div>
            <div class="job-location-cell">${escapeHTML(job.location||'地点未标注')}</div>
            <div class="job-source-cell">${escapeHTML(job.source||'公开职位')}</div>
            <div class="job-row-actions">
                <a class="btn-secondary btn-sm" href="${escapeHTML(job.url)}" target="_blank" rel="noreferrer">打开JD</a>
                <button type="button" class="btn-primary btn-sm" data-job-import="${escapeHTML(job.id)}">带入投递</button>
            </div>
        </article>
    `;
}
async function runJobBoardSearch(options){
    const rawQuery=options&&Object.prototype.hasOwnProperty.call(options,'query')?options.query:(jobBoardState.query||$('#jobs-query')?.value||'');
    const query=normalizePrepareText(rawQuery);
    jobBoardState.query=query;
    jobBoardState.page=1;
    jobBoardState.loading=true;
    jobBoardState.error='';
    jobBoardState.searched=true;
    jobBoardState.bootstrapped=true;
    renderJobsView();
    try{
        await loadJobBoardCache(!!(options&&options.forceReload));
        if(!jobBoardState.jobs.length){
            jobBoardState.error='职位缓存里暂时没有可展示岗位，请先运行缓存同步。';
        }
    }catch(error){
        jobBoardState.error=error instanceof Error?error.message:String(error);
    }finally{
        jobBoardState.loading=false;
        renderJobsView();
    }
}
function openJobPostingInAppModal(jobId){
    const job=(jobBoardState.jobs||[]).find(function(item){return item.id===jobId;});
    if(!job)return;
    openAppModal();
    setFieldValue('#form-company',job.company);
    setFieldValue('#form-position',job.title);
    setFieldValue('#form-base',job.location);
    setFieldValue('#form-channel',job.source);
    setFieldValue('#form-channel-link',job.url);
    setFieldValue('#form-jd-url',job.url);
    setFieldValue('#form-jd-text',job.jd_text||job.summary||'');
    toast('已把职位带入投递表单，请补岗位类别后保存。','success');
}
function renderPrepare(){
    const root=$('#prepare-root');
    if(!root)return;
    const account=window.rtReadCachedAccount&&window.rtReadCachedAccount()||null;
    const sessions=getPrepareSessionsSorted();
    const selectedSession=getPrepareSelectedSession();
    const appOptions=store.apps.filter(app=>app.status!=='WITHDRAWN');
    const composeStep=prepareState.composeStep||'entry';
    const selectedAppId=prepareState.selectedApplicationId||'';
    const selectedApp=selectedAppId?store.getApp(selectedAppId):null;
    const appDraft=selectedApp?getPrepareApplicationDraft(selectedApp):null;
    const manualLinkedResume=prepareState.manualDraft.resumeId?store.getResume(prepareState.manualDraft.resumeId):null;
    const appLinkedResumeStatus=appDraft?.linkedResume
        ?(normalizeResumeExtractedText(appDraft.linkedResume.extracted_text||'')?'正文已读取':appDraft.linkedResume.data_url?'待读取正文':appDraft.linkedResume.notes?'仅有摘要':'未读取')
        :'未绑定';
    const appResumePreview=selectedApp?getPrepareResumePreviewData({
        parseText:prepareState.appSupplementParse.text,
        linkedText:appDraft?.linkedResume?.extracted_text,
        summaryText:prepareState.appSupplement.resumeText||appDraft?.linkedResume?.notes||''
    }):null;
    const manualResumePreview=getPrepareResumePreviewData({
        parseText:prepareState.manualResumeParse.text,
        linkedText:manualLinkedResume?.extracted_text,
        summaryText:prepareState.manualDraft.resumeText||manualLinkedResume?.notes||''
    });
    const missingMessages=appDraft?[
        appDraft.requiresJd?`补一段至少 ${PREP_MIN_JD_LENGTH} 个字的 JD 原文`:null,
        appDraft.requiresResume?'补一份简历上下文（绑定简历、临时文件或摘要）':null
    ].filter(Boolean):[];
    const showWorkspace=Boolean(selectedSession)&&prepareState.screen==='workspace';
    if(showWorkspace&&selectedSession&&prepareState.lastOpenedSessionId!==selectedSession.id){
        resetPrepareWorkspaceState(selectedSession.id);
    }
    try{
    root.innerHTML=showWorkspace?`
        <div class="prepare-shell prepare-shell-workspace-view">
            <section class="prepare-workspace-screen">
                <div class="prepare-workspace-topbar">
                    <button type="button" class="btn-secondary btn-sm" id="prepare-back-compose">重新填写</button>
                    <div class="prepare-workspace-topbar-copy">
                        <strong>${escapeHTML(selectedSession.company_name||'目标公司')} · ${escapeHTML(selectedSession.role_name||'目标岗位')}</strong>
                        <span>${escapeHTML(selectedSession.source_type==='application'?'来自已投递岗位':'准备会话')} · ${fmtDT(selectedSession.updated_at||selectedSession.created_at)}</span>
                    </div>
                    <div class="prepare-workspace-topbar-actions">
                        <button type="button" class="btn-secondary btn-sm" id="prepare-start-new">新建分析</button>
                    </div>
                </div>
                ${prepareState.sessionLoading&&selectedSession?`<div class="prepare-workbench-empty is-shellless"><div class="prepare-workbench-placeholder prepare-workbench-loading is-shellless">${renderPrepareLoadingScene('session')}</div></div>`:renderPrepareWorkbench(selectedSession)}
            </section>
        </div>
    `:`
        <div class="prepare-shell prepare-shell-compose-view">
            <section class="prepare-compose-screen">
                <div class="prepare-compose-hero">
                    <div class="prepare-kicker">Prepare Session</div>
                    <h2>${composeStep==='entry'?'先选开始方式，再进入准备工作台':'把这次分析要用的 JD 和简历补完整'}</h2>
                    <p>${composeStep==='entry'?'第一步先决定是从已有投递开始，还是单独新建一套准备；第二步再补材料并开始分析。':'这一页只保留本次分析真正要用的输入，填完后会直接切到独立工作台。'}</p>
                </div>
                ${renderPrepareAccessBanner(account,{showRegister:true,compactPaid:true})}
                <div class="prepare-compose-grid">
                    <div class="prepare-card-surface prepare-compose-primary">
                        ${composeStep==='entry'?`
                            <div class="prepare-entry-selector">
                                <button type="button" class="prepare-entry-option" data-prepare-enter-mode="application" ${appOptions.length?'':'disabled'}>
                                    <div class="prepare-section-kicker">从已有投递开始</div>
                                    <h3>自动带入岗位与简历</h3>
                                    <p>${appOptions.length?`已录入 ${appOptions.length} 条可用投递，适合直接接着准备。`:'当前还没有可用投递，先去看板或表格录一条岗位。'}</p>
                                    <span>${appOptions.length?'选择岗位并继续':'暂无可用岗位'}</span>
                                </button>
                                <button type="button" class="prepare-entry-option" data-prepare-enter-mode="manual">
                                    <div class="prepare-section-kicker">新建准备工作台</div>
                                    <h3>单独为一个岗位拉起准备</h3>
                                    <p>适合还没录入系统的机会，先补公司、岗位、JD 和简历上下文。</p>
                                    <span>手动填写并继续</span>
                                </button>
                            </div>
                        `:`
                            <div class="prepare-entry-detail-head">
                                <button type="button" class="btn-secondary btn-sm" id="prepare-compose-back-step">返回上一步</button>
                                <div class="prepare-mode-switch" role="tablist">
                                    <button type="button" class="prepare-mode-btn${prepareState.mode==='application'?' is-active':''}" data-prepare-mode="application">选择已有投递</button>
                                    <button type="button" class="prepare-mode-btn${prepareState.mode==='manual'?' is-active':''}" data-prepare-mode="manual">新建准备</button>
                                </div>
                            </div>
                            <div class="prepare-entry-card prepare-entry-card-immersive${prepareState.mode==='application'?' is-visible':''}" id="prepare-existing-panel">
                                <div class="prepare-section-kicker">从已投递岗位开始</div>
                                <h3>选中岗位后，把缺的 JD 和简历上下文补齐</h3>
                                <p>这一步只保留本次分析真正要用到的材料。</p>
                                <div class="prepare-form-grid prepare-form-grid-wide">
                                    <label class="prepare-field prepare-field-full">
                                        <span>选择岗位</span>
                                        <select id="prepare-application-select">
                                            <option value="">请选择一条投递…</option>
                                            ${appOptions.map(app=>`<option value="${app.id}" ${selectedAppId===app.id?'selected':''}>${escapeHTML(app.company_name)} · ${escapeHTML(app.position_title)}</option>`).join('')}
                                        </select>
                                    </label>
                                    ${selectedApp?`
                                        <div class="prepare-application-summary prepare-field-full">
                                            <div>
                                                <strong>${escapeHTML(selectedApp.company_name)} · ${escapeHTML(selectedApp.position_title)}</strong>
                                                <span>${escapeHTML(getSI(selectedApp.status).label)} · 当前简历：${escapeHTML(appDraft?.linkedResume?.file_name||'未绑定')} · ${escapeHTML(appLinkedResumeStatus)}</span>
                                            </div>
                                            <em>${hasPrepareUsableJd(appDraft?.jdText)?'JD 已就位':'需要补 JD'}</em>
                                        </div>
                                        ${appDraft?.requiresJd?`
                                            <label class="prepare-field prepare-field-full">
                                                <span>JD 链接</span>
                                                <div class="prepare-jd-url-row">
                                                    <input type="url" id="prepare-app-jd-url" placeholder="https://..." value="${escapeHTML(prepareState.appSupplement.jdUrl||appDraft?.jdUrl||'')}">
                                                    <button type="button" class="btn-secondary btn-sm" id="prepare-app-read-jd">${prepareState.jdReaderLoadingKey==='app'?'读取中':'读取JD'}</button>
                                                </div>
                                                <em>能读取的链接会自动填到下面 JD 文本，读取不到也可以手动粘贴。</em>
                                            </label>
                                            <label class="prepare-field prepare-field-full">
                                                <span>JD 文本</span>
                                                <textarea id="prepare-app-jd-text" rows="5" placeholder="请直接粘贴岗位 JD 原文。">${escapeHTML(prepareState.appSupplement.jdText||'')}</textarea>
                                                <em>至少 ${PREP_MIN_JD_LENGTH} 个字，避免 AI 只靠公司名和岗位名猜。</em>
                                            </label>
                                        `:''}
                                        <label class="prepare-field">
                                            <span>选择已有简历</span>
                                            <select id="prepare-app-resume-select">
                                                <option value="">暂不绑定</option>
                                                ${store.resumes.map(resume=>`<option value="${resume.id}" ${prepareState.appSupplement.resumeId===resume.id?'selected':''}>${escapeHTML(resume.file_name)}</option>`).join('')}
                                            </select>
                                        </label>
                                        <label class="prepare-field prepare-upload-field">
                                            <span>附简历文件</span>
                                            <input type="file" id="prepare-app-file" accept=".pdf,.doc,.docx,.txt,.md">
                                            <em id="prepare-app-file-meta">${escapeHTML(getPrepareResumeMetaText(prepareState.appSupplementFile,prepareState.appSupplementParse,'上传后会先读取正文，读不到不会开始分析。'))}</em>
                                        </label>
                                        <label class="prepare-field prepare-field-full">
                                            <span>简历摘要</span>
                                            <textarea id="prepare-app-resume-text" rows="4" placeholder="补几段你最希望面试里被用到的经历、结果和项目线索。">${escapeHTML(prepareState.appSupplement.resumeText||'')}</textarea>
                                        </label>
                                        ${renderPrepareResumePreviewCard(appResumePreview,{
                                            title:'当前会用于分析的简历内容',
                                            hint:'上传 PDF / DOCX 后会优先展示解析出来的正文；如果只有摘要，这里也会明确告诉你。'
                                        })}
                                        ${missingMessages.length?`
                                            <div class="prepare-inline-notice prepare-field-full">${escapeHTML(missingMessages.join('；'))}</div>
                                        `:'<div class="prepare-inline-notice is-success prepare-field-full">JD 和简历上下文都已就位，可以直接进入分析结果。</div>'}
                                    `:''}
                                </div>
                                <div class="prepare-entry-actions">
                                    <button type="button" class="btn-primary" id="prepare-create-from-app">开始分析</button>
                                </div>
                            </div>
                            <div class="prepare-entry-card prepare-entry-card-immersive${prepareState.mode==='manual'?' is-visible':''}" id="prepare-manual-panel">
                                <div class="prepare-section-kicker">新建准备工作台</div>
                                <h3>把这次分析要用到的岗位信息一次补完整</h3>
                                <p>填完后会直接进入独立的结果工作台。</p>
                                <div class="prepare-form-grid prepare-form-grid-wide">
                                    <label class="prepare-field">
                                        <span>公司名</span>
                                        <input type="text" id="prepare-manual-company" placeholder="例如：字节跳动" value="${escapeHTML(prepareState.manualDraft.companyName||'')}">
                                    </label>
                                    <label class="prepare-field">
                                        <span>岗位名</span>
                                        <input type="text" id="prepare-manual-role" placeholder="例如：产品经理" value="${escapeHTML(prepareState.manualDraft.roleName||'')}">
                                    </label>
                                    <label class="prepare-field prepare-field-full">
                                        <span>JD 链接</span>
                                        <div class="prepare-jd-url-row">
                                            <input type="url" id="prepare-manual-jd-url" placeholder="https://..." value="${escapeHTML(prepareState.manualDraft.jdUrl||'')}">
                                            <button type="button" class="btn-secondary btn-sm" id="prepare-manual-read-jd">${prepareState.jdReaderLoadingKey==='manual'?'读取中':'读取JD'}</button>
                                        </div>
                                        <em>支持先填链接自动读取；如果网站限制读取，再手动粘贴 JD 原文。</em>
                                    </label>
                                    <label class="prepare-field prepare-field-full">
                                        <span>JD 文本</span>
                                        <textarea id="prepare-manual-jd" rows="5" placeholder="把职位描述直接贴进来，越完整越好。">${escapeHTML(prepareState.manualDraft.jdText||'')}</textarea>
                                    </label>
                                    <label class="prepare-field">
                                        <span>选择已有简历（可选）</span>
                                        <select id="prepare-manual-resume">
                                            <option value="">不绑定现有简历</option>
                                            ${store.resumes.map(resume=>`<option value="${resume.id}" ${prepareState.manualDraft.resumeId===resume.id?'selected':''}>${escapeHTML(resume.file_name)}</option>`).join('')}
                                        </select>
                                    </label>
                                    <label class="prepare-field prepare-upload-field">
                                        <span>附简历文件（可选）</span>
                                        <input type="file" id="prepare-manual-file" accept=".pdf,.doc,.docx,.txt,.md">
                                        <em id="prepare-manual-file-meta">${escapeHTML(getPrepareResumeMetaText(prepareState.manualResumeFile,prepareState.manualResumeParse,'上传后会先读取正文，读不到不会开始分析。'))}</em>
                                    </label>
                                    <label class="prepare-field prepare-field-full">
                                        <span>简历摘要（可选）</span>
                                        <textarea id="prepare-manual-resume-text" rows="4" placeholder="把你最希望 AI 用到的经历、成果、项目线索贴进来。">${escapeHTML(prepareState.manualDraft.resumeText||'')}</textarea>
                                    </label>
                                    ${renderPrepareResumePreviewCard(manualResumePreview,{
                                        title:'当前会用于分析的简历内容',
                                        hint:'这里会实时展示解析出的正文或你手动补的摘要，开始分析前先确认它读全了。'
                                    })}
                                </div>
                                <div class="prepare-entry-actions">
                                    <button type="button" class="btn-primary" id="prepare-create-manual">开始分析</button>
                                </div>
                            </div>
                        `}
                    </div>
                    <aside class="prepare-compose-side">
                        <div class="prepare-card-surface prepare-recent-card prepare-recent-card-compact">
                            <div class="prepare-section-kicker">最近会话</div>
                            <div class="prepare-recent-list prepare-recent-list-compact">
                                ${sessions.length?sessions.slice(0,PREPARE_SESSION_HISTORY_LIMIT).map(session=>`
                                    <button type="button" class="prepare-recent-item${prepareState.screen==='workspace'&&prepareState.selectedSessionId===session.id?' is-active':''}" data-prepare-session="${session.id}">
                                        <div>
                                            <strong>${escapeHTML(session.company_name||'目标公司')} · ${escapeHTML(session.role_name||'目标岗位')}</strong>
                                            <span>${escapeHTML(session.source_type==='application'?'来自已投递岗位':'准备会话')} · ${fmtDT(session.updated_at||session.created_at)}</span>
                                        </div>
                                        <em>${escapeHTML(getPrepareSessionStatusLabel(session))}</em>
                                    </button>
                                `).join(''):`
                                    <div class="prepare-recent-empty">
                                        <strong>还没有准备会话</strong>
                                        <span>先选一个岗位，或新建一套准备。</span>
                                    </div>
                                `}
                            </div>
                        </div>
                    </aside>
                </div>
            </section>
        </div>
    `;
    }catch(error){
        console.warn('prepare root render failed',error);
        if(showWorkspace&&selectedSession){
            try{
                root.innerHTML=`
                    <div class="prepare-shell prepare-shell-workspace-view">
                        <section class="prepare-workspace-screen">
                            ${renderPrepareWorkbenchFallback(selectedSession)}
                        </section>
                    </div>
                `;
            }catch(fallbackError){
                console.warn('prepare root fallback render failed',fallbackError);
                root.innerHTML=`
                    <div class="prepare-shell prepare-shell-workspace-view">
                        <section class="prepare-workspace-screen">
                            <div class="prepare-state-panel is-error">
                                <div class="prepare-section-kicker">当前会话打开失败</div>
                                <h3>这条准备会话还没有完全恢复</h3>
                                <p>请直接点右上角“重新生成”，我会用现有 JD、简历和补充经历把它重建成新版工作台。</p>
                            </div>
                        </section>
                    </div>
                `;
            }
        }else{
            root.innerHTML=`
                <div class="prepare-shell prepare-shell-workspace-view">
                    <section class="prepare-workspace-screen">
                        <div class="prepare-state-panel is-error">
                            <div class="prepare-section-kicker">准备页打开失败</div>
                            <h3>请回到新建分析后再试一次</h3>
                        </div>
                    </section>
                </div>
            `;
        }
    }
    syncPrepareLoadingTicker();
    $('#prepare-banner-upgrade')?.addEventListener('click',function(){
        openPrepareUpgradeModal({account:window.rtReadCachedAccount&&window.rtReadCachedAccount()||null});
    });
    $('#prepare-banner-register')?.addEventListener('click',function(){
        if(typeof window.rtStartUpgradeRegistration==='function')window.rtStartUpgradeRegistration();
    });
    $$('[data-prepare-enter-mode]').forEach(button=>button.addEventListener('click',function(){
        prepareState.mode=this.dataset.prepareEnterMode||'application';
        prepareState.composeStep='details';
        renderPrepare();
    }));
    $('#prepare-compose-back-step')?.addEventListener('click',function(){
        prepareState.composeStep='entry';
        renderPrepare();
    });
    $$('.prepare-mode-btn').forEach(button=>button.addEventListener('click',function(){
        prepareState.mode=this.dataset.prepareMode||'application';
        prepareState.composeStep='details';
        renderPrepare();
    }));
    $('#prepare-application-select')?.addEventListener('change',function(){
        syncPrepareApplicationDraft(this.value||'');
        renderPrepare();
    });
    $('#prepare-app-jd-text')?.addEventListener('input',function(){
        prepareState.appSupplement.jdText=this.value;
    });
    $('#prepare-app-jd-url')?.addEventListener('input',function(){
        prepareState.appSupplement.jdUrl=this.value;
    });
    $('#prepare-app-read-jd')?.addEventListener('click',async function(){
        const url=$('#prepare-app-jd-url')?.value||prepareState.appSupplement.jdUrl||'';
        prepareState.appSupplement.jdUrl=url;
        prepareState.jdReaderLoadingKey='app';
        prepareState.jdReaderError='';
        renderPrepare();
        try{
            const text=await readPrepareJdFromUrl(url);
            prepareState.appSupplement.jdText=text;
            toast('已读取 JD，并填入本次准备。','success');
        }catch(error){
            prepareState.jdReaderError=error instanceof Error?error.message:String(error);
            toast(prepareState.jdReaderError,'error');
        }finally{
            prepareState.jdReaderLoadingKey='';
            renderPrepare();
        }
    });
    $('#prepare-app-resume-select')?.addEventListener('change',function(){
        prepareState.appSupplement.resumeId=this.value||'';
        renderPrepare();
    });
    $('#prepare-app-resume-text')?.addEventListener('input',function(){
        prepareState.appSupplement.resumeText=this.value;
    });
    $('#prepare-app-file')?.addEventListener('change',function(){
        prepareState.appSupplementFile=this.files&&this.files[0]?this.files[0]:null;
        setPrepareResumeParseState('application',{status:'idle',text:'',message:''});
        refreshPrepareResumeMetaLabel('application');
        if(prepareState.appSupplementFile)void warmPrepareResumeFileParse('application',prepareState.appSupplementFile);
    });
    $('#prepare-create-from-app')?.addEventListener('click',async function(){
        const appId=$('#prepare-application-select')?.value||'';
        if(!appId){
            toast('先选一条已投递岗位。','error');
            return;
        }
        await withButtonBusy(this,async function(){
            const session=await createPrepareSessionFromApp(appId);
            if(session?.outputs){
                renderPrepare();
                toast('准备工作台已生成','success');
            }
        },'生成中...');
    });
    $('#prepare-manual-file')?.addEventListener('change',function(){
        prepareState.manualResumeFile=this.files&&this.files[0]?this.files[0]:null;
        setPrepareResumeParseState('manual',{status:'idle',text:'',message:''});
        refreshPrepareResumeMetaLabel('manual');
        if(prepareState.manualResumeFile)void warmPrepareResumeFileParse('manual',prepareState.manualResumeFile);
    });
    $('#prepare-manual-company')?.addEventListener('input',function(){
        prepareState.manualDraft.companyName=this.value;
    });
    $('#prepare-manual-role')?.addEventListener('input',function(){
        prepareState.manualDraft.roleName=this.value;
    });
    $('#prepare-manual-jd-url')?.addEventListener('input',function(){
        prepareState.manualDraft.jdUrl=this.value;
    });
    $('#prepare-manual-read-jd')?.addEventListener('click',async function(){
        const url=$('#prepare-manual-jd-url')?.value||prepareState.manualDraft.jdUrl||'';
        prepareState.manualDraft.jdUrl=url;
        prepareState.jdReaderLoadingKey='manual';
        prepareState.jdReaderError='';
        renderPrepare();
        try{
            const text=await readPrepareJdFromUrl(url);
            prepareState.manualDraft.jdText=text;
            toast('已读取 JD，并填入本次准备。','success');
        }catch(error){
            prepareState.jdReaderError=error instanceof Error?error.message:String(error);
            toast(prepareState.jdReaderError,'error');
        }finally{
            prepareState.jdReaderLoadingKey='';
            renderPrepare();
        }
    });
    $('#prepare-manual-jd')?.addEventListener('input',function(){
        prepareState.manualDraft.jdText=this.value;
    });
    $('#prepare-manual-resume')?.addEventListener('change',function(){
        prepareState.manualDraft.resumeId=this.value||'';
        renderPrepare();
    });
    $('#prepare-manual-resume-text')?.addEventListener('input',function(){
        prepareState.manualDraft.resumeText=this.value;
    });
    $('#prepare-create-manual')?.addEventListener('click',async function(){
        await withButtonBusy(this,async function(){
            const session=await createManualPrepareSession();
            if(session?.outputs){
                renderPrepare();
                toast('准备工作台已生成','success');
            }
        },'生成中...');
    });
    $$('[data-prepare-session]').forEach(button=>button.addEventListener('click',function(){
        resetPrepareWorkspaceState(this.dataset.prepareSession);
        prepareState.sessionError=store.getPrepareSession(this.dataset.prepareSession)?.error_message||'';
        prepareState.screen='workspace';
        renderPrepare();
    }));
    $('#prepare-back-compose')?.addEventListener('click',function(){
        prepareState.screen='compose';
        prepareState.composeStep='entry';
        prepareState.showResumePreview=false;
        prepareState.showJdPreview=false;
        prepareState.showSupplementModal=false;
        renderPrepare();
    });
    $('#prepare-start-new')?.addEventListener('click',function(){
        prepareState.screen='compose';
        prepareState.composeStep='entry';
        resetPrepareWorkspaceState('');
        renderPrepare();
    });
    $('#prepare-open-resume-preview')?.addEventListener('click',function(){
        prepareState.showResumePreview=true;
        prepareState.showJdPreview=false;
        renderPrepare();
    });
    $('#prepare-close-resume-preview')?.addEventListener('click',function(){
        prepareState.showResumePreview=false;
        renderPrepare();
    });
    $('#prepare-resume-overlay')?.addEventListener('click',function(event){
        if(event.target===this){
            prepareState.showResumePreview=false;
            renderPrepare();
        }
    });
    $('#prepare-open-jd-preview')?.addEventListener('click',function(){
        prepareState.showJdPreview=true;
        prepareState.showResumePreview=false;
        renderPrepare();
    });
    $('#prepare-close-jd-preview')?.addEventListener('click',function(){
        prepareState.showJdPreview=false;
        renderPrepare();
    });
    $('#prepare-jd-overlay')?.addEventListener('click',function(event){
        if(event.target===this){
            prepareState.showJdPreview=false;
            renderPrepare();
        }
    });
    $$('[data-prepare-tab]').forEach(button=>button.addEventListener('click',function(){
        const nextTab=this.dataset.prepareTab||'research';
        prepareState.activeTab=nextTab;
        if(nextTab==='mock'){
            const session=getPrepareSelectedSession();
            if(session&&hasPrepareMockProgress(session))prepareMockState.showResumeGate=true;
        }
        if(prepareState.activeTab==='questions')prepareState.questionPane='list';
        prepareState.showSupplementModal=false;
        prepareState.showJdPreview=false;
        renderPrepare();
    }));
    $$('[data-prepare-open-supplement]').forEach(button=>button.addEventListener('click',function(){
        prepareState.showSupplementModal=true;
        renderPrepare();
    }));
    $('#prepare-supplement-close')?.addEventListener('click',function(){
        prepareState.showSupplementModal=false;
        renderPrepare();
    });
    $('#prepare-supplement-done')?.addEventListener('click',function(){
        prepareState.showSupplementModal=false;
        renderPrepare();
    });
    $('#prepare-supplement-overlay')?.addEventListener('click',function(event){
        if(event.target===event.currentTarget){
            prepareState.showSupplementModal=false;
            renderPrepare();
        }
    });
    $$('[data-prepare-company-mode]').forEach(button=>button.addEventListener('click',function(){
        prepareState.companyOverviewMode=this.dataset.prepareCompanyMode==='detailed'?'detailed':'simple';
        renderPrepare();
    }));
    $$('[data-prepare-question]').forEach(button=>button.addEventListener('click',function(){
        prepareState.selectedQuestionId=this.dataset.prepareQuestion;
        const session=getPrepareSelectedSession();
        const question=session?getPrepareAllQuestions(session).find(item=>item.id===this.dataset.prepareQuestion):null;
        prepareState.selectedFramework=getPrepareQuestionDefaultFramework(question);
        prepareState.activeTab='questions';
        prepareState.questionPane='answer';
        renderPrepare();
        if(session&&question&&normalizePrepareQuestionRecord(question).question_type!=='reverse_question'){
            ensurePrepareAnswer(session.id,prepareState.selectedQuestionId,prepareState.selectedFramework||'PREP');
        }
    }));
    $$('[data-prepare-question-group]').forEach(button=>button.addEventListener('click',function(){
        const session=getPrepareSelectedSession();
        if(!session)return;
        const groupIndex=Number(this.dataset.prepareQuestionGroup);
        if(Number.isNaN(groupIndex))return;
        const groups=getPrepareQuestionGroups(session);
        const group=groups[groupIndex];
        if(!group)return;
        withButtonBusy(this,async function(){
            prepareState.questionGroupLoadingKey=String(groupIndex);
            renderPrepare();
            try{
                const output=await requestPrepareQuestionGroupAI(session,group);
                const current=store.getPrepareSession(session.id);
                if(!current||!current.outputs)return;
                const nextGroups=cloneData(current.outputs.questions?.question_groups||[]);
                const normalizedOutputQuestions=(output?.questions||[]).map(function(item,index){
                    return normalizePrepareQuestionRecord(Object.assign({},item,{
                        id:item?.id||`${group.group_name.replace(/\s+/g,'_').toLowerCase()}_${index+1}_${Date.now().toString(36)}`,
                        question_type:item?.question_type||group.questions?.[0]?.question_type||'case',
                        source:item?.source||group.questions?.[0]?.source||'jd',
                        importance:item?.importance||'medium'
                    }));
                });
                const targetIndex=nextGroups[groupIndex]?groupIndex:nextGroups.findIndex(function(item){
                    return item.group_name===group.group_name;
                });
                if(targetIndex>=0){
                    nextGroups[targetIndex]=Object.assign({},nextGroups[targetIndex],{
                        group_name:output?.group_name||group.group_name,
                        questions:normalizedOutputQuestions
                    });
                }
                const nextOutputs=Object.assign({},current.outputs,{
                    questions:Object.assign({},current.outputs.questions||{},{question_groups:nextGroups})
                });
                await store.updatePrepareSession(session.id,{outputs:nextOutputs});
                prepareState.questionGroupLoadingKey='';
                prepareState.selectedQuestionId=null;
                prepareState.questionPane='list';
                prepareState.activeTab='questions';
                prepareState.selectedFramework='';
                renderPrepare();
                toast('已重新生成 3 道问题','success');
            }catch(error){
                prepareState.questionGroupLoadingKey='';
                renderPrepare();
                toast(error instanceof Error?error.message:String(error),'error');
            }
        },'生成中...');
    }));
    $('#prepare-custom-question-input')?.addEventListener('input',function(){
        prepareState.freeQuestionText=this.value;
    });
    $('#prepare-custom-question-generate')?.addEventListener('click',function(){
        const session=getPrepareSelectedSession();
        if(!session)return;
        const text=normalizePrepareText(prepareState.freeQuestionText);
        if(!text){
            toast('先输入你想追问的问题。','error');
            return;
        }
        withButtonBusy(this,async function(){
            prepareState.selectedQuestionId=null;
            prepareState.selectedFramework='FREE';
            prepareState.questionPane='answer';
            prepareState.activeTab='questions';
            renderPrepare();
            await ensurePrepareFreeAnswer(session.id);
        },'生成中...');
    });
    $('#prepare-custom-question-clear')?.addEventListener('click',function(){
        prepareState.freeQuestionText='';
        renderPrepare();
    });
    $$('[data-prepare-framework]').forEach(button=>button.addEventListener('click',function(){
        prepareState.selectedFramework=this.dataset.prepareFramework||'PREP';
        renderPrepare();
        const session=getPrepareSelectedSession();
        const questionId=prepareState.selectedQuestionId;
        if(session&&prepareState.selectedFramework==='FREE')return;
        if(session&&questionId){
            const question=getPrepareAllQuestions(session).find(item=>item.id===questionId);
            if(question&&normalizePrepareQuestionRecord(question).question_type==='reverse_question')return;
            ensurePrepareAnswer(session.id,questionId,prepareState.selectedFramework);
        }
    }));
    $('#prepare-free-question')?.addEventListener('input',function(){
        prepareState.freeQuestionText=this.value;
    });
    $('#prepare-generate-free-answer')?.addEventListener('click',function(){
        const session=getPrepareSelectedSession();
        if(session)withButtonBusy(this,async()=>{await ensurePrepareFreeAnswer(session.id);},'生成中...');
    });
    $('#prepare-regenerate-free-answer')?.addEventListener('click',function(){
        const session=getPrepareSelectedSession();
        if(session)withButtonBusy(this,async()=>{await regeneratePrepareFreeAnswer(session.id);},'生成中...');
    });
    $('#prepare-regenerate-answer')?.addEventListener('click',function(){
        const session=getPrepareSelectedSession();
        const questionId=prepareState.selectedQuestionId;
        if(!session||!questionId)return;
        const question=getPrepareAllQuestions(session).find(item=>item.id===questionId);
        if(!question)return;
        withButtonBusy(this,async()=>{await regeneratePrepareAnswer(session.id,question,prepareState.selectedFramework||getPrepareQuestionDefaultFramework(question));},'生成中...');
    });
    $('#prepare-answer-back')?.addEventListener('click',function(){
        prepareState.questionPane='list';
        prepareState.selectedQuestionId=null;
        prepareState.selectedFramework='STAR';
        prepareState.showSupplementModal=false;
        prepareState.showJdPreview=false;
        renderPrepare();
    });
    $('#prepare-shell-back-to-questions')?.addEventListener('click',function(){
        prepareState.questionPane='list';
        prepareState.selectedQuestionId=null;
        prepareState.selectedFramework='STAR';
        prepareState.showSupplementModal=false;
        prepareState.showJdPreview=false;
        renderPrepare();
    });
    $('#prepare-regenerate')?.addEventListener('click',function(){
        const session=getPrepareSelectedSession();
        if(session)withButtonBusy(this,async()=>{prepareState.questionPane='list';await regeneratePrepareSession(session.id);},'生成中...');
    });
    $('#prepare-open-app')?.addEventListener('click',function(){
        const session=getPrepareSelectedSession();
        const app=session&&session.application_id?store.getApp(session.application_id):null;
        if(app){
            switchView('table');
            openDrawer(app.id);
        }
    });
    $('#prepare-copy-outline')?.addEventListener('click',async function(){
        const session=getPrepareSelectedSession();
        if(!session)return;
        const framework=prepareState.selectedFramework||'STAR';
        const question=framework==='FREE'?null:getPrepareSelectedQuestion(session,{fallback:false});
        const cacheKey=framework==='FREE'?getPrepareFreeQuestionKey(prepareState.freeQuestionText):question?.id;
        const answer=cacheKey?session.outputs?.answer_cache?.[cacheKey]?.[framework]:null;
        if(!answer){
            toast('先生成回答骨架。','info');
            return;
        }
        try{
            await navigator.clipboard.writeText(answer.copyable_outline);
            toast('已复制回答','success');
        }catch(err){
            toast('复制失败，请手动复制','error');
        }
    });
    $('#prepare-supplemental-input-global')?.addEventListener('input',function(){
        prepareState.supplementalExperienceDraft=this.value;
    });
    $('#prepare-supplemental-add-global')?.addEventListener('click',async function(){
        const session=getPrepareSelectedSession();
        if(!session)return;
        const text=normalizePrepareText(prepareState.supplementalExperienceDraft);
        if(!text){
            toast('先补一段经历。','error');
            return;
        }
        const ok=await addPrepareSupplementalExperience(session.id,text,{
            question_id:prepareState.selectedQuestionId||'',
            source:'manual'
        });
        if(ok===false)return;
        prepareState.supplementalExperienceDraft='';
        renderPrepare();
        toast('已纳入本次生成','success');
    });
    $$('[data-prepare-supplement-remove]').forEach(button=>button.addEventListener('click',async function(){
        const session=getPrepareSelectedSession();
        if(!session)return;
        const experienceId=this.dataset.prepareSupplementRemove;
        if(!experienceId)return;
        const ok=await removePrepareSupplementalExperience(session.id,experienceId);
        if(ok===false)return;
        renderPrepare();
    }));
    const mockSession=getPrepareSelectedSession();
    if(mockSession&&prepareState.activeTab==='mock'){
        const mockQuestion=getCurrentPrepareMockQuestion();
        const linkedApp=mockSession.application_id?store.getApp(mockSession.application_id):null;
        const resolvedAppId=linkedApp?.id||mockSession.application_id||null;
        $('#prepare-mock-resume')?.addEventListener('click',function(){
            prepareMockState.showResumeGate=false;
            renderPrepare();
        });
        $('#prepare-mock-new-round')?.addEventListener('click',function(){
            resetPrepareMockInterviewState(mockSession);
            renderPrepare();
        });
        $('#prepare-mock-open-setup')?.addEventListener('click',function(){
            prepareMockState.showResumeGate=false;
            prepareMockState.stage='setup';
            renderPrepare();
        });
        $('#prepare-mock-restart')?.addEventListener('click',function(){
            if(prepareMockState.stage==='setup'){
                resetPrepareMockInterviewState(mockSession);
            }else{
                startPrepareMockInterview(mockSession);
            }
            renderPrepare();
        });
        $('#prepare-mock-back-setup')?.addEventListener('click',function(){
            prepareMockState.showResumeGate=false;
            prepareMockState.stage='setup';
            prepareMockState.currentIndex=0;
            prepareMockState.currentAnswer='';
            prepareMockState.currentFeedback=null;
            prepareMockState.finalFeedback=null;
            prepareMockState.error='';
            renderPrepare();
        });
        $('#prepare-mock-start')?.addEventListener('click',function(){
            if(prepareMockState.questionMode==='custom'&&!prepareMockState.customQuestions.length){
                toast('先添加至少 1 个问题。','error');
                return;
            }
            startPrepareMockInterview(mockSession);
            renderPrepare();
        });
        $$('[data-prepare-mock-mode-choice]').forEach(button=>button.addEventListener('click',function(){
            prepareMockState.questionMode=this.dataset.prepareMockModeChoice==='custom'?'custom':'generated';
            if(prepareMockState.questionMode!=='custom'){
                prepareMockState.customQuestions=[];
                prepareMockState.customQuestionDraft='';
            }
            renderPrepare();
        }));
        $$('[data-prepare-mock-feedback-mode]').forEach(button=>button.addEventListener('click',function(){
            prepareMockState.feedbackMode=this.dataset.prepareMockFeedbackMode==='end'?'end':'per_question';
            renderPrepare();
        }));
        $('#prepare-mock-custom-question-input')?.addEventListener('input',function(){
            prepareMockState.customQuestionDraft=this.value;
        });
        $('#prepare-mock-add-custom-question')?.addEventListener('click',function(){
            const text=normalizePrepareText(prepareMockState.customQuestionDraft);
            if(!text){
                toast('先输入一个问题。','error');
                return;
            }
            prepareMockState.customQuestions=[...prepareMockState.customQuestions,{id:createLocalId('mock_custom'),question:text}].slice(0,3);
            prepareMockState.customQuestionDraft='';
            prepareMockState.questions=buildPrepareMockInterviewQuestions(mockSession);
            renderPrepare();
        });
        $$('[data-prepare-mock-custom-remove]').forEach(button=>button.addEventListener('click',function(){
            const removeId=this.dataset.prepareMockCustomRemove||'';
            if(!removeId)return;
            prepareMockState.customQuestions=prepareMockState.customQuestions.filter(function(item){
                return item?.id!==removeId;
            });
            prepareMockState.questions=buildPrepareMockInterviewQuestions(mockSession);
            renderPrepare();
        }));
        $('#prepare-mock-next')?.addEventListener('click',function(){
            if(prepareMockState.currentIndex<prepareMockState.questions.length){
                prepareMockState.currentIndex++;
                prepareMockState.currentAnswer='';
                prepareMockState.currentFeedback=null;
                prepareMockState.error='';
                renderPrepare();
            }
        });
        $$('.mode-btn[data-prepare-mock-mode]').forEach(button=>button.addEventListener('click',function(){
            prepareMockState.transcriptMode=this.dataset.prepareMockMode||'text';
            if(prepareMockState.transcriptMode!=='voice'&&prepareMockState.recognition){
                try{prepareMockState.recognition.stop();}catch(error){}
                prepareMockState.voiceActive=false;
            }
            renderPrepare();
        }));
        $('#prepare-mock-answer')?.addEventListener('input',function(){
            prepareMockState.currentAnswer=this.value;
        });
        $('#prepare-mock-skip')?.addEventListener('click',function(){
            if(prepareMockState.currentIndex<prepareMockState.questions.length-1){
                prepareMockState.currentIndex++;
                prepareMockState.currentAnswer='';
                prepareMockState.currentFeedback=null;
                prepareMockState.error='';
                renderPrepare();
            }else{
                prepareMockState.currentIndex=prepareMockState.questions.length;
                renderPrepare();
            }
        });
        $('#prepare-mock-submit')?.addEventListener('click',async function(){
            if(!mockSession)return;
            const question=mockQuestion;
            const answerText=normalizePrepareText(prepareMockState.currentAnswer||$('#prepare-mock-answer')?.value||'');
            if(!question){
                toast('当前没有题目可提交。','error');
                return;
            }
            if(!answerText){
                toast('先输入你的回答。','error');
                return;
            }
            prepareMockState.submitLoading=true;
            prepareMockState.error='';
            renderPrepare();
            try{
                const historyEntry={question:question.question,answer:answerText,feedback:null};
                const nextHistory=prepareMockState.history.concat(historyEntry);
                if(prepareMockState.feedbackMode==='end'){
                    prepareMockState.history=nextHistory;
                    if(prepareMockState.currentIndex>=prepareMockState.questions.length-1){
                        const summary=await requestPrepareMockSummaryAI(mockSession,nextHistory);
                        const summaryQuestionText=`模拟面试总评（${prepareMockState.questions.length} 题）`;
                        const summaryAnswerText=nextHistory.map(function(item,index){
                            return `Q${index+1}：${item.question}\nA${index+1}：${item.answer}`;
                        }).join('\n\n');
                        const summaryReviewText=summary.reflection_summary||summary.overall_feedback||'';
                        const current=store.getPrepareSession(mockSession.id);
                        if(current){
                            const savedRef={
                                app_id:resolvedAppId,
                                company_name:linkedApp?.company_name||mockSession.company_name||'',
                                position_title:linkedApp?.position_title||mockSession.role_name||'',
                                interview_round:'MOCK_INTERVIEW',
                                input_type:prepareMockState.transcriptMode==='voice'?'VOICE':'TEXT',
                                question_text:summaryQuestionText,
                                answer_text:summaryAnswerText,
                                reflection_text:summaryReviewText,
                                raw_content:`问题：${summaryQuestionText}\n\n回答：${summaryAnswerText}\n\n复盘：${summaryReviewText}`,
                                cleaned_content:`问题：${summaryQuestionText}\n\n回答：${summaryAnswerText}\n\n复盘：${summaryReviewText}`,
                                ai_extracted:summary.overall_feedback||summary.reflection_summary||'',
                                pain_points:Array.isArray(summary.pain_points)?summary.pain_points:[],
                                self_rating:typeof summary.self_rating==='number'?summary.self_rating:null
                            };
                            await store.addRef(savedRef);
                        }
                        prepareMockState.finalFeedback=summary;
                        prepareMockState.stage='summary';
                        prepareMockState.submitLoading=false;
                        prepareMockState.currentAnswer='';
                        prepareMockState.transcriptText='';
                        if(prepareMockState.recognition){
                            try{prepareMockState.recognition.stop();}catch(error){}
                            prepareMockState.voiceActive=false;
                        }
                        renderPrepare();
                        toast('整场点评已生成，并已记录到复盘','success');
                        return;
                    }
                    prepareMockState.currentIndex=Math.min(prepareMockState.currentIndex+1,prepareMockState.questions.length);
                    prepareMockState.currentAnswer='';
                    prepareMockState.currentFeedback=null;
                    prepareMockState.transcriptText='';
                    prepareMockState.submitLoading=false;
                    if(prepareMockState.recognition){
                        try{prepareMockState.recognition.stop();}catch(error){}
                        prepareMockState.voiceActive=false;
                    }
                    renderPrepare();
                    toast('答案已记录，继续下一题','success');
                    return;
                }
                const feedback=await requestPrepareMockFeedbackAI(mockSession,question,answerText,prepareMockState.history);
                const current=store.getPrepareSession(mockSession.id);
                if(current){
                    const savedRef={
                        app_id:resolvedAppId,
                        company_name:linkedApp?.company_name||mockSession.company_name||'',
                        position_title:linkedApp?.position_title||mockSession.role_name||'',
                        interview_round:'MOCK_INTERVIEW',
                        input_type:prepareMockState.transcriptMode==='voice'?'VOICE':'TEXT',
                        question_text:question.question,
                        answer_text:answerText,
                        reflection_text:feedback.reflection_summary||feedback.overall_feedback||'',
                        raw_content:`问题：${question.question}\n\n回答：${answerText}\n\n复盘：${feedback.reflection_summary||feedback.overall_feedback||''}`,
                        cleaned_content:`问题：${question.question}\n\n回答：${answerText}\n\n复盘：${feedback.reflection_summary||feedback.overall_feedback||''}`,
                        ai_extracted:feedback.overall_feedback||feedback.reflection_summary||'',
                        pain_points:Array.isArray(feedback.pain_points)?feedback.pain_points:[],
                        self_rating:typeof feedback.self_rating==='number'?feedback.self_rating:null
                    };
                    await store.addRef(savedRef);
                }
                prepareMockState.history.push({question:question.question,answer:answerText,feedback});
                prepareMockState.currentFeedback=feedback;
                prepareMockState.currentAnswer='';
                prepareMockState.currentIndex=Math.min(prepareMockState.currentIndex+1,prepareMockState.questions.length);
                prepareMockState.transcriptText='';
                prepareMockState.submitLoading=false;
                if(prepareMockState.recognition){
                    try{prepareMockState.recognition.stop();}catch(error){}
                    prepareMockState.voiceActive=false;
                }
                renderPrepare();
                toast('点评已生成，并已记录到复盘','success');
            }catch(error){
                prepareMockState.submitLoading=false;
                prepareMockState.error=error instanceof Error?error.message:String(error);
                renderPrepare();
                toast(prepareMockState.error,'error');
            }
        });
        const recordBtn=$('#prepare-mock-record-btn');
        if(recordBtn){
            recordBtn.addEventListener('click',function(){
                if(!PREPARE_SPEECH_RECOGNITION_CTOR){
                    toast('当前浏览器不支持语音转文字，请改用文本输入','error');
                    return;
                }
                if(!prepareMockState.recognition){
                    const recognition=new PREPARE_SPEECH_RECOGNITION_CTOR();
                    recognition.lang='zh-CN';
                    recognition.continuous=true;
                    recognition.interimResults=true;
                    recognition.onresult=function(event){
                        let interim='';
                        for(let i=event.resultIndex;i<event.results.length;i++){
                            const transcript=(event.results[i][0]&&event.results[i][0].transcript)||'';
                            if(event.results[i].isFinal)prepareMockState.transcriptText+=(transcript||'');
                            else interim+=transcript;
                        }
                        const combined=(prepareMockState.transcriptText+interim).trim();
                        prepareMockState.currentAnswer=combined;
                        const textarea=$('#prepare-mock-answer');
                        if(textarea)textarea.value=combined;
                        renderPrepare();
                    };
                    recognition.onend=function(){
                        prepareMockState.voiceActive=false;
                        if(prepareMockState.recorderTimer){
                            clearInterval(prepareMockState.recorderTimer);
                            prepareMockState.recorderTimer=null;
                        }
                        renderPrepare();
                    };
                    recognition.onerror=function(event){
                        prepareMockState.voiceActive=false;
                        if(prepareMockState.recorderTimer){
                            clearInterval(prepareMockState.recorderTimer);
                            prepareMockState.recorderTimer=null;
                        }
                        if(event&&event.error!=='no-speech')toast('语音转文字暂时不可用，请改用文本输入','error');
                        renderPrepare();
                    };
                    prepareMockState.recognition=recognition;
                }
                if(prepareMockState.voiceActive){
                    try{prepareMockState.recognition.stop();}catch(error){}
                    return;
                }
                try{
                    prepareMockState.transcriptText='';
                    prepareMockState.recorderSeconds=0;
                    prepareMockState.currentAnswer='';
                    const textarea=$('#prepare-mock-answer');
                    if(textarea)textarea.value='';
                    prepareMockState.recognition.start();
                    prepareMockState.voiceActive=true;
                    if(prepareMockState.recorderTimer)clearInterval(prepareMockState.recorderTimer);
                    prepareMockState.recorderTimer=setInterval(function(){
                        prepareMockState.recorderSeconds++;
                        renderPrepare();
                    },1000);
                    renderPrepare();
                }catch(error){
                    prepareMockState.voiceActive=false;
                    toast('无法启动语音转文字，请检查麦克风权限','error');
                }
            });
        }
    }
}
function animateSharedViewSwitch(targetView){
    const shell=(targetView==='pipeline'||targetView==='table')?$(`#view-${targetView}`):null;
    if(!shell)return;
    const token=String(Date.now());
    viewModeTransitionToken+=1;
    const currentToken=viewModeTransitionToken;
    shell.dataset.sharedTransitionToken=token;
    shell.classList.remove('view-shared-enter');
    void shell.offsetWidth;
    shell.classList.add('view-shared-enter');
    window.setTimeout(function(){
        if(currentToken!==viewModeTransitionToken)return;
        shell.classList.remove('view-shared-enter');
        delete shell.dataset.sharedTransitionToken;
    },220);
}
function canRunViewTransition(){
    if(!document.startViewTransition)return false;
    return !(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function switchView(v){
    const previousView=curView;
    const applyView=function(){
        curView=v;$$('.view').forEach(x=>x.classList.remove('active'));$$('.nav-item[data-view]').forEach(x=>x.classList.remove('active'));
        const vm={pipeline:'view-pipeline',table:'view-table',resumes:'view-resumes',jobs:'view-jobs',prepare:'view-prepare',reflections:'view-reflections',calendar:'view-calendar',analytics:'view-analytics'};
        const tm={pipeline:'投递',table:'投递',resumes:'简历文件舱',jobs:'职位发现',prepare:'面试准备',reflections:'复盘记录',calendar:'日历',analytics:'数据大屏'};
        const navView=(v==='pipeline'||v==='table')?'table':v;
        $(`#${vm[v]}`)?.classList.add('active');$(`.nav-item[data-view="${navView}"]`)?.classList.add('active');
        $('#view-title').textContent=tm[v]||'';
        $('#view-subtitle').textContent=(v==='pipeline'||v==='table')?`${store.apps.length} 条投递`:'';
        renderViewModeSwitcher(v);
        if(v==='pipeline')renderKanban();else if(v==='table')renderTable();else if(v==='resumes')renderResumes();else if(v==='jobs')renderJobsView();else if(v==='prepare')renderPrepare();else if(v==='reflections')renderRefs();else if(v==='calendar'&&typeof renderCalendar==='function')renderCalendar();else if(v==='analytics')renderAnalytics();
        if((previousView==='pipeline'||previousView==='table')&&(v==='pipeline'||v==='table')&&previousView!==v){
            animateSharedViewSwitch(v);
        }
        if(window.rtAnalytics&&typeof window.rtAnalytics.capture==='function'){
            window.rtAnalytics.capture('rt_view_changed',getAnalyticsBaseProps({
                view:v,
                application_count:store.apps.length,
                resume_count:store.resumes.length,
                reflection_count:store.refs.length
            }));
        }
    };
    if(previousView!==v&&canRunViewTransition()){
        document.startViewTransition(applyView);
    }else{
        applyView();
    }
}
function renderViewModeSwitcher(view){
    const root=$('#view-mode-switcher');
    if(!root)return;
    if(view!=='table'&&view!=='pipeline'){
        root.innerHTML='';
        root.style.display='none';
        return;
    }
    root.style.display='inline-flex';
    root.innerHTML=`
        <button type="button" class="view-mode-btn${view==='table'?' is-active':''}" data-switch-mode="table">表格</button>
        <button type="button" class="view-mode-btn${view==='pipeline'?' is-active':''}" data-switch-mode="pipeline">看板</button>
    `;
    $$('[data-switch-mode]').forEach(function(button){
        button.addEventListener('click',function(){
            const target=this.dataset.switchMode||'table';
            if(target!==curView)switchView(target);
        });
    });
}
$$('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
initSidebarBrand();
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
$('#toggle-intl-mode')?.addEventListener('change',async e=>{
    const ok=await setIntlMode(e.target.checked);
    if(ok===false){
        return;
    }
});
document.getElementById('profile-toggle-intl-mode')?.addEventListener('change',async e=>{
    const ok=await setIntlMode(e.target.checked);
    if(ok===false)return;
});
function updIntl(){
    $$('.intl-field').forEach(el=>el.style.display='none');
    const visaFilter=$('#filter-visa');
    if(visaFilter)visaFilter.style.display='none';
}
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
    const b=$('#kanban-board'),fc=$('#filter-category').value,ks=$('#kanban-sort').value;
    let apps=store.apps.filter(a=>{if(q&&!a.company_name.toLowerCase().includes(q)&&!a.position_title.toLowerCase().includes(q))return false;if(fc&&a.position_category!==fc)return false;return true;});
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
    let ddl='';if(a.next_deadline){const dl=daysBtw(new Date().toISOString().split('T')[0],a.next_deadline.split('T')[0]);ddl=`<div class="card-ddl ${dl<=3?'urgent':''}"><span>DDL</span><strong>${fmtD(a.next_deadline)}</strong>${a.next_action?`<em>${escapeHTML(a.next_action)}</em>`:''}</div>`;}
    const dateStr=a.applied_date?fmtD(a.applied_date):'';
    const chips=[
        a.position_category?`<span class="card-chip">${escapeHTML(a.position_category)}</span>`:'',
        a.base_location?`<span class="card-chip subtle">${escapeHTML(a.base_location)}</span>`:'',
        a.source_channel?`<span class="card-chip subtle">${escapeHTML(a.source_channel)}</span>`:''
    ].filter(Boolean).join('');
    const followup=getFollowupState(a);
    c.innerHTML=`<div class="card-top"><div class="card-info"><div class="card-company">${escapeHTML(a.company_name)}</div><div class="card-position">${escapeHTML(a.position_title)}</div></div><div class="card-chevron" aria-hidden="true">›</div></div><div class="card-chips">${chips}${followup?`<span class="card-chip followup">${escapeHTML(followup.label)}</span>`:''}</div><div class="card-meta"><span class="card-stars">${stars(a.preference_level)}</span>${dateStr?`<span class="card-date">${dateStr}</span>`:''}${w!==null?`<span class="card-wait ${wc}">${w}天</span>`:''}</div>${r?`<div class="card-resume">已关联简历 · ${escapeHTML(r.file_name)}</div>`:''}${ddl}`;
    c.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',a.id);c.classList.add('dragging');});
    c.addEventListener('dragend',()=>c.classList.remove('dragging'));
    c.addEventListener('click',()=>openDrawer(a.id));
    return c;
}
async function chgStatus(id,ns){const a=store.getApp(id);if(!a||a.status===ns)return;if(ns==='REJECTED'){openRejModal(id);return;}const ok=await store.updateApp(id,{status:ns});if(ok===false)return;if(ns==='OFFER')toast('🎉 Offer！','success');renderKanban(getBoardSearchQuery());}
let pendRej=null;
function openRejModal(id){pendRej=id;$$('#rejection-options input').forEach(i=>i.checked=false);$('#rejection-modal-overlay').classList.add('active');}
$('#rejection-confirm').addEventListener('click',async ()=>{if(!pendRej)return;const s=$('#rejection-options input:checked');if(!s){toast('请选择','error');return;}const ok=await store.updateApp(pendRej,{status:'REJECTED',_rej:s.value});if(ok===false)return;$('#rejection-modal-overlay').classList.remove('active');pendRej=null;renderKanban(getBoardSearchQuery());});
$('#rejection-modal-close').addEventListener('click',()=>{$('#rejection-modal-overlay').classList.remove('active');pendRej=null;});

// ---- 表格 ----
function renderTable(q=''){
    renderTableControlOptions();
    const cols=store.tableCols.filter(c=>c.show);
    let apps=store.apps.filter(a=>{
        if(q&&!a.company_name.toLowerCase().includes(q)&&!a.position_title.toLowerCase().includes(q))return false;
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
            renderTable(getBoardSearchQuery());
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
function inlineEdit(td,a,f,custom=false){const old=custom?(a.customFields?.[f]||''):(a[f]||'');const inp=document.createElement('input');inp.type='text';inp.className='inline-edit';inp.value=old;td.textContent='';td.appendChild(inp);inp.focus();inp.select();const sv=async ()=>{const v=inp.value.trim();if(custom){const nextFields=Object.assign({},a.customFields||{}, {[f]:v});const ok=await store.updateApp(a.id,{customFields:nextFields});if(ok===false)return renderTable(getBoardSearchQuery());}else if(v!==old){if(f==='position_category'&&v){const added=await store.addCat(v);if(!added)return renderTable(getBoardSearchQuery());}const ok=await store.updateApp(a.id,{[f]:v});if(ok===false)return renderTable(getBoardSearchQuery());}renderTable(getBoardSearchQuery());};inp.addEventListener('blur',sv);inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sv();}if(e.key==='Escape')renderTable(getBoardSearchQuery());});}
function inlineCatSel(td,a){const sel=document.createElement('select');sel.className='inline-select';const empty=document.createElement('option');empty.value='';empty.textContent='选择';sel.appendChild(empty);store.categories.forEach(function(c){const option=document.createElement('option');option.value=c;option.selected=a.position_category===c;option.textContent=c;sel.appendChild(option);});const addNew=document.createElement('option');addNew.value='__NEW__';addNew.textContent='+ 新增类别...';sel.appendChild(addNew);td.textContent='';td.appendChild(sel);sel.focus();sel.addEventListener('change',async ()=>{if(sel.value==='__NEW__'){const name=prompt('输入新类别名称：');if(name&&name.trim()){const added=await store.addCat(name.trim());if(!added)return renderTable(getBoardSearchQuery());const ok=await store.updateApp(a.id,{position_category:name.trim()});if(ok!==false)initFilters();}renderTable(getBoardSearchQuery());}else if(sel.value){const ok=await store.updateApp(a.id,{position_category:sel.value});if(ok!==false)renderTable(getBoardSearchQuery());}});sel.addEventListener('blur',()=>renderTable(getBoardSearchQuery()));}
function inlineDateEdit(td,a){const inp=document.createElement('input');inp.type='date';inp.className='inline-edit';inp.value=a.applied_date||'';td.textContent='';td.appendChild(inp);inp.focus();inp.addEventListener('blur',async ()=>{const newDate=inp.value;const updates={applied_date:newDate};if(a.timeline&&a.timeline.length){const nextTimeline=cloneData(a.timeline);const ae=nextTimeline.find(t=>t.name==='已投递');if(ae)ae.date=newDate;updates.timeline=nextTimeline;}const ok=await store.updateApp(a.id,updates);if(ok!==false)renderTable(getBoardSearchQuery());});inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}if(e.key==='Escape')renderTable(getBoardSearchQuery());});}
function inlineStatusSel(td,a){const sel=document.createElement('select');sel.className='inline-select';STATUSES.forEach(s=>{sel.innerHTML+=`<option value="${s.key}" ${s.key===a.status?'selected':''}>${s.label}</option>`;});td.innerHTML='';td.appendChild(sel);sel.focus();sel.addEventListener('change',async ()=>{await chgStatus(a.id,sel.value);renderTable(getBoardSearchQuery());});sel.addEventListener('blur',()=>renderTable(getBoardSearchQuery()));}
function prefSelect(td,a){const sel=document.createElement('select');sel.className='inline-select';PREF_OPTIONS.forEach(p=>{sel.innerHTML+=`<option value="${p.v}" ${a.preference_level==p.v?'selected':''}>${p.l}</option>`;});td.innerHTML='';td.appendChild(sel);sel.focus();sel.addEventListener('change',async ()=>{const ok=await store.updateApp(a.id,{preference_level:sel.value});if(ok!==false)renderTable(getBoardSearchQuery());});sel.addEventListener('blur',()=>renderTable(getBoardSearchQuery()));}
$('#table-group-by').addEventListener('change',()=>renderTable(getBoardSearchQuery()));
$('#table-sort-column')?.addEventListener('change',e=>{tableSortColumn=e.target.value||'created_at';renderTable(getBoardSearchQuery());});
$('#table-sort-direction')?.addEventListener('click',()=>{tableSortDirection=tableSortDirection==='asc'?'desc':'asc';renderTable(getBoardSearchQuery());});
$('#filter-category').addEventListener('change',()=>renderKanban(getBoardSearchQuery()));
$('#filter-visa')?.addEventListener('change',()=>renderKanban(getBoardSearchQuery()));
$('#kanban-sort').addEventListener('change',()=>renderKanban(getBoardSearchQuery()));
$('#kanban-sort-direction').addEventListener('click',()=>{kanbanSortDirection=kanbanSortDirection==='asc'?'desc':'asc';syncKanbanSortDirection();renderKanban(getBoardSearchQuery());});
$('#table-add-row').addEventListener('click',()=>openAppModal());
$('#table-edit-mode-btn').addEventListener('click',()=>{
    tableQuickEdit=!tableQuickEdit;
    if(!tableQuickEdit)tableSelectedRows.clear();
    syncQuickEditPanel();
    renderTable(getBoardSearchQuery());
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
function openAppModal(id=null,defSt='APPLIED'){editId=id;const a=id?store.getApp(id):null;$('#modal-title').textContent=a?'编辑投递':'新建投递';$('#form-company').value=a?.company_name||'';$('#form-position').value=a?.position_title||'';fillCatSelect($('#form-category'),a?.position_category||'');$('#form-status').value=a?.status||defSt;$('#form-status-date').value=getStatusDateForApp(a)||(a?.applied_date||new Date().toISOString().split('T')[0]);$('#form-date').value=a?.applied_date||new Date().toISOString().split('T')[0];$('#form-base').value=a?.base_location||'';$('#form-preference').value=a?.preference_level||'3';setFieldValue('#form-visa',a?.visa_requirement||HIDDEN_VISA_VALUE);$('#form-channel').value=a?.source_channel||'';$('#form-channel-link').value=a?.source_link||'';$('#form-salary').value=a?.salary_expectation||'';$('#form-next-action').value=a?.next_action||'';$('#form-deadline').value=a?.next_deadline||'';setFieldValue('#form-contact',a?.contact_name||'');setFieldValue('#form-next-followup',a?.next_followup_date||'');setFieldValue('#form-last-followup',a?.last_followup_date||'');setFieldValue('#form-followup-note',a?.followup_note||'');$('#form-jd-url').value=a?.jd_url||'';setFieldValue('#form-jd-text',a?.jd_text||'');$('#form-notes').value=a?.notes||'';jdImg=a?.jd_image||null;renderJdDropzone(jdImg);const rs=$('#form-resume');rs.textContent='';const emptyOpt=document.createElement('option');emptyOpt.value='';emptyOpt.textContent='不绑定';rs.appendChild(emptyOpt);store.resumes.forEach(r=>{const opt=document.createElement('option');opt.value=r.id;opt.selected=a?.resume_id===r.id;opt.textContent=r.file_name;rs.appendChild(opt);});
// 渲染自定义字段
const cfa=$('#custom-fields-area');cfa.innerHTML='';
const customCols=store.tableCols.filter(c=>c.custom);
if(customCols.length){customCols.forEach(col=>{const val=a?.customFields?.[col.id]||'';const group=createEl('div','form-group');group.appendChild(createEl('label','',col.label));const input=document.createElement('input');input.type='text';input.className='custom-field-input';input.dataset.colId=col.id;input.value=val;input.placeholder=`输入${col.label}...`;group.appendChild(input);cfa.appendChild(group);});}
updIntl();$('#modal-overlay').classList.add('active');}
async function saveApp(cont=false){const co=$('#form-company').value.trim(),po=$('#form-position').value.trim(),ca=$('#form-category').value;if(!co||!po||!ca){toast('请填写公司、岗位和类别','error');return;}const selectedStatus=$('#form-status').value||'APPLIED';const statusDate=$('#form-status-date').value||'';const appliedDate=$('#form-date').value;if(!appliedDate){toast('请填写投递日期','error');return;}if(selectedStatus!=='WATCHING'&&!statusDate){toast('请填写当前状态日期','error');return;}const rawSourceLink=$('#form-channel-link').value.trim();const normalizedSourceLink=rawSourceLink&&!/^https?:\/\//i.test(rawSourceLink)?('https://'+rawSourceLink):rawSourceLink;const d={company_name:co,position_title:po,position_category:ca,base_location:$('#form-base').value.trim(),applied_date:appliedDate,current_status_date:statusDate||appliedDate,resume_id:$('#form-resume').value||null,preference_level:$('#form-preference').value,visa_requirement:HIDDEN_VISA_VALUE,source_channel:$('#form-channel').value.trim(),source_link:normalizedSourceLink,salary_expectation:$('#form-salary').value,next_action:$('#form-next-action').value,next_deadline:$('#form-deadline').value,contact_name:$('#form-contact')?.value.trim()||'',next_followup_date:$('#form-next-followup')?.value||'',last_followup_date:$('#form-last-followup')?.value||'',followup_note:$('#form-followup-note')?.value.trim()||'',jd_url:$('#form-jd-url').value,jd_text:$('#form-jd-text')?.value.trim()||'',jd_image:jdImg,notes:$('#form-notes').value,status:selectedStatus};
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
$('#form-read-jd-url')?.addEventListener('click',async function(){
    const url=$('#form-jd-url')?.value||'';
    try{
        await withButtonBusy(this,async function(){
            const text=await readPrepareJdFromUrl(url);
            setFieldValue('#form-jd-text',text);
            toast('已读取 JD 正文。','success');
        },'读取中');
    }catch(error){
        toast(error instanceof Error?error.message:String(error),'error');
    }
});
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
    if((a.jd_text||'').trim()){
        const row=createEl('div','info-field');
        row.appendChild(createEl('div','info-label','JD 文本'));
        const value=createEl('div','info-value');
        value.style.whiteSpace='pre-wrap';
        value.style.lineHeight='1.7';
        value.textContent=a.jd_text;
        row.appendChild(value);
        info.appendChild(row);
    }
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
    if(curTab==='info')acts.innerHTML='<button class="btn-primary" id="d-prepare">开始准备</button><button class="btn-secondary" id="d-edit">编辑详情</button><button class="btn-danger" id="d-del">删除</button>';
    else if(curTab==='timeline')acts.innerHTML=`<button class="btn-secondary" id="d-edit">${tlEditing?'取消编辑':'编辑时间线'}</button><button class="btn-danger" id="d-del">删除</button>`;
    else acts.innerHTML='<button class="btn-primary" id="d-newref">+ 新建复盘</button><button class="btn-danger" id="d-del">删除</button>';
    $('#d-prepare')?.addEventListener('click',async ()=>{
        const app=store.getApp(curDId);
        if(!app)return;
        syncPrepareApplicationDraft(app.id);
        prepareState.mode='application';
        switchView('prepare');
        const draft=getPrepareApplicationDraft(app);
        if(draft&&(draft.requiresJd||draft.requiresResume)){
            toast('这条投递还缺关键输入。先补齐 JD 或简历信息，再生成准备工作台。','info');
            return;
        }
        const session=await createPrepareSessionFromApp(curDId);
        if(session?.outputs){
            renderPrepare();
            toast('已切到面试准备','success');
        }
    });
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
function refresh(){const q=getBoardSearchQuery();if(curView==='pipeline')renderKanban(q);else if(curView==='table')renderTable(q);else if(curView==='resumes')renderResumes();else if(curView==='jobs')renderJobsView(jobBoardState.query||'');else if(curView==='prepare')renderPrepare();else if(curView==='reflections')renderRefs();else if(curView==='calendar'&&typeof renderCalendar==='function')renderCalendar();else if(curView==='analytics')renderAnalytics();}
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
        const bytes=new Uint8Array(await selFile.arrayBuffer());
        try{
            const extractedText=await extractResumeTextFromBytes(bytes,selFile.name,selFile.type||'');
            payload.extracted_text=extractedText;
            payload.extracted_at=new Date().toISOString();
            payload.extraction_status='ready';
            payload.extraction_error='';
        }catch(error){
            payload.extracted_text='';
            payload.extracted_at=null;
            payload.extraction_status='error';
            payload.extraction_error=error instanceof Error?error.message:String(error);
            toast('文件已保存，但这份简历正文暂时没读出来。后续准备前请优先换成 PDF、DOCX、TXT 或 Markdown。','info');
        }
        payload.data_url=await readBlobAsDataUrl(new Blob([bytes],{type:selFile.type||'application/octet-stream'}));
        await persistResumeDraft(payload);
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
        const companyName=app?.company_name||ref.company_name||'';
        const positionTitle=app?.position_title||ref.position_title||'';
        const key=companyName||positionTitle?`${companyName}|||${positionTitle}`:'未知|||未知';
        if(!groups[key])groups[key]={app,companyName,positionTitle,refs:[]};
        groups[key].refs.push(ref);
    });
    Object.values(groups).forEach(g=>{
        const header=document.createElement('div');
        header.style.cssText='font-size:13px;font-weight:600;color:var(--text-primary);padding:10px 0 6px;border-bottom:1px solid var(--border-light);margin-bottom:8px;display:flex;align-items:center;gap:8px';
        const badge=createEl('span','',ini(g.companyName||g.app?.company_name||'?'));
        badge.style.cssText='width:28px;height:28px;border-radius:6px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--text-tertiary);border:1px solid var(--border);flex-shrink:0';
        header.appendChild(badge);
        header.appendChild(document.createTextNode(`${g.companyName||g.app?.company_name||'未知'} · ${g.positionTitle||g.app?.position_title||'未知'}`));
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
    box.innerHTML=`<div class="reflection-template-head"><span>复盘模板</span><button type="button" id="reflection-template-apply">套用到复盘</button></div><div class="reflection-template-list">${qs.map(q=>`<span>${q}</span>`).join('')}</div>`;
    $('#reflection-template-apply').addEventListener('click',function(){
        const target=$('#reflection-review-content');
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
        option.selected=ref?.app_id===a.id||preAppId===a.id||(!ref?.app_id&&ref?.company_name===a.company_name&&ref?.position_title===a.position_title);
        option.textContent=`${a.company_name} - ${a.position_title}`;
        sel.appendChild(option);
    });
    if(ref&&!ref.app_id&&(ref.company_name||ref.position_title)){
        const detachedValue=`manual::${ref.company_name||''}|||${ref.position_title||''}`;
        const detachedOption=document.createElement('option');
        detachedOption.value=detachedValue;
        detachedOption.selected=true;
        detachedOption.textContent=`${ref.company_name||'未命名公司'} - ${ref.position_title||'未命名岗位'}（当前记录）`;
        sel.appendChild(detachedOption);
    }
    const structured=parseReflectionStructuredContent(ref);
    $('#reflection-round').value=ref?.interview_round||'ROUND_1';
    $('#reflection-question-content').value=structured.question||'';
    $('#reflection-answer-content').value=structured.answer||'';
    $('#reflection-review-content').value=structured.review||'';
    renderReflectionTemplate($('#reflection-round').value);
    renderPPTags(ref?.pain_points||[]);
    $$('.star-rating .star').forEach(s=>s.classList.toggle('active',parseInt(s.dataset.val)<=(ref?.self_rating||0)));
    currentReflectionMode=ref?.input_type==='VOICE'?'voice':'text';
    if(voiceRecognition)voiceRecognition.stop();
    clearInterval(recTimer);recSec=0;voiceTranscriptFinal='';
    resetVoiceUI();
    $('#voice-recorder').style.display=currentReflectionMode==='voice'?'':'none';$('#reflection-answer-content').style.display=currentReflectionMode==='text'?'':'none';$$('.mode-btn').forEach(b=>b.classList.remove('active'));$(`.mode-btn[data-mode="${currentReflectionMode}"]`)?.classList.add('active');
    $('#reflection-modal-overlay').classList.add('active');
}
$('#reflection-round').addEventListener('change',function(){renderReflectionTemplate(this.value);});
$('#add-pain-point-btn').addEventListener('click',async ()=>{const inp=$('#new-pain-point-input'),v=inp.value.trim();if(!v)return;const added=await store.addPP(v);if(!added)return;inp.value='';const cur=[];$$('#pain-points-selector input:checked').forEach(i=>cur.push(i.value));cur.push(v);renderPPTags(cur);});
$('#new-pain-point-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#add-pain-point-btn').click();}});
$$('.mode-btn').forEach(b=>{b.addEventListener('click',()=>{$$('.mode-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentReflectionMode=b.dataset.mode||'text';$('#reflection-answer-content').style.display=currentReflectionMode==='text'?'':'none';$('#voice-recorder').style.display=currentReflectionMode==='voice'?'':'none';if(currentReflectionMode!=='voice'&&voiceRecognition)voiceRecognition.stop();});});
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
        $('#reflection-answer-content').value=combined;
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
            renderVoiceResult('转写完成',$('#reflection-answer-content').value||'');
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
        $('#reflection-answer-content').value='';
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
$('#reflection-save').addEventListener('click',async e=>{await withButtonBusy(e.currentTarget,async ()=>{const rawAppValue=$('#reflection-application').value,round=$('#reflection-round').value,question=$('#reflection-question-content').value.trim(),answer=$('#reflection-answer-content').value.trim(),review=$('#reflection-review-content').value.trim();if(!rawAppValue||!round){toast('请选择投递和轮次','error');return;}if(!question&&!answer&&!review){toast('请至少填写一项内容','error');return;}const pp=[];$$('#pain-points-selector input:checked').forEach(i=>pp.push(i.value));let sr=0;$$('.star-rating .star.active').forEach(()=>sr++);const combined=`问题：${question||'—'}\n\n回答：${answer||'—'}\n\n复盘：${review||'—'}`.trim();const isDetached=rawAppValue.startsWith('manual::');const app=isDetached?null:store.getApp(rawAppValue);const detachedMeta=isDetached?rawAppValue.slice('manual::'.length).split('|||'):[];
const companyName=app?.company_name||detachedMeta[0]||'';
const positionTitle=app?.position_title||detachedMeta[1]||'';
const d={app_id:app?.id||null,company_name:companyName,position_title:positionTitle,interview_round:round,input_type:currentReflectionMode==='voice'?'VOICE':'TEXT',question_text:question,answer_text:answer,reflection_text:review,raw_content:combined,cleaned_content:combined,ai_extracted:review||answer||null,pain_points:pp,self_rating:sr||null};if(editRefId){const ok=await store.updateRef(editRefId,d);if(ok===false){toast('保存失败，请重试','error');return;}toast('已更新','success');}else{const ok=await store.addRef(d);if(ok===false){toast('保存失败，请重试','error');return;}toast('已保存','success');}if(voiceRecognition)voiceRecognition.stop();$('#reflection-modal-overlay').classList.remove('active');editRefId=null;renderRefs();if(curDId)openDrawer(curDId);},editRefId?'保存中...':'创建中...');});
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
function openCommunityModal(){
    $('#community-modal-overlay')?.classList.add('active');
}
function closeCommunityModal(){
    $('#community-modal-overlay')?.classList.remove('active');
}
$('#login-community-entry')?.addEventListener('click',openCommunityModal);
$('#app-community-entry')?.addEventListener('click',openCommunityModal);
$('#community-modal-close')?.addEventListener('click',closeCommunityModal);
$('#community-modal-overlay')?.addEventListener('click',function(e){
    if(e.target===e.currentTarget)closeCommunityModal();
});
$('#login-community-entry')?.addEventListener('pointermove',function(e){
    const rect=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width;
    const y=(e.clientY-rect.top)/rect.height;
    e.currentTarget.style.setProperty('--mx',Math.round(x*100)+'%');
    e.currentTarget.style.setProperty('--my',Math.round(y*100)+'%');
    e.currentTarget.style.setProperty('--rx',((.5-y)*3).toFixed(2)+'deg');
    e.currentTarget.style.setProperty('--ry',((x-.5)*4).toFixed(2)+'deg');
});
$('#login-community-entry')?.addEventListener('pointerleave',function(e){
    e.currentTarget.style.setProperty('--mx','78%');
    e.currentTarget.style.setProperty('--my','50%');
    e.currentTarget.style.setProperty('--rx','0deg');
    e.currentTarget.style.setProperty('--ry','0deg');
});
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
function initFilters(){const cs=$('#filter-category');cs.textContent='';const catPlaceholder=document.createElement('option');catPlaceholder.value='';catPlaceholder.textContent='全部类别';cs.appendChild(catPlaceholder);store.categories.forEach(function(c){const option=document.createElement('option');option.value=c;option.textContent=c;cs.appendChild(option);});renderTableControlOptions();}
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
            is_starter_placeholder:true,
            starter_placeholder_source:'default_seed',
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
document.querySelectorAll('.theme-toggle').forEach(function(themeToggleBtn){
    themeToggleBtn.addEventListener('click',async function(){
        const current=getStoredThemeMode();
        const next=current==='dark'?'light':'dark';
        const hasActiveStore=typeof store!=='undefined'&&store&&store.settings&&(typeof rtSession!=='undefined'&&rtSession||(window.rtGuestStore&&window.rtGuestStore.isEnabled&&window.rtGuestStore.isEnabled()));
        const ok=await setThemeMode(next,{persist:!!hasActiveStore});
        if(ok!==false&&typeof toast==='function')toast(next==='light'?'已切换为浅色模式':'已切换为深色模式','success');
    });
});
applyThemeMode(getStoredThemeMode(),{remember:true});
syncThemeToggleVisibility(false);
function init(){
    handleBillingReturnState();
    initFilters();
    renderTableControlOptions();
    syncKanbanSortDirection();
    syncQuickEditPanel();
    updIntl();
    switchView('table');
    const schedulePrewarm=window.requestIdleCallback||function(callback){return window.setTimeout(callback,240);};
    schedulePrewarm(function(){
        if(!jobBoardState.cacheReady&&!jobBoardState.loading){
            void loadJobBoardCache(false).catch(function(){});
        }
    });
}
init();
