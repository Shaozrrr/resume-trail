// 认证 - 登录直接进，注册需邮箱验证码（云端优先）
var rtSession=JSON.parse(localStorage.getItem('rt_session')||'null');
var pendingEmail='',pendingPwd='';

function checkAuth(){
    if(rtSession&&rtSession.access_token){
        document.getElementById('login-page').style.display='none';
        document.getElementById('app').style.display='flex';
        updateAvatar();
        // 强制从云端加载当前账号数据
        cloudStore.loadInto(store).then(function(){
            if(typeof initFilters==='function')initFilters();
            if(typeof switchView==='function')switchView('pipeline');
        }).catch(function(err){
            console.error(err);
            toast('云端数据加载失败，请刷新重试','error');
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

function clearLocalBusinessData(){
    if(typeof store==='undefined')return;
    store.apps=[];
    store.resumes=[];
    store.refs=[];
    store.logs=[];
    store.categories=[];
    store.painPoints=(typeof DEFAULT_PP!=='undefined'?[...DEFAULT_PP]:[]);
    store.settings={intlMode:false};
    store.tableCols=(typeof DEFAULT_COLS!=='undefined'?[...DEFAULT_COLS]:[]);
}

// 登录成功：清空旧数据，保存 session，刷新后拉云端
function onSuccess(result){
    clearLocalBusinessData();
    localStorage.setItem('rt_session',JSON.stringify(result));
    rtSession=result;
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

    var errMsg=loginRes.error_description||loginRes.msg||'';
    if(errMsg.indexOf('Invalid login')>=0||errMsg.indexOf('invalid')>=0){
        // 尝试走注册验证码流程
        pendingEmail=email;pendingPwd=pwd;
        var otpRes=await sb.signInOTP(email);
        if(otpRes.error){
            showMsg('发送验证码失败：'+(otpRes.error.message||''),true);
            submitBtn.textContent='开始使用';submitBtn.disabled=false;
            return;
        }
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
    if(!code||code.length<4){showMsg('请输入验证码',true);return;}
    hideMsg();
    verifyBtn.textContent='验证中...';verifyBtn.disabled=true;

    var verifyRes=await sb.verifyOTP(pendingEmail,code);
    if(verifyRes.access_token){
        // 设置密码
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

// 返回
var backBtn=document.getElementById('verify-back');
if(backBtn)backBtn.addEventListener('click',function(){
    document.getElementById('login-step1').style.display='';
    document.getElementById('login-step2').style.display='none';
    document.getElementById('login-hint').style.display='';
    hideMsg();
});

var codeInput=document.getElementById('verify-code');
if(codeInput)codeInput.addEventListener('keydown',function(e){if(e.key==='Enter'&&verifyBtn)verifyBtn.click();});
var pwdInput=document.getElementById('login-password');
if(pwdInput)pwdInput.addEventListener('keydown',function(e){if(e.key==='Enter'&&submitBtn)submitBtn.click();});

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
if(profileSave)profileSave.addEventListener('click',async function(){
    localStorage.setItem('rt_nickname',document.getElementById('profile-nickname').value.trim());
    document.getElementById('profile-modal-overlay').classList.remove('active');
    updateAvatar();toast('已保存','success');
});

var profileLogout=document.getElementById('profile-logout');
if(profileLogout)profileLogout.addEventListener('click',async function(){
    if(!confirm('确定退出登录？'))return;
    if(rtSession)await sb.signOut(rtSession.access_token);
    localStorage.removeItem('rt_session');
    clearLocalBusinessData();
    location.reload();
});

var profileClose=document.getElementById('profile-modal-close');
if(profileClose)profileClose.addEventListener('click',function(){
    document.getElementById('profile-modal-overlay').classList.remove('active');
});

checkAuth();