#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done < "$SCRIPT_DIR/.env"
fi

COUCHDB_URL="${COUCHDB_URL:-http://127.0.0.1:5984}"
COUCHDB_USER="${COUCHDB_USER:?Set COUCHDB_USER in .env}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD:?Set COUCHDB_PASSWORD in .env}"
KANBAN_DB_NAME="${KANBAN_DB_NAME:-gestore-attivita-kanban}"
KANBAN_DB_USER="${KANBAN_DB_USER:-kanban_app}"
KANBAN_DB_PASSWORD="${KANBAN_DB_PASSWORD:?Set KANBAN_DB_PASSWORD in .env}"

auth=(-u "$COUCHDB_USER:$COUCHDB_PASSWORD")
json_header=(-H "Content-Type: application/json")

curl_json() {
  curl -fsS "${auth[@]}" "${json_header[@]}" "$@"
}

echo "Checking CouchDB at $COUCHDB_URL"
curl_json "$COUCHDB_URL/_up" >/dev/null

echo "Ensuring system databases exist"
for system_db in _users _replicator _global_changes; do
  status="$(curl -sS -o /tmp/couchdb-init-response.json -w "%{http_code}" "${auth[@]}" -X PUT "$COUCHDB_URL/$system_db")"
  if [[ "$status" != "201" && "$status" != "202" && "$status" != "412" ]]; then
    cat /tmp/couchdb-init-response.json >&2
    exit 1
  fi
done

echo "Ensuring application database exists: $KANBAN_DB_NAME"
status="$(curl -sS -o /tmp/couchdb-init-response.json -w "%{http_code}" "${auth[@]}" -X PUT "$COUCHDB_URL/$KANBAN_DB_NAME")"
if [[ "$status" != "201" && "$status" != "202" && "$status" != "412" ]]; then
  cat /tmp/couchdb-init-response.json >&2
  exit 1
fi

echo "Ensuring application user exists: $KANBAN_DB_USER"
user_id="org.couchdb.user:$KANBAN_DB_USER"
encoded_user_id="$(python3 - <<'PY' "$user_id"
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1], safe=""))
PY
)"
existing_user="$(curl -sS "${auth[@]}" "$COUCHDB_URL/_users/$encoded_user_id" || true)"
user_rev="$(python3 - <<'PY' "$existing_user"
import json, sys
try:
    print(json.loads(sys.argv[1]).get("_rev", ""))
except Exception:
    print("")
PY
)"

user_payload="$(python3 - <<'PY' "$user_id" "$KANBAN_DB_USER" "$KANBAN_DB_PASSWORD" "$user_rev"
import json, sys
doc = {
    "_id": sys.argv[1],
    "name": sys.argv[2],
    "password": sys.argv[3],
    "roles": ["kanban_app"],
    "type": "user",
}
if sys.argv[4]:
    doc["_rev"] = sys.argv[4]
print(json.dumps(doc))
PY
)"
curl_json -X PUT "$COUCHDB_URL/_users/$encoded_user_id" -d "$user_payload" >/dev/null

echo "Applying database security"
security_payload="$(python3 - <<'PY' "$COUCHDB_USER" "$KANBAN_DB_USER"
import json, sys
print(json.dumps({
    "admins": {"names": [sys.argv[1]], "roles": []},
    "members": {"names": [sys.argv[2]], "roles": ["kanban_app"]},
}))
PY
)"
curl_json -X PUT "$COUCHDB_URL/$KANBAN_DB_NAME/_security" -d "$security_payload" >/dev/null

echo "Installing app design document"
design_payload='{
  "_id": "_design/kanban",
  "views": {
    "by_type": {
      "map": "function (doc) { if (doc.type) emit(doc.type); }"
    },
    "tasks_by_owner": {
      "map": "function (doc) { if (doc.type === '\''kanban-task'\'' && doc.owner) emit([doc.owner, doc.workspaceId, doc.projectId], doc.updatedAt || null); }"
    },
    "tasks_by_group": {
      "map": "function (doc) { if (doc.type === '\''kanban-task'\'' && doc.groupId) emit([doc.groupId, doc.workspaceId, doc.projectId], doc.updatedAt || null); }"
    },
    "tasks_by_visible_to": {
      "map": "function (doc) { if (doc.type === '\''kanban-task'\'' && Array.isArray(doc.visibleTo)) { doc.visibleTo.forEach(function (name) { if (name) emit([name, doc.workspaceId, doc.projectId], doc.updatedAt || null); }); } }"
    }
  }
}'
existing_design="$(curl -sS "${auth[@]}" "$COUCHDB_URL/$KANBAN_DB_NAME/_design/kanban" || true)"
design_rev="$(python3 - <<'PY' "$existing_design"
import json, sys
try:
    print(json.loads(sys.argv[1]).get("_rev", ""))
except Exception:
    print("")
PY
)"
if [[ -n "$design_rev" ]]; then
  design_payload="$(python3 - <<'PY' "$design_payload" "$design_rev"
import json, sys
doc = json.loads(sys.argv[1])
doc["_rev"] = sys.argv[2]
print(json.dumps(doc))
PY
)"
fi
curl_json -X PUT "$COUCHDB_URL/$KANBAN_DB_NAME/_design/kanban" -d "$design_payload" >/dev/null

echo "Done."
echo "Remote database: https://${COUCHDB_DOMAIN:-pstdb.pst.my}/$KANBAN_DB_NAME"
echo "App user: $KANBAN_DB_USER"
