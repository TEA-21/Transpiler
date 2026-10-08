# Implementation Plan: Mini-Python to Strict TypeScript Transpiler

**Reference Document:** "PRD - Mini-Python to Strict TypeScript Transpiler.pdf"

This plan breaks down the construction of the transpiler into actionable steps mapped to the architecture and milestones defined in the PRD. 

## Phase 1: Project Setup and Lexical Analysis (Review 1 Alignment)
**Objective:** Initialize the project and build a lexer capable of handling Python's indentation-based scoping.
*   **Step 1.1: Environment Setup:** Initialize a Node.js project with TypeScript. Set up `vitest` for the testing framework and configure a strict `tsconfig.json`.
*   **Step 1.2: Token Definition:** Define the TypeScript interfaces/enums for all lexical tokens (Keywords, Identifiers, Literals, Operators, Punctuation).
*   **Step 1.3: Off-Side Lexer Implementation:** Build the Lexer to read the Mini-Python source string. 
    *   Implement column indentation tracking.
    *   Inject virtual `INDENT` and `DEDENT` tokens into the token stream to normalize block nesting.
*   **Step 1.4: Base Testing:** Write unit tests for the lexer validating correct tokenization of primitives and nested blocks.

## Phase 2: AST and Recursive Descent Parser (Review 1 Alignment)
**Objective:** Convert the token stream into an untyped Abstract Syntax Tree (AST).
*   **Step 2.1: AST Node Types:** Define strict TypeScript interfaces for the AST nodes (e.g., `Program`, `VariableDeclaration`, `BinaryExpression`, `IfStatement`, `Identifier`, `Literal`). Include line/column diagnostic anchors.
*   **Step 2.2: Base Parser Implementation:** Create a recursive descent parser.
    *   Implement parsing for primitive bindings (numbers, strings, booleans).
    *   Implement parsing for binary arithmetic and expressions (ensuring correct operator precedence).
    *   Implement parsing for conditionals (`if`/`else`).

## Phase 3: Semantic Analysis and Type Inference (Review 2 Alignment)
**Objective:** Walk the AST to infer types, enforce scope, and reject type-invalid operations.
*   **Step 3.1: Scope & Symbol Table:** Implement a scoped symbol table to track variable and function declarations, including their inferred or explicitly resolved types.
*   **Step 3.2: Local Type Inference:** 
    *   Infer primitive types from literal assignments.
    *   Evaluate binary expressions to ensure type safety (e.g., block arithmetic on strings). Throw compile-time errors on mismatch.
*   **Step 3.3: Advanced Grammar Expansion:** Update the Lexer and Parser to support `while` loops, function declarations (`def`), function calls, and array constructs.
*   **Step 3.4: Function Constraint Propagation:** Implement bidirectional constraint propagation to derive parameter types based on AST call sites and unify return statement types.

## Phase 4: Code Generation (Review 3 Alignment)
**Objective:** Translate the type-decorated AST into strictly typed TypeScript code.
*   **Step 4.1: Visitor Pattern Setup:** Implement a decoupled Visitor Pattern architecture to traverse the decorated AST.
*   **Step 4.2: TS Emitter:** 
    *   Emit variables with explicit type signatures (`let count: number = 10;`).
    *   Convert identifiers to idiomatic `camelCase`.
    *   Map `print()` to `console.log()`.
    *   Inject structural block braces `{}` and semicolons `;` based on AST nodes.
    *   Ensure the output strictly avoids the `any` escape hatch.

## Phase 5: CLI and Integration Testing (Review 3 Alignment)
**Objective:** Package the transpiler and ensure robustness.
*   **Step 5.1: CLI Wrapper:** Build the command-line interface handling POSIX arguments: `node transpile.js <input.py> -o <output.ts>`.
*   **Step 5.2: End-to-End Test Suite:** Create integration tests in `vitest`.
    *   Pipeline tests: Transpile Mini-Python -> Compile generated TS using `tsc` -> Assert zero `tsc` errors.
    *   Negative tests: Ensure the transpiler correctly rejects invalid Mini-Python code (e.g., conflicting reassignments, bad boolean termination conditions).