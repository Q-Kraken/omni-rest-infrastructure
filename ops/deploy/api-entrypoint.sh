#!/bin/sh
set -eu
DataProtection__CertificateThumbprint=$(dotnet /app/certificate/CertificateSetup.dll)
export DataProtection__CertificateThumbprint
if [ "${1:-}" = "--migrate" ]; then
    # The bundle reads the connection string from configuration, not process arguments.
    exec /app/efbundle
fi
exec dotnet /app/OmniRest.Api.dll "$@"
