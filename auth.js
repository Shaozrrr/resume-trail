// 认证 - 自动判断登录/注册
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

function showLoginMsg(text,isErr){
    var el=document.getElementById('login-msg');
    if(el){el.style.display='block';el.style.color=isErr?'var(--red)':'var(--green)';el.textContent=text;}
}

function onLoginSuccess(result){
    rtSession=result;
    localStorage.setItem('rt_session',JSON.stringify(result));
    showLoginMsg('欢迎回来！正在进入...',false);
    setTimeout(function(){location.reload();},600);
}

// 一键登录/注册
var submitBtn=document.getElementById('login-submit');
if(submitBtn)submitBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email').value.trim();
    var pwd=document.getElementById('login-password').value;
    if(!email||!email.includes('@')){showLoginMsg('请输入有效的邮箱地址',true);return;}
    if(!pwd||pwd.length<6){showLoginMsg('密码至少需要6个字符',true);return;}

    submitBtn.textContent='请稍候...';
    submitBtn.disabled=true;

    // 先尝试登录
    var loginResult=await sb.signIn(email,pwd);
    if(loginResult.access_token){
        onLoginSuccess(loginResult);
        return;
    }

    // 登录失败，尝试注册
    if(loginResult.error_description&&loginResult.error_description.indexOf('Invalid')>=0){
        // 密码错误（账号存在）
        showLoginMsg('密码错误，请重试',true);
        submitBtn.textContent='开始使用';submitBtn.disabled=false;
        return;
    }

    // 尝试注册新账号
    var signupResult=await sb.signUp(email,pwd);
    if(signupResult.access_token){
        // 注册成功且自动登录
        onLoginSuccess(signupResult);
        return;
    }
    if(signupResult.user&&!signupResult.session){
        // 需要邮箱确认（如果 Supabase 开启了确认）
        showLoginMsg('注册成功！请查看邮箱中的确认链接，确认后回来登录',false);
        submitBtn.textContent='开始使用';submitBtn.disabled=false;
        return;
    }
    if(signupResult.msg&&signupResult.msg.indexOf('already')>=0){
        // 用户已存在但密码错误
        showLoginMsg('该邮箱已注册，请输入正确密码',true);
        submitBtn.textContent='开始使用';submitBtn.disabled=false;
        return;
    }

    // 其他错误
    showLoginMsg(signupResult.error_description||signupResult.msg||'操作失败，请重试',true);
    submitBtn.textContent='开始使用';submitBtn.disabled=false;
});

// Enter 键提交
var pwdInput=document.getElementById('login-password');
if(pwdInput)pwdInput.addEventListener('keydown',function(e){if(e.key==='Enter'&&submitBtn)submitBtn.click();});
var emailInput=document.getElementById('login-email');
if(emailInput)emailInput.addEventListener('keydown',function(e){if(e.key==='Enter'){if(pwdInput)pwdInput.focus();}});

// 用户资料
var profileBtn=document.getElementById('profile-btn');
if(profileBtn)profileBtn.addEventListener('click',function(){
    if(!rtSession)return;
    var u=rtSession.user||{};
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
if(profileClose)profileClose.addEventListener('click',function(){
    document.getElementById('profile-modal-overlay').classList.remove('active');
});

checkAuth();