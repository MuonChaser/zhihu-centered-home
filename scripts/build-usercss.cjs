const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const userscriptPath = path.join(projectRoot, 'zhihu-centered-home.user.js');
const usercssPath = path.join(projectRoot, 'zhihu-centered-home.user.css');
const source = fs.readFileSync(userscriptPath, 'utf8');

const versionMatch = source.match(/^\/\/ @version\s+([^\s]+)$/m);
if (!versionMatch) throw new Error('Unable to find userscript version.');

const cssMatch = source.match(
  /\/\/ USERSTYLE_CSS_START\r?\n\s*const css = `([\s\S]*?)`;\r?\n\s*\/\/ USERSTYLE_CSS_END/,
);
if (!cssMatch) throw new Error('Unable to find the marked userscript CSS template.');

const css = cssMatch[1]
  .replaceAll('html[${PAGE_ATTRIBUTE}]', 'html')
  .replaceAll('${THEME_ATTRIBUTE}', 'data-theme')
  .replaceAll('${BOOT_ATTRIBUTE}', 'data-zhihu-centered-booting')
  .trim();

for (const unresolved of ['${', 'PAGE_ATTRIBUTE', 'THEME_ATTRIBUTE', 'BOOT_ATTRIBUTE']) {
  if (css.includes(unresolved)) {
    throw new Error(`Generated UserCSS still contains ${unresolved}.`);
  }
}

const urlPatterns = [
  '^https://(?:www\\.)?zhihu\\.com/(?:[?#].*)?$',
  '^https://(?:www\\.)?zhihu\\.com/question/[0-9]+(?:/answer/[0-9]+)?/?(?:[?#].*)?$',
  '^https://zhuanlan\\.zhihu\\.com/p/[0-9]+/?(?:[?#].*)?$',
];

const output = `/* ==UserStyle==
@name           知乎 · 简净居中（Stylus 防闪增强）
@namespace      https://github.com/MuonChaser/zhihu-centered-home
@version        ${versionMatch[1]}
@description    在知乎首次绘制前应用简净居中布局，配合主用户脚本最大限度避免刷新时闪现原始页面。
@author         MuonChaser
@license        MIT
@homepageURL    https://github.com/MuonChaser/zhihu-centered-home
@supportURL     https://github.com/MuonChaser/zhihu-centered-home/issues
@updateURL      https://raw.githubusercontent.com/MuonChaser/zhihu-centered-home/main/zhihu-centered-home.user.css
@preprocessor   default
==/UserStyle== */

@-moz-document
${urlPatterns.map((pattern) => `  regexp(${JSON.stringify(pattern)})`).join(',\n')} {
  html {
    --zhihu-centered-usercss-ready: 1;
  }

${css
  .split(/\r?\n/)
  .map((line) => `  ${line}`)
  .join('\n')}
}
`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(usercssPath) ? fs.readFileSync(usercssPath, 'utf8') : '';
  if (current !== output) {
    console.error('zhihu-centered-home.user.css is out of date. Run node scripts/build-usercss.cjs.');
    process.exitCode = 1;
  } else {
    console.log('PASS: generated UserCSS is up to date.');
  }
} else {
  fs.writeFileSync(usercssPath, output);
  console.log(`Generated ${path.relative(projectRoot, usercssPath)}.`);
}
