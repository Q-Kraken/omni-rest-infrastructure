# Test deployment runbook

This directory prepares a single Canadian Ubuntu 24.04 VM. It does not itself order cloud resources.
Use `ops/ovh/status.py` for authenticated inventory, then select live region, flavor, image, quota and
total hourly price before provisioning. Do not activate the trial until local checks are complete.

## Services and state

Only Caddy publishes ports 80 and 443. PostgreSQL and the API have no public ports. Next.js calls the
private Caddy listener on 8081, which supplies HTTPS forwarding metadata. The API trusts only Caddy's
fixed container address, 172.30.72.10. Check that subnet against the server's existing routes.
Both the IPv4 address and its IPv4-mapped IPv6 representation are explicitly trusted; Kestrel can
report the latter for an IPv4 connection. No other container address is trusted.

Named volumes retain PostgreSQL 18 data, uploads, protected login keys, the session certificate,
Caddy certificates, and Next.js cache. The API and frontend run as unprivileged users with read-only
root filesystems. A dedicated container user's certificate store trusts the application's protection
certificate; this does not change the host's trust store. Preserve the PFX, password and key ring
together. Rotate the two-year protection certificate before the helper's 30-day expiry guard trips.

`cloud-init.yaml` installs Docker/Compose, security updates and fail2ban, disables password/root SSH,
and opens SSH/HTTP/HTTPS. Supply only an SSH public key through OVHcloud's SSH-key setting. Narrow SSH
ingress in the provider firewall to the operator's current public address; add the deployment runner
only when required. Never put application secrets or private keys in user-data.

## Initial release

1. Build and test the selected Git revision. The API image includes a migration bundle and a helper
   that initializes its private persistent certificate. The frontend uses Next.js standalone output.
2. After first-project activation, verify the actual trial credit/expiry and all resource prices.
   Create one hourly-billed VM in Canada, using the reviewed cloud-init and SSH public key.
3. Wait for cloud-init completion. Verify SSH host keys through trusted provider evidence before
   pinning them; `ssh-keyscan` alone does not authenticate a server.
4. Copy `ops/deploy/` to `/opt/omni-rest-test/ops/deploy/`. Generate `/opt/omni-rest-test/server.env`
   with `create-env.py --hostname HOST --email EMAIL --output FILE`. Choose a free temporary hostname
   only after its DNS resolves to the allocated public IP. Keep the environment file mode 0600.
5. Build/load `omni-rest-api:TAG` and `omni-rest-frontend:TAG` for the server architecture. Local Mac
   images are ARM64; an x86 VM requires AMD64 builds (the GitHub Ubuntu workflow builds AMD64).
6. Run `bash ops/deploy/deploy.sh /opt/omni-rest-test/server.env TAG` from the server checkout root.
   It starts PostgreSQL, migrates forward, then waits for service health. A failed release preserves
   volumes and does not downgrade the database automatically.
7. Use the existing API CLI to create a test restaurant and add its bare hostname, with
   `OMNIREST_ALLOW_RESTAURANT_ONBOARDING=true` only for that one-off job. Provision an owner with
   `OMNIREST_ALLOW_OWNER_PROVISIONING=true` and a private `OMNIREST_PROVISION_PASSWORD` environment
   file; never use a password argument or the sample seeder in Production.
8. Verify trusted HTTPS, public restaurant/menu, admin login, an authenticated upload and publication.
   Restart containers and confirm owner login/session and uploaded bytes still work. Check published
   ports and server firewall rules. Take a backup and copy it off the VM before acceptance.

Public indexing is discouraged through `X-Robots-Tag`; this does not make the website private.
Use test content only. Local smoke tests bind edge ports to 127.0.0.1:18080/18443 with test.localhost.
Trust the generated local CA explicitly for local HTTPS checks; never disable certificate checking
for the public website.

## Manual deployment pipeline

`.github/workflows/deploy-test.yml` runs backend/frontend checks, builds images, transfers them over
SSH, runs the release script and checks public HTTPS endpoints. It does not expose OVH API credentials
to GitHub. It is manually triggered and uses the `test` environment. Configure its `SSH_HOST`,
`SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS` secrets and `SITE_HOST` variable after provisioning.
Use a dedicated deployment key, pinned host keys and suitable environment access controls. The SSH
user's Docker access can administer the VM, so protect that key accordingly. Do not merge this branch
into main without the repository owner's instruction. The new workflow must reach the default branch
before ordinary workflow dispatch becomes available; direct CLI releases remain possible meanwhile.

## Backups and recovery

`bash ops/deploy/backup.sh /absolute/path/server.env` briefly stops frontend/API writers, captures
PostgreSQL plus all application state and the private environment file, and resumes services even on
failure. Only a folder with a `complete` marker is usable. Deployment automatically calls this before
forward migrations on an existing release. Backups contain private keys/passwords; store them with
mode 0600 inside a private directory and copy them off the VM over authenticated SSH. Keep at least
one off-VM backup before changing or removing resources. On-VM backup alone does not survive VM loss.

For a code-only rollback, load the recorded previous image tag and run the deployment script only if
that code is compatible with the current schema. Never assume a database downgrade is safe. For a
full restore: stop application writers, retain a fresh emergency backup, restore `database.sql.gz`
into a clean PostgreSQL 18 database with `psql -v ON_ERROR_STOP=1`, restore `application.tar.gz` into
the application volume preserving UID 1654 ownership and private modes, restore its matching
`server.env`, and start the exact recorded image tag. Confirm HTTPS, tenant, owner session and media
before reopening writes. Rehearse restoration against disposable state first.

Schedule off-VM backups and external uptime checks after the server exists. Record actual trial
expiry and remove or migrate every billable resource before it; stopping the VM can leave charges.
No monitor or recurring backup has been activated by this preparation.

## Dependency servicing

ImageSharp 3.1.12 reports five advisories. Upload decoding now registers JPEG, PNG and WebP only,
before identification or metadata parsing, skips metadata and limits decoded frames to one. TIFF /
BigTIFF cannot enter that path; the resize path shares these restrictions. The application does not
use TIFF encoders, histogram equalization or ICC `Entries` access. Regression tests exercise codec
rejection and all three supported formats. Owner authentication is also required for uploads.

This is a mitigation, not a patched dependency. ImageSharp 4.1.2 was evaluated but its build requires
an activated Six Labors license, so it was not retained. Resolve licensing and upgrade, or replace
the library, before treating this as production-ready for untrusted image intake. Do not suppress
NuGet vulnerability warnings. References:

- <https://github.com/advisories/GHSA-wmxv-xphr-5c9g>
- <https://github.com/advisories/GHSA-gwg2-r3hj-4w44>
- <https://github.com/advisories/GHSA-j3p4-wp97-rph4>
- <https://github.com/advisories/GHSA-j9gm-c75j-xc9q>
- <https://github.com/advisories/GHSA-jjfr-hcj7-qf5w>
- <https://github.com/SixLabors/ImageSharp/releases/tag/v4.1.2>

## Verification record

Verified locally on 2026-10-18 from the deployment worktree:

- Backend: 323 tests passed. Frontend: lint/typecheck and all 471 tests passed.
- Both release images built successfully. Compose, cloud-init and workflow YAML parsed; shell syntax
  and Git whitespace checks passed.
- Additional Linux ARM64 storage/image suite: 31 tests passed with all capabilities dropped and
  no-new-privileges. Container testing found and corrected Linux ARM64 open flags and replaced
  capability-sensitive regular-file creation with atomic exclusive `openat` creation. The Linux flags
  follow the kernel's [ARM64 header](https://github.com/torvalds/linux/blob/v6.12/arch/arm64/include/uapi/asm/fcntl.h)
  and [generic header](https://github.com/torvalds/linux/blob/v6.12/include/uapi/asm-generic/fcntl.h).
- Production-mode Compose migration/start and repeat deployment passed. Public restaurant/menu,
  rendered home page, owner login, CSRF-protected upload, logo publication and exact served image
  bytes passed through trusted local HTTPS.
- A full backup restored successfully into separate fresh database/application volumes. Published
  data, image bytes and the pre-backup owner session worked after restoration.
- Database/API/frontend publish no ports; local edge binds only 127.0.0.1. Local containers were
  stopped after verification; test volumes and private backups remain under the test project.
- Authenticated OVH Canada inventory returned zero projects. No cloud VM, public website, remote
  pipeline, off-VM backup schedule, billing alert or uptime monitor has been activated.

The local test uses ARM64. Validate the selected cloud VM architecture, Ubuntu bootstrap, live DNS,
public ACME issuance, SSH host keys, trial credit and GitHub environment configuration after activation.
ImageSharp advisory warnings and the pre-existing nullable PostalCode compiler warning remain visible.
