/* 修正 refine 误伤的穿搭/妆容条目：只用条目自带关键词 k 重搜，不加 UP 权重 */
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const S=fs.readFileSync(path.join(__dirname,'fetch_videos_map.js'),'utf8');
eval(S.split('/* ---------- 载入内容数据 ---------- */')[0].replace(/^\/\*[\s\S]*?\*\//,''));

const base=path.join(__dirname,'assets','js');
const CACHE=path.join(__dirname,'.video-cache.json');
const cache=JSON.parse(fs.readFileSync(CACHE,'utf8'));

const FIX=[
  ['style|四季基础单品清单（小个子版）','女生 基础款 衣橱 穿搭 清单', ['穿搭','单品','衣橱','基础款']],
  ['style|小个子显高黄金比例：3:7','小个子女生 显高 穿搭 比例',      ['穿搭','显高','比例','小个子']],
  ['style|方脸妆容思路：柔化棱角','方脸 修容 妆容 教程',            ['方脸','妆容','修容','化妆']],
  ['style|瓜子脸妆容三大原则','瓜子脸 妆容 化妆 教程',              ['妆容','化妆','底妆']]
];
/* 本工作台面向女性妆造，排除男士向内容与发型/理发类干扰 */
const NEG=['男生','男士','男友','发型教程','理发','剪发','碎盖','男装'];

(async()=>{
  await ensureSession();
  const used=new Set(Object.entries(cache.map).filter(([k])=>k.startsWith('style|')).map(([,v])=>v.bv));
  for(const [key,q,must] of FIX){
    if(cache.map[key]) used.delete(cache.map[key].bv);
    const {list}=await degradeSearch(q);
    const qTok=tokens(q);
    const best=list.map(v=>{
      let s=relScore(qTok,v.t)+domScore('style',v.t)*0.4;
      if(must.some(m=>v.t.includes(m))) s+=0.6;
      if(NEG.some(n=>v.t.includes(n))) s-=1.5;
      if(/女生|女孩|小姐姐|女装/.test(v.t)) s+=0.25;
      return {v,s};
    }).sort((a,b)=>b.s-a.s||(b.v.play||0)-(a.v.play||0)).filter(x=>!used.has(x.v.bv))[0];
    if(best){
      cache.map[key]={bv:best.v.bv,t:best.v.t,up:best.v.up,cover:best.v.cover};
      used.add(best.v.bv);
      console.log('✔', key.slice(6), '=>', best.v.t.slice(0,38), '@'+best.v.up);
    }else console.log('－', key, '无结果');
    await new Promise(r=>setTimeout(r,600));
  }
  fs.writeFileSync(CACHE,JSON.stringify(cache),'utf8');
  const js='/* 自动抓取的真实 B 站视频\n   VIDEO_MAP: 与每条内容主题一致的视频（key = 栏目|标题）\n   VIDEOS   : 栏目兜底池。版权归原作者所有 */\n'
    +'window.VIDEO_MAP = '+JSON.stringify(cache.map)+';\n'
    +'window.VIDEOS = '+JSON.stringify(cache.pool)+';\n';
  fs.writeFileSync(path.join(base,'data-videos.js'), js,'utf8');
  console.log('已重写 data-videos.js');
})();
