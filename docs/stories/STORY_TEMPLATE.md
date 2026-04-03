# Story X.Y — Title

**Epic:** X — Epic name
**Role:** Agent role (Backend / Frontend / Economy / QA / AI Systems / Live Ops)
**Status:** Draft | Ready | In Progress | Review | Done

## Problem / intent
What player or system problem is being solved.

## Acceptance criteria
- [ ] Observable condition 1
- [ ] Observable condition 2

## Dependencies
- Story X.X ✅ or (blocked)

## Scope
Only touch: list files/folders
Do NOT touch: list files/folders

## Implementation notes
- Schema, endpoint, file, or architectural constraints.

## Test notes
- Required unit, integration and scenario tests.

## Observability notes
- Logs, metrics or dashboard impact.

## Review owner
Product Owner (Joshua) or lead agent.

---

## Cloud agent execution prompt

Copy the block below verbatim when firing `oz agent run-cloud --prompt`.
Replace ALL_CAPS placeholders before running.

```
You are the ROLE_NAME Agent on the CybaWorld MMORPG project. Do NOT wait for further instructions. Implement immediately.

TASK: Implement story X.Y - STORY_TITLE.

STEP 1 - Read context (do not stop after this step):
  cat AGENTS.md
  cat docs/DEFINITION_OF_DONE.md
  cat docs/stories/story-X.Y-SLUG.md
  cat FILE_TO_READ_1
  cat FILE_TO_READ_2

STEP 2 - Implement:
  DESCRIBE EXACT FILES TO CREATE OR EDIT AND WHAT EACH MUST DO.

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate
  If it fails, fix the error and re-run until passing.

STEP 4 - Open a PR:
  git checkout -b story/X.Y-SLUG
  git add LIST_OF_CHANGED_FILES
  git commit -m "feat(X.Y): SHORT_DESCRIPTION"
  gh pr create --draft --title "feat(X.Y): TITLE" \
    --body "Implements story X.Y. Files changed: LIST. All acceptance criteria met."
```
