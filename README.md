# 知乎首页与回答页居中精简

一个 Tampermonkey / Violentmonkey 用户脚本：把知乎网页版首页的信息流和回答详情页的正文置于页面中央，并隐藏右侧的热榜、推荐、广告和作者栏。普通问题列表页、搜索页、文章页和个人主页不受影响。

## 安装

1. 在 Firefox 中安装 Tampermonkey 或 Violentmonkey。
2. 点击 **[自动安装 / 更新“知乎首页与回答页居中精简”](https://raw.githubusercontent.com/MuonChaser/zhihu-centered-home/main/zhihu-centered-home.user.js)**。
3. 在脚本管理器的安装页确认安装，然后刷新知乎首页或任意回答详情页。

已经安装旧版本时，再次打开安装链接即可更新到最新版。

## 效果

- 首页信息流和回答正文保持知乎原生主栏的 694px 宽度。
- 页面主栏与问题标题区域在桌面端视口中水平居中。
- 隐藏首页和回答详情页右侧栏；窄屏（小于 1000px）不改变知乎原有的响应式布局。

## 维护

知乎可能调整网页的 CSS 类名。如果右侧栏重新出现，请在 issue 中附上浏览器版本、页面链接和截图（请打码个人信息）。

## 许可证

[MIT](./LICENSE)
