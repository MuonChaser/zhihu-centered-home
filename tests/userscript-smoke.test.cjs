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

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Set();
    this.id = '';
    this.textContent = '';
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

  toggleAttribute(name, force) {
    const hadAttribute = this.attributes.has(name);
    const shouldHaveAttribute = force === undefined ? !hadAttribute : Boolean(force);
    if (shouldHaveAttribute) this.attributes.add(name);
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
  const documentElement = new FakeElement('HTML');
  const document = {
    documentElement,
    head: null,
    createElement: (tagName) => new FakeElement(tagName.toUpperCase()),
    getElementById: (id) => findById(documentElement, id),
    addEventListener: () => {},
  };
  const location = {
    hostname: 'www.zhihu.com',
    pathname: '/',
  };
  const history = {
    pushState(_state, _title, url) {
      if (url) location.pathname = new URL(url, 'https://www.zhihu.com/').pathname;
    },
    replaceState(_state, _title, url) {
      if (url) location.pathname = new URL(url, 'https://www.zhihu.com/').pathname;
    },
  };
  const context = {
    MutationObserver: FakeMutationObserver,
    URL,
    document,
    history,
    location,
    queueMicrotask,
    addEventListener: () => {},
  };

  const scriptPath = require.resolve('../zhihu-centered-home.user.js');
  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: scriptPath });

  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'homepage is enabled at document start');
  assert.equal(document.getElementById('zhihu-centered-home-style'), null, 'style waits for the head element');

  document.head = new FakeElement('HEAD');
  documentElement.appendChild(document.head);
  const firstStyle = document.getElementById('zhihu-centered-home-style');
  assert.ok(firstStyle, 'style is installed when head appears');
  assert.match(firstStyle.textContent, /Topstory-mainColumn \+ div/, 'style contains the structural sidebar selector');
  assert.match(firstStyle.textContent, /Question-sideColumn/, 'style hides the answer-page sidebar');
  assert.match(firstStyle.textContent, /QuestionHeader-content/, 'style centers the answer-page header');
  assert.match(firstStyle.textContent, /AppHeader[\s\S]*SearchBar/, 'style reduces the app header to the search bar');
  assert.match(firstStyle.textContent, /a\[aria-label="知乎"\]/, 'style keeps the Zhihu logo beside the centered search bar');
  assert.match(firstStyle.textContent, /left: calc\(50% - 352px\)/, 'logo placement does not move the search bar off center');
  assert.match(firstStyle.textContent, /\.SearchBar \{[\s\S]*position: fixed[\s\S]*left: 50%/, 'search bar is centered against the viewport');
  assert.match(firstStyle.textContent, /input::placeholder[\s\S]*color: transparent/, 'suggested search placeholder is hidden');
  assert.match(firstStyle.textContent, /\.AppHeader \{[\s\S]*background: rgba\(246, 247, 249, 0\.88\)[\s\S]*backdrop-filter: blur/, 'header always has a blurred background');
  assert.doesNotMatch(firstStyle.textContent, /data-zhihu-centered-scrolled/, 'header style does not switch when scrolling');
  assert.match(firstStyle.textContent, /Pc-Business-Card-PcTopFeedBanner/, 'style hides the homepage promotion banner');
  assert.match(firstStyle.textContent, /WriteArea/, 'style hides the homepage composer card');
  assert.match(firstStyle.textContent, /\.QuestionHeader \{[\s\S]*width: 694px[\s\S]*border-radius: 10px/, 'style keeps the question header as a centered card');
  assert.match(firstStyle.textContent, /\.QuestionHeader-detail \{[\s\S]*line-height: 1\.75/, 'style preserves and formats the question description');
  assert.match(firstStyle.textContent, /\.PageHeader \{[\s\S]*display: none/, 'style hides only the duplicate sticky question header');

  document.head.removeChild(firstStyle);
  assert.ok(document.getElementById('zhihu-centered-home-style'), 'style is restored after Zhihu removes it');

  documentElement.removeAttribute('data-zhihu-centered-home');
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'homepage marker is restored after removal');

  history.pushState({}, '', '/question/123');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'layout is enabled on a regular question page');

  history.pushState({}, '', '/search?q=test');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), false, 'layout is disabled on unrelated pages');

  history.pushState({}, '', '/question/123/answer/456');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'layout is enabled on an answer page');

  history.replaceState({}, '', '/question/123/answer/456/');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'answer pages support a trailing slash');

  history.pushState({}, '', '/');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentElement.hasAttribute('data-zhihu-centered-home'), true, 'layout is re-enabled after returning home');

  console.log('PASS: userscript restores its style, supports home, question, and answer pages, and handles SPA navigation.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
