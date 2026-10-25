#!/usr/bin/env bash
# Runs every check before a change is called done. Same steps as CI (.github/workflows/ci.yml).
#   verify.sh          everything except e2e (fast)
#   verify.sh all      everything, including Playwright e2e (needs a fresh build)
#   verify.sh db|web|e2e|hooks   one group
set -uo pipefail
cd "$(dirname "$0")/../../.."

# Use the Node version in .nvmrc when nvm is installed.
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 && nvm use --silent >/dev/null 2>&1
fi

target="${1:-quick}"
failed=()

step() {
  local name="$1"; shift
  echo "── $name"
  if "$@" > /tmp/clubintel-verify-$$.log 2>&1; then
    # Show the result lines (counts), or nothing for silent tools like eslint and tsc.
    grep -E "Tests +[0-9]|^# (pass|fail) |Files=|Compiled|[0-9]+ passed|[0-9]+ failed" /tmp/clubintel-verify-$$.log | sed 's/^/   /'
  else
    tail -n 40 /tmp/clubintel-verify-$$.log
    failed+=("$name")
  fi
}


case "$target" in
  quick|all|web)
    step lint npm run lint
    step typecheck npm run typecheck
    step unit npm test
    ;;
esac
case "$target" in
  quick|all|hooks) step hooks npm run test:hooks ;;
esac
case "$target" in
  quick|all|db) step "db (pgTAP)" bash -c 'supabase status >/dev/null 2>&1 || { echo "Local Supabase is not running: npm run db:start"; exit 1; }; supabase test db < /dev/null' ;;
esac
case "$target" in
  quick|all|web) step build npm run build ;;
esac
case "$target" in
  all|e2e) step "e2e (Playwright)" npm run test:e2e ;;
esac

rm -f /tmp/clubintel-verify-$$.log
if [ ${#failed[@]} -eq 0 ]; then
  echo "ALL PASSED ($target)"
else
  echo "FAILED: ${failed[*]}"
  exit 1
fi
