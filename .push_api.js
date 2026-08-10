/* 通过 GitHub Data API 推送（绕过被阻断的 git 传输端点）
   用法: GH_TOKEN=xxx node .push_api.js "commit message"
*/
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TK = process.env.GH_TOKEN;
const OWNER = 'a53-thce';
const REPO = 'creator-studio';
const BRANCH = 'main';
const MSG = process.argv[2] || 'update';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

if (!TK) { console.error('缺少 GH_TOKEN'); process.exit(1); }

async function gh(url, method = 'GET', body) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${TK}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'creator-studio-pusher'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const txt = await r.text();
      let j = null;
      try { j = JSON.parse(txt); } catch (e) {}
      if (!r.ok) {
        // 404 = 分支不存在，409 = 仓库为空；两者在探测场景下都是正常结果
        if (r.status === 404 || r.status === 409) return { _status: r.status };
        throw new Error(`${r.status} ${txt.slice(0, 300)}`);
      }
      return j;
    } catch (e) {
      if (i === 3) throw e;
      console.log(`   重试 ${i + 1}/3: ${e.message.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

(async () => {
  // 用 git 来确定要提交哪些文件（自动遵守 .gitignore）
  const files = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean);
  console.log(`待上传 ${files.length} 个文件\n`);

  // 0. 空仓库无法直接建 blob，先用 Contents API 播种一个文件完成初始化
  const probe = await gh(`${API}/git/ref/heads/${BRANCH}`);
  if (!probe || probe._status) {
    console.log('仓库为空，先播种 README.md 完成初始化...');
    await gh(`${API}/contents/README.md`, 'PUT', {
      message: 'chore: 初始化仓库',
      content: fs.readFileSync('README.md').toString('base64'),
      branch: BRANCH
    });
    console.log('  ✓ 初始化完成\n');
  }

  // 1. 逐个文件创建 blob
  const tree = [];
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const blob = await gh(`${API}/git/blobs`, 'POST', {
      content: buf.toString('base64'),
      encoding: 'base64'
    });
    tree.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
    const kb = (buf.length / 1024).toFixed(1);
    console.log(`  ✓ ${f.padEnd(52)} ${kb.padStart(8)} KB`);
  }

  // 2. 查现有分支（决定是新建还是更新）
  console.log('\n查询现有分支...');
  const ref = await gh(`${API}/git/ref/heads/${BRANCH}`);
  const parent = ref && !ref._status ? ref.object.sha : null;
  console.log(parent ? `  已存在 main，父提交 ${parent.slice(0, 7)}` : '  空仓库，将创建 main');

  // 3. 建 tree
  const treeBody = { tree };
  if (parent) {
    const pc = await gh(`${API}/git/commits/${parent}`);
    treeBody.base_tree = pc.tree.sha;
  }
  const newTree = await gh(`${API}/git/trees`, 'POST', treeBody);
  console.log(`tree: ${newTree.sha.slice(0, 7)}`);

  // 4. 建 commit
  const commit = await gh(`${API}/git/commits`, 'POST', {
    message: MSG,
    tree: newTree.sha,
    parents: parent ? [parent] : []
  });
  console.log(`commit: ${commit.sha.slice(0, 7)}`);

  // 5. 建/更新 ref
  if (parent) {
    await gh(`${API}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha, force: false });
  } else {
    await gh(`${API}/git/refs`, 'POST', { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
  }
  console.log(`\n推送完成 → https://github.com/${OWNER}/${REPO}/commit/${commit.sha.slice(0, 7)}`);
})().catch(e => { console.error('\n失败:', e.message); process.exit(1); });
