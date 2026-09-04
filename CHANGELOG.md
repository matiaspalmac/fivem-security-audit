# Changelog

All notable changes to `fivem-security-audit`.

## [1.1.0] — 2026-09-04

Threat-intel and platform refresh. The FiveM platform moved (GTA V Enhanced early access,
new state-bag controls) and the resource ecosystem moved with it (built React NUIs, npm
dependency chains). This release closes the resulting gaps and fixes one wrong recommendation.

### Fixed
- **Removed `sv_enableDevtools` from the hardening config — the convar does not exist.** It is an
  unimplemented feature request ([citizenfx/fivem#2667](https://github.com/citizenfx/fivem/issues/2667));
  recommending it gave false assurance. Replaced with `sv_devMode`, and the skill now flags the
  bogus convar if it appears in a server.cfg under audit.
- `sv_entityLockdown` was missing the `full` mode (Enhanced) and did not call out that the
  default `inactive` means unrestricted client spawns.
- State bag hardening listed only one of the three rate-limiter families.

### Added
- **`sv_stateBagStrictMode`** (security 1.12) — first-class mitigation that stops clients writing
  replicated entity/player state, plus guidance on auditing whether a resource breaks under it.
- **Compatibility 4.9 — GTA V Enhanced migration.** Always-on pure mode, P2P/ARQ/HTTP-2 removal,
  OneSync big-mode only, Mono→.NET 10, resource builders unsupported, KVP migration,
  `PrintRemoteCommandLog()`, single endpoints, Alchemist asset conversion, escrow not yet shipped
  on Enhanced. Audit workflow now determines the build target before reporting.
- **Malware M.15 — NUI build & npm dependency supply chain.** Committed bundles shipped without
  source are now reported as UNAUDITED (like escrow); install-script, lockfile, typosquat and
  bundle-IOC checks added. Motivated by the 2026 npm compromises (Shai-Hulud worm, axios
  account takeover with `plain-crypto-js` postinstall RAT, `@redhat-cloud-services`, secret-stealing
  typosquats).
- **Performance 2.8 — platform-level levers**: `sv_syncTickRate` (replaces deprecated
  `sv_useAccurateSends`), `sv_resourceFileDownloadTimeout`, resource-count overhead, OneSync
  ~424-unit focus zone as a waste check.
- Whole-server frame budget (~8 ms across all resources) and `profiler record/view` guidance.
- Platform Posture table in the report format; scoring entries for txAdmin injection markers,
  malicious npm dependencies, and stale vendored ox_inventory. UNAUDITED surface is now explicitly
  non-scoring rather than being folded into a pass.

### Updated intel
- **Blum/Warden**: scale from the March 2026 C2 infiltration (3,856 servers, 1,859 players' PII;
  ESX 48% / QBCore 36% / vRP 9%), the three exact txAdmin `monitor/` injection points
  (`helpEmptyCode`, `onServerResourceFail`, `RESOURCE_EXCLUDE`), Socket.IO command channel, expanded
  JJ-suffix API keys, Discord OAuth/admin IDs, crypto wallets, Base-91 and JScrambler v5 artifacts,
  payload size fingerprints.
- **ox_inventory**: version floor raised to **>= 2.47.6** with a per-version security table
  (2.47.3 introduced a dupe that 2.47.6 fixed); post-hook events and locks manager added to the
  hook guidance.
- Deprecations: all Mumble natives (migrate to the server-side Voice API), `sv_useAccurateSends`,
  `sv_protectServerEntities`, `sv_netHttp2`, `onesync_automaticResend`, `onesync_enableBeyond`,
  `sv_enhancedHostSupport`.
- Noted that undisclosed client crash vectors exist and are out of scope for static audit —
  artifact currency is the durable control.

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
- Anti-dump vs backdoor disambiguation (own-server loader vs external C2).
- Escrow handling: `.fxap`/encrypted files reported as UNAUDITED (4.7).
- RedM (rdr3) support: VORP / RSG / RedEM frameworks, RDR3 natives (4.8).
