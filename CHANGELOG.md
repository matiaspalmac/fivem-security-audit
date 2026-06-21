# Changelog

All notable changes to `fivem-security-audit`.

## [1.0.0] — 2026-06-21

First release under the `fivem-security-audit` name (relaunch of the former `fivem-audit`). Optimized for Claude Opus 4.8.

### Skill / tooling
- Frontmatter for Opus 4.8: `effort: max`, `model` left to `inherit`, lean `allowed-tools` (`Read`/`Grep`/`Glob`), pushy auto-trigger description.
- Selectable audit modes via argument: `full` (default), `security`, `performance`, `cleanup`, `compatibility`, `malware`.
- Dual threat model: external/supply-chain malware **and** in-server hostile clients.
- Modular `checks/` with progressive loading; table of contents on the large malware reference.

### Security (`checks/security.md`, 1.1–1.19)
- Cfx canonical alignment: `source ~= 65535` for server-only events; referenced official "Secure your events".
- **1.16 Hostile-client / cheat-menu resistance** — Lua executors (Eulen, redENGINE, Lynx), forged `TriggerServerEvent`, event-name dumping, NUI replay.
- **1.17 Anti-cheat coverage map** — runtime-AC vs script-level fix ownership; ACs as defense-in-depth, not a substitute.
- **1.18 OneSync & routing-bucket hardening** — entity lockdown modes, server-side spawning, bucket isolation.
- **1.19 Server-crash / DoS vectors** — state-bag flood, oversized payloads, entity/scenario spam.
- ox ecosystem checks (ox_inventory hooks/instances/dupes, ox_lib, ox_target, oxmysql).

### Malware (`checks/malware.md`, M.1–M.14)
- 2025-2026 threat intel: Blum/Warden family (domains + C2 IPs), Cipher, FiveHub, Dark Utilities.
- **M.14 txAdmin & build-pipeline supply chain** — `X-TxAdmin-Token` hijack, `*_builder.js` injection, GlobalState beacons (`miauss`/`ggWP`).
- False-positive guard: flag dangerous combinations, never primitives in isolation.

### Performance (`checks/performance.md`)
- **2.7 Measurement & thresholds** — resmon-anchored budgets.

### Scoring
- Compound penalties for DoS (no size cap) and server actions with no server-side auth.

### Validation
- `examples/` corpus: `vulnerable_shop` + `secure_shop` with `EXPECTED.md` oracle (repo-only, excluded from the npm package).

### Post-release intel syncs
- Expanded Blum/Warden IOC domain set + Cipher markers; synced with `dei_security_scanner`.
- **M.2i Native-invoke evasion** — `Citizen.InvokeNative`/`GetNative` by-hash detection guidance.
- txAdmin / operator hardening recommendations (port, Cfx.re ID + 2FA, reverse proxy, token rotation).
