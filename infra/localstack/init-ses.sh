#!/bin/sh
set -eu

# Runs when LocalStack is ready (mounted in /etc/localstack/init/ready.d/).
# Verifies the sender identity in the same region the worker uses (AWS_REGION).

FROM_EMAIL="${SES_FROM_EMAIL:-pingora@localhost}"
REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-eu-west-1}}"

echo "[localstack-init] verifying SES identity: ${FROM_EMAIL} (region=${REGION})"
awslocal ses verify-email-identity --region "${REGION}" --email-address "${FROM_EMAIL}"
awslocal ses list-identities --region "${REGION}"
echo "[localstack-init] SES ready"
