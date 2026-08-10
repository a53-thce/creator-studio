/* 定向校正：找出与内容明显不一致的匹配，重搜替换
   规则：
   1) 相关性过低（标题与关键词几乎不沾边）
   2) 命中黑名单（有声书/英文原版等，book 栏目除外）
   3) style 栏目按「UP主名」强制对齐（内容本身就是博主名） */
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const S=fs.readFileSync(path.join(__dirname,'fetch_videos_map.js'),'utf8');
eval(S.split('/* ---------- 载入内容数据 ---------- */')[0].replace(/^\/\*[\s\S]*?\*\//,''));

const base=path.join(__dirname,'assets','js');
const src=['data-english.js','data-content.js','data-tcm.js'].map(f=>fs.readFileSync(path.join(base,f),'utf8')).join('\n;\n');
let DATA; eval(src+'\nDATA={SPEECH,TCM,ACUP,BOOKS,STYLE,VIRAL,AILEARN,PARENT,FITNESS,WORDS,PHRASES};');
const SEC_OF={speech:'SPEECH',tcm:'TCM',acup:'ACUP',book:'BOOKS',style:'STYLE',viral:'VIRAL',ai:'AILEARN',baby:'PARENT',fit:'FITNESS'};
const HINT={speech:'口才 表达',tcm:'中医 养生',acup:'穴位 针灸',book:'解读 读书',style:'妆容 教程',viral:'短视频 教程',ai:'AI 教程',baby:'育儿',fit:'健身 减肥'};
function core(t){
  return String(t).replace(/^第\d+步[：:]/,'').replace(/[《》「」【】·、,，。？！?!:：;；\/|()（）\[\]"'’“”]/g,' ')
    .replace(/\s+/g,' ').trim().split(' ').slice(0,3).join(' ');
}
const BLACK=['有声书','有声小说','英文原版','原版儿童','朗读版','广播剧'];
/* 各栏目更偏好的形式词（教程类优先） */
const PREFER={viral:['教程','怎么','技巧','脚本','文案','拍摄','剪辑','方法'],style:['教程','教学','妆容','仿妆'],baby:['育儿','宝宝','孩子','妈妈'],speech:['表达','口才','沟通','话术','情商']};

const CACHE=path.join(__dirname,'.video-cache.json');
const cache=JSON.parse(fs.readFileSync(CACHE,'utf8'));

/* 收集需要复核的条目 */
const todo=[];
for(const [sec,vn] of Object.entries(SEC_OF)){
  (DATA[vn]||[]).forEach(it=>{
    const key=sec+'|'+it.t, cur=cache.map[key];
    if(!cur) return;
    const q=(it.k&&it.k.trim())?it.k.trim():(HINT[sec]+' '+core(it.t));
    const rel=relScore(tokens(q), cur.t);
    const black=sec!=='book' && BLACK.some(b=>cur.t.includes(b));
    /* style：内容标题首段是博主名，UP 必须对上 */
    let upMiss=false;
    if(sec==='style'){
      const name=String(it.t).split('·')[0].trim().split(' ')[0];
      if(name && name.length>=2 && !cur.up.includes(name) && !cur.t.includes(name)) upMiss=true;
    }
    if(rel<0.22 || black || upMiss) todo.push({sec,key,it,q,cur,reason:upMiss?'UP不符':black?'黑名单':'相关性低('+rel.toFixed(2)+')'});
  });
}
console.log('需复核:', todo.length);
todo.forEach(x=>console.log('  ['+x.reason+']', x.key.slice(0,28), '->', x.cur.t.slice(0,30)));

function betterPick(list, q, sec, it, used){
  const qTok=tokens(q);
  const name = sec==='style' ? String(it.t).split('·')[0].trim().split(' ')[0] : '';
  const pref = PREFER[sec]||[];
  return list.map(v=>{
    let s = relScore(qTok, v.t) + domScore(sec, v.t)*0.45;
    if(name && name.length>=2 && (v.up||'').includes(name)) s += 1.2;   // UP主对上，强加权
    if(name && name.length>=2 && v.t.includes(name)) s += 0.5;
    if(pref.some(p=>v.t.includes(p))) s += 0.3;                          // 偏好教程类
    if(sec!=='book' && BLACK.some(b=>v.t.includes(b))) s -= 1.0;         // 有声书等降权
    return {v,s};
  }).sort((a,b)=>b.s-a.s || (b.v.play||0)-(a.v.play||0))
    .filter(x=>!used.has(x.v.bv))[0] || null;
}

(async()=>{
  if(!todo.length){ console.log('无需校正'); return; }
  await ensureSession();
  const usedBySec={};
  Object.entries(cache.map).forEach(([k,v])=>{ const s=k.split('|')[0]; (usedBySec[s]=usedBySec[s]||new Set()).add(v.bv); });

  let fixed=0;
  for(const job of todo){
    const used=usedBySec[job.sec];
    used.delete(job.cur.bv);
    const queries=[job.q, HINT[job.sec]+' '+core(job.it.t)];
    if(job.sec==='style') queries.unshift(String(job.it.t).split('·')[0].trim()+' 妆容 教程');
    let best=null;
    for(const q of queries){
      const {list}=await degradeSearch(q);
      const b=betterPick(list,q,job.sec,job.it,used);
      if(b && (!best || b.s>best.s)) best=b;
      await new Promise(r=>setTimeout(r,420));
      if(best && best.s>1.2) break;
    }
    if(best && best.v.bv!==job.cur.bv){
      cache.map[job.key]={bv:best.v.bv,t:best.v.t,up:best.v.up,cover:best.v.cover};
      used.add(best.v.bv); fixed++;
      console.log('✔', job.key.slice(0,26), '=>', best.v.t.slice(0,34), '@'+best.v.up);
    }else{
      used.add(job.cur.bv);
      console.log('－', job.key.slice(0,26), '保持原样');
    }
    await new Promise(r=>setTimeout(r,500));
  }
  fs.writeFileSync(CACHE,JSON.stringify(cache),'utf8');
  const js='/* 自动抓取的真实 B 站视频\n   VIDEO_MAP: 与每条内容主题一致的视频（key = 栏目|标题）\n   VIDEOS   : 栏目兜底池。版权归原作者所有 */\n'
    +'window.VIDEO_MAP = '+JSON.stringify(cache.map)+';\n'
    +'window.VIDEOS = '+JSON.stringify(cache.pool)+';\n';
  fs.writeFileSync(path.join(base,'data-videos.js'), js,'utf8');
  console.log('校正完成，替换', fixed, '条；已重写 data-videos.js');
})();
