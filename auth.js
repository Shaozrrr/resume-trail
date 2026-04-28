// 真实认证系统（Supabase Auth）
var rtSession=JSON.parse(localStorage.getItem('rt_session')||'null');

function checkAuth(){
    if(rtSession&&rtSession.access_token){
        document.getElementById('login-page').style.display='none';
        document.getElementById('app').style.display='flex';
        updateAvatar();
        // 从云端同步数据
        sb.syncFromCloud().then(function(synced){
            if(synced&&typeof initFilters==='function'){initFilters();if(typeof switchView==='function')switchView('pipeline');}
        });
        return true;
    }else{
        document.getElementById('login-page').style.display='flex';
        document.getElementById('app').style.display='none';
        return false;
    }
}

function updateAvatar(){
    if(!rtSession)return;
    var av=document.getElementById('sidebar-avatar');
    if(av){
        var email=rtSession.user?.email||'';
        av.textContent=email?email[0].toUpperCase():'👤';
    }
}

// 登录 Tab 切换
document.querySelectorAll('.login-tab').forEach(function(t){
    t.addEventListener('click',function(){
        document.querySelectorAll('.login-tab').forEach(function(x){x.classList.remove('active');});
        t.classList.add('active');
        document.querySelectorAll('.login-form').forEach(function(f){f.style.display='none';});
        var form=document.getElementById('login-'+t.dataset.method+'-form');
        if(form)form.style.display='';
    });
});

// 邮箱登录（Supabase 原生支持）
var loginEmailBtn=document.getElementById('login-email-btn');
if(loginEmailBtn)loginEmailBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email').value.trim();
    var code=document.getElementById('login-email-code').value.trim();
    if(!email||!email.includes('@')){toast('请输入有效邮箱','error');return;}
    if(!code){toast('请输入验证码','error');return;}
    // 验证 OTP
    var result=await sb.verifyOTP(email,code);
    if(result.access_token){
        rtSession=result;
        localStorage.setItem('rt_session',JSON.stringify(result));
        toast('登录成功！','success');
        setTimeout(function(){location.reload();},500);
    }else{
        toast(result.error_description||result.msg||'验证码错误','error');
    }
});

// 发送邮箱验证码
var sendEmailBtn=document.getElementById('send-email-code');
var emailTimer=0;
if(sendEmailBtn)sendEmailBtn.addEventListener('click',async function(){
    var email=document.getElementById('login-email').value.trim();
    if(!email||!email.includes('@')){toast('请输入有效邮箱','error');return;}
    if(emailTimer>0)return;
    var result=await sb.signInOTP(email);
    if(result.error){toast(result.error.message||'发送失败','error');return;}
    toast('验证码已发送到邮箱','success');
    emailTimer=60;
    var btn=sendEmailBtn;
    var iv=setInterval(function(){emailTimer--;btn.textContent=emailTimer>0?emailTimer+'s':'发送验证码';if(emailTimer<=0)clearInterval(iv);},1000);
});

// 手机号登录（用邮箱模拟，因为 Supabase 免费版不支持短信）
var loginPhoneBtn=document.getElementById('login-phone-btn');
if(loginPhoneBtn)loginPhoneBtn.addEventListener('click',async function(){
    var phone=document.getElementById('login-phone').value.trim();
    var code=document.getElementById('login-phone-code').value.trim();
    if(!phone||phone.length!==11){toast('请输入11位手机号','error');return;}
    // 用手机号构造邮箱进行登录
    var fakeEmail=phone+'@phone.resumetrail.site';
    if(!code){toast('请输入验证码','error');return;}
    var result=await sb.verifyOTP(fakeEmail,code);
    if(result.access_token){
        rtSession=result;localStorage.setItem('rt_session',JSON.stringify(result));
        toast('登录成功！','success');setTimeout(function(){location.reload();},500);
    }else{toast(result.error_description||'验证码错误','error');}
});

var sendPhoneBtn=document.getElementById('send-phone-code');
var phoneTimer=0;
if(sendPhoneBtn)sendPhoneBtn.addEventListener('click',async function(){
    var phone=document.getElementById('login-phone').value.trim();
    if(!phone||phone.length!==11){toast('请输入11位手机号','error');return;}
    if(phoneTimer>0)return;
    var fakeEmail=phone+'@phone.resumetrail.site';
    var result=await sb.signInOTP(fakeEmail);
    if(result.error){toast(result.error.message||'发送失败','error');return;}
    toast('验证码已发送（请查看邮箱 '+fakeEmail+'）','success');
    phoneTimer=60;var btn=sendPhoneBtn;
    var iv=setInterval(function(){phoneTimer--;btn.textContent=phoneTimer>0?phoneTimer+'s':'发送验证码';if(phoneTimer<=0)clearInterval(iv);},1000);
});

// 微信登录（暂用邮箱密码模拟）
var loginWechatBtn=document.getElementById('login-wechat-btn');
if(loginWechatBtn)loginWechatBtn.addEventListener('click',async function(){
    var email=prompt('请输入邮箱（微信登录需要企业认证，暂用邮箱登录）：');
    if(!email)return;
    var pwd=prompt('请输入密码（首次使用会自动注册）：');
    if(!pwd)return;
    // 先尝试登录
    var result=await sb.signIn(email,pwd);
    if(result.access_token){
        rtSession=result;localStorage.setItem('rt_session',JSON.stringify(result));
        toast('登录成功！','success');setTimeout(function(){location.reload();},500);
    }else{
        // 尝试注册
        var signupResult=await sb.signUp(email,pwd);
        if(signupResult.access_token){
            rtSession=signupResult;localStorage.setItem('rt_session',JSON.stringify(signupResult));
            toast('注册成功！','success');setTimeout(function(){location.reload();},500);
        }else if(signupResult.user){
            toast('注册成功！请查看邮箱确认后登录','success');
        }else{
            toast(signupResult.error_description||signupResult.msg||'登录失败','error');
        }
    }
});

// 用户资料
var profileBtn=document.getElementById('profile-btn');
if(profileBtn)profileBtn.addEventListener('click',function(){
    if(!rtSession)return;
    var u=rtSession.user||{};
    document.getElementById('profile-nickname').value=localStorage.getItem('rt_nickname')||u.email?.split('@')[0]||'';
    document.getElementById('profile-email').value=u.email||'';
    document.getElementById('profile-phone').value='';
    document.getElementById('profile-nickname-display').textContent=localStorage.getItem('rt_nickname')||u.email?.split('@')[0]||'用户';
    document.getElementById('profile-avatar-display').textContent=(u.email||'?')[0].toUpperCase();
    document.getElementById('profile-login-method').textContent='邮箱: '+u.email;
    document.getElementById('profile-modal-overlay').classList.add('active');
});

var profileSave=document.getElementById('profile-save');
if(profileSave)profileSave.addEventListener('click',function(){
    var nick=document.getElementById('profile-nickname').value.trim();
    localStorage.setItem('rt_nickname',nick);
    document.getElementById('profile-modal-overlay').classList.remove('active');
    updateAvatar();toast('已保存','success');
});

var profileLogout=document.getElementById('profile-logout');
if(profileLogout)profileLogout.addEventListener('click',async function(){
    if(!confirm('确定退出登录？'))return;
    if(rtSession)await sb.signOut(rtSession.access_token);
    localStorage.removeItem('rt_session');
    location.reload();
});

var profileClose=document.getElementById('profile-modal-close');
if(profileClose)profileClose.addEventListener('click',function(){
    document.getElementById('profile-modal-overlay').classList.remove('active');
});

// 头像点击切换
var avatarDisplay=document.getElementById('profile-avatar-display');
if(avatarDisplay)avatarDisplay.addEventListener('click',function(){
    var emojis=['👤','😊','🎯','💼','🚀','🎓','💡','🌟','🦊','🐱'];
    var cur=emojis.indexOf(this.textContent);
    this.textContent=emojis[(cur+1)%emojis.length];
    var av=document.getElementById('sidebar-avatar');
    if(av)av.textContent=this.textContent;
});

// 启动
checkAuth();