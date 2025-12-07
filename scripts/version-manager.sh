#!/bin/bash
# Version Manager Script
# Usage:
#   ./version-manager.sh get <app-name> <env>     - Get current version
#   ./version-manager.sh increment <app-name> <env> <part>  - Increment version (patch/minor/major)
#   ./version-manager.sh set-build-info <app-name> <env> <commit-hash>  - Set build info after successful build

set -e

# S3 bucket names
DEV_BUCKET="dev-mizpos-cdn-assets"
PROD_BUCKET="prod-mizpos-cdn-assets"
VERSION_FILE="versions.json"

get_bucket() {
    local env=$1
    if [ "$env" == "prod" ]; then
        echo "$PROD_BUCKET"
    else
        echo "$DEV_BUCKET"
    fi
}

# Initialize empty version file if it doesn't exist
init_versions() {    cat <<EOF
{
  "apps": {
    "mizpos-admin": {
      "version": "1.0.0",
      "lastBuildCommit": "",
      "lastBuildTimestamp": ""
    },
    "mizpos-desktop": {
      "version": "0.1.0",
      "lastBuildCommit": "",
      "lastBuildTimestamp": ""
    },
    "mizpos-online-sales": {
      "version": "1.0.0",
      "lastBuildCommit": "",
      "lastBuildTimestamp": ""
    }
  }
}
EOF
}

# Download versions file from S3
download_versions() {
    local bucket=$1
    local temp_file=$(mktemp)

    if aws s3 cp "s3://${bucket}/${VERSION_FILE}" "$temp_file" 2>/dev/null; then
        cat "$temp_file"
    else
        # File doesn't exist yet, return initial version
        init_versions
    fi
    rm -f "$temp_file"
}

# Upload versions file to S3
upload_versions() {
    local bucket=$1
    local content=$2
    local temp_file=$(mktemp)

    echo "$content" > "$temp_file"
    aws s3 cp "$temp_file" "s3://${bucket}/${VERSION_FILE}" --content-type "application/json"
    rm -f "$temp_file"
}

# Get version for an app
get_version() {
    local app=$1
    local env=$2
    local bucket=$(get_bucket "$env")

    local versions=$(download_versions "$bucket")
    echo "$versions" | jq -r ".apps[\"$app\"].version // \"0.0.0\""
}

# Increment version
increment_version() {
    local app=$1
    local env=$2
    local part=$3  # patch, minor, or major
    local bucket=$(get_bucket "$env")

    local versions=$(download_versions "$bucket")
    local current=$(echo "$versions" | jq -r ".apps[\"$app\"].version // \"0.0.0\"")

    # Parse version
    IFS='.' read -r major minor patch <<< "$current"

    # Increment based on part
    case $part in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch|*)
            patch=$((patch + 1))
            ;;
    esac

    local new_version="${major}.${minor}.${patch}"

    # Update JSON
    local updated=$(echo "$versions" | jq ".apps[\"$app\"].version = \"$new_version\"")

    # Upload to S3
    upload_versions "$bucket" "$updated"

    echo "$new_version"
}

# Set build info after successful build
set_build_info() {
    local app=$1
    local env=$2
    local commit_hash=$3
    local bucket=$(get_bucket "$env")
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local versions=$(download_versions "$bucket")

    # Update JSON with build info
    local updated=$(echo "$versions" | jq "
        .apps[\"$app\"].lastBuildCommit = \"$commit_hash\" |
        .apps[\"$app\"].lastBuildTimestamp = \"$timestamp\"
    ")

    # Upload to S3
    upload_versions "$bucket" "$updated"

    echo "Build info updated for $app in $env environment"
}

# Main
case $1 in
    get)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 get <app-name> <env>"
            exit 1
        fi
        get_version "$2" "$3"
        ;;
    increment)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 increment <app-name> <env> [patch|minor|major]"
            exit 1
        fi
        increment_version "$2" "$3" "${4:-patch}"
        ;;
    set-build-info)
        if [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then
            echo "Usage: $0 set-build-info <app-name> <env> <commit-hash>"
            exit 1
        fi
        set_build_info "$2" "$3" "$4"
        ;;
    init)
        # For testing: output initial JSON
        init_versions
        ;;
    *)
        echo "Usage: $0 {get|increment|set-build-info|init} ..."
        exit 1
        ;;
esac
