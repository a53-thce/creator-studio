/* 每日内容抓取：为 9 个内容栏目抓当天的真实新内容
   产出 assets/js/data-daily.js：
     window.DAILY = { date, secs:{ <sec>:{ vids:[], news:[] } }, digest:[], hot:[] }
   源：
     - B 站视频（WBI 签名搜索，关键词每日轮换 + 历史去重）
     - 图文资讯（60s.viki.moe 的知乎热榜/微博热搜/60 秒读懂世界，每日更新）
       其中知乎热榜带有封面图与摘要，最适合做「图文知识卡」
   健壮性：单源失败不影响整体；抓不到的栏目沿用上一次的数据，绝不产出空壳。
   历史去重状态：.daily-seen.json（滚动保留 30 天）
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'assets/js/data-daily.js');
const SEEN_FILE = path.join(ROOT, '.daily-seen.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ---------- 栏目配置：关键词池每天轮换取用 ---------- */
const SECS = {
  speech: {
    name: '表达练习', ico: '🎤',
    bili: ['表达能力 提升 训练', '沟通技巧 职场', '说话之道 情商', '即兴演讲 技巧', '高情商 聊天', '汇报 表达 逻辑',
           '普通话 发音 练习', '演讲 台风 训练', '当众讲话 不紧张', '结构化表达 金字塔'],
    news: ['沟通技巧', '表达能力 职场', '演讲 口才'],
    match: ['沟通', '表达', '演讲', '口才', '情商', '聊天', '普通话', '说话', '主持', '辩论', '朗诵', '脱稿']
  },
  tcm: {
    name: '中医养生', ico: '🌿',
    bili: ['中医养生 食疗', '艾灸 入门 教程', '祛湿 食疗 做法', '十二时辰 养生', '八段锦 完整版', '中医 体质辨识',
           '养生粥 做法', '泡脚 配方', '脾胃 调理 中医', '气血不足 调理', '节气 养生', '中药 代茶饮'],
    news: ['中医养生', '中医药 健康', '食疗 养生'],
    match: ['养生', '中医', '食疗', '艾灸', '祛湿', '湿气', '气血', '体质', '节气', '中药', '泡脚', '睡眠', '健康', '营养', '饮食', '八段锦']
  },
  acup: {
    name: '针灸知识', ico: '📍',
    bili: ['穴位 定位 教学', '合谷穴 按摩', '足三里 艾灸', '三阴交 女性', '经络 推拿 手法', '针灸 科普',
           '拔罐 刮痧 区别', '颈椎 理疗 自我按摩', '腰痛 穴位 缓解', '失眠 穴位 按摩'],
    news: ['针灸', '穴位 按摩', '中医 理疗'],
    match: ['穴位', '针灸', '经络', '推拿', '拔罐', '刮痧', '按摩', '理疗', '颈椎', '腰椎', '中医理疗', '止痛']
  },
  book: {
    name: '读书推荐', ico: '📚',
    bili: ['好书推荐 解读', '一本书 讲透', '经典文学 解读', '历史书 推荐', '心理学 书籍 推荐', '哲学 入门 书',
           '成长类 书单', '社科 好书 推荐', '传记 推荐 人物', '读书方法 笔记'],
    news: ['新书 推荐', '读书 书单', '出版 好书'],
    match: ['书', '阅读', '读书', '小说', '文学', '出版', '书单', '作者', '写作', '知识', '读一本']
  },
  style: {
    name: '妆容穿搭', ico: '💄',
    bili: ['日常妆容 教程 女生', '小个子 穿搭 显高', '通勤穿搭 女生', '底妆 教程 持妆', '发型 教程 女生',
           '基础款 穿搭 搭配', '眼妆 教程 新手', '显瘦 穿搭 技巧', '护肤 步骤 正确', '换季 穿搭 女装'],
    news: ['穿搭 时尚', '美妆 护肤', '流行 搭配'],
    match: ['穿搭', '妆容', '美妆', '护肤', '发型', '时尚', '搭配', '口红', '化妆', '衣品', '显瘦', '穿衣服']
  },
  viral: {
    name: '爆款二创', ico: '🔥',
    bili: ['短视频 爆款 拆解', '文案 写作 技巧', '剪辑 教程 手机', '自媒体 起号 方法', '选题 方法 爆款',
           '口播 视频 技巧', '封面 标题 优化', '视频 脚本 模板', '账号 定位 运营', '流量 算法 解析'],
    news: ['短视频 运营', '自媒体 爆款', '内容创作'],
    match: ['短视频', '自媒体', '爆款', '文案', '剪辑', '运营', '流量', '选题', '账号', '直播', '网红', '内容创作', '涨粉']
  },
  ai: {
    name: 'AI 学习', ico: '🤖',
    bili: ['AI 工具 教程', '提示词 写法 技巧', 'AI 绘画 零基础', '普通人 学 AI', 'AI 短视频 制作',
           '大模型 入门 科普', 'AI 办公 效率', 'AI 智能体 搭建', 'AI 编程 入门', 'AI 变现 副业'],
    news: ['人工智能', 'AI 大模型', 'AI 应用 工具'],
    match: ['AI', '人工智能', '大模型', 'ChatGPT', '智能', '算法', '机器人', '科技', '芯片', '算力', '自动驾驶', 'GPT', '智能体']
  },
  baby: {
    name: '育儿知识', ico: '🍼',
    bili: ['科学育儿 知识', '辅食 添加 顺序', '幼儿 专注力 培养', '正面管教 方法', '儿童 发热 护理',
           '入园 分离焦虑', '亲子 沟通 技巧', '宝宝 睡眠 训练', '儿童 身高 发育', '幼儿 英语 启蒙'],
    news: ['育儿 知识', '儿童 教育', '亲子 家庭教育'],
    match: ['育儿', '宝宝', '婴儿', '幼儿', '儿童', '亲子', '辅食', '早教', '妈妈', '家长', '教育', '孩子', '家长里短']
  },
  fit: {
    name: '减肥运动', ico: '🏃',
    bili: ['帕梅拉 燃脂 无跳跃', '瘦肚子 训练 居家', '拉伸 全身 放松', '有氧 减脂 跟练', '瘦腿 训练 女生',
           '核心 训练 新手', '瘦脸 按摩 教程', '居家 减肥 操', '体态 矫正 训练', '减脂餐 食谱'],
    news: ['减肥 健身', '运动 健康', '健身 训练'],
    match: ['减肥', '健身', '运动', '减脂', '塑形', '瑜伽', '跑步', '体重', '锻炼', '帕梅拉', '训练', '体态', '增肌', '有氧']
  }
};

/* ---------- 工具 ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const fixCover = p => !p ? '' : p.startsWith('//') ? 'https:' + p
  : p.startsWith('http://') ? 'https://' + p.slice(7) : p;
const cleanZhihu = p => !p ? '' : p.startsWith('//') ? 'https:' + p
  : p.startsWith('http://') ? 'https://' + p.slice(7) : p;

function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/* 自 2026-01-01 起的天序号，用于关键词轮换 */
function dayIndex() {
  return Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000);
}
/* 从池子里按天取 n 个不重复关键词，每天窗口后移 */
function pickKeywords(pool, n) {
  const start = dayIndex() * n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

/* ---------- 历史去重 ---------- */
function loadSeen() {
  try {
    const j = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const days = {};
    const keep = todayStr();
    for (const d in j.days) if (d >= cutoff || d === keep) days[d] = j.days[d];
    return { days };
  } catch (e) { return { days: {} }; }
}
function seenSet(seen) {
  const s = new Set();
  for (const d in seen.days) (seen.days[d] || []).forEach(k => s.add(k));
  return s;
}

/* ---------- B 站 WBI 签名 ---------- */
const MIXIN_ENC = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];
const getMixinKey = o => { let s = ''; for (const i of MIXIN_ENC) s += o[i]; return s.slice(0, 32); };
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');

let BUVID = '', MIXIN = '';
async function ensureSession() {
  const home = await fetch('https://www.bilibili.com', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }
  });
  const sc = home.headers.getSetCookie ? home.headers.getSetCookie() : [];
  const b3 = sc.find(c => c.includes('buvid3'));
  BUVID = b3 ? b3.split(';')[0] : '';
  const nav = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com', 'Cookie': BUVID }
  });
  const nj = await nav.json();
  const img = (nj.data.wbi_img.img_url || '').split('/').pop().split('.')[0];
  const sub = (nj.data.wbi_img.sub_url || '').split('/').pop().split('.')[0];
  MIXIN = getMixinKey(img + sub);
}
function sign(params) {
  const p = Object.assign({}, params, { wts: Math.floor(Date.now() / 1000) });
  const keys = Object.keys(p).sort();
  let q = '';
  for (const k of keys) q += (q ? '&' : '') + k + '=' + encodeURIComponent(p[k]);
  return q + '&w_rid=' + md5(q + MIXIN);
}
async function biliSearch(kw, order) {
  const params = { search_type: 'video', keyword: kw, page: 1, order: order || 'click', web_location: '333.1007' };
  const res = await fetch('https://api.bilibili.com/x/web-interface/wbi/search/type?' + sign(params), {
    headers: { 'User-Agent': UA, 'Referer': 'https://search.bilibili.com', 'Origin': 'https://www.bilibili.com', 'Cookie': BUVID }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = JSON.parse(await res.text());
  if (j.code !== 0) throw new Error('code ' + j.code);
  return (Array.isArray(j.data.result) ? j.data.result : [])
    .filter(x => x.bvid && x.title)
    .map(x => ({
      bv: x.bvid, t: strip(x.title), up: strip(x.author || ''),
      cover: fixCover(x.pic), play: x.play || 0, dur: strip(x.duration || '')
    }));
}
async function robustBili(kw, order) {
  for (let i = 0; i < 3; i++) {
    try { return await biliSearch(kw, order); }
    catch (e) {
      if (i === 1) { try { await ensureSession(); } catch (_) {} }
      await sleep(900 + i * 700);
    }
  }
  return [];
}

/* ---------- 图文资讯：60s.viki.moe（知乎热榜/微博热搜/60秒读懂世界） ---------- */
async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 15000);
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: c.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = JSON.parse(await r.text());
      if (j.code && j.code !== 200 && j.code !== 0) throw new Error('code ' + j.code);
      return j;
    } catch (e) {
      await sleep(900 + i * 700);
    }
  }
  return null;
}
function objToArr(d) {
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') return Object.keys(d).map(k => d[k]);
  return [];
}
async function fetchNewsPool() {
  const pool = [];
  // 1) 知乎热榜：带封面图 + 摘要，最适合做图文知识卡
  try {
    const j = await getJSON('https://60s.viki.moe/v2/zhihu');
    for (const o of objToArr(j && j.data)) {
      if (!o || !o.title) continue;
      const desc = strip(o.detail || '').slice(0, 64);
      pool.push({
        t: strip(o.title), url: o.link || '', src: '知乎热榜',
        cover: cleanZhihu(o.cover || ''), desc: desc,
        rich: true
      });
    }
    console.log('  知乎热榜 ' + pool.length + ' 条');
  } catch (e) { console.log('  知乎热榜失败：' + e.message); }
  // 2) 微博热搜
  try {
    const j = await getJSON('https://60s.viki.moe/v2/weibo');
    for (const o of objToArr(j && j.data)) {
      if (!o || !o.title) continue;
      pool.push({ t: strip(o.title), url: o.link || '', src: '微博热搜', cover: '', desc: '', rich: false });
    }
    console.log('  微博热搜 +' + objToArr(j && j.data).filter(o => o && o.title).length + ' 条');
  } catch (e) { console.log('  微博热搜失败：' + e.message); }
  // 3) 60 秒读懂世界（每日要闻）
  try {
    const j = await getJSON('https://60s.viki.moe/v2/60s');
    const news = (j && j.data && Array.isArray(j.data.news)) ? j.data.news : [];
    for (const t of news) {
      if (!t) continue;
      pool.push({ t: strip(t), url: 'https://60s.viki.moe/v2/60s', src: '60秒读懂世界', cover: '', desc: '', rich: false });
    }
    console.log('  60秒读懂世界 +' + news.length + ' 条');
  } catch (e) { console.log('  60秒读懂世界失败：' + e.message); }
  return pool;
}
/* 把资讯池按关键词路由到各栏目，并产出首页热闻 */
function routeNews(pool, seenKeys) {
  const secItems = {};
  for (const s in SECS) secItems[s] = [];
  const used = new Set();
  for (const it of pool) {
    const txt = (it.t + ' ' + (it.desc || '')).toLowerCase();
    let best = null, bestScore = 0;
    for (const [sec, cfg] of Object.entries(SECS)) {
      let score = 0;
      for (const kw of cfg.match) if (txt.includes(kw.toLowerCase())) score++;
      if (score > bestScore) { bestScore = score; best = sec; }
    }
    if (best && bestScore > 0 && secItems[best].length < 3) {
      const k = 'nw:' + crypto.createHash('md5').update(it.t).digest('hex').slice(0, 12);
      if (seenKeys.has(k) && secItems[best].length >= 1) continue; // 已推过则尽量不重复
      secItems[best].push(Object.assign({ kw: best }, it));
      used.add(it);
    }
  }
  // 首页热闻：优先图文丰富的知乎卡，保证每天都有真实新内容
  const sorted = pool.slice().sort((a, b) => (b.rich ? 1 : 0) - (a.rich ? 1 : 0));
  const hot = sorted.slice(0, 8).map(it => ({ t: it.t, url: it.url, src: it.src, cover: it.cover, desc: it.desc }));
  return { secItems, hot };
}

/* ---------- 主流程 ---------- */
(async () => {
  const date = todayStr();
  console.log('=== 每日内容抓取 ' + date + ' (day#' + dayIndex() + ') ===\n');

  // 上一次的数据，用于兜底
  let prev = null;
  try {
    const g = {};
    new Function('window', fs.readFileSync(OUT, 'utf8'))(g);
    prev = g.DAILY || null;
  } catch (e) {}

  const seen = loadSeen();
  const seenKeys = seenSet(seen);
  const todayKeys = [];

  try { await ensureSession(); console.log('B 站会话已建立\n'); }
  catch (e) { console.log('B 站会话失败：' + e.message + '（视频部分将走兜底）\n'); }

  /* --- 图文资讯池（全栏目共用，再路由） --- */
  console.log('抓取图文资讯：');
  const pool = await fetchNewsPool();
  const { secItems, hot } = routeNews(pool, seenKeys);
  console.log('资讯池共 ' + pool.length + ' 条，首页热闻 ' + hot.length + ' 条\n');

  const secs = {};
  let vTotal = 0, nTotal = 0;

  for (const [sec, cfg] of Object.entries(SECS)) {
    const vids = [];

    /* --- 视频：3 个当日关键词，各取 1-2 条未推过的 --- */
    const kws = pickKeywords(cfg.bili, 3);
    for (const kw of kws) {
      const list = await robustBili(kw, 'click');
      const fresh = list
        .filter(v => v.play > 3000)
        .filter(v => !seenKeys.has('bv:' + v.bv))
        .filter(v => !vids.some(x => x.bv === v.bv));
      for (const v of fresh.slice(0, 2)) {
        vids.push(Object.assign({ kw }, v));
        todayKeys.push('bv:' + v.bv);
        if (vids.length >= 4) break;
      }
      await sleep(420);
      if (vids.length >= 4) break;
    }

    /* --- 图文：路由过来的资讯（已按栏目匹配） --- */
    const news = (secItems[sec] || []).map(n => {
      todayKeys.push('nw:' + crypto.createHash('md5').update(n.t).digest('hex').slice(0, 12));
      return { t: n.t, url: n.url, src: n.src, cover: n.cover, desc: n.desc };
    });

    // 兜底：这次没抓到就沿用上次的
    const pv = prev && prev.secs && prev.secs[sec] ? prev.secs[sec] : null;
    secs[sec] = {
      vids: vids.length ? vids : (pv ? pv.vids || [] : []),
      news: news.length ? news : (pv ? pv.news || [] : [])
    };
    vTotal += secs[sec].vids.length;
    nTotal += secs[sec].news.length;
    console.log(`${cfg.ico} ${cfg.name.padEnd(6)} 视频 ${String(secs[sec].vids.length).padStart(2)} 条` +
      `${vids.length ? '' : '(沿用上次)'}  图文 ${String(secs[sec].news.length).padStart(2)} 条` +
      `${news.length ? '' : '(沿用上次)'}  |  ${kws[0]}`);
  }

  /* --- 精选合辑：每栏目取 1 条最优 --- */
  const digest = [];
  for (const [sec, cfg] of Object.entries(SECS)) {
    const d = secs[sec];
    if (d.vids && d.vids.length) {
      const best = d.vids.slice().sort((a, b) => b.play - a.play)[0];
      digest.push({ sec, name: cfg.name, ico: cfg.ico, type: 'v', t: best.t, bv: best.bv, up: best.up, cover: best.cover });
    } else if (d.news && d.news.length) {
      digest.push({ sec, name: cfg.name, ico: cfg.ico, type: 'n', t: d.news[0].t, url: d.news[0].url, src: d.news[0].src });
    }
  }

  /* --- 写盘 --- */
  const payload = { date, secs, digest, hot };
  const banner = '/* 每日自动抓取的真实新内容（B 站视频 + 知乎/微博/要闻 图文）\n' +
    '   由 daily_fetch.js 生成，请勿手改。版权归原作者所有\n' +
    '   生成时间：' + new Date().toLocaleString('zh-CN') + ' */\n';
  fs.writeFileSync(OUT, banner + 'window.DAILY = ' + JSON.stringify(payload) + ';\n', 'utf8');

  seen.days[date] = todayKeys;
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen), 'utf8');

  console.log(`\n视频 ${vTotal} 条 · 图文 ${nTotal} 条 · 合辑 ${digest.length} 条 · 首页热闻 ${hot.length} 条`);
  console.log('已写入 ' + path.relative(ROOT, OUT) + '（' + fs.statSync(OUT).size + ' bytes）');
  if (vTotal === 0 && hot.length === 0) { console.log('\n[FAIL] 全部源都没抓到内容'); process.exit(1); }
})();
