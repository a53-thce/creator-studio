/* 每日内容更新总控：抓取 → 校验 → 冒烟 → 升缓存版本 → 推送 GitHub Pages
   用法： node daily_update.js            （配合 GH_TOKEN 环境变量）
   自动化：每天早上 8:00 由定时任务执行本脚本
*/
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = __dirname;
const NODE = process.execPath; // 当前 node 可执行文件
const log = (...a) => console.log(...a);
function step(name) { log('\n================ ' + name + ' ================'); }

/* 运行一个子进程，失败抛错 */
function run(cmd, args, opts = {}) {
  log('$ ' + cmd + ' ' + args.join(' '));
  const r = spawnSync(cmd, args, Object.assign({ cwd: ROOT, encoding: 'utf8', stdio: 'inherit' }, opts));
  if (r.status !== 0) throw new Error((cmd + ' 退出码 ' + r.status));
  return r;
}

(async () => {
  /* 1) 抓取真实新内容 */
  step('1/5 抓取每日内容（B 站视频 + 知乎/微博/要闻 图文）');
  run(NODE, ['daily_fetch.js']);

  /* 2) 语法校验 */
  step('2/5 语法校验 data-daily.js / app.js');
  run(NODE, ['--check', 'assets/js/data-daily.js']);
  run(NODE, ['--check', 'assets/js/app.js']);
  log('  语法 OK');

  /* 3) 冒烟测试（jsdom 渲染全部页面，含每日新内容卡片） */
  step('3/5 冒烟测试');
  run(NODE, ['.smoke.js']);

  /* 4) 自动提升 Service Worker 缓存版本（让所有用户拿到当天最新文件） */
  step('4/5 提升 SW 缓存版本');
  const swPath = path.join(ROOT, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  const m = sw.match(/mcw-shell-v(\d+)/);
  if (m) {
    const v = parseInt(m[1], 10) + 1;
    sw = sw.replace(/mcw-shell-v\d+/, 'mcw-shell-v' + v);
    fs.writeFileSync(swPath, sw, 'utf8');
    log('  缓存版本 → v' + v);
  } else {
    log('  （未找到版本标记，跳过）');
  }

  /* 5) 推送 GitHub Pages（.push_api.js 走 GitHub Data API，绕过被阻断的 git 传输） */
  step('5/5 推送到 GitHub Pages');
  const date = new Date().toISOString().slice(0, 10);
  if (!process.env.GH_TOKEN) {
    console.error('缺少 GH_TOKEN 环境变量，跳过推送（本地文件已更新）');
    process.exit(2);
  }
  // 确保新生成的文件被 git 跟踪（.push_api.js 只上传 git ls-files 的内容）
  try {
    spawnSync('git', ['add', '-f', 'assets/js/data-daily.js', 'daily_fetch.js', 'daily_update.js', 'sw.js', 'assets/js/app.js', 'assets/css/style.css', 'index.html'], { cwd: ROOT });
  } catch (e) {}
  run(NODE, ['.push_api.js', 'daily content ' + date + ' · 自动更新']);

  log('\n✅ 每日内容已更新并推送：https://a53-thce.github.io/creator-studio/');
})().catch(e => {
  console.error('\n❌ 每日更新失败：' + e.message);
  process.exit(1);
});
