// 认证 - 统一邮箱密码登录/注册
var rtSession=sb.getSession();
var profileAvatarDraft='';
var avatarCropState={src:'',naturalWidth:0,naturalHeight:0,scale:1,minScale:1,x:0,y:0,dragging:false,startX:0,startY:0,originX:0,originY:0};
var RT_GUEST_DEFAULT_NICKNAME='履迹用户';

function getDefaultNicknameFromEmail(email){
    return email&&email.indexOf('@')>0?email.split('@')[0]:'';
}

function getGuestDefaultNickname(){
    return RT_GUEST_DEFAULT_NICKNAME;
}

function ensureGuestNickname(){
    var current=(typeof getProfileNickname==='function'&&getProfileNickname())||localStorage.getItem('rt_nickname')||'';
    if(current&&current.trim())return current.trim();
    localStorage.setItem('rt_nickname',getGuestDefaultNickname());
    return getGuestDefaultNickname();
}

function getAvatarCropStageSize(){
    var stage=document.getElementById('avatar-crop-stage');
    return stage&&stage.clientWidth?stage.clientWidth:280;
}

function clampAvatarCrop(){
    var stageSize=getAvatarCropStageSize();
    var scaledW=avatarCropState.naturalWidth*avatarCropState.scale;
    var scaledH=avatarCropState.naturalHeight*avatarCropState.scale;
    avatarCropState.x=Math.min(0,Math.max(stageSize-scaledW,avatarCropState.x));
    avatarCropState.y=Math.min(0,Math.max(stageSize-scaledH,avatarCropState.y));
}

function renderAvatarCrop(){
    var img=document.getElementById('avatar-crop-image');
    if(!img||!avatarCropState.src)return;
    var scaledW=avatarCropState.naturalWidth*avatarCropState.scale;
    var scaledH=avatarCropState.naturalHeight*avatarCropState.scale;
    img.src=avatarCropState.src;
    img.style.width=scaledW+'px';
    img.style.height=scaledH+'px';
    img.style.transform=`translate(${avatarCropState.x}px, ${avatarCropState.y}px)`;
}

function openAvatarCropper(dataUrl,width,height){
    document.getElementById('avatar-crop-overlay').classList.add('active');
    var stageSize=getAvatarCropStageSize();
    avatarCropState.src=dataUrl;
    avatarCropState.naturalWidth=width;
    avatarCropState.naturalHeight=height;
    avatarCropState.minScale=Math.max(stageSize/width,stageSize/height);
    avatarCropState.scale=avatarCropState.minScale;
    avatarCropState.x=(stageSize-width*avatarCropState.scale)/2;
    avatarCropState.y=(stageSize-height*avatarCropState.scale)/2;
    clampAvatarCrop();
    var zoom=document.getElementById('avatar-crop-zoom');
    if(zoom)zoom.value='100';
    renderAvatarCrop();
}

function closeAvatarCropper(){
    document.getElementById('avatar-crop-overlay').classList.remove('active');
    var stage=document.getElementById('avatar-crop-stage');
    if(stage)stage.classList.remove('dragging');
    avatarCropState.dragging=false;
}

function applyAvatarContent(el,avatarValue,fallbackText){
    if(!el)return;
    if(avatarValue){
        el.innerHTML=`<img src="${avatarValue}" alt="avatar" class="avatar-image">`;
        return;
    }
    el.textContent=fallbackText||'👤';
}

function syncSession(session){
    rtSession=session||null;
    if(window.rtDebug)window.rtDebug.update({
        email:rtSession&&rtSession.user&&rtSession.user.email||'-',
        userId:rtSession&&rtSession.user&&rtSession.user.id||'-',
        sessionExists:rtSession&&rtSession.access_token?'yes':'no'
    });
}

window.addEventListener('rt:session',function(event){
    syncSession(event.detail&&event.detail.session||null);
    updateAvatar();
});

function updateAppShell(isLoggedIn){
    document.getElementById('login-page').style.display=isLoggedIn?'none':'flex';
    document.getElementById('app').style.display=isLoggedIn?'flex':'none';
}

function syncGuestDebug(){
    if(window.rtDebug&&window.rtGuestStore&&window.rtGuestStore.isEnabled()){
        window.rtDebug.update({
            email:'体验模式',
            userId:'local-device',
            sessionExists:'local'
        });
    }
}

function enterGuestMode(){
    if(!window.rtGuestStore)return;
    window.rtGuestStore.enable();
    sb.clearSession('guest.enter');
    clearLocalBusinessData();
    var guestNickname=ensureGuestNickname();
    const data=window.rtGuestStore.ensureData();
    if(data){
        store.apps=(data.apps||[]).map(normalizeAppRecord);
        store.resumes=cloneData(data.resumes||[]);
        store.refs=cloneData(data.refs||[]);
        store.logs=cloneData(data.logs||[]);
        store.settings=Object.assign(getDefaultSettings(),data.settings||{});
        if(!store.settings.profileNickname)store.settings.profileNickname=guestNickname;
        store.categories=cloneData(data.categories||[]);
        store.painPoints=cloneData(data.pain_points||DEFAULT_PP);
        store.tableCols=normalizeTableColumns(data.table_cols||DEFAULT_COLS);
        if(window.rtGuestStore&&window.rtGuestStore.isEnabled())window.rtGuestStore.save(store);
    }
    updateAppShell(true);
    syncGuestDebug();
    updateAvatar();
    if(typeof initFilters==='function')initFilters();
    if(typeof updIntl==='function')updIntl();
    if(typeof refresh==='function')refresh();
    if(typeof switchView==='function')switchView('pipeline');
    showMsg('当前为本地体验模式，数据仅保存在本机。',false);
    setTimeout(function(){hideMsg();},1800);
}

async function checkAuth(){
    var sessionSnapshot=sb.getSession();
    console.log('[RT auth] checkAuth start',{
        rtSessionExists:!!localStorage.getItem('rt_session'),
        hasAccessToken:!!(sessionSnapshot&&sessionSnapshot.access_token),
        hasRefreshToken:!!(sessionSnapshot&&sessionSnapshot.refresh_token),
        userId:sessionSnapshot&&sessionSnapshot.user&&sessionSnapshot.user.id||null
    });
    const session=await sb.ensureSession();
    syncSession(session);
    if(session&&session.access_token){
        updateAppShell(true);
        updateAvatar();
        console.log('[RT auth] active user',{userId:session.user&&session.user.id||null,email:session.user&&session.user.email||null});
        try{
            const loadResult=await cloudStore.loadInto(store);
            console.log('[RT auth] cloudStore.loadInto(store) returned',loadResult);
            var localNick=localStorage.getItem('rt_nickname')||'';
            if(localNick&&!(store.settings&&store.settings.profileNickname)&&typeof store.setSetting==='function'){
                await store.setSetting('profileNickname',localNick);
            }
            var emailDefaultNick=getDefaultNicknameFromEmail(session.user&&session.user.email||'');
            if(emailDefaultNick&&!(store.settings&&store.settings.profileNickname)&&typeof store.setSetting==='function'){
                await store.setSetting('profileNickname',emailDefaultNick);
            }
            if(typeof syncIntlToggles==='function')syncIntlToggles();
            if(typeof initFilters==='function')initFilters();
            if(typeof updIntl==='function')updIntl();
            if(typeof refresh==='function')refresh();
            if(typeof switchView==='function')switchView('pipeline');
            return true;
        }catch(err){
            console.error('[RT auth] cloud load failed',err);
            toast('云端数据加载失败，请刷新重试','error');
            return false;
        }
    }
    if(window.rtGuestStore&&window.rtGuestStore.isEnabled()){
        enterGuestMode();
        return true;
    }
    updateAppShell(false);
    return false;
}

function updateAvatar(){
    var av=document.getElementById('sidebar-avatar');
    if(av){
        if(window.rtGuestStore&&window.rtGuestStore.isEnabled()&&!rtSession){
            var guestNick=ensureGuestNickname();
            var guestAvatar=(typeof getProfileAvatar==='function'&&getProfileAvatar())||'';
            applyAvatarContent(av,guestAvatar,guestNick?guestNick[0].toUpperCase():'体');
            return;
        }
        if(!rtSession)return;
        var nick=(typeof getProfileNickname==='function'&&getProfileNickname())||'';
        var email=rtSession.user&&rtSession.user.email||'';
        var avatar=(typeof getProfileAvatar==='function'&&getProfileAvatar())||'';
        applyAvatarContent(av,avatar,nick?nick[0].toUpperCase():(email?email[0].toUpperCase():'👤'));
    }
}

function showMsg(text,isErr){
    var el=document.getElementById('login-msg');
    if(el){
        el.style.display='block';
        el.style.color=isErr?'var(--red)':'var(--green)';
        el.textContent=text;
    }
}

function hideMsg(){
    var el=document.getElementById('login-msg');
    if(el)el.style.display='none';
}

function clearLocalBusinessData(){
    if(typeof store==='undefined')return;
    store.resetState();
}

function onSuccess(result){
    if(window.rtGuestStore)window.rtGuestStore.disable();
    clearLocalBusinessData();
    if(result&&result.user&&result.user.email&&!localStorage.getItem('rt_nickname')){
        localStorage.setItem('rt_nickname',getDefaultNicknameFromEmail(result.user.email));
    }
    sb.setSession(result,'auth.onSuccess');
    syncSession(result);
    showMsg('欢迎！正在进入...',false);
    setTimeout(function(){location.reload();},600);
}

var submitBtn=document.getElementById('login-submit');
if(submitBtn)submitBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email').value.trim();
    var pwd=document.getElementById('login-password').value;
    if(!email||!email.includes('@')){showMsg('请输入有效邮箱',true);return;}
    if(!pwd||pwd.length<6){showMsg('密码至少6位',true);return;}
    hideMsg();
    submitBtn.textContent='请稍候...';
    submitBtn.disabled=true;

    var loginRes=await sb.signIn(email,pwd);
    if(loginRes.access_token){
        onSuccess(loginRes);
        return;
    }

    var errMsg=loginRes.error_description||loginRes.msg||loginRes.error||'';
    if(errMsg.indexOf('Invalid login')>=0||errMsg.indexOf('invalid')>=0||errMsg.indexOf('Email not confirmed')>=0){
        var signUpRes=await sb.signUp(email,pwd);
        if(signUpRes.access_token){
            onSuccess(signUpRes);
            return;
        }
        if(signUpRes.user&&!signUpRes.error){
            var retryLogin=await sb.signIn(email,pwd);
            if(retryLogin.access_token){
                onSuccess(retryLogin);
                return;
            }
            showMsg('账号已创建，请重新点击注册 / 登录',false);
            submitBtn.textContent='注册 / 登录';
            submitBtn.disabled=false;
            return;
        }
        if(signUpRes.error){
            var signUpErr=signUpRes.error_description||signUpRes.msg||signUpRes.error||'';
            if(signUpErr.indexOf('Error sending confirmation email')>=0){
                showMsg('Supabase 当前开启了邮箱确认，但项目没有可用的发信通道。请到后台的 Authentication > Providers > Email，部分版本会显示在 Authentication > Settings，关闭 Confirm email，或先配置自定义 SMTP。',true);
                submitBtn.textContent='注册 / 登录';
                submitBtn.disabled=false;
                return;
            }
            if(signUpErr.indexOf('already')>=0||signUpErr.indexOf('exists')>=0){
                showMsg('邮箱号或密码错误，请重试',true);
            }else{
                showMsg(signUpErr||'注册失败',true);
            }
            submitBtn.textContent='注册 / 登录';
            submitBtn.disabled=false;
            return;
        }
    }

    if(errMsg.indexOf('Invalid login')>=0||errMsg.indexOf('invalid')>=0){
        showMsg('邮箱号或密码错误，请重试',true);
    }else{
        showMsg(errMsg||'登录失败',true);
    }
    submitBtn.textContent='注册 / 登录';
    submitBtn.disabled=false;
});

var guestBtn=document.getElementById('login-guest');
if(guestBtn)guestBtn.addEventListener('click',function(){
    hideMsg();
    enterGuestMode();
});

var pwdToggle=document.getElementById('login-password-toggle');
if(pwdToggle)pwdToggle.addEventListener('click',function(){
    var input=document.getElementById('login-password');
    if(!input)return;
    var nextType=input.type==='password'?'text':'password';
    input.type=nextType;
    pwdToggle.classList.toggle('is-active',nextType==='text');
});

var verifyBtn=document.getElementById('verify-submit');
if(verifyBtn)verifyBtn.addEventListener('click',async function(){
    showMsg('当前版本已切换为邮箱密码注册登录，无需验证码。',false);
});

var backBtn=document.getElementById('verify-back');
if(backBtn)backBtn.addEventListener('click',function(){
    document.getElementById('login-step1').style.display='';
    document.getElementById('login-step2').style.display='none';
    document.getElementById('login-hint').style.display='';
    hideMsg();
});

var codeInput=document.getElementById('verify-code');
if(codeInput)codeInput.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&verifyBtn)verifyBtn.click();
});

var pwdInput=document.getElementById('login-password');
if(pwdInput)pwdInput.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&submitBtn)submitBtn.click();
});

function openProfileModal(){
    var isGuest=window.rtGuestStore&&window.rtGuestStore.isEnabled()&&!rtSession;
    if(!rtSession&&!isGuest)return;
    var u=rtSession&&rtSession.user||{};
    var nick=isGuest?ensureGuestNickname():((store&&store.settings&&store.settings.profileNickname)||localStorage.getItem('rt_nickname')||getDefaultNicknameFromEmail(u.email)||'');
    profileAvatarDraft=(store&&store.settings&&store.settings.profileAvatar)||'';
    document.getElementById('profile-nickname').value=nick;
    document.getElementById('profile-nickname-display').textContent=nick||'用户';
    applyAvatarContent(document.getElementById('profile-avatar-display'),profileAvatarDraft,nick?(nick[0].toUpperCase()):(u.email?(u.email[0].toUpperCase()):'👤'));
    document.getElementById('profile-login-method').textContent=isGuest?'体验模式 · 当前设备保存':(u.email||'');
    var emailEl=document.getElementById('profile-email-display');
    if(emailEl)emailEl.textContent=isGuest?'未登录，数据仅保存在本机':(u.email||'—');
    var logoutBtn=document.getElementById('profile-logout');
    if(logoutBtn)logoutBtn.textContent=isGuest?'返回登录':'退出登录';
    var weeklyGoalEl=document.getElementById('settings-weekly-goal');
    if(weeklyGoalEl&&typeof getWeeklyGoal==='function')weeklyGoalEl.value=getWeeklyGoal();
    if(typeof syncIntlToggles==='function')syncIntlToggles();
    if(typeof renderSetCats==='function')renderSetCats();
    if(typeof renderSetPPs==='function')renderSetPPs();
    var clearArea=document.getElementById('clear-confirm-area');
    if(clearArea)clearArea.style.display='none';
    var clearInput=document.getElementById('clear-confirm-input');
    if(clearInput)clearInput.value='';
    document.getElementById('profile-modal-overlay').classList.add('active');
}

var profileBtn=document.getElementById('profile-btn');
if(profileBtn)profileBtn.addEventListener('click',openProfileModal);

var profileSave=document.getElementById('profile-save');
if(profileSave)profileSave.addEventListener('click',async function(){
    var nickname=document.getElementById('profile-nickname').value.trim();
    if(typeof store!=='undefined'&&typeof store.setSetting==='function'){
        var ok=await store.setSetting('profileNickname',nickname);
        if(ok===false)return;
        var avatarOk=await store.setSetting('profileAvatar',profileAvatarDraft||'');
        if(avatarOk===false)return;
    }
    localStorage.setItem('rt_nickname',nickname);
    if(window.rtGuestStore&&window.rtGuestStore.isEnabled())window.rtGuestStore.save(store);
    document.getElementById('profile-nickname-display').textContent=nickname||'用户';
    applyAvatarContent(document.getElementById('profile-avatar-display'),profileAvatarDraft||'',nickname?(nickname[0].toUpperCase()):((rtSession&&rtSession.user&&rtSession.user.email)?rtSession.user.email[0].toUpperCase():'👤'));
    document.getElementById('profile-modal-overlay').classList.remove('active');
    updateAvatar();
    toast('已保存','success');
});

var profileAvatarChange=document.getElementById('profile-avatar-change');
var profileAvatarInput=document.getElementById('profile-avatar-input');
if(profileAvatarChange&&profileAvatarInput)profileAvatarChange.addEventListener('click',function(){
    profileAvatarInput.click();
});
if(profileAvatarInput)profileAvatarInput.addEventListener('change',function(event){
    var file=event.target.files&&event.target.files[0];
    if(!file)return;
    if(!file.type||file.type.indexOf('image/')!==0){
        if(typeof toast==='function')toast('请选择图片文件','error');
        return;
    }
    var reader=new FileReader();
    reader.onload=function(loadEvent){
        var src=loadEvent.target&&loadEvent.target.result||'';
        var probe=new Image();
        probe.onload=function(){
            openAvatarCropper(src,probe.naturalWidth,probe.naturalHeight);
        };
        probe.src=src;
    };
    reader.readAsDataURL(file);
    event.target.value='';
});

var avatarCropStage=document.getElementById('avatar-crop-stage');
var avatarCropZoom=document.getElementById('avatar-crop-zoom');
if(avatarCropZoom)avatarCropZoom.addEventListener('input',function(event){
    if(!avatarCropState.src)return;
    var stageSize=getAvatarCropStageSize();
    var prevScale=avatarCropState.scale;
    var factor=parseInt(event.target.value,10)/100;
    avatarCropState.scale=avatarCropState.minScale*factor;
    var centerX=(stageSize/2-avatarCropState.x)/prevScale;
    var centerY=(stageSize/2-avatarCropState.y)/prevScale;
    avatarCropState.x=stageSize/2-centerX*avatarCropState.scale;
    avatarCropState.y=stageSize/2-centerY*avatarCropState.scale;
    clampAvatarCrop();
    renderAvatarCrop();
});

if(avatarCropStage)avatarCropStage.addEventListener('pointerdown',function(event){
    if(!avatarCropState.src)return;
    avatarCropState.dragging=true;
    avatarCropState.startX=event.clientX;
    avatarCropState.startY=event.clientY;
    avatarCropState.originX=avatarCropState.x;
    avatarCropState.originY=avatarCropState.y;
    avatarCropStage.classList.add('dragging');
});

window.addEventListener('pointermove',function(event){
    if(!avatarCropState.dragging)return;
    avatarCropState.x=avatarCropState.originX+(event.clientX-avatarCropState.startX);
    avatarCropState.y=avatarCropState.originY+(event.clientY-avatarCropState.startY);
    clampAvatarCrop();
    renderAvatarCrop();
});

window.addEventListener('pointerup',function(){
    if(!avatarCropState.dragging)return;
    avatarCropState.dragging=false;
    if(avatarCropStage)avatarCropStage.classList.remove('dragging');
});

var avatarCropCancel=document.getElementById('avatar-crop-cancel');
var avatarCropClose=document.getElementById('avatar-crop-close');
if(avatarCropCancel)avatarCropCancel.addEventListener('click',closeAvatarCropper);
if(avatarCropClose)avatarCropClose.addEventListener('click',closeAvatarCropper);

var avatarCropConfirm=document.getElementById('avatar-crop-confirm');
if(avatarCropConfirm)avatarCropConfirm.addEventListener('click',function(){
    if(!avatarCropState.src)return;
    var stageSize=getAvatarCropStageSize();
    var canvas=document.createElement('canvas');
    canvas.width=320;
    canvas.height=320;
    var ctx=canvas.getContext('2d');
    ctx.drawImage(
        document.getElementById('avatar-crop-image'),
        (-avatarCropState.x)/avatarCropState.scale,
        (-avatarCropState.y)/avatarCropState.scale,
        stageSize/avatarCropState.scale,
        stageSize/avatarCropState.scale,
        0,
        0,
        canvas.width,
        canvas.height
    );
    profileAvatarDraft=canvas.toDataURL('image/png');
    var nick=document.getElementById('profile-nickname').value.trim();
    var email=rtSession&&rtSession.user&&rtSession.user.email||'';
    applyAvatarContent(document.getElementById('profile-avatar-display'),profileAvatarDraft,nick?(nick[0].toUpperCase()):(email?email[0].toUpperCase():'👤'));
    closeAvatarCropper();
});

var profileLogout=document.getElementById('profile-logout');
if(profileLogout)profileLogout.addEventListener('click',async function(){
    var isGuest=window.rtGuestStore&&window.rtGuestStore.isEnabled()&&!rtSession;
    if(!confirm(isGuest?'返回登录页？本地体验数据会保留在当前设备。':'确定退出登录？'))return;
    if(isGuest){
        window.rtGuestStore.disable();
        location.reload();
        return;
    }
    if(rtSession&&rtSession.access_token)await sb.signOut(rtSession.access_token);
    sb.clearSession('auth.logout');
    clearLocalBusinessData();
    location.reload();
});

var profileClose=document.getElementById('profile-modal-close');
if(profileClose)profileClose.addEventListener('click',function(){
    document.getElementById('profile-modal-overlay').classList.remove('active');
});

checkAuth();
