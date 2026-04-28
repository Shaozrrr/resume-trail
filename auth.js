// 登录系统
const user=JSON.parse(localStorage.getItem('rt_user')||'null');
function checkAuth(){
    if(user){$('#login-page').style.display='none';$('#app').style.display='flex';updateSidebarAvatar();return true;}
    else{$('#login-page').style.display='flex';$('#app').style.display='none';return false;}
}
function loginAs(method,identifier){
    const u={id:crypto.randomUUID(),nickname:identifier.slice(0,8),avatar:'👤',method:method,phone:method==='phone'?identifier:'',email:method==='email'?identifier:'',phone_verified:method==='phone',email_verified:method==='email',created:new Date().toISOString()};
    localStorage.setItem('rt_user',JSON.stringify(u));location.reload();
}
function updateSidebarAvatar(){
    const u=JSON.parse(localStorage.getItem('rt_user')||'null');if(!u)return;
    const av=$('#sidebar-avatar');if(av)av.textContent=u.avatar||'👤';
}
// 登录tab切换
$$('.login-tab').forEach(t=>{t.addEventListener('click',()=>{$$('.login-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');$$('.login-form').forEach(f=>f.style.display='none');const form=$('#login-'+t.dataset.method+'-form');if(form)form.style.display='';});});
// 发送验证码
let phoneTimer=0,emailTimer=0;
const spc=$('#send-phone-code');
if(spc)spc.addEventListener('click',function(){const p=$('#login-phone').value.trim();if(!p||p.length!==11){toast('请输入11位手机号','error');return;}if(phoneTimer>0)return;toast('验证码已发送（演示：123456）','success');phoneTimer=60;const btn=this;const iv=setInterval(function(){phoneTimer--;btn.textContent=phoneTimer>0?phoneTimer+'s':'发送验证码';if(phoneTimer<=0)clearInterval(iv);},1000);});
const sec=$('#send-email-code');
if(sec)sec.addEventListener('click',function(){const e=$('#login-email').value.trim();if(!e||!e.includes('@')){toast('请输入有效邮箱','error');return;}if(emailTimer>0)return;toast('验证码已发送（演示：123456）','success');emailTimer=60;const btn=this;const iv=setInterval(function(){emailTimer--;btn.textContent=emailTimer>0?emailTimer+'s':'发送验证码';if(emailTimer<=0)clearInterval(iv);},1000);});
// 登录按钮
const lpb=$('#login-phone-btn');if(lpb)lpb.addEventListener('click',function(){const p=$('#login-phone').value.trim(),c=$('#login-phone-code').value.trim();if(!p||p.length!==11){toast('请输入手机号','error');return;}if(c!=='123456'){toast('验证码错误（演示：123456）','error');return;}loginAs('phone',p);});
const leb=$('#login-email-btn');if(leb)leb.addEventListener('click',function(){const e=$('#login-email').value.trim(),c=$('#login-email-code').value.trim();if(!e){toast('请输入邮箱','error');return;}if(c!=='123456'){toast('验证码错误（演示：123456）','error');return;}loginAs('email',e);});
const lwb=$('#login-wechat-btn');if(lwb)lwb.addEventListener('click',function(){loginAs('wechat','微信用户'+Math.floor(Math.random()*1000));});
// 用户资料
const pb=$('#profile-btn');
if(pb)pb.addEventListener('click',function(){
    const u=JSON.parse(localStorage.getItem('rt_user')||'null');if(!u)return;
    $('#profile-nickname').value=u.nickname||'';$('#profile-phone').value=u.phone||'';$('#profile-email').value=u.email||'';
    $('#profile-nickname-display').textContent=u.nickname||'用户';
    $('#profile-avatar-display').textContent=u.avatar||'👤';
    var methods={phone:'手机号登录',email:'邮箱登录',wechat:'微信登录'};
    $('#profile-login-method').textContent=methods[u.method]||'';
    $('#phone-verified-badge').style.display=u.phone_verified?'':'none';
    $('#email-verified-badge').style.display=u.email_verified?'':'none';
    $('#phone-verify-area').style.display='none';$('#email-verify-area').style.display='none';
    $('#profile-modal-overlay').classList.add('active');
});
const pvp=$('#profile-verify-phone');if(pvp)pvp.addEventListener('click',function(){const p=$('#profile-phone').value.trim();if(!p||p.length!==11){toast('请输入11位手机号','error');return;}$('#phone-verify-area').style.display='flex';toast('验证码已发送（演示：123456）','success');});
const pcp=$('#profile-confirm-phone');if(pcp)pcp.addEventListener('click',function(){if($('#profile-phone-code').value.trim()!=='123456'){toast('验证码错误','error');return;}var u=JSON.parse(localStorage.getItem('rt_user'));u.phone=$('#profile-phone').value.trim();u.phone_verified=true;localStorage.setItem('rt_user',JSON.stringify(u));$('#phone-verified-badge').style.display='';$('#phone-verify-area').style.display='none';toast('手机号已验证','success');});
const pve=$('#profile-verify-email');if(pve)pve.addEventListener('click',function(){const e=$('#profile-email').value.trim();if(!e||!e.includes('@')){toast('请输入有效邮箱','error');return;}$('#email-verify-area').style.display='flex';toast('验证码已发送（演示：123456）','success');});
const pce=$('#profile-confirm-email');if(pce)pce.addEventListener('click',function(){if($('#profile-email-code').value.trim()!=='123456'){toast('验证码错误','error');return;}var u=JSON.parse(localStorage.getItem('rt_user'));u.email=$('#profile-email').value.trim();u.email_verified=true;localStorage.setItem('rt_user',JSON.stringify(u));$('#email-verified-badge').style.display='';$('#email-verify-area').style.display='none';toast('邮箱已验证','success');});
const ps=$('#profile-save');if(ps)ps.addEventListener('click',function(){var u=JSON.parse(localStorage.getItem('rt_user'));u.nickname=$('#profile-nickname').value.trim()||'用户';localStorage.setItem('rt_user',JSON.stringify(u));$('#profile-modal-overlay').classList.remove('active');updateSidebarAvatar();toast('已保存','success');});
const plo=$('#profile-logout');if(plo)plo.addEventListener('click',function(){if(confirm('确定退出登录？')){localStorage.removeItem('rt_user');location.reload();}});
const pmc=$('#profile-modal-close');if(pmc)pmc.addEventListener('click',function(){$('#profile-modal-overlay').classList.remove('active');});
const pad=$('#profile-avatar-display');if(pad)pad.addEventListener('click',function(){var emojis=['👤','😊','🎯','💼','🚀','🎓','💡','🌟','🦊','🐱'];var u=JSON.parse(localStorage.getItem('rt_user'));var cur=emojis.indexOf(u.avatar);u.avatar=emojis[(cur+1)%emojis.length];localStorage.setItem('rt_user',JSON.stringify(u));this.textContent=u.avatar;updateSidebarAvatar();});
// 启动检查
checkAuth();