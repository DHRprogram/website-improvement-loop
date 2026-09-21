# Changelog

## 0.5.0 (2026-09-21)

### Added
- /web-improvement-loop:frontend now uses frontend-master-loop skill v1.0.0
- 4 Pillar architecture: Approval Harvest, Composition Registry, Autonomous Execution, Hard Stop Triggers
- 16 redesign phases with 15 safety guards
- Autonomous execution until completion — no human in loop
- Resume support via STATE.json

### Changed
- frontend subcommand upgraded from 10-agent improver to full master redesign loop
- Risk warning added for autonomous execution

### Notes
- Previous /web-improvement-loop:frontend behavior (10-agent improver) still available at skills/frontend-10-agent-improver/
- The master loop requires staging DB, feature flags, backup target, and APM
