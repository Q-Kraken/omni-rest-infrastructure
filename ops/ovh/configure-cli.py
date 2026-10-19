#!/usr/bin/env python3
"""Save OVHcloud Canada credentials locally without echoing or overwriting them."""

import getpass
import os
from pathlib import Path
import re
import sys


def save_configuration(destination, application_key, application_secret, consumer_key):
    credentials = (application_key, application_secret, consumer_key)
    # Restrict the INI values to the credential alphabet, rejecting newlines and directives.
    if any(not re.fullmatch(r"[A-Za-z0-9]+", value) for value in credentials):
        raise ValueError("Credentials must contain letters and numbers only.")
    if tuple(map(len, credentials)) != (16, 32, 32):
        raise ValueError("Expected a 16-character application key and two 32-character keys.")

    configuration = (
        "[default]\nendpoint=ovh-ca\n\n[ovh-ca]\n"
        f"application_key={application_key}\n"
        f"application_secret={application_secret}\n"
        f"consumer_key={consumer_key}\n"
    )
    # O_EXCL also refuses symbolic links, including dangling links. Never overwrite existing access.
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            output.write(configuration)
            output.flush()
            os.fsync(output.fileno())
    except BaseException:
        Path(destination).unlink(missing_ok=True)
        raise


def main():
    if not sys.stdin.isatty():
        raise SystemExit("Run this script yourself in a terminal. Keys are entered with hidden input.")
    destination = Path.home() / ".ovh.conf"
    if destination.exists() or destination.is_symlink():
        raise SystemExit("An OVH configuration already exists; it has not been changed.")

    print("OVHcloud Canada CLI access setup")
    print("Enter the three API credentials from OVHcloud. Input is hidden.")
    print("This saves local CLI access only; it does not activate a trial or order resources.")
    try:
        application_key = getpass.getpass("Application key: ").strip()
        application_secret = getpass.getpass("Application secret: ").strip()
        consumer_key = getpass.getpass("Consumer key: ").strip()
        save_configuration(destination, application_key, application_secret, consumer_key)
    except (KeyboardInterrupt, EOFError):
        raise SystemExit("\nCancelled; no credentials saved.")
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))

    print("Saved ~/.ovh.conf with owner-only access (0600). No cloud resources were created.")
    print("Return to Codex and say: CLI credentials are saved.")


if __name__ == "__main__":
    main()
