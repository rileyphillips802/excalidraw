#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.command // empty')

echo "{
  \"permission\": \"ask\",
  \"user_message\": \"The agent wants to run: \`$command\` — is that okay?\",
  \"agent_message\": \"A hook is asking the user to confirm this git checkout/switch before proceeding.\"
}"
exit 0
