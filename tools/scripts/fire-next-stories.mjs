#!/usr/bin/env node
/**
 * fire-next-stories.mjs
 *
 * Reads the dependency graph, determines which stories just became unblocked
 * after a completed story, extracts the cloud agent execution prompt from each
 * story file, and fires an Oz cloud agent run for each newly unblocked story.
 *
 * Usage:
 *   WARP_API_KEY=wk-... node fire-next-stories.mjs --completed=2.1 [--dry-run]
 *
 * The script also accepts a comma-separated list:
 *   node fire-next-stories.mjs --completed=1.2,1.3
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');

// ── Parse args ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace('--', '').split('=')).map(([k, v]) => [k, v])
);

const completedArg = args.completed ?? '';
const dryRun = 'dry-run' in args;

if (!completedArg) {
  console.error('Usage: node fire-next-stories.mjs --completed=<story_id> [--dry-run]');
  process.exit(1);
}

const justCompleted = completedArg.split(',').map(s => s.trim());

// ── Load config ───────────────────────────────────────────────────────────────
const configPath = join(ROOT, 'tools', 'config', 'story-deps.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const ENV_ID = process.env.OZ_ENVIRONMENT_ID ?? config.environment_id;
const API_KEY = process.env.WARP_API_KEY;

if (!API_KEY && !dryRun) {
  console.error('Error: WARP_API_KEY environment variable is required.');
  process.exit(1);
}

// ── Build completed set ───────────────────────────────────────────────────────
const completed = new Set([...config.completed, ...justCompleted]);

// ── Determine newly unblocked stories ─────────────────────────────────────────
function isUnblocked(storyId) {
  const deps = config.dependencies[storyId] ?? [];
  return deps.every(d => completed.has(d));
}

// Stories that were blocked before this run but are now unblocked
const previouslyCompleted = new Set(config.completed);
const newlyUnblocked = Object.keys(config.dependencies).filter(id => {
  if (completed.has(id)) return false;                        // already done
  if (isUnblocked(id) && !justCompleted.includes(id)) {
    // Check if it was already unblocked before (all deps were in previouslyCompleted)
    const deps = config.dependencies[id] ?? [];
    const wasAlreadyUnblocked = deps.every(d => previouslyCompleted.has(d));
    return !wasAlreadyUnblocked;                              // only newly unblocked
  }
  return false;
}).filter(isUnblocked);

if (newlyUnblocked.length === 0) {
  console.log(`✓ Completed: ${justCompleted.join(', ')}`);
  console.log('No newly unblocked stories found.');
  process.exit(0);
}

console.log(`✓ Completed: ${justCompleted.join(', ')}`);
console.log(`→ Newly unblocked: ${newlyUnblocked.join(', ')}`);

// ── Extract prompt from story file ────────────────────────────────────────────
function extractPrompt(storyId) {
  const filename = config.story_files[storyId];
  if (!filename) return null;

  const filePath = join(ROOT, 'docs', 'stories', filename);
  if (!existsSync(filePath)) {
    console.warn(`  ⚠ Story file not found: ${filePath}`);
    return null;
  }

  const content = readFileSync(filePath, 'utf8');
  // Extract the content of the last ```...``` block (the cloud agent execution prompt)
  const blocks = [...content.matchAll(/```\n([\s\S]*?)```/g)];
  if (blocks.length === 0) {
    console.warn(`  ⚠ No execution prompt found in: ${filename}`);
    return null;
  }

  return blocks[blocks.length - 1][1].trim();
}

// ── Fire cloud agents ─────────────────────────────────────────────────────────
async function fireAgent(storyId, prompt) {
  const url = 'https://app.warp.dev/api/v1/agent/run';
  const body = JSON.stringify({
    prompt,
    config: { environment_id: ENV_ID }
  });

  if (dryRun) {
    console.log(`  [DRY RUN] Would fire agent for story ${storyId}`);
    console.log(`  Prompt preview: ${prompt.substring(0, 120).replace(/\n/g, ' ')}...`);
    return { run_id: 'dry-run' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────
for (const storyId of newlyUnblocked) {
  const prompt = extractPrompt(storyId);
  if (!prompt) {
    console.error(`  ✗ Skipping ${storyId} — could not extract prompt`);
    continue;
  }

  try {
    const result = await fireAgent(storyId, prompt);
    const runId = result.run_id ?? result.id ?? JSON.stringify(result);
    console.log(`  ✓ Fired agent for story ${storyId} → run: ${runId}`);
    if (!dryRun) {
      console.log(`    Watch at: https://oz.warp.dev/runs/${runId}`);
    }
  } catch (err) {
    console.error(`  ✗ Failed to fire agent for story ${storyId}: ${err.message}`);
  }

  // Stagger launches slightly to avoid hammering the API
  await new Promise(r => setTimeout(r, 500));
}

console.log('\nDone.');
