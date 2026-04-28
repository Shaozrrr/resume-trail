// Supabase 配置
const SUPABASE_URL='https://bpynqhujzvadyakypfju.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweW5xaHVqenZhZHlha3lwZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODIzMTAsImV4cCI6MjA5Mjk1ODMxMH0.sdU-HLNvVlyVstDUAesvKM_MX_4kBhxTd9OSTlRLXF8';

// 轻量 Supabase 客户端（不依赖 SDK）
const sb={
    headers:function(token){
        var h={'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+(token||SUPABASE_KEY)};
        return h;
    },
    // Auth
    signUp:function(email,password){
        return fetch(SUPABASE_URL+'/auth/v1/signup',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email:email,password:password})}).then(function(r){return r.json();});
    },
    signIn:function(email,password){
        return fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email:email,password:password})}).then(function(r){return r.json();});
    },
    signInOTP:function(email){
        return fetch(SUPABASE_URL+'/auth/v1/otp',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email:email})}).then(function(r){return r.json();});
    },
    verifyOTP:function(email,token){
        return fetch(SUPABASE_URL+'/auth/v1/verify',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email:email,token:token,type:'email'})}).then(function(r){return r.json();});
    },
    getUser:function(token){
        return fetch(SUPABASE_URL+'/auth/v1/user',{headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+token}}).then(function(r){return r.json();});
    },
    signOut:function(token){
        return fetch(SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+token}}).then(function(r){return r.json();});
    },
    // DB operations
    select:function(table,token,query){
        var url=SUPABASE_URL+'/rest/v1/'+table+'?select=*';
        if(query)url+='&'+query;
        return fetch(url,{headers:sb.headers(token)}).then(function(r){return r.json();});
    },
    insert:function(table,data,token){
        return fetch(SUPABASE_URL+'/rest/v1/'+table,{method:'POST',headers:Object.assign(sb.headers(token),{'Prefer':'return=representation'}),body:JSON.stringify(data)}).then(function(r){return r.json();});
    },
    update:function(table,id,data,token){
        return fetch(SUPABASE_URL+'/rest/v1/'+table+'?id=eq.'+id,{method:'PATCH',headers:Object.assign(sb.headers(token),{'Prefer':'return=representation'}),body:JSON.stringify(data)}).then(function(r){return r.json();});
    },
    del:function(table,id,token){
        return fetch(SUPABASE_URL+'/rest/v1/'+table+'?id=eq.'+id,{method:'DELETE',headers:sb.headers(token)}).then(function(r){return r.ok;});
    },
    // 同步本地数据到云端
    syncToCloud:async function(){
        var session=JSON.parse(localStorage.getItem('rt_session')||'null');
        if(!session||!session.access_token)return;
        var token=session.access_token;
        var uid=session.user.id;
        // 上传所有本地数据为一个 JSON blob
        var data={
            user_id:uid,
            apps:JSON.stringify(store.apps),
            resumes:JSON.stringify(store.resumes),
            refs:JSON.stringify(store.refs),
            logs:JSON.stringify(store.logs),
            categories:JSON.stringify(store.categories),
            pain_points:JSON.stringify(store.painPoints),
            settings:JSON.stringify(store.settings),
            table_cols:JSON.stringify(store.tableCols),
            updated_at:new Date().toISOString()
        };
        // 检查是否已有记录
        var existing=await sb.select('user_data',token,'user_id=eq.'+uid);
        if(existing&&existing.length>0){
            await sb.update('user_data',existing[0].id,data,token);
        }else{
            await sb.insert('user_data',data,token);
        }
    },
    // 从云端恢复数据
    syncFromCloud:async function(){
        var session=JSON.parse(localStorage.getItem('rt_session')||'null');
        if(!session||!session.access_token)return false;
        var token=session.access_token;
        var uid=session.user.id;
        var rows=await sb.select('user_data',token,'user_id=eq.'+uid);
        if(rows&&rows.length>0){
            var d=rows[0];
            try{
                if(d.apps)store.apps=JSON.parse(d.apps);
                if(d.resumes)store.resumes=JSON.parse(d.resumes);
                if(d.refs)store.refs=JSON.parse(d.refs);
                if(d.logs)store.logs=JSON.parse(d.logs);
                if(d.categories)store.categories=JSON.parse(d.categories);
                if(d.pain_points)store.painPoints=JSON.parse(d.pain_points);
                if(d.settings)store.settings=JSON.parse(d.settings);
                if(d.table_cols)store.tableCols=JSON.parse(d.table_cols);
                store.save();
                return true;
            }catch(e){console.error('Sync error:',e);}
        }
        return false;
    }
};
// 自动保存到云端（每次 store.save 后）
var _origSave=store.save.bind(store);
store.save=function(){
    _origSave();
    // 延迟同步，避免频繁请求
    clearTimeout(store._syncTimer);
    store._syncTimer=setTimeout(function(){sb.syncToCloud();},3000);
};