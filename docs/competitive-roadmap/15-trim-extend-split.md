# T-MOD-015 — Trim / extend / split / merge editing tools

**Priority:** P2 · **Phase:** phase-2 · **Area:** area:bim · **Complexity:** Medium

## Why

Drawing without these four tools is exhausting — every correction turns into a delete-and-redraw. Professional drafting tools give the user (a) **Trim** an element to another element, (b) **Extend** an element until it hits another element, (c) **Split** an element at a picked point, (d) **Merge** two collinear elements sharing an endpoint.

## Scope

### In scope

- Four tool-shelf buttons (`T`, `E`, plus two context-sensitive ones under an "Edit" menu — existing `t` key is used for Stair, so pick new shortcuts: `Shift+T` / `Shift+E` / `Shift+X` / `Shift+M`).
- **Trim**: hover a wall, second-click the cutting element; the wall is shortened up to the intersection.
- **Extend**: hover a wall, second-click the target element; the wall's nearer endpoint moves until it touches the target.
- **Split**: hover a wall, click at the split point; the wall becomes two with the same properties.
- **Merge**: select two adjacent collinear walls of the same type; they merge into one.

### Out of scope (this issue)

- Non-wall elements (lines, polygons, etc.) — walls only in v1.
- N-way trim (trim to multiple cutters at once).

## Proposed approach

1. Each tool gets a tiny state machine: pick first element, pick second / point, commit.
2. Pure logic lives in `lib/editOps.ts`: `trimWall(wall, cutter)`, `extendWall(wall, target)`, `splitWall(wall, at)`, `mergeWalls(w1, w2)`.
3. Commit rewrites the affected wall elements; undo captures the pre-state.

## Acceptance criteria

- [ ] Trim: draw two crossing walls; trim one against the other; the trimmed wall ends at the intersection.
- [ ] Extend: draw a wall that stops short of another; extend it; it now touches.
- [ ] Split: click at the midpoint of a 6000 mm wall; the result is two walls of 3000 mm each, both sharing the original's `CompositeId`.
- [ ] Merge: two collinear walls with matching composite merge into one of total length; non-matching composite is rejected with a user-visible reason.
- [ ] Undo/redo works on every operation.
- [ ] Operations preserve hosted doors and windows — merging two walls carries over their openings; splitting carries a door to whichever child it sits on.

## Test plan

New file `packages/app/src/lib/editOps.test.ts`:

- `T-MOD-015-001` — `trimWall(wall A:[0,0]→[10,0], cutter B:[5,-2]→[5,2])` returns a wall `[0,0]→[5,0]`.
- `T-MOD-015-002` — `extendWall(wall A:[0,0]→[4,0], target B:[10,-2]→[10,2])` returns a wall `[0,0]→[10,0]`.
- `T-MOD-015-003` — `splitWall(wall [0,0]→[10,0], at:[5,0])` returns two walls `[0,0]→[5,0]` and `[5,0]→[10,0]`.
- `T-MOD-015-004` — `mergeWalls(A:[0,0]→[5,0], B:[5,0]→[10,0])` with matching composite returns one wall `[0,0]→[10,0]`.
- `T-MOD-015-005` — `mergeWalls` on non-collinear walls returns `null` + reason.
- `T-MOD-015-006` — `splitWall` preserves a door at `X=4` on the first child wall, not both.

Harness:

- `T-MOD-015-007` — new template `edit-ops-demo` draws three walls, trims/extends/splits them; post-conditions match expected geometry.

## Dependencies

- T-MOD-001 (wall junctions) — trim/extend behave differently depending on whether a joint exists.

## Blocks

- None.

## Suggested labels

`enhancement`, `phase-2`, `area:bim`, `area:ui`, `p2`
