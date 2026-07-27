// ==UserScript==
// @name         知乎 · 简净居中
// @namespace    https://github.com/MuonChaser/zhihu-centered-home
// @version      1.7.0
// @description  精简知乎首页、问题页与文章页：正文居中、隐藏侧栏和顶部杂项，仅保留 Logo 与居中搜索框。
// @author       MuonChaser
// @match        https://www.zhihu.com/*
// @match        https://zhihu.com/*
// @match        https://zhuanlan.zhihu.com/p/*
// @downloadURL  https://github.com/MuonChaser/zhihu-centered-home/raw/refs/heads/main/zhihu-centered-home.user.js
// @updateURL    https://github.com/MuonChaser/zhihu-centered-home/raw/refs/heads/main/zhihu-centered-home.user.js
// @run-at       document-start
// @inject-into  content
// @grant        none
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const PAGE_ATTRIBUTE = 'data-zhihu-centered-home';
  const THEME_ATTRIBUTE = 'data-theme';
  const BOOT_ATTRIBUTE = 'data-zhihu-centered-booting';
  const STYLE_ID = 'zhihu-centered-home-style';
  const THEME_CACHE_KEY = 'zhihu-centered-home-theme';
  const REVEAL_TIMEOUT_MS = 4000;
  const root = document.documentElement;
  if (!root) return;

  const shouldCloak = Boolean(root && isSupportedPage());
  let cloakState = null;
  let revealFallback = null;
  let bootGeneration = 0;

  function readCachedTheme() {
    try {
      const theme = sessionStorage.getItem(THEME_CACHE_KEY);
      return theme === 'dark' || theme === 'light' ? theme : null;
    } catch {
      return null;
    }
  }

  function cacheTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') return;
    try {
      sessionStorage.setItem(THEME_CACHE_KEY, theme);
    } catch {
      // Storage can be unavailable in strict privacy modes; theme switching still works.
    }
  }

  function getBootTheme() {
    const requestedTheme = getRequestedTheme();
    if (requestedTheme) return requestedTheme;
    const documentTheme = root?.getAttribute(THEME_ATTRIBUTE);
    if (documentTheme === 'dark' || documentTheme === 'light') return documentTheme;
    const cachedTheme = readCachedTheme();
    if (cachedTheme) return cachedTheme;
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function restoreInlineProperty(name, value, priority) {
    if (value) root.style.setProperty(name, value, priority);
    else root.style.removeProperty(name);
  }

  function revealPage() {
    if (!cloakState) return;
    const finishedState = cloakState;
    cloakState = null;

    if (revealFallback !== null) {
      clearTimeout(revealFallback);
      revealFallback = null;
    }
    bootObserver.disconnect();
    restoreInlineProperty(
      'visibility',
      finishedState.previousVisibility,
      finishedState.previousVisibilityPriority,
    );
    restoreInlineProperty(
      'background-color',
      finishedState.previousBackground,
      finishedState.previousBackgroundPriority,
    );

    const finishedGeneration = finishedState.generation;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cloakState && bootGeneration === finishedGeneration) {
          root.removeAttribute(BOOT_ATTRIBUTE);
        }
      });
    });
  }

  function beginCloak({ requireMutation = false } = {}) {
    if (!root || !isSupportedPage()) return;

    const generation = ++bootGeneration;
    if (!cloakState) {
      cloakState = {
        previousVisibility: root.style.getPropertyValue('visibility'),
        previousVisibilityPriority: root.style.getPropertyPriority('visibility'),
        previousBackground: root.style.getPropertyValue('background-color'),
        previousBackgroundPriority: root.style.getPropertyPriority('background-color'),
        frameScheduled: false,
      };
    }

    Object.assign(cloakState, {
      generation,
      routeKey: getRouteKey(),
      requireMutation,
      mutationSeen: !requireMutation,
      stableFrames: 0,
    });

    const theme = getBootTheme();
    if (getRequestedTheme() && root.getAttribute(THEME_ATTRIBUTE) !== theme) {
      root.setAttribute(THEME_ATTRIBUTE, theme);
    }
    cacheTheme(theme);
    root.setAttribute(BOOT_ATTRIBUTE, '');
    root.style.setProperty('background-color', theme === 'dark' ? '#000' : '#f4f6f9', 'important');
    root.style.setProperty('visibility', 'hidden', 'important');

    if (revealFallback !== null) clearTimeout(revealFallback);
    revealFallback = setTimeout(() => {
      revealFallback = null;
      revealPage();
    }, REVEAL_TIMEOUT_MS);

    bootObserver.disconnect();
    bootObserver.observe(root, { childList: true, subtree: true });
    scheduleRevealCheck();
  }

  const bootObserver = new MutationObserver(() => {
    if (!cloakState) return;
    cloakState.mutationSeen = true;
    scheduleRevealCheck();
  });

  if (shouldCloak) beginCloak();

  // USERSTYLE_CSS_START
  const css = `
    html[${PAGE_ATTRIBUTE}],
    html[${PAGE_ATTRIBUTE}] body {
      background-color: #f4f6f9 !important;
    }

    html[${PAGE_ATTRIBUTE}][${THEME_ATTRIBUTE}="dark"],
    html[${PAGE_ATTRIBUTE}][${THEME_ATTRIBUTE}="dark"] body {
      color-scheme: dark !important;
      background-color: #000 !important;
    }

    html[${BOOT_ATTRIBUTE}] *,
    html[${BOOT_ATTRIBUTE}] *::before,
    html[${BOOT_ATTRIBUTE}] *::after {
      transition: none !important;
      animation: none !important;
    }

    @media (min-width: 1000px) {
      /* 全站顶栏只保留搜索框；用结构选择器规避知乎频繁变化的构建类名。 */
      html[${PAGE_ATTRIBUTE}] .AppHeader {
        background: rgba(246, 247, 249, 0.88) !important;
        border: 0 !important;
        -webkit-backdrop-filter: blur(14px) saturate(140%) !important;
        backdrop-filter: blur(14px) saturate(140%) !important;
        box-shadow: 0 1px 8px rgba(18, 18, 18, 0.10) !important;
      }

      html[${PAGE_ATTRIBUTE}][${THEME_ATTRIBUTE}="dark"] .AppHeader {
        background: rgba(25, 27, 31, 0.92) !important;
        box-shadow: 0 1px 8px rgba(0, 0, 0, 0.45) !important;
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

      html[${PAGE_ATTRIBUTE}] .AppHeader > div > :has(.SearchBar) {
        pointer-events: none !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader .SearchBar {
        position: fixed !important;
        top: 12px !important;
        left: 50% !important;
        z-index: 1 !important;
        width: 560px !important;
        max-width: calc(100vw - 32px) !important;
        transform: translateX(-50%) !important;
        pointer-events: auto !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader .SearchBar-tool {
        width: 100% !important;
      }

      html[${PAGE_ATTRIBUTE}] .AppHeader .SearchBar input::placeholder {
        color: transparent !important;
        opacity: 0 !important;
      }

      /* 空搜索框弹层的第一组是“搜索发现”；保留用户自己的搜索历史。 */
      html[${PAGE_ATTRIBUTE}] .SearchBar-noValueMenu > .AutoComplete-group:first-child {
        display: none !important;
      }

      /* 使用知乎原有 SVG Logo 点缀顶栏，不引入额外图片；搜索框仍严格位于页面中线。 */
      html[${PAGE_ATTRIBUTE}] .AppHeader > div > a[aria-label="知乎"] {
        display: block !important;
        position: fixed !important;
        left: calc(50% - 352px) !important;
        top: 31px !important;
        z-index: 2 !important;
        transform: translateY(-50%) !important;
        margin: 0 !important;
        cursor: pointer !important;
        pointer-events: auto !important;
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
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionPage > div:has(> .Question-sideColumn) > :has(.Question-mainColumn),
      html[${PAGE_ATTRIBUTE}] .Question-mainColumn {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      html[${PAGE_ATTRIBUTE}] .Question-sideColumn,
      html[${PAGE_ATTRIBUTE}] .QuestionHeader-side,
      /* 隐藏滚动时出现的重复问题标题栏，保留下方完整问题卡片。 */
      html[${PAGE_ATTRIBUTE}] .PageHeader {
        display: none !important;
      }

      /* 保留知乎原生问题区样式，只把整体宽度和回答正文对齐。 */
      html[${PAGE_ATTRIBUTE}] .QuestionHeader {
        box-sizing: border-box !important;
        width: 694px !important;
        min-width: 0 !important;
        max-width: calc(100vw - 32px) !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionHeader-content {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionHeader-content {
        display: block !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionHeader-content {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionHeader-main {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: none !important;
      }

      /*
       * 问题头严格使用组件白名单：只显示问题标题，以及内部包含
       * QuestionRichText 的问题描述。话题、影视/书籍卡片和动态推荐全部隐藏。
       */
      html[${PAGE_ATTRIBUTE}] .QuestionHeader > .QuestionHeader-content .QuestionHeader-main > * {
        display: none !important;
      }

      html[${PAGE_ATTRIBUTE}] .QuestionHeader > .QuestionHeader-content .QuestionHeader-main > .QuestionHeader-title,
      html[${PAGE_ATTRIBUTE}] .QuestionHeader > .QuestionHeader-content .QuestionHeader-main > :has(.QuestionRichText) {
        display: block !important;
      }

      /* “关注问题 / 写回答 / 邀请回答 / 评论 / 分享”等操作整排不在白名单内。 */
      html[${PAGE_ATTRIBUTE}] .QuestionHeader > .QuestionHeader-footer {
        display: none !important;
      }

      /* 文章页：保留原生 654px 阅读正文和 20px 内边距，隐藏 296px 右栏并居中。 */
      html[${PAGE_ATTRIBUTE}] .Post-content > div:has(.Post-Main) {
        display: block !important;
        box-sizing: border-box !important;
        width: 694px !important;
        max-width: calc(100vw - 32px) !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html[${PAGE_ATTRIBUTE}] .Post-content > div:has(.Post-Main) > :has(.Post-Main) {
        width: 100% !important;
        max-width: none !important;
      }

      html[${PAGE_ATTRIBUTE}] .Post-content > div:has(.Post-Main) > :not(:has(.Post-Main)) {
        display: none !important;
      }
    }
  `;
  // USERSTYLE_CSS_END

  function getPageKind() {
    const isMainSite = location.hostname === 'www.zhihu.com' || location.hostname === 'zhihu.com';
    if (isMainSite && location.pathname === '/') return 'home';
    if (isMainSite && /^\/question\/\d+(?:\/answer\/\d+)?\/?$/.test(location.pathname)) {
      return 'question';
    }
    if (location.hostname === 'zhuanlan.zhihu.com' && /^\/p\/\d+\/?$/.test(location.pathname)) {
      return 'article';
    }
    return null;
  }

  function isSupportedPage() {
    return getPageKind() !== null;
  }

  function getRouteKey() {
    const pageKind = getPageKind();
    const pathname =
      location.pathname.length > 1 ? location.pathname.replace(/\/$/, '') : location.pathname;
    return pageKind ? `${location.hostname}${pathname}` : '';
  }

  function isHiddenIfPresent(selector) {
    const element = document.querySelector(selector);
    if (!element || typeof getComputedStyle !== 'function') return true;
    return getComputedStyle(element).display === 'none';
  }

  function isLayoutReady() {
    if (!root?.hasAttribute(PAGE_ATTRIBUTE)) return false;
    const style = document.getElementById(STYLE_ID);
    if (!style?.parentElement) return false;
    if (!document.querySelector('.AppHeader') || !document.querySelector('.AppHeader .SearchBar')) {
      return false;
    }

    const pageKind = getPageKind();
    if (pageKind === 'home') {
      return (
        Boolean(document.querySelector('.Topstory-container')) &&
        Boolean(document.querySelector('.Topstory-mainColumn')) &&
        isHiddenIfPresent(
          '.Topstory-sideBar, .Topstory-container > .Topstory-mainColumn + div',
        )
      );
    }
    if (pageKind === 'question') {
      return (
        Boolean(document.querySelector('.QuestionHeader > .QuestionHeader-content .QuestionHeader-title')) &&
        Boolean(document.querySelector('.Question-mainColumn')) &&
        isHiddenIfPresent('.Question-sideColumn') &&
        isHiddenIfPresent('.QuestionHeader > .QuestionHeader-footer')
      );
    }
    if (pageKind === 'article') {
      return (
        Boolean(document.querySelector('.Post-Main')) &&
        isHiddenIfPresent(
          '.Post-content > div:has(.Post-Main) > :not(:has(.Post-Main))',
        )
      );
    }
    return false;
  }

  function scheduleRevealCheck() {
    if (!cloakState || cloakState.frameScheduled) return;
    cloakState.frameScheduled = true;

    requestAnimationFrame(() => {
      if (!cloakState) return;
      cloakState.frameScheduled = false;
      const routeStillMatches = cloakState.routeKey === getRouteKey();
      const ready =
        routeStillMatches &&
        cloakState.mutationSeen &&
        isLayoutReady();
      cloakState.stableFrames = ready ? cloakState.stableFrames + 1 : 0;

      if (cloakState.stableFrames >= 2) revealPage();
      else scheduleRevealCheck();
    });
  }

  function getRequestedTheme() {
    const theme = new URLSearchParams(location.search).get('theme');
    return theme === 'dark' || theme === 'light' ? theme : null;
  }

  function updateTheme() {
    if (!root || !isSupportedPage()) return;
    const requestedTheme = getRequestedTheme();
    if (requestedTheme && root.getAttribute(THEME_ATTRIBUTE) !== requestedTheme) {
      root.setAttribute(THEME_ATTRIBUTE, requestedTheme);
    }
    const effectiveTheme = requestedTheme || root.getAttribute(THEME_ATTRIBUTE);
    cacheTheme(effectiveTheme);
    if (cloakState && (effectiveTheme === 'dark' || effectiveTheme === 'light')) {
      root.style.setProperty(
        'background-color',
        effectiveTheme === 'dark' ? '#000' : '#f4f6f9',
        'important',
      );
    }
  }

  function toggleTheme() {
    if (!root || !isSupportedPage()) return;
    const nextTheme = root.getAttribute(THEME_ATTRIBUTE) === 'dark' ? 'light' : 'dark';
    const url = new URL(
      `${location.pathname}${location.search}${location.hash}`,
      `https://${location.hostname}`,
    );
    url.searchParams.set('theme', nextTheme);
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    updateTheme();
  }

  function updateLayout() {
    document.documentElement.toggleAttribute(PAGE_ATTRIBUTE, isSupportedPage());
    updateTheme();
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const target = document.head || document.documentElement;
    if (!target) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    target.appendChild(style);
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

  let activeRouteKey = getRouteKey();

  function handleRouteChange(requireMutation = true) {
    const nextRouteKey = getRouteKey();
    if (nextRouteKey === activeRouteKey) {
      maintainLayout();
      return;
    }

    activeRouteKey = nextRouteKey;
    if (nextRouteKey) beginCloak({ requireMutation });
    else revealPage();
    maintainLayout();
  }

  const rootObserver = new MutationObserver(maintainLayout);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [PAGE_ATTRIBUTE, THEME_ATTRIBUTE],
    childList: true,
  });

  maintainLayout();
  document.addEventListener('DOMContentLoaded', maintainLayout, { once: true });
  document.addEventListener(
    'click',
    (event) => {
      const logo = event.target.closest?.(
        '.AppHeader a[aria-label="知乎"], .AppHeader .AppHeader-zhihuLogo',
      );
      if (!logo || !isSupportedPage()) return;
      event.preventDefault();
      location.reload();
    },
    true,
  );
  document.addEventListener(
    'dblclick',
    (event) => {
      const header = event.target.closest?.('.AppHeader');
      const interactive = event.target.closest?.(
        'a, button, input, textarea, select, [role="button"], [contenteditable="true"]',
      );
      if (!header || interactive || !isSupportedPage()) return;
      event.preventDefault();
      toggleTheme();
    },
    true,
  );

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      handleRouteChange(true);
      return result;
    };
  }
  addEventListener('popstate', () => handleRouteChange(true));
  addEventListener('pageshow', () => handleRouteChange(false));
})();
