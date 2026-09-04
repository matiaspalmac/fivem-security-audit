-- TEST FIXTURE — intentionally insecure. See ../EXPECTED.md. Do NOT deploy.
-- Covers the connection phase, logging/privacy, capture and server-thread checks.

-- BUG[SEC-1.13b]: webhook URL set with `setr` is readable by every client via F8
local WEBHOOK = GetConvar('vshop_webhook', '')

-- BUG[SEC-1.20]: no rejection when the player has no license identifier,
-- ban lookup matches a SINGLE identifier, and done() is missed on the error path.
AddEventHandler('playerConnecting', function(name, setKickReason, deferrals)
    local src = source
    deferrals.defer()

    local license
    for _, id in ipairs(GetPlayerIdentifiers(src)) do
        if id:sub(1, 8) == 'license:' then license = id end
    end
    -- BUG: connection continues even with no license (untraceable identity)

    -- BUG[SEC-1.20]: presentCard interpolates the player-supplied name unescaped
    deferrals.presentCard(('{"type":"AdaptiveCard","body":[{"type":"TextBlock","text":"Hola %s"}]}'):format(name))

    MySQL.query('SELECT id FROM bans WHERE license = ?', { license }, function(rows)
        if rows and rows[1] then
            deferrals.done('Baneado')
            return
        end
        -- BUG: no deferrals.done() on the success path AND none on query failure
        -- (a DB error leaves the player hanging on "connecting" forever)
    end)

    -- BUG[SEC-1.13b]: logs full identifier list + endpoint (IP) to an external sink per attempt
    if WEBHOOK ~= '' then
        PerformHttpRequest(WEBHOOK, function() end, 'POST', json.encode({
            content = ('join %s | %s | ip %s'):format(name, json.encode(GetPlayerIdentifiers(src)), GetPlayerEndpoint(src))
        }), { ['Content-Type'] = 'application/json' })
    end
end)

-- BUG[SEC-1.21]: hands the client the upload destination, so every player learns the
-- webhook URL and can post to it directly.
RegisterNetEvent('vshop:screenshot')
AddEventHandler('vshop:screenshot', function()
    TriggerClientEvent('vshop:doScreenshot', source, WEBHOOK)
end)

-- BUG[PERF-2.0 / SEC-1.19]: unbounded loop over client-supplied data with no yield.
-- A single event with a large `count` freezes the whole server thread.
RegisterNetEvent('vshop:report')
AddEventHandler('vshop:report', function(count, text)
    local out = ''
    for _ = 1, count do            -- BUG: `count` is attacker-controlled, no cap, no Wait
        out = out .. text          -- BUG: memory bomb via string growth
    end
    print(('report len %d'):format(#out))
end)

-- BUG[SEC-1.12]: trusts a client-replicated state bag for an authorization decision
AddStateBagChangeHandler('vshop_vip', nil, function(bagName, _, value)
    if value then
        local ply = GetPlayerFromStateBagName(bagName)
        if ply and ply > 0 then
            TriggerClientEvent('vshop:grantVip', ply)  -- BUG: `replicated` never checked
        end
    end
end)
