/* 冒烟测试：用 jsdom 渲染全部 15 个页面，捕获运行时错误 */
const path=require('path');
const {JSDOM}=require('jsdom');

const IDS=['plan','fit','en','pod','speech','tcm','acup','book','style','viral','roco','ai','baby','news','wx'];
const errs=[];

const dom=new JSDOM('', {
  url:'http://localhost/creator-studio/index.html',
  runScripts:'dangerously',
  resources:undefined,
  pretendToBeVisual:true
});
const {window}=dom;
window.addEventListener('error',e=>errs.push('window.error: '+e.message));
window.fetch=()=>Promise.reject(new Error('offline-test'));
window.scrollTo=()=>{};
window.matchMedia=window.matchMedia||(()=>({matches:false,addListener(){},removeListener(){}}));

const fs=require('fs');
const base=__dirname;
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
// 注入 body
const bodyMatch=html.match(/<body>([\s\S]*)<\/body>/);
window.document.documentElement.innerHTML='<head></head><body>'+bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g,'')+'</body>';

/* 三个文件拼到同一次 eval：顶层 const 在单次 eval 内共享词法作用域，
   这样 data-*.js 声明的 QUOTES/WORDS 等常量能被 app.js 的 IIFE 闭包访问到。 */
const full = ['assets/js/data-english.js','assets/js/data-content.js','assets/js/data-tcm.js','assets/js/data-videos.js','assets/js/app.js']
  .map(f=>fs.readFileSync(path.join(base,f),'utf8')).join('\n;\n');
try{ window.eval(full); }catch(e){ errs.push('eval all: '+e.message); }

// 触发 DOMContentLoaded
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

function check(id){
  window.location.hash='#/'+id;
  window.dispatchEvent(new window.Event('hashchange'));
  const v=window.document.querySelector('#view');
  const len=(v.innerHTML||'').length;
  const title=window.document.querySelector('#pageTitle').textContent;
  console.log(String(id).padEnd(8), String(len).padStart(7), ' ', title);
  if(len<80) errs.push('页面内容过短: '+id);
  return len;
}

IDS.forEach(check);

// 交互测试：每日计划打卡
window.location.hash='#/plan'; window.dispatchEvent(new window.Event('hashchange'));
let todo=window.document.querySelector('#todoList .todo');
todo.dispatchEvent(new window.Event('click',{bubbles:true}));
console.log('\n打卡后 recs =', window.localStorage.getItem('mcw:recs'));

// 新增任务
window.document.querySelector('#tkInput').value='喝够 2L 水';
window.document.querySelector('#tkAdd').dispatchEvent(new window.Event('click',{bubbles:true}));
console.log('任务数 =', JSON.parse(window.localStorage.getItem('mcw:tasks')).length);

// 英语：切换四个 tab + 标记认识
window.location.hash='#/en'; window.dispatchEvent(new window.Event('hashchange'));
['new','rev','d15','hard','say','gram'].forEach(t=>{
  const b=window.document.querySelector('[data-etab="'+t+'"]');
  if(!b){ errs.push('缺少 tab '+t); return; }
  b.dispatchEvent(new window.Event('click',{bubbles:true}));
  console.log('en tab', t, '→', window.document.querySelector('#view').innerHTML.length);
});
window.document.querySelector('[data-etab="new"]').dispatchEvent(new window.Event('click',{bubbles:true}));
for(let i=0;i<21;i++){
  const b=window.document.querySelector('[data-know="1"]');
  if(b) b.dispatchEvent(new window.Event('click',{bubbles:true}));
}
const en=JSON.parse(window.localStorage.getItem('mcw:en'));
console.log('\n英语状态: 学习天数=',en.days.length,' 已学词=',Object.keys(en.prog).length,' cursor=',en.cursor,' 今日新词完成=',en.plan.doneNew.length);

// 收藏
window.location.hash='#/tcm'; window.dispatchEvent(new window.Event('hashchange'));
const fb=window.document.querySelector('[data-fav]');
fb.dispatchEvent(new window.Event('click',{bubbles:true}));
console.log('收藏数 =', JSON.parse(window.localStorage.getItem('mcw:favs')).length);
console.log('针灸笔记按钮 =', !!window.document.querySelector('.note-b'));

// 视频卡：各视频栏目内容块应内嵌 .vcard
['speech','tcm','acup','book','style','viral','ai','baby','fit'].forEach(sec=>{
  window.location.hash='#/'+sec; window.dispatchEvent(new window.Event('hashchange'));
  const n=window.document.querySelectorAll('#view .vcard').length;
  console.log('视频卡', sec, '→', n, '张');
  if(n===0) errs.push('视频栏目无视频卡: '+sec);
});
// 英语学习不应出现视频卡（六个 tab 全查）
window.location.hash='#/en'; window.dispatchEvent(new window.Event('hashchange'));
['new','rev','d15','hard','say','gram'].forEach(tab=>{
  const b=window.document.querySelector('[data-etab="'+tab+'"]');
  if(!b) return;
  b.dispatchEvent(new window.Event('click',{bubbles:true}));
  const n=window.document.querySelectorAll('#view .vcard').length;
  console.log('英语无视频卡', tab, '→', n, '张');
  if(n>0) errs.push('英语学习仍有视频卡: '+tab);
});
// 视频与内容是否一一对应（VIDEO_MAP 覆盖率）
{
  const MAP=window.VIDEO_MAP||{};
  let all=0, hit=0, bad=[];
  ['speech','tcm','acup','book','style','viral','ai','baby','fit'].forEach(sec=>{
    window.location.hash='#/'+sec; window.dispatchEvent(new window.Event('hashchange'));
    window.document.querySelectorAll('#view .icard').forEach(card=>{
      const vc=card.querySelector('.vcard'), tEl=card.querySelector('.ic-t');
      if(!vc||!tEl) return;
      all++;
      const m=MAP[sec+'|'+tEl.textContent.trim()];
      if(m && m.bv===vc.getAttribute('data-bv')) hit++;
      else bad.push(sec+'|'+tEl.textContent.trim().slice(0,14));
    });
  });
  console.log('内容↔视频 一一对应:', hit+'/'+all, '('+Math.round(hit/all*100)+'%)');
  if(bad.length) console.log('  未匹配:', bad.slice(0,8).join(' , '));
  if(hit/all < 0.9) errs.push('视频与内容对应率过低: '+hit+'/'+all);
}
// 点击视频卡应加载 iframe
window.location.hash='#/speech'; window.dispatchEvent(new window.Event('hashchange'));
const vc=window.document.querySelector('#view .vcard');
if(vc){
  vc.dispatchEvent(new window.Event('click',{bubbles:true}));
  console.log('点击视频卡后 iframe =', !!vc.querySelector('iframe'));
  if(!vc.querySelector('iframe')) errs.push('视频卡点击未加载 iframe');
}

// 分组切换
window.location.hash='#/style'; window.dispatchEvent(new window.Event('hashchange'));
const seg=window.document.querySelectorAll('[data-seg]')[1];
seg.dispatchEvent(new window.Event('click',{bubbles:true}));
console.log('妆容分组切换后长度 =', window.document.querySelector('#view').innerHTML.length);

console.log('\n===== 错误 =====');
console.log(errs.length? errs.join('\n') : '无 ✅');
process.exit(errs.length?1:0);
