# 鲸鲸学习 · 高中生成绩与错题助手

一个面向高中生的学习管理 App：记录各科成绩、自动生成成绩曲线、分析提分点与常错题型、错题订正并按遗忘曲线安排复习、提供「举一反三」同类题练习、支持拍照导入答题卡。

技术栈：纯前端 Web App（HTML / CSS / JS，无框架）+ Capacitor 封装为 Android 原生应用。数据全部保存在手机本地（localStorage + IndexedDB），不上传服务器。

## 功能

- 📊 **成绩记录与曲线**：按考试录入各科得分/满分/排名，自动生成总分、单科、排名曲线。
- 🎯 **提分点分析**：按科目失分与下滑趋势、错题知识点集中度，给出优先提分建议。
- 📈 **常错题型分析**：按科目统计错题题型/知识点分布。
- ✏️ **错题订正 + 举一反三**：拍照或手录错题，内置高中题生成器（集合、指数对数、等差/等比数列、一元二次不等式、函数定义域、三角求值等）出同类题练习。
- 🔁 **遗忘曲线复习**：订正后第 1/2/4/7/15 天自动排期重做。
- 📷 **答题卡导入**：拍照/相册导入卷子，压缩后存本地。
- 🎨 蓝白高级风界面，浅色/深色主题，底部板块导航（首页 / 成绩 / 错题 / 分析 / 我的）。

## 目录结构

```
www/            # Web App 源码（可独立用浏览器打开）
  index.html  style.css  manifest.json  sw.js  icon*
  js/ (store.js charts.js gen.js app.js)
android/        # Capacitor 生成的 Android 工程（构建 APK 用）
capacitor.config.json
.github/workflows/build-apk.yml   # GitHub Actions 自动编译 APK
```

## 在电脑上本地构建 APK

需要：JDK 17 + Android SDK（或 Android Studio）。

```bash
npm install
npx cap sync android
cd android
./gradlew assembleDebug
```

产物在 `android/app/build/outputs/apk/debug/app-debug.apk`，安装到手机即可。

## 用 GitHub Actions 云端构建 APK（推荐，无需本机环境）

推送到 GitHub 后，仓库会自动触发 `Build Android APK` 工作流，在云服务器上编译出 APK。
下载方式：GitHub 仓库页 → **Actions** → 最新一次运行 → **Artifacts** → `jingjing-study-debug-apk`。

也可以在 Actions 页点 **Run workflow** 手动触发。

## 构建 iOS（.ipa）

iOS 打包必须在 **macOS + Xcode + Apple 开发者签名** 下进行，无法在 Windows/Linux/安卓上完成。在 Mac 上：

```bash
npm install
npx cap add ios
npx cap open ios   # 用 Xcode 打开，配置签名后 Archive 导出
```

## 开发

网页版可直接用任意静态服务器打开 `www/` 目录预览，例如：

```bash
cd www && python3 -m http.server 8000
```

浏览器访问 `http://localhost:8000`。
