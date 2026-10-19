#!/usr/bin/env python3
"""Generate persistent deployment secrets. Never prints or overwrites them."""
import argparse
import base64
import os
from pathlib import Path
import re
import secrets

parser = argparse.ArgumentParser()
parser.add_argument("--hostname", required=True)
parser.add_argument("--email", required=True)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", args.hostname):
    parser.error("Provide a bare lowercase hostname, without a scheme, port or path.")
if not re.fullmatch(r"[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+", args.email):
    parser.error("Provide a certificate contact email address.")
args.output.parent.mkdir(parents=True, exist_ok=True)
contents = (
    f"SITE_HOST={args.hostname}\nACME_EMAIL={args.email}\nRELEASE_TAG=local\n"
    f"POSTGRES_PASSWORD={secrets.token_hex(32)}\n"
    f"SESSION_CERTIFICATE_PASSWORD={secrets.token_hex(32)}\n"
    f"LOGIN_RATE_LIMIT_KEY={base64.b64encode(secrets.token_bytes(32)).decode()}\n"
)
with os.fdopen(os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as output:
    output.write(contents)
print("Created a private deployment environment file. Preserve it across releases and backups.")
