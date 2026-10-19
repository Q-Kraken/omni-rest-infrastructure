#!/usr/bin/env python3
"""Read-only inventory using the v1 paths granted to this deployment credential."""
import configparser
import json
from pathlib import Path
import stat
import sys
import ovh

path = Path.home()/".ovh.conf"
if not path.is_file() or stat.S_IMODE(path.stat().st_mode) & 0o077:
    raise SystemExit("Expected owner-only ~/.ovh.conf; no API request made.")
config = configparser.ConfigParser(interpolation=None)
config.read(path)
if config.get("default", "endpoint", fallback="") != "ovh-ca":
    raise SystemExit("Expected OVHcloud Canada credentials; no API request made.")
credentials = {key: config.get("ovh-ca", key) for key in ("application_key", "application_secret", "consumer_key")}
client = ovh.Client(endpoint="ovh-ca", timeout=30, **credentials)
try:
    identifiers = client.get("/cloud/project")
    projects = []
    for identifier in identifiers:
        project = client.get(f"/cloud/project/{identifier}")
        projects.append({"id": identifier, "description": project.get("description"), "status": project.get("status")})
    print(json.dumps({"authenticated": True, "projects": projects}, indent=2))
except ovh.exceptions.APIError as error:
    message = str(error)
    for value in credentials.values():
        message = message.replace(value, "[REDACTED]")
    print(json.dumps({"authenticated": False, "error": message}), file=sys.stderr)
    raise SystemExit(1)
