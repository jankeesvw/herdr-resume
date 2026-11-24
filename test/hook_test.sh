#!/bin/sh
# Runs the hook the way the agents do: a fake claude or codex starts it as a
# child with a SessionStart payload on stdin, and a fake hc records the label.
set -u

here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
hook="$here/../hooks/herdr-resume-label"
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
mkdir "$root/bin"

for agent in claude codex; do
  cat >"$root/bin/$agent" <<EOF
#!/bin/sh
"$hook" $agent
status=\$?
exit \$status
EOF
  chmod +x "$root/bin/$agent"
done
cat >"$root/bin/hc" <<EOF
#!/bin/sh
printf '%s\n' "\$*" >"$root/hc.log"
EOF
chmod +x "$root/bin/hc"

id=01a207ef-8107-7271-9be2-69ffbda97af0
failures=0
count=0
# The folder in the payload; check() runs the agent in $root.
cwd=/work

# check <name> <expected hc arguments, empty for none> <terminal> <session> <agent> [args...]
check() {
  name=$1 want=$2 terminal=$3 session=$4 agent=$5
  shift 5
  count=$((count + 1))
  rm -f "$root/hc.log"
  printf '{"session_id":"%s","cwd":"%s","source":"startup"}' "$session" "$cwd" |
    (cd "$root" && env HC_TERMINAL_ID="$terminal" PATH="$root/bin:$PATH" "$root/bin/$agent" "$@")
  got=$(cat "$root/hc.log" 2>/dev/null)
  if [ "$got" != "$want" ]; then
    failures=$((failures + 1))
    printf 'FAIL %s\n  want: %s\n  got:  %s\n' "$name" "$want" "$got"
  fi
}

# label <provider> [flags]: what the hook should send for the folder /work.
label() {
  printf 'label t5 session.resume=%s:%s session.resume.flags=%s session.resume.cwd=/work' "$1" "$id" "${2:-}"
}
claude_label=$(label claude)
codex_label=$(label codex)

check "claude without flags" "$claude_label" t5 "$id" claude
check "claude keeps skip-permissions" "$(label claude --dangerously-skip-permissions)" t5 "$id" claude --model opus --dangerously-skip-permissions
check "claude keeps permission mode" "$(label claude '--permission-mode plan')" t5 "$id" claude --permission-mode plan
check "claude keeps permission mode with =" "$(label claude --permission-mode=plan)" t5 "$id" claude --permission-mode=plan
check "claude drops a strange mode" "$claude_label" t5 "$id" claude --permission-mode 'x;y'
check "claude -p is left alone" "" t5 "$id" claude -p summarize
check "claude --print is left alone" "" t5 "$id" claude --print summarize
check "codex interactive" "$codex_label" t5 "$id" codex
check "codex resume" "$codex_label" t5 "$id" codex resume "$id"
check "codex with an option value" "$codex_label" t5 "$id" codex -c model=exec
check "codex exec is left alone" "" t5 "$id" codex exec summarize
check "codex e is left alone" "" t5 "$id" codex e summarize
check "codex review is left alone" "" t5 "$id" codex review
check "codex exec after an option" "" t5 "$id" codex -c a=b --search exec summarize
if [ -r /proc/self/cmdline ]; then
  check "a codex prompt starting with review" "$codex_label" t5 "$id" codex "review this change"
fi
check "outside Herdr nothing happens" "" "" "$id" claude
check "a strange terminal is ignored" "" 't5;x' "$id" claude
check "a strange session id is ignored" "" t5 'x; rm -rf ~' claude

no_folder="label t5 session.resume=claude:$id session.resume.flags= session.resume.cwd="
cwd="/work/it's"
check "a folder with a quote is left out" "$no_folder" t5 "$id" claude
cwd=work
check "a relative folder is left out" "$no_folder" t5 "$id" claude
cwd='/work/a\"b'
check "an escaped folder falls back to where the agent runs" "label t5 session.resume=claude:$id session.resume.flags= session.resume.cwd=$root" t5 "$id" claude
cwd="/home/me/my project"
check "a folder with a space is kept" "label t5 session.resume=claude:$id session.resume.flags= session.resume.cwd=/home/me/my project" t5 "$id" claude
cwd=/work

if [ "$failures" -gt 0 ]; then
  printf '%s of %s failed\n' "$failures" "$count"
  exit 1
fi
printf '%s passed\n' "$count"
