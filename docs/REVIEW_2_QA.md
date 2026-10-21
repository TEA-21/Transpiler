# COMPILER DESIGN PROJECT: REVIEW II VIVA DEFENSE & Q&A
## Mini-Python to Strict TypeScript Transpiler

This document contains 10 standard technical questions and answers for the Review II presentation and evaluation. All explanations follow Simplified Technical English (ASD-STE100) principles.

---

### Question 1: What is the off-side rule, and how does your lexer implement it?
**Answer:**
The off-side rule defines code blocks by their indentation column instead of explicit curly braces. 
Our lexer implements the off-side rule with an internal stack data structure initialized to `[0]`:
1. At the beginning of each line, the lexer measures the column index of the first character.
2. If the column index is greater than the top stack value, the lexer pushes the new column to the stack and emits an `INDENT` token.
3. If the column index is less than the top stack value, the lexer pops values from the stack until it finds a matching column. It emits a `DEDENT` token for every popped value.
4. If no matching column exists on the stack, the lexer throws an `IndentationError`.

---

### Question 2: Why does the compiler use Robinson Unification instead of basic type propagation?
**Answer:**
Basic type propagation only flows in one direction: from sub-expressions to parent statements. It cannot deduce types when equations have unknown variables on both sides. 
Robinson Unification solves bidirectional type equations. When a Mini-Python function does not declare parameter types, the compiler creates fresh type variables. Robinson Unification equates these type variables with concrete types based on internal operations and external call-site arguments simultaneously. It also executes an occurs check to detect circular type dependencies and prevent infinite loops.

---

### Question 3: How does the symbol table prevent accessing undeclared variables?
**Answer:**
The symbol table uses a hierarchical tree of lexical scopes. Each scope contains a dictionary of defined symbols and a reference to its parent scope:
1. When the parser encounters an identifier in an expression, it calls `scope.resolve(name)`.
2. The method searches the current local scope first.
3. If the identifier is not found, the method traverses upward through parent scopes to the global scope.
4. If no scope in the chain contains the identifier, the analyzer immediately throws a compile-time `SemanticError` with the line and column number.

---

### Question 4: What happens when a variable is reassigned to a different type in Mini-Python?
**Answer:**
The compiler enforces a static invariant typing rule:
1. When a variable is first declared, its inferred type becomes its invariant static type.
2. When the program reassigns that variable, the semantic analyzer looks up the existing type in the symbol table and infers the type of the new assignment expression.
3. The analyzer unifies the two types using Robinson Unification.
4. If the types do not match (for example, assigning a string to a variable that initially held a number), the compiler rejects the program and throws a compile-time `TypeError`.
5. If the types match, the compiler marks the symbol as mutable (`isMutable = true`).

---

### Question 5: How does bidirectional type inference determine function parameter types without explicit type annotations?
**Answer:**
The compiler uses a two-pass constraint resolution system:
1. **Pass 1:** The compiler creates fresh type variables ($\alpha_1, \alpha_2$) for each parameter.
2. **Pass 2 (Internal Usage):** If the function body performs arithmetic on a parameter (such as `x - 5`), the compiler unifies that parameter's type variable with `number`.
3. **Pass 2 (Call Sites):** When an external statement calls the function (such as `add(10, 20)`), the compiler unifies the parameter type variables with the argument expression types (`number`).
Both sources of constraints must unify successfully, guaranteeing complete type safety without manual user annotations.

---

### Question 6: How are return statement types unified across multiple if/else branches?
**Answer:**
When a function declaration is parsed, the analyzer assigns a fresh return type variable $\beta_{\text{return}}$. 
Each `return` statement inside the function body evaluates its expression to produce a type $\tau$. The analyzer calls `unify(returnTypeVar, tau)`. 
- If all branches return compatible types (for example, branch 1 returns `1` and branch 2 returns `-1`), the unification succeeds and binds $\beta_{\text{return}}$ to `number`.
- If one branch returns `1` (`number`) and another branch returns `"negative"` (`string`), the unification fails and throws a compile-time `TypeError: Conflicting return types`.

---

### Question 7: How does the lexer handle newlines inside bracketed arrays without creating invalid tokens?
**Answer:**
In Python, newlines inside bracketed constructs do not terminate statements. 
Our lexer maintains an integer variable `bracketDepth` initialized to `0`:
1. When the scanner encounters `[`, it increments `bracketDepth` by 1.
2. When the scanner encounters `]`, it decrements `bracketDepth` by 1.
3. When the scanner encounters a newline character (`\n`), it checks `bracketDepth`.
4. If `bracketDepth > 0`, the lexer skips the newline, does not emit a `NEWLINE` token, and does not check indentation columns.
This allows arrays to span multiple lines cleanly.

---

### Question 8: Why does the compiler strictly avoid the `any` escape hatch in TypeScript output?
**Answer:**
The `any` type disables TypeScript's static type checker for all operations on that variable. If a transpiler generates `any`, runtime type errors can pass into production undetected. 
Our compiler is designed to guarantee compile-time type safety. By calculating concrete types (`number`, `string`, `boolean`, `number[]`, function signatures) for every expression through Robinson Unification, the emitted TypeScript is strictly typed and passes `tsc` compilation with zero errors.

---

### Question 9: What tests ensure that the semantic analyzer catches invalid programs before execution?
**Answer:**
The test suite in `tests/semantics.test.ts` includes extensive negative test cases that assert compile-time exceptions:
1. Conflicting reassignments: Assert that reassigning a number variable to a string throws `TypeError`.
2. Invalid arithmetic: Assert that subtracting a number from a string (`"hello" - 5`) throws `TypeError`.
3. Non-boolean guards: Assert that numeric or string conditions in `if` or `while` statements throw `TypeError`.
4. Arity mismatches: Assert that calling a function with incorrect argument counts throws `TypeError`.
5. Heterogeneous arrays: Assert that array literals with mixed types (`[1, "two", 3]`) throw `TypeError`.

---

### Question 10: What components remain to be completed for the final Review 3 milestone?
**Answer:**
For Review 3 (100% System Completion), the team will deliver:
1. **Production CLI Wrapper:** Build a complete command-line interface supporting POSIX arguments (`node transpile.js input.py -o output.ts`).
2. **Automated `tsc` Pipeline Verification:** An automated testing pipeline that transpiles Mini-Python files, executes `tsc` directly on generated TypeScript files, and asserts zero type errors.
3. **Advanced Emitter Features:** Emit comprehensive module imports and exports.
4. **Final Research Manuscript:** Complete the IEEE-format publication manuscript entitled *"Static Type Inference and Code Generation for Python-to-TypeScript Source-to-Source Compilation"*.
