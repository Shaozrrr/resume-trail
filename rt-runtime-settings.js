(function(){
    const STORAGE_KEY='rt_runtime_settings_v1';
    const REMOTE_TABLE='rt_public_runtime_settings';
    const REMOTE_SETTING_KEY='community_qr';
    const SHARED_STORAGE_BUCKET='rt-shared';
    const SHARED_QR_CONFIG_PATH='runtime/community-qr.json';
    const DEFAULT_SUPABASE_URL='https://bpynqhujzvadyakypfju.supabase.co';
    const DEFAULT_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweW5xaHVqenZhZHlha3lwZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODIzMTAsImV4cCI6MjA5Mjk1ODMxMH0.sdU-HLNvVlyVstDUAesvKM_MX_4kBhxTd9OSTlRLXF8';
    const DEFAULT_SETTINGS={
        community_qr:'assets/user-cocreation-group-qr.jpg'
    };
    let settingsCache=null;
    let remoteSyncPromise=null;
    let lastRemoteSyncAt=0;

    function clone(value){
        if(typeof structuredClone==='function')return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function mergeDeep(base,override){
        if(!override||typeof override!=='object'||Array.isArray(override))return clone(base);
        const output=clone(base);
        Object.keys(override).forEach(function(key){
            const sourceValue=override[key];
            const targetValue=output[key];
            if(sourceValue&&typeof sourceValue==='object'&&!Array.isArray(sourceValue)&&targetValue&&typeof targetValue==='object'&&!Array.isArray(targetValue)){
                output[key]=mergeDeep(targetValue,sourceValue);
            }else{
                output[key]=clone(sourceValue);
            }
        });
        return output;
    }

    function readStoredSettings(){
        try{
            const raw=localStorage.getItem(STORAGE_KEY);
            if(!raw)return clone(DEFAULT_SETTINGS);
            const parsed=JSON.parse(raw);
            return mergeDeep(DEFAULT_SETTINGS,parsed||{});
        }catch(error){
            console.warn('[RT runtime] read settings failed',error);
            return clone(DEFAULT_SETTINGS);
        }
    }

    function getSettingsSnapshot(){
        if(!settingsCache)settingsCache=readStoredSettings();
        return clone(settingsCache);
    }

    function normalizeCommunityQrSrc(value){
        if(typeof value==='string'){
            const text=value.trim();
            return text||'';
        }
        if(value&&typeof value==='object'&&typeof value.src==='string'){
            const text=value.src.trim();
            return text||'';
        }
        return '';
    }

    function resolveSupabaseUrl(){
        if(typeof SUPABASE_URL==='string'&&SUPABASE_URL.trim())return SUPABASE_URL.trim();
        if(typeof window!=='undefined'&&typeof window.SUPABASE_URL==='string'&&window.SUPABASE_URL.trim())return window.SUPABASE_URL.trim();
        return DEFAULT_SUPABASE_URL;
    }

    function resolveSupabaseAnonKey(){
        if(typeof SUPABASE_KEY==='string'&&SUPABASE_KEY.trim())return SUPABASE_KEY.trim();
        if(typeof window!=='undefined'&&typeof window.SUPABASE_KEY==='string'&&window.SUPABASE_KEY.trim())return window.SUPABASE_KEY.trim();
        return DEFAULT_SUPABASE_ANON_KEY;
    }

    function encodeStoragePath(objectPath){
        return String(objectPath||'')
            .split('/')
            .filter(Boolean)
            .map(function(segment){return encodeURIComponent(segment);})
            .join('/');
    }

    function buildPublicStorageUrl(objectPath){
        return `${resolveSupabaseUrl()}/storage/v1/object/public/${SHARED_STORAGE_BUCKET}/${encodeStoragePath(objectPath)}`;
    }

    async function fetchRemoteJsonFromStorage(objectPath){
        const response=await fetch(`${buildPublicStorageUrl(objectPath)}?t=${Date.now()}`,{
            method:'GET',
            cache:'no-store'
        });
        if(response.status===404)return null;
        if(!response.ok){
            throw new Error(`shared storage fetch failed (${response.status})`);
        }
        return response.json();
    }

    function applySettings(next,options){
        const opts=options||{};
        settingsCache=mergeDeep(DEFAULT_SETTINGS,next||{});
        if(opts.persist!==false){
            localStorage.setItem(STORAGE_KEY,JSON.stringify(settingsCache));
        }
        if(opts.broadcast!==false){
            window.dispatchEvent(new CustomEvent('rt:runtime-settings',{detail:{settings:clone(settingsCache)}}));
        }
        return clone(settingsCache);
    }

    function getSharedCommunityQr(){
        const settings=getSettingsSnapshot();
        return settings.community_qr
            || (settings.community_qrs&&settings.community_qrs.modal)
            || (settings.community_qrs&&settings.community_qrs.login)
            || DEFAULT_SETTINGS.community_qr;
    }

    function applyCommunityQrs(root){
        const scope=root&&root.querySelectorAll?root:document;
        if(!scope||!scope.querySelectorAll)return;
        const src=getSharedCommunityQr();
        scope.querySelectorAll('[data-runtime-qr]').forEach(function(node){
            if(src&&node.getAttribute('src')!==src){
                node.setAttribute('src',src);
            }
        });
    }

    async function fetchRemoteCommunityQr(){
        const sharedConfig=await fetchRemoteJsonFromStorage(SHARED_QR_CONFIG_PATH).catch(function(error){
            console.warn('[RT runtime] shared storage config unavailable',error);
            return null;
        });
        const sharedSrc=normalizeCommunityQrSrc(sharedConfig);
        if(sharedSrc)return sharedSrc;
        const supabaseUrl=resolveSupabaseUrl();
        const supabaseAnonKey=resolveSupabaseAnonKey();
        const response=await fetch(
            `${supabaseUrl}/rest/v1/${REMOTE_TABLE}?select=setting_value&setting_key=eq.${encodeURIComponent(REMOTE_SETTING_KEY)}&limit=1`,
            {
                method:'GET',
                headers:{
                    apikey:supabaseAnonKey,
                    Authorization:`Bearer ${supabaseAnonKey}`
                }
            }
        );
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
                : (text||`HTTP ${response.status}`);
            throw new Error(message);
        }
        const row=Array.isArray(data)&&data.length?data[0]:null;
        return normalizeCommunityQrSrc(row&&row.setting_value);
    }

    async function syncFromRemote(force){
        if(remoteSyncPromise&&!force)return remoteSyncPromise;
        remoteSyncPromise=fetchRemoteCommunityQr().then(function(remoteSrc){
            if(remoteSrc){
                applySettings({community_qr:remoteSrc},{persist:true,broadcast:true});
            }else{
                applyCommunityQrs(document);
            }
            return getSettingsSnapshot();
        }).catch(function(error){
            console.warn('[RT runtime] remote settings unavailable',error);
            applyCommunityQrs(document);
            return getSettingsSnapshot();
        }).finally(function(){
            lastRemoteSyncAt=Date.now();
            remoteSyncPromise=null;
        });
        return remoteSyncPromise;
    }

    function syncFromRemoteIfNeeded(){
        if(Date.now()-lastRemoteSyncAt<1500)return;
        syncFromRemote(false);
    }

    const runtimeApi={
        storageKey:STORAGE_KEY,
        defaults:clone(DEFAULT_SETTINGS),
        getSettings:function(){
            return getSettingsSnapshot();
        },
        updateSettings:function(patch){
            const current=getSettingsSnapshot();
            const next=typeof patch==='function'?patch(clone(current)):mergeDeep(current,patch||{});
            return applySettings(next,{persist:true,broadcast:true});
        },
        getCommunityQr:function(key){
            return getSharedCommunityQr();
        },
        setCommunityQr:function(key,src){
            const nextSrc=typeof src==='string'?src:key;
            if(!nextSrc)return this.getSettings();
            return this.updateSettings(function(current){
                const next=mergeDeep(DEFAULT_SETTINGS,current||{});
                next.community_qr=nextSrc||DEFAULT_SETTINGS.community_qr;
                delete next.community_qrs;
                return next;
            });
        },
        resetCommunityQr:function(){
            return this.setCommunityQr(DEFAULT_SETTINGS.community_qr);
        },
        applyCommunityQrs:applyCommunityQrs,
        syncFromRemote:syncFromRemote
    };

    window.rtRuntimeSettings=runtimeApi;
    settingsCache=readStoredSettings();

    document.addEventListener('DOMContentLoaded',function(){
        applyCommunityQrs(document);
        syncFromRemote(false);
    });

    window.addEventListener('focus',function(){
        syncFromRemoteIfNeeded();
    });

    document.addEventListener('visibilitychange',function(){
        if(!document.hidden){
            syncFromRemoteIfNeeded();
        }
    });

    window.addEventListener('storage',function(event){
        if(event.key===STORAGE_KEY){
            settingsCache=readStoredSettings();
            applyCommunityQrs(document);
        }
    });

    window.addEventListener('rt:runtime-settings',function(){
        applyCommunityQrs(document);
    });
})();
