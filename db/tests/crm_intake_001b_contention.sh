#!/usr/bin/env bash
set -euo pipefail

psql_base=(psql -X -v ON_ERROR_STOP=1 -qAt)

# Two independent connections race the same idempotency key. Connection A holds
# the unique-key claim open; connection B must wait and then lose with a unique
# violation after A commits.
cat > /tmp/intake_contention_a.sql <<'SQL'
BEGIN;
INSERT INTO crm_intake_submissions (
  id, tenant_id, definition_id, definition_version_id, state, source, idempotency_key
) VALUES (
  '62000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  'CREATED', 'API', 'contention-idempotency-key'
);
SELECT pg_sleep(2);
COMMIT;
SQL

cat > /tmp/intake_contention_b.sql <<'SQL'
INSERT INTO crm_intake_submissions (
  id, tenant_id, definition_id, definition_version_id, state, source, idempotency_key
) VALUES (
  '62000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  'CREATED', 'API', 'contention-idempotency-key'
);
SQL

"${psql_base[@]}" -f /tmp/intake_contention_a.sql > /tmp/intake_a.out 2> /tmp/intake_a.err &
pid_a=$!
sleep 0.25

set +e
"${psql_base[@]}" -f /tmp/intake_contention_b.sql > /tmp/intake_b.out 2> /tmp/intake_b.err &
pid_b=$!
wait "$pid_b"
status_b=$?
set -e
wait "$pid_a"

if [[ "$status_b" -eq 0 ]]; then
  echo "Expected second concurrent idempotent insert to fail, but it succeeded" >&2
  exit 1
fi

if ! grep -qi "duplicate key value violates unique constraint" /tmp/intake_b.err; then
  echo "Second concurrent insert failed for the wrong reason" >&2
  cat /tmp/intake_b.err >&2
  exit 1
fi

idempotent_count=$("${psql_base[@]}" -c "SELECT count(*) FROM crm_intake_submissions WHERE idempotency_key = 'contention-idempotency-key';")
if [[ "$idempotent_count" != "1" ]]; then
  echo "Expected exactly one committed row after idempotency contention, got ${idempotent_count}" >&2
  exit 1
fi

# Create a mutable aggregate for optimistic-revision contention.
"${psql_base[@]}" <<'SQL'
INSERT INTO crm_intake_submissions (
  id, tenant_id, definition_id, definition_version_id, state, source, idempotency_key, revision
) VALUES (
  '63000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  'IN_PROGRESS', 'API', 'revision-contention-key', 0
);
SQL

cat > /tmp/intake_revision_a.sql <<'SQL'
BEGIN;
UPDATE crm_intake_submissions
SET revision = revision + 1
WHERE id = '63000000-0000-0000-0000-000000000001'
  AND revision = 0;
SELECT pg_sleep(2);
COMMIT;
SQL

cat > /tmp/intake_revision_b.sql <<'SQL'
UPDATE crm_intake_submissions
SET revision = revision + 1
WHERE id = '63000000-0000-0000-0000-000000000001'
  AND revision = 0;
SQL

"${psql_base[@]}" -f /tmp/intake_revision_a.sql > /tmp/revision_a.out 2> /tmp/revision_a.err &
revision_pid_a=$!
sleep 0.25
"${psql_base[@]}" -f /tmp/intake_revision_b.sql > /tmp/revision_b.out 2> /tmp/revision_b.err &
revision_pid_b=$!
wait "$revision_pid_b"
wait "$revision_pid_a"

final_revision=$("${psql_base[@]}" -c "SELECT revision FROM crm_intake_submissions WHERE id = '63000000-0000-0000-0000-000000000001';")
if [[ "$final_revision" != "1" ]]; then
  echo "Expected one winning revision transition under contention, got revision ${final_revision}" >&2
  exit 1
fi

echo "J3S-CRM-INTAKE-001B independent-connection contention checks PASS"
