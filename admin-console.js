(function(){
    const LIVE_SYNC_INTERVAL=15000;
    const ADMIN_PASSWORD_HASH='a90b56891a1f24b151448cc3bf78466735d06108b780e017fac4872e8ca3f741';
    const ADMIN_API_FUNCTION='admin-console-api';
    let ADMIN_LOCAL_CONFIG=window.RT_ADMIN_CONSOLE_CONFIG||{};
    let adminAccessPassword='';
    const runtimeSettings=window.rtRuntimeSettings||null;
    const EVENT_LABELS={
        rt_workspace_entered:'进入产品',
        rt_login_page_view:'打开登录页',
        rt_auth_started:'登录开始',
        rt_sign_up_started:'注册开始',
        rt_sign_up_completed:'完成注册',
        rt_guest_mode_started:'体验模式进入',
        rt_login_success:'登录成功',
        rt_application_created:'创建投递',
        rt_prepare_access_consumed:'消耗准备次数',
        rt_prepare_session_created:'创建准备会话',
        rt_guest_data_migrated:'体验数据迁移',
        rt_resume_created:'新建简历',
        rt_resume_uploaded:'上传简历',
        rt_reflection_created:'新建复盘'
    };
    const NOISY_EVENT_NAMES=new Set([
        'rt_theme_changed'
    ]);
    const PLACEHOLDER_APPLICATION_SIGNATURES=new Set([
        '字节跳动|产品经理 - 电商增长|北京|Boss直聘',
        '腾讯|数据分析师|深圳|官网',
        '麦肯锡|Business Analyst|上海|官网',
        '阿里巴巴|商业分析培训生|杭州|内推',
        'Google|Product Manager|Singapore|LinkedIn',
        '小红书|营销策划|上海|官网'
    ]);
    const EVENT_SIGNAL_SCORES={
        rt_prepare_session_created:100,
        rt_prepare_access_consumed:96,
        rt_resume_uploaded:92,
        rt_resume_created:88,
        rt_reflection_created:84,
        rt_application_created:80,
        rt_login_success:42,
        rt_sign_up_completed:40,
        rt_sign_up_started:26,
        rt_auth_started:22,
        rt_guest_mode_started:18,
        rt_workspace_entered:10,
        rt_login_page_view:6
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
        accessMode:'locked',
        syncTimer:null,
        selectedIds:new Set(),
        selectedAccountId:'',
        detailLoadingId:'',
        detailTab:'overview',
        detailResumeSelection:new Map(),
        detailCache:new Map(),
        summaryMap:new Map(),
        filters:{
            query:'',
            authMode:'all',
            membership:'all',
            assetState:'all',
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

    function clone(value){
        if(typeof structuredClone==='function')return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function formatTime(value){
        if(!value)return'--';
        try{
            return new Date(value).toLocaleString('zh-CN');
        }catch(error){
            return String(value);
        }
    }

    function formatDate(value){
        if(!value)return'--';
        try{
            return new Date(value).toLocaleDateString('zh-CN');
        }catch(error){
            return String(value);
        }
    }

    function formatDateShort(value){
        if(!value)return'--';
        try{
            const date=new Date(value);
            return `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
        }catch(error){
            return String(value);
        }
    }

    function flashQrSyncPreview(src){
        const shell=document.querySelector('.admin-qr-preview-shell-large');
        const preview=$('admin-qr-preview-shared');
        if(preview&&src)preview.src=src;
        if(!shell)return;
        shell.classList.remove('is-sync-flash');
        void shell.offsetWidth;
        shell.classList.add('is-sync-flash');
        window.setTimeout(function(){
            shell.classList.remove('is-sync-flash');
        },980);
    }

    function showToast(title,message,type,options){
        const stack=$('admin-toast-stack');
        if(!stack)return;
        const opts=options&&typeof options==='object'?options:{};
        const node=document.createElement('div');
        node.className=`admin-toast ${type==='error'?'is-error':'is-success'}`;
        node.innerHTML=`
            ${opts.thumbnailSrc?`<div class="admin-toast-media"><img src="${escapeHTML(opts.thumbnailSrc)}" alt=""></div>`:''}
            <div class="admin-toast-copy">
                <strong>${escapeHTML(title)}</strong>
                <p>${escapeHTML(message||'')}</p>
            </div>
        `;
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

    function setStatusVisible(visible){
        const card=$('admin-status-card');
        if(card)card.hidden=!visible;
    }

    function setMainVisible(visible){
        const main=$('admin-main');
        if(main)main.hidden=!visible;
    }

    function setShellVisible(visible){
        const shell=$('admin-shell');
        if(shell)shell.hidden=!visible;
    }

    function setLockVisible(visible){
        const lock=$('admin-lock');
        if(lock)lock.hidden=!visible;
    }

    async function sha256Hex(value){
        const encoder=new TextEncoder();
        const digest=await crypto.subtle.digest('SHA-256',encoder.encode(String(value||'')));
        return Array.from(new Uint8Array(digest)).map(function(byte){
            return byte.toString(16).padStart(2,'0');
        }).join('');
    }

    async function verifyAdminPassword(password){
        if(!window.crypto||!crypto.subtle)throw new Error('当前浏览器不支持安全校验，请换 Chrome 或 Safari 重新打开后台。');
        return await sha256Hex(password)===ADMIN_PASSWORD_HASH;
    }

    function updateSyncPill(){
        const pill=$('admin-sync-pill');
        if(!pill)return;
        if(state.accessMode==='local_service_role'){
            pill.textContent=state.liveSync?'本地后台实时同步已开启':'本地后台实时同步已暂停';
            return;
        }
        if(state.accessMode==='cloud_edge'){
            pill.textContent=state.liveSync?'云端后台实时同步已开启':'云端后台实时同步已暂停';
            return;
        }
        pill.textContent='实时后台未连接';
    }

    function hasLocalAdminConfig(){
        ADMIN_LOCAL_CONFIG=window.RT_ADMIN_CONSOLE_CONFIG||ADMIN_LOCAL_CONFIG||{};
        return ADMIN_LOCAL_CONFIG
            && ADMIN_LOCAL_CONFIG.mode==='local_service_role'
            && ADMIN_LOCAL_CONFIG.supabaseUrl
            && ADMIN_LOCAL_CONFIG.serviceRoleKey;
    }

    function safeParseJsonLike(value,fallback){
        if(value===null||typeof value==='undefined')return clone(fallback);
        if(typeof value==='string'){
            try{
                return JSON.parse(value);
            }catch(error){
                return clone(fallback);
            }
        }
        if(Array.isArray(fallback))return Array.isArray(value)?value:clone(fallback);
        if(fallback&&typeof fallback==='object')return value&&typeof value==='object'?value:clone(fallback);
        return value;
    }

    function decodeUserWorkspaceRow(row){
        if(!row)return null;
        return {
            user_id:row.user_id||'',
            updated_at:row.updated_at||'',
            apps:safeParseJsonLike(row.apps,[]),
            resumes:safeParseJsonLike(row.resumes,[]),
            prepare_sessions:safeParseJsonLike(row.prepare_sessions,[]),
            refs:safeParseJsonLike(row.refs,[]),
            settings:safeParseJsonLike(row.settings,{})
        };
    }

    function createLocalAdminDataSource(config){
        const baseUrl=String(config.supabaseUrl||'').replace(/\/$/,'');
        const serviceRoleKey=String(config.serviceRoleKey||'').trim();
        const runtimeTable='rt_public_runtime_settings';
        const sharedBucket='rt-shared';
        const sharedQrConfigPath='runtime/community-qr.json';
        let sharedBucketReady=null;

        function encodeStoragePath(objectPath){
            return String(objectPath||'')
                .split('/')
                .filter(Boolean)
                .map(function(segment){return encodeURIComponent(segment);})
                .join('/');
        }

        function buildPublicObjectUrl(objectPath){
            return `${baseUrl}/storage/v1/object/public/${sharedBucket}/${encodeStoragePath(objectPath)}`;
        }

        function dataUrlToUploadPayload(dataUrl){
            const match=String(dataUrl||'').match(/^data:([^;,]+);base64,(.+)$/);
            if(!match)throw new Error('二维码图片格式不支持，请重新上传。');
            const mime=match[1];
            const binary=atob(match[2]);
            const bytes=new Uint8Array(binary.length);
            for(let index=0;index<binary.length;index+=1){
                bytes[index]=binary.charCodeAt(index);
            }
            const extMap={
                'image/png':'png',
                'image/jpeg':'jpg',
                'image/jpg':'jpg',
                'image/webp':'webp'
            };
            return{
                mime,
                ext:extMap[mime]||'png',
                body:bytes
            };
        }

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
                }catch(error){
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

        async function ensureSharedBucket(){
            if(sharedBucketReady)return sharedBucketReady;
            sharedBucketReady=(async function(){
                const response=await fetch(baseUrl+'/storage/v1/bucket',{
                    method:'POST',
                    headers:{
                        apikey:serviceRoleKey,
                        Authorization:'Bearer '+serviceRoleKey,
                        'Content-Type':'application/json'
                    },
                    body:JSON.stringify({
                        id:sharedBucket,
                        name:sharedBucket,
                        public:true,
                        file_size_limit:'10485760',
                        allowed_mime_types:['image/png','image/jpeg','image/webp','application/json','text/plain']
                    })
                });
                if(response.ok)return true;
                const text=await response.text().catch(function(){return'';});
                if(response.status===400||response.status===409){
                    const lower=String(text||'').toLowerCase();
                    if(lower.indexOf('already exists')>=0||lower.indexOf('duplicate')>=0||lower.indexOf('exists')>=0){
                        return true;
                    }
                }
                throw new Error(text||`共享存储桶创建失败（${response.status}）`);
            })().catch(function(error){
                sharedBucketReady=null;
                throw error;
            });
            return sharedBucketReady;
        }

        async function uploadSharedObject(objectPath,body,contentType){
            await ensureSharedBucket();
            const response=await fetch(`${baseUrl}/storage/v1/object/${sharedBucket}/${encodeStoragePath(objectPath)}`,{
                method:'POST',
                headers:{
                    apikey:serviceRoleKey,
                    Authorization:'Bearer '+serviceRoleKey,
                    'Content-Type':contentType,
                    'x-upsert':'true'
                },
                body:body
            });
            const text=await response.text().catch(function(){return'';});
            if(!response.ok){
                throw new Error(text||`共享文件上传失败（${response.status}）`);
            }
            return text;
        }

        return {
            async listAccounts(){
                const data=await request('/rest/v1/rt_accounts?select=*&order=last_seen_at.desc.nullslast,created_at.desc',{
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
            },
            async getUserWorkspace(authUserId){
                if(!authUserId)return null;
                const path='/rest/v1/user_data?select=user_id,updated_at,apps,resumes,prepare_sessions,refs,settings&user_id=eq.'+encodeURIComponent(authUserId)+'&limit=1';
                const data=await request(path,{method:'GET'});
                const row=Array.isArray(data)&&data.length?data[0]:null;
                return decodeUserWorkspaceRow(row);
            },
            async getUserWorkspaces(authUserIds){
                const ids=Array.from(new Set((Array.isArray(authUserIds)?authUserIds:[]).filter(Boolean)));
                const workspaceMap=new Map();
                if(!ids.length)return workspaceMap;
                const chunkSize=40;
                for(let index=0;index<ids.length;index+=chunkSize){
                const chunk=ids.slice(index,index+chunkSize);
                    const encodedList=chunk.map(function(id){return String(id).trim();}).join(',');
                    const path='/rest/v1/user_data?select=user_id,updated_at,apps,resumes,prepare_sessions,refs,settings&user_id=in.('+encodeURIComponent(encodedList)+')';
                    const data=await request(path,{method:'GET'});
                    (Array.isArray(data)?data:[]).forEach(function(row){
                        const decoded=decodeUserWorkspaceRow(row);
                        if(decoded&&decoded.user_id)workspaceMap.set(decoded.user_id,decoded);
                    });
                }
                return workspaceMap;
            },
            async getRuntimeSetting(settingKey){
                if(!settingKey)return null;
                const path=`/rest/v1/${runtimeTable}?select=setting_key,setting_value,updated_at&setting_key=eq.${encodeURIComponent(settingKey)}&limit=1`;
                const data=await request(path,{method:'GET'});
                return Array.isArray(data)&&data.length?data[0]:null;
            },
            async upsertRuntimeSetting(settingKey,settingValue){
                if(!settingKey)throw new Error('缺少 setting key。');
                const data=await request(`/rest/v1/${runtimeTable}`,{
                    method:'POST',
                    headers:{
                        apikey:serviceRoleKey,
                        Authorization:'Bearer '+serviceRoleKey,
                        'Content-Type':'application/json',
                        Prefer:'resolution=merge-duplicates,return=representation'
                    },
                    body:JSON.stringify([{
                        setting_key:settingKey,
                        setting_value:settingValue||{}
                    }])
                });
                return Array.isArray(data)&&data.length?data[0]:null;
            },
            async writeSharedCommunityQrConfig(src){
                if(!src)throw new Error('缺少共享二维码地址。');
                const payload={
                    src:src,
                    updated_at:new Date().toISOString()
                };
                await uploadSharedObject(sharedQrConfigPath,JSON.stringify(payload,null,2),'application/json');
                return payload;
            },
            async uploadSharedCommunityQr(dataUrl){
                const payload=dataUrlToUploadPayload(dataUrl);
                const stamp=Date.now();
                const imagePath=`community/user-cocreation-group-${stamp}.${payload.ext}`;
                await uploadSharedObject(imagePath,payload.body,payload.mime);
                const src=`${buildPublicObjectUrl(imagePath)}?v=${stamp}`;
                await this.writeSharedCommunityQrConfig(src);
                return src;
            }
        };
    }

    function createCloudAdminDataSource(password){
        async function invoke(action,payload){
            if(!window.rtAccountService||typeof window.rtAccountService.invokeFunction!=='function'){
                throw new Error('云端后台接口还没加载，请刷新页面后再试。');
            }
            if(!password)throw new Error('后台密码已失效，请重新打开后台输入密码。');
            return await window.rtAccountService.invokeFunction(ADMIN_API_FUNCTION,Object.assign({
                action:action,
                password:password
            },payload||{}));
        }

        return {
            async listAccounts(){
                const payload=await invoke('list_accounts');
                return Array.isArray(payload&&payload.accounts)?payload.accounts:[];
            },
            async listEvents(days,limit){
                const payload=await invoke('list_events',{
                    days:days||30,
                    limit:limit||3000
                });
                return Array.isArray(payload&&payload.events)?payload.events:[];
            },
            async updateAccount(patch){
                const payload=await invoke('update_account',{patch:patch||{}});
                return payload&&payload.account||null;
            },
            async getUserWorkspace(authUserId){
                const payload=await invoke('get_user_workspace',{auth_user_id:authUserId||''});
                return decodeUserWorkspaceRow(payload&&payload.workspace||null);
            },
            async getUserWorkspaces(authUserIds){
                const payload=await invoke('get_user_workspaces',{auth_user_ids:Array.isArray(authUserIds)?authUserIds:[]});
                const workspaceMap=new Map();
                (Array.isArray(payload&&payload.workspaces)?payload.workspaces:[]).forEach(function(row){
                    const decoded=decodeUserWorkspaceRow(row);
                    if(decoded&&decoded.user_id)workspaceMap.set(decoded.user_id,decoded);
                });
                return workspaceMap;
            },
            async upsertRuntimeSetting(settingKey,settingValue){
                const payload=await invoke('upsert_runtime_setting',{
                    setting_key:settingKey,
                    setting_value:settingValue||{}
                });
                return payload&&payload.setting||null;
            },
            async writeSharedCommunityQrConfig(src){
                const payload=await invoke('write_shared_community_qr_config',{src:src||''});
                return payload&&payload.setting||null;
            },
            async uploadSharedCommunityQr(dataUrl){
                const payload=await invoke('upload_shared_community_qr',{data_url:dataUrl||''});
                return payload&&payload.src||'';
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

    function formatAccountMode(account){
        return account&&account.auth_mode==='registered'?'注册账号':'体验账号';
    }

    function compactId(value,length){
        const text=String(value||'').replace(/^legacy:/,'').trim();
        if(!text)return'--';
        const safeLength=Math.max(4,Number(length)||6);
        return text.length<=safeLength?text:text.slice(0,safeLength);
    }

    function isUuidLike(value){
        const text=String(value||'').trim();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
            || /^[0-9a-f-]{24,}$/i.test(text);
    }

    function getRemainingMembershipDays(account){
        if(!account||!account.membership_expires_at)return null;
        const expiresAt=new Date(account.membership_expires_at).getTime();
        if(Number.isNaN(expiresAt))return null;
        return Math.max(0,Math.ceil((expiresAt-Date.now())/86400000));
    }

    function getHasPaidAccess(account){
        if(!account)return false;
        if(typeof account.has_paid_access==='boolean')return account.has_paid_access;
        const membership=String(account.membership_tier||'trial');
        if(account.is_lifetime||membership==='lifetime'||membership==='granted'||membership==='owner'||membership==='admin'){
            return true;
        }
        if(membership==='monthly'){
            if(!account.membership_expires_at)return true;
            const expiresAt=new Date(account.membership_expires_at).getTime();
            return !Number.isNaN(expiresAt)&&expiresAt>Date.now();
        }
        return false;
    }

    function getTrialQuotaSnapshot(account){
        const trialLimit=Math.max(0,Number(account&&account.trial_prepare_limit)||0);
        const bonusCredits=Math.max(0,Number(account&&account.bonus_prepare_credits)||0);
        const usedCredits=Math.max(0,Number(account&&account.used_prepare_credits)||0);
        const total=Math.max(trialLimit+bonusCredits,0);
        const remaining=Math.max(total-usedCredits,0);
        return {total:total,remaining:remaining,used:usedCredits};
    }

    function getAccountStatusNote(account){
        if(!account)return'';
        const membership=getMembershipKey(account);
        const quotaSnapshot=getTrialQuotaSnapshot(account);
        if(account.status==='pending'){
            return '账号已经注册，但邮箱或登录确认还没完成，所以当前仍处于待激活状态。';
        }
        if(account.status==='paused'){
            return '这个账号已经被暂停，暂停期间不会按正常会员权益继续使用。';
        }
        if(account.status==='history'){
            return '这是旧埋点快照用户，只用于历史分析，不会直接写回真实会员状态。';
        }
        if(membership==='lifetime'||account.is_lifetime){
            return '买断已生效，当前为永久会员。';
        }
        if(membership==='monthly'){
            const remainingDays=getRemainingMembershipDays(account);
            if(remainingDays===null)return '月会员已生效，但当前没有记录精确到期时间。';
            return remainingDays>0
                ? `月会员还剩 ${remainingDays} 天，到期日 ${formatDate(account.membership_expires_at)}。`
                : `月会员已经到期，到期日 ${formatDate(account.membership_expires_at)}。`;
        }
        return `当前还是试用状态，剩余 ${quotaSnapshot.remaining} / ${quotaSnapshot.total} 次准备机会。`;
    }

    function getActionSuccessMessage(account,action){
        const name=account&&account.display_name||account&&account.email||'该账号';
        if(action==='trial'){
            return {title:'体验次数已增加',message:`${name} 现在多了 1 次体验机会。`};
        }
        if(action==='monthly'){
            const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
            return {title:'月会员已开通',message:`${name} 已升级为月会员，预计到期日 ${formatDate(expiresAt)}。`};
        }
        if(action==='lifetime'){
            return {title:'买断已生效',message:`${name} 现在是永久会员。`};
        }
        if(action==='pause'){
            return {title:'账号已暂停',message:`${name} 已被暂停。`};
        }
        if(action==='activate'){
            return {title:'账号已恢复',message:`${name} 现在重新回到活跃状态。`};
        }
        return {title:'已设回试用',message:`${name} 已恢复为试用状态。`};
    }

    function buildLegacyAccountId(rawKey){
        return 'legacy_'+String(rawKey||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48);
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
                    trial_prepare_limit:(event.user_id||isRegisteredEvent)?1:1,
                    bonus_prepare_credits:(event.user_id||isRegisteredEvent)?1:0,
                    used_prepare_credits:0,
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
                existing.account.bonus_prepare_credits=Math.max(existing.account.bonus_prepare_credits||0,1);
            }
            if(isRegisteredEvent){
                existing.account.auth_mode='registered';
                existing.account.auth_user_id=event.actor_id;
                existing.account.display_name='历史注册用户 '+String(event.actor_id).slice(0,8);
                existing.account.bonus_prepare_credits=Math.max(existing.account.bonus_prepare_credits||0,1);
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
        return {accounts:Array.from(actorMap.values()),events:legacyEvents};
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

    function isMeaningfulEvent(event){
        return !!(event&&event.event_name&&!NOISY_EVENT_NAMES.has(event.event_name));
    }

    function getEventSignalScore(eventName){
        return EVENT_SIGNAL_SCORES[eventName]||30;
    }

    function getFilteredAccounts(){
        const query=state.filters.query.trim().toLowerCase();
        return getCombinedAccounts().filter(function(entry){
            const account=entry.account||{};
            const membership=getMembershipKey(account);
            const assetStats=getWorkspaceStatsFromCache(account);
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
            if(state.filters.assetState==='has_resume'&&assetStats.resumeCount<=0)return false;
            if(state.filters.assetState==='has_real_app'&&assetStats.appCount<=0)return false;
            if(state.filters.assetState==='has_prepare'&&assetStats.prepareCount<=0)return false;
            if(daysAgoFrom(account.last_seen_at)>state.filters.rangeDays)return false;
            return true;
        });
    }

    function getFilteredEvents(){
        return getCombinedEvents().filter(function(event){
            return daysAgoFrom(event.created_at)<=state.filters.rangeDays;
        });
    }

    function getAccountById(accountId){
        return getCombinedAccounts().find(function(entry){
            return entry&&entry.account&&entry.account.id===accountId;
        })||null;
    }

    function ensureSelectedAccount(accounts){
        const currentAccounts=Array.isArray(accounts)?accounts:getFilteredAccounts();
        const accountsToUse=currentAccounts;
        if(accountsToUse.some(function(entry){return entry.account&&entry.account.id===state.selectedAccountId;})){
            return;
        }
        const preferred=accountsToUse.find(function(entry){
            return entry&&entry.account&&entry.account.auth_user_id;
        })||accountsToUse[0]||null;
        state.selectedAccountId=preferred&&preferred.account&&preferred.account.id||'';
    }

    function getWorkspaceForAccount(accountId){
        const detail=state.detailCache.get(accountId);
        return detail&&detail.workspace||null;
    }

    function buildAccountSummaryMap(accounts,events){
        const accountList=Array.isArray(accounts)?accounts:[];
        const eventList=Array.isArray(events)?events:[];
        const byId=new Map();
        const byGuest=new Map();
        const byEmail=new Map();
        const eventMap=new Map();

        accountList.forEach(function(entry){
            const account=entry&&entry.account||{};
            if(account.id)byId.set(account.id,entry);
            if(account.guest_id)byGuest.set(account.guest_id,entry);
            if(account.email)byEmail.set(String(account.email).toLowerCase(),entry);
            if(account.id)eventMap.set(account.id,[]);
        });

        eventList.forEach(function(event){
            let entry=null;
            if(event.account_id&&byId.has(event.account_id)){
                entry=byId.get(event.account_id);
            }else if(event.guest_id&&byGuest.has(event.guest_id)){
                entry=byGuest.get(event.guest_id);
            }else if(event.props&&event.props.user_id&&byEmail.has(String(event.props.user_id).toLowerCase())){
                entry=byEmail.get(String(event.props.user_id).toLowerCase());
            }
            const accountId=entry&&entry.account&&entry.account.id;
            if(!accountId)return;
            if(!eventMap.has(accountId))eventMap.set(accountId,[]);
            eventMap.get(accountId).push(event);
        });

        function buildStage(account,stats,lastSeenDays){
            if(account.status==='paused'){
                return {
                    label:'已暂停',
                    tone:'critical',
                    note:'这个账号已被手动暂停。'
                };
            }
            if(account.status==='pending'){
                return {
                    label:'待激活',
                    tone:'muted',
                    note:'注册流程还没完成。'
                };
            }
            if(lastSeenDays>21&&(stats.resumeCount>0||stats.appCount>0||stats.prepareCount>0||account.auth_mode==='registered')){
                return {
                    label:'沉默中',
                    tone:'muted',
                    note:`已经 ${Math.floor(lastSeenDays)} 天没有回来。`
                };
            }
            if(stats.prepareCount>0){
                return {
                    label:'准备中',
                    tone:'positive',
                    note:'已经进入准备或练习阶段。'
                };
            }
            if(stats.appCount>0){
                return {
                    label:'已投递',
                    tone:'accent',
                    note:'已经有投递，但还没进入准备。'
                };
            }
            if(stats.resumeCount>0){
                return {
                    label:'已传简历',
                    tone:'accent',
                    note:'资料起步了，但还没形成投递。'
                };
            }
            if(account.auth_mode==='registered'){
                return {
                    label:'已注册待填写',
                    tone:'muted',
                    note:'已经注册，但还没传简历或建投递。'
                };
            }
            return {
                label:'体验浏览',
                tone:'muted',
                note:'还停留在体验阶段。'
            };
        }

        const summaries=new Map();
        accountList.forEach(function(entry){
            const account=entry&&entry.account||{};
            const accountId=account.id||'';
            const detail=state.detailCache.get(accountId)||null;
            const workspace=detail&&detail.workspace||null;
            const workspaceApps=getMeaningfulApplications(workspace&&workspace.apps);
            const workspaceResumes=Array.isArray(workspace&&workspace.resumes)?workspace.resumes:[];
            const workspacePrepare=Array.isArray(workspace&&workspace.prepare_sessions)?workspace.prepare_sessions:[];
            const workspaceRefs=Array.isArray(workspace&&workspace.refs)?workspace.refs:[];
            const relatedEvents=(eventMap.get(accountId)||[]).filter(isMeaningfulEvent);
            const prioritizedEvents=relatedEvents.slice().sort(function(a,b){
                const scoreDiff=getEventSignalScore(b&&b.event_name)-getEventSignalScore(a&&a.event_name);
                if(scoreDiff!==0)return scoreDiff;
                return new Date(b&&b.created_at||0).getTime()-new Date(a&&a.created_at||0).getTime();
            });
            const eventNames=new Set(relatedEvents.map(function(item){return item.event_name;}));
            const fallbackResumeCount=(eventNames.has('rt_resume_uploaded')||eventNames.has('rt_resume_created'))?1:0;
            const fallbackAppCount=eventNames.has('rt_application_created')?1:0;
            const fallbackPrepareCount=(eventNames.has('rt_prepare_access_consumed')||eventNames.has('rt_prepare_session_created'))?1:0;
            const stats={
                resumeCount:Math.max(workspaceResumes.length,fallbackResumeCount),
                appCount:Math.max(workspaceApps.length,fallbackAppCount),
                prepareCount:Math.max(workspacePrepare.length,fallbackPrepareCount),
                reflectionCount:workspaceRefs.length
            };
            const latestEvent=prioritizedEvents[0]||null;
            const lastSeenAt=account.last_seen_at||account.created_at||workspace&&workspace.updated_at||'';
            const lastSeenDays=daysAgoFrom(lastSeenAt);
            const nickname=String(workspace&&workspace.settings&&workspace.settings.profileNickname||'').trim();
            const rawDisplay=String(account.display_name||'').trim();
            const userLabel=nickname
                || ((rawDisplay&&!/^历史(访客|注册用户)/.test(rawDisplay)&&!isUuidLike(rawDisplay))?rawDisplay:'')
                || account.email
                || `${account.auth_mode==='registered'?'注册用户':'体验用户'} · ${compactId(account.auth_user_id||account.guest_id||account.id,6)}`;
            const secondaryLabel=account.email&&account.email!==userLabel
                ? account.email
                : `${formatAccountMode(account)} · ${formatMembership(account)}${getHasPaidAccess(account)?' · 付费中':''}`;
            const lastActionLabel=latestEvent
                ? (EVENT_LABELS[latestEvent.event_name]||latestEvent.event_name||'最近有动作')
                : (workspace&&workspace.updated_at?'更新资料':'暂无关键动作');
            const stage=buildStage(account,stats,lastSeenDays);
            let suggestion='先观察。';
            if(stage.label==='已注册待填写'){
                suggestion='值得跟进上传简历，这类账号已经迈过注册门槛。';
            }else if(stage.label==='已传简历'){
                suggestion='下一步最值得推动的是新建投递，把简历真正挂到岗位上。';
            }else if(stage.label==='已投递'){
                suggestion='已经有岗位目标了，最适合引导进入准备台。';
            }else if(stage.label==='准备中'){
                suggestion='优先看最近准备会话和复盘，判断是否能转付费或持续留存。';
            }else if(stage.label==='沉默中'){
                suggestion='这类账号已经冷下来，适合按是否有简历/投递决定是否召回。';
            }else if(stage.label==='体验浏览'){
                suggestion='还处在试用期，先看是否愿意注册。';
            }else if(stage.label==='已暂停'){
                suggestion='暂停账号无需继续推动，除非要恢复权益。';
            }
            summaries.set(accountId,{
                account:account,
                workspace:workspace,
                detail:detail,
                userLabel:userLabel,
                secondaryLabel:secondaryLabel,
                stats:stats,
                stage:stage,
                lastActionLabel:lastActionLabel,
                lastActionAt:latestEvent&&latestEvent.created_at||workspace&&workspace.updated_at||lastSeenAt,
                lastSeenAt:lastSeenAt,
                relatedEvents:prioritizedEvents,
                suggestion:suggestion
            });
        });
        return summaries;
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
            dayBuckets.set(key,{date:key,entered:0,auth:0,register:0,create:0,prepare:0});
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

    function renderMetrics(accounts,summaryMap){
        const container=$('admin-metric-grid');
        if(!container)return;
        const currentAccounts=Array.isArray(accounts)?accounts:getFilteredAccounts();
        const summaries=summaryMap||state.summaryMap||new Map();
        const summaryList=currentAccounts.map(function(entry){
            return summaries.get(entry&&entry.account&&entry.account.id)||null;
        }).filter(Boolean);
        const cards=[
            {label:'注册账号',value:currentAccounts.filter(function(item){return item.account&&item.account.auth_mode==='registered';}).length,note:'至少完成了注册'},
            {label:'有简历',value:summaryList.filter(function(item){return item.stats.resumeCount>0;}).length,note:'点进去前就能确认资料量'},
            {label:'有投递',value:summaryList.filter(function(item){return item.stats.appCount>0;}).length,note:'只统计真实投递'},
            {label:'已进入准备',value:summaryList.filter(function(item){return item.stats.prepareCount>0;}).length,note:'已经开始用准备台'},
            {label:'付费用户',value:currentAccounts.filter(function(item){
                const account=item.account||{};
                return getMembershipKey(account)==='monthly'||getMembershipKey(account)==='lifetime';
            }).length,note:'月会员或买断'}
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
                    <p>这里不追求复杂图表，重点是让你快速看出这几天到底是登录多、创建多，还是准备消耗多。</p>
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

    function renderModeBoard(){
        const node=$('admin-mode-note');
        if(!node)return;
        if(state.accessMode==='local_service_role'){
            node.textContent=state.liveSync?'本地实时可写':'本地手动同步';
            return;
        }
        if(state.accessMode==='cloud_edge'){
            node.textContent=state.liveSync?'云端实时可写':'云端手动同步';
            return;
        }
        node.textContent='等待实时后台';
    }

    function renderQrManager(){
        if(!runtimeSettings)return;
        const preview=$('admin-qr-preview-shared');
        if(preview)preview.src=runtimeSettings.getCommunityQr('shared');
    }

    async function syncSharedCommunityQrFromRemote(){
        if(!runtimeSettings||typeof runtimeSettings.syncFromRemote!=='function')return;
        await runtimeSettings.syncFromRemote(true);
        renderQrManager();
    }

    function renderAccounts(accounts,summaryMap){
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
        const currentAccounts=Array.isArray(accounts)?accounts:getFilteredAccounts();
        const summaries=summaryMap||state.summaryMap||new Map();
        const summaryList=currentAccounts.map(function(entry){
            return summaries.get(entry&&entry.account&&entry.account.id)||null;
        }).filter(Boolean);
        const resumeUsers=summaryList.filter(function(item){return item.stats.resumeCount>0;}).length;
        const applyUsers=summaryList.filter(function(item){return item.stats.appCount>0;}).length;
        if(meta)meta.textContent=`当前 ${currentAccounts.length} 个账号 · ${resumeUsers} 个有简历 · ${applyUsers} 个有真实投递`;
        if(syncMeta)syncMeta.textContent=`最近同步：${escapeHTML(formatTime(state.lastSyncAt))}`;
        if(bulkMeta)bulkMeta.textContent=`已选 ${state.selectedIds.size} 个账号`;
        if(selectAll)selectAll.checked=!!currentAccounts.length&&currentAccounts.every(function(item){
            return state.selectedIds.has(item.account&&item.account.id);
        });
        if(!currentAccounts.length){
            list.innerHTML='<div class="admin-empty">当前筛选下没有账号，换个条件试试。</div>';
            return;
        }
        list.innerHTML=`
            <div class="admin-account-list-head">
                <span></span>
                <span>用户</span>
                <span>资料概况</span>
                <span>当前阶段</span>
                <span>最近动作</span>
                <span>最后活跃</span>
            </div>
            ${currentAccounts.map(function(entry){
            const account=entry.account||{};
            const id=account.id||'';
            const isLegacy=account.admin_source==='legacy_snapshot';
            const isReadonly=isLegacy||!state.canManage;
            const summary=summaries.get(id)||{
                userLabel:account.display_name||account.email||account.guest_id||'履迹用户',
                secondaryLabel:account.email||account.guest_id||'未记录邮箱',
                stats:{resumeCount:0,appCount:0,prepareCount:0,reflectionCount:0},
                stage:{label:formatAccountStatus(account.status||'active'),tone:'muted'},
                lastActionLabel:'暂无关键动作',
                lastSeenAt:account.last_seen_at||account.created_at||''
            };
            return `<article class="admin-account-row ${state.selectedAccountId===id?'is-selected':''}" data-account-row="${escapeHTML(id)}">
                <label class="admin-account-check">
                    <input type="checkbox" data-select-account="${escapeHTML(id)}" ${state.selectedIds.has(id)?'checked':''} ${isReadonly?'disabled':''}>
                </label>
                <div class="admin-account-user">
                    <strong>${escapeHTML(summary.userLabel)}</strong>
                    <span>${escapeHTML(summary.secondaryLabel)}</span>
                </div>
                <div class="admin-account-col">
                    <div class="admin-account-facts">
                        <span>简历 ${escapeHTML(summary.stats.resumeCount)}</span>
                        <span>投递 ${escapeHTML(summary.stats.appCount)}</span>
                        <span>准备 ${escapeHTML(summary.stats.prepareCount)}</span>
                    </div>
                </div>
                <div class="admin-account-col"><span class="admin-chip" data-tone="${escapeHTML(summary.stage.tone||'muted')}">${escapeHTML(summary.stage.label)}</span></div>
                <div class="admin-account-col admin-account-action">
                    <strong>${escapeHTML(summary.lastActionLabel)}</strong>
                </div>
                <div class="admin-account-col admin-account-time">${escapeHTML(formatDateShort(summary.lastSeenAt))}</div>
            </article>`;
        }).join('')}`;
    }

    function getInitials(text){
        const source=String(text||'').trim();
        if(!source)return'RT';
        const compact=source.replace(/\s+/g,'');
        return compact.slice(0,2).toUpperCase();
    }

    function normalizeUserApp(app){
        if(typeof window.normalizeAppRecord==='function')return window.normalizeAppRecord(app);
        return app||{};
    }

    function getPlaceholderApplicationSignature(app){
        const normalized=normalizeUserApp(app);
        return [
            String(normalized.company_name||'').trim(),
            String(normalized.position_title||'').trim(),
            String(normalized.base_location||'').trim(),
            String(normalized.source_channel||'').trim()
        ].join('|');
    }

    function isPlaceholderApplication(app){
        const normalized=normalizeUserApp(app);
        if(!normalized||typeof normalized!=='object')return false;
        if(normalized.is_starter_placeholder||normalized.seeded_demo||normalized.placeholder_seed)return true;
        return PLACEHOLDER_APPLICATION_SIGNATURES.has(getPlaceholderApplicationSignature(normalized));
    }

    function getMeaningfulApplications(apps){
        return (Array.isArray(apps)?apps:[])
            .map(normalizeUserApp)
            .filter(function(app){return !isPlaceholderApplication(app);});
    }

    function getWorkspaceStatsFromCache(account){
        const accountId=account&&account.id||'';
        const detail=state.detailCache.get(accountId)||null;
        const workspace=detail&&detail.workspace||null;
        return {
            resumeCount:Array.isArray(workspace&&workspace.resumes)?workspace.resumes.length:0,
            appCount:getMeaningfulApplications(workspace&&workspace.apps).length,
            prepareCount:Array.isArray(workspace&&workspace.prepare_sessions)?workspace.prepare_sessions.length:0
        };
    }

    function getResumeLabel(resume){
        return resume&&resume.file_name||resume&&resume.orig||'未命名简历';
    }

    function isPdfResume(resume){
        return String(resume&&resume.file_type||'').toUpperCase()==='PDF';
    }

    function ensureSelectedResumeId(accountId,resumes){
        const current=state.detailResumeSelection.get(accountId)||'';
        const list=Array.isArray(resumes)?resumes:[];
        if(current&&list.some(function(item){return item&&item.id===current;})){
            return current;
        }
        const next=list[0]&&list[0].id||'';
        if(next)state.detailResumeSelection.set(accountId,next);
        return next;
    }

    function openAdminResumePreview(resume){
        if(!resume||!resume.data_url){
            showToast('无法预览','这份简历没有可打开的文件数据。','error');
            return;
        }
        const popup=window.open('','_blank');
        if(!popup){
            showToast('预览被拦截','请允许浏览器弹窗后再试。','error');
            return;
        }
        popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(getResumeLabel(resume))}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{height:100%;margin:0;background:#0b0f17;color:#f5f7fb;font-family:Inter,\"Noto Sans SC\",system-ui,sans-serif}body{display:flex;align-items:center;justify-content:center}iframe,embed{width:100%;height:100%;border:0}a{color:#f5f7fb;text-decoration:none;padding:12px 18px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.06)}p{color:#9aa3b2}</style></head><body><p>正在打开简历…</p></body></html>`);
        popup.document.close();
        if(isPdfResume(resume)){
            popup.document.body.innerHTML=`<iframe src="${resume.data_url}#toolbar=0&navpanes=0&scrollbar=0" title="${escapeHTML(getResumeLabel(resume))}"></iframe>`;
            return;
        }
        popup.document.body.innerHTML=`<a href="${resume.data_url}" download="${escapeHTML(resume.orig||getResumeLabel(resume))}">当前文件格式不支持直接内嵌预览，点这里下载</a>`;
    }

    function renderUserDetail(){
        const container=$('admin-user-detail');
        if(!container)return;
        const entry=getAccountById(state.selectedAccountId);
        if(!entry||!entry.account){
            container.innerHTML='<div class="admin-detail-empty">先从左边选一个用户。右侧只保留这人的概况、投递和简历，不再堆多余说明。</div>';
            return;
        }
        const account=entry.account||{};
        if(state.detailLoadingId&&state.detailLoadingId===account.id){
            container.innerHTML='<div class="admin-detail-loading">正在拉这个用户的投递表和简历数据…</div>';
            return;
        }
        const detail=state.detailCache.get(account.id)||null;
        const summary=state.summaryMap.get(account.id)||null;
        const workspace=detail&&detail.workspace||null;
        const apps=getMeaningfulApplications(workspace&&workspace.apps);
        const resumes=Array.isArray(workspace&&workspace.resumes)?workspace.resumes:[];
        const prepareSessions=Array.isArray(workspace&&workspace.prepare_sessions)?workspace.prepare_sessions:[];
        const reflections=Array.isArray(workspace&&workspace.refs)?workspace.refs:[];
        const resumeMap=new Map(resumes.map(function(resume){return[resume.id,resume];}));
        const matchingEvents=(summary&&summary.relatedEvents||[]).slice(0,6);
        const summaryNote=detail&&detail.note
            ? detail.note
            : workspace
                ? `这份详情最后同步于 ${formatTime(workspace.updated_at)}。`
                : account.auth_mode==='guest'
                    ? '体验账号通常只会留下账号层级数据，当前没有云端投递表或简历详情。'
                    : '这个账号当前还没有同步出投递表或简历内容。';
        const selectedResumeId=ensureSelectedResumeId(account.id,resumes);
        const selectedResume=resumes.find(function(item){return item&&item.id===selectedResumeId;})||resumes[0]||null;
        const keyActions=matchingEvents.slice(0,4);
        const tabs=[
            {key:'overview',label:'概况'},
            {key:'applications',label:`投递 ${apps.length}`},
            {key:'resumes',label:`简历 ${resumes.length}`}
        ];
        const overviewPanel=`
            <section class="admin-detail-stage">
                <div class="admin-detail-stage-head">
                    <div>
                        <strong>${escapeHTML(summary&&summary.stage&&summary.stage.label||'当前阶段')}</strong>
                        <p>${escapeHTML(summary&&summary.stage&&summary.stage.note||'当前没有额外判断。')}</p>
                    </div>
                    <span class="admin-chip" data-tone="${escapeHTML(summary&&summary.stage&&summary.stage.tone||'muted')}">${escapeHTML(summary&&summary.lastActionLabel||'暂无关键动作')}</span>
                </div>
                <div class="admin-summary-grid">
                    <div class="admin-summary-card"><span>简历</span><strong>${escapeHTML(summary&&summary.stats?summary.stats.resumeCount:resumes.length)}</strong></div>
                    <div class="admin-summary-card"><span>投递</span><strong>${escapeHTML(summary&&summary.stats?summary.stats.appCount:apps.length)}</strong></div>
                    <div class="admin-summary-card"><span>准备</span><strong>${escapeHTML(summary&&summary.stats?summary.stats.prepareCount:prepareSessions.length)}</strong></div>
                    <div class="admin-summary-card"><span>复盘</span><strong>${escapeHTML(summary&&summary.stats?summary.stats.reflectionCount:reflections.length)}</strong></div>
                </div>
                <div class="admin-compact-grid">
                    <article class="admin-detail-panel">
                        <h4>账号与权益</h4>
                        <div class="admin-identity-list">
                            <div class="admin-identity-row"><strong>账号</strong><span>${escapeHTML(account.id||'--')}</span></div>
                            <div class="admin-identity-row"><strong>Auth</strong><span>${escapeHTML(account.auth_user_id||'未绑定')}</span></div>
                            <div class="admin-identity-row"><strong>会员</strong><span>${escapeHTML(getAccountStatusNote(account))}</span></div>
                            <div class="admin-identity-row"><strong>最近活跃</strong><span>${escapeHTML(formatTime(account.last_seen_at))}</span></div>
                        </div>
                    </article>
                    <article class="admin-detail-panel">
                        <h4>建议动作</h4>
                        <div class="admin-identity-list">
                            <div class="admin-identity-row"><strong>当前建议</strong><span>${escapeHTML(summary&&summary.suggestion||'先观察这个账号的下一步动作。')}</span></div>
                            <div class="admin-identity-row"><strong>来源</strong><span>${escapeHTML(account.source_channel||'未记录')}</span></div>
                            <div class="admin-identity-row"><strong>备注</strong><span>${escapeHTML(account.notes||'暂无备注')}</span></div>
                        </div>
                    </article>
                </div>
                <article class="admin-detail-panel">
                    <h4>最近关键动作</h4>
                    <div class="admin-keyline-list">
                        ${keyActions.length?keyActions.map(function(event){
                            return `<div class="admin-keyline-item">
                                <strong>${escapeHTML(EVENT_LABELS[event.event_name]||event.event_name||'event')}</strong>
                                <span>${escapeHTML(formatTime(event.created_at))}</span>
                            </div>`;
                        }).join(''):'<div class="admin-empty">当前没有关键动作。</div>'}
                    </div>
                </article>
            </section>
        `;
        const applicationsPanel=`
            <section class="admin-detail-section">
                <h4>投递表</h4>
                <div class="admin-record-list">
                    ${apps.length?apps.slice(0,10).map(function(app){
                        const linkedResume=app.resume_id?resumeMap.get(app.resume_id):null;
                        return `<article class="admin-record-card">
                            <strong>${escapeHTML(app.company_name||'未知公司')} · ${escapeHTML(app.position_title||'未知岗位')}</strong>
                            <div class="admin-record-meta">
                                <span>${escapeHTML(app.status||'未记录状态')}</span>
                                <span>${escapeHTML(app.base_location||'未填写地点')}</span>
                                ${linkedResume?`<span>简历：${escapeHTML(getResumeLabel(linkedResume))}</span>`:''}
                            </div>
                            <p>${escapeHTML(app.next_action||app.notes||`${app.applied_date||'未填日期'} · ${app.source_channel||'未填渠道'}`)}</p>
                        </article>`;
                    }).join(''):'<div class="admin-empty">这个用户当前还没有真实投递条目。</div>'}
                </div>
            </section>
        `;
        const resumesPanel=`
            <section class="admin-detail-section">
                <h4>简历</h4>
                ${resumes.length?`
                    <div class="admin-resume-workspace">
                        <div class="admin-resume-list">
                            ${resumes.map(function(resume){
                                const linkedCount=apps.filter(function(app){return app.resume_id===resume.id;}).length;
                                return `<button type="button" class="admin-resume-item ${selectedResume&&selectedResume.id===resume.id?'is-selected':''}" data-resume-select="${escapeHTML(resume.id||'')}">
                                    <strong>${escapeHTML(getResumeLabel(resume))}</strong>
                                    <span>${escapeHTML((resume.file_type||'文件').toUpperCase())} · 关联 ${linkedCount} 个岗位</span>
                                </button>`;
                            }).join('')}
                        </div>
                        <div class="admin-resume-viewer">
                            ${selectedResume?`
                                <div class="admin-resume-viewer-head">
                                    <div>
                                        <strong>${escapeHTML(getResumeLabel(selectedResume))}</strong>
                                        <span>${escapeHTML((selectedResume.file_type||'文件').toUpperCase())}${selectedResume.size?` · ${(selectedResume.size/1024).toFixed(0)}KB`:''}</span>
                                    </div>
                                    <div class="admin-inline-actions">
                                        <button type="button" class="admin-copy-btn" data-resume-open="${escapeHTML(selectedResume.id||'')}">打开</button>
                                        ${selectedResume.data_url?`<a class="admin-copy-btn" href="${selectedResume.data_url}" download="${escapeHTML(selectedResume.orig||getResumeLabel(selectedResume))}">下载</a>`:''}
                                    </div>
                                </div>
                                ${selectedResume.data_url&&isPdfResume(selectedResume)
                                    ? `<iframe class="admin-resume-frame" src="${selectedResume.data_url}#toolbar=0&navpanes=0&scrollbar=0" title="${escapeHTML(getResumeLabel(selectedResume))}"></iframe>`
                                    : `<div class="admin-empty">这份简历当前不是 PDF，后台先提供打开和下载。</div>`}
                            `:'<div class="admin-empty">还没有可预览的简历。</div>'}
                        </div>
                    </div>
                `:'<div class="admin-empty">这个用户当前还没有上传过简历。</div>'}
            </section>
        `;

        container.innerHTML=`
            <section class="admin-user-hero">
                <div class="admin-user-avatar">${escapeHTML(getInitials((workspace&&workspace.settings&&workspace.settings.profileNickname)||account.display_name||account.email||'RT'))}</div>
                <div class="admin-user-copy">
                    <div>
                        <h3>${escapeHTML(summary&&summary.userLabel||(workspace&&workspace.settings&&workspace.settings.profileNickname)||account.display_name||account.email||'履迹用户')}</h3>
                        <p>${escapeHTML(summary&&summary.secondaryLabel||account.email||account.guest_id||'未记录邮箱')}</p>
                    </div>
                    <div class="admin-user-chip-row">
                        <span class="admin-chip">${escapeHTML(formatAccountMode(account))}</span>
                        <span class="admin-chip">${escapeHTML(formatMembership(account))}</span>
                        <span class="admin-chip" data-tone="${escapeHTML(summary&&summary.stage&&summary.stage.tone||'muted')}">${escapeHTML(summary&&summary.stage&&summary.stage.label||formatAccountStatus(account.status||'active'))}</span>
                        ${account.auth_user_id?`<span class="admin-chip">${escapeHTML(account.auth_user_id.slice(0,8))}…</span>`:''}
                    </div>
                    <p>${escapeHTML(summaryNote)}</p>
                </div>
                <div class="admin-user-hero-actions">
                    ${account.id?`<button type="button" class="admin-copy-btn" data-copy-account-id="${escapeHTML(account.id)}">复制账号 ID</button>`:''}
                    ${account.auth_user_id?`<button type="button" class="admin-copy-btn" data-copy-auth-id="${escapeHTML(account.auth_user_id)}">复制 Auth ID</button>`:''}
                    ${state.canManage&&account.admin_source!=='legacy_snapshot'?`
                        <button type="button" class="admin-action-btn" data-style="highlight" data-action="trial" data-account-id="${escapeHTML(account.id)}">+1 次体验</button>
                        <button type="button" class="admin-action-btn" data-action="monthly" data-account-id="${escapeHTML(account.id)}">开月卡</button>
                        <button type="button" class="admin-action-btn" data-action="lifetime" data-account-id="${escapeHTML(account.id)}">买断</button>
                        <button type="button" class="admin-action-btn" data-style="calm" data-action="${escapeHTML(account.status==='paused'?'activate':'pause')}" data-account-id="${escapeHTML(account.id)}">${escapeHTML(account.status==='paused'?'恢复活跃':'暂停账号')}</button>
                    `:''}
                </div>
            </section>
            <section class="admin-detail-switcher">
                ${tabs.map(function(tab){
                    return `<button type="button" class="admin-detail-tab ${state.detailTab===tab.key?'is-active':''}" data-detail-tab="${escapeHTML(tab.key)}">${escapeHTML(tab.label)}</button>`;
                }).join('')}
            </section>

            <section class="admin-detail-body">
                ${state.detailTab==='applications'
                    ? applicationsPanel
                    : state.detailTab==='resumes'
                        ? resumesPanel
                        : overviewPanel}
            </section>
        `;
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
            await adminDataSource.updateAccount({id:accountId,status:'paused'});
        }else if(action==='activate'){
            await adminDataSource.updateAccount({id:accountId,status:'active'});
        }
        state.detailCache.delete(accountId);
        return getActionSuccessMessage(account,action);
    }

    async function applyBulkAction(action){
        if(!state.canManage)return;
        const ids=Array.from(state.selectedIds);
        if(!ids.length)return;
        for(const accountId of ids){
            await applyAccountAction(accountId,action);
        }
        await refreshData({preserveScroll:true,silent:false,hydrateWorkspaceCache:true});
        if(action==='trial')showToast('批量体验已增加',`已为 ${ids.length} 个账号补充体验次数。`,'success');
        else if(action==='monthly')showToast('批量月会员已开通',`已为 ${ids.length} 个账号开通月会员。`,'success');
        else if(action==='lifetime')showToast('批量买断已生效',`已为 ${ids.length} 个账号开通永久会员。`,'success');
        else showToast('批量已设回试用',`已将 ${ids.length} 个账号恢复为试用状态。`,'success');
    }

    function syncFiltersFromInputs(){
        state.filters.query=$('admin-search-input')?.value||'';
        state.filters.authMode=$('admin-auth-filter')?.value||'all';
        state.filters.membership=$('admin-membership-filter')?.value||'all';
        state.filters.assetState=$('admin-asset-filter')?.value||'all';
        state.filters.rangeDays=Number($('admin-range-filter')?.value||30);
    }

    function renderAll(){
        const accounts=getFilteredAccounts();
        state.summaryMap=buildAccountSummaryMap(accounts,getFilteredEvents());
        ensureSelectedAccount(accounts);
        renderMetrics(accounts,state.summaryMap);
        renderModeBoard();
        renderQrManager();
        renderAccounts(accounts,state.summaryMap);
        renderUserDetail();
    }

    async function hydrateWorkspaceCacheForAccounts(accountEntries){
        if(!state.canManage||!adminDataSource||typeof adminDataSource.getUserWorkspaces!=='function')return;
        const entries=Array.isArray(accountEntries)?accountEntries:[];
        const authIds=Array.from(new Set(entries.map(function(entry){
            return entry&&entry.account&&entry.account.auth_user_id||'';
        }).filter(Boolean)));
        const workspaceMap=await adminDataSource.getUserWorkspaces(authIds);
        const nextCache=new Map(state.detailCache);
        entries.forEach(function(entry){
            const account=entry&&entry.account||{};
            if(!account.id)return;
            if(!account.auth_user_id){
                nextCache.set(account.id,{
                    workspace:null,
                    note:account.auth_mode==='guest'
                        ? '体验账号当前只会同步账号层级信息，投递表和简历大多仍停留在本地设备。'
                        : '当前没有可读取的云端资料。'
                });
                return;
            }
            const workspace=workspaceMap.get(account.auth_user_id)||null;
            nextCache.set(account.id,{
                workspace:workspace,
                note:workspace
                    ? `这份资料最后更新于 ${formatTime(workspace.updated_at)}。`
                    : '这个账号目前还没有写入 user_data。'
            });
        });
        state.detailCache=nextCache;
    }

    async function loadSelectedAccountDetail(accountId){
        const entry=getAccountById(accountId);
        if(!entry||!entry.account)return;
        const account=entry.account;
        if(state.detailCache.has(accountId))return;
        if(!account.auth_user_id||!adminDataSource||typeof adminDataSource.getUserWorkspace!=='function'){
            state.detailCache.set(accountId,{
                workspace:null,
                note:account.auth_mode==='guest'
                    ? '体验账号当前只会同步账号层级信息，投递表和简历大多仍停留在本地设备。'
                    : '实时后台还没有返回这个用户的云端投递表和简历详情。'
            });
            renderUserDetail();
            return;
        }
        state.detailLoadingId=accountId;
        renderUserDetail();
        try{
            const workspace=await adminDataSource.getUserWorkspace(account.auth_user_id);
            state.detailCache.set(accountId,{
                workspace:workspace,
                note:workspace?`这份资料最后更新于 ${formatTime(workspace.updated_at)}。`:'这个账号目前还没有写入 user_data。'
            });
        }catch(error){
            state.detailCache.set(accountId,{
                workspace:null,
                note:error instanceof Error?error.message:String(error)
            });
        }finally{
            state.detailLoadingId='';
            renderAll();
        }
    }

    async function selectAccount(accountId){
        state.selectedAccountId=accountId||'';
        renderAccounts();
        renderUserDetail();
        if(accountId){
            await loadSelectedAccountDetail(accountId);
        }
    }

    async function refreshData(options){
        const opts=Object.assign({preserveScroll:false,silent:false,hydrateWorkspaceCache:true},options||{});
        const scrollTop=opts.preserveScroll?window.scrollY:0;
        syncFiltersFromInputs();
        state.loading=!opts.silent;
        state.error='';
        if(!opts.silent)renderAll();
        try{
            if(adminDataSource&&state.canManage){
                state.legacyAccounts=[];
                state.legacyEvents=[];
                state.backendAccounts=await adminDataSource.listAccounts();
                state.backendEvents=await adminDataSource.listEvents(state.filters.rangeDays,3000);
                if(opts.hydrateWorkspaceCache){
                    await hydrateWorkspaceCacheForAccounts(state.backendAccounts);
                }
            }else{
                state.backendAccounts=[];
                state.backendEvents=[];
                state.legacyAccounts=[];
                state.legacyEvents=[];
                throw new Error('实时后台未连接，请重新输入管理密码。');
            }
            state.lastSyncAt=new Date().toISOString();
        }catch(error){
            state.error=error instanceof Error?error.message:String(error);
        }finally{
            state.loading=false;
            renderAll();
            if(state.selectedAccountId){
                loadSelectedAccountDetail(state.selectedAccountId).catch(function(){});
            }
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

    async function handleQrUpload(slot,file){
        if(!runtimeSettings||!slot||!file)return;
        const dataUrl=await new Promise(function(resolve,reject){
            const reader=new FileReader();
            reader.onload=function(){resolve(String(reader.result||''));};
            reader.onerror=function(){reject(reader.error||new Error('读取图片失败'));};
            reader.readAsDataURL(file);
        });
        let sharedSrc=dataUrl;
        if(adminDataSource&&typeof adminDataSource.uploadSharedCommunityQr==='function'){
            sharedSrc=await adminDataSource.uploadSharedCommunityQr(dataUrl);
        }
        runtimeSettings.setCommunityQr(slot,sharedSrc);
        if(adminDataSource&&typeof adminDataSource.upsertRuntimeSetting==='function'){
            await adminDataSource.upsertRuntimeSetting('community_qr',{
                src:sharedSrc,
                updated_at:new Date().toISOString()
            }).catch(function(){});
        }
        await syncSharedCommunityQrFromRemote();
        renderQrManager();
        flashQrSyncPreview(sharedSrc);
        showToast('已同步到主产品','共享二维码已经写入主产品配置，并完成同步确认。','success',{thumbnailSrc:sharedSrc});
    }

    async function boot(){
        setMainVisible(true);
        try{
            if(hasLocalAdminConfig()){
                adminDataSource=createLocalAdminDataSource(ADMIN_LOCAL_CONFIG);
                state.canManage=true;
                state.accessMode='local_service_role';
                showStatus('本地后台已连接','实时可写。可以直接看用户、改权益、换群二维码。');
                setStatusVisible(false);
                updateSyncPill();
                await syncSharedCommunityQrFromRemote();
                startLiveSync();
                await refreshData({preserveScroll:true,silent:false,hydrateWorkspaceCache:true});
                return;
            }
            adminDataSource=createCloudAdminDataSource(adminAccessPassword);
            state.canManage=true;
            state.accessMode='cloud_edge';
            showStatus('云端后台已连接','正式环境通过独立后台函数读取和写入数据。');
            setStatusVisible(false);
            updateSyncPill();
            await syncSharedCommunityQrFromRemote();
            startLiveSync();
            await refreshData({preserveScroll:true,silent:false,hydrateWorkspaceCache:true});
        }catch(error){
            state.canManage=false;
            state.accessMode='locked';
            adminDataSource=null;
            showStatus('实时后台连接失败',error instanceof Error?error.message:String(error));
            setStatusVisible(true);
            updateSyncPill();
            state.backendAccounts=[];
            state.backendEvents=[];
            state.legacyAccounts=[];
            state.legacyEvents=[];
            state.error=error instanceof Error?error.message:String(error);
            renderAll();
        }
    }

    function initAdminLock(){
        const lock=$('admin-lock');
        const form=$('admin-lock-form');
        const input=$('admin-password-input');
        const errorNode=$('admin-lock-error');
        setShellVisible(false);
        setLockVisible(true);
        if(!lock||!form||!input){
            setShellVisible(true);
            setLockVisible(false);
            boot();
            return;
        }
        window.requestAnimationFrame(function(){input.focus();});
        form.addEventListener('submit',function(event){
            event.preventDefault();
            const password=input.value||'';
            if(errorNode)errorNode.textContent='';
            form.classList.add('is-checking');
            Promise.resolve()
                .then(function(){return verifyAdminPassword(password);})
                .then(function(ok){
                    if(!ok){
                        if(errorNode)errorNode.textContent='密码不对，请重新输入。';
                        input.select();
                        return;
                    }
                    adminAccessPassword=password;
                    input.value='';
                    setLockVisible(false);
                    setShellVisible(true);
                    boot();
                })
                .catch(function(error){
                    if(errorNode)errorNode.textContent=error instanceof Error?error.message:String(error);
                })
                .finally(function(){
                    form.classList.remove('is-checking');
                });
        });
    }

    $('admin-refresh-btn')?.addEventListener('click',function(){
        refreshData({preserveScroll:true,silent:false,hydrateWorkspaceCache:true});
    });

    $('admin-live-toggle')?.addEventListener('change',function(event){
        state.liveSync=!!event.target.checked;
        updateSyncPill();
        renderModeBoard();
        if(state.liveSync){
            startLiveSync();
            refreshData({preserveScroll:true,silent:true,hydrateWorkspaceCache:false});
        }else{
            stopLiveSync();
        }
    });

    ['admin-search-input','admin-auth-filter','admin-membership-filter','admin-asset-filter','admin-range-filter'].forEach(function(id){
        $(id)?.addEventListener(id==='admin-search-input'?'input':'change',function(){
            syncFiltersFromInputs();
            renderAll();
            if(id==='admin-range-filter'){
                refreshData({preserveScroll:true,silent:true,hydrateWorkspaceCache:false});
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

    async function handleCopyButton(copyButton,label){
        const value=copyButton.dataset.copyAccountId||copyButton.dataset.copyAuthId||'';
        try{
            await navigator.clipboard.writeText(value);
            copyButton.textContent='已复制';
            window.setTimeout(function(){copyButton.textContent=label;},1200);
        }catch(error){
            copyButton.textContent='复制失败';
            window.setTimeout(function(){copyButton.textContent=label;},1200);
        }
    }

    $('admin-account-list')?.addEventListener('click',async function(event){
        const copyButton=event.target.closest('[data-copy-account-id]');
        if(copyButton){
            await handleCopyButton(copyButton,'复制账号 ID');
            return;
        }
        const actionButton=event.target.closest('[data-action]');
        if(actionButton){
            try{
                const result=await applyAccountAction(actionButton.dataset.accountId||'',actionButton.dataset.action||'');
                await refreshData({preserveScroll:true,silent:false,hydrateWorkspaceCache:true});
                if(result)showToast(result.title,result.message,'success');
            }catch(error){
                showToast('操作失败',error instanceof Error?error.message:String(error),'error');
            }
            return;
        }
        const row=event.target.closest('[data-account-row]');
        if(row){
            const accountId=row.dataset.accountRow||'';
            if(accountId)selectAccount(accountId);
        }
    });

    $('admin-user-detail')?.addEventListener('click',async function(event){
        const tabButton=event.target.closest('[data-detail-tab]');
        if(tabButton){
            state.detailTab=tabButton.dataset.detailTab||'overview';
            renderUserDetail();
            return;
        }
        const resumeButton=event.target.closest('[data-resume-select]');
        if(resumeButton&&state.selectedAccountId){
            state.detailResumeSelection.set(state.selectedAccountId,resumeButton.dataset.resumeSelect||'');
            renderUserDetail();
            return;
        }
        const resumeOpenButton=event.target.closest('[data-resume-open]');
        if(resumeOpenButton&&state.selectedAccountId){
            const detail=state.detailCache.get(state.selectedAccountId);
            const workspace=detail&&detail.workspace||null;
            const resumes=Array.isArray(workspace&&workspace.resumes)?workspace.resumes:[];
            const resume=resumes.find(function(item){return item&&item.id===resumeOpenButton.dataset.resumeOpen;})||null;
            openAdminResumePreview(resume);
            return;
        }
        const copyAccountButton=event.target.closest('[data-copy-account-id]');
        if(copyAccountButton){
            await handleCopyButton(copyAccountButton,'复制账号 ID');
            return;
        }
        const copyAuthButton=event.target.closest('[data-copy-auth-id]');
        if(copyAuthButton){
            await handleCopyButton(copyAuthButton,'复制 Auth ID');
            return;
        }
        const actionButton=event.target.closest('[data-action]');
        if(!actionButton)return;
        try{
            const result=await applyAccountAction(actionButton.dataset.accountId||'',actionButton.dataset.action||'');
            await refreshData({preserveScroll:true,silent:false,hydrateWorkspaceCache:true});
            if(result)showToast(result.title,result.message,'success');
        }catch(error){
            showToast('操作失败',error instanceof Error?error.message:String(error),'error');
        }
    });

    $('admin-account-list')?.addEventListener('change',function(event){
        const input=event.target.closest('[data-select-account]');
        if(!input)return;
        const accountId=input.dataset.selectAccount||'';
        if(input.checked)state.selectedIds.add(accountId);
        else state.selectedIds.delete(accountId);
        renderAccounts();
    });

    document.querySelector('.admin-bulk-actions')?.addEventListener('click',async function(event){
        const button=event.target.closest('[data-bulk-action]');
        if(!button||!state.canManage)return;
        try{
            await applyBulkAction(button.dataset.bulkAction||'');
        }catch(error){
            showToast('批量操作失败',error instanceof Error?error.message:String(error),'error');
        }
    });

    document.querySelector('.admin-qr-card')?.addEventListener('click',function(event){
        const uploadButton=event.target.closest('[data-qr-upload]');
        if(uploadButton){
            const slot=uploadButton.dataset.qrUpload||'';
            $(`admin-qr-input-${slot}`)?.click();
            return;
        }
        const resetButton=event.target.closest('[data-qr-reset]');
        if(resetButton&&runtimeSettings){
            Promise.resolve().then(async function(){
                runtimeSettings.resetCommunityQr();
                if(adminDataSource&&typeof adminDataSource.writeSharedCommunityQrConfig==='function'){
                    await adminDataSource.writeSharedCommunityQrConfig('assets/user-cocreation-group-qr.jpg');
                }
                if(adminDataSource&&typeof adminDataSource.upsertRuntimeSetting==='function'){
                    await adminDataSource.upsertRuntimeSetting('community_qr',{
                        src:'assets/user-cocreation-group-qr.jpg',
                        updated_at:new Date().toISOString()
                    }).catch(function(){});
                }
                await syncSharedCommunityQrFromRemote();
                renderQrManager();
                flashQrSyncPreview('assets/user-cocreation-group-qr.jpg');
                showToast('已同步到主产品','共享二维码已经恢复到默认图片，并完成同步确认。','success',{thumbnailSrc:'assets/user-cocreation-group-qr.jpg'});
            }).catch(function(error){
                showToast('恢复失败',error instanceof Error?error.message:String(error),'error');
            });
        }
    });

    ['shared'].forEach(function(slot){
        $(`admin-qr-input-${slot}`)?.addEventListener('change',async function(event){
            const file=event.target.files&&event.target.files[0];
            if(!file)return;
            try{
                await handleQrUpload(slot,file);
            }catch(error){
                showToast('上传失败',error instanceof Error?error.message:String(error),'error');
            }finally{
                event.target.value='';
            }
        });
    });

    window.addEventListener('rt:runtime-settings',function(){
        renderQrManager();
    });

    document.addEventListener('visibilitychange',function(){
        if(!state.liveSync)return;
        if(!document.hidden){
            refreshData({preserveScroll:true,silent:true,hydrateWorkspaceCache:false});
        }
    });

    Promise.resolve(window.RT_ADMIN_LOCAL_CONFIG_READY).finally(initAdminLock);
})();
