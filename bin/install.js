#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILL_NAME = 'fivem-security-audit';
const SKILL_DIR = path.join(os.homedir(), '.claude', 'skills', SKILL_NAME);
const OLD_SKILL_DIR = path.join(os.homedir(), '.claude', 'skills', 'fivem-audit');
const PKG_ROOT = path.join(__dirname, '..');
const SOURCE_SKILL = path.join(PKG_ROOT, 'SKILL.md');
const SOURCE_CHECKS = path.join(PKG_ROOT, 'checks');

let VERSION = '';
try {
    VERSION = require(path.join(PKG_ROOT, 'package.json')).version;
} catch (_) {
    VERSION = 'unknown';
}

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function banner() {
    const title = 'FiveM Security Audit - Claude Code';
    const sub = `v${VERSION} by Dei`;
    const width = title.length + 4;
    const pad = (s) => s + ' '.repeat(Math.max(0, width - s.length - 2));
    console.log('');
    console.log(`${CYAN}${BOLD}  ╔${'═'.repeat(width)}╗${RESET}`);
    console.log(`${CYAN}${BOLD}  ║ ${pad(title)} ║${RESET}`);
    console.log(`${CYAN}${BOLD}  ║ ${pad(sub)} ║${RESET}`);
    console.log(`${CYAN}${BOLD}  ╚${'═'.repeat(width)}╝${RESET}`);
    console.log('');
}

// Replace a directory we fully own, so a file removed or renamed upstream does
// not survive as a stale copy. Merging on top of the old install left orphaned
// checks behind forever, which in a security tool means outdated guidance
// sitting next to current guidance with nothing marking which is which.
function replaceDir(src, dest) {
    if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
    }
    copyDirRecursive(src, dest);
}

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function install() {
    banner();

    // Check if SKILL.md exists in package
    if (!fs.existsSync(SOURCE_SKILL)) {
        console.log(`${RED}Error: SKILL.md not found in package${RESET}`);
        process.exit(1);
    }

    // Create skills directory
    const claudeDir = path.join(os.homedir(), '.claude', 'skills');
    if (!fs.existsSync(claudeDir)) {
        console.log(`${YELLOW}Creating Claude Code skills directory...${RESET}`);
        fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Create skill directory
    if (!fs.existsSync(SKILL_DIR)) {
        fs.mkdirSync(SKILL_DIR, { recursive: true });
    }

    // Remove old skill.md if exists (legacy migration)
    const oldSkill = path.join(SKILL_DIR, 'skill.md');
    if (fs.existsSync(oldSkill)) {
        fs.unlinkSync(oldSkill);
        console.log(`${DIM}  Removed old skill.md (legacy migration)${RESET}`);
    }

    // Remove a previous "fivem-audit" install (this package's former name), but
    // ONLY after confirming it is actually ours. The directory name is not proof
    // of ownership: a user may have written their own skill called fivem-audit,
    // and deleting someone else's work during an unrelated install is not a
    // migration, it is data loss.
    if (fs.existsSync(OLD_SKILL_DIR)) {
        let ownedByUs = false;
        try {
            const oldSkill = path.join(OLD_SKILL_DIR, 'SKILL.md');
            if (fs.existsSync(oldSkill)) {
                const head = fs.readFileSync(oldSkill, 'utf8').slice(0, 2048);
                // The former release declared this exact name in its frontmatter.
                ownedByUs = /^name:\s*fivem-audit\s*$/m.test(head);
            }
        } catch (_) {
            ownedByUs = false;
        }

        if (ownedByUs) {
            fs.rmSync(OLD_SKILL_DIR, { recursive: true, force: true });
            console.log(`${DIM}  Removed the old fivem-audit install (renamed to fivem-security-audit)${RESET}`);
        } else {
            console.log(`${YELLOW}  Note: ${OLD_SKILL_DIR} exists but does not look like this skill's`);
            console.log(`  former release, so it was left alone. Remove it yourself if you meant to.${RESET}`);
        }
    }

    // Copy SKILL.md
    const dest = path.join(SKILL_DIR, 'SKILL.md');
    fs.copyFileSync(SOURCE_SKILL, dest);

    // Replace checks/ wholesale so a check removed upstream does not linger.
    if (fs.existsSync(SOURCE_CHECKS)) {
        const destChecks = path.join(SKILL_DIR, 'checks');
        replaceDir(SOURCE_CHECKS, destChecks);
    }

    const checkFiles = fs.existsSync(SOURCE_CHECKS)
        ? fs.readdirSync(SOURCE_CHECKS).filter(f => f.endsWith('.md'))
        : [];

    console.log(`${GREEN}${BOLD}Installed successfully!${RESET}`);
    console.log('');
    console.log(`  ${CYAN}Skill:${RESET}    ${SKILL_NAME}`);
    console.log(`  ${CYAN}Location:${RESET} ${SKILL_DIR}`);
    console.log(`  ${CYAN}Files:${RESET}    SKILL.md + ${checkFiles.length} check modules`);
    console.log('');

    if (checkFiles.length > 0) {
        console.log(`${BOLD}Check Modules:${RESET}`);
        for (const file of checkFiles) {
            const name = file.replace('.md', '');
            console.log(`  ${GREEN}✓${RESET} checks/${file} ${DIM}(${name})${RESET}`);
        }
        console.log('');
    }

    console.log(`${BOLD}Usage:${RESET}`);
    console.log(`  In Claude Code, navigate to a FiveM resource and type:`);
    console.log('');
    console.log(`    ${GREEN}/fivem-security-audit${RESET}`);
    console.log('');
    console.log(`  Or ask naturally:`);
    console.log(`    ${CYAN}"audit this FiveM resource"${RESET}`);
    console.log(`    ${CYAN}"check security of this script"${RESET}`);
    console.log(`    ${CYAN}"scan for backdoors"${RESET}`);
    console.log('');
    console.log(`${BOLD}What's in v${VERSION}:${RESET}`);
    console.log(`  ${GREEN}+${RESET} Provenance phase: trust tiers, repack/crack indicators, purpose mismatch`);
    console.log(`  ${GREEN}+${RESET} Malware/backdoor module (Blum/Warden, Cipher, C2 IOCs, obfuscation)`);
    console.log(`  ${GREEN}+${RESET} Supply chain: txAdmin, build pipeline, and npm/NUI bundle chain`);
    console.log(`  ${GREEN}+${RESET} Hostile-client threat model (cheat menus, event forgery, DoS)`);
    console.log(`  ${GREEN}+${RESET} Player data, logging and privacy checks`);
    console.log(`  ${GREEN}+${RESET} Connection phase / deferrals and screenshot capture checks`);
    console.log(`  ${GREEN}+${RESET} GTA V Legacy and Enhanced build coverage`);
    console.log(`  ${GREEN}+${RESET} Performance: server thread blocking, resmon and whole-server budgets`);
    console.log('');
    console.log(`${DIM}  Changelog: https://github.com/matiaspalmac/fivem-security-audit/blob/main/CHANGELOG.md${RESET}`);
    console.log('');
    console.log(`${YELLOW}Restart Claude Code for the skill to take effect.${RESET}`);
    console.log('');
}

// Handle --uninstall flag
if (process.argv.includes('--uninstall') || process.argv.includes('-u')) {
    banner();
    if (fs.existsSync(SKILL_DIR)) {
        fs.rmSync(SKILL_DIR, { recursive: true });
        console.log(`${GREEN}Uninstalled successfully!${RESET}`);
        console.log(`  Removed: ${SKILL_DIR}`);
    } else {
        console.log(`${YELLOW}Skill not found at ${SKILL_DIR}${RESET}`);
    }
    console.log('');
    process.exit(0);
}

// Handle --help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    banner();
    console.log(`${BOLD}Commands:${RESET}`);
    console.log(`  ${GREEN}npx fivem-security-audit${RESET}              Install the skill`);
    console.log(`  ${GREEN}npx fivem-security-audit --uninstall${RESET}  Remove the skill`);
    console.log(`  ${GREEN}npx fivem-security-audit --help${RESET}       Show this help`);
    console.log('');
    process.exit(0);
}

install();
