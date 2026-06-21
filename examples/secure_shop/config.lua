-- TEST FIXTURE — server-authoritative config (prices live here, never on the client).
Config = {}

Config.ShopCoords = vector3(25.0, -1347.0, 29.5)
Config.MaxQty = 100
Config.BuyCooldown = 3 -- seconds

Config.Items = {
    water = { label = 'Water', price = 5 },
    bread = { label = 'Bread', price = 8 },
}
