# FiveM Security Audit

[![npm](https://img.shields.io/npm/v/fivem-security-audit)](https://www.npmjs.com/package/fivem-security-audit)
[![downloads](https://img.shields.io/npm/dm/fivem-security-audit)](https://www.npmjs.com/package/fivem-security-audit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A Claude Code skill that reviews a FiveM or RedM resource the way an attacker would read it, then hands you a report you can act on. Backdoors, dupes, SQL injection, NUI exploits, crash vectors, performance leaks. It reads the code, quotes the exact line, and tells you how to fix it.

```bash
npx fivem-security-audit
```

Restart Claude Code, then run it in any resource folder:

```
/fivem-security-audit
```

Or just ask: "audit this resource", "scan this script for backdoors", "is this safe for production?". Pick a single phase with `/fivem-security-audit security` or `performance`.

## What it looks for

**Malware and backdoors.** Remote code execution, the Cipher and Blum/Warden families, obfuscation (hex, XOR, base64, Luraph, JScrambler), token grabbers, Discord and Telegram exfiltration, supply-chain injection into txAdmin and build files, known C2 domains and IPs. It knows the difference between a real backdoor and a legitimate anti-dump loader.

**Your build chain.** Modern resources ship a compiled React bundle nobody reads, built on hundreds of npm packages. The audit covers the bundle and the dependency manifest — install scripts, lockfiles, typosquats — and reports a minified bundle shipped without source as unaudited rather than clean.

**Exploitable code.** Money and item dupes, event forgery from cheat menus, NUI callback abuse, state-bag floods, entity spoofing, weak permissions, second-order SQL injection. The threat model assumes the player is hostile and the anti-cheat is bypassable.

**Performance and stability.** Wasteful `Wait(0)` threads, uncached natives, N+1 queries, leaked streaming assets, missing `playerDropped` and `onResourceStop` cleanup, all measured against real resmon budgets and the whole-server frame budget.

**Platform posture.** The server-side controls that actually stop the crash and trust exploits — `sv_stateBagStrictMode`, entity lockdown, the full state-bag rate-limiter set — and a GTA V Enhanced migration pass for what breaks when you move off Legacy.

Every finding carries a confidence level, a file and line, the exploit, and a copy-paste fix. The report ends with a score out of 100 and a hard gate: any unresolved critical means not production ready.

## What a report looks like

```
# FiveM Audit Report — fancy_shop
Date: 2026-06-21 | Type: Economy | Score: 38/100

## Summary
CRITICAL 3 | HIGH 2 | MEDIUM 1

### [CRITICAL] [SEC-1.10] Client-controlled price trusted by server
- Confidence: CONFIRMED
- File: server/main.lua:24
- Issue: buy event uses the price sent by the client
- Exploit: a cheat menu fires shop:buy with price = -100000 to mint money
- Fix:
    local item = Config.Items[itemId]   -- server-authoritative
    if not item then return end
    local total = item.price * qty

Verdict: NOT production ready — 3 unresolved CRITICAL.
```

## Coverage

Frameworks: ESX Legacy, QBCore, QBox (ox_core), ND_Core, ox_lib, standalone, and RedM (VORP, RSG, RedEM).

Builds: GTA V Legacy and Enhanced. The audit works out which one you are on, because several findings change meaning between them.

Escrow-aware: encrypted `.fxap` source is reported as unaudited, never waved through as clean. Same rule for a minified NUI bundle with no source.

## The toolkit

| Stage | Tool |
|-------|------|
| Build | [fivem-resource-builder](https://github.com/matiaspalmac/fivem-resource-builder) |
| Audit | **fivem-security-audit** |
| Protect | [dei_security_scanner](https://github.com/matiaspalmac/dei_security_scanner) |

Build it secure, audit the diff before you deploy, run the scanner so anything injected later gets caught.

## License

MIT
