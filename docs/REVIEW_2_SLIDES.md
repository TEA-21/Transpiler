# COMPILER DESIGN PROJECT: REVIEW II SLIDE DECK
## Mini-Python to Strict TypeScript Transpiler

---

### Slide 1: Title & Project Overview
- **Project Title:** Mini-Python to Strict TypeScript Transpiler
- **Milestone:** Review II (75% Implementation, Technical Documentation, Presentation & Defense)
- **Institution:** Vellore Institute of Technology (VIT)
- **Course:** Compiler Design Laboratory
- **Team Members:**
  - Tanishka Kundu (24BCE0730)
  - Taanush Emmanuel Abraham (24BCE0708)

---

### Slide 2: Problem Statement & Motivation
- **Python Dynamic Typing Drawbacks:**
  - Variables declare no types; type errors surface only during production runtime.
  - Silent type mutations cause application crashes and data corruption.
- **TypeScript Static Typing Advantages:**
  - Enforces rigid structural types and catches type errors at compile time.
- **Existing Tool Limitations:**
  - AST converters (Babel) emit the `any` escape hatch, eliminating safety guarantees.
  - Python linters (`mypy`) require manual annotations and cannot emit TypeScript.
- **Project Goal:**
  - Build an end-to-end transpiler that ingests untyped Python, infers static types automatically, and emits strict TypeScript without `any`.

---

### Slide 3: Review II Scope & Deliverables (75% Milestone)
- **Rubric Target:** 75% Implementation / Prototype Progress (6M)
  - Scoped symbol table and type inference engine.
  - Grammar and AST support for `while` loops, function blocks, and array constructs.
  - Prototype TypeScript code generation (Visitor Pattern).
- **Rubric Target:** Documentation & Progress Report (2M)
  - Complete 11-page technical report in ASD-STE100 (`Review 2 Documentation - Transpiler.pdf`).
  - Documented formal typing rules, unification algorithm, and module table.
- **Rubric Target:** Presentation & Defense (2M)
  - Structured 10-slide review presentation and 10-question defense handbook.
- **Test Metrics:** 59 automated test cases passing with 100% pass rate.

---

### Slide 4: System Architecture Pipeline
- **End-to-End Five-Stage Pipeline:**
  1. **Off-Side Lexical Analyzer:** Converts source characters into tokens; injects virtual `INDENT` and `DEDENT` tokens.
  2. **Recursive Descent Parser:** Generates strongly typed AST nodes with source coordinates.
  3. **Scoped Symbol Table:** Maintains hierarchical scope chains (`global`, `function`, `loop`, `block`).
  4. **Type Inference Engine:** Solves type constraints using Robinson Unification; decorates AST with static types.
  5. **TypeScript Emitter:** Traverses decorated AST via Visitor Pattern; emits strict TypeScript code.

---

### Slide 5: Lexical Analysis & Indentation Handling
- **Off-Side Indentation Tracking:**
  - Tracks line start column numbers using an internal stack initialized to `[0]`.
  - Column increases emit virtual `INDENT` tokens.
  - Column decreases emit virtual `DEDENT` tokens.
  - Inconsistent indentation triggers compile-time `IndentationError`.
- **Bracket Depth Counter:**
  - Tracks open brackets (`[`) and close brackets (`]`).
  - When `bracketDepth > 0`, the lexer suppresses newline statement breaks.
  - Enables clean multi-line array declarations.

---

### Slide 6: Extended Grammar & AST Parser
- **Constructs Supported for Review II:**
  - **Primitive Bindings:** Numeric, string, and boolean literal assignments.
  - **Arithmetic & Logic:** Precedence-aware binary operators (`+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `and`, `or`, `not`).
  - **While Loops:** Loop headers with boolean termination guard validation.
  - **Function Declarations:** `def` blocks with formal parameter lists and return statements.
  - **Array Constructs:** Homogeneous array literals (`[1, 2, 3]`) and subscript indexing (`arr[i]`).
- **Zero Ambiguity:** Built with deterministic recursive descent and line/column source anchors.

---

### Slide 7: Scoped Symbol Table & Static Invariants
- **Lexical Scope Hierarchy:**
  - Separate scope instances for `global`, `function`, `loop`, and `block`.
  - Child scopes resolve identifiers by traversing parent chains upward.
  - Undefined variable accesses throw compile-time `SemanticError`.
- **Static Invariant Typing Rule:**
  - Variables receive an immutable static type upon initial assignment (`count = 10` -> `number`).
  - Subsequent assignments must unify with the variable's initial type.
  - Conflicting reassignments (`count = "hello"`) are immediately rejected with `TypeError`.
  - Valid reassignments mark the symbol as mutable (`isMutable = true`).

---

### Slide 8: Type Inference & Robinson Unification
- **Bidirectional Constraint Propagation:**
  - Assigns fresh type variables ($\alpha_1, \alpha_2$) to function parameters and returns.
  - Infers parameter types from internal expressions (e.g., `x - 5` bounds `x` to `number`).
  - Unifies parameter types across external call sites.
  - Unifies all `return` expressions across branching paths; flags incompatible branch types.
- **Robinson Unification Engine:**
  - Recursive unification with strict **occurs check** (prevents infinite types).
  - Path compression via `prune()` ensures rapid substitution lookup.

---

### Slide 9: Prototype TypeScript Emitter Preview
- **Visitor Pattern Code Generation:**
  - Traverses decorated AST nodes and emits clean, idiomatic TypeScript.
  - Converts Python `snake_case` identifiers to TypeScript `camelCase`.
  - Emits explicit type signatures: `let count: number = 10;`, `let scores: number[] = [1, 2, 3];`.
  - Reassignments emit without duplicate `let` keywords: `count = count + 1;`.
  - Automatically translates `print(...)` calls to `console.log(...)`.
  - Synthesizes structural block braces (`{ }`) and semicolons (`;`).
  - **Strictly avoids `any`:** Emitted code passes strict `tsc` checks with zero errors.

---

### Slide 10: Verification, Benchmarks & Review III Roadmap
- **Verification Metrics:**
  - **59 / 59 Unit Tests Passing (100%):**
    - Lexer: 10 tests | Parser: 15 tests | Semantics: 27 tests | Emitter: 7 tests.
  - **End-to-End Pipeline Latency:** 2.26 ms for complete 5-stage compilation.
  - **Strict `tsc` Compilation:** Zero errors on generated TypeScript output.
- **Review III Roadmap (100% System Demo):**
  - Package production CLI tool (`node transpile.js input.py -o output.ts`).
  - Full end-to-end integration test suite compiling generated TS through `tsc`.
  - Final IEEE-format research manuscript submission.
