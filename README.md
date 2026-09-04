# FiveM Security Audit

[![npm](https://img.shields.io/npm/v/fivem-security-audit)](https://www.npmjs.com/package/fivem-security-audit)
[![downloads](https://img.shields.io/npm/dm/fivem-security-audit)](https://www.npmjs.com/package/fivem-security-audit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**A reviewer, not a scanner.**

Backdoor scanners answer one question: *does this file contain a string somebody already catalogued?*
That misses the bug that actually drains your economy, because a money dupe has no signature.

This answers the question you actually have:

> **Can a player on my server mint money, crash it, or hand themselves admin — and should I trust this file at all?**

It reads the code, reasons about who can reach each line and with what input, quotes the exact line, and tells you how to fix it. It is a Claude Code skill, so the "reading and reasoning" is real reading, not a regex pass.

```bash
npx fivem-security-audit
```

Restart Claude Code, then run it in any resource folder:

```
/fivem-security-audit
```

Or just ask: *"audit this resource"*, *"is this leaked script safe?"*, *"why is my economy leaking money?"*
Single phase: `/fivem-security-audit security`, `provenance`, `performance`, …

## A finding a scanner cannot produce

```lua
local item = Config.Items[itemId]              -- price is server-authoritative
if not item then return end
if type(qty) ~= 'number' or qty < 1 then return end   -- qty is validated positive

local total = item.price * qty
if xPlayer.getMoney() < total then return end  -- balance checked before deducting
xPlayer.removeMoney(total)
```

Every checklist item passes. There is no suspicious string, no obfuscation, no known-bad domain.
It still mints money: `lua54` integers wrap silently on overflow, so a large enough `qty` makes
`total` negative, the balance check passes trivially, and removing a negative amount adds it.

Finding that requires understanding what the code *does*. That is the whole difference.

## What it checks

| Phase | Question it answers |
|-------|---------------------|
| **0 · Provenance** | Where did this file come from, and has anyone been inside it since the vendor shipped it? |
| **1 · Security** | What can a hostile player reach? Dupes, event forgery, SQLi, NUI trust, state bags, entity spoofing, connection/deferrals, HTTP handlers, player-data handling |
| **1b · Malware** | Backdoors, RATs, obfuscation, C2 infrastructure, txAdmin and build-pipeline injection, npm/NUI supply chain |
| **2 · Performance** | What holds the server thread, and what burns frames for nothing? Measured against resmon and whole-server budgets |
| **3 · Cleanup** | What leaks across disconnects and resource restarts? |
| **4 · Compatibility** | Manifest, framework isolation, escrow, RedM, and GTA V Enhanced migration |
| **5 · Architecture** | Code quality grade — reported separately, never mixed into the security gate |

Every finding carries a confidence level, a file and line, the exploit, and a copy-paste fix. The
report ends with a score, a trust tier, and a hard gate: any unresolved critical means not
production ready.

## Provenance: the part nobody else does

The dominant way a backdoor reaches a FiveM server is not a novel exploit. It is a **leaked or
cracked paid script that someone repacked with a loader before releasing it for free** — the "free"
copy *is* the attack.

So the audit starts by asking where the file came from and assigns a trust tier. That changes the
standard of proof for everything after it, and it changes the verdict:

> A resource with an unknown origin that scans clean is reported as **"no backdoor found"**, never
> **"clean"**. Those are different claims and the report says which one it can make.

It also looks for signs somebody has been inside the file: stripped escrow, altered `fxmanifest`
paths, grafted code style, orphan files, a removed vendor license check.

## What it will not do

A tool that claims to catch everything is lying, and the report says so explicitly:

| Method | Good at | Blind to |
|--------|---------|----------|
| **This skill** — semantic review | Logic flaws with no malicious string: dupes, races, missing authorization, trust boundaries. *Why* something is dangerous in context | Anything it cannot read: escrow, minified bundles, compiled DLLs, very large trees. Attribution |
| **Pattern / entropy scanner** | Fast bulk triage over thousands of files, known signatures, multi-million-entry blocklists | Everything semantic. A readable dupe has no signature |
| **Runtime monitor** | What shows up *after* review: injected files, live egress, integrity drift | Anything that does not execute while it is watching |

On a large or untrusted tree, run a bulk scanner first to triage, then point this at what it flags
plus the server-authoritative code paths. Different instruments, same job.

## Things it will tell you that you probably did not know

A sample of what the current checks encode:

- `sv_enableDevtools` **does not exist** — it is an unimplemented feature request, and every config
  guide that recommends it is giving you a no-op. The real control is `sv_devMode`.
- `sv_stateBagStrictMode true` stops clients writing replicated state at the platform layer, which
  is a stronger fix than per-resource validation.
- FiveM's server JavaScript runtime **defaults to Node 16.x**, long past end-of-life. Opt into a
  supported runtime with `node_version '22'`.
- `SetHttpHandler` endpoints are served on the **public game port**, alongside `/info.json`. They
  are internet-facing with no auth unless you wrote it.
- Setup guides commonly tell you to put a Discord bot token in a `setr` convar. `setr` replicates to
  every client — that token is readable from the F8 console and should be considered burned.
- The `CommunityOx` fork of the ox resources was **archived in April 2026**. If you pinned to it,
  nobody is shipping you fixes.

## Coverage

Frameworks: ESX Legacy, QBCore, QBox (`ox_core`), ND_Core, `ox_lib`, standalone, and RedM (VORP, RSG, RedEM).

Builds: GTA V **Legacy and Enhanced** — the audit works out which one you are on, because several findings change meaning between them.

Runtimes: Lua, server-side JavaScript (dependency tree audited at critical severity), and C# source where it ships.

Escrow-aware: encrypted `.fxap` source is reported as unaudited, never waved through as clean. Same rule for a minified bundle or a compiled assembly.

## The toolkit

| Stage | Tool |
|-------|------|
| Build | [fivem-resource-builder](https://github.com/matiaspalmac/fivem-resource-builder) |
| Audit | **fivem-security-audit** |
| Protect | [dei_security_scanner](https://github.com/matiaspalmac/dei_security_scanner) |

Build it secure, audit the diff before you deploy, run the scanner so anything injected later gets caught.

## Contributing

Threat intel goes stale fast. If you have seen a pattern the checks miss — a new C2 domain, a dupe
class, a framework pitfall — open an issue or a PR against the relevant file in `checks/`.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
