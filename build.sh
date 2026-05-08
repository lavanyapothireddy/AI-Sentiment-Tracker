#!/bin/bash
# build.sh — Render build script
set -e
echo "Building SentimentAI..."

if [ -z "$GROQ_API_KEY" ]; then
  echo "ERROR: GROQ_API_KEY environment variable is not set."
  echo "Go to Render → Your Service → Environment → Add GROQ_API_KEY"
  exit 1
fi

echo "GROQ_API_KEY found — injecting into app..."

sed -i "s|__GROQ_API_KEY__|$GROQ_API_KEY|g" frontend/app.js

echo "Build complete — key injected."
