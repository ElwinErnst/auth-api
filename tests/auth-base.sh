#!/usr/bin/env bash
set -u

BASE_URL="http://localhost:3001/api"
OUTPUT_DIR="auth-test-output"

EMAIL="admin@test.com"
PASSWORD="123456"
TENANT_SLUG="sentinel-labs"

mkdir -p "$OUTPUT_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$OUTPUT_DIR/log.txt"
}

write_response() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="${4:-}"
  local auth="${5:-}"

  local body_file="$OUTPUT_DIR/${name}.body.tmp"
  local headers_file="$OUTPUT_DIR/${name}.headers.tmp"
  local out_file="$OUTPUT_DIR/${name}.txt"

  rm -f "$body_file" "$headers_file" "$out_file"

  if [[ -n "$data" && -n "$auth" ]]; then
    http_code=$(curl -sS \
      -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $auth" \
      -D "$headers_file" \
      -o "$body_file" \
      -w "%{http_code}" \
      -d "$data")
  elif [[ -n "$data" ]]; then
    http_code=$(curl -sS \
      -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -D "$headers_file" \
      -o "$body_file" \
      -w "%{http_code}" \
      -d "$data")
  elif [[ -n "$auth" ]]; then
    http_code=$(curl -sS \
      -X "$method" "$url" \
      -H "Authorization: Bearer $auth" \
      -D "$headers_file" \
      -o "$body_file" \
      -w "%{http_code}")
  else
    http_code=$(curl -sS \
      -X "$method" "$url" \
      -D "$headers_file" \
      -o "$body_file" \
      -w "%{http_code}")
  fi

  {
    echo "=== REQUEST ==="
    echo "METHOD: $method"
    echo "URL: $url"
    if [[ -n "$auth" ]]; then
      echo "AUTH: Bearer <redacted>"
    fi
    if [[ -n "$data" ]]; then
      echo "BODY:"
      echo "$data"
    fi
    echo
    echo "=== RESPONSE STATUS ==="
    echo "$http_code"
    echo
    echo "=== RESPONSE HEADERS ==="
    cat "$headers_file" 2>/dev/null || true
    echo
    echo "=== RESPONSE BODY ==="
    cat "$body_file" 2>/dev/null || true
    echo
  } > "$out_file"

  echo "$http_code"
}

json_get() {
  local file="$1"
  local key="$2"
  python3 - <<PY
import json,sys
path = "$file"
key = "$key"
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    value = data.get(key, "")
    if value is None:
        value = ""
    print(value)
except Exception:
    print("")
PY
}

log "Starting auth endpoint tests"

LOGIN_PAYLOAD=$(cat <<JSON
{
  "email": "$EMAIL",
  "password": "$PASSWORD",
  "tenantSlug": "$TENANT_SLUG"
}
JSON
)

log "1. POST /auth/login"
status=$(write_response "01_login" "POST" "$BASE_URL/auth/login" "$LOGIN_PAYLOAD")
log "Login status: $status"

ACCESS_TOKEN=$(json_get "$OUTPUT_DIR/01_login.body.tmp" "accessToken")
REFRESH_TOKEN=$(json_get "$OUTPUT_DIR/01_login.body.tmp" "refreshToken")

log "Access token present: $([[ -n "$ACCESS_TOKEN" ]] && echo yes || echo no)"
log "Refresh token present: $([[ -n "$REFRESH_TOKEN" ]] && echo yes || echo no)"

log "2. GET /auth/me"
status=$(write_response "02_me" "GET" "$BASE_URL/auth/me" "" "$ACCESS_TOKEN")
log "Me status: $status"

log "3. POST /auth/refresh"
REFRESH_PAYLOAD=$(cat <<JSON
{
  "refreshToken": "$REFRESH_TOKEN"
}
JSON
)
status=$(write_response "03_refresh" "POST" "$BASE_URL/auth/refresh" "$REFRESH_PAYLOAD")
log "Refresh status: $status"

NEW_ACCESS_TOKEN=$(json_get "$OUTPUT_DIR/03_refresh.body.tmp" "accessToken")
NEW_REFRESH_TOKEN=$(json_get "$OUTPUT_DIR/03_refresh.body.tmp" "refreshToken")

log "New access token present: $([[ -n "$NEW_ACCESS_TOKEN" ]] && echo yes || echo no)"
log "New refresh token present: $([[ -n "$NEW_REFRESH_TOKEN" ]] && echo yes || echo no)"

log "4. Reuse old refresh token (should fail)"
status=$(write_response "04_refresh_reuse_old" "POST" "$BASE_URL/auth/refresh" "$REFRESH_PAYLOAD")
log "Refresh reuse status: $status"

log "5. POST /auth/logout with new refresh token"
LOGOUT_PAYLOAD=$(cat <<JSON
{
  "refreshToken": "$NEW_REFRESH_TOKEN"
}
JSON
)
status=$(write_response "05_logout" "POST" "$BASE_URL/auth/logout" "$LOGOUT_PAYLOAD")
log "Logout status: $status"

log "6. Refresh after logout (should fail)"
status=$(write_response "06_refresh_after_logout" "POST" "$BASE_URL/auth/refresh" "$LOGOUT_PAYLOAD")
log "Refresh after logout status: $status"

log "7. Login again for logout-all"
status=$(write_response "07_login_again" "POST" "$BASE_URL/auth/login" "$LOGIN_PAYLOAD")
log "Login again status: $status"

ACCESS2=$(json_get "$OUTPUT_DIR/07_login_again.body.tmp" "accessToken")
REFRESH2=$(json_get "$OUTPUT_DIR/07_login_again.body.tmp" "refreshToken")

log "Second access token present: $([[ -n "$ACCESS2" ]] && echo yes || echo no)"
log "Second refresh token present: $([[ -n "$REFRESH2" ]] && echo yes || echo no)"

log "8. POST /auth/logout-all"
status=$(write_response "08_logout_all" "POST" "$BASE_URL/auth/logout-all" "" "$ACCESS2")
log "Logout-all status: $status"

log "9. Refresh after logout-all (should fail)"
REFRESH2_PAYLOAD=$(cat <<JSON
{
  "refreshToken": "$REFRESH2"
}
JSON
)
status=$(write_response "09_refresh_after_logout_all" "POST" "$BASE_URL/auth/refresh" "$REFRESH2_PAYLOAD")
log "Refresh after logout-all status: $status"

log "Finished. Files generated in $OUTPUT_DIR"
ls -1 "$OUTPUT_DIR" | tee -a "$OUTPUT_DIR/log.txt"