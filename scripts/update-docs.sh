#!/usr/bin/env bash
# Refresh the offline copy of the official Zepp OS developer documentation.
# Source: https://github.com/zepp-health/zeppos-docs (the source of https://docs.zepp.com/)
# The docs/ directory is git-ignored; this script re-downloads it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${1:-main}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading zeppos-docs ($BRANCH)..."
curl -fsSL "https://github.com/zepp-health/zeppos-docs/archive/refs/heads/${BRANCH}.tar.gz" \
  | tar -xz -C "$TMP_DIR"

SRC_DIR="$TMP_DIR/zeppos-docs-$BRANCH"
[ -d "$SRC_DIR/docs" ] || { echo "error: docs/ not found in archive" >&2; exit 1; }

echo "Replacing $REPO_ROOT/docs ..."
rm -rf "$REPO_ROOT/docs"
mkdir -p "$REPO_ROOT/docs"
cp -r "$SRC_DIR/docs/." "$REPO_ROOT/docs/"
cp "$SRC_DIR/LICENSE.txt" "$REPO_ROOT/docs/.LICENSE.txt"

echo "Done: $(find "$REPO_ROOT/docs" -name '*.md*' | wc -l) markdown files"
