// ==UserScript==
// @name         知乎 · 简净居中
// @namespace    https://github.com/MuonChaser/zhihu-centered-home
// @version      1.2.4
// @description  精简知乎首页与问题页：正文居中、隐藏侧栏和顶部杂项，仅保留 Logo 与居中搜索框。
// @author       MuonChaser
// @match        https://www.zhihu.com/*
// @match        https://zhihu.com/*
// @downloadURL  https://github.com/MuonChaser/zhihu-centered-home/raw/refs/heads/main/zhihu-centered-home.user.js
// @updateURL    https://github.com/MuonChaser/zhihu-centered-home/raw/refs/heads/main/zhihu-centered-home.user.js
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const PAGE_ATTRIBUTE = 'data-zhihu-centered-home';
  const SCROLLED_ATTRIBUTE = 'data-zhihu-centered-scrolled';
  const STYLE_ID = 'zhihu-centered-home-style';

  const css = `
    @media (min-width: 1000px) {
      /* 全站顶栏只保留搜索框；用结构选择器规避知乎频繁变化的构建类名。 */
      html[${PAGE_ATTRIBUTE}] .AppHeader {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        transition: background-color 160ms ease, box-shadow 160ms ease !important;
      }

      html[${PAGE_ATTRIBUTE}][${SCROLLED_ATTRIBUTE}] .AppHeader {
        background: rgba(246, 247, 249, 0.88) !important;
        -webkit-backdrop-filter: blur(14px) saturate(140%) !important;
        backdrop-filter: blur(14px) saturate(140%) !important;
        box-shadow: 0 1px 8px rgba(18, 18, 18, 0.10) !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader > div {
        justify-content: center !important;
        position: relative !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader > div > :not(:has(.SearchBar)),
      html[${PAGE_ATTRIBUTE}] .AppHeader > div > :has(.SearchBar) > :not(:has(.SearchBar)),
      html[${PAGE_ATTRIBUTE}] .AppHeader *:has(> * > .SearchBar) > :not(:has(.SearchBar)),
      html[${PAGE_ATTRIBUTE}] .AppHeader .SearchBar > :not(.SearchBar-tool) {
        display: none !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader > div > :has(.SearchBar),
      html[${PAGE_ATTRIBUTE}] .AppHeader > div > :has(.SearchBar) > :has(.SearchBar),
      html[${PAGE_ATTRIBUTE}] .AppHeader *:has(> * > .SearchBar),
      html[${PAGE_ATTRIBUTE}] .AppHeader *:has(> .SearchBar) {
        display: flex !important;
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: none !important;
        justify-content: center !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader .SearchBar {
        position: fixed !important;
        top: 12px !important;
        left: 50% !important;
        z-index: 1 !important;
        width: 560px !important;
        max-width: calc(100vw - 32px) !important;
        transform: translateX(-50%) !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader .SearchBar-tool {
        width: 100% !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader .SearchBar input::placeholder {
        color: transparent !important;
        opacity: 0 !important;
      }

      /* 使用知乎原有 SVG Logo 点缀顶栏，不引入额外图片；搜索框仍严格位于页面中线。 */
      html[${PAGE_ATTRIBUTE}] .AppHeader > div > a[aria-label="知乎"] {
        display: block !important;
        position: fixed !important;
        left: calc(50% - 352px) !important;
        top: 31px !important;
        transform: translateY(-50%) !important;
        margin: 0 !important;
      }

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

      /* 首页顶部推广横幅和发布内容卡片。 */
      html[${PAGE_ATTRIBUTE}] .Pc-Business-Card-PcTopFeedBanner,
      html[${PAGE_ATTRIBUTE}] .WriteArea {
        display: none !important;
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

      /* 回答详情页：新版知乎的外层类名会变化，用稳定的 Question 类和结构定位。 */
      html[${PAGE_ATTRIBUTE}] .QuestionPage > div:has(> .Question-sideColumn) {
        display: block !important;
        box-sizing: border-box !important;
        width: 694px !important;
        max-width: calc(100vw - 32px) !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html[${PAGE_ATTRIBUTE}] .Question-mainColumn {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      html[${PAGE_ATTRIBUTE}] .Question-sideColumn,
      html[${PAGE_ATTRIBUTE}] .QuestionHeader-side,
      /* 问题页顶部标题、关注和操作框；顶栏搜索框保留。 */
      html[${PAGE_ATTRIBUTE}] .QuestionHeader,
      html[${PAGE_ATTRIBUTE}] .PageHeader {
        display: none !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionHeader-content,
      html[${PAGE_ATTRIBUTE}] .QuestionHeader-footer-inner {
        box-sizing: border-box !important;
        width: 694px !important;
        max-width: calc(100vw - 32px) !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionHeader-content {
        display: block !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionHeader-main,
      html[${PAGE_ATTRIBUTE}] .QuestionHeader-footer-main {
        width: 100% !important;
        max-width: none !important;
      }
    }
  `;

  function isSupportedPage() {
    if (!location.hostname.endsWith('zhihu.com')) return false;
    return location.pathname === '/' || /^\/question\/\d+(?:\/answer\/\d+)?\/?$/.test(location.pathname);
  }

  function updateLayout() {
    document.documentElement.toggleAttribute(PAGE_ATTRIBUTE, isSupportedPage());
  }

  function updateScrollState() {
    document.documentElement.toggleAttribute(
      SCROLLED_ATTRIBUTE,
      isSupportedPage() && scrollY > 12,
    );
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
    updateScrollState();
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
    attributeFilter: [PAGE_ATTRIBUTE, SCROLLED_ATTRIBUTE],
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
  addEventListener('scroll', updateScrollState, { passive: true });
})();
