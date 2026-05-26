(function(){
    const LIVE_SYNC_INTERVAL=15000;
    const ADMIN_LOCAL_CONFIG=window.RT_ADMIN_CONSOLE_CONFIG||{};
    const EVENT_LABELS={
        rt_workspace_entered:'进入产品',
        rt_login_page_view:'打开登录页',
        rt_auth_started:'登录开始',
        rt_sign_up_started:'注册开始',
        rt_guest_mode_started:'体验模式进入',
        rt_login_success:'登录成功',
        rt_application_created:'创建投递',
        rt_prepare_access_consumed:'消耗准备次数',
        rt_prepare_session_created:'创建准备会话',
        rt_guest_data_migrated:'体验数据迁移'
    };
    const state={
        loading:false,
        backendAccounts:[],
        backendEvents:[],
        legacyAccounts:[],
        legacyEvents:[],
        error:'',
        lastSyncAt:'',
        liveSync:true,
        canManage:false,
        accessMode:'snapshot',
        syncTimer:null,
        selectedIds:new Set(),
        filters:{
            query:'',
            authMode:'all',
            membership:'all',
            status:'all',
            rangeDays:30
        }
    };
    let adminDataSource=null;

    function $(id){return document.getElementById(id);}

    function escapeHTML(value){
        return String(value??'').replace(/[&<>"']/g,function(char){
            return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]);
        });
    }

    function formatTime(value){
        if(!value)return'--';
        try{
            return new Date(value).toLocaleString('zh-CN');
        }catch(err){
            return String(value);
        }
    }

    function formatDate(value){
        if(!value)return'--';
        try{
            return new Date(value).toLocaleDateString('zh-CN');
        }catch(err){
            return String(value);
        }
    }

    function showToast(title,message,type){
        const stack=$('admin-toast-stack');
        if(!stack)return;
        const node=document.createElement('div');
        node.className=`admin-toast ${type==='error'?'is-error':'is-success'}`;
        node.innerHTML=`<strong>${escapeHTML(title)}</strong><p>${escapeHTML(message||'')}</p>`;
        stack.appendChild(node);
        window.setTimeout(function(){
            node.classList.add('is-fading');
            window.setTimeout(function(){node.remove();},240);
        },3200);
    }

    function showStatus(title,desc){
        if($('admin-status-title'))$('admin-status-title').textContent=title;
        if($('admin-status-desc'))$('admin-status-desc').textContent=desc;
    }

    function setMainVisible(visible){
        const main=$('admin-main');
        if(main)main.hidden=!visible;
    }

    function updateSyncPill(){
        const pill=$('admin-sync-pill');
        if(!pill)return;
        if(state.accessMode==='local_service_role'){
            pill.textContent=state.liveSync?'本地后台实时同步已开启':'本地后台实时同步已暂停';
            return;
        }
        pill.textContent='当前为历史快照模式';
    }

    function hasLocalAdminConfig(){
        return ADMIN_LOCAL_CONFIG
            && ADMIN_LOCAL_CONFIG.mode==='local_service_role'
            && ADMIN_LOCAL_CONFIG.supabaseUrl
            && ADMIN_LOCAL_CONFIG.serviceRoleKey;
    }

    function createLocalAdminDataSource(config){
        const baseUrl=String(config.supabaseUrl||'').replace(/\/$/,'');
        const serviceRoleKey=String(config.serviceRoleKey||'').trim();

        async function request(path,options){
            const response=await fetch(baseUrl+path,Object.assign({
                headers:{
                    apikey:serviceRoleKey,
                    Authorization:'Bearer '+serviceRoleKey
                }
            },options||{}));
            const text=await response.text();
            let data=null;
            if(text){
                try{
                    data=JSON.parse(text);
                }catch(err){
                    data=text;
                }
            }
            if(!response.ok){
                const message=data&&typeof data==='object'
                    ? (data.message||data.error_description||data.error||JSON.stringify(data))
                    : (text||('HTTP '+response.status));
                throw new Error(message);
            }
            return data;
        }

        return {
            async listAccounts(){
                const data=await request('/rest/v1/rt_accounts?select=*&order=last_seen_at.desc.nullslast,created_at.desc', {
                    method:'GET'
                });
                return (Array.isArray(data)?data:[]).map(function(account){
                    return {account:account};
                });
            },
            async listEvents(days,limit){
                const sinceDate=new Date(Date.now()-Math.max(1,days||30)*86400000).toISOString();
                const path='/rest/v1/rt_activity_events?select=*&created_at=gte.'+encodeURIComponent(sinceDate)+'&order=created_at.desc&limit='+(limit||3000);
                const data=await request(path,{method:'GET'});
                return Array.isArray(data)?data:[];
            },
            async updateAccount(patch){
                const accountId=patch&&patch.id;
                if(!accountId)throw new Error('缺少账号 ID，无法更新。');
                const body=Object.assign({},patch);
                delete body.id;
                const path='/rest/v1/rt_accounts?id=eq.'+encodeURIComponent(accountId);
                const data=await request(path,{
                    method:'PATCH',
                    headers:{
                        apikey:serviceRoleKey,
                        Authorization:'Bearer '+serviceRoleKey,
                        'Content-Type':'application/json',
                        Prefer:'return=representation'
                    },
                    body:JSON.stringify(body)
                });
                const row=Array.isArray(data)?data[0]:data;
                if(!row)throw new Error('更新成功，但没有返回账号记录。');
                return row;
            }
        };
    }

    function getMembershipKey(account){
        if(!account)return'trial';
        if(account.is_lifetime||account.membership_tier==='lifetime')return'lifetime';
        if(account.membership_tier==='monthly')return'monthly';
        return'trial';
    }

    function formatMembership(account){
        return({
            lifetime:'买断',
            monthly:'月会员',
            trial:'试用'
        })[getMembershipKey(account)]||'试用';
    }

    function formatAccountStatus(status){
        return({
            active:'活跃',
            pending:'待激活',
            paused:'暂停',
            history:'历史快照'
        })[String(status||'active')]||String(status||'active');
    }

    function getRemainingMembershipDays(account){
        if(!account||!account.membership_expires_at)return null;
        const expiresAt=new Date(account.membership_expires_at).getTime();
        if(Number.isNaN(expiresAt))return null;
        return Math.max(0,Math.ceil((expiresAt-Date.now())/86400000));
    }

    function getAccountStatusNote(account){
        if(!account)return'';
        const membership=getMembershipKey(account);
        if(account.status==='pending'){
            return 'pending 表示这个账号已经注册，但邮箱还没验证完成，所以还没有完全激活。';
        }
        if(account.status==='paused'){
            return '当前账号已被暂停，暂停期间不会按正常会员权益使用。';
        }
        if(account.status==='history'){
            return '这是旧埋点快照用户，只用于历史分析，不会直接写回真实会员状态。';
        }
        if(membership==='lifetime'||account.is_lifetime){
            return '买断会员已生效，当前为永久有效。';
        }
        if(membership==='monthly'){
            const remainingDays=getRemainingMembershipDays(account);
            if(remainingDays===null){
                return '月会员已生效，当前未记录精确到期时间。';
            }
            return remainingDays>0
                ? `月会员已生效，还剩 ${remainingDays} 天，到期日 ${formatDate(account.membership_expires_at)}。`
                : `月会员已到期，到期日 ${formatDate(account.membership_expires_at)}。`;
        }
        return `当前为试用状态，剩余 ${account.remaining_prepare_quota||0} / ${account.total_prepare_quota||0} 次准备机会。`;
    }

    function getActionSuccessMessage(account,action){
        const name=account&&account.display_name||account&&account.email||'该账号';
        if(action==='trial'){
            return {
                title:'体验次数已增加',
                message:`${name} 现在多了 1 次体验机会，刷新后的剩余额度会同步显示。`
            };
        }
        if(action==='monthly'){
            const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
            return {
                title:'月会员已开通',
                message:`${name} 已升级为月会员，预计到期日 ${formatDate(expiresAt)}。`
            };
        }
        if(action==='lifetime'){
            return {
                title:'买断已生效',
                message:`${name} 现在是永久会员，不再受月度到期限制。`
            };
        }
        if(action==='pause'){
            return {
                title:'账号已暂停',
                message:`${name} 已被暂停，恢复前不会按正常会员状态使用。`
            };
        }
        if(action==='activate'){
            return {
                title:'账号已恢复活跃',
                message:`${name} 现在重新回到活跃状态。`
            };
        }
        return {
            title:'已设回试用',
            message:`${name} 已恢复为试用状态，后续会按试用次数继续消耗。`
        };
    }

    function buildLegacyAccountId(rawKey){
        return 'legacy_'+String(rawKey||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48);
    }

    function formatAccountMode(account){
        return account&&account.auth_mode==='registered'?'注册账号':'体验账号';
    }

    function buildLegacySnapshotEntries(){
        const snapshot=window.__RT_OPS_DATA__;
        const events=Array.isArray(snapshot&&snapshot.events)?snapshot.events:[];
        const actorMap=new Map();
        const legacyEvents=events.map(function(event,index){
            const isRegisteredEvent=event.name==='rt_login_success'&&event.actor_id&&/^[0-9a-f-]{36}$/i.test(event.actor_id);
            const rawKey=isRegisteredEvent?event.actor_id:(event.visitor_id||event.actor_id||event.user_id||('snapshot_'+index));
            const accountId=buildLegacyAccountId(rawKey);
            const existing=actorMap.get(accountId)||{
                account:{
                    id:accountId,
                    guest_id:'legacy:'+rawKey,
                    auth_user_id:'',
                    email:event.user_id||'',
                    display_name:'历史访客 '+String(rawKey).slice(0,8),
                    auth_mode:(event.user_id||isRegisteredEvent)?'registered':'guest',
                    membership_tier:'trial',
                    is_admin:false,
                    is_lifetime:false,
                    trial_prepare_limit:1,
                    bonus_prepare_credits:0,
                    used_prepare_credits:0,
                    remaining_prepare_quota:0,
                    total_prepare_quota:1,
                    has_paid_access:false,
                    status:'history',
                    source_channel:'legacy_posthog_snapshot',
                    notes:'来自旧埋点快照，仅作历史数据分析展示。',
                    last_seen_at:event.at||'',
                    created_at:event.at||'',
                    admin_source:'legacy_snapshot',
                    is_real_account:false
                },
                event_count:0,
                prepare_claim_count:0,
                last_event_at:event.at||''
            };
            existing.event_count+=1;
            if(event.name==='rt_prepare_access_consumed'||event.name==='rt_prepare_session_created'){
                existing.account.used_prepare_credits=(existing.account.used_prepare_credits||0)+1;
            }
            if(event.user_id){
                existing.account.email=event.user_id;
                existing.account.auth_mode='registered';
            }
            if(isRegisteredEvent){
                existing.account.auth_mode='registered';
                existing.account.auth_user_id=event.actor_id;
                existing.account.display_name='历史注册用户 '+String(event.actor_id).slice(0,8);
            }
            if(event.at&&(!existing.account.created_at||new Date(event.at)<new Date(existing.account.created_at))){
                existing.account.created_at=event.at;
            }
            if(event.at&&(!existing.account.last_seen_at||new Date(event.at)>new Date(existing.account.last_seen_at))){
                existing.account.last_seen_at=event.at;
                existing.last_event_at=event.at;
            }
            actorMap.set(accountId,existing);
            return {
                id:'legacy_event_'+String(index),
                account_id:accountId,
                guest_id:'legacy:'+rawKey,
                actor_key:'legacy:'+rawKey,
                event_name:event.name,
                props:{
                    source:'legacy_posthog_snapshot',
                    visitor_id:event.visitor_id||'',
                    actor_id:event.actor_id||'',
                    user_id:event.user_id||'',
                    auth_mode:event.auth_mode||'',
                    guest_mode:!!event.guest_mode,
                    device_type:event.device_type||'',
                    view:event.view||'',
                    theme_mode:event.theme_mode||''
                },
                created_at:event.at||''
            };
        });
        return {
            accounts:Array.from(actorMap.values()),
            events:legacyEvents
        };
    }

    function getCombinedAccounts(){
        return state.backendAccounts.concat(state.legacyAccounts).sort(function(a,b){
            const at=new Date(a&&a.account&&a.account.last_seen_at||a&&a.account&&a.account.created_at||0).getTime();
            const bt=new Date(b&&b.account&&b.account.last_seen_at||b&&b.account&&b.account.created_at||0).getTime();
            return bt-at;
        });
    }

    function getCombinedEvents(){
        return state.backendEvents.concat(state.legacyEvents).sort(function(a,b){
            const at=new Date(a&&a.created_at||0).getTime();
            const bt=new Date(b&&b.created_at||0).getTime();
            return bt-at;
        });
    }

    function daysAgoFrom(value){
        if(!value)return Number.POSITIVE_INFINITY;
        const ts=new Date(value).getTime();
        if(Number.isNaN(ts))return Number.POSITIVE_INFINITY;
        return Math.max(0,(Date.now()-ts)/86400000);
    }

    function getFilteredAccounts(){
        const query=state.filters.query.trim().toLowerCase();
        return getCombinedAccounts().filter(function(entry){
            const account=entry.account||{};
            const membership=getMembershipKey(account);
            const searchable=[
                account.id,
                account.email,
                account.display_name,
                account.guest_id,
                account.auth_user_id
            ].filter(Boolean).join(' ').toLowerCase();
            if(query&&!searchable.includes(query))return false;
            if(state.filters.authMode!=='all'&&String(account.auth_mode||'guest')!==state.filters.authMode)return false;
            if(state.filters.membership!=='all'&&membership!==state.filters.membership)return false;
            if(state.filters.status!=='all'&&String(account.status||'active')!==state.filters.status)return false;
            if(daysAgoFrom(account.last_seen_at)>state.filters.rangeDays)return false;
            return true;
        });
    }

    function getFilteredEvents(){
        return getCombinedEvents().filter(function(event){
            return daysAgoFrom(event.created_at)<=state.filters.rangeDays;
        });
    }

    function countUniqueByEvent(eventName){
        return new Set(getFilteredEvents().filter(function(item){
            return item.event_name===eventName;
        }).map(function(item){
            return item.actor_key||item.account_id||item.id;
        })).size;
    }

    function buildTrendSeries(){
        const dayBuckets=new Map();
        const dayCount=Math.max(1,Number(state.filters.rangeDays)||30);
        for(let index=dayCount-1;index>=0;index-=1){
            const date=new Date();
            date.setHours(0,0,0,0);
            date.setDate(date.getDate()-index);
            const key=date.toISOString().slice(0,10);
            dayBuckets.set(key,{
                date:key,
                entered:0,
                auth:0,
                register:0,
                create:0,
                prepare:0
            });
        }
        getFilteredEvents().forEach(function(item){
            const key=String(item.created_at||'').slice(0,10);
            const bucket=dayBuckets.get(key);
            if(!bucket)return;
            if(item.event_name==='rt_workspace_entered')bucket.entered+=1;
            if(['rt_auth_started','rt_sign_up_started','rt_login_page_view','rt_login_success','rt_guest_mode_started'].includes(item.event_name))bucket.auth+=1;
            if(item.event_name==='rt_application_created')bucket.create+=1;
            if(item.event_name==='rt_prepare_access_consumed'||item.event_name==='rt_prepare_session_created')bucket.prepare+=1;
        });
        getFilteredAccounts().forEach(function(entry){
            const account=entry.account||{};
            if(account.auth_mode!=='registered')return;
            const key=String(account.created_at||'').slice(0,10);
            const bucket=dayBuckets.get(key);
            if(bucket)bucket.register+=1;
        });
        return Array.from(dayBuckets.values());
    }

    function renderMetrics(){
        const container=$('admin-metric-grid');
        if(!container)return;
        const accounts=getFilteredAccounts();
        const cards=[
            {label:'进入产品用户',value:countUniqueByEvent('rt_workspace_entered'),note:`最近 ${state.filters.rangeDays} 天`},
            {label:'登录 / 注册相关',value:new Set(getFilteredEvents().filter(function(item){
                return ['rt_auth_started','rt_sign_up_started','rt_login_page_view','rt_login_success','rt_guest_mode_started'].includes(item.event_name);
            }).map(function(item){return item.actor_key||item.account_id||item.id;})).size,note:'含旧埋点与新事件'},
            {label:'注册账号数',value:accounts.filter(function(item){return item.account&&item.account.auth_mode==='registered';}).length,note:'当前筛选结果'},
            {label:'创建投递用户',value:countUniqueByEvent('rt_application_created'),note:'至少创建过一次投递'},
            {label:'使用准备用户',value:new Set(getFilteredEvents().filter(function(item){
                return item.event_name==='rt_prepare_access_consumed'||item.event_name==='rt_prepare_session_created';
            }).map(function(item){return item.actor_key||item.account_id||item.id;})).size,note:'准备权限或会话触发'},
            {label:'付费 / 授权用户',value:accounts.filter(function(item){
                const account=item.account||{};
                return getMembershipKey(account)==='monthly'||getMembershipKey(account)==='lifetime';
            }).length,note:'月会员 / 买断'}
        ];
        container.innerHTML=cards.map(function(card){
            return `<div class="admin-metric-card">
                <div class="admin-metric-card-label">${escapeHTML(card.label)}</div>
                <div class="admin-metric-card-value">${escapeHTML(card.value)}</div>
                <div class="admin-metric-card-note">${escapeHTML(card.note)}</div>
            </div>`;
        }).join('');
    }

    function renderTrendBoard(){
        const container=$('admin-trend-board');
        if(!container)return;
        const series=buildTrendSeries();
        const summaries=[
            {key:'entered',label:'进入产品'},
            {key:'auth',label:'登录 / 注册'},
            {key:'register',label:'新注册账号'},
            {key:'create',label:'新建投递'},
            {key:'prepare',label:'准备消耗'}
        ].map(function(item){
            const values=series.map(function(row){return row[item.key]||0;});
            const total=values.reduce(function(sum,current){return sum+current;},0);
            const max=Math.max(1,...values);
            const latest=values[values.length-1]||0;
            return Object.assign({},item,{total,max,latest});
        });
        container.innerHTML=`
            <div class="admin-trend-board-head">
                <div>
                    <h2>时间范围看板</h2>
                    <p>按最近 ${escapeHTML(state.filters.rangeDays)} 天看主要转化事件。切换时间范围后，这里会同步刷新。</p>
                </div>
                <div class="admin-card-meta">最近同步：${escapeHTML(formatTime(state.lastSyncAt))}</div>
            </div>
            <div class="admin-trend-grid">
                ${summaries.map(function(item){
                    return `<div class="admin-trend-item">
                        <strong>${escapeHTML(item.label)}</strong>
                        <p>总量 ${escapeHTML(item.total)}，今天 ${escapeHTML(item.latest)}</p>
                        <div class="admin-trend-bar"><span style="width:${Math.max(8,Math.round(item.total/item.max*100))}%"></span></div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }

    function renderAccounts(){
        const list=$('admin-account-list');
        const meta=$('admin-account-meta');
        const bulkMeta=$('admin-bulk-meta');
        const syncMeta=$('admin-last-sync');
        const selectAll=$('admin-select-all');
        if(!list)return;
        if(state.loading){
            list.innerHTML='<div class="admin-empty">后台数据加载中…</div>';
            if(meta)meta.textContent='正在拉取真实账号数据';
            if(bulkMeta)bulkMeta.textContent='已选 0 个账号';
            if(syncMeta)syncMeta.textContent='最近同步：--';
            return;
        }
        if(state.error){
            list.innerHTML=`<div class="admin-empty">${escapeHTML(state.error)}</div>`;
            if(meta)meta.textContent='读取失败';
            return;
        }
        const accounts=getFilteredAccounts();
        if(meta)meta.textContent=`当前筛选结果 ${accounts.length} 个账号`;
        if(syncMeta)syncMeta.textContent=`最近同步：${escapeHTML(formatTime(state.lastSyncAt))}`;
        if(bulkMeta)bulkMeta.textContent=`已选 ${state.selectedIds.size} 个账号`;
        if(selectAll)selectAll.checked=!!accounts.length&&accounts.every(function(item){
            return state.selectedIds.has(item.account&&item.account.id);
        });
        if(!accounts.length){
            list.innerHTML='<div class="admin-empty">当前筛选下没有账号，换个条件试试。</div>';
            return;
        }
        list.innerHTML=accounts.map(function(entry){
            const account=entry.account||{};
            const id=account.id||'';
            const quota=account.has_paid_access?'无限制':`${account.remaining_prepare_quota||0} / ${account.total_prepare_quota||0}`;
            const isLegacy=account.admin_source==='legacy_snapshot';
            const isReadonly=isLegacy||!state.canManage;
            const statusToggleLabel=account.status==='paused'?'恢复活跃':'暂停账号';
            const statusToggleAction=account.status==='paused'?'activate':'pause';
            return `<div class="admin-account-item">
                <label class="admin-account-check">
                    <input type="checkbox" data-select-account="${escapeHTML(id)}" ${state.selectedIds.has(id)?'checked':''} ${isReadonly?'disabled':''}>
                </label>
                <div class="admin-account-main">
                    <div class="admin-account-head">
                        <strong>${escapeHTML(account.display_name||account.email||account.guest_id||'履迹用户')}</strong>
                        <span class="admin-chip">${escapeHTML(formatAccountMode(account))}</span>
                        <span class="admin-chip">${escapeHTML(formatMembership(account))}</span>
                        <span class="admin-chip">${escapeHTML(formatAccountStatus(account.status||'active'))}</span>
                        ${isLegacy?'<span class="admin-chip">历史快照</span>':''}
                        ${!state.canManage?'<span class="admin-chip">只读</span>':''}
                    </div>
                    <div class="admin-account-identity">
                        <div class="admin-account-id">账号 ID：${escapeHTML(id||'--')}</div>
                        ${account.auth_user_id?`<div class="admin-account-id">Auth ID：${escapeHTML(account.auth_user_id)}</div>`:''}
                        ${id?`<button type="button" class="admin-copy-btn" data-copy-account-id="${escapeHTML(id)}">复制 ID</button>`:''}
                    </div>
                    <div class="admin-account-sub">${escapeHTML(account.email||account.guest_id||'未记录邮箱，当前为体验身份')}</div>
                    <div class="admin-account-status-note">${escapeHTML(getAccountStatusNote(account))}</div>
                    <div class="admin-account-metrics">
                        <span>体验额度：${escapeHTML(quota)}</span>
                        <span>已用：${escapeHTML(account.used_prepare_credits||0)}</span>
                        <span>最后活跃：${escapeHTML(formatTime(account.last_seen_at))}</span>
                        <span>创建时间：${escapeHTML(formatTime(account.created_at))}</span>
                    </div>
                </div>
                <div class="admin-account-actions">
                    ${isReadonly
                        ? `<div class="admin-card-meta">${isLegacy?'历史访客仅用于分析，不支持直接授权':'当前只读：先把本地 service role key 填进 .admin-console.local.js'}</div>`
                        : `<div class="admin-inline-actions">
                               <button type="button" class="admin-action-btn" data-style="highlight" data-action="trial" data-account-id="${escapeHTML(id)}">+1 次体验</button>
                               <button type="button" class="admin-action-btn" data-action="monthly" data-account-id="${escapeHTML(id)}">开月卡</button>
                               <button type="button" class="admin-action-btn" data-action="lifetime" data-account-id="${escapeHTML(id)}">买断</button>
                               <button type="button" class="admin-action-btn" data-action="reset" data-account-id="${escapeHTML(id)}">设回试用</button>
                               <button type="button" class="admin-action-btn" data-style="calm" data-action="${escapeHTML(statusToggleAction)}" data-account-id="${escapeHTML(id)}">${escapeHTML(statusToggleLabel)}</button>
                           </div>`}
                </div>
            </div>`;
        }).join('');
    }

    function renderEvents(){
        const feed=$('admin-event-feed');
        if(!feed)return;
        if(state.loading){
            feed.innerHTML='<div class="admin-empty">后台事件加载中…</div>';
            return;
        }
        const events=getFilteredEvents();
        if(!events.length){
            feed.innerHTML='<div class="admin-empty">当前时间范围内还没有事件流。</div>';
            return;
        }
        feed.innerHTML=events.slice(0,24).map(function(item){
            const actor=item.props&&item.props.email||item.guest_id||item.actor_key||item.account_id||'未知用户';
            return `<div class="admin-event-item">
                <strong>${escapeHTML(EVENT_LABELS[item.event_name]||item.event_name||'event')}</strong>
                <span>${escapeHTML(actor)}</span>
                <span>${escapeHTML(formatTime(item.created_at))}</span>
            </div>`;
        }).join('');
    }

    async function applyAccountAction(accountId,action){
        if(!state.canManage)return;
        const entry=state.backendAccounts.find(function(item){return item.account&&item.account.id===accountId;});
        if(!entry||!entry.account)return;
        const account=entry.account;
        if(action==='trial'){
            await adminDataSource.updateAccount({
                id:accountId,
                bonus_prepare_credits:(account.bonus_prepare_credits||0)+1
            });
        }else if(action==='monthly'){
            await adminDataSource.updateAccount({
                id:accountId,
                membership_tier:'monthly',
                membership_expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString(),
                is_lifetime:false,
                status:'active'
            });
        }else if(action==='lifetime'){
            await adminDataSource.updateAccount({
                id:accountId,
                membership_tier:'lifetime',
                membership_expires_at:null,
                is_lifetime:true,
                status:'active'
            });
        }else if(action==='reset'){
            await adminDataSource.updateAccount({
                id:accountId,
                membership_tier:'trial',
                membership_expires_at:null,
                is_lifetime:false,
                status:'active'
            });
        }else if(action==='pause'){
            await adminDataSource.updateAccount({
                id:accountId,
                status:'paused'
            });
        }else if(action==='activate'){
            await adminDataSource.updateAccount({
                id:accountId,
                status:'active'
            });
        }
        return getActionSuccessMessage(account,action);
    }

    async function applyBulkAction(action){
        if(!state.canManage)return;
        const ids=Array.from(state.selectedIds);
        if(!ids.length)return;
        for(const accountId of ids){
            await applyAccountAction(accountId,action);
        }
        await refreshData({preserveScroll:true,silent:true});
        if(action==='trial')showToast('批量体验已增加',`已为 ${ids.length} 个账号补充体验次数。`,'success');
        else if(action==='monthly')showToast('批量月会员已开通',`已为 ${ids.length} 个账号开通月会员。`,'success');
        else if(action==='lifetime')showToast('批量买断已生效',`已为 ${ids.length} 个账号开通永久会员。`,'success');
        else showToast('批量已设回试用',`已将 ${ids.length} 个账号恢复为试用状态。`,'success');
    }

    function syncFiltersFromInputs(){
        state.filters.query=$('admin-search-input')?.value||'';
        state.filters.authMode=$('admin-auth-filter')?.value||'all';
        state.filters.membership=$('admin-membership-filter')?.value||'all';
        state.filters.status=$('admin-status-filter')?.value||'all';
        state.filters.rangeDays=Number($('admin-range-filter')?.value||30);
    }

    function renderAll(){
        renderMetrics();
        renderTrendBoard();
        renderAccounts();
        renderEvents();
    }

    async function refreshData(options){
        const opts=Object.assign({preserveScroll:false,silent:false},options||{});
        const scrollTop=opts.preserveScroll?window.scrollY:0;
        syncFiltersFromInputs();
        state.loading=!opts.silent;
        state.error='';
        if(!opts.silent)renderAll();
        try{
            const legacy=buildLegacySnapshotEntries();
            state.legacyAccounts=legacy.accounts;
            state.legacyEvents=legacy.events;
            if(adminDataSource&&state.canManage){
                state.backendAccounts=await adminDataSource.listAccounts();
                state.backendEvents=await adminDataSource.listEvents(state.filters.rangeDays,3000);
            }else{
                state.backendAccounts=[];
                state.backendEvents=[];
            }
            state.lastSyncAt=new Date().toISOString();
            renderAll();
        }catch(error){
            state.error=error instanceof Error?error.message:String(error);
            renderAll();
        }finally{
            state.loading=false;
            renderAll();
            if(opts.preserveScroll){
                window.requestAnimationFrame(function(){
                    window.scrollTo({top:scrollTop,left:0,behavior:'auto'});
                });
            }
        }
    }

    function startLiveSync(){
        stopLiveSync();
        if(!state.liveSync)return;
        state.syncTimer=window.setInterval(function(){
            if(document.hidden)return;
            refreshData({preserveScroll:true,silent:true}).catch(function(){});
        },LIVE_SYNC_INTERVAL);
    }

    function stopLiveSync(){
        if(state.syncTimer){
            window.clearInterval(state.syncTimer);
            state.syncTimer=null;
        }
    }

    async function boot(){
        setMainVisible(true);
        try{
            if(hasLocalAdminConfig()){
                adminDataSource=createLocalAdminDataSource(ADMIN_LOCAL_CONFIG);
                state.canManage=true;
                state.accessMode='local_service_role';
                showStatus('本地独立后台已连接','当前后台直接使用你本机保存的 service role key 拉实时数据，不依赖主产品登录态。你可以随时编辑任何账号的会员状态、体验次数和账号状态。');
                updateSyncPill();
                startLiveSync();
                await refreshData({preserveScroll:true,silent:true});
                return;
            }
            state.canManage=false;
            state.accessMode='snapshot';
            showStatus('当前为历史快照模式','你还没有填本地后台专用的 service role key，所以现在先展示历史埋点快照。把 key 填进 .admin-console.local.js 后，这里会直接变成实时可编辑后台。');
            updateSyncPill();
            startLiveSync();
            await refreshData({preserveScroll:true,silent:true});
        }catch(error){
            state.canManage=false;
            state.accessMode='snapshot';
            showStatus('后台初始化失败',error instanceof Error?error.message:String(error));
            updateSyncPill();
            await refreshData({preserveScroll:true,silent:true});
        }
    }

    $('admin-refresh-btn')?.addEventListener('click',function(){
        refreshData({preserveScroll:true,silent:true});
    });

    $('admin-live-toggle')?.addEventListener('change',function(event){
        state.liveSync=!!event.target.checked;
        updateSyncPill();
        if(state.liveSync){
            startLiveSync();
            refreshData({preserveScroll:true,silent:true});
        }else{
            stopLiveSync();
        }
    });

    ['admin-search-input','admin-auth-filter','admin-membership-filter','admin-status-filter','admin-range-filter'].forEach(function(id){
        $(id)?.addEventListener(id==='admin-search-input'?'input':'change',function(){
            syncFiltersFromInputs();
            renderAll();
            if(id==='admin-range-filter'){
                refreshData({preserveScroll:true,silent:true});
            }
        });
    });

    $('admin-select-all')?.addEventListener('change',function(event){
        const accounts=getFilteredAccounts();
        if(event.target.checked){
            accounts.forEach(function(entry){
                if(entry.account&&entry.account.id)state.selectedIds.add(entry.account.id);
            });
        }else{
            accounts.forEach(function(entry){
                if(entry.account&&entry.account.id)state.selectedIds.delete(entry.account.id);
            });
        }
        renderAccounts();
    });

    $('admin-account-list')?.addEventListener('click',async function(event){
        const copyButton=event.target.closest('[data-copy-account-id]');
        if(copyButton){
            const value=copyButton.dataset.copyAccountId||'';
            try{
                await navigator.clipboard.writeText(value);
                copyButton.textContent='已复制';
                window.setTimeout(function(){copyButton.textContent='复制 ID';},1200);
            }catch(err){
                copyButton.textContent='复制失败';
                window.setTimeout(function(){copyButton.textContent='复制 ID';},1200);
            }
            return;
        }
        const actionButton=event.target.closest('[data-action]');
        if(!actionButton)return;
        try{
            const result=await applyAccountAction(actionButton.dataset.accountId||'',actionButton.dataset.action||'');
            await refreshData({preserveScroll:true,silent:true});
            if(result)showToast(result.title,result.message,'success');
        }catch(error){
            showToast('操作失败',error instanceof Error?error.message:String(error),'error');
        }
    });

    $('admin-account-list')?.addEventListener('change',function(event){
        const input=event.target.closest('[data-select-account]');
        if(!input)return;
        const accountId=input.dataset.selectAccount||'';
        if(input.checked){
            state.selectedIds.add(accountId);
        }else{
            state.selectedIds.delete(accountId);
        }
        renderAccounts();
    });

    document.querySelector('.admin-bulk-actions')?.addEventListener('click',async function(event){
        const button=event.target.closest('[data-bulk-action]');
        if(!button)return;
        if(!state.canManage)return;
        try{
            await applyBulkAction(button.dataset.bulkAction||'');
        }catch(error){
            showToast('批量操作失败',error instanceof Error?error.message:String(error),'error');
        }
    });

    document.addEventListener('visibilitychange',function(){
        if(!state.liveSync)return;
        if(!document.hidden){
            refreshData({preserveScroll:true,silent:true});
        }
    });

    boot();
})();
