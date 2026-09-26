#!/bin/zsh
set -e
cd "${0:A:h}"
exec .interaction-env/bin/python webapp/server.py
