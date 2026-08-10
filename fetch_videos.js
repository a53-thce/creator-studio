/* 通过 WBI 签名抓取各栏目真实 B 站视频，生成 data-videos.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SEC_KW = {
  speech: '沟通表达 口才 演讲 练习',
  tcm:    '中医养生 食疗 艾灸 八段锦',
  acup:   '针灸 穴位 按摩 科普',
  book:   '读书推荐 好书分享 书单',
  style:  '穿搭 妆容 美妆 教程',
  viral:  '短视频 爆款 二创 教程',
  ai:     'AI 人工智能 教程 入门',
  baby:   '育儿 早教 辅食 科普',
  fit:    '减肥 运动 健身 减脂',
  en:     '英语 口语 零基础 入门'
};

const MIXIN_ENC = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];

function getMixinKey(orig){
  let s=''; for(const i of MIXIN_ENC) s+=orig[i]; return s.slice(0,32);
}
function md5(s){ return crypto.createHash('md5').update(s,'utf8').digest('hex'); }

let BUVID = '';
let MIXIN = '';

async function ensureSession(){
  if(BUVID && MIXIN) return;
  // 1) 主页拿 buvid3
  const home = await fetch('https://www.bilibili.com', { headers: { 'User-Agent': UA, 'Accept-Language':'zh-CN,zh;q=0.9' } });
  const sc = home.headers.getSetCookie ? home.headers.getSetCookie() : [];
  const b3 = sc.find(c=>c.includes('buvid3'));
  BUVID = b3 ? b3.split(';')[0] : '';
  // 2) nav 拿 wbi keys
  const nav = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'User-Agent': UA, 'Referer':'https://www.bilibili.com', 'Cookie': BUVID }
  });
  const nj = await nav.json();
  const img = (nj.data.wbi_img.img_url||'').split('/').pop().split('.')[0];
  const sub = (nj.data.wbi_img.sub_url||'').split('/').pop().split('.')[0];
  MIXIN = getMixinKey(img + sub);
}

function sign(params){
  const p = Object.assign({}, params, { wts: Math.floor(Date.now()/1000) });
  const keys = Object.keys(p).sort();
  let q = '';
  for(const k of keys) q += (q?'&':'') + k + '=' + encodeURIComponent(p[k]);
  return q + '&w_rid=' + md5(q + MIXIN);
}

function strip(s){ return String(s||'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim(); }
function fixCover(pic){
  if(!pic) return '';
  if(pic.startsWith('//')) return 'https:'+pic;
  if(pic.startsWith('http://')) return 'https://'+pic.slice(7);
  return pic;
}

async function fetchSec(sec, kw){
  const base = 'https://api.bilibili.com/x/web-interface/wbi/search/type?';
  const params = { search_type:'video', keyword:kw, page:1, order:'click', web_location:'333.1007' };
  const url = base + sign(params);
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer':'https://search.bilibili.com', 'Origin':'https://www.bilibili.com', 'Cookie': BUVID }
  });
  if(!res.ok) throw new Error('HTTP '+res.status);
  const txt = await res.text();
  let j; try{ j = JSON.parse(txt); }catch(e){ throw new Error('JSON 失败: '+txt.slice(0,90)); }
  if(j.code !== 0) throw new Error('code '+j.code+' '+(j.message||''));
  const list = Array.isArray(j.data.result) ? j.data.result : [];
  const out = [];
  for(const it of list){
    const bv = it.bvid;
    const t = strip(it.title);
    if(!bv || !t) continue;
    out.push({ bv, t, up: strip(it.author||''), cover: fixCover(it.pic) });
    if(out.length >= 10) break;
  }
  return out;
}

(async () => {
  await ensureSession();
  console.log('session ready, buvid len', BUVID.length, 'mixin', MIXIN);
  const result = {};
  for(const [sec, kw] of Object.entries(SEC_KW)){
    let arr = [];
    for(let attempt=0; attempt<5 && arr.length===0; attempt++){
      try{
        arr = await fetchSec(sec, kw);
        console.log(`[OK] ${sec} (${kw}) -> ${arr.length} 条`);
      }catch(e){
        console.log(`[重试 ${attempt+1}] ${sec}: ${e.message}`);
        if(attempt===2){ try{ await ensureSession(); }catch(_){} } // 重拿会话
        await new Promise(r=>setTimeout(r, 1000));
      }
    }
    if(arr.length===0) console.log(`[失败] ${sec} 无数据`);
    result[sec] = arr;
    await new Promise(r=>setTimeout(r, 350));
  }
  const total = Object.values(result).reduce((a,b)=>a+b.length,0);
  console.log('总视频数:', total);
  const js = '/* 自动抓取的真实 B 站视频（按栏目分组）\n   仅供本工作台内嵌播放，版权归原作者所有 */\nwindow.VIDEOS = '
    + JSON.stringify(result, null, 2) + ';\n';
  const outPath = path.join(__dirname, 'assets', 'js', 'data-videos.js');
  fs.writeFileSync(outPath, js, 'utf8');
  console.log('已写入', outPath);
})();
