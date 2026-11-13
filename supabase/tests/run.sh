#!/usr/bin/env bash
# Runs the RLS tests against any Postgres 15+ you can reach (local Docker is fine).
# Usage: PGURL=postgres://postgres@localhost:5432/postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${PGURL:?set PGURL to a throwaway Postgres database}"
P="psql $PGURL -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists giftit_test" -c "create database giftit_test"
T="${PGURL%/*}/giftit_test"
psql "$T" -v ON_ERROR_STOP=1 -q -f supabase/tests/supabase_shim.sql
psql "$T" -v ON_ERROR_STOP=1 -q -f supabase/migrations/0001_init.sql
psql "$T" -v ON_ERROR_STOP=1 -q -f supabase/tests/grants.sql
psql "$T" -q -t -f supabase/tests/rls_test.sql 2>&1 | grep -E "ok |FAIL|ERROR|PASSED"
