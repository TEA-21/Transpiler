# Final 100% Completion Plan: Flow-Sensitive Occurrence Typing & Strict Transpilation

## 1. Project Goal & Research Spark Alignment
Per user alignment and professor feedback:
- **Core Research Spark:** Flow-Sensitive Occurrence Typing & Union Narrowing.
  - Upgrade type engine from naive invariant rejection to full union type inference (`number | string`, `T | null`).
  - Synthesize TypeScript type guards and branch narrowing via `isinstance(x, int|str|bool)` and `x is None` / `x is not None`.
  - Disallow unsafe operations on un-narrowed unions while allowing seamless dynamic-to-static transition.
- **100% Completion Deliverables:**
  - Production CLI wrapper with POSIX arguments (`-o`, `--check`, `--emit-ast`, `--verify-tsc`, `--module`).
  - Automated `tsc` Typecheck Verification pipeline in Vitest.
  - Idiomatic module exports (`export` keyword emission).
  - Workbench UI presets and visualization updates for Union types.
  - Zero unrequested paper writing (code, tooling, and test focus only).

---

## 2. Architecture & File Breakdown

### Files to Modify / Create:
1. **Lexer & Tokens:**
   - `src/lexer/tokens.ts`: Add `KEYWORD_NONE`, `KEYWORD_IS`, token mappings.
   - `src/lexer/lexer.ts`: Scan `None` and `is`.
   - `tests/lexer.test.ts`: Add tokenization tests for `None`, `is`, `is not`.
2. **AST & Parser:**
   - `src/parser/ast.ts`: Add `NoneLiteral`, extend `BinaryOperator` with `'is'` and `'is not'`.
   - `src/parser/parser.ts`: Parse `None` literals, `is` / `is not` expressions, and `isinstance()` calls.
   - `tests/parser.test.ts`: Add parser tests for type checks and `None`.
3. **Semantic Analysis & Occurrence Typing:**
   - `src/semantics/types.ts`: Add `UnionType`, `NULL_TYPE`, `createUnionType`, union simplification, subtyping, and stringification.
   - `src/semantics/unifier.ts`: Update unification to handle unions, subtyping, and typevar instantiation against unions.
   - `src/semantics/symbolTable.ts`: Support symbol narrowing and type overrides in child scopes.
   - `src/semantics/analyzer.ts`:
     - Reassignment: calculate union type on reassignment, track current narrowed type.
     - Flow-Sensitive Narrowing: analyze `isinstance(x, type)` and `x is not None` in `IfStatement` tests; narrow symbols in consequent and alternate branches.
     - Enforce type safety: reject operations on un-narrowed unions with explanatory diagnostics.
   - `tests/semantics.test.ts`: Add tests for union inference, `isinstance` narrowing, `None` optional returns, and invalid un-narrowed operations.
4. **TypeScript Code Generation:**
   - `src/codegen/emitter.ts`:
     - Emit `null` for `None`.
     - Emit `=== null` / `!== null` for `is None` / `is not None`.
     - Emit `typeof x === 'number'` / `'string'` / `'boolean'` for `isinstance()`.
     - Emit union type annotations (`number | string`, `T | null`).
     - Support `moduleMode` option to emit `export` for top-level functions and constants.
   - `tests/emitter.test.ts`: Test union type emission and type guard translation.
5. **Production CLI Interface:**
   - `src/cli.ts`: Standalone POSIX CLI parser supporting `-o`, `--check`, `--emit-ast`, `--module`, `--verify-tsc`, and piping.
   - `package.json`: Register `"bin"` entry and npm scripts.
6. **Automated `tsc` Verification Suite:**
   - `tests/e2e_tsc.test.ts`: Run generated TypeScript code directly through the TypeScript compiler (`tsc --noEmit`) to verify 0 type errors.
7. **Workbench UI Updates:**
   - `src/ui/public/app.js` & `index.html`: Add preset for Union Types & Type Guards, display union badges in AST and symbol tables.
8. **Progress Tracking:**
   - `PROGRESS.md`: Record all completed steps and verification results.

---

## 3. Step-by-Step Implementation Protocol

### Step 1: Lexer & Parser Extensions (`None`, `is`, `is not`, `isinstance`)
- Verify: Lexer and parser test suites pass with new grammar features.

### Step 2: Semantic Union Types & Flow-Sensitive Occurrence Typing
- Verify: Vitest semantic tests pass for union inference and branch narrowing.

### Step 3: TypeScript Emitter & Module Exports
- Verify: Emitter tests pass for `typeof` guards, null checks, and union type signatures.

### Step 4: Production CLI Implementation (`src/cli.ts`)
- Verify: CLI transpiles files from terminal and validates arguments.

### Step 5: Automated End-to-End `tsc` Verification Suite
- Verify: Real `tsc` compiler confirms 0 type errors on all generated test files.

### Step 6: Workbench UI Presets & Live Verification
- Verify: UI displays new presets and visualizes union types cleanly.