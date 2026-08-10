# 自媒体创作工作台

手机端优先的纯静态 PWA，把每日创作要用的资料集中到一个页面里：每日计划、英语学习、中医养生、针灸、读书、妆容穿搭、爆款二创、AI 学习、育儿、减肥运动、表达练习、资讯、天气等。

**在线访问**：https://a53-thce.github.io/creator-studio

## 特点

- **零依赖**：原生 HTML / CSS / JavaScript，没有构建步骤，克隆下来直接能跑
- **可离线**：Service Worker 缓存全部静态资源，装到桌面后断网也能看
- **数据本地化**：收藏、笔记、学习进度都存在 `localStorage`（`mcw:` 命名空间），不上传任何服务器
- **配套视频**：9 个内容栏目的每条内容都配了一条主题匹配的 B 站视频，点击卡片即在内容区内播放

## 目录结构

```
index.html                  入口
sw.js                       Service Worker（改动静态资源后需升级 CACHE 版本号）
manifest.webmanifest        PWA 清单
assets/css/style.css        全部样式（CSS 变量主题，主色 #C8384B）
assets/js/app.js            应用主体：路由、渲染、交互
assets/js/data-content.js   各栏目内容数据
assets/js/data-english.js   英语单词 / 口语 / 语法数据
assets/js/data-tcm.js       中医养生 / 针灸数据
assets/js/data-videos.js    B 站视频映射（VIDEO_MAP: "栏目|标题" → 视频）
```

## 本地运行

任意静态服务器即可，Service Worker 需要 http 协议（`file://` 下不注册）：

```bash
npx serve .
# 或
python -m http.server 8000
```

## 开发说明

**改了静态资源之后，务必把 `sw.js` 里的 `CACHE` 版本号 +1**，否则用户端会一直吃旧缓存。

冒烟测试（需要 jsdom）覆盖全部 15 个页面的渲染，验证无报错、视频卡对应率 100%：

```bash
npm i jsdom
node .smoke.js
```

视频数据抓取脚本（B 站 WBI 签名接口）：

```bash
node fetch_videos_map.js   # 按内容条目逐条匹配
node refine_videos.js      # 对跑题条目定向校正
```

## 许可

个人自用项目。视频内容版权归 B 站原作者所有，本项目仅做嵌入播放。
