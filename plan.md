# Implementation Plan: AST Tree Visualization in Compiler Workbench UI

## 1. Context & User Alignment Summary
Following the `/grill-me` alignment interview, the Workbench UI will be upgraded to include an interactive hierarchical tree visualization for Abstract Syntax Trees:
- **Format:** An interactive collapsible tree component with a toolbar switch between **Tree View** and **JSON View**.
- **Scope:** Supported on both the **Type-Decorated AST** and **Raw Untyped AST** inspector tabs.
- **Node Information:** Node type badge, concise identifier/value/operator preview, source line/column coordinates (`L:C`), and inferred type badge (when present on decorated nodes).
- **Expansion Behavior:** Automatically expand top 2 levels by default upon transpilation, with global `[Expand All]` and `[Collapse All]` toolbar actions.
- **Editor Synchronization:** Clicking any AST node highlights and scrolls to the node's line in the Mini-Python code editor.
- **Design Language:** Zero external dependencies, pure vanilla HTML/CSS/JS maintaining the industrial dark theme tokens.

---

## 2. Architecture & File Breakdown

### Files to Modify:
1. `src/ui/public/index.html`:
   - Upgrade the `#tab-decorated-ast` and `#tab-raw-ast` panes with toolbar controls:
     - View mode toggle: `[Tree View]` (default active) vs `[JSON View]`.
     - Tree action buttons: `[Expand All]`, `[Collapse All]`.
   - Add containers for `#decorated-ast-tree` and `#raw-ast-tree` alongside the `<pre>` JSON views.
2. `src/ui/public/style.css`:
   - Define styles for:
     - AST toolbar (`.ast-toolbar`, `.ast-view-toggle`, `.btn-tool`).
     - Tree container and node hierarchy (`.ast-tree`, `.ast-node`, `.ast-node-header`, `.ast-node-children`).
     - Visual tree indent guides (`.ast-node::before` / tree line connectors).
     - Chevron toggle arrows with rotate transitions.
     - Node badges: `.ast-badge-type`, `.ast-badge-val`, `.ast-badge-loc`, `.ast-badge-inferred`.
     - Node hover & active selection states.
     - Highlighting synchronization in the editor container.
3. `src/ui/public/app.js`:
   - Implement `AstTreeRenderer`:
     - Recursive AST node parsing and DOM creation.
     - Summarization of key properties (`id`, `name`, `operator`, `value`, `inferredType`, `loc`).
     - Expand/collapse toggle logic with depth-based initial expansion (depth <= 2 open).
     - Global expand-all / collapse-all listeners.
     - Node click handler that jumps to line in `pyInput` (setting `selectionStart`/`selectionEnd` and scrolling).
   - Hook up `renderAstTree(data.decoratedAst, 'decorated')` and `renderAstTree(data.rawAst, 'raw')` in `executeTranspile()`.
   - Wire up Tree/JSON mode toggle buttons.
4. `PROGRESS.md`:
   - Update with completed steps, modified files, and verified functionality.

---

## 3. Detailed Execution Phases

### Phase 1: Structure & Markup (`index.html`)
- Wrap `#tab-decorated-ast` and `#tab-raw-ast` with an `.ast-tab-header` containing:
  - Mode toggle button group (`Tree View` / `Raw JSON`).
  - Action buttons (`Expand All`, `Collapse All`).
- Provide distinct tree container `div` and preserve the existing `<pre>` element for JSON mode.

### Phase 2: Styling & Tree Layout (`style.css`)
- Style the toolbar controls, badges, and toggle buttons.
- Build clean hierarchical tree styling with dotted/solid vertical guide lines.
- Implement collapsible disclosure triangles that rotate on open/close.
- Style type chips and value indicators with harmonious palette (`#64B5F6`, `#81C784`, `#BA68C8`, etc.).

### Phase 3: Interactive Tree Logic & Editor Sync (`app.js`)
- Construct recursive tree node builder:
  - Detect node category (`Statement`, `Expression`, `Identifier`, `Literal`, etc.).
  - Extract preview values (e.g. `BinaryExpression: '+'`, `Identifier: 'count'`, `Literal: 100`).
  - Format source coordinates `loc.start.line:loc.start.column`.
  - Filter out recursive metadata properties (`loc`) from cluttering child expansion, displaying only child AST nodes and child arrays.
  - Initial open state: auto-expanded for depth <= 2.
- Implement toolbar toggle actions (Tree vs JSON).
- Implement global Expand All / Collapse All.
- Implement Python editor jump-to-line on node click.

### Phase 4: Verification & Quality Assurance
- Run automated unit test suite (`npm test`) to guarantee zero regression on compiler pipeline.
- Verify transpiler server and UI serving (`node/tsx`).
- Test various AST inputs (Review 2 Demo, functions, arrays, conditionals) in the workbench.
- Update `PROGRESS.md` with execution log.