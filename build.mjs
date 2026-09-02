// build.mjs — assemble case study pages from the shared shell + page sources.
//
// Source of truth for the site's look lives in portfolio/shell/ (header, footer,
// favicon, scripts, and the two CSS partials). Each case study is authored as a
// small content file in portfolio/pages/<slug>.html. This script inlines the
// shell into each page and writes a fully self-contained static .html to the
// site root — no runtime includes, so GitHub Pages / offline behave exactly as
// before.
//
// Usage:  node build.mjs            build every page in pages/
//         node build.mjs <slug>     build a single page (pages/<slug>.html)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHELL = path.join(ROOT, 'shell');
const PAGES = path.join(ROOT, 'pages');

const read = (p) => fs.readFileSync(p, 'utf8');

// --- Load the shared shell once ---
const favicon = read(path.join(SHELL, 'favicon.html')).trim();
const header = read(path.join(SHELL, 'header.html')).trim();
const footerTpl = read(path.join(SHELL, 'footer.html')).trim();
const scripts = read(path.join(SHELL, 'scripts.html')).trim();
const shellCss = read(path.join(SHELL, 'shell.css')).trim();
const caseStudyCss = read(path.join(SHELL, 'case-study.css')).trim();

// --- Parse a page source: `---` front matter, then body (optional
//     <style data-page>…</style> + <main>…</main>). ---
function parsePage(txt) {
  const fm = txt.match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!fm) throw new Error('missing --- front matter block');
  const meta = {};
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  let body = txt.slice(fm[0].length);

  let pageCss = '';
  body = body.replace(/<style data-page>([\s\S]*?)<\/style>/i, (_, css) => {
    pageCss = css.trim();
    return '';
  });

  const mainMatch = body.match(/<main[\s\S]*?<\/main>/i);
  const main = mainMatch ? mainMatch[0].trim() : body.trim();

  return { meta, pageCss, main };
}

function buildPage(slug) {
  const srcPath = path.join(PAGES, slug + '.html');
  const { meta, pageCss, main } = parsePage(read(srcPath));

  for (const key of ['title', 'description', 'footerLabel']) {
    if (!meta[key]) throw new Error(`${slug}: front matter missing "${key}"`);
  }

  const css = [shellCss, caseStudyCss, pageCss].filter(Boolean).join('\n\n');
  const footer = footerTpl.replace('{{FOOTER_LABEL}}', meta.footerLabel);

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description}" />

  ${favicon}

  <!-- All fonts self-hosted from /fonts — no external CDN, works offline & on GitHub Pages -->

  <script>document.documentElement.classList.add("js");</script>

  <style>
${css}
  </style>
</head>

<body>
  <a href="#intro" class="skip-link">Skip to content</a>

  ${header}

  ${main}

  ${footer}

  ${scripts}
</body>
</html>
`;

  const outPath = path.join(ROOT, slug + '.html');
  fs.writeFileSync(outPath, html);
  return outPath;
}

const only = process.argv[2];
const slugs = only
  ? [only.replace(/\.html$/, '')]
  : fs.readdirSync(PAGES).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));

for (const slug of slugs) {
  const out = buildPage(slug);
  console.log('built', path.relative(ROOT, out));
}
