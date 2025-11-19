#!/bin/bash
# robots.txt生成スクリプト
# 環境変数 ENVIRONMENT に基づいて robots.txt を生成します
# Usage: ENVIRONMENT=production ./scripts/generate-robots-txt.sh <output-dir>

set -e

OUTPUT_DIR="${1:-.}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

ROBOTS_TXT_PATH="${OUTPUT_DIR}/robots.txt"

if [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "production" ]; then
  # 本番環境: クローラーを許可
  cat > "$ROBOTS_TXT_PATH" <<EOF
# https://www.robotstxt.org/robotstxt.html
User-agent: *
Disallow:
EOF
  echo "✓ Generated robots.txt for production (allow all)"
else
  # 本番以外: クローラーをブロック
  cat > "$ROBOTS_TXT_PATH" <<EOF
# https://www.robotstxt.org/robotstxt.html
# Non-production environment - blocking all crawlers
User-agent: *
Disallow: /
EOF
  echo "✓ Generated robots.txt for $ENVIRONMENT (disallow all)"
fi

echo "  → $ROBOTS_TXT_PATH"
