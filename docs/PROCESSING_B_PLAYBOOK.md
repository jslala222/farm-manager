# PROCESSING B PLAYBOOK

## Goal
Standardize raw-to-processed inventory conversion for multi-tenant farm operations.

## Core Flow
1. Define processing recipe.
2. Start production run with input quantity.
3. Calculate expected output from recipe ratio.
4. Confirm actual output.
5. Apply inventory adjustments:
   - raw material: decrease (`process_out`)
   - processed item: increase (`process_in`)

## Data Model
- `processing_recipes`
- `processing_recipe_items`
- `processing_runs`
- Existing `inventory_adjustments` for stock movement

## UI Entry Points
- `/processing/recipes`: recipe management
- `/processing/runs`: production execution and confirmation
- `/inventory`: resulting stock visibility

## Operational Notes
- Non-processing farms can hide processing menus.
- Keep all write timestamps in KST helpers.
- Keep every stock movement auditable via adjustment records.