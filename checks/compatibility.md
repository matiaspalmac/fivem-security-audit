# Phase 4: Compatibility & Manifest Checks

## 4.1 fxmanifest.lua (MEDIUM)

```
[ ] fx_version 'cerulean' (latest stable)
[ ] lua54 'yes' (enables Lua 5.4 features and performance)
[ ] game 'gta5' (or 'rdr3' if applicable)
[ ] version declared (semantic versioning preferred)
[ ] author declared
[ ] description declared
[ ] File order: shared_scripts → client_scripts → server_scripts → ui_page/nui
[ ] Sensitive config files in server_scripts only (not shared or client)
[ ] All referenced files exist on disk
[ ] dependency declared for required resources (ox_lib, oxmysql, es_extended, etc.)
[ ] No __resource.lua (deprecated — migrate to fxmanifest.lua)
[ ] No wildcard includes (*.lua) that could load injected files
[ ] nui_callback_strict_mode 'true' if NUI is used (build 9549+)
```

**Wildcard risk:**
```lua
-- RISKY: loads ANY .lua file, including injected backdoors
server_scripts { 'server/*.lua' }

-- SAFER: explicit file list
server_scripts {
    'server/main.lua',
    'server/commands.lua',
}
```

## 4.2 Framework Isolation (MEDIUM)

```
[ ] Framework code centralized in bridge.lua or bridge/ directory (not scattered)
[ ] Auto-detect pattern preferred over Config.Framework hard-coding
[ ] Bridge functions include input validation
[ ] pcall on framework initialization (graceful failure if framework missing)
[ ] No mixing of framework APIs (e.g., ESX + QBCore calls in same file)
[ ] Framework dependency declared in fxmanifest
```

Auto-detect pattern:
```lua
-- bridge/init.lua
local framework
if GetResourceState('es_extended') == 'started' then
    framework = 'esx'
elseif GetResourceState('qb-core') == 'started' then
    framework = 'qbcore'
elseif GetResourceState('ox_core') == 'started' then
    framework = 'ox'
elseif GetResourceState('ND_Core') == 'started' then
    framework = 'nd'
end

if not framework then
    print('[resource] No supported framework detected')
    return
end

-- Load framework-specific bridge
local bridge = require(('bridge.%s'):format(framework))
```

## 4.3 SQL Schema Files (MEDIUM)

```
[ ] No DROP TABLE in migration files (data loss risk)
[ ] No CREATE USER / GRANT statements (security misconfiguration)
[ ] No TRUNCATE TABLE without confirmation logic
[ ] Schema matches code expectations (column names, types)
[ ] AUTO_INCREMENT on primary keys
[ ] Appropriate indexes on frequently queried columns
[ ] CHARSET utf8mb4 for Unicode support
[ ] NOT NULL constraints where appropriate
[ ] DEFAULT values specified for optional columns
[ ] Foreign keys or application-level referential integrity
```

## 4.4 Lua Version Compatibility (LOW)

If `lua54 'yes'` is set:
```
[ ] No Lua 5.1-only patterns: unpack (use table.unpack), setfenv, getfenv
[ ] Integer division operator (//) used correctly
[ ] Bitwise operators (& | ~ << >>) used instead of bit32 library
[ ] goto/labels used appropriately
[ ] String library differences handled
```

If `lua54` is NOT set (Lua 5.1 mode):
```
[ ] No Lua 5.4 syntax used (integers, bitwise ops, goto)
[ ] Recommend enabling lua54 for performance benefits
```

## 4.5 Deprecated Patterns (LOW)

```
[ ] No TriggerEvent('esx:getSharedObject') — use exports
[ ] No QBCore:Server:UseItem — deprecated and exploitable
[ ] No __resource.lua — use fxmanifest.lua
[ ] No RegisterServerEvent (use RegisterNetEvent for net events)
[ ] No mysql-async raw calls if oxmysql available (performance)
[ ] No GetDistanceBetweenCoords (use vector math: #(v1 - v2))
[ ] No Citizen.CreateThread (use CreateThread)
[ ] No Citizen.Wait (use Wait)
[ ] No msgpack.unpack for event data (automatic since recent builds)
[ ] No Mumble natives — ALL deprecated and slated for removal; migrate to the server-side Voice API.
    (`pma-voice` wraps the built-in system and is still the community standard; flag direct Mumble
    native use in resource code, and flag legacy voice resources: esx_voice, vdk_voice, mumble-voip)
[ ] No `sv_useAccurateSends` — deprecated, replaced by `sv_syncTickRate`
[ ] No removed convars referenced in configs or docs: `sv_protectServerEntities` (use
    `sv_entityLockdown`), `sv_netHttp2`, `onesync_automaticResend`, `onesync_enableBeyond`,
    `sv_enhancedHostSupport`, `sv_mumble`
[ ] No `sv_enableDevtools` — never existed (unimplemented request); the real control is `sv_devMode`
```

## 4.6 Resource Dependencies (LOW)

```
[ ] All used exports have corresponding dependency in fxmanifest
[ ] Optional dependencies checked with GetResourceState before use
[ ] Circular dependencies avoided
[ ] Minimum resource version specified if API changed between versions
```

### 4.6a Dependency maintenance status (MEDIUM — check the upstream is alive)

A pinned version is only safe while somebody is still shipping fixes for it. Verify at review time
that each third-party dependency's upstream is **maintained**, and which org the deployed copy
actually came from.

```
[ ] Upstream repo not archived / abandoned. An archived dependency means the current version is the
    LAST version — a future vulnerability has no patch, only a migration
[ ] The deployed copy's origin org matches the maintained tree (see below)
[ ] Version pins are current against the tree the resource is actually on, and advisories are
    checked at review time rather than assumed from a version number in a README
```

**ox ecosystem specifically — verify before citing a version floor.** These resources are de-facto
dependencies for much of the ecosystem and they have changed hands, so version numbers do NOT
compare across trees:

- `overextended/*` — active, and the tree that has shipped 2026 fixes (e.g. ox_inventory 2.47.x).
- `CommunityOx/*` — a fork created to maintain the resources after the original team archived them;
  the **organization and its repositories were archived on 2026-04-28 and are read-only**. Its
  version numbering diverged from upstream, so a "v3.32.1" style pin refers to that fork's line, not
  to overextended's.

Audit action: identify which tree the deployed `ox_lib` / `ox_inventory` / `ox_target` / `ox_core`
came from. **A resource pinned to or vendoring the archived fork is on an unmaintained tree** —
report it as MEDIUM (HIGH if it is `ox_inventory`, given its dupe history) and recommend moving to
the maintained upstream. Do not assert a cross-tree version floor from memory; check the actual
repository at review time.

## 4.7 Escrow & Asset Protection (MEDIUM)

FiveM/RedM Asset Escrow encrypts source into `.fxap`; escrowed files are **unreadable** to a static audit and to runtime scanners (`LoadResourceFile` returns nothing usable).

```
[ ] If `.fxap` present / source encrypted → report escrowed files as UNAUDITED, not "clean"
[ ] escrow_ignore directive lists the files that SHOULD remain readable (config, locales) — audit those
[ ] lua54 'yes' is required for escrow (its absence on a "protected" resource is suspicious)
[ ] Entitlement: resource needs the buyer's CFX account; a leaked/cracked escrow (decrypted source where escrow is expected) is a piracy/tamper red flag
[ ] Trust boundary: an escrowed resource is only as safe as its vendor — recommend buying from the official Tebex/keymaster, not leak sites
[ ] Escrow has NOT shipped on the Enhanced build — a resource sold as "escrow protected" cannot be
    protected there yet. If a server is migrating to Enhanced, escrowed paid resources are a
    blocking dependency, not a detail
```

## 4.8 RedM (rdr3) Support (LOW)

Same engine and security model as FiveM; every check in this skill applies unchanged. RedM is not
a lighter threat environment — it is a smaller one, with less scrutiny per resource.

```
[ ] game 'rdr3' for RedM resources
[ ] Framework detection covers VORP (vorp_core), RSG (rsg-core, QBCore-derived), RedEM
[ ] RDR3 natives differ from GTA5 — verify native names against the RDR3 natives DB, not the GTA5
    set. A GTA5 native name that "looks right" may not exist on rdr3
[ ] Server authority, event validation and dupe rules identical to FiveM (1.1, 1.3, 1.10, 1.16)
```

**Framework-specific:**
```
[ ] VORP: item/inventory manipulation validated SERVER-side — public write-ups exist demonstrating
    inventory item exploitation against the framework's own callbacks; do not assume core handles it
[ ] VORP: character/user data fetched by server source, never by a client-sent character id
    (VORP is multi-character by default — the character id is an obvious forgery target)
[ ] VORP inventory operations that split, stack or move items are atomic and locked (split-stack
    handling is the documented dupe surface)
[ ] RSG: it is QBCore-derived — every QBCore pitfall in security 1.9 applies verbatim, including
    ACE-over-job-string admin gating
[ ] Inventory resource is the framework's matching one (a VORP inventory is not an RSG inventory);
    a cross-framework graft is both a break and a validation gap
```

**Reporting note:** when auditing RedM, state the framework explicitly. "Works on RedM" is not a
finding; "uses a GTA5-only native" and "trusts a client-sent character id" are.

## 4.9 GTA V Enhanced Migration (HIGH — the big 2026 platform split)

FiveM now targets two game builds: **Legacy** and **Enhanced** (server early access since
2026-07-21). Core APIs are backward compatible and most Lua carries over, but a working Legacy
resource is **not** automatically an Enhanced resource. When auditing, first establish which target
the server runs — several findings change meaning between them.

### 4.9a Removed / always-on platform behavior
```
[ ] Pure mode is ALWAYS enabled on Enhanced and cannot be turned off — an `sv_pureLevel` finding is
    Legacy-only; on Enhanced, verify the resource's client files survive pure mode instead
[ ] P2P sync removed (client-server model only) — code assuming peer sync behavior is dead
[ ] OneSync "big mode" only; non-big-mode assumptions about player event scope no longer hold
[ ] ARQ / `onesync_automaticResend` removed
[ ] HTTP/2 (`sv_netHttp2`) removed
[ ] Server ImGui removed; DevCon ports 29200/29300 gone; `+set moo 31337` no longer works
[ ] Dev tools require `sv_devMode true` SERVER-side (caps the server at 8 slots) — no client command
```

### 4.9b Breaking changes that need code or config edits
```
[ ] Resource builders NO LONGER SUPPORTED — a resource relying on yarn/webpack builders at runtime
    breaks. Ship a prebuilt bundle instead. (Security upside: this removes the *_builder.js
    injection vector on Enhanced — see malware M.14b — but it stays live on Legacy)
[ ] Mono replaced by .NET (requires the .NET 10 SDK) — C# resources must be rebuilt
[ ] Key-value store files must be migrated (migration script provided) — resources using KVP
    server-side need the migration run, or data is lost
[ ] Remote command output requires an explicit `PrintRemoteCommandLog()` call to be client-visible
[ ] `endpoint_add_tcp` / `endpoint_add_udp` accept ONE endpoint each, not multiple
[ ] State bag callbacks fire only when the entity exists; replicated values must be set explicitly
    (see security 1.12) — silent no-op otherwise
[ ] Only the latest gamebuild is supported by default; `sv_enforceGameBuild` needed for anything else
[ ] Custom assets are NOT natively compatible — YDR/YTD/YFT/YPT/YDD must go through Alchemist
[ ] File/binary names changed: `server.7z` → `cfx-server_win_x64`, `FXServer.exe` → `cfx-server.exe`
    (startup scripts, Docker images, and monitoring configs referencing the old names break)
```

### 4.9c Natives that need Enhanced testing
Scripts touching these areas must be verified on an Enhanced staging server before migration —
behavior differs even where the native still exists:
```
[ ] Streaming (request/release, asset residency)
[ ] Entity ownership and control transfer
[ ] Weapons
[ ] Collisions
[ ] Population / ambient spawning (relaxed lockdown now restricts pop spawn to owned grid areas)
[ ] Network sync
```

New Enhanced convars worth knowing: `sv_syncTickRate` (1–120, default 60, replaces
`sv_useAccurateSends`), `sv_resourceFileDownloadTimeout` (default 2 min), `sv_ioThreads`,
`sv_entityLockdown full`.

Reference: [What's Changed in FiveM for GTAV Enhanced](https://docs.fivem.net/docs/developers/legacy-vs-enhanced/).
