import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Manual, read-only report: never a release/CI/prod authority.
const EXCLUDED = ['docs/history/', 'docs/maintenance/', 'docs/certification-readiness/'];
const normalize = value => value.split(path.sep).join('/');

function listActiveMarkdown(root) {
  const result = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = normalize(path.relative(root, absolute));
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED.some(prefix => `${relative}/`.startsWith(prefix))) visit(absolute);
      } else if (entry.isFile() && entry.name.endsWith('.md')) result.push(absolute);
    }
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) result.push(path.join(root, entry.name));
  }
  const docs = path.join(root, 'docs');
  if (fs.existsSync(docs) && fs.statSync(docs).isDirectory()) visit(docs);
  return result.sort();
}

export function checkDocumentation(rootPath) {
  const root = path.resolve(rootPath);
  if (!fs.statSync(root).isDirectory()) throw new Error('Repository root is not a directory');
  const issues = [];
  let checkedLinks = 0;
  let activeFiles = 0;
  const add = (file, type, detail) => issues.push({ file, type, detail });

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const versions = [pkg.version, lock.version, lock.packages?.['']?.version];
    if (!versions.every(value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value))) {
      add('package.json/package-lock.json', 'invalid-version', versions.join(' / '));
    } else if (new Set(versions).size !== 1) {
      add('package.json/package-lock.json', 'version-mismatch', versions.join(' / '));
    }
  } catch (error) {
    add('package.json/package-lock.json', 'unreadable-version', error.message);
  }

  for (const absolute of listActiveMarkdown(root)) {
    const relative = normalize(path.relative(root, absolute));
    activeFiles++;
    const content = fs.readFileSync(absolute, 'utf8');
    // Intentionally bounded: ordinary inline Markdown links only; external URLs/anchors skipped.
    for (const match of content.matchAll(/!?\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
      let target = match[1].trim().replace(/^<|>$/g, '');
      if (!target || target.startsWith('#') || target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      target = target.split('#')[0].split('?')[0];
      if (!target) continue;
      checkedLinks++;
      try { target = decodeURIComponent(target); }
      catch { add(relative, 'invalid-link-encoding', match[1]); continue; }
      // Links with a Markdown title or other non-path syntax require manual review.
      if (/\s/.test(target)) continue;
      const resolved = path.resolve(path.dirname(absolute), target);
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        add(relative, 'out-of-repository-link', target);
      } else if (!fs.existsSync(resolved)) {
        add(relative, 'missing-link-target', target);
      }
    }
  }
  return { root, activeFiles, checkedLinks, exclusions: EXCLUDED, issues };
}

const script = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (script === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--root')) {
    console.error('Usage: node docs/scripts/check-documentation.mjs [--root <repo>]');
    process.exitCode = 2;
  } else {
    try {
      const root = args.length ? args[1] : path.resolve(path.dirname(script), '../..');
      const report = checkDocumentation(root);
      console.log(`DOC CHECK (REPORT ONLY): ${report.activeFiles} active Markdown files, ${report.checkedLinks} relative links, ${report.issues.length} findings`);
      for (const issue of report.issues) console.log(`WARN ${issue.type}: ${issue.file}: ${issue.detail}`);
      console.log('No files changed. Historical snapshots, external URLs, anchors, and semantic claims are not validated.');
      // Findings do not fail the command: owner-approved report-only mode.
    } catch (error) {
      console.error(`DOC CHECK COULD NOT RUN: ${error.message}`);
      process.exitCode = 2;
    }
  }
}
