#!/usr/bin/env bash
# scripts/setup-gcp-secrets.sh
#
# One-time provisioning of GCP Secret Manager secrets for opencad-server.
# Run this once per environment (prod / staging). It is idempotent — re-running
# adds a new secret version if the secret already exists.
#
# Usage:
#   export GCP_PROJECT=your-gcp-project-id
#   export CLOUD_RUN_SA=opencad-server@your-gcp-project-id.iam.gserviceaccount.com
#   ./scripts/setup-gcp-secrets.sh
#
# You will be prompted interactively for each secret value.
# Pipe a value to skip the prompt:
#   DATABASE_URL=postgres://... ./scripts/setup-gcp-secrets.sh
#
# Prerequisites:
#   gcloud auth login && gcloud auth application-default login
#   gcloud config set project "$GCP_PROJECT"

set -euo pipefail

GCP_PROJECT="${GCP_PROJECT:?Set GCP_PROJECT env var}"
CLOUD_RUN_SA="${CLOUD_RUN_SA:?Set CLOUD_RUN_SA env var (the Cloud Run service account email)}"

echo "▶  Project : $GCP_PROJECT"
echo "▶  SA      : $CLOUD_RUN_SA"
echo ""

# ── Helpers ───────────────────────────────────────────────────────────────────

# Create or update a secret. If the env var of the same name is set, use it;
# otherwise prompt the user. Strips trailing newline from piped input.
upsert_secret() {
  local secret_name="$1"   # GCP secret resource name  e.g. opencad-jwt-secret
  local env_var="$2"        # env var to check first    e.g. JWT_SECRET
  local prompt_text="$3"    # human-readable prompt

  local value=""
  if [[ -n "${!env_var:-}" ]]; then
    value="${!env_var}"
    echo "  [env]  $secret_name"
  else
    read -rsp "  Enter $prompt_text: " value
    echo ""
  fi

  if [[ -z "$value" ]]; then
    echo "  [skip] $secret_name — empty value, skipping"
    return
  fi

  # Create the secret if it doesn't exist yet
  if ! gcloud secrets describe "$secret_name" --project="$GCP_PROJECT" &>/dev/null; then
    gcloud secrets create "$secret_name" \
      --project="$GCP_PROJECT" \
      --replication-policy="automatic" \
      --quiet
    echo "  [new]  $secret_name"
  fi

  # Add a new version with the supplied value
  printf '%s' "$value" | gcloud secrets versions add "$secret_name" \
    --project="$GCP_PROJECT" \
    --data-file=- \
    --quiet

  echo "  [ok]   $secret_name — version added"
}

# Grant the Cloud Run service account access to a secret
grant_access() {
  local secret_name="$1"
  gcloud secrets add-iam-policy-binding "$secret_name" \
    --project="$GCP_PROJECT" \
    --member="serviceAccount:$CLOUD_RUN_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
}

# ── Secrets ───────────────────────────────────────────────────────────────────

echo "=== Provisioning secrets in $GCP_PROJECT ==="
echo ""

SECRETS=(
  # GCP secret name                  env var                  prompt
  "opencad-database-url              DATABASE_URL             PostgreSQL connection string (postgres://...)"
  "opencad-jwt-secret                JWT_SECRET               JWT signing secret (random 64-char string)"
  "opencad-github-token              OPENCAD_GITHUB_TOKEN     GitHub PAT for issue creation"
  "opencad-stripe-secret-key         STRIPE_SECRET_KEY        Stripe secret key (sk_live_... or sk_test_...)"
  "opencad-stripe-webhook-secret     STRIPE_WEBHOOK_SECRET    Stripe webhook signing secret (whsec_...)"
  "opencad-stripe-price-pro          STRIPE_PRICE_PRO         Stripe price ID for Pro tier (price_...)"
  "opencad-stripe-price-business     STRIPE_PRICE_BUSINESS    Stripe price ID for Business tier (price_...)"
  "opencad-admin-uids                ADMIN_UIDS               Comma-separated Firebase UIDs that bypass the paygate"
)

for entry in "${SECRETS[@]}"; do
  # shellcheck disable=SC2086
  read -r secret_name env_var prompt_text <<< $entry
  upsert_secret "$secret_name" "$env_var" "$prompt_text"
done

echo ""
echo "=== Granting secretAccessor to $CLOUD_RUN_SA ==="
echo ""

for entry in "${SECRETS[@]}"; do
  # shellcheck disable=SC2086
  read -r secret_name _ _ <<< $entry
  grant_access "$secret_name"
  echo "  [iam]  $secret_name"
done

echo ""
echo "✓ Done. Cloud Run service account can now read all secrets."
echo ""
echo "Next steps:"
echo "  1. Verify secrets exist:"
echo "     gcloud secrets list --project=$GCP_PROJECT"
echo "  2. Remove DATABASE_URL, JWT_SECRET, OPENCAD_GITHUB_TOKEN from"
echo "     GitHub Actions secrets — they are no longer needed there."
echo "  3. Trigger a deploy to pick up the --set-secrets configuration."
