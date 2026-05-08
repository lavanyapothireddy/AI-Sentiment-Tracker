#!/bin/bash
# build.sh — Render build script
set -e

echo "Building SentimentAI..."

# Check the key exists
if [ -z "$GROQ_API_KEY" ]; then
  echo "ERROR: GROQ_API_KEY environment variable is not set."
  echo "Go to Render → Your Service → Environment → Add GROQ_API_KEY"
  exit 1
fi

echo "GROQ_API_KEY found — injecting into app..."

# Show file before replacement
echo "Before sed:"
grep "GROQ_API_KEY" frontend/app.js

# Replace the placeholder
sed -i "s|__GROQ_API_KEY__|$GROQ_API_KEY|g" frontend/app.js

# Show file after replacement
echo "After sed:"
grep "GROQ_API_KEY" frontend/app.js

echo "Build complete — key injected."
