// 认证 - 登录直接进，注册需邮箱验证码（云端优先）
var rtSession=sb.getSession();
var pendingEmail='',pendingPwd='';

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
    updateAppShell(false);
    return false;
}

function updateAvatar(){
    if(!rtSession)return;
    var av=document.getElementById('sidebar-avatar');
    if(av){
        var email=rtSession.user&&rtSession.user.email||'';
        av.textContent=email?email[0].toUpperCase():'👤';
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
    clearLocalBusinessData();
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
    if(errMsg.indexOf('Invalid login')>=0||errMsg.indexOf('invalid')>=0){
        pendingEmail=email;
        pendingPwd=pwd;
        var otpRes=await sb.signInOTP(email);
        if(otpRes.error){
            showMsg('发送验证码失败：'+(otpRes.error.message||otpRes.error||''),true);
            submitBtn.textContent='开始使用';
            submitBtn.disabled=false;
            return;
        }
        document.getElementById('login-step1').style.display='none';
        document.getElementById('login-step2').style.display='';
        document.getElementById('login-hint').style.display='none';
        document.getElementById('verify-email-display').textContent=email;
        showMsg('验证码已发送到你的邮箱',false);
        submitBtn.textContent='开始使用';
        submitBtn.disabled=false;
        document.getElementById('verify-code').focus();
        return;
    }

    showMsg(errMsg||'登录失败',true);
    submitBtn.textContent='开始使用';
    submitBtn.disabled=false;
});

var verifyBtn=document.getElementById('verify-submit');
if(verifyBtn)verifyBtn.addEventListener('click',async function(){
    var code=document.getElementById('verify-code').value.trim();
    if(!code||code.length<4){showMsg('请输入验证码',true);return;}
    hideMsg();
    verifyBtn.textContent='验证中...';
    verifyBtn.disabled=true;

    var verifyRes=await sb.verifyOTP(pendingEmail,code);
    if(verifyRes.access_token){
        var token=verifyRes.access_token;
        await fetch(SUPABASE_URL+'/auth/v1/user',{
            method:'PUT',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+token},
            body:JSON.stringify({password:pendingPwd})
        });
        onSuccess(verifyRes);
        return;
    }

    showMsg(verifyRes.error_description||verifyRes.msg||verifyRes.error||'验证码错误',true);
    verifyBtn.textContent='验证并注册';
    verifyBtn.disabled=false;
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
    if(!rtSession)return;
    var u=rtSession.user||{};
    var nick=localStorage.getItem('rt_nickname')||u.email&&u.email.split('@')[0]||'';
    document.getElementById('profile-nickname').value=nick;
    document.getElementById('profile-nickname-display').textContent=nick||'用户';
    document.getElementById('profile-avatar-display').textContent=u.email?(u.email[0].toUpperCase()):'👤';
    document.getElementById('profile-login-method').textContent=u.email||'';
    var emailEl=document.getElementById('profile-email-display');
    if(emailEl)emailEl.textContent=u.email||'—';
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
    localStorage.setItem('rt_nickname',nickname);
    document.getElementById('profile-nickname-display').textContent=nickname||'用户';
    document.getElementById('profile-modal-overlay').classList.remove('active');
    updateAvatar();
    toast('已保存','success');
});

var profileLogout=document.getElementById('profile-logout');
if(profileLogout)profileLogout.addEventListener('click',async function(){
    if(!confirm('确定退出登录？'))return;
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
