# Phase 1: Security Checks

> **Threat model:** every check here assumes the client is hostile. In-server players run Lua executors / cheat menus (Eulen, redENGINE, Lynx, TZX, Hammafia) that can fire any registered net event with arbitrary arguments, dump event names, spoof entities, replay NUI callbacks, and flood handlers. Server-side validation is the ONLY trust boundary — never rely on client checks or event-name obscurity.

## 1.1 Server Event Exploitation (CRITICAL)

For EACH `RegisterNetEvent` / `lib.callback.register` handler in server files:

```
[ ] Uses `local src = source` (NEVER client-sent player ID)
[ ] ALL parameters type-checked (type, range, length, NaN)
[ ] Tables size-limited (reject if > MAX entries — prevents payload DoS)
[ ] Admin/job actions check permissions SERVER-SIDE before any action
[ ] Server-only internal events use AddEventHandler (not RegisterNetEvent)
[ ] Events meant to be emitted only by the server validate `source` is the server: `if source ~= 65535 then return end` (Cfx canonical — 65535 is the server net id)
[ ] Server exports validate calling resource or wrap in pcall
[ ] String parameters length-limited (prevents memory abuse)
[ ] NaN check: `if x ~= x then return end` for numeric params
```

Reference: [Cfx.re — Securing your events](https://docs.fivem.net/docs/developers/server-security/).

## 1.2 SQL Injection (CRITICAL)

```
[ ] NO string concatenation in queries across all drivers (oxmysql, mysql-async, ghmattimysql)
[ ] LIKE wildcards (%, _) escaped before parameterizing
[ ] ORDER BY / column names WHITELISTED (cannot be parameterized)
[ ] No multipleStatements=true in connection string
[ ] Data read from DB not reused in concatenated queries (second-order SQLi)
[ ] mysql_connection_string uses `set` NOT `setr` (setr leaks to clients via F8 console!)
[ ] mysql_connection_string NOT in any resource file (only server.cfg)
[ ] DB user is NOT root (least-privilege: SELECT, INSERT, UPDATE, DELETE only)
[ ] No dynamic table/column names from user input
[ ] Prepared statements preferred over raw queries for repeated operations
```

Vulnerable vs fixed:
```lua
-- BAD: string concatenation
MySQL.query("SELECT * FROM users WHERE id = " .. id)
-- BAD: format string
MySQL.query(string.format("SELECT * FROM users WHERE id = '%s'", id))
-- GOOD: parameterized
MySQL.query("SELECT * FROM users WHERE id = ?", { id })
-- GOOD: named parameters (oxmysql)
MySQL.query("SELECT * FROM users WHERE id = :id", { id = id })
```

## 1.3 Money/Item Duplication (CRITICAL)

```
[ ] Prices from server config/DB (NEVER from client)
[ ] Negative amounts rejected (ESX removeMoney with negative = addMoney)
[ ] Balance checked BEFORE deduction
[ ] Mutex/lock on purchase/transfer events (race condition protection)
[ ] Atomic operations: deduct + give in SAME handler
[ ] Vehicle spawn deduplication (plate or entity lock)
[ ] Inventory saved atomically before stash/transfer (crash dupe prevention)
[ ] Only one player can access a stash/trunk at a time (concurrent access lock)
[ ] Lock released on playerDropped
[ ] Floating-point precision: use integers for money (cents), never float math
[ ] Transfer operations: deduct from sender FIRST, then give to receiver
```

Mutex pattern:
```lua
local locks = {}
RegisterNetEvent('resource:buy', function(itemId)
    local src = source
    if locks[src] then return end
    locks[src] = true
    local price = Config.Items[itemId]?.price -- server-authoritative
    if not price then locks[src] = nil return end
    -- check balance → deduct → give
    locks[src] = nil
end)
AddEventHandler('playerDropped', function() locks[source] = nil end)
```

## 1.4 Command Injection & RCE (CRITICAL)

```
[ ] ExecuteCommand() NEVER with unvalidated input (whitelist only)
[ ] ExecuteCommand with add_ace/add_principal NEVER from dynamic data
[ ] os.execute / io.popen / io.open NEVER used (no legitimate FiveM use)
[ ] loadstring / load NEVER with user input or network-fetched data
[ ] json.decode wrapped in pcall
[ ] PerformHttpRequest URLs not user-controlled
[ ] No dynamic require() or dofile() with user input
[ ] RegisterCommand callbacks validate argument types
```

## 1.5 XSS in NUI (HIGH)

```
[ ] All user content HTML-escaped (textContent, not innerHTML)
[ ] No v-html (Vue) / dangerouslySetInnerHTML (React) / {@html} (Svelte) with user data
[ ] No eval() / Function() / setTimeout(string) with user input
[ ] URLs validated (http/https only, no javascript: scheme, no data: scheme)
[ ] NUI callbacks validated server-side
[ ] No postMessage without origin validation
[ ] No document.write() with dynamic content
[ ] CSP headers set if NUI serves HTML pages
```

XSS in FiveM enables:
- **Clipboard theft:** `invokeNative('fxdkClipboardRead')`
- **Command execution:** `invokeNative('chatResult')` — execute commands as victim
- **Game crash:** `invokeNative('quit')` — force disconnect
- **Cross-resource hijacking:** `top.citFrames['resourceName']` — access other resource iframes
- **WebSocket C2:** Persistent command channel via WebSocket from browser context
- **Microphone access:** Hijack iframe of voice resource that has media permissions
- **NUI callback forgery:** POST to `localhost:13172` to trigger any NUI callback

Recommend `nui_callback_strict_mode 'true'` in fxmanifest (FiveM build 9549+).

## 1.6 Rate Limiting (HIGH)

For EVERY server-side RegisterNetEvent:
```
[ ] Cooldown per source (1-3s regular, 5s+ purchases, 30s+ expensive ops)
[ ] Cooldown tables cleaned on playerDropped
[ ] DB-touching events have additional rate limiting
[ ] State bag change handlers rate-limited (prevent crash via flood)
[ ] Export calls from other resources rate-limited if DB-touching
```

Rate limit pattern:
```lua
local cooldowns = {}
RegisterNetEvent('resource:action', function()
    local src = source
    local now = os.time()
    if cooldowns[src] and now - cooldowns[src] < 3 then return end
    cooldowns[src] = now
    -- process action
end)
AddEventHandler('playerDropped', function() cooldowns[source] = nil end)
```

## 1.7 Proximity Validation (HIGH)

```
[ ] Server-side distance check using GetEntityCoords(GetPlayerPed(src))
[ ] NEVER trust client-sent coordinates
[ ] Distance checked BEFORE processing (not after)
[ ] Reasonable limits: 3-10m interactions, 50m shops, 100m max
[ ] Ped existence validated (ped ~= 0) before GetEntityCoords
```

```lua
local ped = GetPlayerPed(src)
if ped == 0 then return end
local coords = GetEntityCoords(ped)
if #(coords - targetPos) > 10.0 then return end
```

## 1.8 Entity Ownership (HIGH)

```
[ ] Client-sent netId verified via NetworkGetEntityFromNetworkId
[ ] Entity belongs to requesting player (not spoofed)
[ ] Server validates entity type before operations (GetEntityType)
[ ] DeleteEntity only on owned/permitted entities
[ ] Vehicle operations verify player is owner or has keys
[ ] Entity existence checked (DoesEntityExist) before operations
```

## 1.9 Framework-Specific Exploits (HIGH)

**ESX Legacy:**
```
[ ] exports['es_extended']:getSharedObject() (NOT TriggerEvent('esx:getSharedObject'))
[ ] esx_society events validate caller's job matches society
[ ] xPlayer.addMoney/removeMoney never receives amount from client
[ ] xPlayer.setJob validates job exists + caller has permission
[ ] ESX.GetPlayerFromId uses server source (not client-sent ID)
[ ] esx:setJob event not exposed as net event
```

**QBCore:**
```
[ ] QBCore.Functions.GetPlayer(source) used (never client-sent ID)
[ ] QBCore:Server:UseItem not used (deprecated, exploitable)
[ ] Shop prices server-side only (not from QBCore.Shared.Items on client)
[ ] Player.PlayerData.job checked server-side via GetPlayer
[ ] QBCore.Functions.CreateUseableItem validated server-side
[ ] No direct Player.Functions.SetMoney from client events
[ ] GetPlayer result nil-checked before use — PlayerData structure is not guaranteed to exist
    (a dropped/loading player returns nil; unchecked indexing is both a crash and a bypass)
[ ] Server exports validate the CALLING resource, not just the arguments
[ ] Load-order assumptions do not create a window where a handler is live before its permission
    source is ready (dependency declared in fxmanifest; guard early events)
```

**Admin authorization — ACE over job strings.** Community QBCore examples commonly gate admin
actions on `PlayerData.job.name == 'admin'` and a grade level. That is a *job* check, not a
permission check: anyone who can set a job (another exploitable event, a rogue admin menu, a
database edit) inherits admin. Prefer `IsPlayerAceAllowed(src, 'group.admin' / 'resource.action')`,
which is framework-agnostic and cannot be reached by in-game economy/job logic. Flag job-string
admin gating as MEDIUM (HIGH if the action is destructive: ban, money, item spawn).

**QBox (ox_core):**
```
[ ] Ox.GetPlayer(source) used for player data
[ ] ox:playerLogout handler cleans cached data
[ ] ox_inventory integration uses server exports
[ ] Migration from QBCore checked for leftover deprecated patterns
```

**ND_Core:**
```
[ ] ND events use AddEventHandler only (not RegisterNetEvent)
[ ] Player identifiers not exposed to clients
[ ] NDCore.getPlayer uses source
```

**ox ecosystem (ox_inventory / ox_lib / ox_target / oxmysql):**
```
[ ] ox_inventory hooks/callbacks are VALIDATION-ONLY — no DB writes or state mutation inside a hook (yielding/mutating risks race conditions + dirty DB saves). Side effects belong in a **post-hook event** (v2.47.0+), not in the hook itself
[ ] Stashes registered with an `instance` field where access must be isolated (prevents cross-player access)
[ ] Stash/trunk identity not derived from spoofable client data — plate-based trunks must bind to a unique owner key (same-plate shared-inventory dupe, ox_inventory #1829)
[ ] Concurrent inventory mutation goes through the locks manager (v2.47.0+) — do not hand-roll a competing lock
[ ] ox_lib callbacks (`lib.callback.register`) validate source + params server-side like any net event
[ ] ox_target server events re-check distance/permission server-side (client sends the interaction)
[ ] oxmysql queries parameterized (`?` / named) — never concatenated (see 1.2)
```

**Version floor: ox_inventory >= 2.47.6.** Pinned/vendored forks below this are exploitable. Recent
dupe-relevant history — check the shipped version, not the README:

| Version | Security change |
|---------|-----------------|
| 2.46.1 | Corrected an exploit check in `swapItems` (unauthorized transfers) |
| 2.47.0 | Stash `instance` validation, post-hook events, locks manager, extra `SetSlot`/`RemoveItem` arg validation |
| 2.47.3 | Post-hook delays — **introduced** a dupe |
| 2.47.6 | Fixes that dupe: atomic `swapItems` commit + no dirty state save during hooks |

Flag any resource vendoring/bundling its own copy of ox_inventory (or pinning `2.47.0`–`2.47.5`) as
HIGH — a stale embedded copy is a dupe waiting to happen.

**`ox_lib` also carries a security floor:** a crash vulnerability exploitable to crash *nearby
players*, leaving no server-side trace, was fixed in the maintained line. Griefing with no logs is
easy to misdiagnose as instability — if players report random crashes near specific individuals,
check the ox_lib version before hunting the resource.

> **Version numbers do not compare across trees.** The ox resources exist in an active
> `overextended` tree and an archived `CommunityOx` fork whose numbering diverged. Establish which
> tree the deployed copy came from before citing any floor, and check the repository at review time
> rather than trusting a number from memory — see `checks/compatibility.md` 4.6a.

Reference: [ox_inventory security](https://github.com/overextended/ox_inventory/security), [releases](https://github.com/overextended/ox_inventory/releases), [coxdocs server functions](https://coxdocs.dev/ox_inventory/Functions/Server).

## 1.10 NUI Callback Trust (CRITICAL)

NUI callbacks are POST requests to `localhost:13172` — forgeable via browser DevTools or any local HTTP client.

```
[ ] Callbacks send only intent (item ID, action name), NEVER prices/amounts
[ ] Server looks up prices from config/DB (server-authoritative)
[ ] Negative values rejected
[ ] Item IDs validated against server whitelist/registry
[ ] Callback responses don't leak sensitive server data
[ ] No callback triggers server actions without additional server validation
```

## 1.12 State Bag Exploitation (CRITICAL)

```
[ ] AddStateBagChangeHandler checks `replicated` param (reject client-set for sensitive data)
[ ] Sensitive state (admin, money, inventory, job) only set server-side
[ ] State bag payload size < 16KB (prevent crash via oversized payloads)
[ ] State bag changes rate-limited server-side
[ ] No trusting client-replicated state for permission checks
[ ] Resource does not BREAK under `sv_stateBagStrictMode true` — i.e. it never relies on the
    client writing a replicated entity/player state bag (see below)
[ ] Handler tolerates the entity not existing yet / being gone (no unguarded native calls on it)
```

**`sv_stateBagStrictMode` — the first-class mitigation.** When enabled, only the server may modify
networked entity and player state bags; the network owner of a replicated entity loses write access.
This kills client-forged state at the platform layer instead of per-resource.

```cfg
setr sv_stateBagStrictMode true
```

Audit implication: recommend it, and check whether the resource would still work with it on. A
resource that sets `Entity(veh).state.fuel` **from the client** and expects the server to read it back
is both insecure and about to break — flag it and move the write server-side.

State bag flood/oversize crash (still valid: 100+ bags with ~1MB payloads networked to nearby
players = server crash, [citizenfx/fivem#2361](https://github.com/citizenfx/fivem/issues/2361)).
Full rate-limiter set — the skill previously listed only the first pair:
```cfg
set rateLimiter_stateBag_rate 75
set rateLimiter_stateBag_burst 125
set rateLimiter_stateBagFlood_rate 150
set rateLimiter_stateBagFlood_burst 175
set rateLimiter_stateBagSize_rate 131072
set rateLimiter_stateBagSize_burst 262144
```

**Enhanced semantics change:** state bag change callbacks only fire when the entity actually exists,
and replicated values must be set explicitly. Code that assumed a handler would fire for a
not-yet-streamed entity silently stops running. Flag it as a migration break, not just a style issue.

## 1.13 Sensitive Data Exposure (MEDIUM)

```
[ ] No hardcoded webhooks/API keys/credentials in shared/client files
[ ] Player identifiers not sent to other clients
[ ] Webhooks in server_scripts only (never client or shared)
[ ] GetPlayerIdentifier not bulk-sent via PerformHttpRequest (exfiltration indicator)
[ ] Discord bot tokens not in resource code
[ ] No IP addresses or private network info in client code
[ ] OAuth tokens / session tokens not exposed client-side
[ ] Config files with secrets listed in server_scripts only
```

## 1.13b Player Data, Logging & Privacy (HIGH)

Not every breach is a backdoor. The largest FiveM player-data incident of 2026 (disclosed Jan–Feb,
~64.6k usernames and IP addresses, Spanish/LATAM communities worst hit) came from **centralized
logging left accessible** — ordinary resources doing ordinary logging, aggregated and unprotected.
Audit logging as a data-handling surface, not as a feature.

```
[ ] Resource logs the MINIMUM identifying data needed. Player name for a moderation log is
    defensible; license/steam/discord identifiers, IP addresses, and coordinates usually are not
[ ] IP addresses never logged or forwarded without an explicit, stated reason
[ ] GetPlayerEndpoint / GetPlayerIdentifiers output not sent off-server (see M.3 for the
    exfiltration case; this check covers the WELL-INTENTIONED version of the same data flow)
[ ] Discord webhooks: server-side only, URL in a convar (`set`, never `setr`), never in a shared
    or client file, never committed to the repo
[ ] Webhook volume bounded — a webhook fired per action per player is a permanent external PII
    store the operator does not control and cannot delete from
[ ] Log sinks (DB tables, files, webhooks, external HTTP) have an access-control and retention
    story; unbounded `dei_*_logs`-style tables growing forever are both a privacy and a disk issue
[ ] Player data written to a SHARED/central sink across multiple servers is isolated per server —
    aggregation is what turned the 2026 incident from local to mass
[ ] No player data in publicly readable locations (web-served directories, NUI-accessible files)
[ ] Chat/PM content not logged verbatim unless the operator explicitly requires it
```

**Convar hygiene reminder:** a webhook URL set with `setr` is readable by every connected client
via the F8 console — same failure mode as the `mysql_connection_string` case in 1.2/M.3. Anyone who
reads it can post arbitrary content to the operator's log channel, or simply harvest whatever the
server posts there.

## 1.14 Business Logic (MEDIUM)

```
[ ] Actions not possible in invalid states (dead, handcuffed, in vehicle when shouldn't be)
[ ] Duty status checked server-side (not trusted from client)
[ ] Character switch clears all cached player data and pending transactions
[ ] Duplicate connection prevented (same license = reject in playerConnecting)
[ ] TOCTOU: time-of-check-time-of-use — verify state hasn't changed between check and action
[ ] Integer overflow: amounts checked against reasonable bounds (not just positive)
[ ] Floating-point: money calculations use integer cents, not decimal
[ ] math.random seeded properly if used for security-relevant decisions (it shouldn't be)
```

## 1.15 Server Game Events (HIGH — only if resource handles entities/combat)

```
[ ] entityCreating: unauthorized spawns cancelled, blacklisted models blocked
[ ] explosionEvent: rate limited (3/s), remote explosions rejected (>500m)
[ ] weaponDamageEvent: excessive damage (>200) rejected
[ ] clearPedTasksEvent: cancelled (prevents handcuff breaking)
[ ] ptFxEvent: rate limited (prevents particle spam crash)
[ ] fireEvent: rate limited and distance-validated
```

## 1.16 Hostile Client / Cheat-Menu Resistance (CRITICAL)

Cheat menus with a built-in Lua executor (Eulen, redENGINE, Lynx, TZX, Hammafia) let any connected player call `TriggerServerEvent` / `TriggerLatentServerEvent` with any event name and any payload, enumerate/dump every event a resource registers, and strip client-side checks. Audit every server net event AS IF an attacker is calling it directly from the console.

```
[ ] Every sensitive server action re-derives authorization server-side (job, group, money, ownership) — NEVER trusts a client-sent isAdmin/job/amount flag
[ ] No security relies on event-name obscurity (executors dump all event names — obfuscation ≠ protection)
[ ] No server action gated ONLY by a client-side check (cheat menu removes the check; the server event still fires)
[ ] Latent events (TriggerLatentServerEvent) validated identically to normal events
[ ] Server re-resolves player state itself: GetPlayerPed(src), coords, job, isDead — never accepts these from the client
[ ] Every net event has per-source flood/rate limiting (executor can spam thousands/sec)
[ ] RegisterCommand handlers that perform privileged actions check ACE/permission server-side (commands are callable from cheat menus)
[ ] Give-item / give-weapon / give-money events validate caller permission AND sane limits (no "give me 1e9")
[ ] Spawn/teleport/heal events validate the player is allowed AND in a valid state/location
[ ] No `TriggerEvent` of a client-supplied event name on the server (event-name injection)
```

**Encrypted events caveat:** some anti-cheats obfuscate event names/payloads. This raises the bar but is NOT a substitute for server-side validation — dumpers defeat obscurity. Flag any resource whose security depends on hidden event names.

**Anti-cheat is not a fix:** runtime ACs catch godmode/teleport/spawn/ESP after the fact, but script-level server validation is the real boundary. Recommend an AC as defense-in-depth, never as a replacement for the checks above.

## 1.17 Anti-Cheat Coverage Map (defense-in-depth)

Server owners commonly run a runtime anti-cheat (FiveGuard, WaveShield, PhoenixAC, ElectronAC, FiniAC, VenusAC, PegasusAC, SecureServe, RavenAC, etc.). These are **complementary**, not a substitute for secure code. Two reasons: (1) most are signature/behavioral and several have leaked source in decrypted form on cheat forums — including the two largest commercial ones, whose source has circulated on leak forums — so cheaters build targeted bypasses against the exact detection logic; (2) they monitor client memory cheats the server cannot fix in script.

Corollary for the report: never treat "server runs $AC" as mitigating a script-level finding. The AC's detection code may be in the hands of the people it is detecting; your server-side validation is not.

Split every cheat category by who owns the fix:

| Cheat / exploit | Owner of the durable fix |
|-----------------|--------------------------|
| Aimbot, triggerbot, ESP, wallhack, noclip, speedhack | **Runtime AC** (client memory — a single resource cannot detect reliably) |
| Godmode / invincibility | **Script** (server validates health/`weaponDamageEvent`) + AC backup |
| Money / item / weapon spawn | **Script** (server-authoritative amounts, 1.3 / 1.10) |
| Illegal entity / vehicle spawn | **Script** (`entityCreating`, 1.15) + AC behavioral |
| Event trigger forgery / money events | **Script** (server validation + `source ~= 65535`, 1.1 / 1.16) |
| Teleport/heal via resource events | **Script** (state + proximity validation, 1.7 / 1.16) |
| State bag flooding / crash | **Script + convars** (1.12) |
| Lua executor injection itself | **Runtime AC** (process/HWID) |

**Audit guidance:** for anything in a "Script" row, the resource must self-protect — do NOT accept "the anti-cheat will catch it" as mitigation. For "Runtime AC" rows, note them as out-of-scope for static audit and recommend a layered AC. Never assume an AC is present, current, or unbypassed.

## 1.18 OneSync & Routing Bucket Hardening (HIGH — entity/world resources)

OneSync makes the server authoritative over entities. Resources that spawn or manage entities should lean on the server-side model instead of client spawns.

```
[ ] Entity lockdown set appropriately — `inactive` (default!) = clients spawn anything, always flag it:

| Mode | Effect |
|------|--------|
| `full` | Strict **plus** dummy objects disabled — **Enhanced only** |
| `strict` | No client entity creation at all |
| `relaxed` | Script-owned client entities blocked; on Enhanced also restricts population spawning to the client's owned world-grid areas |
| `inactive` | **Default.** Unrestricted client spawns — flag as HIGH on any public server |

[ ] Per-bucket lockdown via SetRoutingBucketEntityLockdownMode for instanced content
[ ] Server-side entity creation (CreateVehicleServerSetter, CreatePed, CreateObject as RPC) preferred over asking the client to spawn then register
[ ] Player isolation via SetPlayerRoutingBucket / SetEntityRoutingBucket (instances, jails, interiors) — not client-trusted visibility
[ ] SetRoutingBucketPopulationEnabled(bucket, false) for instances that shouldn't have ambient NPCs
[ ] SetEntityOrphanMode used deliberately (don't let abandoned client entities persist)
[ ] No reliance on client to enforce who can see/interact with an entity — buckets + ownership enforce it server-side
```

## 1.19 Server-Crash / DoS Vectors (CRITICAL)

A single malicious client can crash the whole server or nearby players. These are actively sold/advertised by cheat sellers.

```
[ ] State bag flood: handler rejects oversized/rapid changes; ALL THREE limiter families set (`rateLimiter_stateBag_*`, `rateLimiter_stateBagFlood_*`, `rateLimiter_stateBagSize_*`) plus `sv_stateBagStrictMode true`. 100+ state bags with ~1MB payloads networked to nearby players = server crash (citizenfx #2361)
[ ] State bag payloads size-capped server-side (< 16KB) before trusting/rebroadcasting
[ ] Oversized net event payloads rejected (cap string length and table size — see 1.1); no unbounded json.decode of client data
[ ] Entity/object spam: scenario- or client-spawned objects that bypass entityCreating (citizenfx #3675) mitigated by entity lockdown (1.18)
[ ] No server PlaySound / particle / explosion triggered directly from client-controlled params without rate limit + distance cap (1.15)
[ ] Every DB-touching net event rate-limited (flood → DB exhaustion)
[ ] Recursive/self-retriggering events guarded (no event handler that re-emits itself unconditionally)
```

**Undisclosed crash vectors are a standing risk.** New client-side crash methods are reported
regularly and are deliberately not detailed publicly while triage is open (e.g.
[#3722](https://github.com/citizenfx/fivem/issues/3722), open, method withheld). A static audit
cannot enumerate these. When a server is being hardened, the durable control is **artifact
currency** — run a recommended FXServer build and update within about a week of release, because
crash vectors are patched platform-side. State that explicitly rather than implying the resource
audit covers it.

References: [Cfx state bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/), [state bag rate-limit issue #2361](https://github.com/citizenfx/fivem/issues/2361), [scenario crash #3675](https://github.com/citizenfx/fivem/issues/3675), [server commands / convars](https://docs.fivem.net/docs/server-manual/server-commands/).

## 1.20 Connection Phase & Deferrals (HIGH — the door, not the room)

`playerConnecting` and the deferrals flow run **before** the player exists as a normal source. Bans,
queues, whitelists and identifier checks all live here, and a mistake means either everyone gets in
or nobody does. Audit any resource that hooks this phase (queue, whitelist, ban, anticheat, loading).

```
[ ] Connection REJECTED when the player has no `license` (and ideally no `fivem`) identifier —
    without a traceable identity there is nothing to ban later
[ ] Ban/whitelist lookups match on MULTIPLE identifiers, not one. A single-identifier ban is
    defeated by any HWID spoofer; combine license + fivem + discord + Cfx token + IP history
[ ] Identifier read server-side via GetPlayerIdentifiers(src) — never accepted from the client
[ ] Every deferral path terminates: `deferrals.done()` or `deferrals.done(reason)` on EVERY branch,
    including error/exception paths. A DB error that skips `done()` hangs the connection forever
[ ] Async work inside deferrals is awaited/guarded with a timeout — a stalled query becomes a
    server-wide "cannot connect"
[ ] `deferrals.update` / `presentCard` content does not interpolate unescaped player-supplied text
    (name/discord nick) — adaptive cards render it
[ ] Ban check happens BEFORE the queue grants a slot (not after), so banned players cannot occupy
    queue capacity
[ ] Queue priority is derived server-side from a stored identifier, never from anything the client
    sends
[ ] Connection handlers are rate-limit/DoS aware — connection spam runs this code path; heavy DB
    work per attempt is an amplification vector
[ ] No duplicate-connection race: same license connecting twice handled deterministically (1.14)
[ ] Deferral errors are logged server-side, not surfaced to the client with internal detail
```

**Operator note worth including in the report:** when banning through txAdmin, banning from the
player's profile page captures more identifiers than banning from history after they have
disconnected. Single-identifier bans are the reason "the cheater came back in five minutes."

## 1.21 Screenshot & Media Capture (MEDIUM–HIGH)

Admin panels, report systems and anticheats commonly use `screenshot-basic` or a fork. Two distinct
problems, both common:

```
[ ] Upload is PROXIED THROUGH THE SERVER — `requestScreenshotUpload` performs the HTTP POST from
    the NUI layer to whatever URL it is given, so a client-side upload puts the destination URL and
    any API key in the hands of every player
[ ] No webhook URL / API key / bearer token passed to the client for the upload
[ ] Upload endpoint not attacker-substitutable (client cannot choose where the image goes)
[ ] Capture is rate-limited and permission-gated server-side (it is a remote camera into a player's
    machine — treat unrestricted capture as a privacy problem, not a feature)
[ ] Captured media handled under the same rules as any other player data (1.13b): retention,
    access control, no public directory
```

**Evidence caveat for the report:** a modified client can intercept the NUI call and return a blank
or forged frame. Screenshots are supporting evidence, never proof on their own — flag any ban/report
flow that treats a returned image as conclusive.

## 1.22 Resource HTTP Handlers (CRITICAL — internet-facing, and usually forgotten)

`SetHttpHandler` registers an HTTP endpoint served by the **server's own HTTP listener**, reachable
at `http://<server>:30120/<resourceName>/<path>`. That is the game port — it must be open TCP+UDP
for players to connect, and it already serves `/info.json`, `/players.json` and `/dynamic.json`
publicly. **Anything a resource exposes through `SetHttpHandler` is on the public internet**, with
no authentication and no rate limiting unless the resource implements them itself.

Treat every handler as an unauthenticated public API endpoint on a game server.

```
[ ] Handler AUTHENTICATES the caller — shared secret / bearer token / HMAC, compared in constant
    time, with the secret in a convar (`set`, never `setr`) and never in client or shared files
[ ] Authorization is not based on `request.address` alone (source IP is trivially spoofed on
    UDP-adjacent infra and wrong behind any proxy/CDN)
[ ] Request `path` is validated against a whitelist — never concatenated into a filesystem path
    (`LoadResourceFile`/`io.open`) or a shell/SQL string. Path traversal (`..`, encoded variants)
    explicitly rejected
[ ] Request body size-capped via `setDataHandler` before parsing; `json.decode` in pcall
[ ] `setCancelHandler` used so an aborted request does not leak a pending operation
[ ] Handler does NO privileged action (ban, money, ACE grant, resource restart, SQL write) without
    authentication — an unauthenticated admin endpoint here is an instant full compromise
[ ] Per-address rate limiting (the endpoint is reachable by anyone who knows the server IP)
[ ] Responses do not leak player identifiers, IPs, tokens, config or internal errors (1.13b)
[ ] Handler work is bounded and non-blocking — a slow handler holds the server thread (perf 2.0)
[ ] Endpoint existence is intentional: a debug/test handler left in a release is a finding
```

**Discovery note for the report:** handlers are enumerable by resource name, and resource names are
not secret. Do not accept "nobody knows the URL" as a control — that is the same obscurity argument
rejected in 1.16.

## 1.23 Client-Side Storage Trust (HIGH)

`SetResourceKvp` / `GetResourceKvp` on the **client** writes to the player's own machine. The player
can read and modify it. It is a preferences store, not a security boundary.

```
[ ] No authoritative state in client KVP — money, inventory, job, permissions, unlock/purchase
    flags, cooldowns, ban state. All of these must live server-side
[ ] Server never reads back a client KVP value and trusts it (client sends it via an event; that is
    just client input — validate per 1.1)
[ ] Client KVP limited to genuinely local preferences: theme, HUD position, scale, keybinds,
    last-used tab, volume
[ ] No secrets in client KVP (tokens, webhook URLs, API keys) — it is plaintext on disk
[ ] Anti-cheat / cooldown / "already claimed" markers not stored client-side (trivially cleared)
[ ] Server-side KVP used deliberately: it is real persistence, but it is not a database — check for
    unbounded growth and for data that belongs in SQL
```

Legitimate example (do NOT flag): a HUD storing `{theme, scale, positions}` in client KVP.
Finding: a shop storing `purchased_vip = true` in client KVP and honoring it later.
