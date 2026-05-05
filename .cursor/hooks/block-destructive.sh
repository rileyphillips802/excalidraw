#!/usr/bin/env bash
input=$(cat)
cmd=$(echo "$input" | jq -r '.command // ""')

# Risky git commands — ask the user before proceeding
# Covers: force push, force-with-lease, hard reset, branch force-delete,
#         clean, restore (discard working-tree changes), stash drop/clear
if echo "$cmd" | grep -qE \
  '(^|&&|;|\|) *git (push.*(--force|-f\b)|push.*--force-with-lease)' \
  || echo "$cmd" | grep -qE \
  '(^|&&|;|\|) *git reset --hard' \
  || echo "$cmd" | grep -qE \
  '(^|&&|;|\|) *git branch -[Dd] ' \
  || echo "$cmd" | grep -qE \
  '(^|&&|;|\|) *git clean -' \
  || echo "$cmd" | grep -qE \
  '(^|&&|;|\|) *git restore( |$)' \
  || echo "$cmd" | grep -qE \
  '(^|&&|;|\|) *git stash (drop|clear)'; then
  jq -n --arg cmd "$cmd" \
    '{"permission":"ask","user_message":("Heads up — the agent wants to run a risky git command: `" + $cmd + "`. Okay to proceed?"),"agent_message":"A hook is asking the user to confirm this git command before running it."}'
  exit 0
fi

# rm -rf: block unless the target basename is in the allowlist
# Only match when rm is the actual command (start of string or after shell operator)
if echo "$cmd" | grep -qE '(^|&&|;|\|) *rm +-[rRfF]*[rf][rRfF]*'; then
  paths=$(echo "$cmd" | awk '{
    for(i=1;i<=NF;i++) {
      if($i=="rm") { skip=1; continue }
      if(skip && substr($i,1,1)=="-") continue
      if(skip) print $i
    }
  }')

  all_allowed=true
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    base=$(basename "$p")
    case "$base" in
      node_modules|dist|build|.cache|.next|coverage|tmp) ;;
      *) all_allowed=false; break ;;
    esac
  done <<< "$paths"

  if [ "$all_allowed" = false ]; then
    jq -n --arg cmd "$cmd" \
      '{"permission":"deny","reason":"Blocked: rm -rf against a non-allowlisted path.","user_message":("Safety hook blocked `" + $cmd + "`. Allowlisted basenames: node_modules, dist, build, .cache, .next, coverage, tmp.")}'
    exit 0
  fi
fi

echo '{"permission":"allow"}'
exit 0
