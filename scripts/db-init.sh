#!/usr/bin/env bash
if [[ "$REPLIT" == "true" ]]; then
  echo "Replit mode – skipping docker compose"
else
  docker compose up -d db
  pnpm drizzle-kit push
fi
