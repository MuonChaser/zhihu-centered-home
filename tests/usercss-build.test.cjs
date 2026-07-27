const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const userscript = fs.readFileSync(
  path.join(projectRoot, 'zhihu-centered-home.user.js'),
  'utf8',
);
const usercss = fs.readFileSync(
  path.join(projectRoot, 'zhihu-centered-home.user.css'),
  'utf8',
);

const userscriptVersion = userscript.match(/^\/\/ @version\s+([^\s]+)$/m)?.[1];
const usercssVersion = usercss.match(/^@version\s+([^\s]+)$/m)?.[1];
assert.ok(userscriptVersion, 'userscript exposes a version');
assert.equal(usercssVersion, userscriptVersion, 'UserCSS version matches the userscript');

assert.doesNotMatch(usercss, /\$\{|PAGE_ATTRIBUTE|THEME_ATTRIBUTE|BOOT_ATTRIBUTE/, 'UserCSS contains no unresolved template values');
assert.doesNotMatch(usercss, /data-zhihu-centered-home/, 'UserCSS applies before the userscript page marker exists');
assert.match(usercss, /--zhihu-centered-usercss-ready: 1/, 'UserCSS exposes an early-style readiness marker');
assert.match(usercss, /\.QuestionHeader > \.QuestionHeader-content \.QuestionHeader-main > \*/, 'UserCSS contains the question component whitelist');

const patterns = [...usercss.matchAll(/^\s*regexp\(("(?:[^"\\]|\\.)*")\)\s*(?:,|\{)?\s*$/gm)]
  .map((match) => new RegExp(JSON.parse(match[1])));
assert.equal(patterns.length, 3, 'UserCSS contains exactly three supported-route patterns');

const supportedUrls = [
  'https://www.zhihu.com/',
  'https://zhihu.com/?theme=dark',
  'https://www.zhihu.com/question/12628881447',
  'https://www.zhihu.com/question/12628881447/?theme=light',
  'https://www.zhihu.com/question/1920168108980695603/answer/1961401192220440137?theme=dark',
  'https://zhuanlan.zhihu.com/p/123456789#comments',
];
for (const url of supportedUrls) {
  assert.equal(patterns.some((pattern) => pattern.test(url)), true, `UserCSS supports ${url}`);
}

const unsupportedUrls = [
  'https://www.zhihu.com/search?q=test',
  'https://www.zhihu.com/people/muonchaser',
  'https://www.zhihu.com/hot',
  'https://www.zhihu.com/question/not-a-number',
  'https://zhuanlan.zhihu.com/',
];
for (const url of unsupportedUrls) {
  assert.equal(patterns.some((pattern) => pattern.test(url)), false, `UserCSS excludes ${url}`);
}

const check = spawnSync(
  process.execPath,
  [path.join(projectRoot, 'scripts', 'build-usercss.cjs'), '--check'],
  { cwd: projectRoot, encoding: 'utf8' },
);
assert.equal(check.status, 0, check.stderr || check.stdout);

console.log('PASS: generated UserCSS is synchronized and scoped to supported Zhihu routes.');
