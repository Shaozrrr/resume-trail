// Supabase 云端数据服务层（云端唯一真源）
const SUPABASE_URL='https://bpynqhujzvadyakypfju.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweW5xaHVqenZhZHlha3lwZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODIzMTAsImV4cCI6MjA5Mjk1ODMxMH0.sdU-HLNvVlyVstDUAesvKM_MX_4kBhxTd9OSTlRLXF8';
const RT_SESSION_KEY='rt_session';
const USER_DATA_FIELDS=['apps','resumes','prepare_sessions','refs','logs','categories','pain_points','settings','table_cols'];

function rtLog(label,payload){
  console.log('[RT]',label,payload||'');
}

function rtClone(value){
  if(typeof structuredClone==='function')return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function rtDefaultUserData(){
  return {
    apps:[],
    resumes:[],
    prepare_sessions:[],
    refs:[],
    logs:[],
    categories:[],
    pain_points:(typeof DEFAULT_PP!=='undefined'?[...DEFAULT_PP]:[]),
    settings:{intlMode:false,weeklyGoal:10,profileNickname:'',profileAvatar:'',themeMode:'dark'},
    table_cols:(typeof DEFAULT_COLS!=='undefined'?[...DEFAULT_COLS]:[])
  };
}

function rtStarterUserData(preservedSettings){
  if(typeof window.rtCreateStarterData==='function'){
    const starter=window.rtCreateStarterData(preservedSettings||{});
    if(starter&&starter.settings){
      starter.settings=Object.assign({},rtDefaultUserData().settings,starter.settings);
    }
    return starter;
  }
  const fallback=rtDefaultUserData();
  fallback.settings=Object.assign({},fallback.settings,preservedSettings||{});
  return fallback;
}

function rtNeedsStarterSeed(data){
  if(typeof window.rtShouldSeedStarterData==='function')return !!window.rtShouldSeedStarterData(data);
  return !data||(!data.apps?.length&&!data.categories?.length&&!data.refs?.length&&!data.logs?.length);
}

function rtFieldFallback(field){
  return rtDefaultUserData()[field];
}

function rtParseJson(text,fallback,label){
  try{
    return JSON.parse(text);
  }catch(err){
    console.warn('[RT] JSON parse failed',label,err,text);
    return rtClone(fallback);
  }
}

function rtDecodeField(field,value){
  const fallback=rtFieldFallback(field);
  if(value===null||typeof value==='undefined')return rtClone(fallback);
  if(typeof value==='string')return rtParseJson(value,fallback,field);
  if(Array.isArray(fallback))return Array.isArray(value)?value:rtClone(fallback);
  if(fallback&&typeof fallback==='object')return value&&typeof value==='object'?value:rtClone(fallback);
  return value;
}

function rtEncodePayload(payload,mode){
  const body={};
  Object.keys(payload||{}).forEach(function(key){
    const value=payload[key];
    body[key]=mode==='text'?JSON.stringify(value):value;
  });
  return body;
}

const sb={
  userDataMode:null,

  authHeaders(token){
    return {
      'Content-Type':'application/json',
      'apikey':SUPABASE_KEY,
      'Authorization':'Bearer '+(token||SUPABASE_KEY),
      'Prefer':'return=representation'
    };
  },

  async requestJson(url,options){
    const response=await fetch(url,options||{});
    const text=await response.text();
    let data=null;
    if(text){
      try{
        data=JSON.parse(text);
      }catch(err){
        data=text;
      }
    }
    return {
      ok:response.ok,
      status:response.status,
      data:data,
      error:response.ok?null:(data&&typeof data==='object'?(data.message||data.error_description||data.error||JSON.stringify(data)):text||('HTTP '+response.status))
    };
  },

  unwrapAuthResponse(label,result){
    rtLog(label,{ok:result.ok,status:result.status,hasAccess:!!(result.data&&result.data.access_token),hasRefresh:!!(result.data&&result.data.refresh_token),error:result.error||null});
    if(result.ok&&result.data)return result.data;
    return Object.assign({},result.data&&typeof result.data==='object'?result.data:{},{error:result.error||('HTTP '+result.status),status:result.status});
  },

  setSession(session,label){
    if(!session)return this.clearSession(label||'setSession.empty');
    const previous=this.getSession();
    const previousUserId=previous&&previous.user&&previous.user.id||'';
    const nextUserId=session&&session.user&&session.user.id||'';
    if(previousUserId&&nextUserId&&previousUserId!==nextUserId&&typeof window!=='undefined'&&typeof window.rtWriteCachedAccount==='function'){
      window.rtWriteCachedAccount(null);
    }
    localStorage.setItem(RT_SESSION_KEY,JSON.stringify(session));
    rtLog(label||'session.set',{hasAccess:!!session.access_token,hasRefresh:!!session.refresh_token,userId:session.user&&session.user.id||null});
    if(window.rtDebug)window.rtDebug.update({email:session.user&&session.user.email||'-',userId:session.user&&session.user.id||'-',sessionExists:'yes'});
    window.dispatchEvent(new CustomEvent('rt:session',{detail:{session:session||null}}));
    return session;
  },

  clearSession(label){
    localStorage.removeItem(RT_SESSION_KEY);
    if(typeof window!=='undefined'&&typeof window.rtWriteCachedAccount==='function'){
      window.rtWriteCachedAccount(null);
    }
    rtLog(label||'session.clear',{});
    if(window.rtDebug)window.rtDebug.update({email:'-',userId:'-',sessionExists:'no'});
    window.dispatchEvent(new CustomEvent('rt:session',{detail:{session:null}}));
  },

  getSession(){
    const raw=localStorage.getItem(RT_SESSION_KEY);
    if(!raw)return null;
    try{
      return JSON.parse(raw);
    }catch(err){
      console.warn('[RT] session JSON parse failed',err);
      this.clearSession('session.parseFailed');
      return null;
    }
  },

  getAccessToken(){
    const session=this.getSession();
    return session&&session.access_token?session.access_token:null;
  },

  getRefreshToken(){
    const session=this.getSession();
    return session&&session.refresh_token?session.refresh_token:null;
  },

  getUserId(){
    const session=this.getSession();
    return session&&session.user&&session.user.id?session.user.id:null;
  },

  async signUp(email,password){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/signup',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email:email,password:password})
    });
    return this.unwrapAuthResponse('auth.signUp',result);
  },

  async signIn(email,password){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email:email,password:password})
    });
    return this.unwrapAuthResponse('auth.signIn',result);
  },

  async verifyOTP(email,token,type){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/verify',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email:email,token:token,type:type||'email'})
    });
    return this.unwrapAuthResponse('auth.verifyOTP',result);
  },

  async resendSignup(email){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/resend',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email:email,type:'signup'})
    });
    return this.unwrapAuthResponse('auth.resendSignup',result);
  },

  async sendEmailOtp(email,createUser){
    const payload={
      email:email,
      create_user:!!createUser,
      should_create_user:!!createUser
    };
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/otp',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify(payload)
    });
    return this.unwrapAuthResponse('auth.sendEmailOtp',result);
  },

  async getEmailStatus(email){
    const result=await this.requestJson(SUPABASE_URL+'/rest/v1/rpc/rt_auth_email_status',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':SUPABASE_KEY,
        'Authorization':'Bearer '+SUPABASE_KEY
      },
      body:JSON.stringify({input_email:email})
    });
    rtLog('auth.getEmailStatus',{
      ok:result.ok,
      status:result.status,
      error:result.error||null
    });
    if(!result.ok){
      return {
        error:result.error||('HTTP '+result.status),
        status:result.status
      };
    }
    var row=Array.isArray(result.data)?result.data[0]:result.data;
    return {
      is_registered:!!(row&&row.is_registered),
      is_confirmed:!!(row&&row.is_confirmed)
    };
  },

  async updatePassword(token,password){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/user',{
      method:'PUT',
      headers:{
        'Content-Type':'application/json',
        'apikey':SUPABASE_KEY,
        'Authorization':'Bearer '+token
      },
      body:JSON.stringify({password:password})
    });
    rtLog('auth.updatePassword',{ok:result.ok,status:result.status,error:result.error||null});
    return result.ok?result.data:Object.assign({},result.data&&typeof result.data==='object'?result.data:{},{error:result.error||('HTTP '+result.status),status:result.status});
  },

  async signOut(token){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/logout',{
      method:'POST',
      headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+token}
    });
    rtLog('auth.signOut',{ok:result.ok,status:result.status,error:result.error||null});
    return result.data||{};
  },

  async getUser(token){
    return this.requestJson(SUPABASE_URL+'/auth/v1/user',{
      method:'GET',
      headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+token}
    });
  },

  async refreshSession(refreshToken){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({refresh_token:refreshToken})
    });
    rtLog('auth.refreshSession',{ok:result.ok,status:result.status,hasAccess:!!(result.data&&result.data.access_token),hasRefresh:!!(result.data&&result.data.refresh_token),error:result.error||null});
    return result;
  },

  async refreshStoredSession(reason){
    const current=this.getSession();
    if(!current||!current.refresh_token){
      rtLog('auth.refreshStoredSession.skip',{reason:reason||'',hasSession:!!current,hasRefresh:!!(current&&current.refresh_token)});
      return null;
    }
    const refreshed=await this.refreshSession(current.refresh_token);
    if(!refreshed.ok||!refreshed.data||!refreshed.data.access_token)return null;
    const nextSession=Object.assign({},current,refreshed.data);
    const userResult=await this.getUser(nextSession.access_token);
    rtLog('auth.refreshStoredSession.getUser',{ok:userResult.ok,status:userResult.status,userId:userResult.data&&userResult.data.id||null,error:userResult.error||null});
    if(userResult.ok&&userResult.data)nextSession.user=userResult.data;
    this.setSession(nextSession,'session.refreshed');
    return nextSession;
  },

  async ensureSession(){
    let session=this.getSession();
    console.log('[RT auth] init session snapshot',{
      hasSession:!!session,
      hasAccessToken:!!(session&&session.access_token),
      hasRefreshToken:!!(session&&session.refresh_token),
      userId:session&&session.user&&session.user.id||null
    });
    if(window.rtDebug)window.rtDebug.update({
      email:session&&session.user&&session.user.email||'-',
      userId:session&&session.user&&session.user.id||'-',
      sessionExists:session&&session.access_token?'yes':'no'
    });
    if(!session||!session.access_token)return null;

    let userResult=await this.getUser(session.access_token);
    console.log('[RT auth] sb.getUser result',{
      ok:userResult.ok,
      status:userResult.status,
      userId:userResult.data&&userResult.data.id||null,
      error:userResult.error||null
    });
    if(userResult.ok&&userResult.data&&userResult.data.id){
      session.user=userResult.data;
      this.setSession(session,'session.verified');
      return session;
    }

    if(session.refresh_token){
      session=await this.refreshStoredSession('ensureSession');
      if(session&&session.access_token){
        console.log('[RT auth] session refreshed successfully',{
          hasAccessToken:!!session.access_token,
          hasRefreshToken:!!session.refresh_token,
          userId:session.user&&session.user.id||null
        });
        return session;
      }
    }

    console.warn('[RT auth] session invalid and refresh failed, clearing rt_session');
    this.clearSession('session.invalid');
    return null;
  },

  detectUserDataMode(row){
    if(!row)return null;
    var hasNative=false;
    USER_DATA_FIELDS.forEach(function(field){
      const value=row[field];
      if(Array.isArray(value)||(value&&typeof value==='object'))hasNative=true;
    });
    return hasNative?'jsonb':'unknown';
  },

  decodeUserDataRow(row){
    if(!row)return null;
    const decoded={id:row.id,user_id:row.user_id,updated_at:row.updated_at};
    USER_DATA_FIELDS.forEach(function(field){
      decoded[field]=rtDecodeField(field,row[field]);
    });
    return decoded;
  },

  async authedRequest(url,options,retryLabel){
    let result=await this.requestJson(url,options);
    if((result.status===401||result.status===403)&&this.getRefreshToken()){
      console.warn('[RT] authed request failed, trying refresh',retryLabel||'',result);
      const refreshed=await this.refreshStoredSession(retryLabel||'authedRequest');
      if(refreshed&&refreshed.access_token){
        const nextOptions=Object.assign({},options,{
          headers:Object.assign({},options&&options.headers||{},this.authHeaders(refreshed.access_token))
        });
        result=await this.requestJson(url,nextOptions);
      }
    }
    return result;
  },

  async getUserData(){
    const token=this.getAccessToken();
    const uid=this.getUserId();
    if(!token||!uid){
      return {ok:false,status:401,error:'未登录',data:null};
    }
    const url=SUPABASE_URL+'/rest/v1/user_data?select=*&user_id=eq.'+encodeURIComponent(uid)+'&limit=1';
    const result=await this.authedRequest(url,{method:'GET',headers:this.authHeaders(token)},'getUserData');
    const row=result.ok&&Array.isArray(result.data)&&result.data.length?result.data[0]:null;
    if(row){
      const mode=this.detectUserDataMode(row);
      if(mode)this.userDataMode=mode;
    }
    rtLog('userData.get',{ok:result.ok,status:result.status,rowId:row&&row.id||null,mode:this.userDataMode,error:result.error||null});
    return {ok:result.ok,status:result.status,error:result.error,data:row,raw:result.data};
  },

  async insertUserDataRow(body){
    const token=this.getAccessToken();
    const result=await this.authedRequest(SUPABASE_URL+'/rest/v1/user_data',{
      method:'POST',
      headers:this.authHeaders(token),
      body:JSON.stringify(body)
    },'insertUserDataRow');
    const row=result.ok&&Array.isArray(result.data)&&result.data.length?result.data[0]:null;
    return {ok:result.ok,status:result.status,error:result.error,data:row,raw:result.data};
  },

  async patchUserDataRow(id,body){
    const token=this.getAccessToken();
    const result=await this.authedRequest(SUPABASE_URL+'/rest/v1/user_data?id=eq.'+id,{
      method:'PATCH',
      headers:this.authHeaders(token),
      body:JSON.stringify(body)
    },'patchUserDataRow');
    const row=result.ok&&Array.isArray(result.data)&&result.data.length?result.data[0]:null;
    return {ok:result.ok,status:result.status,error:result.error,data:row,raw:result.data};
  },

  async deleteUserDataRowsByUserId(userId){
    const token=this.getAccessToken();
    const result=await this.authedRequest(SUPABASE_URL+'/rest/v1/user_data?user_id=eq.'+encodeURIComponent(userId),{
      method:'DELETE',
      headers:this.authHeaders(token)
    },'deleteUserDataRowsByUserId');
    return {ok:result.ok,status:result.status,error:result.error,data:result.data,raw:result.data};
  },

  async persistUserData(id,payload){
    const uid=this.getUserId();
    if(!uid)return {ok:false,status:401,error:'缺少用户 ID',data:null};
    const basePayload=Object.assign({user_id:uid},payload||{},{updated_at:new Date().toISOString()});
    const preferredMode=this.userDataMode==='text'?'text':'jsonb';
    const modes=this.userDataMode==='text'?['text']:this.userDataMode==='jsonb'?['jsonb']:['jsonb','text'];
    let lastResult={ok:false,status:500,error:'未知错误',data:null};

    for(let i=0;i<modes.length;i++){
      const mode=modes[i];
      const body=Object.assign({},basePayload,rtEncodePayload(payload,mode),{user_id:uid,updated_at:new Date().toISOString()});
      const result=id?await this.patchUserDataRow(id,body):await this.insertUserDataRow(body);
      console.log('[RT cloud] saveFrom user_data response',{
        mode:mode,
        ok:result.ok,
        status:result.status,
        rowId:result.data&&result.data.id||null,
        error:result.error||null,
        raw:result.raw
      });
      if(result.ok){
        this.userDataMode=mode;
        return {ok:true,status:result.status,error:null,data:result.data,raw:result.raw,mode:mode};
      }
      lastResult=result;
      if(mode!==preferredMode&&preferredMode&&modes.indexOf(preferredMode)<0)modes.unshift(preferredMode);
    }
    return {ok:false,status:lastResult.status,error:lastResult.error||'保存失败',data:lastResult.data,raw:lastResult.raw,mode:null};
  }
};

// 云端唯一真源控制器
const cloudStore={
  rowId:null,
  loading:false,
  saving:false,
  loaded:false,

  applyDataToStore(store,data){
    store.apps=Array.isArray(data.apps)?data.apps.map(function(app){
      return typeof normalizeAppRecord==='function'?normalizeAppRecord(app):app;
    }):[];
    store.resumes=data.resumes;
    store.prepareSessions=typeof normalizePrepareSessionCollection==='function'
      ?normalizePrepareSessionCollection(data.prepare_sessions||[])
      :(data.prepare_sessions||[]);
    store.refs=data.refs;
    store.logs=data.logs;
    store.categories=data.categories;
    store.painPoints=data.pain_points;
    store.settings=Object.assign({intlMode:false,weeklyGoal:10,profileNickname:'',profileAvatar:'',themeMode:'dark'},data.settings||{});
    store.tableCols=typeof normalizeTableColumns==='function'?normalizeTableColumns(data.table_cols):data.table_cols;
  },

  buildPayloadFromStore(store){
    return {
      apps:rtClone(store.apps),
      resumes:rtClone(store.resumes),
      prepare_sessions:rtClone(store.prepareSessions||[]),
      refs:rtClone(store.refs),
      logs:rtClone(store.logs),
      categories:rtClone(store.categories),
      pain_points:rtClone(store.painPoints),
      settings:rtClone(store.settings),
      table_cols:rtClone(store.tableCols)
    };
  },

  async ensureRow(store){
    if(this.rowId)return this.rowId;
    const existing=await sb.getUserData();
    if(existing.ok&&existing.data&&existing.data.id){
      this.rowId=existing.data.id;
      return this.rowId;
    }
    const created=await sb.persistUserData(null,this.buildPayloadFromStore(store));
    if(!created.ok)throw new Error(created.error||'初始化云端数据失败');
    this.rowId=created.data&&created.data.id||null;
    return this.rowId;
  },

  async loadInto(store){
    this.loading=true;
    console.log('[RT cloud] loadInto start',{userId:sb.getUserId(),hasSession:!!sb.getAccessToken()});
    let resultPayload=null;
    try{
      const rowResult=await sb.getUserData();
      if(!rowResult.ok)throw new Error(rowResult.error||'拉取 user_data 失败');

      let row=rowResult.data;
      if(!row){
        const created=await sb.persistUserData(null,this.buildPayloadFromStore({apps:[],resumes:[],refs:[],logs:[],categories:[],painPoints:(typeof DEFAULT_PP!=='undefined'?[...DEFAULT_PP]:[]),settings:{intlMode:false,weeklyGoal:10,profileNickname:'',profileAvatar:'',themeMode:'dark'},tableCols:(typeof DEFAULT_COLS!=='undefined'?[...DEFAULT_COLS]:[])}));
        if(!created.ok)throw new Error(created.error||'创建 user_data 失败');
        row=created.data;
      }

      this.rowId=row&&row.id||null;
      let decoded=sb.decodeUserDataRow(row);
      if(rtNeedsStarterSeed(decoded)){
        const seededPayload=rtStarterUserData(decoded&&decoded.settings?{profileNickname:decoded.settings.profileNickname||'',profileAvatar:decoded.settings.profileAvatar||'',themeMode:decoded.settings.themeMode||'dark'}:{});
        const seededResult=await sb.persistUserData(this.rowId,seededPayload);
        if(!seededResult.ok)throw new Error(seededResult.error||'初始化演示数据失败');
        this.rowId=seededResult.data&&seededResult.data.id||this.rowId;
        decoded=sb.decodeUserDataRow(seededResult.data);
      }
      this.applyDataToStore(store,decoded);
      this.loaded=true;
      resultPayload={
        ok:true,
        rowId:this.rowId,
        mode:sb.userDataMode||sb.detectUserDataMode(row)||'unknown',
        counts:{
          apps:store.apps.length,
          resumes:store.resumes.length,
          refs:store.refs.length,
          logs:store.logs.length
        }
      };
      console.log('[RT cloud] loadInto result',resultPayload);
      if(window.rtDebug)window.rtDebug.update({lastLoadAt:new Date().toLocaleTimeString('zh-CN',{hour12:false})});
      return resultPayload;
    }finally{
      this.loading=false;
    }
  },

  async saveFrom(store,reason){
    this.saving=true;
    console.log('[RT cloud] saveFrom start',{
      reason:reason||'unknown',
      hasSession:!!sb.getAccessToken(),
      userId:sb.getUserId(),
      rowId:this.rowId
    });
    try{
      if(!sb.getAccessToken()||!sb.getUserId())throw new Error('未登录，无法保存到云端');
      await this.ensureRow(store);
      const saveResult=await sb.persistUserData(this.rowId,this.buildPayloadFromStore(store));
      if(!saveResult.ok)throw new Error(saveResult.error||'保存失败');
      this.rowId=saveResult.data&&saveResult.data.id||this.rowId;
      const payload={
        ok:true,
        rowId:this.rowId,
        mode:saveResult.mode,
        updatedAt:saveResult.data&&saveResult.data.updated_at||null
      };
      console.log('[RT cloud] saveFrom success',payload);
      if(window.rtDebug)window.rtDebug.update({
        lastSaveAt:new Date().toLocaleTimeString('zh-CN',{hour12:false}),
        saveResult:'success'
      });
      return payload;
    }catch(err){
      console.error('[RT cloud] saveFrom failed',err);
      if(window.rtDebug)window.rtDebug.update({
        lastSaveAt:new Date().toLocaleTimeString('zh-CN',{hour12:false}),
        saveResult:'fail'
      });
      throw err;
    }finally{
      this.saving=false;
    }
  },

  async clearAllData(store){
    const uid=sb.getUserId();
    if(!uid)throw new Error('未登录，无法清空云端数据');
    console.log('[RT cloud] clearAllData start',{userId:uid,rowId:this.rowId});
    const starter=rtStarterUserData(store&&store.settings?{profileNickname:store.settings.profileNickname||'',profileAvatar:store.settings.profileAvatar||'',themeMode:store.settings.themeMode||'dark'}:{});
    const deleted=await sb.deleteUserDataRowsByUserId(uid);
    console.log('[RT cloud] clearAllData delete response',deleted);
    let finalRowResult=null;
    if(deleted.ok){
      finalRowResult=await sb.persistUserData(null,starter);
      console.log('[RT cloud] clearAllData recreate response',finalRowResult);
      if(!finalRowResult.ok)throw new Error(finalRowResult.error||'重建演示数据失败');
    }else{
      const ensuredId=await this.ensureRow(store);
      finalRowResult=await sb.persistUserData(ensuredId,starter);
      console.log('[RT cloud] clearAllData reset response',finalRowResult);
      if(!finalRowResult.ok)throw new Error(finalRowResult.error||'清空云端数据失败');
    }
    this.rowId=finalRowResult.data&&finalRowResult.data.id||null;
    this.applyDataToStore(store,starter);
    this.loaded=true;
    if(window.rtDebug)window.rtDebug.update({
      lastSaveAt:new Date().toLocaleTimeString('zh-CN',{hour12:false}),
      saveResult:'success',
      lastLoadAt:new Date().toLocaleTimeString('zh-CN',{hour12:false})
    });
    return true;
  }
};

function rtRpcHeaders(token){
  return {
    'Content-Type':'application/json',
    'apikey':SUPABASE_KEY,
    'Authorization':'Bearer '+(token||SUPABASE_KEY)
  };
}

async function rtRpcCall(name,body,token){
  return sb.requestJson(SUPABASE_URL+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:rtRpcHeaders(token),
    body:JSON.stringify(body||{})
  });
}

async function rtInvokeEdgeFunction(name,body,token){
  return sb.requestJson(SUPABASE_URL+'/functions/v1/'+name,{
    method:'POST',
    headers:rtRpcHeaders(token),
    body:JSON.stringify(body||{})
  });
}

function rtGetGuestIdentityIdSafe(){
  if(typeof window!=='undefined'&&typeof window.rtGetGuestIdentityId==='function')return window.rtGetGuestIdentityId();
  return '';
}

function rtReadCachedAccountSafe(){
  if(typeof window!=='undefined'&&typeof window.rtReadCachedAccount==='function')return window.rtReadCachedAccount();
  return null;
}

function rtWriteCachedAccountSafe(account){
  if(typeof window!=='undefined'&&typeof window.rtWriteCachedAccount==='function')window.rtWriteCachedAccount(account);
}

function rtGetAccountDisplayName(){
  if(typeof window!=='undefined'&&typeof window.getProfileNickname==='function'){
    const value=window.getProfileNickname();
    if(value&&value.trim())return value.trim();
  }
  try{
    const local=localStorage.getItem('rt_nickname')||'';
    return local.trim();
  }catch(err){
    return '';
  }
}

function rtNormalizeAccountPayload(payload){
  if(!payload)return null;
  const account=payload.account||payload;
  return account&&typeof account==='object'?account:null;
}

const rtAccountService={
  currentAccount:rtReadCachedAccountSafe(),

  getGuestId(){
    return rtGetGuestIdentityIdSafe();
  },

  getSessionToken(){
    return sb.getAccessToken()||SUPABASE_KEY;
  },

  accountMatchesCurrentIdentity(account){
    if(!account||typeof account!=='object')return false;
    const session=sb.getSession();
    const authUserId=session&&session.user&&session.user.id||'';
    if(authUserId){
      return !!account.auth_user_id&&account.auth_user_id===authUserId;
    }
    const guestMode=!!(typeof window!=='undefined'&&window.rtGuestStore&&window.rtGuestStore.isEnabled&&window.rtGuestStore.isEnabled());
    if(guestMode){
      const guestId=this.getGuestId();
      return !!guestId
        && account.guest_id===guestId
        && !account.auth_user_id
        && String(account.auth_mode||'guest')==='guest';
    }
    return false;
  },

  getCachedAccount(){
    const candidate=this.currentAccount||rtReadCachedAccountSafe();
    if(!candidate)return null;
    if(this.accountMatchesCurrentIdentity(candidate))return candidate;
    this.currentAccount=null;
    rtWriteCachedAccountSafe(null);
    return null;
  },

  setCachedAccount(account){
    this.currentAccount=account||null;
    rtWriteCachedAccountSafe(account||null);
    if(typeof window!=='undefined'){
      window.dispatchEvent(new CustomEvent('rt:account',{detail:{account:account||null}}));
    }
  },

  buildIdentityBody(extra){
    const session=sb.getSession();
    return Object.assign({
      input_guest_id:this.getGuestId(),
      input_display_name:rtGetAccountDisplayName(),
      input_email:session&&session.user&&session.user.email||'',
      input_source_channel:'resume_trail_web'
    },extra||{});
  },

  async ensureAccount(extra){
    const result=await rtRpcCall('rt_get_my_account',this.buildIdentityBody(extra),this.getSessionToken());
    if(!result.ok){
      throw new Error(result.error||'账号初始化失败');
    }
    const account=rtNormalizeAccountPayload(result.data);
    this.setCachedAccount(account);
    return account;
  },

  async logEvent(name,props){
    const result=await rtRpcCall('rt_log_activity_event',Object.assign(this.buildIdentityBody(),{
      input_event_name:name,
      input_props:props||{}
    }),this.getSessionToken());
    if(!result.ok)throw new Error(result.error||'事件上报失败');
    const account=rtNormalizeAccountPayload(result.data);
    if(account)this.setCachedAccount(account);
    return result.data;
  },

  async consumePrepareAccess(sessionKey){
    const result=await rtRpcCall('rt_consume_prepare_access',Object.assign(this.buildIdentityBody(),{
      input_session_key:sessionKey
    }),this.getSessionToken());
    if(!result.ok)throw new Error(result.error||'试用次数校验失败');
    const payload=result.data&&typeof result.data==='object'?result.data:{};
    const account=rtNormalizeAccountPayload(payload);
    if(account)this.setCachedAccount(account);
    return payload;
  },

  async startMembershipCheckout(planKey,options){
    const session=sb.getSession();
    if(!session||!session.user||!session.user.id){
      throw new Error('请先注册并登录账号，再开通会员。');
    }
    const account=await this.ensureAccount({input_source_channel:'billing_checkout'});
    if(!account||!account.id){
      throw new Error('账号还没初始化完成，请稍后重试。');
    }
    const functionName=options&&options.functionName||'stripe-create-checkout';
    const result=await rtInvokeEdgeFunction(functionName,{
      plan_key:planKey,
      method_key:options&&options.methodKey||'wechat',
      account_id:account.id,
      return_url:window.location.href
    },this.getSessionToken());
    if(!result.ok){
      throw new Error(result.error||'创建支付链接失败');
    }
    const payload=result.data&&typeof result.data==='object'?result.data:{};
    if(payload.account)this.setCachedAccount(rtNormalizeAccountPayload(payload.account));
    if(payload.url){
      window.location.assign(payload.url);
      return payload;
    }
    throw new Error('支付链接还没准备好，请检查 Stripe 配置。');
  },

  async invokeFunction(functionName,payload){
    const result=await rtInvokeEdgeFunction(functionName,payload||{},this.getSessionToken());
    if(!result.ok){
      throw new Error(result.error||'云端函数调用失败');
    }
    return result.data;
  },

  async listAdminAccounts(){
    const result=await rtRpcCall('rt_admin_list_accounts',{},this.getSessionToken());
    if(!result.ok)throw new Error(result.error||'读取账号列表失败');
    return Array.isArray(result.data)?result.data:[];
  },

  async listAdminEvents(days,limit){
    const result=await rtRpcCall('rt_admin_list_events',{
      input_days:days||30,
      input_limit:limit||2000
    },this.getSessionToken());
    if(!result.ok)throw new Error(result.error||'读取后台事件失败');
    return Array.isArray(result.data)?result.data:[];
  },

  async updateAdminAccount(payload){
    const result=await rtRpcCall('rt_admin_update_account',payload||{},this.getSessionToken());
    if(!result.ok)throw new Error(result.error||'更新账号失败');
    return rtNormalizeAccountPayload(result.data);
  },

  async isAdmin(){
    const result=await rtRpcCall('rt_is_admin_caller',{},this.getSessionToken());
    if(!result.ok)return false;
    return !!result.data;
  }
};

if(typeof window!=='undefined'){
  window.rtAccountService=rtAccountService;
}
