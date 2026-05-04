#!/usr/bin/env bash
read -r input
echo '{"permission":"deny","reason":"Blocked: .env files contain secrets and must not be read by agents.","user_message":"I tried to read an .env file but a safety hook blocked it — these files may contain secrets (API keys, tokens, credentials). If you need specific config values, please share them manually."}'
exit 0
