#!/usr/bin/env bash
# Render build step: install deps, collect static files, migrate, and load the sample dataset.
set -o errexit

pip install --quiet uv
uv sync --frozen --no-dev
uv run python manage.py collectstatic --noinput
uv run python manage.py migrate --noinput
uv run python manage.py seed_data  # idempotent, safe on every deploy
