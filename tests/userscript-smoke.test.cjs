const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const observers = new Set();

function notify(target, type, attributeName) {
  for (const observer of [...observers]) {
    for (const registration of observer.registrations) {
      if (registration.target !== target) continue;
      if (type === 'childList' && registration.options.childList) observer.callback([{ type, target }]);
      if (
        type === 'attributes' &&
        registration.options.attributes &&
        (!registration.options.attributeFilter || registration.options.attributeFilter.includes(attributeName))
      ) {
        observer.callback([{ type, target, attributeName }]);
      }
    }
  }
}

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.registrations = [];
    observers.add(this);
  }

  observe(target, options) {
    this.registrations.push({ target, options });
  }

  disconnect() {
    this.registrations = [];
  }
}

class FakeStyleDeclaration {
  constructor() {
    this.values = new Map();
    this.priorities = new Map();
  }

  setProperty(name, value, priority = '') {
    this.values.set(name, String(value));
    this.priorities.set(name, String(priority));
  }

  getPropertyValue(name) {
    return this.values.get(name) || '';
  }

  getPropertyPriority(name) {
    return this.priorities.get(name) || '';
  }

  removeProperty(name) {
    const previous = this.getPropertyValue(name);
    this.values.delete(name);
    this.priorities.delete(name);
    return previous;
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.id = '';
    this.textContent = '';
    this.style = new FakeStyleDeclaration();
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    notify(this, 'childList');
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parentElement = null;
    notify(this, 'childList');
    return child;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    const previous = this.getAttribute(name);
    this.attributes.set(name, stringValue);
    if (previous !== stringValue) notify(this, 'attributes', name);
  }

  toggleAttribute(name, force) {
    const hadAttribute = this.attributes.has(name);
    const shouldHaveAttribute = force === undefined ? !hadAttribute : Boolean(force);
    if (shouldHaveAttribute) this.attributes.set(name, '');
    else this.attributes.delete(name);
    if (hadAttribute !== shouldHaveAttribute) notify(this, 'attributes', name);
    return shouldHaveAttribute;
  }

  removeAttribute(name) {
    if (this.attributes.delete(name)) notify(this, 'attributes', name);
  }
}

function findById(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children) {
    const match = findById(child, id);
    if (match) return match;
  }
  return null;
}

async function main() {
  const documentListeners = new Map();
  const frameCallbacks = [];
  let fallbackCallback = null;
  let reloadCount = 0;
  const documentElement = new FakeElement('HTML');
  const document = {
    documentElement,
    head: null,
    createElement: (tagName) => new FakeElement(tagName.toUpperCase()),
    getElementById: (id) => findById(documentElement, id),
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
  };
  const location = {
    hostname: 'www.zhihu.com',
    pathname: '/',
    search: '?theme=dark',
    reload() {
      reloadCount += 1;
    },
  };
  function applyUrl(url) {
    if (!url) return;
    const parsed = new URL(url, `https://${location.hostname}/`);
    location.hostname = parsed.hostname;
    location.pathname = parsed.pathname;
    location.search = parsed.search;
  }
  const history = {
    pushState(_state, _title, url) {
      applyUrl(url);
    },
    replaceState(_state, _title, url) {
      applyUrl(url);
    },
  };
  const context = {
    MutationObserver: FakeMutationObserver,
    URL,
    URLSearchParams,
    document,
    history,
    location,
    queueMicrotask,
    addEventListener: () => {},
    requestAnimationFrame(callback) {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    },
    setTimeout(callback) {
      fallbackCallback = callback;
      return 1;
    },
    clearTimeout() {
      fallbackCallback = null;
    },
  };

  const scriptPath = require.resolve('../zhihu-centered-home.user.js');
  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: scriptPath });

  assert.equal(documentElement.style.getPropertyValue('visibility'), 'hidden', 'supported pages are cloaked before the first frame');
  assert.equal(documentElement.style.getPropertyPriority('visibility'), 'important', 'the first-frame cloak overrides site styles');
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'homepage is enabled at document start');
  assert.equal(documentElement.getAttribute('data-theme'), 'dark', 'theme=dark enables Zhihu native dark mode at document start');
  const earlyStyle = document.getElementById('zhihu-centered-home-style');
  assert.ok(earlyStyle, 'style is installed before the head element exists');
  assert.equal(earlyStyle.parentElement, documentElement, 'early style is attached directly to the document root');

  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), 'hidden', 'page stays cloaked through the first animation frame');
  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), '', 'page is revealed after two stable animation frames');
  assert.equal(fallbackCallback, null, 'the reveal fallback is cleared after a successful reveal');

  document.head = new FakeElement('HEAD');
  documentElement.appendChild(document.head);
  const firstStyle = document.getElementById('zhihu-centered-home-style');
  assert.equal(firstStyle, earlyStyle, 'creating the head does not replace the already-active style');
  assert.match(firstStyle.textContent, /Topstory-mainColumn \+ div/, 'style contains the structural sidebar selector');
  assert.match(firstStyle.textContent, /Question-sideColumn/, 'style hides the answer-page sidebar');
  assert.match(firstStyle.textContent, /QuestionHeader-content/, 'style centers the answer-page header');
  assert.match(firstStyle.textContent, /AppHeader[\s\S]*SearchBar/, 'style reduces the app header to the search bar');
  assert.match(firstStyle.textContent, /a\[aria-label="知乎"\]/, 'style keeps the Zhihu logo beside the centered search bar');
  assert.match(firstStyle.textContent, /left: calc\(50% - 352px\)/, 'logo placement does not move the search bar off center');
  assert.match(firstStyle.textContent, /a\[aria-label="知乎"\][\s\S]*z-index: 2[\s\S]*pointer-events: auto/, 'logo stays above transparent header layers and remains clickable');
  assert.match(firstStyle.textContent, /\.SearchBar \{[\s\S]*position: fixed[\s\S]*left: 50%/, 'search bar is centered against the viewport');
  assert.match(firstStyle.textContent, /input::placeholder[\s\S]*color: transparent/, 'suggested search placeholder is hidden');
  assert.match(firstStyle.textContent, /\.SearchBar-noValueMenu > \.AutoComplete-group:first-child[\s\S]*display: none/, 'search discovery is hidden without removing search history');
  assert.match(firstStyle.textContent, /\.AppHeader \{[\s\S]*background: rgba\(246, 247, 249, 0\.88\)[\s\S]*backdrop-filter: blur/, 'header always has a blurred background');
  assert.match(firstStyle.textContent, /\[data-theme="dark"\] \.AppHeader \{[\s\S]*background: rgba\(25, 27, 31, 0\.92\)/, 'dark mode gives the custom header a matching dark background');
  assert.doesNotMatch(firstStyle.textContent, /data-zhihu-centered-scrolled/, 'header style does not switch when scrolling');
  assert.match(firstStyle.textContent, /Pc-Business-Card-PcTopFeedBanner/, 'style hides the homepage promotion banner');
  assert.match(firstStyle.textContent, /WriteArea/, 'style hides the homepage composer card');
  assert.match(firstStyle.textContent, /\.QuestionHeader \{[\s\S]*width: 694px[\s\S]*min-width: 0[\s\S]*margin-left: auto/, 'question header overrides Zhihu minimum width and matches answers');
  assert.match(firstStyle.textContent, /\.QuestionPage > div:has\(> \.Question-sideColumn\) \{[\s\S]*padding-left: 0[\s\S]*padding-right: 0/, 'answer container removes native padding that shifts the main column');
  assert.match(firstStyle.textContent, /\.QuestionPage > div:has\(> \.Question-sideColumn\) > :has\(\.Question-mainColumn\)/, 'answer column wrapper fills the centered container');
  assert.match(firstStyle.textContent, /\.QuestionHeader-content,[\s\S]*\.QuestionHeader-footer-inner \{[\s\S]*padding-left: 0/, 'question content and actions remove the obsolete side-column gutter');
  assert.match(firstStyle.textContent, /\.QuestionHeader-main,[\s\S]*\.QuestionHeader-footer-main \{[\s\S]*box-sizing: border-box/, 'question text and actions keep native padding inside the centered width');
  assert.doesNotMatch(firstStyle.textContent, /\.QuestionHeader-detail \{/, 'question description keeps Zhihu native styling');
  assert.doesNotMatch(firstStyle.textContent, /border-radius: 10px/, 'question header does not add a custom card appearance');
  assert.match(firstStyle.textContent, /\.PageHeader \{[\s\S]*display: none/, 'style hides only the duplicate sticky question header');
  assert.match(firstStyle.textContent, /\.Post-content > div:has\(\.Post-Main\)[\s\S]*width: 694px/, 'article content container is centered at the native main-column width');
  assert.match(firstStyle.textContent, /\.Post-content > div:has\(\.Post-Main\) > :not\(:has\(\.Post-Main\)\)/, 'article sidebar is hidden structurally');

  let prevented = false;
  for (const listener of documentListeners.get('click') || []) {
    listener({
      target: { closest: () => ({}) },
      preventDefault: () => {
        prevented = true;
      },
    });
  }
  assert.equal(prevented, true, 'clicking the Zhihu logo prevents SPA navigation');
  assert.equal(reloadCount, 1, 'clicking the Zhihu logo reloads the current page');

  documentElement.removeChild(firstStyle);
  assert.ok(document.getElementById('zhihu-centered-home-style'), 'style is restored after Zhihu removes it');

  documentElement.removeAttribute('data-zhihu-centered-home');
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'homepage marker is restored after removal');

  documentElement.removeAttribute('data-theme');
  assert.equal(documentElement.getAttribute('data-theme'), 'dark', 'requested theme is restored after Zhihu removes it');

  history.pushState({}, '', '/question/123?theme=light');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'layout is enabled on a regular question page');
  assert.equal(documentElement.getAttribute('data-theme'), 'light', 'SPA navigation can switch to light mode');

  history.pushState({}, '', '/search?q=test&theme=dark');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), false, 'layout is disabled on unrelated pages');
  assert.equal(documentElement.getAttribute('data-theme'), 'light', 'theme handling does not alter unsupported pages');

  history.pushState({}, '', '/question/123/answer/456?theme=dark');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'layout is enabled on an answer page');
  assert.equal(documentElement.getAttribute('data-theme'), 'dark', 'SPA navigation can switch back to dark mode');

  history.replaceState({}, '', '/question/123/answer/456/');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'answer pages support a trailing slash');

  location.hostname = 'zhuanlan.zhihu.com';
  history.pushState({}, '', '/p/987654321');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'layout is enabled on a Zhihu article page');

  location.hostname = 'www.zhihu.com';

  history.pushState({}, '', '/');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'layout is re-enabled after returning home');
  documentElement.setAttribute('data-theme', 'light');
  assert.equal(documentElement.getAttribute('data-theme'), 'light', 'a URL without theme does not override Zhihu native theme changes');

  console.log('PASS: userscript restores its style, supports home, question, answer, and article pages, and handles SPA navigation.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
