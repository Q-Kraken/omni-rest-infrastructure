# Remediation decisions for review

Base: `7ecd51d` (latest main). Workspace: `/Users/volkvolk/Documents/omni-rest-infra`.

## WO-06: Missing PR-9 source text

`requirments/Phase 3/Phase_3_PR-9_Restaurant_Information_Management.md` still ends with `(Tasks 3--14 continue exactly as provided in the conversation.)`. The original twelve tasks are needed to restore this document without inventing requirements. Existing implementation and technical specifications remain available; this source-document defect stays open.

## WO-07: Reconcile contradictory requirements

1. Social platforms: main now implements Instagram, Facebook, TikTok, Google Business, X, YouTube, and LinkedIn (`RestaurantValidation.SocialHosts`, Phase 6 migration). Preserve this shipped set of seven and align older requirements/specifications to it. No platform migration is needed.
2. Unavailable dishes: preserve active dishes in public menus with explicit availability indicators, as PR-7 requires. Amend PR-5 wording so that it excludes inactive/archived items rather than unavailable items.
3. Overnight hours: preserve existing overnight intervals, exclusive closing boundaries, and special-date overrides. Show semantic times and explicit “next day” labels publicly; require an owner confirmation when saving an interval closing earlier than it opens. Equal opening/closing times remain invalid.

## WO-08: Phase 1 delivery

Later work now supplies multiple public home designs, restaurant identity, gallery, menu management, SEO and structured data. Absence of an early commit named “Phase 1” does not prove absence of implementation. See `PHASE-1-TRACEABILITY.md` for task-by-task evidence and remaining gaps. Recommend completing the gaps in the current shared components and designs, preserving the design catalog and current heading IDs, then recording a formal Phase 1 delivery evidence document. No redesign or toolchain replacement is proposed.

Approved by the owner on 2026-10-13: WO-07 reconciliation and WO-08 completion scope. WO-06 remains open by owner instruction.
