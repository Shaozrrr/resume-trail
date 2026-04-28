// 认证 - 登录直接进，注册需验证邮箱
var rtSession=JSON.parse(localStorage.getItem('rt_session')||'null');
var pendingEmail='',pendingPwd='';

function checkAuth(){
    if(rtSession&&rtSession.access_token){
        document.getElementById('login-page').style.display='none';
        document.getElementById('app').style.display='flex';
        updateAvatar();
        sb.syncFromCloud().then(function(synced){
            if(synced&&typeof initFilters==='function'){initFilters();if(typeof switchView==='function')switchView('pipeline');}
        });
        return true;
    }
    document.getElementById('login-page').style.display='flex';
    document.getElementById('app').style.display='none';
    return false;
}

function updateAvatar(){
    if(!rtSession)return;
    var av=document.getElementById('sidebar-avatar');
    if(av){var e=rtSession.user&&rtSession.user.email||'';av.textContent=e?e[0].toUpperCase():'👤';}
}

function showMsg(text,isErr){
    var el=document.getElementById('login-msg');
    if(el){el.style.display='block';el.style.color=isErr?'var(--red)':'var(--green)';el.textContent=text;}
}

function hideMsg(){var el=document.getElementById('login-msg');if(el)el.style.display='none';}

function onSuccess(result){
    // 清除上一个用户的本地数据
    var keysToKeep=['rt_session','rt_nickname'];
    var allKeys=Object.keys(localStorage);
    allKeys.forEach(function(k){if(k.startsWith('rt_')&&keysToKeep.indexOf(k)<0)localStorage.removeItem(k);});
    // 保存新 session
    rtSession=result;localStorage.setItem('rt_session',JSON.stringify(result));
    showMsg('欢迎！正在进入...',false);
    setTimeout(function(){location.reload();},600);
}

// 步骤1：输入邮箱密码
var submitBtn=document.getElementById('login-submit');
if(submitBtn)submitBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email').value.trim();
    var pwd=document.getElementById('login-password').value;
    if(!email||!email.includes('@')){showMsg('请输入有效邮箱',true);return;}
    if(!pwd||pwd.length<6){showMsg('密码至少6位',true);return;}
    hideMsg();
    submitBtn.textContent='请稍候...';submitBtn.disabled=true;

    // 先尝试登录（老用户）
    var loginRes=await sb.signIn(email,pwd);
    if(loginRes.access_token){
        onSuccess(loginRes);
        return;
    }

    // 登录失败，判断原因
    var errMsg=loginRes.error_description||loginRes.msg||'';
    if(errMsg.indexOf('Invalid login')>=0||errMsg.indexOf('invalid')>=0){
        // 可能是密码错误或用户不存在
        // 尝试注册 → 发送验证码
        pendingEmail=email;pendingPwd=pwd;

        // 先用 OTP 发送验证码
        var otpRes=await sb.signInOTP(email);
        if(otpRes.error){
            showMsg('发送验证码失败：'+(otpRes.error.message||''),true);
            submitBtn.textContent='开始使用';submitBtn.disabled=false;
            return;
        }

        // 切换到验证码输入界面
        document.getElementById('login-step1').style.display='none';
        document.getElementById('login-step2').style.display='';
        document.getElementById('login-hint').style.display='none';
        document.getElementById('verify-email-display').textContent=email;
        showMsg('验证码已发送到你的邮箱',false);
        submitBtn.textContent='开始使用';submitBtn.disabled=false;
        document.getElementById('verify-code').focus();
        return;
    }

    showMsg(errMsg||'登录失败',true);
    submitBtn.textContent='开始使用';submitBtn.disabled=false;
});

// 步骤2：验证码确认
var verifyBtn=document.getElementById('verify-submit');
if(verifyBtn)verifyBtn.addEventListener('click',async function(){
    var code=document.getElementById('verify-code').value.trim();
    if(!code||code.length<4){showMsg('请输入6位验证码',true);return;}
    hideMsg();
    verifyBtn.textContent='验证中...';verifyBtn.disabled=true;

    // 验证 OTP
    var verifyRes=await sb.verifyOTP(pendingEmail,code);
    if(verifyRes.access_token){
        // OTP 验证成功，用户已创建
        // 现在设置密码（更新用户密码）
        var token=verifyRes.access_token;
        await fetch(SUPABASE_URL+'/auth/v1/user',{
            method:'PUT',
            headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+token},
            body:JSON.stringify({password:pendingPwd})
        });
        onSuccess(verifyRes);
        return;
    }

    showMsg(verifyRes.error_description||verifyRes.msg||'验证码错误',true);
    verifyBtn.textContent='验证并注册';verifyBtn.disabled=false;
});

// 返回按钮
var backBtn=document.getElementById('verify-back');
if(backBtn)backBtn.addEventListener('click',function(){
    document.getElementById('login-step1').style.display='';
    document.getElementById('login-step2').style.display='none';
    document.getElementById('login-hint').style.display='';
    hideMsg();
});

// Enter 键
var codeInput=document.getElementById('verify-code');
if(codeInput)codeInput.addEventListener('keydown',function(e){if(e.key==='Enter'&&verifyBtn)verifyBtn.click();});
var pwdInput=document.getElementById('login-password');
if(pwdInput)pwdInput.addEventListener('keydown',function(e){if(e.key==='Enter'&&submitBtn)submitBtn.click();});
var emailInput=document.getElementById('login-email');
if(emailInput)emailInput.addEventListener('keydown',function(e){if(e.key==='Enter'){if(pwdInput)pwdInput.focus();}});

// 用户资料
var profileBtn=document.getElementById('profile-btn');
if(profileBtn)profileBtn.addEventListener('click',function(){
    if(!rtSession)return;var u=rtSession.user||{};
    var nick=localStorage.getItem('rt_nickname')||u.email&&u.email.split('@')[0]||'';
    document.getElementById('profile-nickname').value=nick;
    document.getElementById('profile-email').value=u.email||'';
    document.getElementById('profile-phone').value='';
    document.getElementById('profile-nickname-display').textContent=nick||'用户';
    document.getElementById('profile-avatar-display').textContent=u.email?(u.email[0].toUpperCase()):'👤';
    document.getElementById('profile-login-method').textContent=u.email||'';
    document.getElementById('profile-modal-overlay').classList.add('active');
});
var profileSave=document.getElementById('profile-save');
if(profileSave)profileSave.addEventListener('click',function(){
    localStorage.setItem('rt_nickname',document.getElementById('profile-nickname').value.trim());
    document.getElementById('profile-modal-overlay').classList.remove('active');
    updateAvatar();toast('已保存','success');
});
var profileLogout=document.getElementById('profile-logout');
if(profileLogout)profileLogout.addEventListener('click',async function(){
    if(!confirm('确定退出登录？'))return;
    if(rtSession)await sb.signOut(rtSession.access_token);
    localStorage.removeItem('rt_session');location.reload();
});
var profileClose=document.getElementById('profile-modal-close');
if(profileClose)profileClose.addEventListener('click',function(){document.getElementById('profile-modal-overlay').classList.remove('active');});

checkAuth();