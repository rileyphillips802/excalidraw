#!/usr/bin/env bash
input=$(cat)
cmd=$(echo "$input" | jq -r '.command // ""')

# Destructive git commands
if echo "$cmd" | grep -qE 'git push.*(--force|-f)( |$)|git reset --hard|git branch -D|git clean -fd'; then
  echo '{"permission":"deny","reason":"Blocked: destructive git command.","user_message":"I was about to run a destructive git command but a safety hook blocked it. Please confirm explicitly if you want to proceed: `'"$cmd"'`"}'
  exit 0
fi

# rm -rf: allow only known safe build artifact paths (matched by basename)
if echo "$cmd" | grep -qE 'rm -[rRfF]*f[rRfF]*|-[rRfF]*r[rRfF]*'; then
  # Use awk to extract path arguments: skip argv[0] (rm) and any flag tokens (start with -)
  paths=$(echo "$cmd" | awk '{for(i=2;i<=NF;i++) if(substr($i,1,1)!="-") print $i}')

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
    echo '{"permission":"deny","reason":"Blocked: rm -rf against a non-allowlisted path.","user_message":"I tried to run `'"$cmd"'` but a safety hook blocked it. Only these basenames are allowlisted for rm -rf: node_modules, dist, build, .cache, .next, coverage, tmp. Ask me explicitly if you really want this."}'
    exit 0
  fi
fi

echo '{"permission":"allow"}'
exit 0
