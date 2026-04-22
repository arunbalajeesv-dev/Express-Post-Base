#!/usr/bin/env bash
# =========================================================
#  Sales Tracker API — End-to-End Shell Tests
#  Run: bash scripts/test-api.sh
# =========================================================

set -euo pipefail

BASE="${API_URL:-http://localhost:8080}/api"
PASS=0; FAIL=0; SKIP=0

GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[0;33m"
CYAN="\033[0;36m"; BOLD="\033[1m"; RESET="\033[0m"

section() { echo -e "\n${BOLD}${CYAN}══ $1 ══${RESET}"; }
pass()    { echo -e "  ${GREEN}✓ PASS${RESET}  $1"; PASS=$((PASS+1)); }
fail()    { echo -e "  ${RED}✗ FAIL${RESET}  $1\n         ${RED}→ $2${RESET}"; FAIL=$((FAIL+1)); }
skip()    { echo -e "  ${YELLOW}⊘ SKIP${RESET}  $1 ($2)"; SKIP=$((SKIP+1)); }

assert_status() {
  local label="$1" expected="$2" actual="$3" body="${4:-}"
  if [ "$actual" = "$expected" ]; then pass "$label (HTTP $actual)"
  else fail "$label" "Expected HTTP $expected, got HTTP $actual — ${body:0:120}"; fi
}
assert_eq() {
  local label="$1" json="$2" path="$3" expected="$4"
  local actual; actual=$(echo "$json" | jq -r "$path" 2>/dev/null || echo "__ERR__")
  if [ "$actual" = "$expected" ]; then pass "$label"
  else fail "$label" "Expected '$expected', got '$actual'"; fi
}
assert_not_null() {
  local label="$1" json="$2" path="$3"
  local actual; actual=$(echo "$json" | jq -r "$path" 2>/dev/null || echo "null")
  if [ "$actual" != "null" ] && [ -n "$actual" ]; then pass "$label"
  else fail "$label" "Expected non-null at $path, got: $actual"; fi
}
assert_gt0() {
  local label="$1" json="$2" expr="$3"
  local val; val=$(echo "$json" | jq "$expr" 2>/dev/null || echo "0")
  if [ "$val" -gt 0 ] 2>/dev/null; then pass "$label ($val items)"
  else fail "$label" "Expected > 0, got: $val"; fi
}
assert_true() {
  local label="$1" json="$2" expr="$3"
  local result; result=$(echo "$json" | jq "$expr" 2>/dev/null || echo "false")
  if [ "$result" = "true" ]; then pass "$label"
  else fail "$label" "Expression: $expr → $result"; fi
}
assert_is_array() {
  local label="$1" json="$2" path="${3:-.}"
  local t; t=$(echo "$json" | jq -r "($path) | type" 2>/dev/null || echo "unknown")
  if [ "$t" = "array" ]; then pass "$label (type=array)"
  else fail "$label" "Expected array, got type=$t"; fi
}

# Perform curl; sets RESP_BODY and RESP_STATUS
do_req() {
  local method="$1" path="$2"; shift 2
  local token="" body=""
  while [[ $# -gt 0 ]]; do
    case "$1" in --auth) token="$2"; shift 2 ;; --json) body="$2"; shift 2 ;; *) shift ;; esac
  done
  local args=(-s -w "\n__STATUS__%{http_code}" -X "$method")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body"  ] && args+=(-H "Content-Type: application/json" -d "$body")
  local raw; raw=$(curl "${args[@]}" "${BASE}${path}" 2>/dev/null)
  RESP_BODY=$(echo "$raw" | sed '$d')
  RESP_STATUS=$(echo "$raw" | tail -1 | sed 's/__STATUS__//')
}

# ── state ────────────────────────────────────────────────
MANAGER_TOKEN="" ; AGENT_TOKEN=""
NEW_USER_DB_ID="" ; NEW_BRAND_ID="" ; NEW_VISIT_ID=""
NEW_FU_ID1="" ; NEW_FU_ID2="" ; NEW_FU_ID3=""
INVOICE="INV-E2E-$(date +%s)"
# Generate a unique 10-digit Indian mobile (starts with 9, uses epoch digits)
MOBILE_E2E="9$(date +%s | cut -c2-10)"
TOMORROW=$(date -d "+2 days" +%Y-%m-%d 2>/dev/null || date -v+2d +%Y-%m-%d 2>/dev/null || echo "2026-06-01")

# =========================================================
#  1. HEALTH CHECK
# =========================================================
section "1. Health Check"

do_req GET /healthz
assert_status "GET /healthz — service up"  200 "$RESP_STATUS"
assert_eq     "status field is 'ok'"  "$RESP_BODY" ".status" "ok"

# =========================================================
#  2. AUTH
# =========================================================
section "2. Authentication"

do_req POST /login --json '{"user_id":"admin01","password":"badpass"}'
assert_status "POST /login — wrong password → 401"  401 "$RESP_STATUS"

do_req POST /login --json '{}'
assert_status "POST /login — empty body → 400"      400 "$RESP_STATUS"

do_req POST /login --json '{"user_id":"admin01","password":"manager123"}'
assert_status "POST /login — manager login → 200"   200 "$RESP_STATUS"
MANAGER_TOKEN=$(echo "$RESP_BODY" | jq -r '.token // empty')
if [ -z "$MANAGER_TOKEN" ]; then
  fail "Manager token received" "Empty — is the server running at $BASE?"
  exit 1
fi
pass "Manager JWT received"
assert_eq "Login response has user.role=Manager" "$RESP_BODY" ".user.role" "Manager"
assert_eq "Login response has user.userId"       "$RESP_BODY" ".user.userId" "admin01"

do_req POST /login --json '{"user_id":"agent01","password":"agent123"}'
assert_status "POST /login — agent login → 200"     200 "$RESP_STATUS"
AGENT_TOKEN=$(echo "$RESP_BODY" | jq -r '.token // empty')
[ -n "$AGENT_TOKEN" ] && pass "Agent JWT received" || fail "Agent JWT received" "Empty"
assert_eq "Login response has user.role=Sales" "$RESP_BODY" ".user.role" "Sales"

do_req GET /users
assert_status "GET /users — no token → 401"         401 "$RESP_STATUS"

# =========================================================
#  3. USERS
# =========================================================
section "3. Users"

do_req GET /users --auth "$MANAGER_TOKEN"
assert_status "GET /users — manager lists → 200"    200 "$RESP_STATUS"
assert_gt0    "User list has items"  "$RESP_BODY" ".data | length"

do_req GET /users --auth "$AGENT_TOKEN"
assert_status "GET /users — agent also lists → 200" 200 "$RESP_STATUS"

NEW_UID="e2e$(date +%s)"
do_req POST /create-user --auth "$MANAGER_TOKEN" --json \
  "{\"userId\":\"$NEW_UID\",\"name\":\"E2E Test User\",\"mobile\":\"$MOBILE_E2E\",\"role\":\"Sales\",\"password\":\"pass1234\"}"
assert_status "POST /create-user — manager creates → 201"  201 "$RESP_STATUS"
NEW_USER_DB_ID=$(echo "$RESP_BODY" | jq -r '.data.id // empty')
[ -n "$NEW_USER_DB_ID" ] && pass "New user DB id: $NEW_USER_DB_ID" || fail "User id returned" "$RESP_BODY"

do_req POST /create-user --auth "$AGENT_TOKEN" --json \
  "{\"userId\":\"block99\",\"name\":\"X\",\"mobile\":\"9000000000\",\"role\":\"Sales\",\"password\":\"x\"}"
assert_status "POST /create-user — agent forbidden → 403"  403 "$RESP_STATUS"

do_req POST /create-user --auth "$MANAGER_TOKEN" --json \
  "{\"userId\":\"$NEW_UID\",\"name\":\"dup\",\"mobile\":\"9111111111\",\"role\":\"Sales\",\"password\":\"pass\"}"
assert_status "POST /create-user — duplicate userId → 409" 409 "$RESP_STATUS"

if [ -n "$NEW_USER_DB_ID" ]; then
  do_req GET "/users/$NEW_USER_DB_ID" --auth "$MANAGER_TOKEN"
  assert_status "GET /users/:id → 200"                     200 "$RESP_STATUS"
  assert_eq     "Returned correct user name" "$RESP_BODY" ".data.name" "E2E Test User"

  do_req PUT "/users/$NEW_USER_DB_ID" --auth "$MANAGER_TOKEN" --json \
    '{"name":"E2E Updated","role":"Sales"}'
  assert_status "PUT /users/:id — manager updates → 200"   200 "$RESP_STATUS"
  assert_eq     "Name updated" "$RESP_BODY" ".data.name" "E2E Updated"

  do_req PUT "/users/$NEW_USER_DB_ID" --auth "$AGENT_TOKEN" --json '{"name":"Hack","role":"Sales"}'
  assert_status "PUT /users/:id — agent forbidden → 403"   403 "$RESP_STATUS"
else
  skip "GET/PUT /users/:id" "no user id"
fi

do_req GET "/users/999999" --auth "$MANAGER_TOKEN"
assert_status "GET /users/999999 — not found → 404"        404 "$RESP_STATUS"

# =========================================================
#  4. BRANDS
# =========================================================
section "4. Brands"

do_req GET /brands --auth "$MANAGER_TOKEN"
assert_status "GET /brands — manager lists → 200"   200 "$RESP_STATUS"
assert_gt0    "Brand list has items" "$RESP_BODY" ".data | length"
# Grab first brand id for the visit creation test
FIRST_BRAND_ID=$(echo "$RESP_BODY" | jq -r '.data[0].id')

do_req GET /brands --auth "$AGENT_TOKEN"
assert_status "GET /brands — agent can view → 200"  200 "$RESP_STATUS"

BRAND_NAME="E2EBrand_$(date +%s)"
do_req POST /brands --auth "$MANAGER_TOKEN" --json "{\"name\":\"$BRAND_NAME\"}"
assert_status "POST /brands — manager creates → 201" 201 "$RESP_STATUS"
NEW_BRAND_ID=$(echo "$RESP_BODY" | jq -r '.data.id // empty')
[ -n "$NEW_BRAND_ID" ] && pass "New brand id: $NEW_BRAND_ID" || fail "Brand id returned" "$RESP_BODY"
assert_eq "Brand name in response" "$RESP_BODY" ".data.name" "$BRAND_NAME"

do_req POST /brands --auth "$AGENT_TOKEN" --json '{"name":"AgentBrand"}'
assert_status "POST /brands — agent forbidden → 403" 403 "$RESP_STATUS"

do_req POST /brands --auth "$MANAGER_TOKEN" --json "{\"name\":\"$BRAND_NAME\"}"
assert_status "POST /brands — duplicate name → 409"  409 "$RESP_STATUS"

# =========================================================
#  5. VISITS
# =========================================================
section "5. Visits"

do_req GET /visits --auth "$MANAGER_TOKEN"
assert_status "GET /visits — manager sees all → 200"  200 "$RESP_STATUS"
assert_gt0    "Visit list not empty" "$RESP_BODY" ".data | length"

do_req GET /visits --auth "$AGENT_TOKEN"
assert_status "GET /visits — agent sees own → 200"    200 "$RESP_STATUS"

# Create visit: uses customer_name + mobile_number (not customer_id)
# brands_used must have at least 1 entry
UNIQUE_MOBILE="8$(date +%s | cut -c2-10)"   # 10-digit, starts with 8 (valid)
VISIT_PAYLOAD="{
  \"customer_name\": \"E2E Customer\",
  \"mobile_number\": \"$UNIQUE_MOBILE\",
  \"company_name\":  \"E2E Corp\",
  \"area\":          \"E2E Zone\",
  \"layout\":        \"E2E Block A\",
  \"location_link\": \"https://maps.google.com/?q=0,0\",
  \"site_stage\":    \"Brickwork\",
  \"feedback\":      \"Interested\",
  \"notes\":         \"Created by E2E test\",
  \"image_url\":     \"/api/uploads/test.jpg\",
  \"brands_used\":   [{\"brandId\": $FIRST_BRAND_ID}]
}"
do_req POST /visits --auth "$AGENT_TOKEN" --json "$VISIT_PAYLOAD"
assert_status "POST /visits — agent creates → 201"    201 "$RESP_STATUS"
NEW_VISIT_ID=$(echo "$RESP_BODY" | jq -r '.data.visit.id // empty')
[ -n "$NEW_VISIT_ID" ] && pass "New visit id: $NEW_VISIT_ID" || fail "Visit id returned" "$RESP_BODY"
assert_eq "Visit feedback saved"   "$RESP_BODY" ".data.visit.feedback"   "Interested"
assert_eq "Visit site_stage saved" "$RESP_BODY" ".data.visit.siteStage"  "Brickwork"
assert_eq "Customer name created"  "$RESP_BODY" ".data.customer.name"    "E2E Customer"

do_req POST /visits --auth "$AGENT_TOKEN" --json '{"customer_name":"X"}'
assert_status "POST /visits — missing fields → 400"   400 "$RESP_STATUS"

do_req POST /visits --auth "$AGENT_TOKEN" --json \
  "{\"customer_name\":\"X\",\"mobile_number\":\"1234\",\"area\":\"Z\",\"site_stage\":\"Brickwork\",\"feedback\":\"Interested\",\"notes\":\"n\",\"image_url\":\"u\",\"location_link\":\"l\",\"brands_used\":[{\"brandId\":$FIRST_BRAND_ID}]}"
assert_status "POST /visits — invalid mobile → 400"   400 "$RESP_STATUS"

# =========================================================
#  6. FOLLOW-UPS
# =========================================================
section "6. Follow-ups"

do_req GET /followups --auth "$MANAGER_TOKEN"
assert_status "GET /followups — manager gets all → 200"       200 "$RESP_STATUS"
assert_gt0    "Followup list not empty"  "$RESP_BODY" ".data | length"
assert_not_null "count field present"   "$RESP_BODY" ".count"

do_req GET /followups --auth "$AGENT_TOKEN"
assert_status "GET /followups — agent access → 200"           200 "$RESP_STATUS"

do_req GET /pending-followups --auth "$AGENT_TOKEN"
assert_status "GET /pending-followups — agent access → 200"   200 "$RESP_STATUS"
assert_true   "All items are Pending" "$RESP_BODY" \
  '(.data | map(select(.status != "Pending")) | length) == 0'

do_req GET /overdue-followups --auth "$MANAGER_TOKEN"
assert_status "GET /overdue-followups → 200"                  200 "$RESP_STATUS"
assert_not_null "count field present" "$RESP_BODY" ".count"

if [ -n "$NEW_VISIT_ID" ]; then
  # Followup 1 → Completed
  do_req POST /add-followup --auth "$AGENT_TOKEN" --json \
    "{\"visit_id\": $NEW_VISIT_ID, \"followup_date\": \"$TOMORROW\", \"notes\": \"E2E followup 1\"}"
  assert_status "POST /add-followup — adds followup → 201"    201 "$RESP_STATUS"
  NEW_FU_ID1=$(echo "$RESP_BODY" | jq -r '.data.id // empty')
  [ -n "$NEW_FU_ID1" ] && pass "Followup 1 id: $NEW_FU_ID1" || fail "Followup id" "$RESP_BODY"
  assert_eq "Default status is Pending" "$RESP_BODY" ".data.status" "Pending"

  # Followup 2 → Converted
  do_req POST /add-followup --auth "$AGENT_TOKEN" --json \
    "{\"visit_id\": $NEW_VISIT_ID, \"followup_date\": \"$TOMORROW\", \"notes\": \"E2E followup 2\"}"
  assert_status "POST /add-followup — second followup → 201"  201 "$RESP_STATUS"
  NEW_FU_ID2=$(echo "$RESP_BODY" | jq -r '.data.id // empty')

  # Followup 3 → duplicate invoice test
  do_req POST /add-followup --auth "$AGENT_TOKEN" --json \
    "{\"visit_id\": $NEW_VISIT_ID, \"followup_date\": \"$TOMORROW\", \"notes\": \"E2E followup 3\"}"
  assert_status "POST /add-followup — third followup → 201"   201 "$RESP_STATUS"
  NEW_FU_ID3=$(echo "$RESP_BODY" | jq -r '.data.id // empty')
else
  skip "POST /add-followup" "no visit id"
fi

do_req POST /add-followup --auth "$AGENT_TOKEN" --json '{"notes":"missing visit_id"}'
assert_status "POST /add-followup — missing fields → 400"     400 "$RESP_STATUS"

# Mark Completed
if [ -n "$NEW_FU_ID1" ]; then
  do_req PUT "/followups/$NEW_FU_ID1" --auth "$AGENT_TOKEN" \
    --json '{"status":"Completed","notes":"E2E completed"}'
  assert_status "PUT /followups/:id — mark Completed → 200"   200 "$RESP_STATUS"
  assert_eq     "Status is Completed" "$RESP_BODY" ".data.status" "Completed"
else
  skip "Mark Completed" "no followup id"
fi

# Mark Converted  (sale_amount is passed as a string per API validation)
if [ -n "$NEW_FU_ID2" ]; then
  do_req PUT "/followups/$NEW_FU_ID2" --auth "$AGENT_TOKEN" \
    --json "{\"status\":\"Converted\",\"sale_amount\":\"99500\",\"invoice_number\":\"$INVOICE\"}"
  assert_status "PUT /followups/:id — mark Converted → 200"   200 "$RESP_STATUS"
  assert_eq     "Status is Converted"     "$RESP_BODY" ".data.status"          "Converted"
  assert_eq     "Invoice number saved"    "$RESP_BODY" ".data.invoiceNumber"   "$INVOICE"
  assert_not_null "saleAmount saved"      "$RESP_BODY" ".data.saleAmount"
  assert_not_null "convertedAt set"       "$RESP_BODY" ".data.convertedAt"
else
  skip "Mark Converted" "no followup id"
fi

# Converted without invoice → 400
if [ -n "$NEW_FU_ID3" ]; then
  do_req PUT "/followups/$NEW_FU_ID3" --auth "$AGENT_TOKEN" \
    --json '{"status":"Converted","sale_amount":5000}'
  assert_status "PUT /followups/:id — Converted without invoice → 400" 400 "$RESP_STATUS"
else
  skip "Converted without invoice" "no followup id"
fi

# Re-convert already-Converted → 409
if [ -n "$NEW_FU_ID2" ]; then
  do_req PUT "/followups/$NEW_FU_ID2" --auth "$AGENT_TOKEN" \
    --json "{\"status\":\"Converted\",\"sale_amount\":\"1\",\"invoice_number\":\"INV-RECONV-$(date +%s)\"}"
  assert_status "PUT /followups/:id — re-convert locked → 409" 409 "$RESP_STATUS"
else
  skip "Re-convert locked followup" "no followup id"
fi

# Duplicate invoice → 409
if [ -n "$NEW_FU_ID3" ]; then
  do_req PUT "/followups/$NEW_FU_ID3" --auth "$AGENT_TOKEN" \
    --json "{\"status\":\"Converted\",\"sale_amount\":\"1\",\"invoice_number\":\"$INVOICE\"}"
  assert_status "PUT /followups/:id — duplicate invoice → 409" 409 "$RESP_STATUS"
else
  skip "Duplicate invoice" "no followup id"
fi

# =========================================================
#  7. DASHBOARD  (manager-only)
# =========================================================
section "7. Dashboard"

do_req GET /dashboard/total-visits --auth "$MANAGER_TOKEN"
assert_status "GET /dashboard/total-visits → 200"                  200 "$RESP_STATUS"
assert_not_null "data.total present"    "$RESP_BODY" ".data.total"
assert_not_null "data.today present"    "$RESP_BODY" ".data.today"
assert_not_null "data.thisWeek present" "$RESP_BODY" ".data.thisWeek"

do_req GET "/dashboard/visits-per-user?period=daily" --auth "$MANAGER_TOKEN"
assert_status "GET /dashboard/visits-per-user?period=daily → 200"  200 "$RESP_STATUS"
assert_is_array "visits-per-user daily users array" "$RESP_BODY" ".data.users"
assert_not_null "data.date present"  "$RESP_BODY" ".data.date"

do_req GET "/dashboard/visits-per-user?period=weekly" --auth "$MANAGER_TOKEN"
assert_status "GET /dashboard/visits-per-user?period=weekly → 200" 200 "$RESP_STATUS"
assert_is_array "visits-per-user weekly users array" "$RESP_BODY" ".data.users"

do_req GET "/dashboard/visits-per-user" --auth "$MANAGER_TOKEN"
assert_status "GET /dashboard/visits-per-user — no period → 400"   400 "$RESP_STATUS"

do_req GET /dashboard/feedback-summary --auth "$MANAGER_TOKEN"
assert_status "GET /dashboard/feedback-summary → 200"              200 "$RESP_STATUS"
assert_not_null "Interested count in data" "$RESP_BODY" ".data.Interested"

do_req GET /dashboard/inactive-users --auth "$MANAGER_TOKEN"
assert_status "GET /dashboard/inactive-users → 200"                200 "$RESP_STATUS"
assert_is_array "inactiveUsers is array" "$RESP_BODY" ".data.inactiveUsers"

do_req GET /dashboard/conversion-summary --auth "$MANAGER_TOKEN"
assert_status "GET /dashboard/conversion-summary → 200"            200 "$RESP_STATUS"
assert_gt0    "Conversion summary has rows" "$RESP_BODY" ".data | length"
assert_not_null "conversionRate field"  "$RESP_BODY" ".data[0].conversionRate"
assert_not_null "totalSalesValue field" "$RESP_BODY" ".data[0].totalSalesValue"
assert_not_null "convertedCount field"  "$RESP_BODY" ".data[0].convertedCount"

# Dashboard is manager-only
do_req GET /dashboard/total-visits     --auth "$AGENT_TOKEN"
assert_status "GET /dashboard/total-visits — agent → 403"          403 "$RESP_STATUS"
do_req GET /dashboard/conversion-summary --auth "$AGENT_TOKEN"
assert_status "GET /dashboard/conversion-summary — agent → 403"    403 "$RESP_STATUS"
do_req GET /dashboard/feedback-summary --auth "$AGENT_TOKEN"
assert_status "GET /dashboard/feedback-summary — agent → 403"      403 "$RESP_STATUS"
do_req GET /dashboard/inactive-users   --auth "$AGENT_TOKEN"
assert_status "GET /dashboard/inactive-users — agent → 403"        403 "$RESP_STATUS"

# =========================================================
#  8. EXPORT  (manager-only)
# =========================================================
section "8. Export"

EXCEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $MANAGER_TOKEN" "${BASE}/export/excel")
assert_status "GET /export/excel — manager → 200"   200 "$EXCEL_STATUS"

PDF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $MANAGER_TOKEN" "${BASE}/export/pdf")
assert_status "GET /export/pdf — manager → 200"     200 "$PDF_STATUS"

EXCEL_AGENT=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $AGENT_TOKEN" "${BASE}/export/excel")
assert_status "GET /export/excel — agent → 403"     403 "$EXCEL_AGENT"

PDF_AGENT=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $AGENT_TOKEN" "${BASE}/export/pdf")
assert_status "GET /export/pdf — agent → 403"       403 "$PDF_AGENT"

# =========================================================
#  9. CLEANUP
# =========================================================
section "9. Cleanup"

if [ -n "$NEW_USER_DB_ID" ]; then
  do_req DELETE "/users/$NEW_USER_DB_ID" --auth "$MANAGER_TOKEN"
  assert_status "DELETE /users/:id — manager deletes test user → 200" 200 "$RESP_STATUS"

  do_req GET "/users/$NEW_USER_DB_ID" --auth "$MANAGER_TOKEN"
  assert_status "GET /users/:id — deleted → 404"                      404 "$RESP_STATUS"
else
  skip "DELETE /users/:id" "no user id"
fi

# =========================================================
#  SUMMARY
# =========================================================
TOTAL=$((PASS+FAIL+SKIP))
echo ""
echo -e "${BOLD}══════════════════════════════════════${RESET}"
echo -e "${BOLD}  Test Summary${RESET}"
echo -e "${BOLD}══════════════════════════════════════${RESET}"
printf "  %-8s %s\n" "PASS"  "$PASS"
printf "  %-8s %s\n" "FAIL"  "$FAIL"
printf "  %-8s %s\n" "SKIP"  "$SKIP"
printf "  %-8s %s\n" "TOTAL" "$TOTAL"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}All tests passed!${RESET}"
else
  echo -e "  ${RED}${BOLD}$FAIL test(s) failed.${RESET}"
  exit 1
fi
