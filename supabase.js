// Supabase 云端数据服务层（云端唯一真源）
const SUPABASE_URL='https://bpynqhujzvadyakypfju.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweW5xaHVqenZhZHlha3lwZmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODIzMTAsImV4cCI6MjA5Mjk1ODMxMH0.sdU-HLNvVlyVstDUAesvKM_MX_4kBhxTd9OSTlRLXF8';
const RT_SESSION_KEY='rt_session';
const USER_DATA_FIELDS=['apps','resumes','refs','logs','categories','pain_points','settings','table_cols'];

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
    refs:[],
    logs:[],
    categories:[],
    pain_points:(typeof DEFAULT_PP!=='undefined'?[...DEFAULT_PP]:[]),
    settings:{intlMode:false,weeklyGoal:10},
    table_cols:(typeof DEFAULT_COLS!=='undefined'?[...DEFAULT_COLS]:[])
  };
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
    localStorage.setItem(RT_SESSION_KEY,JSON.stringify(session));
    rtLog(label||'session.set',{hasAccess:!!session.access_token,hasRefresh:!!session.refresh_token,userId:session.user&&session.user.id||null});
    if(window.rtDebug)window.rtDebug.update({email:session.user&&session.user.email||'-',userId:session.user&&session.user.id||'-',sessionExists:'yes'});
    window.dispatchEvent(new CustomEvent('rt:session',{detail:{session:session||null}}));
    return session;
  },

  clearSession(label){
    localStorage.removeItem(RT_SESSION_KEY);
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

  async signInOTP(email){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/otp',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email:email,create_user:true})
    });
    return this.unwrapAuthResponse('auth.signInOTP',result);
  },

  async verifyOTP(email,token){
    const result=await this.requestJson(SUPABASE_URL+'/auth/v1/verify',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},
      body:JSON.stringify({email:email,token:token,type:'email'})
    });
    return this.unwrapAuthResponse('auth.verifyOTP',result);
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
    store.apps=data.apps;
    store.resumes=data.resumes;
    store.refs=data.refs;
    store.logs=data.logs;
    store.categories=data.categories;
    store.painPoints=data.pain_points;
    store.settings=Object.assign({intlMode:false,weeklyGoal:10},data.settings||{});
    store.tableCols=data.table_cols;
  },

  buildPayloadFromStore(store){
    return {
      apps:rtClone(store.apps),
      resumes:rtClone(store.resumes),
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
        const created=await sb.persistUserData(null,this.buildPayloadFromStore({apps:[],resumes:[],refs:[],logs:[],categories:[],painPoints:(typeof DEFAULT_PP!=='undefined'?[...DEFAULT_PP]:[]),settings:{intlMode:false,weeklyGoal:10},tableCols:(typeof DEFAULT_COLS!=='undefined'?[...DEFAULT_COLS]:[])}));
        if(!created.ok)throw new Error(created.error||'创建 user_data 失败');
        row=created.data;
      }

      this.rowId=row&&row.id||null;
      const decoded=sb.decodeUserDataRow(row);
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
    const deleted=await sb.deleteUserDataRowsByUserId(uid);
    console.log('[RT cloud] clearAllData delete response',deleted);
    if(!deleted.ok){
      const defaults=rtDefaultUserData();
      const payload={
        apps:defaults.apps,
        resumes:defaults.resumes,
        refs:defaults.refs,
        logs:defaults.logs,
        categories:defaults.categories,
        pain_points:defaults.pain_points,
        settings:defaults.settings,
        table_cols:defaults.table_cols
      };
      const ensuredId=await this.ensureRow(store);
      const resetResult=await sb.persistUserData(ensuredId,payload);
      console.log('[RT cloud] clearAllData reset response',resetResult);
      if(!resetResult.ok)throw new Error(resetResult.error||'清空云端数据失败');
    }
    store.resetState();
    this.rowId=null;
    this.loaded=false;
    if(window.rtDebug)window.rtDebug.update({
      lastSaveAt:new Date().toLocaleTimeString('zh-CN',{hour12:false}),
      saveResult:'success',
      lastLoadAt:'-'
    });
    return true;
  }
};
