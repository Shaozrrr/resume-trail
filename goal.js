// 周目标进度
function getWeeklyGoal(){
    if(typeof store==='undefined')return 10;
    return parseInt(store.settings&&store.settings.weeklyGoal)||10;
}

function renderGoal(){
    var el=document.querySelector('#goal-body');
    if(!el||typeof store==='undefined')return;
    var apps=store.apps;
    var now=new Date(),ws=new Date(now);
    ws.setDate(now.getDate()-now.getDay());
    var wsS=ws.toISOString().split('T')[0];
    var tw=apps.filter(function(a){return a.applied_date&&a.applied_date>=wsS;}).length;
    var goal=getWeeklyGoal();
    var pct=Math.min(Math.round(tw/goal*100),100);
    var lws=new Date(ws);lws.setDate(lws.getDate()-7);
    var lwS=lws.toISOString().split('T')[0];
    var lw=apps.filter(function(a){return a.applied_date&&a.applied_date>=lwS&&a.applied_date<wsS;}).length;
    var df=tw-lw;
    var diffText=df>0?'↑'+df:df<0?'↓'+Math.abs(df):'=';
    var barColor=pct>=100?'var(--green)':'var(--blue)';
    el.innerHTML='<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:6px"><span>本周 '+tw+'/'+goal+'</span><span>vs上周'+lw+' '+diffText+'</span></div><div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+barColor+';border-radius:4px;transition:width .6s"></div></div>';
}

var _origRA=typeof renderAnalytics==='function'?renderAnalytics:null;
if(_origRA){
    window.renderAnalytics=function(){_origRA();renderGoal();};
}

var swg=document.querySelector('#settings-weekly-goal');
if(swg){
    swg.value=getWeeklyGoal();
    swg.addEventListener('change',async function(){
        var ok=await store.setSetting('weeklyGoal',parseInt(swg.value)||10);
        if(ok===false){
            swg.value=getWeeklyGoal();
            return;
        }
        if(typeof renderAnalytics==='function')renderAnalytics();
    });
}

var profileOpenBtn=document.querySelector('#profile-btn');
if(profileOpenBtn){
    profileOpenBtn.addEventListener('click',function(){
        var swg2=document.querySelector('#settings-weekly-goal');
        if(swg2)swg2.value=getWeeklyGoal();
    });
}
