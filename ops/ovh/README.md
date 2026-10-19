# OVHcloud test deployment

Status: Canada API authentication verified on 2026-10-18. The account has zero Public Cloud projects.
No project activation, server provisioning, or public deployment has been completed.
Local deployment assets and their verification are described in [the deployment runbook](../deploy/README.md).

## Agreed setup

- OVHcloud Canada Public Cloud trial; verify its credit and expiration before provisioning.
- One Canadian Linux instance, initially targeting 2 vCPU and 4 GB RAM, subject to live availability
  and the complete price (including network resources).
- Frontend, .NET API, PostgreSQL and uploaded media on one server using Docker Compose.
- A free temporary hostname, selected and validated after the public IP is assigned.
- Automatic CI checks and image builds; manually triggered deployments initially.
- Persistent PostgreSQL, uploaded media, Data Protection keys and certificate storage.
- HTTPS; the API and PostgreSQL remain internal. Restrict administrative SSH access.
- Backups, health checks and a documented recovery/rollback procedure before calling it ready.

The production deployment must not reuse the development Compose file unchanged.

## Local tooling

The official CLI v0.15.0 was installed at `~/.local/bin/ovhcloud` from the `ovh/ovhcloud-cli`
release. The Darwin ARM64 archive was checked against its published SHA-256 digest:

```text
26b78ca0045dd21db040b2991d8a301bafcb898454ea80b5285a04e184132142
```

Do not enable CLI debug logging: it logs HTTP request details.

## One-time API authorisation

The account owner has authorised API access and entered the three keys locally. They are stored in
the owner-only `~/.ovh.conf`; do not paste the keys into chat or commit them to Git.
The following instructions document setup for a replacement credential when needed.

Use the Canadian credential page:

<https://ca.ovh.com/auth/api/createToken>

Suggested credential name: `omni-rest-test`. Choose a short validity period available in the form.
Limit rights to Public Cloud projects instead of the CLI login screen's account-wide `*` defaults:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/cloud/project` | Find the test project |
| GET | `/cloud/project/*` | Inspect project credit, instances, networks, images and flavors |
| POST | `/cloud/project/*` | Provision test resources |
| PUT | `/cloud/project/*` | Configure test resources |
| DELETE | `/cloud/project/*` | Remove test resources when required |

These rights cover Public Cloud projects in the account, not only one project. Once the first project
exists, replace the wildcard project component with its exact project ID when practical. They do not
grant card, general account administration, or domain-management access.

Run the helper from this checkout in your own terminal:

```sh
python3 ops/ovh/configure-cli.py
```

It prompts with hidden input and creates `~/.ovh.conf` with mode `0600`. It refuses to overwrite any
existing file or symlink. It does not activate the trial, create a project, or provision resources.

After setup, Codex can verify access with this read-only command from a directory without another
`ovh.conf`:

```sh
python3 -m venv .local-run/ovh-sdk
.local-run/ovh-sdk/bin/pip install -r ops/ovh/requirements.txt
.local-run/ovh-sdk/bin/python ops/ovh/status.py
```

Use a Python linked to current OpenSSL. The prepared local environment is
`.local-run/ovh-sdk313`. The official SDK uses the authorised v1 API paths. CLI v0.15.0's
`cloud project list` instead uses `/v2/publicCloud/project`, returning 403 with these v1-only rights;
this does not mean the keys are invalid. Do not expand permissions account-wide to fix that mismatch.

The CLI also accepts `OVH_ENDPOINT`, `OVH_APPLICATION_KEY`, `OVH_APPLICATION_SECRET` and
`OVH_CONSUMER_KEY` environment variables. Avoid passing secrets as command arguments, putting them
in shell history, or displaying the CLI configuration in chat.

## First project and trial

OVHcloud currently documents first-project setup and activation in its control panel. There is no
dedicated CLI command for first-project creation. Additional projects may use the Terraform resource
after the account's initial project/payment setup.

Prepare and verify the application deployment before activating the first project. The account owner
should review the displayed terms, trial amount and expiry at activation. Then Codex can provision
and manage the infrastructure using the CLI/API and operate the server through SSH.

Before provisioning, verify the real credit, region, quota and all billable components. Trial credit
is not a hard spending cap: resources can continue billing after expiry or exhaustion. Set billing
alerts and agree on removal or migration before the trial expires. Stopping a VM is not a substitute
for checking and removing all billable resources.

## Source and readiness

Deployment work uses a clean managed worktree on branch `codex/ovh-test-deployment`, starting from
`origin/main` at `8bf6831ef1473397eeb4d847f8c58c4ab0190b06`.

The original `fix/bug-folder` checkout contains an unfinished merge with 16 unmerged paths. It has
not been reset, edited or resolved by this deployment preparation.

Deployment Dockerfiles, internal networking, persistent state, migration/release scripts, and a manual
GitHub Actions workflow are prepared. See the deployment runbook for tested behavior and remaining
cloud-specific checks. Cloud resources, remote SSH authentication, CI secrets and trial credit cannot
be validated until the first project is activated.

## Official references

- [CLI getting started](https://docs.ovhcloud.com/en/guides/manage-and-operate/cli/getting-started)
- [CLI authentication](https://github.com/ovh/ovhcloud-cli/blob/main/doc/authentication.md)
- [First Public Cloud project](https://docs.ovhcloud.com/en/guides/public-cloud/cross-functional/create-a-public-cloud-project)
