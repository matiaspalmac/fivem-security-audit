-- TEST FIXTURE — hardened client. Two-tier wait, no per-frame marker, full cleanup.
local shown = false

CreateThread(function()
    while true do
        local sleep = 1000
        local coords = GetEntityCoords(cache and cache.ped or PlayerPedId())
        local dist = #(coords - Config.ShopCoords)
        if dist < 20.0 then
            sleep = 0
            DrawMarker(1, Config.ShopCoords.x, Config.ShopCoords.y, Config.ShopCoords.z - 1.0,
                0,0,0, 0,0,0, 1.0,1.0,1.0, 255,0,0,100, false,false,2,nil,nil,false)
            if dist < 2.0 and IsControlJustPressed(0, 38) then
                -- send only intent (item + qty); server owns the price
                TriggerServerEvent('vshop:buy', 'water', 10)
            end
        end
        Wait(sleep)
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
end)
