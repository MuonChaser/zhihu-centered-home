const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const observers = new Set();

function notify(target, type, attributeName) {
  for (const observer of [...observers]) {
    for (const registration of observer.registrations) {
      let isObservedTarget = registration.target === target;
      if (!isObservedTarget && registration.options.subtree) {
        let ancestor = target.parentElement;
        while (ancestor) {
          if (ancestor === registration.target) {
            isObservedTarget = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }
      }
      if (!isObservedTarget) continue;
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

function createBootHarness({
  search,
  previousVisibility = '',
  previousVisibilityPriority = '',
  previousBackground = '',
  previousBackgroundPriority = '',
  cachedTheme = '',
} = {}) {
  const frameCallbacks = [];
  const timers = new Map();
  const presentSelectors = new Set();
  const storage = new Map();
  if (cachedTheme) storage.set('zhihu-centered-home-theme', cachedTheme);
  let nextTimerId = 1;
  const documentElement = new FakeElement('HTML');
  if (previousVisibility) {
    documentElement.style.setProperty(
      'visibility',
      previousVisibility,
      previousVisibilityPriority,
    );
  }
  if (previousBackground) {
    documentElement.style.setProperty(
      'background-color',
      previousBackground,
      previousBackgroundPriority,
    );
  }

  const document = {
    documentElement,
    head: null,
    createElement: (tagName) => new FakeElement(tagName.toUpperCase()),
    getElementById: (id) => findById(documentElement, id),
    querySelector: (selector) => (presentSelectors.has(selector) ? new FakeElement('DIV') : null),
    addEventListener() {},
  };
  const location = {
    hostname: 'www.zhihu.com',
    pathname: '/',
    search: search || '',
    hash: '',
    reload() {},
  };
  function applyUrl(url) {
    if (!url) return;
    const parsed = new URL(url, 'https://www.zhihu.com/');
    location.hostname = parsed.hostname;
    location.pathname = parsed.pathname;
    location.search = parsed.search;
    location.hash = parsed.hash;
  }
  const history = {
    state: null,
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
    addEventListener() {},
    requestAnimationFrame(callback) {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    },
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    sessionStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
  };

  const scriptPath = require.resolve('../zhihu-centered-home.user.js');
  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: scriptPath });
  return { documentElement, frameCallbacks, presentSelectors, storage, timers };
}

async function main() {
  const documentListeners = new Map();
  const frameCallbacks = [];
  const presentSelectors = new Set();
  const storage = new Map();
  let fallbackCallback = null;
  let reloadCount = 0;
  const documentElement = new FakeElement('HTML');
  const document = {
    documentElement,
    head: null,
    createElement: (tagName) => new FakeElement(tagName.toUpperCase()),
    getElementById: (id) => findById(documentElement, id),
    querySelector: (selector) => (presentSelectors.has(selector) ? new FakeElement('DIV') : null),
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
  };
  const location = {
    hostname: 'www.zhihu.com',
    pathname: '/',
    search: '?theme=dark',
    hash: '',
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
    location.hash = parsed.hash;
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
    sessionStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
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
  assert.equal(documentElement.style.getPropertyValue('background-color'), '#000', 'dark refresh paints a dark canvas while content is cloaked');
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-booting'), true, 'boot marker suppresses first-paint transitions');
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'homepage is enabled at document start');
  assert.equal(documentElement.getAttribute('data-theme'), 'dark', 'theme=dark enables Zhihu native dark mode at document start');
  assert.equal(storage.get('zhihu-centered-home-theme'), 'dark', 'effective theme is cached for the next refresh');
  const earlyStyle = document.getElementById('zhihu-centered-home-style');
  assert.ok(earlyStyle, 'style is installed before the head element exists');
  assert.equal(earlyStyle.parentElement, documentElement, 'early style is attached directly to the document root');

  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), 'hidden', 'page stays cloaked while React has not mounted the main layout');

  presentSelectors.add('.AppHeader');
  presentSelectors.add('.AppHeader .SearchBar');
  presentSelectors.add('.Topstory-container');
  presentSelectors.add('.Topstory-mainColumn');
  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), 'hidden', 'the first ready frame is not enough to reveal the page');
  presentSelectors.delete('.Topstory-mainColumn');
  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), 'hidden', 'a disappearing layout sentinel resets the stability check');
  presentSelectors.add('.Topstory-mainColumn');
  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), 'hidden', 'layout must become stable for a fresh first frame');
  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), '', 'page is revealed after two stable animation frames');
  assert.equal(documentElement.style.getPropertyValue('background-color'), '', 'temporary dark canvas is restored after reveal');
  assert.equal(fallbackCallback, null, 'the reveal fallback is cleared after a successful reveal');
  frameCallbacks.shift()();
  frameCallbacks.shift()();
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-booting'), false, 'transition suppression is removed two frames after reveal');

  document.head = new FakeElement('HEAD');
  documentElement.appendChild(document.head);
  const firstStyle = document.getElementById('zhihu-centered-home-style');
  assert.equal(firstStyle, earlyStyle, 'creating the head does not replace the already-active style');
  assert.match(firstStyle.textContent, /html\[data-zhihu-centered-home\] body[\s\S]*background-color: #f4f6f9/, 'light layout has a permanent matching canvas color');
  assert.match(firstStyle.textContent, /\[data-theme="dark"\] body[\s\S]*background-color: #000/, 'dark layout has a permanent black canvas color');
  assert.match(firstStyle.textContent, /data-zhihu-centered-booting[\s\S]*transition: none[\s\S]*animation: none/, 'boot marker suppresses first-paint motion');
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
  assert.match(firstStyle.textContent, /\.QuestionHeader-content \{[\s\S]*padding-left: 0/, 'question content removes the obsolete side-column gutter');
  assert.match(firstStyle.textContent, /\.QuestionHeader-main \{[\s\S]*box-sizing: border-box/, 'question text keeps native padding inside the centered width');
  assert.match(firstStyle.textContent, /\.QuestionHeader > \.QuestionHeader-content \.QuestionHeader-main > \* \{[\s\S]*display: none/, 'question header hides every component by default');
  assert.match(firstStyle.textContent, /> \.QuestionHeader-title,[\s\S]*> :has\(\.QuestionRichText\) \{[\s\S]*display: block/, 'question header whitelist restores only title and description');
  assert.match(firstStyle.textContent, /\.QuestionHeader > \.QuestionHeader-footer \{[\s\S]*display: none/, 'question follow and answer action row is removed');
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
  assert.equal(documentElement.style.getPropertyValue('visibility'), 'hidden', 'SPA navigation to new supported content starts a fresh cloak');
  presentSelectors.add('.QuestionHeader > .QuestionHeader-content .QuestionHeader-title');
  presentSelectors.add('.Question-mainColumn');
  documentElement.appendChild(new FakeElement('DIV'));
  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), 'hidden', 'SPA content remains cloaked for its first stable frame');
  frameCallbacks.shift()();
  assert.equal(documentElement.style.getPropertyValue('visibility'), '', 'SPA content is revealed after its second stable frame');
  frameCallbacks.shift()();
  frameCallbacks.shift()();

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

  let doubleClickPrevented = false;
  for (const listener of documentListeners.get('dblclick') || []) {
    listener({
      target: {
        closest(selector) {
          return selector === '.AppHeader' ? {} : null;
        },
      },
      preventDefault() {
        doubleClickPrevented = true;
      },
    });
  }
  assert.equal(doubleClickPrevented, true, 'double-clicking empty header space prevents accidental text selection');
  assert.equal(documentElement.getAttribute('data-theme'), 'dark', 'double-clicking empty header space enables dark mode');
  assert.equal(location.search, '?theme=dark', 'header toggle writes dark mode to the current URL');

  for (const listener of documentListeners.get('dblclick') || []) {
    listener({
      target: {
        closest(selector) {
          if (selector === '.AppHeader') return {};
          if (selector.includes('input')) return {};
          return null;
        },
      },
      preventDefault() {
        throw new Error('interactive header controls must not toggle the theme');
      },
    });
  }
  assert.equal(documentElement.getAttribute('data-theme'), 'dark', 'double-clicking the search box does not change theme');

  for (const listener of documentListeners.get('dblclick') || []) {
    listener({
      target: {
        closest(selector) {
          return selector === '.AppHeader' ? {} : null;
        },
      },
      preventDefault() {},
    });
  }
  assert.equal(documentElement.getAttribute('data-theme'), 'light', 'a second header double-click returns to light mode');
  assert.equal(location.search, '?theme=light', 'header toggle writes light mode to the current URL');

  const timeoutHarness = createBootHarness({
    search: '?theme=dark',
    previousVisibility: 'collapse',
    previousVisibilityPriority: 'important',
    previousBackground: 'rgb(1, 2, 3)',
  });
  assert.equal(timeoutHarness.timers.size, 1, 'boot gate installs exactly one reveal fallback');
  const [fallbackId, fallbackTimer] = [...timeoutHarness.timers.entries()][0];
  assert.equal(fallbackTimer.delay, 4000, 'fallback allows React time to mount before giving up');
  timeoutHarness.timers.delete(fallbackId);
  fallbackTimer.callback();
  assert.equal(timeoutHarness.documentElement.style.getPropertyValue('visibility'), 'collapse', 'timeout restores a pre-existing visibility value');
  assert.equal(timeoutHarness.documentElement.style.getPropertyPriority('visibility'), 'important', 'timeout restores visibility priority');
  assert.equal(timeoutHarness.documentElement.style.getPropertyValue('background-color'), 'rgb(1, 2, 3)', 'timeout restores the previous canvas background');
  timeoutHarness.frameCallbacks.shift()();
  assert.equal(timeoutHarness.documentElement.style.getPropertyValue('visibility'), 'collapse', 'a stale readiness frame cannot hide or reveal again after timeout');

  const lightHarness = createBootHarness({ search: '?theme=light' });
  assert.equal(lightHarness.documentElement.style.getPropertyValue('background-color'), '#f4f6f9', 'light refresh paints a matching light canvas');
  assert.equal(lightHarness.documentElement.getAttribute('data-theme'), 'light', 'light theme is applied before the first frame');

  const cachedThemeHarness = createBootHarness({ cachedTheme: 'dark' });
  assert.equal(cachedThemeHarness.documentElement.style.getPropertyValue('background-color'), '#000', 'a refresh without a theme parameter reuses the cached dark canvas');
  assert.equal(cachedThemeHarness.documentElement.getAttribute('data-theme'), null, 'cached canvas color does not override Zhihu theme selection');

  console.log('PASS: userscript restores its style, supports home, question, answer, and article pages, and handles SPA navigation.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
