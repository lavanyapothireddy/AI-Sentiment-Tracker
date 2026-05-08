#!/bin/bash
# build.sh — Render build script
# Reads GROQ_API_KEY from environment and injects it into app.js
set -e

echo "Building SentimentAI..."

# Check the key exists
if [ -z "$GROQ_API_KEY" ]; then
  echo "ERROR: GROQ_API_KEY environment variable is not set."
  echo "Go to Render → Your Service → Environment → Add GROQ_API_KEY"
  exit 1
fi

echo "GROQ_API_KEY found — injecting into app..."

# Replace the placeholder token __GROQ_API_KEY__ in frontend/app.js with the real key
sed -i "s|__GROQ_API_KEY__|$GROQ_API_KEY|g" frontend/app.js

echo "Build complete — key injected."
