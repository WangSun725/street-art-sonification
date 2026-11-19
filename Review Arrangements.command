#!/bin/zsh
set -e
project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"
review_url="http://127.0.0.1:8766/review"
if curl --silent --fail "http://127.0.0.1:8766/api/arrangement-review/manifest" >/dev/null; then
  open -a Safari "$review_url"
  exit 0
fi
if [[ ! -x .interaction-env/bin/python ]]; then
  print "Please run Install & Start.command first."
  read "?Press Enter to close."
  exit 1
fi
print "Arrangement Listening Review is starting."
print "Keep this window open while reviewing; your choices are saved locally."
.interaction-env/bin/python webapp/arrangement_review_server.py &
review_pid=$!
trap 'kill "$review_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in {1..50}; do
  if curl --silent --fail "http://127.0.0.1:8766/review" >/dev/null; then
    open -a Safari "$review_url"
    break
  fi
  sleep .2
done
wait "$review_pid"
