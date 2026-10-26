# Execution Plan: Flow-Sensitive List Comprehensions & Slice Syntax

## 1. Feature Overview & USP Alignment
- **USP:** Flow-Sensitive List Comprehensions & Array/String Slicing.
- **Occurrence Typing Integration:**
  - Branch narrowing inside comprehension filters (e.g., `[x * 10 for x in items if isinstance(x, int)]` narrows `(number | string)[]` to `number[]`).
- **Comprehension Scope:**
  - Single loops with optional `if` filters translated to `.filter().map()`.
  - Nested multi-loops translated to `.flatMap()`.
- **Slicing Scope:**
  - `items[start:stop]` translates to `items.slice(start, stop)`.
  - Negative indexing `items[-3:]` translates to `items.slice(-3)`.
  - Single negative indexing `items[-1]` translates to `items.at(-1)`.
  - Slicing with step `items[::2]` or `items[::-1]` translates to inline array operations without runtime dependencies.

---

## 2. Step-by-Step Implementation Protocol

### Step 1: Lexer & Grammar Extensions
- Add `for` and `in` keywords (`KEYWORD_FOR`, `KEYWORD_IN`) to `src/lexer/tokens.ts` and `src/lexer/lexer.ts`.
- Add lexer unit tests in `tests/lexer.test.ts`.
- **Verify:** `npx vitest run tests/lexer.test.ts` passes.

### Step 2: AST & Parser Extensions
- Extend `src/parser/ast.ts` with `ListComprehension`, `ComprehensionClause`, and `SliceExpression`.
- Extend `src/parser/parser.ts`:
  - Detect and parse `[expr for target in iter (if cond)* (for ...)*]` as `ListComprehension`.
  - Detect and parse `obj[start:stop:step]` as `SliceExpression`.
- Add parser tests in `tests/parser.test.ts`.
- **Verify:** `npx vitest run tests/parser.test.ts` passes.

### Step 3: Semantic Analysis & Occurrence Typing
- Extend `src/semantics/analyzer.ts`:
  - Infer types for `SliceExpression` on `ArrayType(T) -> ArrayType(T)` and `STRING_TYPE -> STRING_TYPE`.
  - Ensure slice bounds unify with `number` (integer).
  - Infer types for `ListComprehension`:
    - Bind loop targets from iterable element types in child scopes.
    - Narrow union types inside `if` filters (`isinstance(x, T)`, `x is not None`).
    - Infer comprehension result as `ArrayType(inferredElement)`.
- Add semantics tests in `tests/semantics.test.ts`.
- **Verify:** `npx vitest run tests/semantics.test.ts` passes.

### Step 4: TypeScript Code Generation
- Extend `src/codegen/emitter.ts`:
  - Emit `.slice(...)` and inline step expressions for `SliceExpression`.
  - Emit `.at(...)` for negative single `IndexExpression`.
  - Emit `.filter(...).map(...)` and `.flatMap(...)` for `ListComprehension`.
- Add emitter unit tests in `tests/emitter.test.ts`.
- **Verify:** `npx vitest run tests/emitter.test.ts` passes.

### Step 5: Workbench UI & AST Diagram Updates
- Update `src/ui/public/index.html` and `src/ui/public/app.js` with list comprehension & slicing preset and AST diagram nodes.
- **Verify:** Workbench server serves preset cleanly.

### Step 6: End-to-End TypeScript Compiler (`tsc`) Verification
- Add end-to-end test cases in `tests/e2e_tsc.test.ts` verifying `tsc --noEmit` on generated comprehension & slice code.
- Run full test suite and build verification: `npm test` and `npm run build`.
- **Verify:** 100% tests passing, clean build.