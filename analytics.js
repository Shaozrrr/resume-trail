// analytics.js - lightweight product analytics wrapper (PostHog first)
(function(window,document){
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
                window.posthog.reset.apply(window.posthog,args);
                return true;
            }
            if(method==='identify'&&typeof window.posthog.identify==='function'){
                window.posthog.identify.apply(window.posthog,args);
                return true;
            }
            if(method==='capture'&&typeof window.posthog.capture==='function'){
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
        config:config
    };

    window.rtAnalytics=api;
    if(!state.disabled)loadProvider();
})(window,document);
