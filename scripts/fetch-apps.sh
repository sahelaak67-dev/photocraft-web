#!/usr/bin/env bash
set -euo pipefail

rm -rf dist temp_zip
mkdir -p dist temp_zip

# Copy static portal assets and app manifest
cp -r site/* dist/
cp config/apps.json dist/apps.json
touch dist/.nojekyll

STATUS_JSON="{}"

while IFS= read -r app; do
  slug=$(jq -r '.slug' <<< "$app")
  repo=$(jq -r '.repo' <<< "$app")
  mode=$(jq -r '.mode' <<< "$app")
  pattern=$(jq -r '.pattern // "*web*.zip"' <<< "$app")

  if [ "$mode" != "self-hosted" ]; then
    tag=$(gh release view --repo "$repo" --json tagName -q '.tagName' 2>/dev/null || echo "")
    STATUS_JSON=$(jq --arg slug "$slug" --arg tag "$tag" \
      '.[$slug] = { available: true, version: $tag }' <<< "$STATUS_JSON")
    continue
  fi

  echo "Fetching latest web release for $slug ($repo)..."
  mkdir -p "temp_zip/$slug"

  if gh release download --repo "$repo" --pattern "$pattern" --dir "temp_zip/$slug" --clobber 2>/dev/null; then
    zip_file=$(find "temp_zip/$slug" -maxdepth 1 -type f -name '*.zip' | head -n 1 || true)

    if [ -n "$zip_file" ]; then
      mkdir -p "dist/$slug"
      unzip -q "$zip_file" -d "dist/$slug"

      # Flatten single nested folder if index.html is one level deep
      if [ ! -f "dist/$slug/index.html" ]; then
        subdir=$(find "dist/$slug" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)
        if [ -n "$subdir" ] && [ -f "$subdir/index.html" ]; then
          shopt -s dotglob nullglob
          mv "$subdir"/* "dist/$slug/"
          shopt -u dotglob nullglob
          rmdir "$subdir" 2>/dev/null || true
        fi
      fi

      # Subpath snippets workaround (e.g. wasm-bindgen inline JS snippets)
      if [ -d "dist/$slug/snippets" ]; then
        mkdir -p "dist/$slug/app/snippets"
        cp -r "dist/$slug/snippets"/* "dist/$slug/app/snippets/" 2>/dev/null || true
      fi
    fi
  fi

  if [ -f "dist/$slug/index.html" ]; then
    tag=$(gh release view --repo "$repo" --json tagName -q '.tagName' 2>/dev/null || echo "")
    STATUS_JSON=$(jq --arg slug "$slug" --arg tag "$tag" \
      '.[$slug] = { available: true, version: $tag }' <<< "$STATUS_JSON")
  else
    echo "Warning: No valid web build found for $slug; skipping directory."
    rm -rf "dist/$slug"
    STATUS_JSON=$(jq --arg slug "$slug" \
      '.[$slug] = { available: false, version: "" }' <<< "$STATUS_JSON")
  fi
done < <(jq -c '.[]' config/apps.json)

echo "$STATUS_JSON" > dist/status.json
