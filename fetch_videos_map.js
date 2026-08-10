/* 按「内容条目」1:1 抓取主题一致的 B 站视频，生成 data-videos.js
   - window.VIDEO_MAP：key = "<sec>|<标题>"，值 = 与该条内容主题一致的视频
   - window.VIDEOS   ：栏目级兜底池
   策略：条目关键词搜索 → 查询降级（搜空就减词）→ 领域词守卫（防跑题）→ 二次校正
   支持断点续跑：中间结果写入 .video-cache.json */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MIXIN_ENC = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
const getMixinKey = o => { let s=''; for(const i of MIXIN_ENC) s+=o[i]; return s.slice(0,32); };
const md5 = s => crypto.createHash('md5').update(s,'utf8').digest('hex');

let BUVID='', MIXIN='';
async function ensureSession(){
  const home = await fetch('https://www.bilibili.com',{headers:{'User-Agent':UA,'Accept-Language':'zh-CN,zh;q=0.9'}});
  const sc = home.headers.getSetCookie ? home.headers.getSetCookie() : [];
  const b3 = sc.find(c=>c.includes('buvid3'));
  BUVID = b3 ? b3.split(';')[0] : '';
  const nav = await fetch('https://api.bilibili.com/x/web-interface/nav',{headers:{'User-Agent':UA,'Referer':'https://www.bilibili.com','Cookie':BUVID}});
  const nj = await nav.json();
  const img=(nj.data.wbi_img.img_url||'').split('/').pop().split('.')[0];
  const sub=(nj.data.wbi_img.sub_url||'').split('/').pop().split('.')[0];
  MIXIN = getMixinKey(img+sub);
}
function sign(params){
  const p=Object.assign({},params,{wts:Math.floor(Date.now()/1000)});
  const keys=Object.keys(p).sort(); let q='';
  for(const k of keys) q+=(q?'&':'')+k+'='+encodeURIComponent(p[k]);
  return q+'&w_rid='+md5(q+MIXIN);
}
const strip = s => String(s||'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const fixCover = p => !p ? '' : p.startsWith('//') ? 'https:'+p : p.startsWith('http://') ? 'https://'+p.slice(7) : p;

async function search(kw){
  const params={search_type:'video',keyword:kw,page:1,order:'totalrank',web_location:'333.1007'};
  const res=await fetch('https://api.bilibili.com/x/web-interface/wbi/search/type?'+sign(params),{
    headers:{'User-Agent':UA,'Referer':'https://search.bilibili.com','Origin':'https://www.bilibili.com','Cookie':BUVID}
  });
  if(!res.ok) throw new Error('HTTP '+res.status);
  const txt=await res.text();
  let j; try{ j=JSON.parse(txt); }catch(e){ throw new Error('JSON:'+txt.slice(0,70)); }
  if(j.code!==0) throw new Error('code '+j.code);
  return (Array.isArray(j.data.result)?j.data.result:[])
    .filter(x=>x.bvid && x.title)
    .map(x=>({bv:x.bvid,t:strip(x.title),up:strip(x.author||''),cover:fixCover(x.pic),play:x.play||0}));
}
async function robustSearch(kw){
  for(let i=0;i<3;i++){
    try{ return await search(kw); }
    catch(e){
      if(i===1){ try{ await ensureSession(); }catch(_){ } }
      await new Promise(r=>setTimeout(r, 900+i*700));
    }
  }
  return [];
}
/* 查询降级：搜不到就从尾部减词，最少保留 1 个词 */
async function degradeSearch(query){
  const words=String(query).split(/\s+/).filter(Boolean);
  for(let n=words.length; n>=1; n--){
    const q=words.slice(0,n).join(' ');
    const list=await robustSearch(q);
    if(list.length) return {list, used:q};
    await new Promise(r=>setTimeout(r,320));
  }
  return {list:[], used:query};
}

/* 中文 2-gram + 英文单词切词，用于相关性打分 */
function tokens(s){
  const out=new Set();
  const clean=String(s||'').replace(/[《》「」【】·、,，。？！?!:：;；\-—~～\/|()（）\[\]"'’“”]/g,' ');
  clean.split(/\s+/).filter(Boolean).forEach(seg=>{
    if(/^[a-zA-Z0-9']+$/.test(seg)){ out.add(seg.toLowerCase()); return; }
    if(seg.length===1){ out.add(seg); return; }
    for(let i=0;i<seg.length-1;i++) out.add(seg.slice(i,i+2));
  });
  return out;
}
function relScore(qTok, title){
  const tTok=tokens(title); let hit=0;
  for(const t of qTok) if(tTok.has(t)) hit++;
  return qTok.size ? hit/qTok.size : 0;
}
/* 领域词守卫：标题里必须带本栏目的领域词，否则判为跑题 */
const DOMAIN={
  speech:['表达','口才','沟通','说话','演讲','聊天','话术','社交','情商'],
  tcm:['中医','养生','食疗','艾灸','调理','中药','气血','体质','经络','汤','粥','穴'],
  acup:['穴','针灸','按摩','经络','艾灸','推拿','刮痧','拔罐','中医'],
  book:['书','读','阅读','解读','文学','小说','作者','讲书'],
  style:['妆','穿搭','美妆','化妆','发型','搭配','衣','时尚','护肤','教程'],
  viral:['视频','文案','脚本','拍摄','剪辑','爆款','运营','流量','账号','博主','自媒体'],
  ai:['ai','人工智能','大模型','提示词','prompt','chatgpt','工具','教程','智能体'],
  baby:['育儿','宝宝','孩子','婴儿','辅食','带娃','儿童','妈妈','幼儿','新生儿','早教'],
  fit:['减肥','健身','运动','瘦','燃脂','瑜伽','训练','拉伸','塑形','操','有氧'],
  en:['英语','单词','口语','发音','外语','english','美语','词汇']
};
function domScore(sec,title){
  const low=String(title).toLowerCase();
  return (DOMAIN[sec]||[]).some(k=>low.includes(k.toLowerCase())) ? 1 : 0;
}
/* 挑最一致的一条：领域优先 → 相关性 → 播放量；同栏目内尽量不重复 */
function pickBest(list, query, sec, used){
  const qTok=tokens(query);
  const scored=list.map(v=>{
    const rel=relScore(qTok,v.t), dom=domScore(sec,v.t);
    return {v,rel,dom,total:rel+dom*0.45};
  }).sort((a,b)=> b.total-a.total || (b.v.play||0)-(a.v.play||0));
  const fresh=scored.filter(x=>!used.has(x.v.bv));
  const pool=fresh.length?fresh:scored;
  return pool.length?pool[0]:null;
}

/* ---------- 载入内容数据 ---------- */
const base=path.join(__dirname,'assets','js');
const src=['data-english.js','data-content.js','data-tcm.js'].map(f=>fs.readFileSync(path.join(base,f),'utf8')).join('\n;\n');
let DATA;
eval(src + '\nDATA={SPEECH,TCM,ACUP,BOOKS,STYLE,VIRAL,AILEARN,PARENT,FITNESS,WORDS,PHRASES};');

const SEC_OF={speech:'SPEECH',tcm:'TCM',acup:'ACUP',book:'BOOKS',style:'STYLE',viral:'VIRAL',ai:'AILEARN',baby:'PARENT',fit:'FITNESS'};
const HINT={speech:'口才 表达',tcm:'中医 养生',acup:'穴位 针灸',book:'解读 读书',style:'妆容 穿搭',viral:'短视频 教程',ai:'AI 教程',baby:'育儿',fit:'健身 减肥'};
/* 标题清洗成可搜索的核心词 */
function core(t){
  return String(t).replace(/^第\d+步[：:]/,'').replace(/[《》「」【】·、,，。？！?!:：;；\/|()（）\[\]"'’“”]/g,' ')
    .replace(/\s+/g,' ').trim().split(' ').slice(0,3).join(' ');
}

const jobs=[];
for(const [sec,varName] of Object.entries(SEC_OF)){
  (DATA[varName]||[]).forEach(it=>{
    const q = (it.k && it.k.trim()) ? it.k.trim() : (HINT[sec]+' '+core(it.t));
    jobs.push({sec, key:sec+'|'+it.t, query:q, alt:HINT[sec]+' '+core(it.t), label:it.t});
  });
}
(DATA.WORDS||[]).forEach(w=>{
  jobs.push({sec:'en', key:'en|'+w.w, query:'英语单词 '+w.w, alt:'英语 '+w.w+' 用法', label:'word:'+w.w});
});
(DATA.PHRASES||[]).forEach(p=>{
  jobs.push({sec:'en', key:'en|say|'+p.en, query:'英语口语 '+core(p.cn||p.en), alt:'英语口语 常用表达', label:'say:'+String(p.en).slice(0,18)});
});

const POOL_KW={speech:'沟通表达 口才 演讲 练习',tcm:'中医养生 食疗 艾灸 八段锦',acup:'针灸 穴位 按摩 科普',book:'读书推荐 好书分享 书单',style:'穿搭 妆容 美妆 教程',viral:'短视频 爆款 二创 教程',ai:'AI 人工智能 教程 入门',baby:'育儿 早教 辅食 科普',fit:'减肥 运动 健身 减脂',en:'英语 口语 零基础 入门'};

const CACHE=path.join(__dirname,'.video-cache.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE,'utf8')) : {map:{},pool:{}};

(async()=>{
  await ensureSession();
  console.log('session ok. 任务数:', jobs.length, '已缓存:', Object.keys(cache.map).length);

  for(const [sec,kw] of Object.entries(POOL_KW)){
    if(cache.pool[sec] && cache.pool[sec].length) continue;
    const {list}=await degradeSearch(kw);
    cache.pool[sec]=list.slice(0,8).map(({bv,t,up,cover})=>({bv,t,up,cover}));
    console.log('[池]',sec,cache.pool[sec].length);
    await new Promise(r=>setTimeout(r,350));
  }
  fs.writeFileSync(CACHE,JSON.stringify(cache),'utf8');

  const usedBySec={};
  Object.entries(cache.map).forEach(([k,v])=>{
    const s=k.split('|')[0]; (usedBySec[s]=usedBySec[s]||new Set()).add(v.bv);
  });

  let done=0, miss=0, weak=0;
  for(const job of jobs){
    done++;
    if(cache.map[job.key]) continue;
    const used=usedBySec[job.sec]=usedBySec[job.sec]||new Set();
    let r=await degradeSearch(job.query);
    let best=pickBest(r.list, job.query, job.sec, used);
    /* 跑题校正：领域词没命中就用「领域词 + 标题核心」再搜一次 */
    if((!best || best.dom===0) && job.alt && job.alt!==job.query){
      await new Promise(r2=>setTimeout(r2,320));
      const r2=await degradeSearch(job.alt);
      const b2=pickBest(r2.list, job.alt, job.sec, used);
      if(b2 && (!best || b2.dom>best.dom || (b2.dom===best.dom && b2.total>best.total))) best=b2;
    }
    if(best){
      cache.map[job.key]={bv:best.v.bv,t:best.v.t,up:best.v.up,cover:best.v.cover};
      used.add(best.v.bv);
      if(best.dom===0) weak++;
    }else miss++;
    if(done%15===0 || !best){
      console.log(`[${done}/${jobs.length}] ${job.sec} ${job.label.slice(0,20)} -> ${best?best.v.t.slice(0,26):'MISS'}`);
      fs.writeFileSync(CACHE,JSON.stringify(cache),'utf8');
    }
    await new Promise(r3=>setTimeout(r3, 600));
  }
  fs.writeFileSync(CACHE,JSON.stringify(cache),'utf8');
  console.log('完成。匹配', Object.keys(cache.map).length, '条 / 失败', miss, '/ 弱匹配', weak);

  const js='/* 自动抓取的真实 B 站视频\n   VIDEO_MAP: 与每条内容主题一致的视频（key = 栏目|标题）\n   VIDEOS   : 栏目兜底池。版权归原作者所有 */\n'
    +'window.VIDEO_MAP = '+JSON.stringify(cache.map)+';\n'
    +'window.VIDEOS = '+JSON.stringify(cache.pool)+';\n';
  fs.writeFileSync(path.join(base,'data-videos.js'), js, 'utf8');
  console.log('已写入 data-videos.js，大小', (js.length/1024).toFixed(1),'KB');
})();
