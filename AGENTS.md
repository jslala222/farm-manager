# Agent Rules (farm-manager)

## Priority
1. System/developer instructions
2. This file (AGENTS.md)
3. docs/PROCESSING_B_PLAYBOOK.md
4. User request details

## Default Approach
- Use Plan B (recipe-based processing) as the default implementation path.
- Keep development server on port `5555`.
- Use KST helper functions from `lib/utils.ts` for all persisted timestamps.

## KST Rules
- Use: `getNowKST()`, `formatKSTDate()`, `toKSTDateString()`, `formatKSTLocale()`.
- Avoid UTC-centric formatting for persisted values.

## Working Style
- When user says "진행", implement directly instead of long planning.
- Show changed file paths and what was changed.
- Prefer small, verifiable steps and run checks after edits.

## Domain Rules
- Inventory baseline: harvest/sales/adjustments.
- Processing plan B: recipe setup + production run + inventory adjustments.
- Raw crops require grade where applicable.