#!/bin/bash
# Android signing key setup script
# This script generates a keystore and uploads it to AWS Secrets Manager

set -e

# Configuration
SECRET_NAME="mizpos/android-signing"
AWS_REGION="ap-northeast-1"
KEYSTORE_FILE="mizpos-release.keystore"
KEY_ALIAS="mizpos"
VALIDITY_DAYS=10000

# Use AWS_PROFILE if set
AWS_OPTS=""
if [ -n "$AWS_PROFILE" ]; then
    AWS_OPTS="--profile $AWS_PROFILE"
    echo "Using AWS Profile: $AWS_PROFILE"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== mizPOS Android Signing Key Setup ===${NC}"
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo -e "${RED}Error: keytool is not installed (part of JDK)${NC}"
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws $AWS_OPTS sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Please run: aws configure or set AWS_PROFILE"
    exit 1
fi

# Generate passwords
KEYSTORE_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
KEY_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

echo ""
echo -e "${YELLOW}Generating keystore...${NC}"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
KEYSTORE_PATH="${TEMP_DIR}/${KEYSTORE_FILE}"

# Generate keystore
keytool -genkeypair \
    -v \
    -keystore "${KEYSTORE_PATH}" \
    -keyalg RSA \
    -keysize 2048 \
    -validity ${VALIDITY_DAYS} \
    -alias "${KEY_ALIAS}" \
    -storepass "${KEYSTORE_PASSWORD}" \
    -keypass "${KEY_PASSWORD}" \
    -dname "CN=mizPOS, OU=Development, O=Miz, L=Tokyo, ST=Tokyo, C=JP"

echo ""
echo -e "${GREEN}Keystore generated successfully${NC}"

# Encode keystore to base64
KEYSTORE_BASE64=$(base64 -i "${KEYSTORE_PATH}")

# Create JSON secret
SECRET_JSON=$(cat <<EOF
{
    "keystore_base64": "${KEYSTORE_BASE64}",
    "keystore_password": "${KEYSTORE_PASSWORD}",
    "key_alias": "${KEY_ALIAS}",
    "key_password": "${KEY_PASSWORD}"
}
EOF
)

echo ""
echo -e "${YELLOW}Uploading to AWS Secrets Manager...${NC}"

# Check if secret already exists
if aws $AWS_OPTS secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region "${AWS_REGION}" &> /dev/null; then
    echo "Secret already exists, updating..."
    aws $AWS_OPTS secretsmanager update-secret \
        --secret-id "${SECRET_NAME}" \
        --secret-string "${SECRET_JSON}" \
        --region "${AWS_REGION}"
else
    echo "Creating new secret..."
    aws $AWS_OPTS secretsmanager create-secret \
        --name "${SECRET_NAME}" \
        --description "Android signing keystore for mizPOS" \
        --secret-string "${SECRET_JSON}" \
        --region "${AWS_REGION}"
fi

# Cleanup
rm -rf "${TEMP_DIR}"

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Secret Name: ${SECRET_NAME}"
echo "Key Alias: ${KEY_ALIAS}"
echo ""
echo -e "${YELLOW}Note: Keep this information secure!${NC}"
echo ""
echo "To use in GitHub Actions, add these secrets to your repository:"
echo "  - AWS_ACCESS_KEY_ID"
echo "  - AWS_SECRET_ACCESS_KEY"
echo ""
echo "Or use OIDC authentication with AWS (recommended for GitHub Actions)"
