#!/usr/bin/env bash
# Большой поиск клиентов раз в день, после сброса лимитов Google (08:00 UTC = 12:00 по Баку).
# bash hunt.sh        — только если сегодня ещё не было и уже после 08:05 UTC
# bash hunt.sh force  — прямо сейчас
set -u
day=$(date -u +%F)
last=$(cat data/hunt_day 2>/dev/null || echo "")
if [ "${1:-}" != "force" ]; then
  [ "$last" = "$day" ] && exit 0
  [ "$(date -u +%H%M)" -lt 0805 ] && exit 0
fi
echo "$day" > data/hunt_day
pip install -q pillow >/dev/null 2>&1 || true
python3 autopilot.py --hunt || true
python3 autopilot.py --nearby || true
python3 email_outreach.py find 400 || true
