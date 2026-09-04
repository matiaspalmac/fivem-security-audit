# Phase 2: Performance Checks

## 2.1 Thread Analysis (HIGH)

```
[ ] No unconditional Wait(0) loops (while true do Wait(0) without condition)
[ ] Wait(0) only when feature is actively being used, Wait(500)+ when idle
[ ] Key polling replaced with RegisterKeyMapping
[ ] Two-tier pattern: Wait(1000) scanning → Wait(0) only near target
[ ] DrawMarker loops replaced with ox_target / lib.zones / lib.points
[ ] No nested Wait(0) loops (loop inside loop)
[ ] CreateThread count reasonable (not creating threads inside loops)
```

| Pattern | Verdict | Impact |
|---------|---------|--------|
| `while true do Wait(0)` unconditional | CRITICAL | ~0.3ms/frame constant |
| `Wait(0)` with active-state guard | GOOD | Only costs when needed |
| `Wait(100-500)` | ACCEPTABLE | Minimal impact |
| `Wait(1000)` | EXCELLENT | Negligible |
| `lib.waitFor` with timeout | EXCELLENT | Self-cleaning |

Two-tier pattern example:
```lua
CreateThread(function()
    while true do
        local sleep = 1000
        local ped = cache.ped or PlayerPedId()
        local coords = GetEntityCoords(ped)
        local dist = #(coords - targetCoords)
        if dist < 50.0 then
            sleep = 0
            -- draw/interact logic
        end
        Wait(sleep)
    end
end)
```

## 2.2 Native Caching (MEDIUM)

```
[ ] PlayerPedId() cached per-frame or per-tick (not called multiple times in same frame)
[ ] PlayerId() cached (not called every frame)
[ ] GetHashKey() cached for static strings (use `joaat` or pre-computed hashes)
[ ] lib.cache.ped / lib.cache.playerId used if ox_lib available
[ ] GetEntityCoords() not called multiple times for same entity in same frame
[ ] GetGameTimer() cached if used multiple times per frame
```

Caching pattern:
```lua
-- BAD: called every frame
CreateThread(function()
    while true do
        local ped = PlayerPedId()       -- redundant per-frame call
        local coords = GetEntityCoords(ped)
        -- use coords...
        local coords2 = GetEntityCoords(PlayerPedId()) -- called AGAIN
        Wait(0)
    end
end)

-- GOOD: cached
local ped, coords
CreateThread(function()
    while true do
        ped = cache.ped or PlayerPedId()
        coords = GetEntityCoords(ped)
        -- use coords and ped throughout frame
        Wait(0)
    end
end)
```

## 2.3 Database Optimization (MEDIUM)

```
[ ] No N+1 queries (SELECT inside a for loop — use WHERE IN or JOIN)
[ ] DB results cached with TTL (2-5s for frequently accessed data)
[ ] Batch operations use transactions (BEGIN/COMMIT)
[ ] INSERT/UPDATE use bulk syntax when processing multiple rows
[ ] SELECT only needed columns (not SELECT *)
[ ] Indexes exist for WHERE/JOIN columns (check .sql files)
[ ] Connection pool not exhausted (no dangling async queries)
[ ] MySQL.ready() or equivalent checked before queries on resource start
```

N+1 fix:
```lua
-- BAD: N+1
for _, player in pairs(players) do
    local result = MySQL.query.await("SELECT * FROM users WHERE id = ?", { player.id })
end

-- GOOD: single query
local ids = table.concat(playerIds, ',')
local results = MySQL.query.await("SELECT * FROM users WHERE id IN (?)", { ids })
```

## 2.4 Streaming Assets (MEDIUM)

```
[ ] RequestModel → SetModelAsNoLongerNeeded after use
[ ] RequestAnimDict → RemoveAnimDict after use
[ ] RequestAnimSet → RemoveAnimSet after use
[ ] RequestNamedPtfxAsset → RemoveNamedPtfxAsset after use
[ ] RequestScaleformMovie → SetScaleformMovieAsNoLongerNeeded after use
[ ] HasModelLoaded / HasAnimDictLoaded with timeout (not infinite Wait(0))
[ ] Streaming requests not inside tight loops
[ ] Texture dictionaries released after use
```

Timeout pattern:
```lua
local function loadModel(hash)
    RequestModel(hash)
    local timeout = 500
    while not HasModelLoaded(hash) and timeout > 0 do
        timeout = timeout - 1
        Wait(0)
    end
    if timeout <= 0 then
        -- model failed to load, handle gracefully
        return false
    end
    return true
end
-- After using the model:
SetModelAsNoLongerNeeded(hash)
```

## 2.5 Network Optimization (MEDIUM)

```
[ ] TriggerClientEvent(-1) minimized — use targeted player IDs or state bags
[ ] TriggerLatentClientEvent for payloads > 32KB (prevents network congestion)
[ ] Blips created once and updated, not recreated in loops
[ ] SendNUIMessage throttled with change detection (not every frame)
[ ] State bags preferred over frequent TriggerClientEvent for synced data
[ ] TriggerServerEvent not called from tight loops (rate limit client-side)
[ ] Large data synced via latent events or broken into chunks
```

## 2.6 Entity & Object Management (LOW)

```
[ ] Spawned entities tracked and deleted when no longer needed
[ ] Props cleaned up on resource stop
[ ] Particle effects stopped when complete
[ ] Temporary vehicles/peds deleted after use
[ ] Object pools not growing unbounded
```

## 2.7 Measurement & Thresholds (reference)

Anchor findings to `resmon` (F8 → `resmon 1`) and server-thread hitch, not vibes.

| Metric | Good | Investigate | Bad |
|--------|------|-------------|-----|
| Client resmon, idle | < 0.05 ms | 0.05–0.10 ms | > 0.10 ms |
| Client resmon, active/in-use | < 1.0 ms | 1.0–2.0 ms | > 2.0 ms |
| Server tick (per resource) | < 0.5 ms | 0.5–1.0 ms | > 1.0 ms |
| `CreateThread` count (one resource) | single digits | tens | hundreds |

**Whole-server budget:** a frame at 60 FPS is ~16.6 ms and the game itself needs most of it. The
sum of ALL resources should stay under **~8 ms**; any single resource consistently over **1 ms**
warrants investigation and over **5 ms** is a defect. A resource that looks fine alone can still be
the one that pushes a 40-resource server over budget — state its share, not just its absolute cost.

```
[ ] No single resource sitting > 0.05ms at idle on an empty server (idle cost is pure waste)
[ ] Server-side per-tick work bounded — heavy work moved to intervals/events, not every frame
[ ] OneSync entity count kept sane — each networked entity costs sync bandwidth/CPU for all nearby players
[ ] Profiling claims backed by an actual resmon reading when possible (state the number)
[ ] Event-driven over polled: an event costs nothing while idle, a thread costs every frame forever
```

**Deeper profiling** when resmon is not enough to localize the cost:
```
profiler record 500     # capture ~500 frames
profiler view           # open the recorded profile
```
Use it to name the actual hot function rather than guessing which loop is heavy.

Report the worst offenders with their measured/estimated ms, not just a pass/fail.

## 2.8 Platform-Level Performance Levers (server config, not code)

These are outside the resource but belong in the report when the audit touches a whole server —
a perfectly optimized resource still stutters on a misconfigured host.

```
[ ] sv_syncTickRate set deliberately (1–120, default 60). Lowering it cuts server CPU and
    bandwidth at the cost of sync smoothness; it REPLACES the deprecated sv_useAccurateSends
[ ] sv_resourceFileDownloadTimeout sane (default 2 min) — long streaming downloads on join
[ ] sv_endpointPrivacy / sv_forceIndirectListing do not conflict with the proxy setup
[ ] Streaming payload audited separately: oversized vehicle/clothing YTD textures dominate join
    time and client memory far more than Lua cost does
[ ] Resource count kept in check — every started resource has fixed scheduler overhead
[ ] Avoid `ensure *` — non-deterministic load order and starts resources nobody audited
```

**OneSync scope reality check:** entities are only created on clients inside a focus zone
(~424 units). A resource that spawns entities far outside any player's scope is paying server sync
cost for something nobody can see — flag it as waste, not just a style issue.
