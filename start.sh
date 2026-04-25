#!/bin/bash
# $JOB — one command to build and serve the full app
# Equivalent to: bun run start
set -e
bun install
bun run build
backend/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
