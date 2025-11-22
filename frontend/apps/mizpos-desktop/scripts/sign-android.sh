#!/bin/bash
# Sign Android APK/AAB using keystore from AWS Secrets Manager
# Usage: ./scripts/sign-android.sh [apk|aab|all]

set -e

# Configuration
SECRET_NAME="mizpos/android-signing"
AWS_REGION="ap-northeast-1"
BUILD_DIR="src-tauri/gen/android/app/build/outputs"

# Use AWS_PROFILE if set
AWS_OPTS=""
if [ -n "$AWS_PROFILE" ]; then
    AWS_OPTS="--profile $AWS_PROFILE"
    echo "Using AWS Profile: $AWS_PROFILE"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== mizPOS Android Signing ===${NC}"
echo ""

# Parse argument
SIGN_TARGET="${1:-all}"

# Check required tools
for cmd in aws jq; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}Error: $cmd is not installed${NC}"
        exit 1
    fi
done

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws $AWS_OPTS sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

# Get signing key from Secrets Manager
echo "Fetching signing key from Secrets Manager..."
SECRET_JSON=$(aws $AWS_OPTS secretsmanager get-secret-value \
    --secret-id "${SECRET_NAME}" \
    --region "${AWS_REGION}" \
    --query SecretString \
    --output text)

KEYSTORE_BASE64=$(echo $SECRET_JSON | jq -r '.keystore_base64')
KEYSTORE_PASSWORD=$(echo $SECRET_JSON | jq -r '.keystore_password')
KEY_ALIAS=$(echo $SECRET_JSON | jq -r '.key_alias')
KEY_PASSWORD=$(echo $SECRET_JSON | jq -r '.key_password')

# Create temporary keystore
TEMP_DIR=$(mktemp -d)
KEYSTORE_PATH="${TEMP_DIR}/release.keystore"
echo "$KEYSTORE_BASE64" | base64 -d > "$KEYSTORE_PATH"

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Find Android SDK
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/Library/Android/sdk" ]; then
        ANDROID_HOME="$HOME/Library/Android/sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        ANDROID_HOME="$HOME/Android/Sdk"
    else
        echo -e "${RED}Error: ANDROID_HOME not set and SDK not found${NC}"
        exit 1
    fi
fi

# Find build-tools
BUILD_TOOLS_DIR="$ANDROID_HOME/build-tools/$(ls $ANDROID_HOME/build-tools 2>/dev/null | sort -V | tail -1)"
if [ ! -d "$BUILD_TOOLS_DIR" ]; then
    echo -e "${RED}Error: Android build-tools not found${NC}"
    exit 1
fi

echo "Using build-tools: $BUILD_TOOLS_DIR"
echo ""

# Create output directory
OUTPUT_DIR="dist"
mkdir -p "$OUTPUT_DIR"

sign_apk() {
    echo -e "${YELLOW}Signing APK...${NC}"

    # Find unsigned APK
    UNSIGNED_APK=$(find "$BUILD_DIR" -name "*-unsigned.apk" -type f 2>/dev/null | head -1)

    if [ -z "$UNSIGNED_APK" ]; then
        echo -e "${RED}Error: Unsigned APK not found${NC}"
        echo "Run 'pnpm tauri android build' first"
        return 1
    fi

    echo "Found: $UNSIGNED_APK"

    # Align
    ALIGNED_APK="${TEMP_DIR}/aligned.apk"
    "$BUILD_TOOLS_DIR/zipalign" -v -p 4 "$UNSIGNED_APK" "$ALIGNED_APK"

    # Sign
    SIGNED_APK="${OUTPUT_DIR}/mizpos-desktop-signed.apk"
    "$BUILD_TOOLS_DIR/apksigner" sign \
        --ks "$KEYSTORE_PATH" \
        --ks-pass "pass:$KEYSTORE_PASSWORD" \
        --ks-key-alias "$KEY_ALIAS" \
        --key-pass "pass:$KEY_PASSWORD" \
        --out "$SIGNED_APK" \
        "$ALIGNED_APK"

    # Verify
    "$BUILD_TOOLS_DIR/apksigner" verify --verbose "$SIGNED_APK"

    echo -e "${GREEN}APK signed: $SIGNED_APK${NC}"
}

sign_aab() {
    echo -e "${YELLOW}Signing AAB...${NC}"

    # Find AAB
    AAB_FILE=$(find "$BUILD_DIR" -name "*.aab" -type f 2>/dev/null | head -1)

    if [ -z "$AAB_FILE" ]; then
        echo -e "${RED}Error: AAB not found${NC}"
        return 1
    fi

    echo "Found: $AAB_FILE"

    # Sign with jarsigner
    SIGNED_AAB="${OUTPUT_DIR}/mizpos-desktop-signed.aab"
    cp "$AAB_FILE" "$SIGNED_AAB"

    jarsigner -verbose \
        -sigalg SHA256withRSA \
        -digestalg SHA-256 \
        -keystore "$KEYSTORE_PATH" \
        -storepass "$KEYSTORE_PASSWORD" \
        -keypass "$KEY_PASSWORD" \
        "$SIGNED_AAB" \
        "$KEY_ALIAS"

    # Verify
    jarsigner -verify -verbose "$SIGNED_AAB"

    echo -e "${GREEN}AAB signed: $SIGNED_AAB${NC}"
}

case "$SIGN_TARGET" in
    apk)
        sign_apk
        ;;
    aab)
        sign_aab
        ;;
    all)
        sign_apk
        echo ""
        sign_aab
        ;;
    *)
        echo "Usage: $0 [apk|aab|all]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}=== Signing Complete ===${NC}"
echo "Output directory: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"
