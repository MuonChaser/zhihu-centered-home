// ==UserScript==
// @name         知乎首页居中精简
// @namespace    https://github.com/MuonChaser/zhihu-centered-home
// @version      1.0.0
// @description  让知乎首页信息流居中显示，并隐藏右侧栏。
// @author       MuonChaser
// @match        https://www.zhihu.com/*
// @match        https://zhihu.com/*
// @downloadURL  https://raw.githubusercontent.com/MuonChaser/zhihu-centered-home/main/zhihu-centered-home.user.js
// @updateURL    https://raw.githubusercontent.com/MuonChaser/zhihu-centered-home/main/zhihu-centered-home.user.js
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const PAGE_CLASS = 'zhihu-centered-home-enabled';
  const STYLE_ID = 'zhihu-centered-home-style';

  const css = `
    @media (min-width: 1000px) {
      body.${PAGE_CLASS} .Topstory-container {
        display: block !important;
        box-sizing: border-box !important;
        width: 694px !important;
        max-width: calc(100vw - 32px) !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      body.${PAGE_CLASS} .Topstory-mainColumn {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      /* 右侧的热榜、推荐、广告等模块。 */
      body.${PAGE_CLASS} .App-main > .GlobalSideBar,
      body.${PAGE_CLASS} .App-main > .Topstory-sideBar,
      body.${PAGE_CLASS} .Topstory-container > .Topstory-sideBar,
      body.${PAGE_CLASS} .Topstory-sideBar,
      /* 当前首页的右栏使用构建时生成的类名；保留结构选择器以避免依赖它。 */
      body.${PAGE_CLASS} .Topstory-container > .Topstory-mainColumn + div {
        display: none !important;
      }
    }
  `;

  function isHomePage() {
    return location.hostname.endsWith('zhihu.com') && location.pathname === '/';
  }

  function updateLayout() {
    document.body?.classList.toggle(PAGE_CLASS, isHomePage());
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  installStyle();
  updateLayout();
  document.addEventListener('DOMContentLoaded', updateLayout, { once: true });

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(updateLayout);
      return result;
    };
  }
  addEventListener('popstate', updateLayout);
})();
