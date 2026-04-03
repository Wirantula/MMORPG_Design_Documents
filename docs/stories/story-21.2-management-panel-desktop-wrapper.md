# Story 21.2 — Management Panel Desktop Wrapper
**Epic:** 21 | **Role:** Frontend Agent + Live Ops Agent | **Status:** Blocked on 12.1 + 21.1

## Problem / intent
The host needs a local desktop application that wraps the admin panel and provides one-click stack management, so running the game feels like an application rather than a dev server.

## Acceptance criteria
- [ ] Electron app in tools/desktop/ that embeds the admin panel web UI
- [ ] App has a native menu: Start Stack, Stop Stack, Restart Server, View Logs, Create Backup
- [ ] Stack health panel visible at startup: shows service status, connected users, last backup, tick health
- [ ] "Start Stack" runs docker compose -f infra/compose/docker-compose.prod.yml up -d
- [ ] "Create Backup" calls POST /api/admin/ops/backups via the admin API
- [ ] App icon and window title: "CybaWorld Manager"
- [ ] Works on Windows 11; packaged as .exe installer
- [ ] Unit tests: menu action triggers correct shell command or API call

## Dependencies
- 12.1 ✅  |  21.1 ✅

## Scope
Only touch: tools/desktop/
Do NOT touch: server/src/, client/src/, infra/compose/

## Implementation notes
- Use Electron with electron-builder for packaging
- Shell commands run via child_process.exec in main process, not renderer
- Embed admin UI via BrowserWindow loading https://localhost/admin

## Test notes
tools/desktop/test/ — mock child_process.exec, assert correct commands fire

## Review owner
Product Owner (Joshua)

---
## Cloud agent execution prompt
```
You are the Frontend Agent on CybaWorld MMORPG. Do NOT wait. Implement immediately.
TASK: Implement story 21.2 - Management Panel Desktop Wrapper.

STEP 1 - Read:
  cat AGENTS.md && cat docs/stories/story-21.2-management-panel-desktop-wrapper.md && cat infra/compose/docker-compose.prod.yml

STEP 2 - Implement:
  mkdir tools/desktop && cd tools/desktop
  npm init -y && npm install electron electron-builder
  Create tools/desktop/main.js: BrowserWindow loading localhost/admin, native menu with Start/Stop/Restart/Logs/Backup actions
  Create tools/desktop/package.json with electron-builder config for Windows .exe output
  Menu actions: Start Stack calls docker compose up -d; Create Backup calls POST /api/admin/ops/backups
  Create tools/desktop/preload.js for secure IPC between renderer and main
  Create README in tools/desktop explaining how to build and run

STEP 3 - Validate:
  cd MMORPG_Design_Documents/tools/desktop && npm install && npm start
  Confirm Electron window opens without errors.

STEP 4 - Open PR:
  git checkout -b story/21.2-desktop-manager
  git add tools/desktop/
  git commit -m "feat(21.2): Electron management panel desktop wrapper for Windows"
  gh pr create --draft --title "feat(21.2): management panel desktop wrapper" --body "Implements story 21.2. Electron app, native menu, stack management actions, health panel. All criteria met."
```
