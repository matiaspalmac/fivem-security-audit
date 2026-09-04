# Changelog

All notable changes to `fivem-security-audit`.

## [1.2.0] — 2026-09-04

Adds the context the previous versions audited without: **where the file came from**, and **what
happens to player data**. Both came out of reviewing what the rest of the ecosystem's tooling does
and does not do.

### Added
- **Phase 0 — Provenance & Trust (`checks/provenance.md`, new).** Runs before any code is read.
  Establishes origin, assigns a trust tier (T1/T2/T3/unknown), and looks for repack and crack
  indicators: stripped escrow, altered fxmanifest paths (escrow integrity keys off exact paths),
  grafted code style, orphan files, removed vendor license checks. Includes a purpose/capability
  mismatch check — "this is a speedometer that reads `mysql_connection_string`" is worth more than
  any signature. New `provenance` audit mode.
  Rationale: independent sources agree the dominant backdoor delivery vector is a leaked/nulled/
  cracked paid script repacked with a loader, not a novel exploit. Origin predicts risk better than
  any single pattern, and no amount of pattern matching recovers it afterwards.
- **Provenance gate on the verdict.** A T3 resource that scans clean is reported as *"no backdoor
  found"*, never *"clean"* — a high score on an untrusted artifact is explicitly not a safety claim.
- **Security 1.13b — Player Data, Logging & Privacy.** Motivated by the Jan–Feb 2026 FiveM
  incident (~64.6k usernames and IP addresses; Spanish/LATAM communities worst affected), which
  came from centralized logging left reachable rather than from a backdoor. Covers identifier and
  IP minimization, webhook placement and volume, `setr` webhook leakage, log sink retention and
  access control, and cross-server aggregation as the amplifier.
- **"Know What This Method Misses"** in SKILL.md — an explicit comparison of semantic review vs
  pattern/entropy scanners vs runtime monitors, with the recommendation to triage large or
  untrusted trees with a bulk scanner first. The audit no longer implies full-tree signature
  coverage it does not have.
- **Security 1.20 — Connection Phase & Deferrals.** Previously uncovered entirely. Rejecting
  connections with no `license` identifier, multi-identifier ban matching (a single-identifier ban
  is defeated by any HWID spoofer), `deferrals.done()` on every branch including DB-error paths,
  unescaped player names in `presentCard`, ban-before-queue ordering, and connect-spam as an
  amplification vector.
- **Security 1.21 — Screenshot & Media Capture.** `requestScreenshotUpload` performs the POST from
  the NUI layer, so a client-side upload hands every player the destination URL and any key.
  Requires server-proxied upload, ACE gating and rate limiting, and notes that a modified client can
  return a forged frame — screenshots are supporting evidence, never proof.
- **Performance 2.0 — Server Thread Blocking (CRITICAL).** The server has one main thread; an
  unyielding loop or a synchronous query hangs it rather than slowing it. Covers memory bombs
  (`string.rep`, string growth, JSON over client-controlled size), unbounded iteration over client
  data, and using the `server thread hitch warning` as the confirmation signal. Doubles as a DoS
  finding when the loop bound is attacker-controlled.
- **Compatibility 4.8 (RedM) expanded** from four lines to framework-specific checks: VORP
  server-side item/inventory validation and split-stack atomicity, character-id forgery,
  RSG inheriting every QBCore pitfall, and cross-framework inventory grafts.
- Cleanup 3.1: connection-phase state (queue slots, pending auth) leaks differently — a player who
  abandons the connection may never reach `playerDropped`.
- Report format: Player Data Handling table; Connection and Logging/Report resource types.
- Build target and provenance now appear in the report header.

- **Security 1.22 — Resource HTTP Handlers (CRITICAL).** `SetHttpHandler` serves
  `http://<server>:30120/<resource>/<path>` on the server's own HTTP listener — the game port, which
  is necessarily public and already serves `/info.json` and `/players.json`. Every handler is an
  unauthenticated internet-facing endpoint unless the resource says otherwise. Covers constant-time
  secret comparison, `request.address` not being an authorization signal, path traversal into
  `LoadResourceFile`, body size caps, per-address rate limiting, and debug handlers left in
  releases. Resource-name obscurity is explicitly rejected as a control.
- **Security 1.23 — Client-Side Storage Trust.** Client `SetResourceKvp` is on the player's disk
  and is player-writable: it is a preferences store, never a boundary. Flags authoritative state
  (purchases, permissions, cooldowns, "already claimed" markers) and secrets stored there, with a
  legitimate-use example so HUD preference storage is not flagged.
- **Malware M.15d — Server-side JavaScript (CRITICAL).** A NUI bundle runs in CEF; a server JS
  resource does not. FiveM runs Node on the server, `require` resolves from the resource's own
  `node_modules/`, and that code holds server-process privileges — a compromised dependency there is
  RCE that already happened, so M.15b applies at CRITICAL rather than MEDIUM. Adds JS equivalents of
  the Lua backdoor primitives (`child_process`, `vm`, `eval`, dynamic `require`) and the
  **Node 16.x default runtime** (long EOL) with the `node_version '22'` manifest opt-in.
- **Compatibility 4.6a — Dependency maintenance status.** A pinned version is only safe while
  someone still ships fixes for it. The ox resources changed hands: `overextended/*` is active and
  shipped the 2026 fixes, while the `CommunityOx/*` fork and its whole organization were
  **archived 2026-04-28** and are read-only, with numbering that diverged from upstream. A resource
  pinned to or vendoring the archived fork is on an unmaintained tree. The skill is instructed to
  check the repository at review time rather than asserting a cross-tree version floor from memory.
- ox_lib now carries a noted security floor (a fix for a crash exploitable against *nearby players*
  that leaves no server-side trace — easily misread as instability).
- Scoring: unauthenticated privileged HTTP handler (-20), unreviewed server-JS dependency tree
  (-15), authoritative state trusted from client KVP (-8). New HTTP/API and Server JS resource
  types and three new malware-scan report rows.

- **Security 1.3 — Lua 5.4 integer wraparound as a dupe primitive.** `lua54 'yes'` is near-universal
  and 64-bit integer overflow wraps silently (two's complement, no error, no clamp). A
  server-authoritative price times a validated-positive quantity still mints money when the product
  wraps negative, because the balance check passes and removing a negative amount adds. Requires
  upper bounds before the multiply and a post-condition guard.
- **Security 1.24 — Discord Integration & External Identity.** Bot token must use `set`, never
  `setr`; widely repeated setup guides recommend `setr`, which replicates the token to every client,
  so it should be treated as already compromised and rotated. Plus minimal bot permissions,
  server-side role resolution, cached lookups, and **failing closed** on API error or rate limit —
  fail-open is a whitelist bypass an attacker can induce by exhausting the rate limit.
- UNAUDITED rule extended to compiled .NET assemblies.

### Positioning / docs
- **README rewritten around what this actually is: a reviewer, not a scanner.** The space is full of
  free pattern/entropy scanners; the differentiator is reasoning about reachability and trust, not
  list size. Leads with the question the tool answers, then a worked example of a finding no scanner
  can produce (the Lua 5.4 wraparound dupe — every checklist item passes and it still mints money),
  a phase table, the provenance argument, the honest limitations table, and a list of concrete
  things the checks encode that most operators do not know.
- **CONTRIBUTING rewritten** for a threat-intel project: repo layout, an evidence standard (cite
  sources; never assert convar names or version numbers from memory — a previous release shipped
  `sv_enableDevtools`, which does not exist), the four-part format required for a new detection
  (pattern, exploit, fix, false-positive guard), fixture requirements, and a no-live-malware rule.

### Repo / tooling
- `bin/install.js` no longer hardcodes "v1.0" in the banner and feature list — both now read from
  `package.json`, so the installer stops advertising a stale version.
- `examples/` corpus extended to exercise the new checks: `vulnerable_shop/server/connect.lua`
  (deferrals, connection logging, client-side capture upload, unbounded server loop, client-trusted
  state bag) with a hardened `secure_shop/server/connect.lua` counterpart. `EXPECTED.md` gains the
  new expected findings, Phase 0 provenance expectations, and an explicit false-positive trap table
  so over-flagging the secure fixture is caught as a regression.

### Changed
- **M.10 blocklist reframed as an accelerator, not the test.** Hardcoded domain lists are stale
  from the day they are written and dedicated tools ship far larger ones. Replaced
  "not on the list, therefore fine" with allowlist reasoning: every external endpoint needs an
  identifiable legitimate purpose, and an unrecognized one is suspect because it is unrecognized.
- **QBCore: ACE over job strings.** Community examples gate admin actions on
  `PlayerData.job.name == 'admin'`; that is a job check, not a permission check, and anything that
  can set a job inherits admin. Now flagged (MEDIUM, HIGH for destructive actions). Added nil-check
  on `GetPlayer`, calling-resource validation on exports, and load-order guard checks.
- **1.17**: noted that the source of the two largest commercial anti-cheats has circulated on leak
  forums, and that "the server runs an AC" is never accepted as mitigating a script-level finding.

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
