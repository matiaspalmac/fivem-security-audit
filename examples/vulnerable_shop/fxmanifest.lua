-- TEST FIXTURE — intentionally insecure resource for validating fivem-security-audit.
-- Do NOT deploy. Every issue here is deliberate; see ../EXPECTED.md.
fx_version 'cerulean'
game 'gta5'
-- BUG[COMPAT]: no lua54, no version/author/description declared

client_scripts {
    'client/*.lua' -- BUG[COMPAT]: wildcard include can load injected files
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/*.lua' -- BUG[COMPAT]: wildcard include
}

ui_page 'html/index.html'
files { 'html/index.html' }
-- BUG[COMPAT]: missing dependency declaration for es_extended / oxmysql
-- BUG[COMPAT]: nui_callback_strict_mode not set
