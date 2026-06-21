# Phase 5: Architecture & Code Quality

Senior-grade architecture and code-quality review. **Library-agnostic:** these are quality
signals, not a requirement to use any specific library. A resource can be standalone, on a
framework, or on a utility library and still score well — the question is whether it is
structured, typed, and efficient.

> **Quality, not security.** This phase does NOT affect the CRITICAL security gate or the
> security score. Report it separately as a quality grade (A–F) with concrete findings.
> Never downgrade a secure resource just because it is standalone or doesn't use ox_lib.

## 5.1 Module system & globals (HIGH quality impact)
```
[ ] Files are organized as modules that return their API (not one giant script)
[ ] Loaded via a single entrypoint (client/init.lua, server/init.lua) + require / loader
[ ] No unnecessary resource globals leaking across files (state/config/framework as globals)
[ ] Single-responsibility files (a 1000-line main.lua that does everything = flag)
[ ] config returned/encapsulated, not a mutable global anyone overwrites
```
Why: encapsulation, testability, no namespace pollution. The #1 quality lever.

## 5.2 Typing & LSP (MEDIUM)
```
[ ] LSP annotations on public APIs (---@param, ---@return, ---@class, string-literal unions)
[ ] .luarc.json present, runtime Lua 5.4, fivem-lls-addon in workspace.library
[ ] Typed state module(s) instead of scattered locals/globals
```

## 5.3 Async & callbacks (HIGH)
```
[ ] No `while not done do Wait(0) end` busy-wait for async results (CPU waste + jank)
[ ] Request/response uses a promise-based callback (standalone util, framework, or ox_lib)
[ ] DB calls are async/awaited (oxmysql .await / callback), never blocking the main thread
[ ] `source` injected server-side in callbacks; never a client-sent id
```

## 5.4 State sync (MEDIUM)
```
[ ] Shared entity/player state uses statebags (Entity().state / Player().state / GlobalState)
    rather than manual `for _, id in GetPlayers() do TriggerClientEvent(...)` broadcast loops
[ ] Server is authority for persistent/economic/permission state; client only for visual/ephemeral
[ ] State bag change handlers check `replicated` for sensitive keys
```

## 5.5 Proximity & threads (HIGH — overlaps performance)
```
[ ] No unconditional `while true do Wait(0)` (two-tier conditional thread, points helper, or zones)
[ ] Natives cached (PlayerPedId/coords), not called every frame
[ ] DrawMarker/3D-text only when player is in range
```

## 5.6 Locales (LOW)
```
[ ] Locales externalized (JSON preferred: translatable, mergeable, interpolation)
[ ] No hardcoded user-facing strings scattered in logic
```

## 5.7 NUI build & contract (MEDIUM, if UI present)
```
[ ] Built UI (React/Vue/Svelte + a bundler like Vite) with a build step, OR a deliberately
    simple static UI — not unmaintainable inline HTML strings in Lua
[ ] Typed Lua<->NUI contract (useNuiEvent/fetchNui style), shared interfaces
[ ] A browser dev/mock path so the UI builds without launching the game
[ ] Build output committed for drag-n-drop release; source present (not minified-only)
```

## 5.8 Manifest & structure (LOW)
```
[ ] fx_version 'cerulean', lua54 'yes', version/author/description declared
[ ] Single entrypoint per side + files{} for require-loaded modules (no fragile ordered lists)
[ ] No wildcard EXECUTABLE script includes (server_scripts { '*.lua' })
[ ] Optional companions integrated behind GetResourceState(...) (graceful degradation)
```

## 5.9 Tooling (LOW)
```
[ ] StyLua / selene config present; CI runs lint + (web) tsc + build
[ ] Consistent naming; no deprecated natives (Citizen.*, RegisterServerEvent), no __resource.lua
```

## Quality grade
Start at A. Drop a letter per cluster of misses:
- Globals everywhere / no modules / 1000-line files → down to C or below.
- Busy-wait async / unconditional Wait(0) loops → down a grade.
- Inline-HTML-string UI with no build → down a grade (if UI is non-trivial).
Report: grade + the top 3–5 concrete upgrades, each with file:line and the pattern to adopt.
