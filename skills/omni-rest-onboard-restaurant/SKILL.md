---
name: omni-rest-onboard-restaurant
description: Research and onboard a restaurant in an existing Omni REST application, prepare sourced content, publish on shared hosting, verify tenant isolation, and optionally configure admin credentials and hostname documentation.
---

# Omni REST restaurant onboarding

Use the existing application, database, media storage and deployment. A restaurant is a tenant with content and hostname mappings. Read these instructions in any assistant that can access the repository; map the named capabilities to its available tools. No particular AI provider, orchestration API, hosting vendor or password manager is required.

## Establish the requested scope

Identify the restaurant, address/city, phone, supplied sources/package, target environment, and requested stages: research, preparation, publication, admin access, documentation. Carry forward explicit authorization from the conversation. A request to publish includes the necessary import and hostname configuration on the named existing deployment; do not ask for that permission again. Skill discovery or invocation alone does not authorize extra external actions.

Ask only for a missing decision that blocks the requested work. Continue independent preparation while waiting. Do not infer permission to buy services, contact third parties, overwrite existing content, reassign an occupied domain, reset credentials, expand sharing, or merge into the application's main branch.

## Inspect before changing anything

- Read applicable repository instructions and inspect the actual checkout, worktrees, conflicts and unrelated changes. Reuse a suitable checkout; isolate work if the primary checkout has conflicts. Make a temporary delivery branch only if useful, never a permanent branch/application per restaurant.
- Locate the importer, onboarding commands, domain resolver, media middleware and deployment documentation in this checkout. Repository source is authoritative; historical reports and examples are leads.
- Discover the current deployment, actual container/source release, persistent storage, existing tenants/domains and publication versions. Record non-secret before-state. Repository HEAD and a default release environment variable may differ from the running release.
- Determine the requested password store and documentation destination from user instructions and current project configuration. Inspect access/visibility before writing. Do not embed provider account IDs, credentials, host IPs or a historical release in this skill as permanent defaults.

## Execute the relevant stages

1. **Research and prepare.** Read [research.md](references/research.md). Establish a menu baseline, assign read-only source investigations when delegation is available, consolidate exact evidence and distinguish confirmed photos from unresolved candidates. Research workers must not publish.
2. **Validate and review.** Run the read-only helper below, inspect the importer contract, and verify the consolidated package against sources. Use an independent reviewer when delegation is supported and permitted. Otherwise label the review as self-review; if the user requires independence, an unavailable independent reviewer remains a blocker to that requirement.
3. **Publish and verify, when requested.** Read [publishing-and-verification.md](references/publishing-and-verification.md). Validate protected recoverable backups before production writes. Import a separate tenant, map its unique hostname and preserve every existing tenant. Only make application changes necessary for the requested content/layout.
4. **Admin access and documentation, when requested.** Read [admin-and-documentation.md](references/admin-and-documentation.md). Verify the account's actual membership, save credentials privately, and update the hostname inventory with authenticated vault links rather than active passwords.

From the repository root:

```sh
python3 skills/omni-rest-onboard-restaurant/scripts/validate_package.py restaurants/RESTAURANT-SLUG/restaurant.json
```

The helper uses the Python standard library, reads local files only, and checks importer JSON syntax (including comments/trailing commas), package paths, repeated image alt text, menu fields and image headers/limits. Its report includes counts and SHA-256 values. It does not establish photo identity, permissions, current prices, full image decodability, or complete importer validity. Inspect current application validation and effective media limits before relying on its defaults.

## Finish with usable evidence

Keep `restaurants/<slug>/restaurant.json`, `photos/`, source records, menu inventory, confirmed/probable/unlabelled photo findings, missing-photo checklist, owner questions and verification/deployment notes in the project. Preserve unsupported choices and supplements in research records rather than extending the importer schema. Keep credentials, session cookies and raw private backups outside tracked files.

Report working home/menu/admin links as applicable; slug/ID and publication version; category/entry counts; exact dish-photo coverage and unresolved count; selected price source and material uncertainties; verification and preservation of existing tenants; package location and branch/commit if one was created. Report credential location without revealing a password. Distinguish completed, untested and blocked stages. Do not claim publication, independent review, login, vault storage or rollback success without corresponding evidence.
