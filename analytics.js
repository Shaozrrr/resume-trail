// analytics.js - lightweight product analytics wrapper (PostHog first)
(function(window,document){
    var MIRROR_STORAGE_KEY='rt_local_analytics_events';
    var VISITOR_STORAGE_KEY='rt_analytics_visitor_id';
    var IDENTITY_STORAGE_KEY='rt_analytics_identity';
    var MAX_MIRROR_EVENTS=4000;
    var defaults={
        provider:'posthog',
        apiKey:'',
        apiHost:'https://us.i.posthog.com',
        personProfiles:'identified_only',
        autocapture:true,
        capturePageview:true,
        capturePageleave:true,
        debug:false
    };
    var config=Object.assign({},defaults,window.RT_ANALYTICS_CONFIG||{});
    var state={
        loading:false,
        ready:false,
        disabled:!config.apiKey,
        queue:[]
    };

    function createId(){
        if(window.crypto&&typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID();
        return 'rt_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
    }

    function readJson(storage,key,fallback){
        try{
            var raw=storage.getItem(key);
            if(!raw)return fallback;
            return JSON.parse(raw);
        }catch(err){
            return fallback;
        }
    }

    function writeJson(storage,key,value){
        try{
            storage.setItem(key,JSON.stringify(value));
        }catch(err){
            console.warn('[RT analytics] failed to persist local analytics data',err);
        }
    }

    function getVisitorId(){
        try{
            var current=window.localStorage.getItem(VISITOR_STORAGE_KEY);
            if(current)return current;
            current=createId();
            window.localStorage.setItem(VISITOR_STORAGE_KEY,current);
            return current;
        }catch(err){
            return 'visitor_memory';
        }
    }

    function getIdentity(){
        try{
            return readJson(window.localStorage,IDENTITY_STORAGE_KEY,null)||null;
        }catch(err){
            return null;
        }
    }

    function rememberIdentity(distinctId,props){
        try{
            writeJson(window.localStorage,IDENTITY_STORAGE_KEY,{
                distinct_id:distinctId||'',
                user_id:props&&props.user_id||distinctId||'',
                email:props&&props.email||'',
                auth_mode:props&&props.auth_mode||'email',
                updated_at:new Date().toISOString()
            });
        }catch(err){}
    }

    function clearIdentity(){
        try{
            window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
        }catch(err){}
    }

    function getDeviceType(props){
        if(props&&props.device_type)return props.device_type;
        return window.innerWidth<=720?'mobile':'desktop';
    }

    function getAuthMode(props){
        if(props&&props.auth_mode)return props.auth_mode;
        if(props&&typeof props.guest_mode!=='undefined')return props.guest_mode?'guest':'email';
        var identity=getIdentity();
        return identity&&identity.auth_mode?identity.auth_mode:'guest';
    }

    function mirrorEvent(name,props){
        try{
            var identity=getIdentity();
            var visitorId=getVisitorId();
            var eventProps=sanitizeProps(props||{});
            var authMode=getAuthMode(eventProps);
            var userId=eventProps.user_id||(identity&&identity.user_id)||'';
            var actorId=userId?('user:'+userId):('visitor:'+visitorId);
            var entry=Object.assign({
                id:createId(),
                name:name,
                at:new Date().toISOString(),
                ts:Date.now(),
                visitor_id:visitorId,
                actor_id:actorId,
                user_id:userId||'',
                auth_mode:authMode,
                guest_mode:authMode==='guest',
                device_type:getDeviceType(eventProps)
            },eventProps);
            var events=readJson(window.localStorage,MIRROR_STORAGE_KEY,[]);
            events.push(entry);
            if(events.length>MAX_MIRROR_EVENTS)events=events.slice(events.length-MAX_MIRROR_EVENTS);
            writeJson(window.localStorage,MIRROR_STORAGE_KEY,events);
            window.dispatchEvent(new CustomEvent('rt:analytics-mirror',{detail:{event:entry,count:events.length}}));
        }catch(err){
            console.warn('[RT analytics] mirror event failed',err);
        }
    }

    function sanitizeProps(props){
        var next={};
        Object.keys(props||{}).forEach(function(key){
            var value=props[key];
            if(typeof value==='undefined'||typeof value==='function')return;
            next[key]=value;
        });
        return next;
    }

    function getPostHogAssetOrigin(apiHost){
        try{
            var url=new URL(apiHost);
            if(url.hostname.indexOf('.i.posthog.com')>=0){
                url.hostname=url.hostname.replace('.i.posthog.com','-assets.i.posthog.com');
            }
            return url.origin;
        }catch(err){
            return 'https://us-assets.i.posthog.com';
        }
    }

    function loadProvider(){
        if(state.disabled||state.loading||state.ready)return;
        if(window.posthog&&typeof window.posthog.init==='function'){
            initPostHog();
            return;
        }
        state.loading=true;
        var script=document.createElement('script');
        script.async=true;
        script.crossOrigin='anonymous';
        script.src=getPostHogAssetOrigin(config.apiHost)+'/static/array.js';
        script.onload=initPostHog;
        script.onerror=function(){
            state.loading=false;
            console.warn('[RT analytics] failed to load PostHog library');
        };
        document.head.appendChild(script);
    }

    function flushQueue(){
        var pending=state.queue.slice();
        state.queue.length=0;
        pending.forEach(function(item){
            invoke(item.method,item.args);
        });
    }

    function initPostHog(){
        if(!window.posthog||typeof window.posthog.init!=='function'){
            state.loading=false;
            console.warn('[RT analytics] PostHog global missing after script load');
            return;
        }
        window.posthog.init(config.apiKey,{
            api_host:config.apiHost,
            person_profiles:config.personProfiles,
            autocapture:config.autocapture,
            capture_pageview:config.capturePageview,
            capture_pageleave:config.capturePageleave,
            loaded:function(client){
                state.ready=true;
                state.loading=false;
                if(config.debug&&client&&typeof client.debug==='function')client.debug();
                flushQueue();
            }
        });
    }

    function invoke(method,args){
        if(state.disabled)return false;
        if(!state.ready||!window.posthog){
            state.queue.push({method:method,args:args});
            loadProvider();
            return false;
        }
        try{
            if(method==='reset'&&typeof window.posthog.reset==='function'){
                clearIdentity();
                window.posthog.reset.apply(window.posthog,args);
                return true;
            }
            if(method==='identify'&&typeof window.posthog.identify==='function'){
                rememberIdentity(args[0],args[1]||{});
                window.posthog.identify.apply(window.posthog,args);
                return true;
            }
            if(method==='capture'&&typeof window.posthog.capture==='function'){
                mirrorEvent(args[0],args[1]||{});
                window.posthog.capture.apply(window.posthog,args);
                return true;
            }
            return false;
        }catch(err){
            console.warn('[RT analytics] invoke failed',method,err);
            return false;
        }
    }

    var api={
        enabled:function(){
            return !state.disabled;
        },
        capture:function(name,props){
            if(!name)return false;
            return invoke('capture',[name,sanitizeProps(props||{})]);
        },
        identify:function(distinctId,props){
            if(!distinctId)return false;
            return invoke('identify',[distinctId,sanitizeProps(props||{})]);
        },
        reset:function(){
            return invoke('reset',[true]);
        },
        readMirroredEvents:function(){
            return readJson(window.localStorage,MIRROR_STORAGE_KEY,[]).slice();
        },
        clearMirroredEvents:function(){
            try{
                window.localStorage.removeItem(MIRROR_STORAGE_KEY);
                window.dispatchEvent(new CustomEvent('rt:analytics-mirror',{detail:{event:null,count:0}}));
                return true;
            }catch(err){
                return false;
            }
        },
        config:config
    };

    window.rtAnalytics=api;
    if(!state.disabled)loadProvider();
})(window,document);
