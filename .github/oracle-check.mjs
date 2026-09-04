// Validates the audit's own consistency.
//
// The skill is a prompt, so CI cannot run the audit and diff the result. What it
// CAN do is test the content: that the check sections, the validation corpus and
// SKILL.md still agree with each other.
//
// This catches the failure mode that actually happens — renaming or renumbering a
// check silently orphans the fixture that exercises it and the oracle that
// documents it, and nothing complains until someone reads the report and finds a
// dangling reference. Both of those bugs occurred while writing v1.2.0.
//
// Run: node .github/oracle-check.mjs

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const errors = [];
const warnings = [];

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------------
// 1. Index every check section heading, and reject duplicates.
// ---------------------------------------------------------------------------
const PREFIX_TO_FILE = {
    SEC: 'security',
    PERF: 'performance',
    CLEANUP: 'cleanup',
    COMPAT: 'compatibility',
    ARCH: 'architecture',
    PROV: 'provenance',
    M: 'malware',
};

const sections = {}; // file stem -> Set of section ids ('1.13b', 'M.15')

for (const file of readdirSync('checks').filter((f) => f.endsWith('.md'))) {
    const stem = file.replace(/\.md$/, '');
    const body = read(join('checks', file));
    const found = new Set();

    // '## 1.13b Title', '## M.15 Title', '### M.14b Title'
    for (const m of body.matchAll(/^#{2,3}\s+(M\.\d+[a-z]?|\d+\.\d+[a-z]?)\s/gm)) {
        const id = m[1];
        if (found.has(id)) {
            errors.push(`checks/${file}: duplicate section heading "${id}"`);
        }
        found.add(id);
    }

    sections[stem] = found;
    if (found.size === 0) warnings.push(`checks/${file}: no numbered sections found`);
}

// Resolve an ID like 'SEC-1.13b' or 'M.13' to its check file. Returns null when
// the prefix carries no number (e.g. a bare 'COMPAT' tag), which is not an error.
function resolve(rawId) {
    const malware = rawId.match(/^M\.(\d+[a-z]?)$/);
    if (malware) return { stem: 'malware', id: `M.${malware[1]}` };

    const m = rawId.match(/^([A-Z]+)-(\d+\.\d+[a-z]?)$/);
    if (!m) return null;

    const stem = PREFIX_TO_FILE[m[1]];
    if (!stem) return { stem: null, id: m[2], unknownPrefix: m[1] };
    return { stem, id: m[2] };
}

function checkId(rawId, where) {
    const r = resolve(rawId);
    if (!r) return null; // bare prefix, nothing to verify
    if (r.unknownPrefix) {
        errors.push(`${where}: unknown ID prefix "${r.unknownPrefix}" in "${rawId}"`);
        return null;
    }
    if (!sections[r.stem]) {
        errors.push(`${where}: "${rawId}" points at checks/${r.stem}.md which does not exist`);
        return null;
    }
    if (!sections[r.stem].has(r.id)) {
        errors.push(`${where}: "${rawId}" has no matching section "${r.id}" in checks/${r.stem}.md`);
        return null;
    }
    return r;
}

// ---------------------------------------------------------------------------
// 2. The oracle must reference sections that exist.
// ---------------------------------------------------------------------------
const EXPECTED_PATH = 'examples/EXPECTED.md';
const expected = read(EXPECTED_PATH);

// Two kinds of ID appear here, and they carry different obligations:
//   - an ID in the FIRST cell of a findings-table row is a PROMISED finding: the
//     fixture must contain the line that produces it, tagged so a reader can
//     find it;
//   - anything else — prose ("the skill should still explain M.1 when asked"), or
//     an ID cited inside the false-positive trap table — is a cross-reference and
//     only has to resolve to a real section.
const promisedIds = new Set();
const ID_RE = /\b([A-Z]+-\d+\.\d+[a-z]?|M\.\d+[a-z]?)\b/g;

for (const line of expected.split('\n')) {
    for (const m of line.matchAll(ID_RE)) checkId(m[1], EXPECTED_PATH);

    if (!line.trimStart().startsWith('|')) continue;

    // '| SEC-1.4 / M.13 | CRITICAL | file | issue |' → first cell holds the id(s)
    const firstCell = line.split('|')[1];
    if (!firstCell) continue;
    if (!/^[\s`]*(?:[A-Z]+-\d|M\.\d)/.test(firstCell)) continue;

    for (const m of firstCell.matchAll(ID_RE)) promisedIds.add(m[1]);
}

// Fixture files named in the oracle must exist.
for (const m of expected.matchAll(/\|\s*((?:[a-z_]+\/)?[a-z_]+\.(?:lua|html))\s*\|/g)) {
    const rel = m[1];
    if (!existsSync(join('examples/vulnerable_shop', rel))) {
        errors.push(`${EXPECTED_PATH}: references fixture file "${rel}" that does not exist in vulnerable_shop/`);
    }
}

// ---------------------------------------------------------------------------
// 3. The fixtures must stay wired to the checks they exercise.
// ---------------------------------------------------------------------------
function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else out.push(p);
    }
    return out;
}

const markerIds = new Set();

for (const file of walk('examples/vulnerable_shop')) {
    const body = read(file);
    for (const m of body.matchAll(/BUG\[([^\]]+)\]/g)) {
        // A marker may tag several checks: 'SEC-1.4 / MALWARE M.13', 'SEC-1.10/1.3'
        for (const token of m[1].split(/[\s,/]+/)) {
            if (!/^[A-Z]/.test(token)) continue;
            if (token === 'MALWARE') continue;
            markerIds.add(token);
            checkId(token, file);
        }
    }
}

// Every finding the oracle promises must be tagged in the fixture, so a reader
// can find the exact line that produces it — and so renaming a check breaks the
// build instead of silently orphaning the example.
for (const id of promisedIds) {
    if (!markerIds.has(id)) {
        errors.push(`${EXPECTED_PATH}: promises "${id}" but no BUG[${id}] marker tags it in vulnerable_shop/`);
    }
}

// The hardened fixture is the false-positive control: it must contain no bugs.
for (const file of walk('examples/secure_shop')) {
    if (/BUG\[/.test(read(file))) {
        errors.push(`${file}: secure_shop is the false-positive control and must contain no BUG[...] markers`);
    }
}

// ---------------------------------------------------------------------------
// 4. SKILL.md must stay in sync with the checks directory and its own mode list.
// ---------------------------------------------------------------------------
const skill = read('SKILL.md');

for (const stem of Object.keys(sections)) {
    if (!skill.includes(`checks/${stem}.md`)) {
        errors.push(`SKILL.md: never references checks/${stem}.md — the phase is unreachable`);
    }
}

const hint = skill.match(/^argument-hint:\s*"\[([^\]]+)\]"/m);
if (!hint) {
    errors.push('SKILL.md: no argument-hint found');
} else {
    const hintModes = new Set(hint[1].split('|').map((s) => s.trim()));

    // Modes declared in the audit-mode table: rows starting with | `mode`
    const tableModes = new Set();
    for (const m of skill.matchAll(/^\|\s*`([a-z]+)`/gm)) tableModes.add(m[1]);

    for (const mode of hintModes) {
        if (!tableModes.has(mode)) {
            errors.push(`SKILL.md: argument-hint offers "${mode}" but the Audit Mode table does not document it`);
        }
    }
    for (const mode of tableModes) {
        if (!hintModes.has(mode)) {
            errors.push(`SKILL.md: Audit Mode table documents "${mode}" but argument-hint does not offer it`);
        }
    }
}

// ---------------------------------------------------------------------------
// 5. Cross-references between check files must resolve.
// ---------------------------------------------------------------------------
for (const file of readdirSync('checks').filter((f) => f.endsWith('.md'))) {
    const body = read(join('checks', file));
    for (const m of body.matchAll(/checks\/([a-z]+)\.md/g)) {
        if (!existsSync(join('checks', `${m[1]}.md`))) {
            errors.push(`checks/${file}: references checks/${m[1]}.md which does not exist`);
        }
    }
}

// ---------------------------------------------------------------------------
const total = Object.values(sections).reduce((n, s) => n + s.size, 0);
console.log(`checked ${total} sections across ${Object.keys(sections).length} check files, ` +
    `${promisedIds.size} promised findings, ${markerIds.size} fixture markers`);

for (const w of warnings) console.warn(`warning: ${w}`);

if (errors.length) {
    console.error('\nOracle check failed:\n- ' + errors.join('\n- '));
    process.exit(1);
}
console.log('checks, corpus and SKILL.md are consistent');
