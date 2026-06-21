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
```

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
[ ] ox_inventory hooks/callbacks are VALIDATION-ONLY — no DB writes or state mutation inside a hook (yielding/mutating risks race conditions + dirty DB saves)
[ ] Stashes registered with an `instance` field where access must be isolated (prevents cross-player access)
[ ] Stash/trunk identity not derived from spoofable client data — plate-based trunks must bind to a unique owner key (same-plate shared-inventory dupe, ox_inventory #1829)
[ ] ox_inventory kept up to date (multiple dupes patched: swapItems delay dupe, drop-data dupe — old forks are vulnerable)
[ ] ox_lib callbacks (`lib.callback.register`) validate source + params server-side like any net event
[ ] ox_target server events re-check distance/permission server-side (client sends the interaction)
[ ] oxmysql queries parameterized (`?` / named) — never concatenated (see 1.2)
```
Reference: [ox_inventory security](https://github.com/overextended/ox_inventory/security), [coxdocs server functions](https://coxdocs.dev/ox_inventory/Functions/Server).

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
```

State bag rate limiting crash: Attackers flood state bag changes to crash the server. Mitigate with:
```cfg
set rateLimiter_stateBag_rate 75
set rateLimiter_stateBag_burst 125
```

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

Server owners commonly run a runtime anti-cheat (FiveGuard, WaveShield, PhoenixAC, ElectronAC, FiniAC, VenusAC, PegasusAC, SecureServe, RavenAC, etc.). These are **complementary**, not a substitute for secure code. Two reasons: (1) most are signature/behavioral and several have leaked source in decrypted form on cheat forums, so cheaters build targeted bypasses; (2) they monitor client memory cheats the server cannot fix in script.

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
[ ] Entity lockdown set appropriately: `sv_entityLockdown strict` (no client entities) or `relaxed` (block script-owned client entities); `inactive` = clients spawn anything (flag it)
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
[ ] State bag flood: handler rejects oversized/rapid changes; convars set (rateLimiter_stateBag_rate/burst). 100+ state bags with ~1MB payloads networked to nearby players = server crash (citizenfx #2361)
[ ] State bag payloads size-capped server-side (< 16KB) before trusting/rebroadcasting
[ ] Oversized net event payloads rejected (cap string length and table size — see 1.1); no unbounded json.decode of client data
[ ] Entity/object spam: scenario- or client-spawned objects that bypass entityCreating (citizenfx #3675) mitigated by entity lockdown (1.18)
[ ] No server PlaySound / particle / explosion triggered directly from client-controlled params without rate limit + distance cap (1.15)
[ ] Every DB-touching net event rate-limited (flood → DB exhaustion)
[ ] Recursive/self-retriggering events guarded (no event handler that re-emits itself unconditionally)
```
References: [Cfx state bags](https://docs.fivem.net/docs/scripting-manual/networking/state-bags/), [state bag rate-limit issue #2361](https://github.com/citizenfx/fivem/issues/2361), [scenario crash #3675](https://github.com/citizenfx/fivem/issues/3675).
