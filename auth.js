// 认证 - 首次邮箱登录走验证码注册，之后邮箱密码登录
var rtSession=sb.getSession();
var profileAvatarDraft='';
var avatarCropState={src:'',naturalWidth:0,naturalHeight:0,scale:1,minScale:1,x:0,y:0,dragging:false,startX:0,startY:0,originX:0,originY:0};
var RT_GUEST_DEFAULT_NICKNAME='履迹用户';
var pendingOtpAuth={email:'',password:'',verifyType:'signup'};

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
    el.textContent='';
    if(avatarValue){
        var img=document.createElement('img');
        img.alt='avatar';
        img.className='avatar-image';
        img.src=avatarValue;
        el.appendChild(img);
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
    if(typeof window.rtSyncThemeToggleVisibility==='function')window.rtSyncThemeToggleVisibility(!!isLoggedIn);
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
    if(window.rtAnalytics&&typeof window.rtAnalytics.reset==='function')window.rtAnalytics.reset();
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
    if(typeof window.rtSyncThemeModeWithStore==='function')window.rtSyncThemeModeWithStore();
    updateAppShell(true);
    syncGuestDebug();
    updateAvatar();
    if(typeof initFilters==='function')initFilters();
    if(typeof updIntl==='function')updIntl();
    if(typeof refresh==='function')refresh();
    if(typeof switchView==='function')switchView('pipeline');
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_workspace_entered',{
        entry:'guest_mode',
        application_count:store.apps.length,
        resume_count:store.resumes.length,
        reflection_count:store.refs.length
    });
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_guest_mode_started',{entry:'login_page'});
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
        if(typeof window.rtIdentifyUser==='function')window.rtIdentifyUser(session.user,{auth_state:'authenticated'});
        console.log('[RT auth] active user',{userId:session.user&&session.user.id||null,email:session.user&&session.user.email||null});
        try{
            const loadResult=await cloudStore.loadInto(store);
            console.log('[RT auth] cloudStore.loadInto(store) returned',loadResult);
            var localNick=localStorage.getItem('rt_nickname')||'';
            if(localNick&&localNick!==getGuestDefaultNickname()&&!(store.settings&&store.settings.profileNickname)&&typeof store.setSetting==='function'){
                await store.setSetting('profileNickname',localNick);
            }
            var emailDefaultNick=getDefaultNicknameFromEmail(session.user&&session.user.email||'');
            if(emailDefaultNick&&!(store.settings&&store.settings.profileNickname)&&typeof store.setSetting==='function'){
                await store.setSetting('profileNickname',emailDefaultNick);
            }
            if(typeof window.rtSyncThemeModeWithStore==='function')await window.rtSyncThemeModeWithStore();
            if(typeof syncIntlToggles==='function')syncIntlToggles();
            if(typeof initFilters==='function')initFilters();
            if(typeof updIntl==='function')updIntl();
            if(typeof refresh==='function')refresh();
            if(typeof switchView==='function')switchView('pipeline');
            if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_workspace_entered',{
                entry:'email_auth',
                application_count:store.apps.length,
                resume_count:store.resumes.length,
                reflection_count:store.refs.length
            });
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
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_login_page_view',{auth_state:'logged_out'});
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

function getCleanLocationHref(){
    return location.href.split('#')[0];
}

function getAuthErrorText(result){
    return String(result&&(
        result.error_description||
        result.msg||
        result.error||
        ''
    )||'');
}

function isEmailNotConfirmedError(message){
    return message.toLowerCase().indexOf('email not confirmed')>=0;
}

function isInvalidLoginError(message){
    var lower=message.toLowerCase();
    return lower.indexOf('invalid login credentials')>=0||
        lower.indexOf('invalid credentials')>=0||
        lower.indexOf('invalid login')>=0;
}

function isConfirmationSendError(message){
    return message.toLowerCase().indexOf('error sending confirmation email')>=0;
}

function isAlreadyRegisteredError(message){
    var lower=message.toLowerCase();
    return lower.indexOf('already registered')>=0||
        lower.indexOf('already been registered')>=0||
        lower.indexOf('user already registered')>=0||
        lower.indexOf('already exists')>=0;
}

function showLoginStep(step){
    var step1=document.getElementById('login-step1');
    var step2=document.getElementById('login-step2');
    var hint=document.getElementById('login-hint');
    if(step1)step1.style.display=step===1?'':'none';
    if(step2)step2.style.display=step===2?'':'none';
    if(hint){
        hint.textContent=step===2
            ?'请输入邮箱中的验证码，验证完成后即可直接用当前密码登录。'
            :'首次使用会发送邮箱验证码，验证完成后即可保存到云端并支持多端同步。';
    }
}

function openVerifyStep(email,password){
    pendingOtpAuth.email=email;
    pendingOtpAuth.password=password;
    pendingOtpAuth.verifyType='signup';
    var emailDisplay=document.getElementById('verify-email-display');
    if(emailDisplay)emailDisplay.textContent=email;
    var codeInput=document.getElementById('verify-code');
    if(codeInput)codeInput.value='';
    showLoginStep(2);
}

function setSubmitIdleState(){
    if(!submitBtn)return;
    submitBtn.textContent='注册 / 登录';
    submitBtn.disabled=false;
}

function resetVerifyStep(){
    pendingOtpAuth.email='';
    pendingOtpAuth.password='';
    pendingOtpAuth.verifyType='signup';
    var codeInput=document.getElementById('verify-code');
    if(codeInput)codeInput.value='';
    showLoginStep(1);
}

async function resendSignupCode(email,password,successText){
    const resendRes=await sb.resendSignup(email);
    const resendErr=getAuthErrorText(resendRes);
    if(resendRes.error){
        if(isConfirmationSendError(resendErr)){
            showMsg('验证码邮件发送失败，请先确认 Supabase 的 SMTP 已配置完成。',true);
        }else{
            showMsg(resendErr||'验证码发送失败，请稍后重试。',true);
        }
        return false;
    }
    openVerifyStep(email,password);
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_otp_sent',{flow:'signup_resend'});
    showMsg(successText||'验证码已发送，请检查邮箱。',false);
    return true;
}

async function verifyEmailCode(email,code,preferredType){
    var firstType=preferredType||'signup';
    var first=await sb.verifyOTP(email,code,firstType);
    if(first&&first.access_token)return first;
    if(firstType!=='email'){
        var second=await sb.verifyOTP(email,code,'email');
        if(second&&second.access_token)return second;
        return second;
    }
    return first;
}

function clearLocalBusinessData(){
    if(typeof store==='undefined')return;
    store.resetState();
}

function onSuccess(result,meta){
    if(window.rtGuestStore)window.rtGuestStore.disable();
    clearLocalBusinessData();
    if(result&&result.user&&result.user.email){
        var emailNick=getDefaultNicknameFromEmail(result.user.email);
        var currentNick=localStorage.getItem('rt_nickname')||'';
        if(emailNick&&(!currentNick||currentNick===getGuestDefaultNickname())){
            localStorage.setItem('rt_nickname',emailNick);
        }
    }
    sb.setSession(result,'auth.onSuccess');
    syncSession(result);
    if(typeof window.rtIdentifyUser==='function'&&result&&result.user)window.rtIdentifyUser(result.user,{
        auth_state:'authenticated',
        auth_mode:'email',
        signup_method:'email_otp'
    });
    if(typeof window.rtTrackEvent==='function'){
        window.rtTrackEvent('rt_login_success',{flow:meta&&meta.flow||'password'});
        if(meta&&meta.isNewUser)window.rtTrackEvent('rt_sign_up_completed',{flow:meta.flow||'password'});
    }
    showMsg('欢迎！正在进入...',false);
    setTimeout(function(){location.replace(getCleanLocationHref());},600);
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
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_auth_started',{entry:'login_form'});

    var loginRes=await sb.signIn(email,pwd);
    if(loginRes.access_token){
        onSuccess(loginRes,{flow:'password'});
        return;
    }

    var errMsg=getAuthErrorText(loginRes);
    if(isEmailNotConfirmedError(errMsg)){
        await resendSignupCode(email,pwd,'这个邮箱还没有完成验证，已重新发送验证码。');
        submitBtn.textContent='注册 / 登录';
        submitBtn.disabled=false;
        return;
    }

    if(isInvalidLoginError(errMsg)){
        if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_sign_up_started',{entry:'login_form'});
        var signUpRes=await sb.signUp(email,pwd);
        if(signUpRes.access_token){
            onSuccess(signUpRes,{flow:'signup_direct',isNewUser:true});
            return;
        }
        if(signUpRes.user&&!signUpRes.error){
            openVerifyStep(email,pwd);
            if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_otp_sent',{flow:'signup'});
            showMsg('首次使用验证码已发送到邮箱，完成验证后即可用当前密码直接登录。',false);
            submitBtn.textContent='注册 / 登录';
            submitBtn.disabled=false;
            return;
        }
        var signUpErr=getAuthErrorText(signUpRes);
        if(isConfirmationSendError(signUpErr)){
            showMsg('注册邮件发送失败，请先确认 Supabase 的 SMTP 已配置完成。',true);
            setSubmitIdleState();
            return;
        }
        if(isAlreadyRegisteredError(signUpErr)){
            showMsg('邮箱或密码不正确，请重试。',true);
            resetVerifyStep();
            setSubmitIdleState();
            return;
        }
        showMsg('暂时无法完成注册或登录，请稍后重试。',true);
        setSubmitIdleState();
        return;
    }

    showMsg('邮箱或密码不正确，请重试。',true);
    setSubmitIdleState();
});

var guestBtn=document.getElementById('login-guest');
if(guestBtn)guestBtn.addEventListener('click',function(){
    hideMsg();
    resetVerifyStep();
    enterGuestMode();
});

var forgotBtn=document.getElementById('login-forgot');
if(forgotBtn)forgotBtn.addEventListener('click',async function(){
    openForgotModal();
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
    var email=pendingOtpAuth.email||document.getElementById('login-email').value.trim();
    var code=(document.getElementById('verify-code').value||'').trim();
    if(!email){
        showMsg('请先返回填写邮箱。',true);
        return;
    }
    if(!code||code.length<6){
        showMsg('请输入邮箱中的验证码。',true);
        return;
    }
    verifyBtn.textContent='验证中...';
    verifyBtn.disabled=true;
    var verifyRes=await verifyEmailCode(email,code,pendingOtpAuth.verifyType||'signup');
    if(verifyRes&&verifyRes.access_token){
        if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_otp_verified',{flow:'signup'});
        onSuccess(verifyRes,{flow:'signup_otp',isNewUser:true});
        return;
    }
    showMsg(getAuthErrorText(verifyRes)||'验证码错误或已过期，请重新获取。',true);
    verifyBtn.textContent='验证并进入';
    verifyBtn.disabled=false;
});

var resendBtn=document.getElementById('verify-resend');
if(resendBtn)resendBtn.addEventListener('click',async function(){
    var email=pendingOtpAuth.email||document.getElementById('login-email').value.trim();
    if(!email||!email.includes('@')){
        showMsg('请先返回填写邮箱。',true);
        return;
    }
    resendBtn.textContent='发送中...';
    resendBtn.disabled=true;
    await resendSignupCode(email,pendingOtpAuth.password||document.getElementById('login-password').value,'验证码已重新发送，请检查邮箱。');
    resendBtn.textContent='重新发送验证码';
    resendBtn.disabled=false;
});

var backBtn=document.getElementById('verify-back');
if(backBtn)backBtn.addEventListener('click',function(){
    hideMsg();
    resetVerifyStep();
});

function showForgotMsg(text,isErr){
    var el=document.getElementById('forgot-msg');
    if(!el)return;
    el.style.display='block';
    el.style.color=isErr?'var(--red)':'var(--green)';
    el.textContent=text;
}

function hideForgotMsg(){
    var el=document.getElementById('forgot-msg');
    if(el)el.style.display='none';
}

function openForgotModal(){
    hideForgotMsg();
    var loginEmail=(document.getElementById('login-email').value||'').trim();
    var forgotEmail=document.getElementById('forgot-email');
    if(forgotEmail)forgotEmail.value=loginEmail||forgotEmail.value||'';
    var forgotCode=document.getElementById('forgot-code');
    if(forgotCode)forgotCode.value='';
    var newPassword=document.getElementById('forgot-new-password');
    if(newPassword)newPassword.value='';
    var confirmPassword=document.getElementById('forgot-confirm-password');
    if(confirmPassword)confirmPassword.value='';
    document.getElementById('forgot-modal-overlay').classList.add('active');
}

function closeForgotModal(){
    document.getElementById('forgot-modal-overlay').classList.remove('active');
    hideForgotMsg();
}

var forgotModalClose=document.getElementById('forgot-modal-close');
if(forgotModalClose)forgotModalClose.addEventListener('click',closeForgotModal);
var forgotCancel=document.getElementById('forgot-cancel');
if(forgotCancel)forgotCancel.addEventListener('click',closeForgotModal);

var forgotSendCodeBtn=document.getElementById('forgot-send-code');
if(forgotSendCodeBtn)forgotSendCodeBtn.addEventListener('click',async function(){
    var email=(document.getElementById('forgot-email').value||'').trim();
    if(!email||!email.includes('@')){
        showForgotMsg('请输入有效的注册邮箱。',true);
        return;
    }
    forgotSendCodeBtn.textContent='发送中...';
    forgotSendCodeBtn.disabled=true;
    var otpRes=await sb.sendEmailOtp(email,false);
    if(otpRes&&otpRes.error){
        showForgotMsg(getAuthErrorText(otpRes)||'验证码发送失败，请稍后重试。',true);
    }else{
        if(typeof window.rtTrackEvent==='function'){
            window.rtTrackEvent('rt_password_reset_started',{entry:'forgot_modal'});
            window.rtTrackEvent('rt_otp_sent',{flow:'password_reset'});
        }
        showForgotMsg('验证码已发送，请查收邮箱。',false);
    }
    forgotSendCodeBtn.textContent='发送验证码';
    forgotSendCodeBtn.disabled=false;
});

var forgotConfirmBtn=document.getElementById('forgot-confirm');
if(forgotConfirmBtn)forgotConfirmBtn.addEventListener('click',async function(){
    var email=(document.getElementById('forgot-email').value||'').trim();
    var code=(document.getElementById('forgot-code').value||'').trim();
    var newPassword=(document.getElementById('forgot-new-password').value||'').trim();
    var confirmPassword=(document.getElementById('forgot-confirm-password').value||'').trim();
    if(!email||!email.includes('@')){
        showForgotMsg('请输入有效的注册邮箱。',true);
        return;
    }
    if(!code||code.length<6){
        showForgotMsg('请输入邮箱中的验证码。',true);
        return;
    }
    if(!newPassword||newPassword.length<6){
        showForgotMsg('新密码至少 6 位。',true);
        return;
    }
    if(newPassword!==confirmPassword){
        showForgotMsg('两次输入的新密码不一致，请重新确认。',true);
        return;
    }
    forgotConfirmBtn.textContent='验证中...';
    forgotConfirmBtn.disabled=true;
    var verifyRes=await sb.verifyOTP(email,code,'email');
    if(verifyRes&&verifyRes.access_token){
        if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_otp_verified',{flow:'password_reset'});
        var updateRes=await sb.updatePassword(verifyRes.access_token,newPassword);
        if(updateRes&&!updateRes.error){
            if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_password_reset_completed',{entry:'forgot_modal'});
            closeForgotModal();
            onSuccess(Object.assign({},verifyRes,{user:updateRes.user||verifyRes.user||null}),{flow:'password_reset'});
            return;
        }
        showForgotMsg(getAuthErrorText(updateRes)||'新密码保存失败，请重新获取验证码后再试。',true);
    }else{
        showForgotMsg(getAuthErrorText(verifyRes)||'验证码错误或已过期，请重新获取。',true);
    }
    forgotConfirmBtn.textContent='验证并登录';
    forgotConfirmBtn.disabled=false;
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
    var subtitleEl=document.getElementById('profile-modal-subtitle');
    if(subtitleEl)subtitleEl.textContent=isGuest?'本地体验 · 数据仅保存在当前设备':'邮箱登录 · 设置即时同步到云端';
    document.getElementById('profile-login-method').textContent=isGuest?'体验模式 · 当前设备保存':(u.email||'');
    var authChipEl=document.getElementById('profile-auth-chip');
    if(authChipEl)authChipEl.textContent=isGuest?'本地体验模式':'邮箱密码登录';
    var syncDescEl=document.getElementById('profile-sync-desc');
    if(syncDescEl)syncDescEl.textContent=isGuest?'昵称、偏好和标签会保存在当前设备，登录后才可同步到云端。':'昵称、偏好和标签都会跟随账号一起同步。';
    var emailEl=document.getElementById('profile-email-display');
    if(emailEl)emailEl.textContent=isGuest?'未登录，数据仅保存在本机':(u.email||'—');
    var footerNoteEl=document.getElementById('profile-footer-note-text');
    if(footerNoteEl)footerNoteEl.textContent=isGuest?'当前仅保存在本地，登录后才可保存云端并多端同步':'业务数据自动保存到云端';
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
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_profile_saved',{
        guest_mode:!!(window.rtGuestStore&&window.rtGuestStore.isEnabled())
    });
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
        if(window.rtAnalytics&&typeof window.rtAnalytics.reset==='function')window.rtAnalytics.reset();
        location.reload();
        return;
    }
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_logged_out',{entry:'profile_modal'});
    if(rtSession&&rtSession.access_token)await sb.signOut(rtSession.access_token);
    sb.clearSession('auth.logout');
    if(window.rtAnalytics&&typeof window.rtAnalytics.reset==='function')window.rtAnalytics.reset();
    clearLocalBusinessData();
    location.reload();
});

var profileClose=document.getElementById('profile-modal-close');
if(profileClose)profileClose.addEventListener('click',function(){
    document.getElementById('profile-modal-overlay').classList.remove('active');
});

checkAuth();
