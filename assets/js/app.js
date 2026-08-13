/* ============================================================
   自媒体创作工作台 · 主程序
   ============================================================ */
(function(){
'use strict';

/* ---------------- 基础工具 ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const NS = 'mcw:';
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const DB = {
  get(k,d){ try{ const v=localStorage.getItem(NS+k); return v==null?d:JSON.parse(v);}catch(e){return d;} },
  set(k,v){ try{ localStorage.setItem(NS+k,JSON.stringify(v)); }catch(e){ toast('存储空间不足'); } },
  del(k){ try{ localStorage.removeItem(NS+k);}catch(e){} }
};

function pad(n){ return n<10?'0'+n:''+n; }
function dstr(d){ d=d||new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function parseD(s){ const a=s.split('-'); return new Date(+a[0],+a[1]-1,+a[2]); }
function addDays(s,n){ const d=parseD(s); d.setDate(d.getDate()+n); return dstr(d); }
function diffDays(a,b){ return Math.round((parseD(b)-parseD(a))/86400000); }
const TODAY = dstr();

/* 内容日：每天 9:00 换新，9 点前沿用昨天的内容 */
function contentDay(){
  const n=new Date();
  if(n.getHours()<9){ const y=new Date(n.getTime()-86400000); return dstr(y); }
  return dstr(n);
}
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return Math.abs(h); }
/* 按日期确定性地轮换数组 */
function rotate(arr,seedStr,n){
  if(!arr.length) return [];
  const off = hashStr(seedStr)%arr.length;
  const out=[]; const cnt=Math.min(n||arr.length,arr.length);
  for(let i=0;i<cnt;i++) out.push(arr[(off+i)%arr.length]);
  return out;
}

function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),2000);
}

/* ---------------- 吉祥物（软萌治愈） ---------------- */
const MASCOT='assets/img/mascot.png';
const GREETINGS=[
  '今天也要闪闪发光呀 ✨','慢慢来，你已经在变好啦','新的一天，小星星陪你一起努力',
  '累的时候记得抱抱自己','你认真生活的样子超可爱','每一小步都算数哦',
  '今天会比昨天更好一点','先完成，再完美 ⭐','记得对自己温柔一点'
];
function greeting(seed){ return GREETINGS[hashStr(seed||TODAY)%GREETINGS.length]; }
function mascot(size, bubble){
  const s=size||'m';
  const img=`<img src="${MASCOT}" class="mascot ${s} mascot-float" alt="小星星">`;
  if(!bubble) return img;
  return `<div style="display:inline-flex;align-items:flex-end;gap:8px;flex-direction:row-reverse">
    <div class="mascot-bubble">${bubble}</div>${img}</div>`;
}
function emptyMascot(text, bubble){
  return `<div class="empty-mascot">
    ${mascot('xl')}
    <div class="mascot-bubble">${bubble||'这里空空的，先去别处逛逛吧～'}</div>
    <p>${text}</p>
  </div>`;
}

/* ---------------- 菜单 ---------------- */
const MENUS=[
 {id:'plan',  ico:'📅', n:'每日计划',   sub:'今天也要好好生活呀'},
 {id:'fit',   ico:'🏃', n:'减肥运动',   sub:'瘦脸 · 瘦腰 · 全身'},
 {id:'en',    ico:'🔤', n:'英语学习',   sub:'重新捡起来，从今天开始'},
 {id:'pod',   ico:'🎧', n:'播客精选',   sub:'经济 · 毛选 · 女性成长'},
 {id:'speech',ico:'🎤', n:'表达练习',   sub:'今日练嘴 · 拿来就能背'},
 {id:'tcm',   ico:'🌿', n:'中医养生',   sub:'跟练 · 食疗 · 艾灸 · 作息'},
 {id:'acup',  ico:'📍', n:'针灸知识',   sub:'穴位常识 · 理疗科普'},
 {id:'book',  ico:'📚', n:'读书推荐',   sub:'长脑子的书单'},
 {id:'style', ico:'💄', n:'妆容穿搭',   sub:'甜酷日常 · 小个子友好'},
 {id:'viral', ico:'🔥', n:'爆款二创',   sub:'普通人能复制的模板'},
 {id:'roco',  ico:'🐲', n:'洛克王国',   sub:'资讯 · 攻略 · 活动'},
 {id:'ai',    ico:'🤖', n:'AI 学习',    sub:'从陌生到熟练'},
 {id:'baby',  ico:'🍼', n:'育儿知识',   sub:'科学育儿卡片'},
 {id:'news',  ico:'📰', n:'新闻资讯',   sub:'每天 10+ 条实时热点'},
 {id:'wx',    ico:'⛅', n:'天气',       sub:'常熟 · 近 7 天'}
];

/* ---------------- 收藏 / 笔记 ---------------- */
function favs(){ return DB.get('favs',[]); }
function isFav(key){ return favs().some(f=>f.key===key); }
function toggleFav(item){
  let list=favs(); const i=list.findIndex(f=>f.key===item.key);
  if(i>=0){ list.splice(i,1); toast('已取消收藏'); }
  else { list.unshift(Object.assign({time:Date.now()},item)); toast('已加入收藏夹 ⭐'); }
  DB.set('favs',list); paintFavCount(); return i<0;
}
function notes(){ return DB.get('notes',[]); }
function paintFavCount(){
  const c=favs().length+notes().length;
  $('#favCount').textContent=c; $('#favCount').style.display=c?'grid':'none';
}

/* ---------------- 平台按钮 ---------------- */
function platBtns(k,list){
  return (list||['bili','dy']).map(p=>{
    const P=PLATFORMS[p]; if(!P) return '';
    return `<a class="plat ${P.c}" target="_blank" rel="noopener" href="${P.u(k)}">${P.n}搜索</a>`;
  }).join('');
}

/* ---------------- 通用内容卡 ---------------- */
const ICOSET=['','m','s','a','v'];
function contentCard(sec,it,i){
  const key=sec+'::'+it.t;
  const on=isFav(key)?'on':'';
  const cls=ICOSET[i%5];
  const tags=(it.tag||[]).map(t=>`<span class="pill ${['','mint','sky','amber','violet'][(t.length)%5]}">${esc(t)}</span>`).join('');
  return `<article class="icard" data-key="${esc(key)}">
    <div class="ic-top">
      <div class="ic-ico ${cls}">${it.ico||sectionIcon(sec)}</div>
      <div class="ic-h">
        <div class="ic-t">${esc(it.t)}</div>
        ${it.s?`<div class="ic-s">${esc(it.s)}</div>`:''}
      </div>
    </div>
    <div class="ic-body">${it.d||''}</div>
    ${tags?`<div class="ic-tags wrap">${tags}</div>`:''}
    <div class="ic-foot">
      ${it.k?platBtns(it.k,it.plat):''}
      ${it.note?`<button class="plat" data-note="${esc(it.t)}">📝 笔记</button>`:''}
      <button class="fav-t ${on}" data-fav='${esc(JSON.stringify({key:key,sec:sec,t:it.t,s:it.s||'',k:it.k||'',plat:it.plat||[]}))}'>${on?'★':'☆'}</button>
    </div>
    ${videoCard(sec, sec+'|'+it.t)}
  </article>`;
}
function sectionIcon(sec){
  const m={fit:'🏃',pod:'🎧',speech:'🎤',tcm:'🌿',acup:'📍',book:'📚',style:'💄',viral:'🔥',roco:'🐲',ai:'🤖',baby:'🍼'};
  return m[sec]||'✨';
}

/* ---------------- 视频卡（真实 B 站视频，点击在内容中播放） ---------------- */
const VIDEO_SECS=['speech','tcm','acup','book','style','viral','ai','baby','fit'];
/* 视频卡：纯本地样式卡片（永远不黑、不依赖 B 站图床/播放器），点击跳转到 B 站观看 */
function safeCover(u){ return (u||'').replace(/["'<>]/g,''); }
function videoCard(sec,key){
  if(VIDEO_SECS.indexOf(sec)<0) return '';
  /* 优先取与这条内容主题一致的视频，取不到再用栏目兜底池 */
  let v=(window.VIDEO_MAP||{})[key];
  if(!v){
    const pool=(window.VIDEOS||{})[sec]||[];
    if(!pool.length) return '';
    v=pool[Math.abs(hashStr(key||sec))%pool.length];
  }
  if(!v||!v.bv) return '';
  const burl='https://www.bilibili.com/video/'+v.bv;
  return `<a class="vcard vlink" href="${burl}" target="_blank" rel="noopener">
    <div class="vc-head"><span class="vc-tag">📺 配套视频</span><span>在 B 站观看</span></div>
    <div class="vc-poster"><span class="vc-play-ico">▶</span></div>
    <div class="vc-meta"><span class="vc-t">${esc(v.t)}</span><span class="vc-up">📺 ${esc(v.up||'B站')}</span></div>
    <div class="vc-hint">来源 B 站 · 点击前往观看</div>
  </a>`;
}

/* ---------------- 今日新增（每日自动抓取的真实新内容） ---------------- */
function dailyData(sec){
  const D=window.DAILY;
  if(!D||!D.secs||!D.secs[sec]) return null;
  const d=D.secs[sec];
  if((!d.vids||!d.vids.length)&&(!d.news||!d.news.length)) return null;
  return d;
}
/* 新抓到的视频，样式与配套视频卡一致，点击同样在卡内播放 */
function freshVideoCard(v){
  if(!v||!v.bv) return '';
  const play=v.play>10000?(Math.round(v.play/10000*10)/10+'万播放'):(v.play?v.play+'播放':'');
  const burl='https://www.bilibili.com/video/'+v.bv;
  return `<a class="vcard vlink" href="${burl}" target="_blank" rel="noopener">
    <div class="vc-head"><span class="vc-tag">🆕 今日新片</span><span>在 B 站观看</span></div>
    <div class="vc-poster"><span class="vc-play-ico">▶</span></div>
    <div class="vc-meta"><span class="vc-t">${esc(v.t)}</span><span class="vc-up">📺 ${esc(v.up||'B站')}</span></div>
    <div class="vc-hint">${play?esc(play)+' · ':''}来源 B 站 · 今日抓取</div>
  </a>`;
}
function dailyBox(sec){
  const d=dailyData(sec); if(!d) return '';
  const D=window.DAILY;
  const vids=(d.vids||[]).slice(0,4).map(freshVideoCard).join('');
  const news=(d.news||[]).slice(0,3).map(n=>{
    const cov=n.cover?`<span class="dn-thumb" style="background-image:url('${safeCover(n.cover)}')"></span>`
      :`<span class="dn-thumb dn-thumb--ico">📰</span>`;
    return `<a class="dn-item" href="${esc(n.url||'#')}" target="_blank" rel="noopener">
      ${cov}<span class="dn-main"><span class="dn-t">${esc(n.t)}</span>
      ${n.desc?`<span class="dn-desc">${esc(n.desc)}</span>`:''}
      <span class="dn-src">${esc(n.src||'资讯')}</span></span>
    </a>`;
  }).join('');
  return `<div class="daily-box">
    <div class="db-head"><span class="db-ico">🆕</span><b>今日新增</b>
      <span class="db-badge">${esc((D.date||'').slice(5))} 抓取</span></div>
    ${news?`<div class="dn-list">${news}</div>`:''}
    ${vids}
    ${vids?'':'<div class="tiny muted" style="padding:4px 2px">今天这个栏目的新视频还在路上～</div>'}
  </div>`;
}
/* 首页合辑：把当天各栏目抓到的新内容汇总成一张卡 */
function dailyDigest(){
  const D=window.DAILY;
  if(!D||!Array.isArray(D.digest)||!D.digest.length) return '';
  const items=D.digest.map(it=>{
    const inner=`<span class="dg-ico">${it.ico||'✨'}</span>
      <span class="dg-body"><span class="dg-sec">${esc(it.name||'')}</span>
      <span class="dg-t">${esc(it.t||'')}</span></span>`;
    return it.type==='v'
      ? `<button class="dg-item" data-go="${esc(it.sec)}">${inner}<span class="dg-go">看视频 ›</span></button>`
      : `<a class="dg-item" href="${esc(it.url||'#')}" target="_blank" rel="noopener">${inner}<span class="dg-go">读原文 ›</span></a>`;
  }).join('');
  const stale=D.date&&D.date!==TODAY;
  return `<div class="card digest">
    <div class="dg-head"><b>📦 今日份新内容</b>
      <span class="pill ${stale?'grey':'mint'}">${esc(D.date||'')}${stale?' · 待更新':' · 已更新'}</span></div>
    <div class="dg-list">${items}</div>
    <div class="tiny muted" style="margin-top:9px">每天早上 8:00 自动抓取各栏目的真实新内容</div>
  </div>`;
}
/* 首页：今日热闻 · 图文精选（知乎热榜/微博热搜/每日要闻，每天刷新） */
function dailyHot(){
  const D=window.DAILY;
  if(!D||!Array.isArray(D.hot)||!D.hot.length) return '';
  const items=D.hot.map(h=>{
    const cov=h.cover?`<span class="hot-thumb" style="background-image:url('${safeCover(h.cover)}')"></span>`
      :`<span class="hot-thumb hot-thumb--ico">📰</span>`;
    return `<a class="hot-item" href="${esc(h.url||'#')}" target="_blank" rel="noopener">
      ${cov}<span class="hot-main"><span class="hot-t">${esc(h.t)}</span>
      ${h.desc?`<span class="hot-desc">${esc(h.desc)}</span>`:''}
      <span class="hot-src">${esc(h.src||'资讯')}</span></span>
    </a>`;
  }).join('');
  const stale=D.date&&D.date!==TODAY;
  return `<div class="card hot-box">
    <div class="dg-head"><b>📰 今日热闻 · 图文精选</b>
      <span class="pill ${stale?'grey':'mint'}">${esc(D.date||'')}${stale?' · 待更新':' · 已更新'}</span></div>
    <div class="hot-list">${items}</div>
    <div class="tiny muted" style="margin-top:9px">来自知乎热榜 / 微博热搜 / 每日要闻，每天自动刷新</div>
  </div>`;
}

/* 在已打开的标签页里静默刷新「每日新内容」。
   手机切回标签页 / 定时都会触发，不必整页重载，直接换数据并重绘 daily 区块。
   这样即便后端已更新，挂着的标签页也能拿到当天内容。 */
let _dailySig='';
function dailySig(D){
  if(!D) return '';
  return D.date+'|'+(D.digest||[]).length+'|'+(D.hot||[]).length+'|'+
    Object.keys(D.secs||{}).map(s=>((D.secs[s].vids||[]).length)+'/'+(D.secs[s].news||[]).length).join(',');
}
const DAILY_GH='https://a53-thce.github.io/creator-studio/assets/js/data-daily.js';
/* 跨域托管（如 agentos）用脚本标签从 GitHub 拉取当日数据，避免 CORS 限制，实现免重部署自动同步 */
function _loadDailyFromGh(){
  return new Promise(res=>{
    const prev=document.getElementById('__dailySrc'); if(prev) prev.remove();
    const s=document.createElement('script');
    s.id='__dailySrc'; s.src=DAILY_GH+'?_='+Date.now();
    const done=()=>{ res(window.DAILY||null); };
    s.onload=done; s.onerror=()=>res(null);
    document.head.appendChild(s);
  });
}
async function refreshDaily(quiet){
  try{
    let nd;
    if(location.hostname.indexOf('github.io')>=0){
      /* 同源部署：直接 fetch 相对路径，无需跨域 */
      const res=await fetch('assets/js/data-daily.js?_='+Date.now(),{cache:'no-store'});
      if(!res.ok) return false;
      const txt=await res.text();
      if(!/window\.DAILY\s*=/.test(txt)) return false;
      const g={}; new Function('window',txt)(g); nd=g.DAILY;
    } else {
      /* 其它托管：从 GitHub Pages 拉当日数据，自动同步 */
      nd=await _loadDailyFromGh();
    }
    if(!nd||!nd.date) return false;
    const sig=dailySig(nd);
    if(sig===_dailySig) return false;                 // 内容没变，跳过
    const changed=!window.DAILY||window.DAILY.date!==nd.date;
    window.DAILY=nd; _dailySig=sig;
    if(typeof render==='function') render();
    if(!quiet) toast(changed?('✨ 已更新到 '+nd.date+' 的新内容'):'🔄 已刷新今日内容');
    return true;
  }catch(e){ return false; }
}

/* 分组分段渲染 */
function groupPage(sec,data,opt){
  opt=opt||{};
  const groups=[...new Set(data.map(d=>d.grp))];
  const cur=DB.get('seg:'+sec,'全部');
  const list = cur==='全部'?data:data.filter(d=>d.grp===cur);
  const segs=['全部'].concat(groups).map(g=>`<button class="seg ${g===cur?'on':''}" data-seg="${esc(g)}">${esc(g)}</button>`).join('');

  let daily='';
  if(opt.daily){
    const picks=rotate(data,contentDay()+sec,opt.daily);
    daily=`<div class="sec-title">今日推荐 <span class="pill amber">每日 9:00 轮换</span></div>`+
      picks.map((it,i)=>contentCard(sec,it,i)).join('')+
      `<div class="sec-title">全部内容</div>`;
  }
  let kw='';
  if(opt.keywords){
    kw=`<div class="card"><div class="row" style="margin-bottom:9px"><b style="font-size:13.5px">🔍 全平台视频速查</b></div>
      <div class="wrap">${opt.keywords.map(k=>`<button class="pill grey" data-kw="${esc(k)}" style="padding:6px 11px;font-size:12px">${esc(k)}</button>`).join('')}</div>
      <div class="tiny muted" style="margin-top:9px">点击关键词 → 选择平台跳转检索</div></div>`;
  }
  return `${opt.head||''}${kw}${dailyBox(sec)}${daily}<div class="segs">${segs}</div>${
    list.map((it,i)=>contentCard(sec,it,i)).join('')||emptyMascot('这个栏目今天还空空哒～','换个分组，或点上面的关键词去各平台找找灵感吧')}`;
}

/* ============================================================
   1. 每日计划
   ============================================================ */
const PRESET=[
 {id:'p1',t:'运动',m:'减肥运动 · 今天动起来'},
 {id:'p2',t:'学习英语',m:'20个新词 + 复习'},
 {id:'p3',t:'表达能力练习',m:'朗读一篇今日练嘴'},
 {id:'p4',t:'晚上 10:30 提醒睡觉',m:'早睡是最便宜的医美'}
];
function tasks(){
  let t=DB.get('tasks',null);
  if(!t){ t=PRESET.map(p=>Object.assign({},p)); DB.set('tasks',t); }
  return t;
}
function records(){ return DB.get('recs',{}); }
function dayRec(d){ const r=records(); return r[d]||{ids:[],total:0}; }

function pagePlan(){
  const q=QUOTES[hashStr(TODAY)%QUOTES.length];
  const ts=tasks(); const rec=dayRec(TODAY);
  const doneN=ts.filter(t=>rec.ids.includes(t.id)).length;
  const pct=ts.length?Math.round(doneN/ts.length*100):0;
  const recs=records();
  const streak=(function(){
    let d=TODAY; if(!(recs[d]&&recs[d].ids.length)) d=addDays(TODAY,-1);
    let n=0; while(recs[d]&&recs[d].ids.length){ n++; d=addDays(d,-1); } return n;})();
  const monthDone=Object.keys(recs).filter(k=>k.slice(0,7)===TODAY.slice(0,7)&&recs[k].ids.length).length;
  const totalDone=Object.keys(recs).filter(k=>recs[k].ids.length).length;

  return `
  <div class="hero">
    <div class="hero-mascot">${mascot('', greeting(TODAY))}</div>
    <div class="hero-top"><span class="hero-date">${TODAY} · ${'周日周一周二周三周四周五周六'.substr(new Date().getDay()*2,2)}</span>
      <span class="hero-date">${pct}% 已完成</span></div>
    <div class="hero-q">${esc(q.cn)}</div>
    <div class="hero-en">${esc(q.en)}</div>
    <div class="hero-act">
      <button class="hb solid" id="qSpeak">🔊 朗读英文</button>
      <button class="hb" id="qNext">换一句</button>
      <button class="hb" id="qFav">⭐ 收藏</button>
    </div>
  </div>

  ${liveBox('plan','🔥 今日热搜 · 选题灵感')}

  ${dailyDigest()}

  ${dailyHot()}

  <div class="stats">
    <div class="stat"><b>${streak}</b><span>连续打卡（天）</span></div>
    <div class="stat m"><b>${monthDone}</b><span>本月签到</span></div>
    <div class="stat s"><b>${totalDone}</b><span>累计签到</span></div>
  </div>

  <div class="card">
    <div class="cal-head">
      <b id="calTitle"></b>
      <div class="cal-nav"><button id="calPrev">‹</button><button id="calToday">今</button><button id="calNext">›</button></div>
    </div>
    <div class="cal-grid" id="calGrid"></div>
    <div class="cal-legend">
      <span><i style="background:linear-gradient(135deg,#E4657A,#C8384B)"></i>全部完成</span>
      <span><i style="background:#F8DDE2"></i>部分完成</span>
      <span><i style="border:1.6px solid #C8384B;background:#fff"></i>今天</span>
    </div>
  </div>

  <div class="sec-title">今日待办 <span class="st-more">${doneN}/${ts.length}</span></div>
  <div class="card flat" style="padding:12px 13px">
    <div class="bar" style="margin-bottom:4px"><i style="width:${pct}%"></i></div>
    <div class="tiny muted" style="text-align:right;margin-top:5px">今日完成进度 ${pct}%</div>
  </div>
  <div id="todoList">${ts.map(t=>{
    const d=rec.ids.includes(t.id);
    return `<div class="todo ${d?'done':''}" data-id="${t.id}">
      <div class="tk-box">✓</div>
      <div class="tk-main"><div class="tk-title">${esc(t.t)}</div>
        <div class="tk-meta"><span>${esc(t.m||'自定义任务')}</span>${d?'<span class="pill">已完成</span>':''}</div></div>
      <div class="tk-ops">
        <button class="tk-edit" data-edit="${t.id}" aria-label="编辑">✎</button>
        <button class="tk-del" data-del="${t.id}" aria-label="删除">×</button>
      </div>
    </div>`;}).join('')}</div>

  <div class="add-row">
    <input id="tkInput" placeholder="新增一个任务，回车确认" maxlength="30"/>
    <button class="btn" id="tkAdd">添加</button>
  </div>

  <div class="sec-title">数据管理</div>
  <div class="card">
    <div class="wrap">
      <button class="btn ghost sm" id="expBtn">导出备份</button>
      <button class="btn ghost sm" id="impBtn">导入备份</button>
      <button class="btn mint sm" id="notifyBtn">开启 22:30 睡觉提醒</button>
      <button class="btn grey sm" id="resetTk">恢复默认任务</button>
    </div>
    <div class="tiny muted" style="margin-top:9px">所有数据保存在这台设备的浏览器里，换设备请先导出备份。睡觉提醒需保持本页在后台运行。</div>
  </div>`;
}

let calCursor=null;
function paintCal(){
  const g=$('#calGrid'); if(!g) return;
  const base=calCursor||new Date();
  const y=base.getFullYear(),m=base.getMonth();
  $('#calTitle').textContent=y+'年'+(m+1)+'月';
  const first=new Date(y,m,1), start=first.getDay();
  const days=new Date(y,m+1,0).getDate();
  const prevDays=new Date(y,m,0).getDate();
  const recs=records();
  let h='<div class="cal-w">日</div><div class="cal-w">一</div><div class="cal-w">二</div><div class="cal-w">三</div><div class="cal-w">四</div><div class="cal-w">五</div><div class="cal-w">六</div>';
  for(let i=0;i<start;i++) h+=`<div class="cal-d out">${prevDays-start+i+1}</div>`;
  for(let d=1;d<=days;d++){
    const ds=y+'-'+pad(m+1)+'-'+pad(d);
    const r=recs[ds]; let cls='';
    if(r&&r.ids.length){ cls = (r.total&&r.ids.length>=r.total)?'done':'part'; }
    if(ds===TODAY) cls+=' today';
    h+=`<div class="cal-d ${cls}" data-day="${ds}">${d}</div>`;
  }
  const tail=(7-((start+days)%7))%7;
  for(let i=1;i<=tail;i++) h+=`<div class="cal-d out">${i}</div>`;
  g.innerHTML=h;
}

function deleteTask(id){
  let ts=tasks().filter(t=>t.id!==id); DB.set('tasks',ts);
  const r=records(); Object.keys(r).forEach(k=>{ r[k].ids=r[k].ids.filter(x=>x!==id); }); DB.set('recs',r);
  toast('已删除任务'); render();
}
function toggleDone(id){
  const r=records(); const cur=r[TODAY]||{ids:[],total:0};
  const i=cur.ids.indexOf(id);
  if(i>=0) cur.ids.splice(i,1); else cur.ids.push(id);
  cur.total=tasks().length; r[TODAY]=cur; DB.set('recs',r);
  if(i<0&&cur.ids.length===cur.total){
    openModal('🎉 今天全部完成！',
      `<div class="done-celebrate">${mascot('xl')}
        <h4>太棒啦，今天全部搞定！</h4>
        <p>${greeting(TODAY+'done')}<br>早点休息，明天继续闪闪发光 ✨</p>
        <div style="margin-top:14px"><button class="btn" id="celebrateOk">好呀～</button></div></div>`);
    const ok=$('#celebrateOk'); if(ok) ok.onclick=closeModal;
  }
  render();
}
function startEdit(id){
  const ts=tasks(); const t=ts.find(x=>x.id===id); if(!t) return;
  const row=document.querySelector('.todo[data-id="'+id+'"]');
  const holder=row&&row.querySelector('.tk-title'); if(!holder) return;
  if(holder.querySelector('input')) return;
  const inp=document.createElement('input');
  inp.className='tk-edit-in'; inp.value=t.t; inp.maxLength=30;
  holder.innerHTML=''; holder.appendChild(inp);
  let finished=false;
  const finish=(save)=>{
    if(finished) return; finished=true;
    const v=inp.value.trim();
    if(save && v){ if(v!==t.t){ t.t=v; DB.set('tasks',ts); toast('已更新任务'); } render(); }
    else render();
  };
  inp.addEventListener('click',e=>e.stopPropagation());
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); finish(true); }
    else if(e.key==='Escape'){ e.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur',()=>finish(true));
  setTimeout(()=>{ inp.focus(); inp.select(); },0);
}

function bindPlan(){
  paintCal();
  let qi=hashStr(TODAY)%QUOTES.length;
  $('#qSpeak').onclick=()=>speak(QUOTES[qi].en,'en-US');
  $('#qNext').onclick=()=>{ qi=(qi+1)%QUOTES.length;
    document.querySelector('.hero-q').textContent=QUOTES[qi].cn;
    document.querySelector('.hero-en').textContent=QUOTES[qi].en; };
  $('#qFav').onclick=()=>{ const q=QUOTES[qi];
    toggleFav({key:'quote::'+q.cn,sec:'激励语',t:q.cn,s:q.en,k:'',plat:[]}); };

  $('#calPrev').onclick=()=>{ const b=calCursor||new Date(); calCursor=new Date(b.getFullYear(),b.getMonth()-1,1); paintCal(); };
  $('#calNext').onclick=()=>{ const b=calCursor||new Date(); calCursor=new Date(b.getFullYear(),b.getMonth()+1,1); paintCal(); };
  $('#calToday').onclick=()=>{ calCursor=null; paintCal(); };
  $('#calGrid').onclick=e=>{
    const c=e.target.closest('[data-day]'); if(!c) return;
    const ds=c.dataset.day, r=dayRec(ds), ts=tasks();
    const names=r.ids.map(id=>{ const t=ts.find(x=>x.id===id); return t?t.t:'（已删除的任务）'; });
    openModal(ds+' 打卡记录',
      r.ids.length? `<div class="card"><div class="row" style="margin-bottom:8px"><span class="pill">完成 ${r.ids.length}/${r.total||r.ids.length}</span></div>
        ${names.map(n=>`<div class="row" style="padding:5px 0"><span style="color:#C8384B">✓</span><span>${esc(n)}</span></div>`).join('')}</div>`
        : '<div class="empty-mascot">'+mascot('m')+'<p>这一天没有打卡记录<br>从今天开始，一点点积累吧 🌟</p></div>');
  };

  $('#todoList').onclick=e=>{
    const del=e.target.closest('[data-del]');
    if(del){ deleteTask(del.dataset.del); return; }
    const edit=e.target.closest('[data-edit]');
    if(edit){ startEdit(edit.dataset.edit); return; }
    const box=e.target.closest('.tk-box');
    if(box){ toggleDone(box.closest('[data-id]').dataset.id); return; }
    const title=e.target.closest('.tk-title');
    if(title){ startEdit(title.closest('[data-id]').dataset.id); return; }
    const row=e.target.closest('[data-id]');
    if(row) toggleDone(row.dataset.id);
  };

  const add=()=>{
    const v=$('#tkInput').value.trim(); if(!v) return;
    const ts=tasks(); ts.push({id:'c'+Date.now(),t:v,m:'自定义任务'}); DB.set('tasks',ts);
    $('#tkInput').value=''; toast('已添加'); render();
  };
  $('#tkAdd').onclick=add;
  $('#tkInput').onkeydown=e=>{ if(e.key==='Enter') add(); };

  $('#resetTk').onclick=()=>{ DB.set('tasks',PRESET.map(p=>Object.assign({},p))); toast('已恢复默认任务'); render(); };
  $('#notifyBtn').onclick=()=>{
    if(!('Notification' in window)){ toast('当前浏览器不支持系统通知'); return; }
    Notification.requestPermission().then(p=>{
      if(p==='granted'){ DB.set('notify',1); toast('已开启，22:30 会提醒你睡觉 🌙'); }
      else toast('未获得通知权限，可在浏览器设置中开启');
    });
  };
  $('#expBtn').onclick=()=>{
    const all={}; Object.keys(localStorage).filter(k=>k.indexOf(NS)===0).forEach(k=>all[k]=localStorage.getItem(k));
    const blob=new Blob([JSON.stringify(all,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='创作工作台备份-'+TODAY+'.json'; a.click(); toast('备份已导出');
  };
  $('#impBtn').onclick=()=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
    inp.onchange=()=>{ const f=inp.files[0]; if(!f) return;
      const rd=new FileReader(); rd.onload=()=>{ try{
        const o=JSON.parse(rd.result); Object.keys(o).forEach(k=>{ if(k.indexOf(NS)===0) localStorage.setItem(k,o[k]); });
        toast('导入成功'); render(); paintFavCount();
      }catch(e){ toast('文件格式不正确'); } }; rd.readAsText(f); };
    inp.click();
  };
}

/* ============================================================
   2. 语音：朗读 / 录音 / 对比
   ============================================================ */
let VOICES=[];
function loadVoices(){ VOICES=window.speechSynthesis?speechSynthesis.getVoices():[]; }
if(window.speechSynthesis){ loadVoices(); speechSynthesis.onvoiceschanged=loadVoices; }
function speak(text,lang,rate){
  if(!window.speechSynthesis){ toast('当前浏览器不支持朗读'); return; }
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang=lang||'en-US'; u.rate=rate||0.92; u.pitch=1;
  const pick=VOICES.filter(v=>v.lang&&v.lang.replace('_','-').toLowerCase().indexOf((lang||'en-US').slice(0,2))===0);
  if(pick.length){
    const good=pick.find(v=>/Google|Samantha|Ting-Ting|Siri|Microsoft/i.test(v.name))||pick[0];
    u.voice=good;
  }
  speechSynthesis.speak(u);
}
const REC={mr:null,chunks:[],url:null,btn:null,sr:null};
function stopRec(){
  if(REC.mr&&REC.mr.state!=='inactive'){ try{REC.mr.stop();}catch(e){} }
  if(REC.sr){ try{REC.sr.stop();}catch(e){} }
  if(REC.btn) REC.btn.classList.remove('rec');
}
function levenshtein(a,b){
  const m=a.length,n=b.length; if(!m) return n; if(!n) return m;
  let prev=Array.from({length:n+1},(_,i)=>i);
  for(let i=1;i<=m;i++){ const cur=[i];
    for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=cur; }
  return prev[n];
}
function similarity(a,b){
  a=a.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5 ]/g,'').replace(/\s+/g,' ').trim();
  b=b.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5 ]/g,'').replace(/\s+/g,' ').trim();
  if(!a||!b) return 0;
  return Math.max(0,Math.round((1-levenshtein(a,b)/Math.max(a.length,b.length))*100));
}
/* 录音 + 语音识别对比 */
function recordCompare(target,lang,btn,outEl){
  if(REC.mr&&REC.mr.state==='recording'){ stopRec(); return; }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ toast('浏览器不支持录音'); return; }
  outEl.innerHTML='<div class="tiny muted">正在准备麦克风…</div>';
  navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
    REC.chunks=[]; let heard='';
    try{ REC.mr=new MediaRecorder(stream); }catch(e){ REC.mr=new MediaRecorder(stream,{mimeType:'audio/webm'}); }
    REC.btn=btn; btn.classList.add('rec');
    outEl.innerHTML='<div class="tiny" style="color:#48B49B">🎙 录音中… 再次点击结束</div>';
    REC.mr.ondataavailable=e=>{ if(e.data.size) REC.chunks.push(e.data); };
    REC.mr.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      btn.classList.remove('rec');
      const blob=new Blob(REC.chunks,{type:REC.chunks[0]?REC.chunks[0].type:'audio/webm'});
      if(REC.url) URL.revokeObjectURL(REC.url);
      REC.url=URL.createObjectURL(blob);
      const sc=heard?similarity(heard,target):-1;
      let html='<div class="score'+(sc>=0&&sc<70?' bad':'')+'">';
      if(sc>=0){
        html+=`发音相似度 <b>${sc}分</b> ${sc>=90?'👏 非常标准':sc>=70?'👍 不错，继续练':'再听一遍标准发音试试'}`;
        html+=`<div class="heard">识别到你说的是：${esc(heard)}</div>`;
      }else{
        html+='已录制完成，点下面两个按钮<b>交替播放</b>对比发音';
      }
      html+=`<div class="wrap" style="margin-top:10px">
        <button class="btn sm" data-play="std">🔊 标准发音</button>
        <button class="btn sm mint" data-play="mine">▶ 我的录音</button></div></div>`;
      outEl.innerHTML=html;
      outEl.querySelectorAll('[data-play]').forEach(b=>{
        b.onclick=()=>{ if(b.dataset.play==='std') speak(target,lang);
          else { const au=new Audio(REC.url); au.play(); } };
      });
    };
    REC.mr.start();
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(SR){
      try{
        const r=new SR(); REC.sr=r; r.lang=lang||'en-US'; r.interimResults=false; r.maxAlternatives=1;
        r.onresult=e=>{ heard=e.results[0][0].transcript; };
        r.onerror=()=>{};
        r.start();
      }catch(e){}
    }
    setTimeout(()=>{ if(REC.mr&&REC.mr.state==='recording') stopRec(); },12000);
  }).catch(()=>{ outEl.innerHTML='<div class="tiny" style="color:#C8384B">无法访问麦克风，请在浏览器中允许麦克风权限</div>'; });
}

/* ============================================================
   3. 英语学习
   ============================================================ */
function enState(){
  let s=DB.get('en',null);
  if(!s){ s={start:TODAY,days:[],prog:{},cursor:0,plan:null,hardLog:{}}; DB.set('en',s); }
  return s;
}
function saveEn(s){ DB.set('en',s); }
function buildPlan(s){
  if(s.plan&&s.plan.date===TODAY) return s.plan;
  const N=20, total=WORDS.length;
  const news=[]; for(let i=0;i<N;i++) news.push((s.cursor+i)%total);
  /* 近 7 天学过的（不含今天新词） */
  const rev=[], d15=[], hard=[];
  Object.keys(s.prog).forEach(k=>{
    const p=s.prog[k], gap=diffDays(p.learned,TODAY);
    if(gap>=1&&gap<=7) rev.push(+k);
    if(gap>=15&&(p.rev15|0)===0) d15.push(+k);
    if(p.hard){
      const last=s.hardLog[k]||p.learned;
      if(diffDays(last,TODAY)>=7) hard.push(+k);
    }
  });
  s.plan={date:TODAY,news:news,rev:rev,d15:d15,hard:hard,doneNew:[],doneRev:[]};
  saveEn(s); return s.plan;
}
function markLearned(idx,know){
  const s=enState(); const k=''+idx;
  const p=s.prog[k]||{learned:TODAY,count:0,hard:false};
  p.count=(p.count|0)+1; p.last=TODAY;
  if(!know) p.hard=true;
  if(diffDays(p.learned,TODAY)>=15) p.rev15=1;
  s.prog[k]=p;
  if(p.hard) s.hardLog[k]=TODAY;
  if(s.days.indexOf(TODAY)<0) s.days.push(TODAY);
  const pl=buildPlan(s);
  if(pl.news.indexOf(idx)>=0){
    if(pl.doneNew.indexOf(idx)<0) pl.doneNew.push(idx);
    if(pl.doneNew.length>=pl.news.length&&!pl.moved){
      pl.moved=1; s.cursor=(s.cursor+pl.news.length)%WORDS.length;
    }
  }else if(pl.doneRev.indexOf(idx)<0) pl.doneRev.push(idx);
  saveEn(s);
}
let enTab=null, enPos=0;
function pageEn(){
  const s=enState(), pl=buildPlan(s);
  const learnedTotal=Object.keys(s.prog).length;
  const hardTotal=Object.keys(s.prog).filter(k=>s.prog[k].hard).length;
  const tab=enTab||DB.get('enTab','new');
  const sets={new:pl.news,rev:pl.rev,d15:pl.d15,hard:pl.hard,say:null,gram:null};
  const labels=[['new','今日新词 '+pl.news.length],['rev','7天复习 '+pl.rev.length],
    ['d15','15天巩固 '+pl.d15.length],['hard','易错重刷 '+pl.hard.length],['say','口语跟读'],['gram','语法微课']];
  const segs=labels.map(l=>`<button class="seg ${l[0]===tab?'on':''}" data-etab="${l[0]}">${l[1]}</button>`).join('');

  let body='';
  if(tab==='say') body=sayBody();
  else if(tab==='gram') body=gramBody();
  else{
    const arr=sets[tab]||[];
    if(!arr.length) body=emptyMascot(
      tab==='rev'?'近 7 天还没有学过的词，先去「今日新词」开始吧':
      tab==='d15'?'还没有满 15 天需要巩固的词，继续保持':
      '目前没有易错词，说明你记得很好 👍',
      '换个分组看看，或者打开「口语跟读」练练嘴～');
    else{
      if(enPos>=arr.length) enPos=0;
      const idx=arr[enPos], w=WORDS[idx];
      const doneCnt=(tab==='new'?pl.doneNew.length:pl.doneRev.length);
      body=`<div class="card flat" style="padding:11px 13px;margin-bottom:11px">
          <div class="bar"><i style="width:${Math.round((enPos)/arr.length*100)}%"></i></div>
          <div class="tiny muted" style="margin-top:6px;display:flex;justify-content:space-between">
            <span>第 ${enPos+1} / ${arr.length} 个</span><span>今日已完成 ${doneCnt} 词</span></div>
        </div>
        <div class="word-card">
          <div class="wc-idx">${['今日新词','7天复习','15天巩固','易错重刷'][['new','rev','d15','hard'].indexOf(tab)]} · No.${idx+1}</div>
          <div class="wc-w">${esc(w.w)}</div>
          <div class="wc-p">${esc(w.p)}</div>
          <div class="wc-m">${esc(w.m)}</div>
          <div class="wc-e"><div class="en">${esc(w.e)}</div><div class="cn">${esc(w.t)}</div></div>
          <div class="wc-btns">
            <div class="spk-wrap"><button class="spk" data-say="${esc(w.w)}">🔊</button><div class="spk-lbl">读单词</div></div>
            <div class="spk-wrap"><button class="spk play" data-say="${esc(w.e)}">💬</button><div class="spk-lbl">读例句</div></div>
            <div class="spk-wrap"><button class="spk mic" id="micW">🎙</button><div class="spk-lbl">朗读对比</div></div>
          </div>
          <div id="scoreBox"></div>
        </div>
        <div class="row" style="gap:9px">
          <button class="btn grey" style="flex:1" data-know="0">😵 不认识</button>
          <button class="btn" style="flex:1" data-know="1">😊 认识</button>
        </div>
        <div class="row" style="gap:9px;margin-top:9px">
          <button class="btn ghost sm" data-nav="-1">‹ 上一个</button>
          <button class="btn ghost sm" data-nav="1">下一个 ›</button>
          <button class="btn ghost sm" data-hard="${idx}" style="margin-left:auto">${s.prog[idx]&&s.prog[idx].hard?'★ 已标易错':'☆ 标记易错'}</button>
        </div>
        <div class="sec-title">本组词表</div>
        <div class="wlist">${arr.map((ix,i)=>{
          const ww=WORDS[ix];
          return `<div class="wrow"><div class="wr-m" data-jump="${i}">
            <div class="wr-w">${esc(ww.w)} <span class="wr-p">${esc(ww.p)}</span></div>
            <div class="wr-c">${esc(ww.m)}</div></div>
            <button class="wr-b" data-say="${esc(ww.w)}">🔊</button></div>`;
        }).join('')}</div>`;
    }
  }

  return `${liveBox('en','📜 每日金句（实时更新）')}<div class="stats">
      <div class="stat"><b>${s.days.length}</b><span>累计学习天数</span></div>
      <div class="stat m"><b>${learnedTotal}</b><span>累计学习词量</span></div>
      <div class="stat s"><b>${hardTotal}</b><span>易错词</span></div>
    </div>
    <div class="card flat" style="padding:12px 13px">
      <div class="tiny" style="line-height:1.75">
        <b>学习节奏</b>：每天新学 <b>20</b> 词 → 连续复习最近 <b>7</b> 天 → 满 <b>15</b> 天再巩固一次 → 易错词每 <b>7</b> 天重刷。<br>
        <span class="muted">词库共 ${WORDS.length} 词，按顺序循环。点「🎙 朗读对比」可录音并给出发音相似度评分。</span>
      </div>
    </div>
    <div class="segs">${segs}</div>${body}`;
}
function sayBody(){
  const cats=[...new Set(PHRASES.map(p=>p.c))];
  const cur=DB.get('sayCat',cats[0]);
  const segs=cats.map(c=>`<button class="seg ${c===cur?'on':''}" data-saycat="${esc(c)}">${esc(c)}</button>`).join('');
  const list=PHRASES.filter(p=>p.c===cur);
  return `<div class="segs">${segs}</div>`+list.map((p,i)=>`
    <div class="icard">
      <div class="ic-t" style="font-size:15px">${esc(p.en)}</div>
      <div class="ic-s" style="margin-top:5px;font-size:12.5px">${esc(p.cn)}</div>
      <div class="ic-foot">
        <button class="plat bili" data-say="${esc(p.en)}">🔊 标准朗读</button>
        <button class="plat wx" data-mic="${esc(p.en)}" data-lang="en-US">🎙 跟读对比</button>
      </div>
      <div class="mic-out" data-out="${i}"></div>
    </div>`).join('');
}
function gramBody(){
  return GRAMMAR.map((g,i)=>`
    <div class="icard acc ${i===0?'open':''}">
      <div class="acc-h"><div class="ic-ico ${ICOSET[i%5]}">${i+1}</div>
        <div class="ic-h"><div class="ic-t">${esc(g.t)}</div><div class="ic-s">${esc(g.b)}</div></div>
        <span class="caret">›</span></div>
      <div class="acc-b">
        ${g.e.map(x=>`<div class="wc-e" style="margin-top:8px"><div class="en">${esc(x)}</div>
          <button class="btn ghost sm" style="margin-top:7px" data-say="${esc(x.split(' ').filter(w=>/[a-zA-Z]/.test(w)).join(' '))}">🔊 朗读</button></div>`).join('')}
      </div>
    </div>`).join('');
}
function bindEn(){
  const v=$('#view');
  v.querySelectorAll('[data-etab]').forEach(b=>b.onclick=()=>{ enTab=b.dataset.etab; DB.set('enTab',enTab); enPos=0; render(); });
  v.querySelectorAll('[data-saycat]').forEach(b=>b.onclick=()=>{ DB.set('sayCat',b.dataset.saycat); render(); });
  v.querySelectorAll('[data-say]').forEach(b=>b.onclick=()=>speak(b.dataset.say,'en-US'));
  v.querySelectorAll('.acc-h').forEach(h=>h.onclick=()=>h.parentElement.classList.toggle('open'));

  const tab=enTab||DB.get('enTab','new');
  const s=enState(), pl=buildPlan(s);
  const arr={new:pl.news,rev:pl.rev,d15:pl.d15,hard:pl.hard}[tab];

  const mic=$('#micW');
  if(mic&&arr&&arr.length){
    const w=WORDS[arr[enPos]];
    mic.onclick=()=>recordCompare(w.w,'en-US',mic,$('#scoreBox'));
  }
  v.querySelectorAll('[data-mic]').forEach((b,i)=>{
    b.onclick=()=>{ const out=b.closest('.icard').querySelector('.mic-out');
      recordCompare(b.dataset.mic,b.dataset.lang||'en-US',b,out); };
  });
  v.querySelectorAll('[data-know]').forEach(b=>b.onclick=()=>{
    if(!arr||!arr.length) return;
    markLearned(arr[enPos],b.dataset.know==='1');
    if(enPos<arr.length-1){ enPos++; } else { toast('这一组已经全部过完啦 🎉'); }
    render();
  });
  v.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{
    if(!arr||!arr.length) return;
    enPos=(enPos+ +b.dataset.nav+arr.length)%arr.length; render();
  });
  const hb=v.querySelector('[data-hard]');
  if(hb) hb.onclick=()=>{
    const idx=+hb.dataset.hard, st=enState(), k=''+idx;
    const p=st.prog[k]||{learned:TODAY,count:0,hard:false};
    p.hard=!p.hard; st.prog[k]=p; if(p.hard) st.hardLog[k]=TODAY; saveEn(st);
    toast(p.hard?'已标记为易错词':'已取消易错标记'); render();
  };
  v.querySelectorAll('[data-jump]').forEach(el=>el.onclick=()=>{ enPos=+el.dataset.jump; render(); window.scrollTo({top:0,behavior:'smooth'}); });
}

/* ============================================================
   4. 天气（Open-Meteo · 常熟）
   ============================================================ */
const WMO={0:['晴','☀️'],1:['晴间多云','🌤'],2:['多云','⛅'],3:['阴','☁️'],45:['雾','🌫'],48:['雾凇','🌫'],
51:['小毛雨','🌦'],53:['毛毛雨','🌦'],55:['密毛雨','🌧'],56:['冻毛雨','🌧'],57:['冻毛雨','🌧'],
61:['小雨','🌦'],63:['中雨','🌧'],65:['大雨','🌧'],66:['冻雨','🌧'],67:['冻雨','🌧'],
71:['小雪','🌨'],73:['中雪','🌨'],75:['大雪','❄️'],77:['雪粒','🌨'],
80:['阵雨','🌦'],81:['强阵雨','🌧'],82:['暴雨','⛈'],85:['阵雪','🌨'],86:['强阵雪','❄️'],
95:['雷阵雨','⛈'],96:['雷阵雨伴冰雹','⛈'],99:['强雷暴冰雹','⛈']};
function wmo(c){ return WMO[c]||['未知','🌡']; }

function pageWx(){ return `<div id="wxBox"><div class="empty-mascot">${mascot('m')}<p>小星星正在帮你查常熟天气…<br>马上就好 ⏳</p></div></div>`; }
function loadWx(force){
  const cache=DB.get('wx',null);
  if(!force&&cache&&Date.now()-cache.time<3600000){ paintWx(cache.data); return; }
  const url='https://api.open-meteo.com/v1/forecast?latitude=31.6538&longitude=120.7526'+
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m'+
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,sunrise,sunset'+
    '&timezone=Asia%2FShanghai&forecast_days=7';
  fetch(url).then(r=>r.json()).then(d=>{ DB.set('wx',{time:Date.now(),data:d}); paintWx(d); })
    .catch(()=>{ const b=$('#wxBox'); if(b) b.innerHTML=`<div class="empty-mascot">${mascot('m')}<p>天气获取失败，检查一下网络～
      <button class="btn sm" id="wxRetry" style="margin:10px 0 0">点我重试</button></p></div>`;
    const r=$('#wxRetry'); if(r) r.onclick=()=>loadWx(true); });
}
function paintWx(d){
  const box=$('#wxBox'); if(!box) return;
  const c=d.current||{}, D=d.daily;
  const [txt,emo]=wmo(c.weather_code);
  const wk=['周日','周一','周二','周三','周四','周五','周六'];
  let days='';
  for(let i=0;i<D.time.length;i++){
    const ds=D.time[i], [t2,e2]=wmo(D.weather_code[i]);
    const dt=parseD(ds);
    const label=i===0?'今天':i===1?'明天':i===2?'后天':wk[dt.getDay()];
    const pop=D.precipitation_probability_max?D.precipitation_probability_max[i]:null;
    const uv=D.uv_index_max?Math.round(D.uv_index_max[i]):null;
    days+=`<div class="wx-day">
      <div class="d1">${label}<span>${ds.slice(5)}</span></div>
      <div class="d2">${e2}</div>
      <div class="d3">${t2}${pop!=null?' · 降水 '+pop+'%':''}${uv!=null?' · UV '+uv:''}</div>
      <div class="d4">${Math.round(D.temperature_2m_max[i])}° <em>/ ${Math.round(D.temperature_2m_min[i])}°</em></div>
    </div>`;
  }
  const sr=(D.sunrise&&D.sunrise[0]||'').slice(11,16), ss=(D.sunset&&D.sunset[0]||'').slice(11,16);
  const tip=(function(){
    const mx=D.temperature_2m_max[0], pop=D.precipitation_probability_max?D.precipitation_probability_max[0]:0;
    const a=[];
    if(mx>=35) a.push('高温预警，减少户外运动，室内训练更合适');
    else if(mx>=30) a.push('天热注意补水，运动放在早晚');
    else if(mx<=8) a.push('注意保暖，出门戴围巾，睡前泡脚');
    if(pop>=60) a.push('降水概率高，记得带伞');
    if(D.uv_index_max&&D.uv_index_max[0]>=7) a.push('紫外线强，硬防晒 + 防晒霜别忘');
    if(!a.length) a.push('天气舒适，很适合出门走走');
    return a.join('；')+'。';
  })();
  box.innerHTML=`
    <div class="wx-now">
      <div class="wx-city">📍 江苏 · 常熟市</div>
      <div class="wx-temp">${Math.round(c.temperature_2m)}<small>°C</small></div>
      <div class="wx-desc">${emo} ${txt} · 体感 ${Math.round(c.apparent_temperature)}°</div>
      <div class="wx-sub"><span>湿度 ${c.relative_humidity_2m}%</span><span>风速 ${Math.round(c.wind_speed_10m)} km/h</span>
        <span>日出 ${sr}</span><span>日落 ${ss}</span></div>
    </div>
    <div class="card flat" style="padding:12px 13px;background:var(--mint-tint);border-color:transparent">
      <div class="tiny" style="color:#256B5B;line-height:1.7"><b>生活建议</b>：${tip}</div>
    </div>
    <div class="sec-title">近 7 天预报 <span class="st-more" id="wxRefresh">刷新</span></div>
    ${days}
    <div class="tiny muted" style="text-align:center;margin-top:12px">数据来源 Open-Meteo · 每小时自动更新</div>`;
  const rf=$('#wxRefresh'); if(rf) rf.onclick=()=>{ toast('正在刷新…'); loadWx(true); };
}

/* ============================================================
   5. 新闻资讯
   ============================================================ */
function pageNews(){
  return `<div class="card flat" style="padding:12px 13px">
      <div class="row"><b style="font-size:13.5px">📰 今日要闻</b>
        <button class="btn ghost sm" id="newsRefresh" style="margin-left:auto">刷新</button></div>
      <div class="tiny muted" style="margin-top:6px" id="newsTime">加载中…</div>
    </div><div id="newsBox"><div class="empty-mascot">${mascot('m')}<p>小星星正在帮你拉最新资讯…<br>稍等一下下 ⏳</p></div></div>`;
}
function loadNews(force){
  const cache=DB.get('news',null);
  if(!force&&cache&&Date.now()-cache.time<3600000){ paintNews(cache.data,cache.time); return; }
  const get=u=>fetch(u).then(r=>r.json()).catch(()=>null);
  Promise.all([
    get('https://60s.viki.moe/v2/60s'),
    get('https://60s.viki.moe/v2/toutiao'),
    get('https://60s.viki.moe/v2/weibo'),
    get('https://60s.viki.moe/v2/zhihu')
  ]).then(([s60,tt,wb,zh])=>{
    const out=[];
    if(s60&&s60.data&&s60.data.news) s60.data.news.forEach(n=>out.push({t:n,src:'每日要闻',u:''}));
    if(tt&&Array.isArray(tt.data)) tt.data.slice(0,12).forEach(n=>out.push({t:n.title,src:'今日头条',u:n.link||''}));
    if(wb&&Array.isArray(wb.data)) wb.data.slice(0,12).forEach(n=>out.push({t:n.title,src:'微博热搜',u:n.link||''}));
    if(zh&&Array.isArray(zh.data)) zh.data.slice(0,8).forEach(n=>out.push({t:n.title,src:'知乎热榜',u:n.link||''}));
    const seen={}, list=out.filter(x=>x.t&&!seen[x.t]&&(seen[x.t]=1));
    if(!list.length) throw 0;
    DB.set('news',{time:Date.now(),data:list}); paintNews(list,Date.now());
  }).catch(()=>{
    const c=DB.get('news',null);
    if(c) { paintNews(c.data,c.time); toast('网络异常，显示上次缓存'); return; }
    const b=$('#newsBox'); if(b) b.innerHTML=`<div class="empty-mascot">${mascot('m')}<p>暂时获取不到新闻，检查一下网络～<br>
      <button class="btn sm" id="nRetry" style="margin-top:10px">点我重试</button></p></div>`;
    const r=$('#nRetry'); if(r) r.onclick=()=>loadNews(true);
  });
}
function paintNews(list,time){
  const b=$('#newsBox'); if(!b) return;
  const t=$('#newsTime'); if(t){ const d=new Date(time);
    t.textContent='更新于 '+dstr(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes())+' · 共 '+list.length+' 条 · 每天 9:00 后打开自动更新'; }
  const srcCls={'每日要闻':'','今日头条':'amber','微博热搜':'violet','知乎热榜':'sky'};
  b.innerHTML=list.map((n,i)=>`
    <div class="news-item">
      <div class="news-n">${i+1}</div>
      <div style="flex:1;min-width:0">
        <div class="news-t">${n.u?`<a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a>`:esc(n.t)}</div>
        <div class="news-m"><span class="pill ${(n.src in srcCls)?srcCls[n.src]:'grey'}" style="font-size:10px;padding:2px 7px">${esc(n.src)}</span></div>
      </div>
    </div>`).join('');
}

/* ============================================================
   5.5 实时内容层（联网抓取 · 失败回退精选 · 缓存 + 刷新）
   ============================================================ */
function liveCache(k){ return DB.get('live:'+k,null); }
function setLiveCache(k,data){ DB.set('live:'+k,{time:Date.now(),data:data}); }
function liveBox(sec,title){
  return `<div class="live-box" id="live-${sec}">
    <div class="lb-head"><span class="lb-ico">⚡</span><b>${esc(title)}</b>
      <span class="lb-badge">实时</span>
      <span class="lb-refresh" id="lbref-${sec}">刷新</span></div>
    <div class="lb-body"><div class="tiny muted">小星星正在联网抓取最新内容…</div></div>
  </div>`;
}
function paintLiveBody(sec,html){ const b=$('#live-'+sec); if(b) b.querySelector('.lb-body').innerHTML=html; }
function failLive(sec,msg,reload){ paintLiveBody(sec,`<div class="tiny muted" style="padding:6px 2px">${msg||'实时获取失败，已为你保留精选内容 🌟'}</div>`); if(reload) bindLiveBox(sec,reload); }
function bindLiveBox(sec,reload){
  const b=$('#live-'+sec); if(!b) return;
  const rf=b.querySelector('.lb-refresh'); if(rf) rf.onclick=()=>{ toast('正在刷新…'); reload(true); };
  b.querySelectorAll('[data-say]').forEach(x=>x.onclick=()=>speak(x.dataset.say,'en-US'));
  b.querySelectorAll('[data-eqfav]').forEach(x=>x.onclick=()=>{ const t=x.dataset.eqfav, key='eq::'+t;
    const on=toggleFav({key:key,sec:'每日金句',t:t,s:'',k:'',plat:[]}); x.textContent=on?'★ 已收藏':'⭐ 收藏'; });
}

/* 微博热搜（60s 接口，CORS=*） */
let _hotP=null;
function loadHot(sec,force){
  const c=liveCache('hot');
  if(!force&&c&&Date.now()-c.time<3600000){ paintHot(sec,c.data); return; }
  if(_hotP&&!force){ _hotP.then(d=>paintHot(sec,d)).catch(()=>failLive(sec,null,loadHot)); return; }
  const run=()=> (typeof fetch==='function'?fetch('https://60s.viki.moe/v2/weibo').then(r=>r.json()):Promise.reject(0))
    .then(j=>{ const arr=(j&&Array.isArray(j.data))?j.data:[]; const items=arr.slice(0,15).map(n=>({t:n.title,u:n.link||''}));
      if(!items.length) throw 0; setLiveCache('hot',items); return items; })
    .catch(()=>{ const c2=liveCache('hot'); if(c2) return c2.data; throw 0; });
  _hotP=run();
  _hotP.then(d=>paintHot(sec,d)).catch(()=>failLive(sec,'微博热搜获取失败，已为你保留精选内容 🌟',loadHot));
}
function paintHot(sec,items){
  paintLiveBody(sec, items.map((n,i)=>`
    <div class="news-item"><div class="news-n">${i+1}</div>
    <div style="flex:1;min-width:0"><div class="news-t">${n.u?`<a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a>`:esc(n.t)}</div>
    <div class="news-m"><span class="pill violet" style="font-size:10px;padding:2px 7px">微博热搜</span></div></div></div>`).join(''));
  bindLiveBox(sec,loadHot);
}

/* 每日金句（quotable，经 allorigins 代理，CORS=*） */
let _enqP=null;
function loadEnQuote(force){
  const c=liveCache('enq');
  if(!force&&c&&Date.now()-c.time<86400000){ paintEnQuote(c.data); return; }
  if(_enqP&&!force){ _enqP.then(d=>paintEnQuote(d)).catch(()=>failLive('en')); return; }
  const url='https://api.allorigins.win/raw?url='+encodeURIComponent('https://api.quotable.io/random?tags=inspiration,motivation');
  const run=()=> (typeof fetch==='function'?fetch(url).then(r=>r.text()):Promise.reject(0))
    .then(txt=>{ let j; try{j=JSON.parse(txt);}catch(e){throw 0;} if(!j||!j.content) throw 0;
      const d={en:j.content,author:j.author||''}; setLiveCache('enq',d); return d; })
    .catch(()=>{ const c2=liveCache('enq'); if(c2) return c2.data; throw 0; });
  _enqP=run();
  _enqP.then(d=>paintEnQuote(d)).catch(()=>failLive('en','每日金句获取失败，先用精选内容吧～',loadEnQuote));
}
function paintEnQuote(d){
  paintLiveBody('en', `<div class="icard">
    <div class="ic-t" style="font-size:15px;line-height:1.6">${esc(d.en)}</div>
    <div class="ic-s" style="margin-top:6px;font-size:12.5px">— ${esc(d.author||'佚名')}</div>
    <div class="ic-foot">
      <button class="plat bili" data-say="${esc(d.en)}">🔊 朗读</button>
      <button class="plat" data-eqfav="${esc(d.en)}">⭐ 收藏</button>
    </div></div>`);
  bindLiveBox('en',loadEnQuote);
}

/* 实时热门书单（Open Library，CORS=*） */
let _bkP=null;
function loadBooks(force){
  const c=liveCache('books');
  if(!force&&c&&Date.now()-c.time<86400000){ paintBooks(c.data); return; }
  if(_bkP&&!force){ _bkP.then(d=>paintBooks(d)).catch(()=>failLive('book')); return; }
  const url='https://openlibrary.org/search.json?q=subject%3Abestsellers&sort=rating&limit=12&fields=title,author_name,cover_i,first_publish_year';
  const run=()=> (typeof fetch==='function'?fetch(url).then(r=>r.json()):Promise.reject(0))
    .then(j=>{ const docs=(j&&j.docs)||[]; const items=docs.filter(d=>d.title).slice(0,12).map(d=>({title:d.title,author:(d.author_name||[]).join('、'),cover:d.cover_i,year:d.first_publish_year||''}));
      if(!items.length) throw 0; setLiveCache('books',items); return items; })
    .catch(()=>{ const c2=liveCache('books'); if(c2) return c2.data; throw 0; });
  _bkP=run();
  _bkP.then(d=>paintBooks(d)).catch(()=>failLive('book','热门书单获取失败，已保留精选书单 📚',loadBooks));
}
function paintBooks(items){
  paintLiveBody('book', items.map(d=>{
    const img = d.cover? `<img class="bk-cover" src="https://covers.openlibrary.org/b/o/id/${d.cover}-M.jpg" loading="lazy" onerror="this.style.display='none'">` : '<div class="bk-cover none">📕</div>';
    return `<div class="icard"><div class="ic-top">
      <div class="bk-img">${img}</div>
      <div class="ic-h"><div class="ic-t" style="font-size:14px">${esc(d.title)}</div>
      <div class="ic-s">${esc(d.author||'未知作者')}${d.year?' · '+d.year:''}</div></div></div></div>`;
  }).join(''));
  bindLiveBox('book',loadBooks);
}

/* 科技·AI 实时资讯（Hacker News RSS，经 allorigins 代理） */
let _aiP=null;
function loadAiNews(force){
  const c=liveCache('ainews');
  if(!force&&c&&Date.now()-c.time<3600000){ paintAiNews(c.data); return; }
  if(_aiP&&!force){ _aiP.then(d=>paintAiNews(d)).catch(()=>failLive('ai')); return; }
  const url='https://api.allorigins.win/raw?url='+encodeURIComponent('https://hnrss.org/frontpage');
  const run=()=> (typeof fetch==='function'?fetch(url).then(r=>r.text()):Promise.reject(0))
    .then(xml=>{ const doc=new DOMParser().parseFromString(xml,'text/xml');
      const items=[...doc.querySelectorAll('item')].slice(0,12).map(it=>({t:(it.querySelector('title')||{}).textContent||'',u:(it.querySelector('link')||{}).textContent||''})).filter(x=>x.t&&x.u);
      if(!items.length) throw 0; setLiveCache('ainews',items); return items; })
    .catch(()=>{ const c2=liveCache('ainews'); if(c2) return c2.data; throw 0; });
  _aiP=run();
  _aiP.then(d=>paintAiNews(d)).catch(()=>failLive('ai','科技资讯获取失败，已保留精选内容 🤖',loadAiNews));
}
function paintAiNews(items){
  paintLiveBody('ai', items.map(n=>`
    <div class="news-item"><div class="news-n">🔗</div>
    <div style="flex:1;min-width:0"><div class="news-t"><a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a></div>
    <div class="news-m"><span class="pill sky" style="font-size:10px;padding:2px 7px">Hacker News</span></div></div></div>`).join(''));
  bindLiveBox('ai',loadAiNews);
}

/* 通用实时资讯流（Google 新闻 RSS 关键词搜索，经 allorigins 代理，中文真实内容）
   覆盖任意主题板块：减肥运动 / 播客 / 表达 / 穿搭 / 洛克 / 育儿。抓不到回退精选。 */
const NEWSFEED={
  fit:'减肥 运动 健身 减脂 塑形',
  pod:'播客 推荐 订阅 收听',
  speech:'沟通 表达 技巧 口才 演讲',
  style:'穿搭 妆容 时尚 护肤 美妆',
  roco:'洛克王国 世界 攻略 活动',
  baby:'育儿 亲子 早教 辅食'
};
let _nf={};
function loadNewsFeed(sec,force){
  const q=NEWSFEED[sec]; if(!q) return;
  const c=liveCache('nf:'+sec);
  if(!force&&c&&Date.now()-c.time<3600000){ paintNewsFeed(sec,c.data); return; }
  if(_nf[sec]&&!force){ _nf[sec].then(d=>paintNewsFeed(sec,d)).catch(()=>failLive(sec)); return; }
  const api='https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=zh-CN&gl=CN&ceid=CN:zh-Hans';
  const url='https://api.allorigins.win/raw?url='+encodeURIComponent(api);
  const run=()=> (typeof fetch==='function'?fetch(url).then(r=>r.text()):Promise.reject(0))
    .then(xml=>{ const doc=new DOMParser().parseFromString(xml,'text/xml');
      const items=[...doc.querySelectorAll('item')].slice(0,10).map(it=>{
        const t=(it.querySelector('title')||{}).textContent||'';
        const u=(it.querySelector('link')||{}).textContent||'';
        const s=(it.querySelector('source')||{}).textContent||'';
        return {t,u,s}; }).filter(x=>x.t&&x.u);
      if(!items.length) throw 0; setLiveCache('nf:'+sec,items); return items; })
    .catch(()=>{ const c2=liveCache('nf:'+sec); if(c2) return c2.data; throw 0; });
  _nf[sec]=run();
  _nf[sec].then(d=>paintNewsFeed(sec,d)).catch(()=>failLive(sec,'实时资讯获取失败，已为你保留精选内容 🌟',()=>loadNewsFeed(sec,true)));
}
function paintNewsFeed(sec,items){
  paintLiveBody(sec, items.map((n,i)=>{
    const m=n.t.match(/\s[-–—]\s(.+)$/);
    const head=m?n.t.slice(0,n.t.length-m[0].length):n.t;
    const source=m?m[1]:(n.s||'');
    return `<div class="news-item"><div class="news-n">${i+1}</div>
      <div style="flex:1;min-width:0"><div class="news-t"><a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(head)}</a></div>
      <div class="news-m">${source?`<span class="pill violet" style="font-size:10px;padding:2px 7px">${esc(source)}</span> `:''}<span class="tiny muted">Google 新闻</span></div></div></div>`;
  }).join(''));
  bindLiveBox(sec,()=>loadNewsFeed(sec,true));
}

/* 每日 9:00 更新的真实中医 / 针灸内容
   数据来源：本草典 Bencao Dian (bencaodian.org)，CC BY-SA 4.0 开源数据集
   —— 内置真实精选（离线可用），联网时尝试抓取全量真实数据覆盖。 */
function dailySlot(ts){
  const d=new Date(ts||Date.now());
  if(d.getHours()<9) d.setDate(d.getDate()-1);   // 9 点前仍属上一批次
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dailyPick(pool){
  const s=dailySlot(); let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return pool[h%pool.length];
}

function loadTcmDaily(force){
  const sec='tcm', slot=dailySlot();
  const render=(pool,src)=>{ const item=dailyPick(pool); paintTcmDaily(item,slot,src); };
  const cached=DB.get('live:tcmdaily',null);
  if(!force&&cached&&cached.slot===slot&&Array.isArray(cached.data)&&cached.data.length){ render(cached.data,'实时'); return; }
  render(TCM_DAILY,'精选');                 // 同步先出真实精选，保证不空白
  if(typeof fetch!=='function') return;
  const url='https://api.allorigins.win/raw?url='+encodeURIComponent('https://bencaodian.org/data/v1/concepts.json');
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),12000);
  fetch(url,{signal:c.signal}).then(r=>r.json()).then(j=>{ clearTimeout(t);
    if(Array.isArray(j)&&j.length){ DB.set('live:tcmdaily',{slot,data:j}); toast('已抓取本草典实时理论 🌿'); render(j,'实时'); }
  }).catch(()=>clearTimeout(t));
}
function paintTcmDaily(item,slot,src){
  const sec='tcm';
  const html=`<div class="icard daily">
    <div class="daily-top"><span class="pill amber">🌿 ${esc(item.title||'今日养生')}</span>
      <span class="daily-date">每日 9:00 更新 · ${slot}</span></div>
    <div class="ic-body" style="margin-top:9px;line-height:1.85;font-size:14px;color:#5b4636">${esc(item.body||'')}</div>
    <div class="ic-foot" style="margin-top:11px">
      <button class="plat" data-tcmfav="${esc(item.title||'')}">⭐ 收藏</button>
      <span class="tiny muted">来源：本草典 ${src==='实时'?'· 实时抓取':'· 开源精选'}</span>
    </div></div>`;
  paintLiveBody(sec,html);
  bindLiveBox(sec,loadTcmDaily);
  const b=document.querySelector('#live-'+sec+' [data-tcmfav]');
  if(b) b.onclick=()=>{ const on=toggleFav({key:'tcmd::'+item.title,sec:'中医养生',t:item.title,s:item.body||'',k:'',plat:[]}); b.textContent=on?'★ 已收藏':'⭐ 收藏'; };
}

function loadAcupDaily(force){
  const sec='acup', slot=dailySlot();
  const render=(pool,src)=>{ const item=dailyPick(pool); paintAcupDaily(item,slot,src); };
  const cached=DB.get('live:acupdaily',null);
  if(!force&&cached&&cached.slot===slot&&Array.isArray(cached.data)&&cached.data.length){ render(cached.data,'实时'); return; }
  render(ACUP_DAILY,'精选');
  if(typeof fetch!=='function') return;
  const url='https://api.allorigins.win/raw?url='+encodeURIComponent('https://bencaodian.org/data/v1/acupoints.json');
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),15000);
  fetch(url,{signal:c.signal}).then(r=>r.json()).then(j=>{ clearTimeout(t);
    if(Array.isArray(j)&&j.length){ DB.set('live:acupdaily',{slot,data:j}); toast('已抓取本草典实时穴位 📍'); render(j,'实时'); }
  }).catch(()=>clearTimeout(t));
}
function paintAcupDaily(item,slot,src){
  const sec='acup';
  const ind=(Array.isArray(item.indications)?item.indications.map(x=>typeof x==='string'?x:(x.zh||x.en||'')).join('；'):(item.ind||'')).slice(0,90);
  const act=(Array.isArray(item.actions)?item.actions.map(x=>typeof x==='string'?x:(x.zh||x.en||'')).join('；'):(item.act||'')).slice(0,50);
  const loc=(typeof item.location==='string')?item.location:(item.location_zh||item.loc||'');
  const desc=item.description_zh||item.desc||'';
  const html=`<div class="icard daily">
    <div class="daily-top"><span class="pill amber">📍 ${esc(item.name_zh||item.name||'今日穴位')}
      <span class="muted" style="font-weight:400">${esc(item.code||'')}${item.meridian_zh||item.mer?' · '+(item.meridian_zh||item.mer):''}</span></span>
      <span class="daily-date">每日 9:00 更新 · ${slot}</span></div>
    <div class="acu-grid">
      <div><span class="ag-k">定位</span><span class="ag-v">${esc(loc)}</span></div>
      <div><span class="ag-k">主治</span><span class="ag-v">${esc(ind)}</span></div>
      <div><span class="ag-k">功效</span><span class="ag-v">${esc(act)}</span></div>
    </div>
    <div class="ic-body" style="margin-top:9px;line-height:1.8;font-size:13.5px;color:#5b4636">${esc(desc)}</div>
    <div class="ic-foot" style="margin-top:11px">
      <button class="plat" data-acupfav="${esc(item.name_zh||item.name||'')}">⭐ 收藏</button>
      <span class="tiny muted">来源：本草典 ${src==='实时'?'· 实时抓取':'· 开源精选'}</span>
    </div></div>`;
  paintLiveBody(sec,html);
  bindLiveBox(sec,loadAcupDaily);
  const b=document.querySelector('#live-'+sec+' [data-acupfav]');
  if(b) b.onclick=()=>{ const on=toggleFav({key:'acupd::'+(item.name_zh||item.name),sec:'针灸知识',t:item.name_zh||item.name,s:desc,k:'',plat:[]}); b.textContent=on?'★ 已收藏':'⭐ 收藏'; };
}

/* ============================================================
   6. 路由与渲染
   ============================================================ */
function currentId(){
  const h=(location.hash||'').replace('#/','');
  return MENUS.some(m=>m.id===h)?h:'plan';
}
function paintRail(){
  $('#railNav').innerHTML=MENUS.map(m=>`<button class="rail-item ${m.id===currentId()?'active':''}" data-go="${m.id}">
    <span class="ri-ico">${m.ico}</span><span class="ri-txt">${m.n}</span></button>`).join('');
  $$('#railNav [data-go]').forEach(b=>b.onclick=()=>{
    location.hash='#/'+b.dataset.go; closeRail();
  });
}
function closeRail(){ $('#rail').classList.remove('open'); $('#railMask').classList.remove('show'); }

const HEADS={
 fit:`<div class="card flat" style="padding:13px;background:var(--red-tint);border-color:transparent">
   <div class="tiny" style="line-height:1.75;color:#8E2A3C"><b>今日建议</b>：瘦脸操 1 组（10 分钟）+ 腹部训练 1 组（8–10 分钟）+ 睡前拉伸。<br>
   坚持比强度重要，先做到「每天都做」，再考虑加量。</div></div>`,
 speech:`<div class="card flat" style="padding:13px;background:var(--mint-tint);border-color:transparent">
   <div class="tiny" style="line-height:1.75;color:#256B5B"><b>怎么练</b>：① 默读一遍理解结构；② 出声朗读 3 遍；③ 合上屏幕复述；④ 用「🎙 跟读录音」录一遍回听。<br>
   每天一篇，21 天后你会明显感觉到说话变有条理。</div></div>`,
 tcm:`<div class="card flat" style="padding:13px;background:var(--amber-tint);border-color:transparent">
   <div class="tiny" style="line-height:1.75;color:#8C5716"><b>温馨提示</b>：本栏目为养生科普，不能替代医生诊断。有明确不适请及时就医，体质辨识建议咨询正规中医师。</div></div>`,
 acup:`<div class="card flat" style="padding:13px;background:var(--amber-tint);border-color:transparent">
   <div class="tiny" style="line-height:1.75;color:#8C5716"><b>安全提示</b>：针刺操作必须由有资质的执业医师完成，本栏目仅作常识科普。穴位按摩可自行进行，孕妇请特别注意禁忌穴位。</div></div>`
};

/* ---------------- 路由与渲染 ---------------- */
function render(){
  const id=currentId(), m=MENUS.find(x=>x.id===id);
  $('#pageTitle').textContent=m.n;
  $('#pageSub').textContent=m.sub;
  paintRail();
  const v=$('#view');
  let html='';
  switch(id){
    case 'plan':  html=pagePlan(); break;
    case 'en':    html=pageEn(); break;
    case 'wx':    html=pageWx(); break;
    case 'news':  html=pageNews(); break;
    case 'fit':   html=liveBox('fit','💪 实时健身 · 减肥资讯')+groupPage('fit',FITNESS,{head:HEADS.fit}); break;
    case 'pod':   html=liveBox('pod','🎧 实时播客推荐')+groupPage('pod',PODCASTS,{daily:3}); break;
    case 'speech':html=liveBox('speech','🗣️ 实时表达提升')+groupPage('speech',SPEECH,{daily:2,head:HEADS.speech}); break;
    case 'tcm':   html=liveBox('tcm','🌿 今日中医养生')+groupPage('tcm',TCM,{head:HEADS.tcm,keywords:['中医养生 食疗','艾灸 入门 教程','祛湿 食疗 做法','十二时辰 养生','八段锦 完整版','中医 体质辨识','养生粥 做法','泡脚 配方']}); break;
    case 'acup':  html=liveBox('acup','📍 今日穴位')+groupPage('acup',ACUP,{head:HEADS.acup,keywords:['穴位 定位 教学','合谷穴 按摩','足三里 艾灸','三阴交 女性','经络 推拿 手法','针灸 科普','拔罐 刮痧 区别','颈椎 理疗 自我按摩']}); break;
    case 'book':  html=liveBox('book','📚 实时热门书单')+groupPage('book',BOOKS,{daily:2}); break;
    case 'style': html=liveBox('style','💄 实时穿搭 · 美妆')+groupPage('style',STYLE,{daily:3}); break;
    case 'viral': html=liveBox('viral','🔥 实时热搜 · 爆款选题')+groupPage('viral',VIRAL,{daily:3}); break;
    case 'roco':  html=liveBox('roco','🎮 洛克王国 实时动态')+groupPage('roco',ROCO,{keywords:['洛克王国世界 攻略','洛克王国 精灵 培养','洛克王国世界 活动','洛克王国 属性克制','洛克王国世界 新手','洛克王国 稀有精灵']}); break;
    case 'ai':    html=liveBox('ai','🤖 科技·AI 实时资讯')+groupPage('ai',AILEARN,{daily:2,keywords:['WorkBuddy 使用教程','AI 动漫制作 教程','AI 绘画 零基础','普通人 学 AI','AI 短视频 制作','提示词 写法']}); break;
    case 'baby':  html=liveBox('baby','🍼 实时育儿资讯')+groupPage('baby',PARENT,{keywords:['科学育儿 知识','辅食 添加 顺序','幼儿 专注力 培养','正面管教 方法','儿童 发热 护理','入园 分离焦虑']}); break;
  }
  v.innerHTML=html;
  window.scrollTo({top:0});

  if(id==='plan') bindPlan();
  else if(id==='en') bindEn();
  else if(id==='wx') loadWx();
  else if(id==='news') loadNews();
  if(id==='plan'||id==='viral') loadHot(id);
  if(id==='en') loadEnQuote();
  if(id==='book') loadBooks();
  if(id==='ai') loadAiNews();
  if(id==='tcm') loadTcmDaily();
  if(id==='acup') loadAcupDaily();
  if(id==='fit') loadNewsFeed('fit');
  if(id==='pod') loadNewsFeed('pod');
  if(id==='speech') loadNewsFeed('speech');
  if(id==='style') loadNewsFeed('style');
  if(id==='roco') loadNewsFeed('roco');
  if(id==='baby') loadNewsFeed('baby');
  bindCommon();
  paintFavCount();
}

function bindCommon(){
  const v=$('#view');
  v.querySelectorAll('[data-seg]').forEach(b=>b.onclick=()=>{
    DB.set('seg:'+currentId(),b.dataset.seg); render();
  });
  v.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>{
    const it=JSON.parse(b.dataset.fav);
    const on=toggleFav(it); b.classList.toggle('on',on); b.textContent=on?'★':'☆';
  });
  /* 今日份新内容合辑：跳到对应栏目 */
  v.querySelectorAll('button[data-go]').forEach(b=>b.onclick=()=>{
    location.hash='#/'+b.dataset.go;
    window.scrollTo(0,0);
  });
  v.querySelectorAll('[data-kw]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.kw;
    openModal('搜索「'+k+'」',`<div class="card"><div class="tiny muted" style="margin-bottom:11px">选择一个平台打开检索结果</div>
      <div class="wrap">${platBtns(k,['bili','dy'])}</div></div>`);
  });
  v.querySelectorAll('[data-say]').forEach(b=>{ if(!b.onclick) b.onclick=()=>speak(b.dataset.say,'en-US'); });

  /* 视频卡现在直接内嵌 B 站播放器，播放键即 B 站原生键，点击一次即可播放（无需再懒加载） */

  /* 表达练习：中文跟读 */
  if(currentId()==='speech'){
    v.querySelectorAll('.icard').forEach(card=>{
      if(card.querySelector('[data-mic]')) return;
      const foot=card.querySelector('.ic-foot'); if(!foot) return;
      const txt=(card.querySelector('.ic-body')||{}).innerText||'';
      const clean=txt.replace(/练习要点[\s\S]*$/,'').replace(/\s+/g,' ').trim().slice(0,120);
      const b=document.createElement('button');
      b.className='plat wx'; b.textContent='🎙 跟读录音';
      const out=document.createElement('div'); out.className='mic-out'; card.appendChild(out);
      b.onclick=()=>recordCompare(clean,'zh-CN',b,out);
      foot.insertBefore(b,foot.querySelector('.fav-t'));
    });
  }
  /* 中医 / 针灸：笔记 */
  if(currentId()==='tcm'||currentId()==='acup'){
    v.querySelectorAll('.icard').forEach(card=>{
      const foot=card.querySelector('.ic-foot'); if(!foot||foot.querySelector('.note-b')) return;
      const tEl=card.querySelector('.ic-t'); if(!tEl) return;   // 每日卡片无 .ic-t，跳过
      const title=tEl.textContent;
      const b=document.createElement('button');
      b.className='plat note-b'; b.textContent='📝 写笔记';
      b.onclick=()=>noteEditor(currentId()==='tcm'?'中医养生':'针灸知识',title);
      foot.insertBefore(b,foot.querySelector('.fav-t'));
    });
  }
}

/* ---------------- 笔记编辑 ---------------- */
function noteEditor(sec,title){
  const list=notes(); const ex=list.find(n=>n.title===title);
  openModal('养生笔记 · '+title,
    `<div class="card"><textarea class="note-area" id="ntArea" placeholder="记下你的体会、体质反应、调理效果…">${ex?esc(ex.text):''}</textarea>
     <div class="row" style="margin-top:11px;gap:8px">
       <button class="btn" id="ntSave" style="flex:1">保存到收藏夹</button>
       ${ex?'<button class="btn grey sm" id="ntDel">删除</button>':''}
     </div></div>`);
  $('#ntSave').onclick=()=>{
    const t=$('#ntArea').value.trim(); if(!t){ toast('内容不能为空'); return; }
    let l=notes(); const i=l.findIndex(n=>n.title===title);
    const obj={id:ex?ex.id:'n'+Date.now(),sec:sec,title:title,text:t,time:Date.now()};
    if(i>=0) l[i]=obj; else l.unshift(obj);
    DB.set('notes',l); paintFavCount(); closeModal(); toast('笔记已保存 📝');
  };
  const dl=$('#ntDel'); if(dl) dl.onclick=()=>{
    DB.set('notes',notes().filter(n=>n.title!==title)); paintFavCount(); closeModal(); toast('已删除');
  };
}

/* ---------------- 收藏夹 ---------------- */
let favTab='全部';
function openFav(){
  $('#favSheet').classList.add('show'); paintFav();
}
function paintFav(){
  const f=favs(), n=notes();
  const secs=[...new Set(f.map(x=>x.sec))];
  const tabs=['全部'].concat(secs).concat(n.length?['养生笔记']:[]);
  $('#favTabs').innerHTML=tabs.map(t=>`<button class="seg ${t===favTab?'on':''}" data-ftab="${esc(t)}">${esc(t)}</button>`).join('');
  let html='';
  if(favTab==='养生笔记'){
    html=n.length?n.map(x=>`<div class="icard">
      <div class="ic-t">${esc(x.title)}</div>
      <div class="ic-s">${esc(x.sec)} · ${new Date(x.time).toLocaleDateString('zh-CN')}</div>
      <div class="ic-body" style="white-space:pre-wrap">${esc(x.text)}</div>
      <div class="ic-foot"><button class="plat" data-nedit="${esc(x.title)}" data-nsec="${esc(x.sec)}">编辑</button>
      <button class="plat" data-ndel="${esc(x.id)}">删除</button></div></div>`).join('')
      :emptyMascot('还没有养生笔记','在「中医养生」或「针灸知识」里，点卡片的笔记按钮就能记下来哦');
  }else{
    const list=favTab==='全部'?f:f.filter(x=>x.sec===favTab);
    html=list.length?list.map(x=>`<div class="icard">
      <div class="ic-t">${esc(x.t)}</div>
      ${x.s?`<div class="ic-s">${esc(x.s)}</div>`:''}
      <div class="ic-foot">
        <span class="pill grey">${esc(x.sec)}</span>
        ${x.k?platBtns(x.k,x.plat&&x.plat.length?x.plat:['bili','dy']):''}
        <button class="fav-t on" data-unfav="${esc(x.key)}" style="margin-left:auto">★</button>
      </div></div>`).join('')
      :emptyMascot('还没有收藏内容','在任意卡片右下角点 ☆ 就能收进来，小星星帮你存好～');
    if(favTab==='全部'&&n.length) html+=`<div class="sec-title">养生笔记 ${n.length}</div>`+
      n.slice(0,3).map(x=>`<div class="icard"><div class="ic-t">${esc(x.title)}</div>
        <div class="ic-body" style="white-space:pre-wrap">${esc(x.text.slice(0,80))}${x.text.length>80?'…':''}</div></div>`).join('');
  }
  $('#favBody').innerHTML=html;
  $$('#favTabs [data-ftab]').forEach(b=>b.onclick=()=>{ favTab=b.dataset.ftab; paintFav(); });
  $$('#favBody [data-unfav]').forEach(b=>b.onclick=()=>{
    DB.set('favs',favs().filter(x=>x.key!==b.dataset.unfav)); paintFavCount(); paintFav(); render(); toast('已取消收藏');
  });
  $$('#favBody [data-ndel]').forEach(b=>b.onclick=()=>{
    DB.set('notes',notes().filter(x=>x.id!==b.dataset.ndel)); paintFavCount(); paintFav(); toast('已删除');
  });
  $$('#favBody [data-nedit]').forEach(b=>b.onclick=()=>{
    $('#favSheet').classList.remove('show'); noteEditor(b.dataset.nsec,b.dataset.nedit);
  });
}

/* ---------------- 弹窗 ---------------- */
function openModal(title,html){ $('#modalTitle').textContent=title; $('#modalBody').innerHTML=html; $('#modal').classList.add('show'); }
function closeModal(){ $('#modal').classList.remove('show'); }

/* ---------------- 启动 ---------------- */
function init(){
  paintRail();
  $('#menuBtn').onclick=()=>{ $('#rail').classList.toggle('open'); $('#railMask').classList.toggle('show'); };
  $('#railToggle').onclick=()=>{ $('#rail').classList.toggle('open'); $('#railMask').classList.toggle('show',$('#rail').classList.contains('open')); };
  $('#railMask').onclick=closeRail;
  $('#favBtn').onclick=openFav;
  $('#favClose').onclick=()=>$('#favSheet').classList.remove('show');
  $('#modalClose').onclick=closeModal;
  $('#favSheet').onclick=e=>{ if(e.target.id==='favSheet') $('#favSheet').classList.remove('show'); };
  $('#modal').onclick=e=>{ if(e.target.id==='modal') closeModal(); };
  $('#refreshBtn').onclick=()=>refreshDaily(false);   // 顶栏手动刷新今日内容
  window.addEventListener('hashchange',()=>{ enPos=0; render(); });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){ try{speechSynthesis.cancel();}catch(e){} stopRec(); }
    else { refreshDaily(true); }   // 手机切回标签页：静默拉取最新每日内容并重绘
  });
  $('#footNote').textContent='自媒体创作工作台 · 数据保存在本机 · '+TODAY;
  _dailySig=dailySig(window.DAILY);   // 记录初始签名，避免首次重复刷新
  render();
  /* 每 5 分钟静默检查一次每日新内容（后台标签页也会生效） */
  setInterval(()=>refreshDaily(true), 5*60*1000);
  /* 后台预热天气与新闻缓存 */
  setTimeout(()=>{ const c=DB.get('wx',null); if(!c||Date.now()-c.time>3600000) fetch('https://api.open-meteo.com/v1/forecast?latitude=31.6538&longitude=120.7526&current=temperature_2m,weather_code&timezone=Asia%2FShanghai').catch(()=>{}); },1500);

  /* 睡觉提醒（页面打开时生效） */
  setInterval(()=>{
    const n=new Date(), d=dstr(n);
    if(n.getHours()===22&&n.getMinutes()>=30&&!DB.get('slept:'+d,0)){
      DB.set('slept:'+d,1);
      toast('🌙 22:30 啦，该准备睡觉了');
      if(DB.get('notify',0)&&'Notification' in window&&Notification.permission==='granted'){
        try{ new Notification('该睡觉啦 🌙',{body:'22:30 睡觉提醒 · 早睡是最便宜的医美'}); }catch(e){}
      }
    }
  },30000);
}
document.addEventListener('DOMContentLoaded',init);
})();
