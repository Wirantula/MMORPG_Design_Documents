import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , storyId, ...titleParts] = process.argv;

if (!storyId || titleParts.length === 0) {
  console.error('Usage: npm run story:new -- <EPIC.STORY> <Title Words...>');
  process.exit(1);
}

const title = titleParts.join(' ').trim();
const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const storiesDir = resolve(process.cwd(), 'docs', 'stories');
if (!existsSync(storiesDir)) {
  mkdirSync(storiesDir, { recursive: true });
}

const filename = `${storyId}-${slug}.md`;
const filepath = resolve(storiesDir, filename);
const content = `# Story ${storyId}: ${title}

## Problem / intent

## Acceptance criteria

## Dependencies

## Implementation notes

## Test notes

## Observability notes

## Review owner
`;

writeFileSync(filepath, content, 'utf-8');
console.log(`Created ${filepath}`);
