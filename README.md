# 知乎首页居中精简

一个 Tampermonkey 用户脚本：把知乎网页版首页的信息流置于页面中央，并隐藏右侧的热榜、推荐和广告栏。它只在 `https://www.zhihu.com/` 首页生效，不影响问题页、搜索页、文章页或个人主页。

## 安装

1. 在 Firefox 中安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 点击[安装“知乎首页居中精简”](https://raw.githubusercontent.com/MuonChaser/zhihu-centered-home/main/zhihu-centered-home.user.js)。
3. 在 Tampermonkey 的安装页确认安装，然后刷新知乎首页。

## 效果

- 信息流宽度保持为知乎原生主栏的 694px。
- 主栏在桌面端视口中水平居中。
- 隐藏首页右侧栏；窄屏（小于 1000px）不改变知乎原有的响应式布局。

## 维护

知乎可能调整网页的 CSS 类名。如果右侧栏重新出现，请在 issue 中附上浏览器版本和首页截图（请打码个人信息）。

## 许可证

[MIT](./LICENSE)
