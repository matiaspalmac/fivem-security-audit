# Expected Audit Results — validation oracle

Use this to verify the skill is working. Run the skill in each fixture directory and compare.

```
cd examples/vulnerable_shop && claude   # then: /fivem-security-audit
cd examples/secure_shop     && claude   # then: /fivem-security-audit
```

A correct run should produce **no false positives on `secure_shop`** and find **every issue below on `vulnerable_shop`**. If a CRITICAL is missed or a clean file is flagged, the skill regressed.

## vulnerable_shop — expected findings

| ID | Severity | File | Issue |
|----|----------|------|-------|
| SEC-1.2 | CRITICAL | server/main.lua | SQL injection — `itemName` concatenated into query |
| SEC-1.3 | CRITICAL | server/main.lua | Dupe — no balance check, no mutex, qty/negative unvalidated |
| SEC-1.10 | CRITICAL | server/main.lua + client + html | Client sends price/qty; server trusts it |
| SEC-1.1 | CRITICAL | server/main.lua | Uses client-sent `playerId` instead of `source` |
| SEC-1.4 / M.13 | CRITICAL | server/main.lua | `add_principal` from client-controlled `license` (ACE escalation) |
| SEC-1.6 | HIGH | server/main.lua | No rate limiting on buy event |
| SEC-1.7 | HIGH | server/main.lua | No server-side proximity check |
| SEC-1.5 | HIGH | html/index.html | XSS — `innerHTML` with message data, no origin check |
| PERF-2.1 | CRITICAL | client/main.lua | Unconditional `Wait(0)` + per-frame `DrawMarker` |
| PERF-2.2 | MEDIUM | client/main.lua | `PlayerPedId()`/`GetEntityCoords` uncached per frame |
| CLEANUP-3.1 | HIGH | server/main.lua | `sessions[source]` never cleaned (no `playerDropped`) |
| CLEANUP-3.2 | HIGH | client/main.lua | No `onResourceStop` cleanup |
| COMPAT-4.1 | MEDIUM | fxmanifest.lua | Wildcard includes, missing lua54/version/author/deps, no strict NUI mode |

Expected verdict: **multiple CRITICAL → NOT production ready**, score well below 60.

Malware phase note: the live backdoor line in `server/main.lua` is intentionally commented and non-functional (this corpus ships no working malware). The skill should still be able to explain the `PerformHttpRequest + load()` pattern (M.1) when asked.

## secure_shop — expected findings

- **0 CRITICAL, 0 HIGH.** At most LOW/informational notes.
- Verdict: **Production ready** (score ≥ 80).
- Any finding flagged here that maps to a legitimate framework pattern (ESX export, parameterized oxmysql, mutex, origin-checked NUI) is a **false positive** and indicates the skill is over-flagging.
