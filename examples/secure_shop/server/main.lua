-- TEST FIXTURE — hardened counterpart. A clean audit should report 0 CRITICAL here.
local ESX = exports['es_extended']:getSharedObject()

local locks = {}      -- per-source mutex (race/dupe protection)
local cooldowns = {}  -- per-source rate limit

RegisterNetEvent('vshop:buy', function(itemName, qty)
    local src = source                                   -- server-resolved id, never client-sent

    if type(itemName) ~= 'string' or #itemName > 32 then return end
    if type(qty) ~= 'number' or qty ~= qty then return end -- NaN guard
    qty = math.floor(qty)
    if qty < 1 or qty > Config.MaxQty then return end    -- range + negative rejection

    local now = os.time()
    if cooldowns[src] and now - cooldowns[src] < Config.BuyCooldown then return end
    cooldowns[src] = now

    if locks[src] then return end                        -- mutex
    locks[src] = true

    local item = Config.Items[itemName]                  -- server-authoritative price
    if not item then locks[src] = nil return end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then locks[src] = nil return end

    -- proximity check (never trust client position)
    local ped = GetPlayerPed(src)
    if ped == 0 or #(GetEntityCoords(ped) - Config.ShopCoords) > 5.0 then
        locks[src] = nil return
    end

    local total = item.price * qty
    if xPlayer.getMoney() < total then locks[src] = nil return end -- balance before deduct

    xPlayer.removeMoney(total)                           -- atomic: deduct then give
    xPlayer.addInventoryItem(itemName, qty)
    locks[src] = nil
end)

AddEventHandler('playerDropped', function()
    local src = source
    locks[src] = nil
    cooldowns[src] = nil
end)
