// 认证 - 首次邮箱登录走验证码注册，之后邮箱密码登录
var rtSession=sb.getSession();
var profileAvatarDraft='';
var avatarCropState={src:'',naturalWidth:0,naturalHeight:0,scale:1,minScale:1,x:0,y:0,dragging:false,startX:0,startY:0,originX:0,originY:0};
var RT_GUEST_DEFAULT_NICKNAME='履迹用户';
var pendingOtpAuth={email:'',password:'',verifyType:'signup',syncPassword:false};
var pendingRegisterIntent={active:false,email:'',password:''};
var passwordFailureCounts={};

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
    if(window.rtAccountService&&typeof window.rtAccountService.ensureAccount==='function'){
        window.rtAccountService.ensureAccount({input_source_channel:'guest_mode'}).catch(function(err){
            console.warn('[RT auth] guest ensure account failed',err);
        });
    }
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
        if(window.rtAccountService&&typeof window.rtAccountService.ensureAccount==='function'){
            try{
                await window.rtAccountService.ensureAccount({
                    input_email:session.user&&session.user.email||'',
                    input_source_channel:'email_auth'
                });
            }catch(accountErr){
                console.warn('[RT auth] ensure account failed',accountErr);
            }
        }
        console.log('[RT auth] active user',{userId:session.user&&session.user.id||null,email:session.user&&session.user.email||null});
        try{
            const loadResult=await cloudStore.loadInto(store);
            console.log('[RT auth] cloudStore.loadInto(store) returned',loadResult);
            await migrateGuestStateToAccount(session);
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

function getPasswordFailureCount(email){
    return passwordFailureCounts[email]||0;
}

function incrementPasswordFailureCount(email){
    passwordFailureCounts[email]=(passwordFailureCounts[email]||0)+1;
    return passwordFailureCounts[email];
}

function clearPasswordFailureCount(email){
    if(email&&passwordFailureCounts[email])delete passwordFailureCounts[email];
}

function clearPendingRegisterIntent(){
    pendingRegisterIntent.active=false;
    pendingRegisterIntent.email='';
    pendingRegisterIntent.password='';
    closeRegisterChoiceModal();
}

function openRegisterChoiceModal(email,password){
    pendingRegisterIntent.active=true;
    pendingRegisterIntent.email=email;
    pendingRegisterIntent.password=password;
    document.getElementById('register-choice-overlay').classList.add('active');
}

function closeRegisterChoiceModal(){
    var overlay=document.getElementById('register-choice-overlay');
    if(overlay)overlay.classList.remove('active');
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

function getAuthErrorCode(result){
    return String(result&&(
        result.error_code||
        result.code||
        ''
    )||'');
}

function extractRateLimitSeconds(message){
    var match=String(message||'').match(/after\s+(\d+)\s+seconds?/i);
    return match?parseInt(match[1],10):0;
}

function isEmailRateLimitError(result){
    var code=getAuthErrorCode(result).toLowerCase();
    var message=getAuthErrorText(result).toLowerCase();
    return code.indexOf('rate_limit')>=0||
        code.indexOf('too_many')>=0||
        message.indexOf('rate limit')>=0||
        message.indexOf('too many requests')>=0||
        message.indexOf('for security purposes')>=0;
}

function isWeakPasswordError(result){
    var code=getAuthErrorCode(result).toLowerCase();
    var message=getAuthErrorText(result).toLowerCase();
    return code.indexOf('weak_password')>=0||
        message.indexOf('password should be')>=0||
        message.indexOf('password is too weak')>=0;
}

function isSamePasswordNoopError(result){
    var code=getAuthErrorCode(result).toLowerCase();
    var message=getAuthErrorText(result).toLowerCase();
    return code.indexOf('same_password')>=0||
        message.indexOf('new password should be different from the old password')>=0||
        message.indexOf('password should be different from the old password')>=0;
}

function isNetworkLikeError(result){
    var message=getAuthErrorText(result).toLowerCase();
    return !result||
        message.indexOf('failed to fetch')>=0||
        message.indexOf('networkerror')>=0||
        message.indexOf('network request failed')>=0;
}

function hasPendingVerificationUser(result){
    if(!(result&&result.user&&!result.error))return false;
    var identities=Array.isArray(result.user.identities)?result.user.identities:[];
    return identities.length>0||
        !!result.user.confirmation_sent_at||
        !!(result.user.user_metadata&&result.user.user_metadata.email_verified===false);
}

function getRateLimitMessage(result,defaultText){
    var seconds=extractRateLimitSeconds(getAuthErrorText(result));
    if(seconds>0)return '验证码刚发送过，请先使用最新一封邮件中的验证码，或 '+seconds+' 秒后再试。';
    return defaultText||'验证码刚发送过，请稍等片刻后再试。';
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

function openVerifyStep(email,password,options){
    options=options||{};
    pendingOtpAuth.email=email;
    pendingOtpAuth.password=password;
    pendingOtpAuth.verifyType=options.verifyType||'signup';
    pendingOtpAuth.syncPassword=!!options.syncPassword;
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
    clearPendingRegisterIntent();
    pendingOtpAuth.email='';
    pendingOtpAuth.password='';
    pendingOtpAuth.verifyType='signup';
    pendingOtpAuth.syncPassword=false;
    var codeInput=document.getElementById('verify-code');
    if(codeInput)codeInput.value='';
    showLoginStep(1);
}

async function resendSignupCode(email,password,successText,options){
    options=options||{};
    var verifyType=options.verifyType||'signup';
    var syncPassword=!!options.syncPassword;
    var resendRes=null;
    if(options.mode==='resend_only'){
        resendRes=await sb.resendSignup(email);
        if(resendRes.error&&!isEmailRateLimitError(resendRes)){
            resendRes=await sb.sendEmailOtp(email,true);
        }
    }else{
        resendRes=await sb.sendEmailOtp(email,true);
        if(resendRes.error&&!isEmailRateLimitError(resendRes)&&!isWeakPasswordError(resendRes)){
            resendRes=await sb.resendSignup(email);
        }
    }
    if(resendRes.error){
        if(isEmailRateLimitError(resendRes)){
            openVerifyStep(email,password,{verifyType:verifyType,syncPassword:syncPassword});
            showMsg(getRateLimitMessage(resendRes),false);
        }else if(isConfirmationSendError(getAuthErrorText(resendRes))){
            showMsg('验证码邮件发送失败，请先确认 Supabase 的 SMTP 已配置完成。',true);
        }else if(isWeakPasswordError(resendRes)){
            showMsg('密码强度不足，请改成至少 6 位，并尽量包含字母和数字。',true);
        }else{
            showMsg(getAuthErrorText(resendRes)||'验证码发送失败，请稍后重试。',true);
        }
        return false;
    }
    openVerifyStep(email,password,{verifyType:verifyType,syncPassword:syncPassword});
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

async function continueSignupFlow(email,pwd){
    if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_sign_up_started',{entry:'login_form'});
    var signUpRes=await sb.signUp(email,pwd);
    if(signUpRes.access_token){
        clearPendingRegisterIntent();
        onSuccess(signUpRes,{flow:'signup_direct',isNewUser:true});
        return true;
    }
    if(hasPendingVerificationUser(signUpRes)){
        clearPendingRegisterIntent();
        openVerifyStep(email,pwd,{verifyType:'signup',syncPassword:true});
        if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_otp_sent',{flow:'signup'});
        showMsg('首次使用验证码已发送到邮箱，完成验证后即可用当前密码直接登录。',false);
        return true;
    }
    if(signUpRes.user&&!signUpRes.error){
        clearPendingRegisterIntent();
        showMsg('这个邮箱已经注册，请检查密码；如果还没完成邮箱验证，请直接获取验证码继续。',true);
        return true;
    }
    if(isEmailRateLimitError(signUpRes)){
        clearPendingRegisterIntent();
        openVerifyStep(email,pwd);
        showMsg(getRateLimitMessage(signUpRes),false);
        return true;
    }
    if(isConfirmationSendError(getAuthErrorText(signUpRes))){
        showMsg('注册邮件发送失败，请先确认 Supabase 的 SMTP 已配置完成。',true);
        return true;
    }
    if(isWeakPasswordError(signUpRes)){
        showMsg('密码强度不足，请改成至少 6 位，并尽量包含字母和数字。',true);
        return true;
    }
    if(isAlreadyRegisteredError(getAuthErrorText(signUpRes))){
        clearPendingRegisterIntent();
        showMsg('邮箱或密码不正确，请重试。',true);
        return true;
    }
    if(isNetworkLikeError(signUpRes)){
        showMsg('网络连接异常，请检查网络后重试。',true);
        return true;
    }
    var otpFallback=await sb.sendEmailOtp(email,true);
    if(!otpFallback.error){
        clearPendingRegisterIntent();
        openVerifyStep(email,pwd,{verifyType:'signup',syncPassword:true});
        if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_otp_sent',{flow:'signup_fallback'});
        showMsg('已向邮箱发送验证码，验证后即可进入；首次使用会保存当前密码。',false);
        return true;
    }
    if(isEmailRateLimitError(otpFallback)){
        clearPendingRegisterIntent();
        openVerifyStep(email,pwd,{verifyType:'signup',syncPassword:true});
        showMsg(getRateLimitMessage(otpFallback),false);
        return true;
    }
    if(isConfirmationSendError(getAuthErrorText(otpFallback))){
        showMsg('验证码邮件发送失败，请先确认 Supabase 的 SMTP 已配置完成。',true);
        return true;
    }
    if(isWeakPasswordError(otpFallback)){
        showMsg('密码强度不足，请改成至少 6 位，并尽量包含字母和数字。',true);
        return true;
    }
    var resendFallback=await sb.resendSignup(email);
    if(!resendFallback.error){
        clearPendingRegisterIntent();
        openVerifyStep(email,pwd,{verifyType:'signup',syncPassword:true});
        if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_otp_sent',{flow:'signup_resend_fallback'});
        showMsg('已重新发送验证码，请检查邮箱。',false);
        return true;
    }
    if(isEmailRateLimitError(resendFallback)){
        clearPendingRegisterIntent();
        openVerifyStep(email,pwd,{verifyType:'signup',syncPassword:true});
        showMsg(getRateLimitMessage(resendFallback),false);
        return true;
    }
    if(isConfirmationSendError(getAuthErrorText(resendFallback))){
        showMsg('验证码邮件发送失败，请先确认 Supabase 的 SMTP 已配置完成。',true);
        return true;
    }
    if(isWeakPasswordError(resendFallback)){
        showMsg('密码强度不足，请改成至少 6 位，并尽量包含字母和数字。',true);
        return true;
    }
    showMsg(getAuthErrorText(resendFallback)||getAuthErrorText(otpFallback)||getAuthErrorText(signUpRes)||'验证码发送暂时受限，请稍后重试或使用忘记密码。',true);
    return true;
}

function clearLocalBusinessData(){
    if(typeof store==='undefined')return;
    store.resetState();
}

function hasGuestBusinessData(data){
    if(!data)return false;
    return !!((data.apps&&data.apps.length)||(data.resumes&&data.resumes.length)||(data.prepare_sessions&&data.prepare_sessions.length)||(data.refs&&data.refs.length)||(data.logs&&data.logs.length));
}

function mergeUniqueRecords(primary,secondary){
    const map=new Map();
    (primary||[]).forEach(function(item){
        if(!item||!item.id)return;
        map.set(item.id,cloneData(item));
    });
    (secondary||[]).forEach(function(item){
        if(!item||!item.id)return;
        if(!map.has(item.id))map.set(item.id,cloneData(item));
    });
    return Array.from(map.values());
}

function mergeStringCollections(primary,secondary){
    const set=new Set();
    (primary||[]).forEach(function(item){
        const text=String(item||'').trim();
        if(text)set.add(text);
    });
    (secondary||[]).forEach(function(item){
        const text=String(item||'').trim();
        if(text)set.add(text);
    });
    return Array.from(set);
}

function mergeSettingsWithGuest(currentSettings,guestSettings){
    const current=Object.assign(getDefaultSettings(),currentSettings||{});
    const guest=Object.assign({},guestSettings||{});
    return {
        intlMode:typeof current.intlMode==='boolean'?current.intlMode:!!guest.intlMode,
        weeklyGoal:current.weeklyGoal||guest.weeklyGoal||getDefaultSettings().weeklyGoal,
        profileNickname:current.profileNickname||guest.profileNickname||'',
        profileAvatar:current.profileAvatar||guest.profileAvatar||'',
        themeMode:current.themeMode||guest.themeMode||getDefaultSettings().themeMode
    };
}

async function migrateGuestStateToAccount(session){
    if(!window.rtGuestStore||!window.rtAccountService||!session||!session.user)return false;
    const pending=typeof window.rtReadGuestMigrationPending==='function'?window.rtReadGuestMigrationPending():null;
    const guestData=window.rtGuestStore.load();
    if(!pending&&!hasGuestBusinessData(guestData))return false;
    if(!hasGuestBusinessData(guestData)){
        if(typeof window.rtClearGuestMigrationPending==='function')window.rtClearGuestMigrationPending();
        return false;
    }
    const guestId=(pending&&pending.guest_id)||(typeof window.rtGetGuestIdentityId==='function'&&window.rtGetGuestIdentityId())||'';
    try{
        await window.rtAccountService.ensureAccount({
            input_guest_id:guestId,
            input_email:session.user.email||'',
            input_source_channel:'guest_upgrade'
        });
        const mergedSnapshot={
            apps:mergeUniqueRecords(store.apps,guestData.apps),
            resumes:mergeUniqueRecords(store.resumes,guestData.resumes),
            prepareSessions:mergeUniqueRecords(store.prepareSessions,guestData.prepare_sessions),
            refs:mergeUniqueRecords(store.refs,guestData.refs),
            logs:mergeUniqueRecords(store.logs,guestData.logs),
            categories:mergeStringCollections(store.categories,guestData.categories),
            painPoints:mergeStringCollections(store.painPoints,guestData.pain_points),
            tableCols:normalizeTableColumns((store.tableCols||[]).concat(guestData.table_cols||[])),
            settings:mergeSettingsWithGuest(store.settings,guestData.settings)
        };
        store.restore(mergedSnapshot);
        const ok=await store.save('guest.migrateToAccount');
        if(ok===false)throw new Error('访客数据迁移保存失败');
        window.rtGuestStore.clear();
        if(typeof window.rtClearGuestMigrationPending==='function')window.rtClearGuestMigrationPending();
        if(typeof window.rtTrackEvent==='function')window.rtTrackEvent('rt_guest_data_migrated',{
            entry:'upgrade_to_registered',
            application_count:store.apps.length,
            resume_count:store.resumes.length,
            reflection_count:store.refs.length
        });
        return true;
    }catch(err){
        console.error('[RT auth] guest migration failed',err);
        return false;
    }
}

function onSuccess(result,meta){
    var guestWasActive=!!(window.rtGuestStore&&window.rtGuestStore.isEnabled&&window.rtGuestStore.isEnabled());
    if(guestWasActive&&typeof window.rtMarkGuestMigrationPending==='function')window.rtMarkGuestMigrationPending({reason:'signup_or_login'});
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

    try{
        var statusRes=await sb.getEmailStatus(email);
        if(statusRes&&statusRes.error){
            console.error('[RT auth] getEmailStatus failed',statusRes);
            showMsg('暂时无法确认账号状态，请稍后重试。',true);
            setSubmitIdleState();
            return;
        }

        if(!statusRes.is_registered){
            openRegisterChoiceModal(email,pwd);
            showMsg('这个邮箱还没有注册，请确认是否继续注册。',false);
            setSubmitIdleState();
            return;
        }

        var loginRes=await sb.signIn(email,pwd);
        if(loginRes.access_token){
            clearPendingRegisterIntent();
            clearPasswordFailureCount(email);
            onSuccess(loginRes,{flow:'password'});
            return;
        }

        var errMsg=getAuthErrorText(loginRes);
        if(isEmailNotConfirmedError(errMsg)){
            clearPendingRegisterIntent();
            clearPasswordFailureCount(email);
            await resendSignupCode(email,pwd,'这个邮箱还没有完成验证，已重新发送验证码。',{mode:'resend_only',verifyType:'signup',syncPassword:false});
            setSubmitIdleState();
            return;
        }

        if(isInvalidLoginError(errMsg)){
            var failCount=incrementPasswordFailureCount(email);
            showMsg(failCount>=2?'账号或密码不正确，请重试，或点击“忘记密码”重设。':'账号或密码不正确，请重试。',true);
            setSubmitIdleState();
            return;
        }

        if(isEmailRateLimitError(loginRes)){
            showMsg(getRateLimitMessage(loginRes,'请求过于频繁，请稍后重试。'),true);
            setSubmitIdleState();
            return;
        }

        if(isNetworkLikeError(loginRes)){
            showMsg('网络连接异常，请稍后重试。',true);
            setSubmitIdleState();
            return;
        }

        showMsg(errMsg||'暂时无法完成注册或登录，请稍后重试。',true);
        setSubmitIdleState();
    }catch(err){
        console.error('[RT auth] submit flow failed',err);
        showMsg('网络连接异常，请稍后重试。',true);
        setSubmitIdleState();
    }
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

['login-email','login-password'].forEach(function(id){
    var input=document.getElementById(id);
    if(input)input.addEventListener('input',function(){
        clearPendingRegisterIntent();
    });
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
        if(pendingOtpAuth.syncPassword&&pendingOtpAuth.password){
            var updateRes=await sb.updatePassword(verifyRes.access_token,pendingOtpAuth.password);
            if(updateRes&&updateRes.error&&!isSamePasswordNoopError(updateRes)){
                showMsg(getAuthErrorText(updateRes)||'密码保存失败，请重新获取验证码后再试。',true);
                verifyBtn.textContent='验证并进入';
                verifyBtn.disabled=false;
                return;
            }
            onSuccess(Object.assign({},verifyRes,{user:updateRes&&updateRes.user?updateRes.user:(verifyRes.user||null)}),{flow:'signup_otp',isNewUser:true});
            return;
        }
        onSuccess(verifyRes,{flow:'signup_otp',isNewUser:false});
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
    try{
        await resendSignupCode(email,pendingOtpAuth.password||document.getElementById('login-password').value,'验证码已重新发送，请检查邮箱。',{mode:'signup',verifyType:pendingOtpAuth.verifyType||'signup',syncPassword:pendingOtpAuth.syncPassword});
    }catch(err){
        console.error('[RT auth] resend signup failed',err);
        showMsg('网络连接异常，请稍后重试。',true);
    }
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

window.rtStartUpgradeRegistration=function(){
    if(window.rtGuestStore&&window.rtGuestStore.isEnabled&&window.rtGuestStore.isEnabled()){
        if(typeof window.rtMarkGuestMigrationPending==='function')window.rtMarkGuestMigrationPending({reason:'membership_upgrade'});
        window.rtGuestStore.disable();
    }
    updateAppShell(false);
    resetVerifyStep();
    hideForgotMsg();
    showMsg('注册后会自动继承刚才的体验数据，再继续开通会员。',false);
    var emailInput=document.getElementById('login-email');
    if(emailInput)emailInput.focus();
    window.scrollTo({top:0,behavior:'smooth'});
};

var forgotModalClose=document.getElementById('forgot-modal-close');
if(forgotModalClose)forgotModalClose.addEventListener('click',closeForgotModal);
var forgotCancel=document.getElementById('forgot-cancel');
if(forgotCancel)forgotCancel.addEventListener('click',closeForgotModal);

var registerChoiceClose=document.getElementById('register-choice-close');
if(registerChoiceClose)registerChoiceClose.addEventListener('click',function(){
    clearPendingRegisterIntent();
    hideMsg();
});

var registerChoiceCancel=document.getElementById('register-choice-cancel');
if(registerChoiceCancel)registerChoiceCancel.addEventListener('click',function(){
    clearPendingRegisterIntent();
    hideMsg();
});

var registerChoiceConfirm=document.getElementById('register-choice-confirm');
if(registerChoiceConfirm)registerChoiceConfirm.addEventListener('click',async function(){
    var email=pendingRegisterIntent.email||document.getElementById('login-email').value.trim();
    var pwd=pendingRegisterIntent.password||document.getElementById('login-password').value;
    if(!email||!email.includes('@')){
        clearPendingRegisterIntent();
        showMsg('请输入有效邮箱。',true);
        return;
    }
    if(!pwd||pwd.length<6){
        clearPendingRegisterIntent();
        showMsg('密码至少 6 位。',true);
        return;
    }
    registerChoiceConfirm.disabled=true;
    registerChoiceConfirm.textContent='注册中...';
    try{
        await continueSignupFlow(email,pwd);
    }catch(err){
        console.error('[RT auth] continue register failed',err);
        showMsg('网络连接异常，请稍后重试。',true);
    }
    registerChoiceConfirm.disabled=false;
    registerChoiceConfirm.textContent='继续注册';
    setSubmitIdleState();
});

var forgotSendCodeBtn=document.getElementById('forgot-send-code');
if(forgotSendCodeBtn)forgotSendCodeBtn.addEventListener('click',async function(){
    var email=(document.getElementById('forgot-email').value||'').trim();
    if(!email||!email.includes('@')){
        showForgotMsg('请输入有效的注册邮箱。',true);
        return;
    }
    forgotSendCodeBtn.textContent='发送中...';
    forgotSendCodeBtn.disabled=true;
    try{
        var otpRes=await sb.sendEmailOtp(email,false);
        if(otpRes&&otpRes.error){
            if(isEmailRateLimitError(otpRes)){
                showForgotMsg(getRateLimitMessage(otpRes),false);
            }else{
                showForgotMsg(getAuthErrorText(otpRes)||'验证码发送失败，请稍后重试。',true);
            }
        }else{
            if(typeof window.rtTrackEvent==='function'){
                window.rtTrackEvent('rt_password_reset_started',{entry:'forgot_modal'});
                window.rtTrackEvent('rt_otp_sent',{flow:'password_reset'});
            }
            showForgotMsg('验证码已发送，请查收邮箱。',false);
        }
    }catch(err){
        console.error('[RT auth] forgot send code failed',err);
        showForgotMsg('网络连接异常，请稍后重试。',true);
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
    try{
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
    }catch(err){
        console.error('[RT auth] forgot confirm failed',err);
        showForgotMsg('网络连接异常，请稍后重试。',true);
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

function getProfileAccountSnapshot(){
    if(window.rtAccountService&&typeof window.rtAccountService.getCachedAccount==='function'){
        return window.rtAccountService.getCachedAccount();
    }
    if(typeof window.rtReadCachedAccount==='function'){
        return window.rtReadCachedAccount();
    }
    return null;
}

function getProfileMembershipLabel(account){
    if(typeof window.rtGetAccountMembershipLabel==='function')return window.rtGetAccountMembershipLabel(account);
    if(!account)return'试用中';
    if(account.is_admin)return'管理员';
    if(account.is_lifetime||account.membership_tier==='lifetime')return'永久会员';
    if(account.membership_tier==='monthly')return'月会员';
    return'试用中';
}

function getProfileEntitlementText(account){
    if(typeof window.rtGetAccountEntitlementText==='function')return window.rtGetAccountEntitlementText(account);
    if(!account)return'当前账号信息还没同步完成。';
    return '账号权益已同步，可继续在准备页查看和使用。';
}

async function openProfileModal(){
    var isGuest=window.rtGuestStore&&window.rtGuestStore.isEnabled()&&!rtSession;
    if(!rtSession&&!isGuest)return;
    var account=getProfileAccountSnapshot();
    if(!account&&window.rtAccountService&&typeof window.rtAccountService.ensureAccount==='function'){
        try{
            account=await window.rtAccountService.ensureAccount();
        }catch(err){}
    }
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
    var membershipChipEl=document.getElementById('profile-membership-chip');
    if(membershipChipEl)membershipChipEl.textContent=getProfileMembershipLabel(account);
    var syncDescEl=document.getElementById('profile-sync-desc');
    if(syncDescEl)syncDescEl.textContent=isGuest?'昵称、偏好和标签会保存在当前设备，登录后才可同步到云端。':'昵称、偏好和标签都会跟随账号一起同步。';
    var emailEl=document.getElementById('profile-email-display');
    if(emailEl)emailEl.textContent=isGuest?'未登录，数据仅保存在本机':(u.email||'—');
    var accountIdEl=document.getElementById('profile-account-id-display');
    if(accountIdEl)accountIdEl.textContent=account&&account.id||'暂未生成';
    var entitlementEl=document.getElementById('profile-membership-detail');
    if(entitlementEl)entitlementEl.textContent=getProfileEntitlementText(account);
    var entitlementTitleEl=document.getElementById('profile-entitlement-title');
    if(entitlementTitleEl)entitlementTitleEl.textContent='当前账号权益：'+getProfileMembershipLabel(account);
    var entitlementDescEl=document.getElementById('profile-entitlement-desc');
    if(entitlementDescEl)entitlementDescEl.textContent=getProfileEntitlementText(account);
    var registerUpgradeBtn=document.getElementById('profile-register-upgrade');
    if(registerUpgradeBtn)registerUpgradeBtn.style.display=isGuest?'inline-flex':'none';
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

var profileAccountCopy=document.getElementById('profile-account-id-copy');
if(profileAccountCopy)profileAccountCopy.addEventListener('click',async function(){
    var value=document.getElementById('profile-account-id-display')&&document.getElementById('profile-account-id-display').textContent||'';
    if(!value||value==='暂未生成')return;
    try{
        await navigator.clipboard.writeText(value);
        this.textContent='已复制';
        setTimeout(()=>{this.textContent='复制';},1200);
    }catch(err){
        this.textContent='复制失败';
        setTimeout(()=>{this.textContent='复制';},1200);
    }
});

var profileUpgradeBtn=document.getElementById('profile-upgrade-btn');
if(profileUpgradeBtn)profileUpgradeBtn.addEventListener('click',function(){
    document.getElementById('profile-modal-overlay').classList.remove('active');
    if(typeof window.rtOpenPrepareUpgradeModal==='function'){
        window.rtOpenPrepareUpgradeModal({account:getProfileAccountSnapshot()});
    }
});

var profileRegisterUpgrade=document.getElementById('profile-register-upgrade');
if(profileRegisterUpgrade)profileRegisterUpgrade.addEventListener('click',function(){
    document.getElementById('profile-modal-overlay').classList.remove('active');
    if(typeof window.rtStartUpgradeRegistration==='function')window.rtStartUpgradeRegistration();
});

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
