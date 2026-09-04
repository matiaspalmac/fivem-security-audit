-- TEST FIXTURE — the hardened counterpart of ../vulnerable_shop. See ../EXPECTED.md.
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'Dei'
version '1.0.0'
description 'Secure shop fixture'

nui_callback_strict_mode 'true'

shared_scripts {
    'config.lua',
}

client_scripts {
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
    'server/connect.lua',
}

ui_page 'html/index.html'
files { 'html/index.html' }

dependencies { 'es_extended', 'oxmysql' }
