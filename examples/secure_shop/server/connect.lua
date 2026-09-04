-- TEST FIXTURE — hardened counterpart. A clean audit should report 0 CRITICAL/HIGH here.
-- Anything flagged in this file is a FALSE POSITIVE.

-- Webhook stays server-side and is read from a NON-replicated convar (`set`, not `setr`).
local WEBHOOK = GetConvar('vshop_webhook', '')

local function identifiersOf(src)
    local ids = {}
    for _, id in ipairs(GetPlayerIdentifiers(src)) do
        local kind = id:match('^(%w+):')
        if kind then ids[kind] = id end
    end
    return ids
end

AddEventHandler('playerConnecting', function(_, _, deferrals)
    local src = source
    deferrals.defer()
    Wait(0)

    local ids = identifiersOf(src)
    if not ids.license then
        deferrals.done('No license identifier — cannot verify identity.')
        return
    end

    -- Ban lookup matches MULTIPLE identifiers; a spoofed single ID does not slip through.
    local ok, rows = pcall(MySQL.query.await,
        'SELECT id FROM bans WHERE license = ? OR discord = ? OR fivem = ? LIMIT 1',
        { ids.license, ids.discord or '', ids.fivem or '' })

    if not ok then
        -- Every path terminates: a DB failure closes the deferral instead of hanging it.
        print(('[vshop] ban lookup failed for %s'):format(ids.license))
        deferrals.done('Auth service unavailable, try again shortly.')
        return
    end

    if rows and rows[1] then
        deferrals.done('Banned.')
        return
    end

    deferrals.done()
end)

-- Capture is permission-gated and the upload is proxied server-side: the client never
-- receives the destination URL or any credential.
local captureCooldown = {}

RegisterNetEvent('vshop:requestCapture', function(targetId)
    local src = source
    if not IsPlayerAceAllowed(src, 'vshop.capture') then return end
    if type(targetId) ~= 'number' then return end

    local now = os.time()
    if captureCooldown[src] and now - captureCooldown[src] < 10 then return end
    captureCooldown[src] = now

    exports['screenshot-basic']:requestClientScreenshot(targetId, { encoding = 'jpg', quality = 0.7 },
        function(err, data)
            if err or WEBHOOK == '' then return end
            -- Server performs the upload; the image is supporting evidence, not proof.
            PerformHttpRequest(WEBHOOK, function() end, 'POST',
                json.encode({ content = ('capture of %d requested by %d'):format(targetId, src), image = data }),
                { ['Content-Type'] = 'application/json' })
        end)
end)

-- Bounded work: client input is capped before it is used as a loop count.
RegisterNetEvent('vshop:report', function(text)
    local src = source
    if type(text) ~= 'string' or #text > 512 then return end
    print(('[vshop] report from %d (%d chars)'):format(src, #text))
end)

-- Sensitive state is server-set only, and the handler rejects client-replicated writes.
AddStateBagChangeHandler('vshop_vip', nil, function(bagName, _, value, _, replicated)
    if replicated then return end -- client-originated change: ignore
    local ply = GetPlayerFromStateBagName(bagName)
    if ply and ply > 0 and value then
        TriggerClientEvent('vshop:grantVip', ply)
    end
end)

AddEventHandler('playerDropped', function()
    captureCooldown[source] = nil
end)
