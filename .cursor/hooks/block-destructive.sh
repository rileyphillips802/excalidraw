#!/usr/bin/env bash
input=$(cat)
cmd=$(echo "$input" | jq -r '.command // ""')

# Destructive git commands
if echo "$cmd" | grep -qE '(^|&&|;|\|) *git push.*(--force|-f)( |$)|(^|&&|;|\|) *git reset --hard|(^|&&|;|\|) *git branch -D (main|master|develop)|(^|&&|;|\|) *git clean -fd'; then
  jq -n --arg cmd "$cmd" \
    '{"permission":"deny","reason":"Blocked: destructive git command.","user_message":("Safety hook blocked a destructive git command. Confirm explicitly to proceed: `" + $cmd + "`")}'
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
