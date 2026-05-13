#!/bin/bash
set -e

cd backend

echo "==> Starting server..."
exec gunicorn \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 1 \
  --threads 4 \
  --timeout 120 \
  --access-logfile - \
  app:app
