# Story 6.3 — AI-Assisted Emergent Skill Pipeline
**Epic:** 6 | **Role:** AI Systems Agent | **Status:** Blocked on 6.2 + 4.2 + 11.2

## Problem / intent
Rare new skills should be able to emerge safely from repeated player behaviour so the game can evolve over time without destabilising balance.

## Acceptance criteria
- [ ] Actions emit semantic fingerprints: verb, domain, tool, output_class, context
- [ ] Fingerprint detector identifies novel action clusters not matching existing skills
- [ ] AI worker receives sanitised context and proposes: name, parent_skill_id, description, effect_template
- [ ] Rules engine scores proposal: duplicate risk, naming rules, taxonomy fit, exploit risk
- [ ] Proposals stored in ai_skill_proposals table with versioned record, provenance, score, moderation_status
- [ ] Admin review queue GET/PATCH /api/admin/skill-proposals
- [ ] Approved proposals create live skill definitions via existing skills table
- [ ] Non-AI fallback: proposal rejected if AI provider is down
- [ ] Unit tests: fingerprint emission, similarity match, scoring, non-AI fallback

## Dependencies
- 6.2 ✅  |  4.2 ✅  |  11.2 ✅

## Scope
Only touch: server/src/modules/skills/emergent/, server/src/modules/ai/, infra/migrations/, server/test/
Do NOT touch: client/, economy/, simulation core/

## Implementation notes
- ai_skill_proposals table: id, fingerprint_hash, proposed_name, parent_skill_id, description, effect_template, score, moderation_status, created_at
- Use OpenAI API (key from env OPENAI_API_KEY) — with circuit breaker fallback
- Similarity check: cosine similarity of fingerprint vectors vs existing skill embeddings

## Test notes
server/test/emergent-skill.service.test.ts — mock AI, test scoring, fallback path

## Observability notes
Emit AIProposalCreated, AIProposalApproved domain events

## Review owner
Product Owner (Joshua) — human must approve all proposals before publish

---
## Cloud agent execution prompt
```
You are the AI Systems Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 6.3 - AI-Assisted Emergent Skill Pipeline.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-6.3-emergent-skill-pipeline.md && cat server/src/modules/skills/skills.service.ts && cat server/src/common/domain-events.ts

STEP 2 - Implement:
  Create infra/migrations/008_create_ai_skill_proposals.sql
  Create server/src/modules/ai/: ai.module.ts, ai.service.ts (OpenAI calls with circuit breaker fallback)
  Create server/src/modules/skills/emergent/: fingerprint.service.ts, similarity.service.ts, proposal.service.ts, proposal.controller.ts (admin routes)
  Wire fingerprint emission into action.service.ts (call emitFingerprint after each action)
  Admin GET /api/admin/skill-proposals, PATCH /api/admin/skill-proposals/:id (approve/reject)

STEP 3 - Validate:
  cd MMORPG_Design_Documents && npm run validate

STEP 4 - Open PR:
  git checkout -b story/6.3-emergent-skills
  git add server/src/modules/skills/emergent/ server/src/modules/ai/ infra/migrations/008_create_ai_skill_proposals.sql server/test/
  git commit -m "feat(6.3): AI-assisted emergent skill pipeline with moderation gate"
  gh pr create --draft --title "feat(6.3): emergent skill pipeline" --body "Implements story 6.3. Fingerprinting, similarity check, AI proposal, scoring, admin review queue. All criteria met."
```
