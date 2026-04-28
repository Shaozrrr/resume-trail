// Supabase 云端唯一真源
const SUPABASE_URL='https://bpynqhujzvadyakypfju.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweW5xaHVqenZhZHlha3lwZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODIzMTAsImV4cCI6MjA5Mjk1ODMxMH0.sdU-HLNvVlyVstDUAesvKM_MX_4kBhxTd9OSTlRLXF8';

const sb={
    headers:function(token){
        return {
            'Content-Type':'application/json',
            'apikey':SUPABASE_KEY,
            'Authorization':'Bearer '+(token||SUPABASE_KEY),
            'Prefer':'return=representation'
        };
    },

    // Auth
    signUp:function(email,password){
        return fetch(SUPABASE_URL+'/auth/v1/signup',{
            method:'POST',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
            body:JSON.stringify({email:email,password:password})
        }).then(r=>r.json());
    },
    signIn:function(email,password){
        return fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{
            method:'POST',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
            body:JSON.stringify({email:email,password:password})
        }).then(r=>r.json());
    },
    signInOTP:function(email){
        return fetch(SUPABASE_URL+'/auth/v1/otp',{
            method:'POST',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
            body:JSON.stringify({email:email,create_user:true})
        }).then(r=>r.json());
    },
    verifyOTP:function(email,token){
        return fetch(SUPABASE_URL+'/auth/v1/verify',{
            method:'POST',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
            body:JSON.stringify({email:email,token:token,type:'email'})
        }).then(r=>r.json());
    },
    signOut:function(token){
        return fetch(SUPABASE_URL+'/auth/v1/logout',{
            method:'POST',
            headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+token}
        }).then(r=>r.json());
    },

    // user_data 表操作
    getUserData:async function(token,userId){
        const url=SUPABASE_URL+'/rest/v1/user_data?select=*&user_id=eq.'+encodeURIComponent(userId)+'&limit=1';
        const r=await fetch(url,{headers:sb.headers(token)});
        const d=await r.json();
        return Array.isArray(d)&&d.length?d[0]:null;
    },

    upsertUserData:async function(token,userId,payload){
        const existing=await sb.getUserData(token,userId);
        const body={
            user_id:userId,
            apps:payload.apps||[],
            resumes:payload.resumes||[],
            refs:payload.refs||[],
            logs:payload.logs||[],
            categories:payload.categories||[],
            pain_points:payload.pain_points||[],
            settings:payload.settings||{},
            table_cols:payload.table_cols||[],
            updated_at:new Date().toISOString()
        };
        if(existing&&existing.id){
            const r=await fetch(SUPABASE_URL+'/rest/v1/user_data?id=eq.'+existing.id,{
                method:'PATCH',
                headers:sb.headers(token),
                body:JSON.stringify(body)
            });
            return r.json();
        }else{
            const r=await fetch(SUPABASE_URL+'/rest/v1/user_data',{
                method:'POST',
                headers:sb.headers(token),
                body:JSON.stringify(body)
            });
            return r.json();
        }
    },

    // 文件上传（后续可扩展到 Storage）
    uploadFile:function(file,token,userId,path){
        return Promise.resolve({url:null});
    }
};

// 当前登录会话
function getSession(){
    return JSON.parse(localStorage.getItem('rt_session')||'null');
}
function getUserId(){
    const s=getSession();
    return s&&s.user&&s.user.id?s.user.id:null;
}
function getAccessToken(){
    const s=getSession();
    return s&&s.access_token?s.access_token:null;
}

// 云端数据管理器
const cloudStore={
    loading:false,
    loaded:false,

    async load(){
        const token=getAccessToken(),uid=getUserId();
        if(!token||!uid)return false;
        this.loading=true;
        try{
            const row=await sb.getUserData(token,uid);
            if(row){
                store.apps=Array.isArray(row.apps)?row.apps:[];
                store.resumes=Array.isArray(row.resumes)?row.resumes:[];
                store.refs=Array.isArray(row.refs)?row.refs:[];
                store.logs=Array.isArray(row.logs)?row.logs:[];
                store.categories=Array.isArray(row.categories)?row.categories:[];
                store.painPoints=Array.isArray(row.pain_points)?row.pain_points:[];
                store.settings=row.settings||{};
                store.tableCols=Array.isArray(row.table_cols)?row.table_cols:[];
            }else{
                // 新用户初始化为空
                store.apps=[];store.resumes=[];store.refs=[];store.logs=[];store.categories=[];store.painPoints=[];store.settings={};store.tableCols=[];
                await this.save();
            }
            this.loaded=true;
            this.loading=false;
            return true;
        }catch(e){
            console.error('Cloud load failed:',e);
            this.loading=false;
            return false;
        }
    },

    async save(){
        const token=getAccessToken(),uid=getUserId();
        if(!token||!uid)return false;
        try{
            await sb.upsertUserData(token,uid,{
                apps:store.apps,
                resumes:store.resumes,
                refs:store.refs,
                logs:store.logs,
                categories:store.categories,
                pain_points:store.painPoints,
                settings:store.settings,
                table_cols:store.tableCols
            });
            return true;
        }catch(e){
            console.error('Cloud save failed:',e);
            return false;
        }
    }
};