#!/usr/bin/env bash
docker compose up -d db
pnpm drizzle-kit push
