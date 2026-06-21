-- TEST FIXTURE — intentionally insecure. See ../EXPECTED.md. Do NOT deploy.

local shopCoords = vector3(25.0, -1347.0, 29.5)

-- BUG[PERF-2.1]: unconditional Wait(0) thread + DrawMarker every frame, no distance gating
CreateThread(function()
    while true do
        Wait(0)
        DrawMarker(1, shopCoords.x, shopCoords.y, shopCoords.z - 1.0,
            0,0,0, 0,0,0, 1.0,1.0,1.0, 255,0,0,100, false,false,2,nil,nil,false)
        -- BUG[PERF-2.2]: PlayerPedId()/GetEntityCoords called every frame
        local coords = GetEntityCoords(PlayerPedId())
        if #(coords - shopCoords) < 2.0 then
            if IsControlJustPressed(0, 38) then
                -- BUG[SEC-1.10]: client computes price and sends it to server
                TriggerServerEvent('vshop:buy', GetPlayerServerId(PlayerId()), 'water', 5, 10)
            end
        end
    end
end)

-- BUG[CLEANUP-3.2]: no onResourceStop handler (marker thread/state never cleaned)
