// ==UserScript==
// @name         知乎首页居中精简
// @namespace    https://github.com/MuonChaser/zhihu-centered-home
// @version      1.0.1
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

  const PAGE_ATTRIBUTE = 'data-zhihu-centered-home';
  const STYLE_ID = 'zhihu-centered-home-style';

  const css = `
    @media (min-width: 1000px) {
      html[${PAGE_ATTRIBUTE}] .Topstory-container {
        display: block !important;
        box-sizing: border-box !important;
        width: 694px !important;
        max-width: calc(100vw - 32px) !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html[${PAGE_ATTRIBUTE}] .Topstory-mainColumn {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      /* 右侧的热榜、推荐、广告等模块。 */
      html[${PAGE_ATTRIBUTE}] .App-main > .GlobalSideBar,
      html[${PAGE_ATTRIBUTE}] .App-main > .Topstory-sideBar,
      html[${PAGE_ATTRIBUTE}] .Topstory-container > .Topstory-sideBar,
      html[${PAGE_ATTRIBUTE}] .Topstory-sideBar,
      /* 当前首页的右栏使用构建时生成的类名；保留结构选择器以避免依赖它。 */
      html[${PAGE_ATTRIBUTE}] .Topstory-container > .Topstory-mainColumn + div {
        display: none !important;
      }
    }
  `;

  function isHomePage() {
    return location.hostname.endsWith('zhihu.com') && location.pathname === '/';
  }

  function updateLayout() {
    document.documentElement.toggleAttribute(PAGE_ATTRIBUTE, isHomePage());
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    if (!document.head) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  let observedHead = null;
  const headObserver = new MutationObserver(installStyle);

  function maintainLayout() {
    updateLayout();
    installStyle();

    if (document.head !== observedHead) {
      headObserver.disconnect();
      observedHead = document.head;
      if (observedHead) headObserver.observe(observedHead, { childList: true });
    }
  }

  const rootObserver = new MutationObserver(maintainLayout);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [PAGE_ATTRIBUTE],
    childList: true,
  });

  maintainLayout();
  document.addEventListener('DOMContentLoaded', maintainLayout, { once: true });

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(maintainLayout);
      return result;
    };
  }
  addEventListener('popstate', maintainLayout);
})();
