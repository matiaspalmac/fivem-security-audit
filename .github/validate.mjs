import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const skill = readFileSync('SKILL.md', 'utf8').replace(/\r\n/g, '\n');
const fm = skill.match(/^---\n([\s\S]*?)\n---/);
if (!fm) { console.error('SKILL.md has no frontmatter'); process.exit(1); }

const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim();
const desc = (fm[1].match(/^description:\s*"([^"]*)"/m) || [])[1];

if (!name || !/^[a-z0-9-]+$/.test(name) || name.length > 64) errors.push(`invalid name: ${name}`);
if (!desc) errors.push('missing description');
else {
  if (desc.length > 1024) errors.push(`description ${desc.length} > 1024 chars`);
  if (/[<>]/.test(desc)) errors.push('description contains < or >');
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const f of pkg.files || []) {
  if (!existsSync(f.replace(/\/$/, ''))) errors.push(`package.json files missing: ${f}`);
}

if (errors.length) { console.error('Validation failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`OK: ${name} (description ${desc.length} chars)`);
