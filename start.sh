#!/bin/bash
# $JOB — build frontend and start the unified server
# Usage: ./start.sh
set -e

echo "Building frontend..."
bun --cwd frontend install --frozen-lockfile
bun --cwd frontend run build

echo "Starting server at http://localhost:8000"
backend/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
