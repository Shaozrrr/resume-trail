// Supabase 云端数据服务层（云端唯一真源）
const SUPABASE_URL='https://bpynqhujzvadyakypfju.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweW5xaHVqenZhZHlha3lwZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODIzMTAsImV4cCI6MjA5Mjk1ODMxMH0.sdU-HLNvVlyVstDUAesvKM_MX_4kBhxTd9OSTlRLXF8';

const sb={
  authHeaders(token){
    return {
      'Content-Type':'application/json',
      'apikey':SUPABASE_KEY,
      'Authorization':'Bearer '+(token||SUPABASE_KEY),
      'Prefer':'return=representation'
    };
  },

  // ---------- Auth ----------
  async signUp(email,password){
    const r=await fetch(SUPABASE_URL+'/auth/v1/signup',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email,password})
    });
    return r.json();
  },

  async signIn(email,password){
    const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email,password})
    });
    return r.json();
  },

  async signInOTP(email){
    const r=await fetch(SUPABASE_URL+'/auth/v1/otp',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email,create_user:true})
    });
    return r.json();
  },

  async verifyOTP(email,token){
    const r=await fetch(SUPABASE_URL+'/auth/v1/verify',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email,token,type:'email'})
    });
    return r.json();
  },

  async signOut(token){
    const r=await fetch(SUPABASE_URL+'/auth/v1/logout',{
      method:'POST',
      headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+token}
    });
    return r.json();
  },

  // ---------- Session ----------
  getSession(){
    return JSON.parse(localStorage.getItem('rt_session')||'null');
  },

  getAccessToken(){
    const s=this.getSession();
    return s&&s.access_token?s.access_token:null;
  },

  getUserId(){
    const s=this.getSession();
    return s&&s.user&&s.user.id?s.user.id:null;
  },

  // ---------- user_data ----------
  async getUserData(){
    const token=this.getAccessToken();
    const uid=this.getUserId();
    if(!token||!uid)return null;
    const url=SUPABASE_URL+'/rest/v1/user_data?select=*&user_id=eq.'+encodeURIComponent(uid)+'&limit=1';
    const r=await fetch(url,{headers:this.authHeaders(token)});
    const d=await r.json();
    return Array.isArray(d)&&d.length?d[0]:null;
  },

  async createUserData(payload){
    const token=this.getAccessToken();
    const uid=this.getUserId();
    if(!token||!uid)throw new Error('未登录');
    const body=Object.assign({
      user_id:uid,
      apps:[],
      resumes:[],
      refs:[],
      logs:[],
      categories:[],
      pain_points:[],
      settings:{},
      table_cols:[],
      updated_at:new Date().toISOString()
    },payload||{});
    const r=await fetch(SUPABASE_URL+'/rest/v1/user_data',{
      method:'POST',
      headers:this.authHeaders(token),
      body:JSON.stringify(body)
    });
    return r.json();
  },

  async updateUserData(id,payload){
    const token=this.getAccessToken();
    if(!token||!id)throw new Error('缺少认证');
    const body=Object.assign({},payload||{},{
      updated_at:new Date().toISOString()
    });
    const r=await fetch(SUPABASE_URL+'/rest/v1/user_data?id=eq.'+id,{
      method:'PATCH',
      headers:this.authHeaders(token),
      body:JSON.stringify(body)
    });
    return r.json();
  }
};

// 云端唯一真源控制器
const cloudStore={
  rowId:null,
  loading:false,
  saving:false,
  loaded:false,

  // 从云端拉取用户数据
  async loadInto(store){
    const row=await sb.getUserData();
    if(!row){
      const created=await sb.createUserData({
        apps:[],
        resumes:[],
        refs:[],
        logs:[],
        categories:[],
        pain_points:(typeof DEFAULT_PP!=='undefined'?DEFAULT_PP:[]),
        settings:{intlMode:false},
        table_cols:(typeof DEFAULT_COLS!=='undefined'?DEFAULT_COLS:[])
      });
      const newRow=Array.isArray(created)&&created.length?created[0]:null;
      this.rowId=newRow?newRow.id:null;
      store.apps=[];
      store.resumes=[];
      store.refs=[];
      store.logs=[];
      store.categories=[];
      store.painPoints=(typeof DEFAULT_PP!=='undefined'?[...DEFAULT_PP]:[]);
      store.settings={intlMode:false};
      store.tableCols=(typeof DEFAULT_COLS!=='undefined'?[...DEFAULT_COLS]:[]);
      this.loaded=true;
      return true;
    }

    this.rowId=row.id;
    store.apps=Array.isArray(row.apps)?row.apps:[];
    store.resumes=Array.isArray(row.resumes)?row.resumes:[];
    store.refs=Array.isArray(row.refs)?row.refs:[];
    store.logs=Array.isArray(row.logs)?row.logs:[];
    store.categories=Array.isArray(row.categories)?row.categories:[];
    store.painPoints=Array.isArray(row.pain_points)?row.pain_points:[];
    store.settings=row.settings||{intlMode:false};
    store.tableCols=Array.isArray(row.table_cols)?row.table_cols:[];
    this.loaded=true;
    return true;
  },

  // 保存当前 store 到云端
  async saveFrom(store){
    if(!sb.getAccessToken()||!sb.getUserId())return false;
    if(!this.rowId){
      const row=await sb.getUserData();
      if(row)this.rowId=row.id;
    }
    if(!this.rowId){
      const created=await sb.createUserData({});
      const newRow=Array.isArray(created)&&created.length?created[0]:null;
      this.rowId=newRow?newRow.id:null;
    }
    if(!this.rowId)throw new Error('无法初始化用户数据记录');

    await sb.updateUserData(this.rowId,{
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
  }
};