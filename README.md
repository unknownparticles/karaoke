# K歌提词录音伴奏机 (AI &amp; PWA)

这是一个完全运行在浏览器中的 **PWA (渐进式 Web 应用)**，集成了智能声学及歌词解析、纯前端人声伴奏分离调音台、钢琴窗乐器工作站等丰富功能。

## 🌟 主要特性

1. **智能和弦歌词解析 (AI Mode)**：支持输入歌曲名称，由 Google Gemini AI 智能分析歌曲的速度 (BPM)、调性 (Key)，并解析出完全同步、带有精确和弦标记的动态歌词谱面。
2. **免费离线解析引擎 (Free Mode)**：即使没有配置 API Key，也可以通过免 Key 的 LRCLib 接口提取网络歌词，并通过内置的节奏分配算法智能配比和弦。
3. **PWA 渐进式应用支持**：完全运行在客户端浏览器，无需任何 Node.js 后端。可直接一键安装到手机、平板或电脑桌面，支持离线载入与使用。
4. **一键人声分离 (DSP)**：采用纯前端数字信号处理 (DSP) 算法，实时滤除人声，轻松提取背景伴奏。
5. **乐器工作站 (Instrument Studio)**：提供可视化钢琴窗 (Piano Roll) 音符编辑，以及多轨道器乐伴奏重新合成重组。

## ⚙️ API Key 配置与安全说明

为了使用 **AI 智能解析** 路线，您需要在设置中配置自己的 Gemini API Key：
1. 打开应用，在输入框旁边点击 **⚙️ 设置** 按钮。
2. 选择 **AI 智能解析 (Gemini)** 引擎。
3. 在下方出现的输入框中填写您的 **Gemini API Key**。
4. **安全声明**：您的 API Key 将**仅保存在您本地浏览器的 LocalStorage 中**。所有的 AI 请求都将在客户端由您的浏览器直接发起至 Google Gemini 官方接口 (`https://generativelanguage.googleapis.com`)，绝不会上传至任何第三方服务器。

---

## 🚀 本地开发与预览

### 前置条件
确保您的系统已安装有 [Node.js](https://nodejs.org/)。

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务
```bash
npm run dev
```
打开浏览器访问默认地址 `http://localhost:5173`。

### 3. 打包构建静态页面
```bash
npm run build
```
打包完成后会在根目录下生成 `dist` 目录。

### 4. 预览打包后效果 (包含 PWA Service Worker 注册验证)
```bash
npm run preview
```

---

## 📦 部署发布

本项目为纯前端静态应用，构建生成的 `dist` 目录可以轻松托管在任何静态页面服务中（例如 GitHub Pages、Vercel、Netlify 等）。

### 部署到 GitHub Pages (推荐)
1. 将打包出来的 `dist` 目录内容推送到您的 GitHub 仓库的 `gh-pages` 分支。
2. 或者在 GitHub 仓库设置的 Pages 页面，选择通过 GitHub Actions 自动构建和发布。