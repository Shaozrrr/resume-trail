// 认证系统 - 邮箱验证码 + 邮箱密码
var rtSession=JSON.parse(localStorage.getItem('rt_session')||'null');

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
function showMsg(id,text,isErr){
    var el=document.getElementById(id);
    if(el){el.style.display='block';el.style.color=isErr?'var(--red)':'var(--green)';el.textContent=text;}
}
function doLogin(result){
    if(result.access_token){
        rtSession=result;localStorage.setItem('rt_session',JSON.stringify(result));
        toast('登录成功！','success');setTimeout(function(){location.reload();},800);
        return true;
    }
    return false;
}

// Tab 切换
document.querySelectorAll('.login-tab').forEach(function(t){
    t.addEventListener('click',function(){
        document.querySelectorAll('.login-tab').forEach(function(x){x.classList.remove('active');});
        t.classList.add('active');
        document.querySelectorAll('.login-form').forEach(function(f){f.style.display='none';});
        var form=document.getElementById('login-'+t.dataset.method+'-form');
        if(form)form.style.display='';
    });
});

// ---- 验证码登录 ----
var otpTimer=0;
var sendOtpBtn=document.getElementById('send-otp-btn');
if(sendOtpBtn)sendOtpBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email-code').value.trim();
    if(!email||!email.includes('@')){showMsg('login-msg-code','请输入有效邮箱',true);return;}
    if(otpTimer>0)return;
    sendOtpBtn.disabled=true;sendOtpBtn.textContent='发送中...';
    var result=await sb.signInOTP(email);
    if(result.error){
        showMsg('login-msg-code',result.error.message||'发送失败',true);
        sendOtpBtn.disabled=false;sendOtpBtn.textContent='发送验证码';
        return;
    }
    showMsg('login-msg-code','验证码已发送到邮箱',false);
    otpTimer=60;
    var iv=setInterval(function(){
        otpTimer--;
        sendOtpBtn.textContent=otpTimer>0?otpTimer+'s':'发送验证码';
        if(otpTimer<=0){clearInterval(iv);sendOtpBtn.disabled=false;}
    },1000);
});

var loginOtpBtn=document.getElementById('login-otp-btn');
if(loginOtpBtn)loginOtpBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email-code').value.trim();
    var code=document.getElementById('login-otp').value.trim();
    if(!email){showMsg('login-msg-code','请输入邮箱',true);return;}
    if(!code||code.length<6){showMsg('login-msg-code','请输入6位验证码',true);return;}
    loginOtpBtn.textContent='验证中...';loginOtpBtn.disabled=true;
    var result=await sb.verifyOTP(email,code);
    if(!doLogin(result)){
        showMsg('login-msg-code',result.error_description||result.msg||'验证码错误',true);
        loginOtpBtn.textContent='登录';loginOtpBtn.disabled=false;
    }
});

// ---- 密码登录 ----
var loginPwdBtn=document.getElementById('login-pwd-btn');
if(loginPwdBtn)loginPwdBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email-pwd').value.trim();
    var pwd=document.getElementById('login-password').value;
    if(!email||!email.includes('@')){showMsg('login-msg-pwd','请输入有效邮箱',true);return;}
    if(!pwd||pwd.length<6){showMsg('login-msg-pwd','密码至少6位',true);return;}
    loginPwdBtn.textContent='登录中...';loginPwdBtn.disabled=true;
    var result=await sb.signIn(email,pwd);
    if(!doLogin(result)){
        showMsg('login-msg-pwd',result.error_description||result.msg||'邮箱或密码错误',true);
        loginPwdBtn.textContent='登录';loginPwdBtn.disabled=false;
    }
});

// 注册
var regBtn=document.getElementById('register-btn');
if(regBtn)regBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email-pwd').value.trim();
    var pwd=document.getElementById('login-password').value;
    if(!email||!email.includes('@')){showMsg('login-msg-pwd','请输入有效邮箱',true);return;}
    if(!pwd||pwd.length<6){showMsg('login-msg-pwd','密码至少6位',true);return;}
    regBtn.textContent='注册中...';regBtn.disabled=true;
    var result=await sb.signUp(email,pwd);
    if(result.access_token){
        doLogin(result);
    }else if(result.user&&!result.session){
        showMsg('login-msg-pwd','注册成功！请查看邮箱确认后登录',false);
        regBtn.textContent='没有账号？注册';regBtn.disabled=false;
    }else{
        showMsg('login-msg-pwd',result.error_description||result.msg||'注册失败',true);
        regBtn.textContent='没有账号？注册';regBtn.disabled=false;
    }
});

// Enter 键
var pwdInp=document.getElementById('login-password');
if(pwdInp)pwdInp.addEventListener('keydown',function(e){if(e.key==='Enter'&&loginPwdBtn)loginPwdBtn.click();});
var otpInp=document.getElementById('login-otp');
if(otpInp)otpInp.addEventListener('keydown',function(e){if(e.key==='Enter'&&loginOtpBtn)loginOtpBtn.click();});

// 用户资料
var profileBtn=document.getElementById('profile-btn');
if(profileBtn)profileBtn.addEventListener('click',function(){
    if(!rtSession)return;
    var u=rtSession.user||{};
    document.getElementById('profile-nickname').value=localStorage.getItem('rt_nickname')||u.email&&u.email.split('@')[0]||'';
    document.getElementById('profile-email').value=u.email||'';
    document.getElementById('profile-phone').value='';
    document.getElementById('profile-nickname-display').textContent=localStorage.getItem('rt_nickname')||u.email&&u.email.split('@')[0]||'用户';
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