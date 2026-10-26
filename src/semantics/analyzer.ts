import {
  SemanticError,
  TypeError,
} from '../errors/diagnostic.js';
import {
  ArrayLiteral,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  Expression,
  FunctionDeclaration,
  Identifier,
  IfStatement,
  IndexExpression,
  SliceExpression,
  ListComprehension,
  Program,
  ReturnStatement,
  Statement,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
} from '../parser/ast.js';
import { Scope } from './symbolTable.js';
import {
  BOOLEAN_TYPE,
  createArrayType,
  createFunctionType,
  createTypeVar,
  createUnionType,
  FunctionType,
  NULL_TYPE,
  NUMBER_TYPE,
  prune,
  resetTypeVarCounter,
  STRING_TYPE,
  Type,
  typesAreEqual,
  typeToString,
  TypeVar,
  unionSubtract,
  VOID_TYPE,
} from './types.js';
import { unify } from './unifier.js';

interface FunctionContext {
  name: string;
  returnType: Type;
  hasReturnStatement: boolean;
}

export class SemanticAnalyzer {
  private readonly rootScope: Scope;
  private currentScope: Scope;
  private currentFunction: FunctionContext | null = null;
  private readonly functionTypes = new Map<string, FunctionType>();

  constructor() {
    this.rootScope = new Scope('global', 'global');
    this.currentScope = this.rootScope;
  }

  public analyze(program: Program): { rootScope: Scope; program: Program } {
    resetTypeVarCounter();

    // Pass 1: Function signature registration (hoisting function declarations)
    for (const stmt of program.body) {
      if (stmt.type === 'FunctionDeclaration') {
        this.registerFunctionSignature(stmt);
      }
    }

    // Pass 2: Semantic analysis and bidirectional constraint propagation
    for (const stmt of program.body) {
      this.analyzeStatement(stmt);
    }

    // Pass 3: Finalize and decorate AST nodes with resolved types
    this.decorateProgram(program);

    return { rootScope: this.rootScope, program };
  }

  private registerFunctionSignature(fn: FunctionDeclaration): void {
    if (this.rootScope.hasCurrent(fn.id.name)) {
      throw new SemanticError(
        `Duplicate identifier '${fn.id.name}' already declared in current scope`,
        fn.id.loc.start
      );
    }

    const paramTypes: TypeVar[] = fn.params.map((param) =>
      createTypeVar(`Param_${param.name}_`)
    );
    const returnType: TypeVar = createTypeVar(`Ret_${fn.id.name}_`);
    const fnType = createFunctionType(paramTypes, returnType);

    this.functionTypes.set(fn.id.name, fnType);
    this.rootScope.define({
      name: fn.id.name,
      kind: 'function',
      type: fnType,
      loc: fn.id.loc,
      isMutable: false,
    });
  }

  private analyzeStatement(stmt: Statement): void {
    switch (stmt.type) {
      case 'VariableDeclaration':
        this.analyzeVariableDeclaration(stmt);
        break;
      case 'IfStatement':
        this.analyzeIfStatement(stmt);
        break;
      case 'WhileStatement':
        this.analyzeWhileStatement(stmt);
        break;
      case 'FunctionDeclaration':
        this.analyzeFunctionDeclaration(stmt);
        break;
      case 'ReturnStatement':
        this.analyzeReturnStatement(stmt);
        break;
      case 'BlockStatement':
        this.analyzeBlockStatement(stmt);
        break;
      case 'ExpressionStatement':
        this.inferExpression(stmt.expression);
        break;
    }
  }

  private analyzeVariableDeclaration(stmt: VariableDeclaration): void {
    const initType = this.inferExpression(stmt.init);
    const existing = this.currentScope.resolve(stmt.id.name);

    if (existing) {
      // Reassignment:
      // Try unifying. If incompatible, widen existing.type to a UnionType!
      try {
        unify(existing.type, initType);
      } catch {
        existing.type = createUnionType([existing.type, initType]);
      }
      existing.isMutable = true;
      existing.currentType = initType;
      if (existing.declarationNode) {
        existing.declarationNode.isConst = false;
        existing.declarationNode.inferredType = typeToString(prune(existing.type));
      }
      stmt.isConst = false;
      stmt.inferredType = typeToString(prune(existing.type));
    } else {
      // Initial declaration in current scope
      stmt.isConst = true;
      this.currentScope.define({
        name: stmt.id.name,
        kind: 'variable',
        type: initType,
        currentType: initType,
        loc: stmt.id.loc,
        isMutable: false,
        declarationNode: stmt,
      });
      stmt.inferredType = typeToString(prune(initType));
    }
  }

  private extractTypeGuard(
    test: Expression
  ): { targetName: string; narrowedConsequent: Type; narrowedAlternate?: Type } | null {
    if (test.type === 'CallExpression') {
      if (
        test.callee.type === 'Identifier' &&
        test.callee.name === 'isinstance' &&
        test.arguments.length === 2 &&
        test.arguments[0]?.type === 'Identifier' &&
        test.arguments[1]?.type === 'Identifier'
      ) {
        const targetName = test.arguments[0].name;
        const typeName = test.arguments[1].name;
        let targetType: Type | null = null;
        if (typeName === 'int') targetType = NUMBER_TYPE;
        else if (typeName === 'str') targetType = STRING_TYPE;
        else if (typeName === 'bool') targetType = BOOLEAN_TYPE;

        if (targetType) {
          const sym = this.currentScope.resolve(targetName);
          if (sym) {
            const pSym = prune(sym.type);
            if (pSym.kind === 'typevar') {
              pSym.guardedTypes = pSym.guardedTypes ?? [];
              pSym.guardedTypes.push(targetType);
            }
          }
          const currentType = sym ? (sym.currentType ?? sym.type) : targetType;
          return {
            targetName,
            narrowedConsequent: targetType,
            narrowedAlternate: unionSubtract(currentType, targetType),
          };
        }
      }
    }

    if (test.type === 'BinaryExpression') {
      if (test.operator === 'is not') {
        if (test.left.type === 'Identifier' && test.right.type === 'NoneLiteral') {
          const targetName = test.left.name;
          const sym = this.currentScope.resolve(targetName);
          const currentType = sym ? sym.type : NULL_TYPE;
          return {
            targetName,
            narrowedConsequent: unionSubtract(currentType, NULL_TYPE),
            narrowedAlternate: NULL_TYPE,
          };
        }
        if (test.right.type === 'Identifier' && test.left.type === 'NoneLiteral') {
          const targetName = test.right.name;
          const sym = this.currentScope.resolve(targetName);
          const currentType = sym ? sym.type : NULL_TYPE;
          return {
            targetName,
            narrowedConsequent: unionSubtract(currentType, NULL_TYPE),
            narrowedAlternate: NULL_TYPE,
          };
        }
      }

      if (test.operator === 'is') {
        if (test.left.type === 'Identifier' && test.right.type === 'NoneLiteral') {
          const targetName = test.left.name;
          const sym = this.currentScope.resolve(targetName);
          const currentType = sym ? sym.type : NULL_TYPE;
          return {
            targetName,
            narrowedConsequent: NULL_TYPE,
            narrowedAlternate: unionSubtract(currentType, NULL_TYPE),
          };
        }
        if (test.right.type === 'Identifier' && test.left.type === 'NoneLiteral') {
          const targetName = test.right.name;
          const sym = this.currentScope.resolve(targetName);
          const currentType = sym ? sym.type : NULL_TYPE;
          return {
            targetName,
            narrowedConsequent: NULL_TYPE,
            narrowedAlternate: unionSubtract(currentType, NULL_TYPE),
          };
        }
      }
    }

    if (test.type === 'UnaryExpression' && test.operator === 'not') {
      const inner = this.extractTypeGuard(test.argument);
      if (inner) {
        return {
          targetName: inner.targetName,
          narrowedConsequent: inner.narrowedAlternate ?? inner.narrowedConsequent,
          narrowedAlternate: inner.narrowedConsequent,
        };
      }
    }

    return null;
  }

  private analyzeIfStatement(stmt: IfStatement): void {
    const testType = this.inferExpression(stmt.test);
    try {
      unify(testType, BOOLEAN_TYPE);
    } catch {
      throw new TypeError(
        `If condition guard expression must evaluate to 'boolean', found '${typeToString(
          testType
        )}'`,
        stmt.test.loc.start
      );
    }

    const guard = this.extractTypeGuard(stmt.test);

    const previousScope = this.currentScope;
    const consequentScope = this.currentScope.createChildScope('block:if_consequent', 'block');
    if (guard) {
      consequentScope.narrow(guard.targetName, guard.narrowedConsequent);
    }
    this.currentScope = consequentScope;
    this.analyzeBlockStatement(stmt.consequent);
    this.currentScope = previousScope;

    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        this.analyzeIfStatement(stmt.alternate);
      } else {
        const altScope = this.currentScope.createChildScope('block:if_alternate', 'block');
        if (guard && guard.narrowedAlternate) {
          altScope.narrow(guard.targetName, guard.narrowedAlternate);
        }
        this.currentScope = altScope;
        this.analyzeBlockStatement(stmt.alternate);
        this.currentScope = previousScope;
      }
    }
  }

  private analyzeWhileStatement(stmt: WhileStatement): void {
    const testType = this.inferExpression(stmt.test);
    try {
      unify(testType, BOOLEAN_TYPE);
    } catch {
      throw new TypeError(
        `While loop termination condition must evaluate to 'boolean', found '${typeToString(
          testType
        )}'`,
        stmt.test.loc.start
      );
    }

    const previousScope = this.currentScope;
    const loopScope = this.currentScope.createChildScope('loop:while', 'loop');
    this.currentScope = loopScope;
    this.analyzeBlockStatement(stmt.body);

    // Verify loop condition invariant holds at back-edge
    this.inferExpression(stmt.test);

    this.currentScope = previousScope;
  }

  private analyzeFunctionDeclaration(stmt: FunctionDeclaration): void {
    const fnType = this.functionTypes.get(stmt.id.name);
    if (!fnType) {
      throw new SemanticError(
        `Internal error: function '${stmt.id.name}' signature not found`,
        stmt.id.loc.start
      );
    }

    const previousScope = this.currentScope;
    const fnScope = this.currentScope.createChildScope(`function:${stmt.id.name}`, 'function');
    this.currentScope = fnScope;

    const previousFnContext = this.currentFunction;
    this.currentFunction = {
      name: stmt.id.name,
      returnType: fnType.returnType,
      hasReturnStatement: false,
    };

    // Define parameters in function scope
    for (let i = 0; i < stmt.params.length; i++) {
      const paramNode = stmt.params[i]!;
      const paramType = fnType.paramTypes[i]!;
      fnScope.define({
        name: paramNode.name,
        kind: 'parameter',
        type: paramType,
        loc: paramNode.loc,
        isMutable: false,
      });
    }

    // Analyze function body
    for (const bodyStmt of stmt.body.body) {
      this.analyzeStatement(bodyStmt);
    }

    // If no return statement occurred, unify return type with void
    if (!this.currentFunction.hasReturnStatement) {
      try {
        unify(fnType.returnType, VOID_TYPE);
      } catch {
        throw new TypeError(
          `Function '${stmt.id.name}' must return a value of type '${typeToString(
            fnType.returnType
          )}'`,
          stmt.loc.end
        );
      }
    }

    this.currentFunction = previousFnContext;
    this.currentScope = previousScope;
  }

  private analyzeReturnStatement(stmt: ReturnStatement): void {
    if (!this.currentFunction) {
      throw new SemanticError("'return' statement outside of function", stmt.loc.start);
    }

    this.currentFunction.hasReturnStatement = true;

    if (stmt.argument) {
      const returnExprType = this.inferExpression(stmt.argument);
      try {
        unify(this.currentFunction.returnType, returnExprType);
      } catch {
        this.currentFunction.returnType = createUnionType([
          this.currentFunction.returnType,
          returnExprType,
        ]);
        const fnType = this.functionTypes.get(this.currentFunction.name);
        if (fnType) {
          fnType.returnType = this.currentFunction.returnType;
        }
      }
    } else {
      try {
        unify(this.currentFunction.returnType, VOID_TYPE);
      } catch {
        this.currentFunction.returnType = createUnionType([
          this.currentFunction.returnType,
          VOID_TYPE,
        ]);
        const fnType = this.functionTypes.get(this.currentFunction.name);
        if (fnType) {
          fnType.returnType = this.currentFunction.returnType;
        }
      }
    }
  }

  private analyzeBlockStatement(block: BlockStatement): void {
    for (const stmt of block.body) {
      this.analyzeStatement(stmt);
    }
  }

  // --- Expression Type Inference ---

  public inferExpression(expr: Expression): Type {
    switch (expr.type) {
      case 'NumericLiteral':
        return NUMBER_TYPE;
      case 'StringLiteral':
        return STRING_TYPE;
      case 'BooleanLiteral':
        return BOOLEAN_TYPE;
      case 'NoneLiteral':
        return NULL_TYPE;
      case 'Identifier':
        return this.inferIdentifier(expr);
      case 'ArrayLiteral':
        return this.inferArrayLiteral(expr);
      case 'ListComprehension':
        return this.inferListComprehension(expr);
      case 'IndexExpression':
        return this.inferIndexExpression(expr);
      case 'SliceExpression':
        return this.inferSliceExpression(expr);
      case 'CallExpression':
        return this.inferCallExpression(expr);
      case 'UnaryExpression':
        return this.inferUnaryExpression(expr);
      case 'BinaryExpression':
        return this.inferBinaryExpression(expr);
    }
  }

  private inferIdentifier(expr: Identifier): Type {
    const symbol = this.currentScope.resolve(expr.name);
    if (!symbol) {
      throw new SemanticError(`Undefined identifier '${expr.name}'`, expr.loc.start);
    }
    return symbol.currentType ?? symbol.type;
  }

  private inferArrayLiteral(expr: ArrayLiteral): Type {
    if (expr.elements.length === 0) {
      const elemType = createTypeVar('Elem_');
      return createArrayType(elemType);
    }

    const firstElemType = this.inferExpression(expr.elements[0]!);

    for (let i = 1; i < expr.elements.length; i++) {
      const elem = expr.elements[i]!;
      const elemType = this.inferExpression(elem);
      try {
        unify(firstElemType, elemType);
      } catch {
        throw new TypeError(
          `Heterogeneous array literals are not allowed; expected element of type '${typeToString(
            firstElemType
          )}', found '${typeToString(elemType)}'`,
          elem.loc.start
        );
      }
    }

    return createArrayType(firstElemType);
  }

  private inferIndexExpression(expr: IndexExpression): Type {
    const objectType = prune(this.inferExpression(expr.object));
    const indexType = prune(this.inferExpression(expr.index));

    if (objectType.kind === 'union') {
      throw new TypeError(
        `Cannot index into union type '${typeToString(objectType)}'. Narrow the type using isinstance() first.`,
        expr.object.loc.start
      );
    }

    try {
      unify(indexType, NUMBER_TYPE);
    } catch {
      throw new TypeError(
        `Array index must be of type 'number', found '${typeToString(indexType)}'`,
        expr.index.loc.start
      );
    }

    if (objectType.kind === 'array') {
      return objectType.elementType;
    }

    if (objectType.kind === 'primitive' && objectType.name === 'string') {
      return STRING_TYPE;
    }

    if (objectType.kind === 'typevar') {
      const elemVar = createTypeVar('Elem_');
      unify(objectType, createArrayType(elemVar));
      return elemVar;
    }

    throw new TypeError(
      `Cannot index into non-array value of type '${typeToString(objectType)}'`,
      expr.object.loc.start
    );
  }

  private inferSliceExpression(expr: SliceExpression): Type {
    const objectType = prune(this.inferExpression(expr.object));

    if (objectType.kind === 'union') {
      throw new TypeError(
        `Cannot slice union type '${typeToString(objectType)}'. Narrow the type using isinstance() first.`,
        expr.object.loc.start
      );
    }

    if (expr.start) {
      const startType = prune(this.inferExpression(expr.start));
      try {
        unify(startType, NUMBER_TYPE);
      } catch {
        throw new TypeError(
          `Slice start must be of type 'number', found '${typeToString(startType)}'`,
          expr.start.loc.start
        );
      }
    }

    if (expr.stop) {
      const stopType = prune(this.inferExpression(expr.stop));
      try {
        unify(stopType, NUMBER_TYPE);
      } catch {
        throw new TypeError(
          `Slice stop must be of type 'number', found '${typeToString(stopType)}'`,
          expr.stop.loc.start
        );
      }
    }

    if (expr.step) {
      const stepType = prune(this.inferExpression(expr.step));
      try {
        unify(stepType, NUMBER_TYPE);
      } catch {
        throw new TypeError(
          `Slice step must be of type 'number', found '${typeToString(stepType)}'`,
          expr.step.loc.start
        );
      }
    }

    let resultType: Type;
    if (objectType.kind === 'array') {
      resultType = objectType;
    } else if (objectType.kind === 'primitive' && objectType.name === 'string') {
      resultType = STRING_TYPE;
    } else if (objectType.kind === 'typevar') {
      const elemVar = createTypeVar('Elem_');
      const arrType = createArrayType(elemVar);
      unify(objectType, arrType);
      resultType = arrType;
    } else {
      throw new TypeError(
        `Type '${typeToString(objectType)}' does not support slicing`,
        expr.object.loc.start
      );
    }

    expr.inferredResultType = typeToString(prune(resultType));
    return resultType;
  }

  private inferListComprehension(expr: ListComprehension): Type {
    const previousScope = this.currentScope;
    const compScope = this.currentScope.createChildScope('comprehension', 'block');
    this.currentScope = compScope;

    try {
      for (const clause of expr.clauses) {
        const iterType = prune(this.inferExpression(clause.iter));

        if (iterType.kind === 'union') {
          throw new TypeError(
            `Cannot iterate over un-narrowed union type '${typeToString(iterType)}'. Narrow the type first.`,
            clause.iter.loc.start
          );
        }

        let elemType: Type;
        if (iterType.kind === 'array') {
          elemType = iterType.elementType;
        } else if (iterType.kind === 'primitive' && iterType.name === 'string') {
          elemType = STRING_TYPE;
        } else if (iterType.kind === 'typevar') {
          const elemVar = createTypeVar('Elem_');
          unify(iterType, createArrayType(elemVar));
          elemType = elemVar;
        } else {
          throw new TypeError(
            `Type '${typeToString(iterType)}' is not iterable in list comprehension`,
            clause.iter.loc.start
          );
        }

        compScope.define({
          name: clause.target.name,
          kind: 'variable',
          type: elemType,
          currentType: elemType,
          loc: clause.target.loc,
          isMutable: false,
        });

        for (const ifExpr of clause.ifs) {
          const testType = this.inferExpression(ifExpr);
          try {
            unify(testType, BOOLEAN_TYPE);
          } catch {
            throw new TypeError(
              `List comprehension filter condition must evaluate to 'boolean', found '${typeToString(testType)}'`,
              ifExpr.loc.start
            );
          }

          const guard = this.extractTypeGuard(ifExpr);
          if (guard) {
            compScope.narrow(guard.targetName, guard.narrowedConsequent);
          }
        }
      }

      const elementResultType = prune(this.inferExpression(expr.element));
      expr.inferredElementType = typeToString(elementResultType);
      return createArrayType(elementResultType);
    } finally {
      this.currentScope = previousScope;
    }
  }

  private inferCallExpression(expr: CallExpression): Type {
    // Special handling for built-in print
    if (expr.callee.type === 'Identifier' && expr.callee.name === 'print') {
      for (const arg of expr.arguments) {
        this.inferExpression(arg);
      }
      return VOID_TYPE;
    }

    // Special handling for built-in isinstance
    if (expr.callee.type === 'Identifier' && expr.callee.name === 'isinstance') {
      if (expr.arguments.length !== 2) {
        throw new TypeError('isinstance() takes exactly 2 arguments', expr.loc.start);
      }
      this.inferExpression(expr.arguments[0]!);
      return BOOLEAN_TYPE;
    }

    const calleeType = prune(this.inferExpression(expr.callee));

    if (calleeType.kind === 'typevar') {
      const argTypes = expr.arguments.map((arg) => this.inferExpression(arg));
      const retType = createTypeVar('CallRet_');
      const fnType = createFunctionType(argTypes, retType);
      unify(calleeType, fnType);
      return retType;
    }

    if (calleeType.kind !== 'function') {
      throw new TypeError(
        `Expression of type '${typeToString(calleeType)}' is not callable`,
        expr.callee.loc.start
      );
    }

    if (expr.arguments.length !== calleeType.paramTypes.length) {
      const calleeName =
        expr.callee.type === 'Identifier' ? expr.callee.name : 'function';
      throw new TypeError(
        `Function '${calleeName}' expects ${calleeType.paramTypes.length} arguments, but received ${expr.arguments.length}`,
        expr.loc.start
      );
    }

    for (let i = 0; i < expr.arguments.length; i++) {
      const argNode = expr.arguments[i]!;
      const paramType = calleeType.paramTypes[i]!;
      const argType = this.inferExpression(argNode);

      try {
        unify(paramType, argType);
      } catch {
        const pParam = prune(paramType);
        if (pParam.guardedTypes && pParam.guardedTypes.length > 0) {
          const widened = createUnionType([pParam, argType]);
          if (widened.kind === 'union') {
            widened.guardedTypes = pParam.guardedTypes;
          }
          calleeType.paramTypes[i] = widened;
          if (typesAreEqual(calleeType.returnType, pParam)) {
            calleeType.returnType = widened;
          }

          const calleeIdent = expr.callee.type === 'Identifier' ? expr.callee.name : null;
          const origFn = calleeIdent ? this.functionTypes.get(calleeIdent) : null;
          if (origFn) {
            origFn.paramTypes[i] = widened;
            if (typesAreEqual(origFn.returnType, pParam)) {
              origFn.returnType = widened;
            }
          }
          continue;
        }

        const calleeName =
          expr.callee.type === 'Identifier' ? expr.callee.name : 'function';
        throw new TypeError(
          `Argument ${i + 1} type mismatch for '${calleeName}': expected '${typeToString(
            paramType
          )}', found '${typeToString(argType)}'`,
          argNode.loc.start
        );
      }
    }

    return calleeType.returnType;
  }

  private inferUnaryExpression(expr: UnaryExpression): Type {
    const argType = this.inferExpression(expr.argument);

    if (expr.operator === '-' || expr.operator === '+') {
      try {
        unify(argType, NUMBER_TYPE);
      } catch {
        throw new TypeError(
          `Unary operator '${expr.operator}' requires 'number' operand, found '${typeToString(
            argType
          )}'`,
          expr.argument.loc.start
        );
      }
      return NUMBER_TYPE;
    }

    if (expr.operator === 'not') {
      try {
        unify(argType, BOOLEAN_TYPE);
      } catch {
        throw new TypeError(
          `Unary 'not' operator requires 'boolean' operand, found '${typeToString(
            argType
          )}'`,
          expr.argument.loc.start
        );
      }
      return BOOLEAN_TYPE;
    }

    throw new TypeError(`Unknown unary operator '${expr.operator}'`, expr.loc.start);
  }

  private inferBinaryExpression(expr: BinaryExpression): Type {
    const leftType = this.inferExpression(expr.left);
    const rightType = this.inferExpression(expr.right);

    switch (expr.operator) {
      case '+': {
        const prunedL = prune(leftType);
        const prunedR = prune(rightType);

        if (prunedL.kind === 'union' || prunedR.kind === 'union') {
          const unionT = prunedL.kind === 'union' ? prunedL : prunedR;
          throw new TypeError(
            `Operator '+' cannot be applied to union type '${typeToString(
              unionT
            )}'. Narrow the type using isinstance() first.`,
            expr.loc.start
          );
        }

        if (
          (prunedL.kind === 'primitive' && prunedL.name === 'string') ||
          (prunedR.kind === 'primitive' && prunedR.name === 'string')
        ) {
          try {
            unify(leftType, STRING_TYPE);
            unify(rightType, STRING_TYPE);
          } catch {
            throw new TypeError(
              `Binary '+' cannot concatenate '${typeToString(leftType)}' and '${typeToString(
                rightType
              )}'`,
              expr.loc.start
            );
          }
          return STRING_TYPE;
        }

        try {
          unify(leftType, NUMBER_TYPE);
          unify(rightType, NUMBER_TYPE);
        } catch {
          throw new TypeError(
            `Binary '+' cannot add '${typeToString(leftType)}' and '${typeToString(
              rightType
            )}'`,
            expr.loc.start
          );
        }
        return NUMBER_TYPE;
      }

      case '-':
      case '*':
      case '/':
      case '%': {
        const prunedL = prune(leftType);
        const prunedR = prune(rightType);

        if (prunedL.kind === 'union' || prunedR.kind === 'union') {
          const unionT = prunedL.kind === 'union' ? prunedL : prunedR;
          throw new TypeError(
            `Binary operator '${expr.operator}' cannot be applied to union type '${typeToString(
              unionT
            )}'. Narrow the type using isinstance() first.`,
            expr.loc.start
          );
        }

        try {
          unify(leftType, NUMBER_TYPE);
          unify(rightType, NUMBER_TYPE);
        } catch {
          throw new TypeError(
            `Binary operator '${expr.operator}' requires operands of type 'number', found '${typeToString(
              leftType
            )}' and '${typeToString(rightType)}'`,
            expr.loc.start
          );
        }
        return NUMBER_TYPE;
      }

      case '<':
      case '<=':
      case '>':
      case '>=': {
        const prunedL = prune(leftType);
        const prunedR = prune(rightType);

        if (prunedL.kind === 'union' || prunedR.kind === 'union') {
          const unionT = prunedL.kind === 'union' ? prunedL : prunedR;
          throw new TypeError(
            `Comparison operator '${expr.operator}' cannot be applied to union type '${typeToString(
              unionT
            )}'. Narrow the type using isinstance() first.`,
            expr.loc.start
          );
        }

        try {
          unify(leftType, NUMBER_TYPE);
          unify(rightType, NUMBER_TYPE);
        } catch {
          throw new TypeError(
            `Comparison operator '${expr.operator}' requires operands of type 'number', found '${typeToString(
              leftType
            )}' and '${typeToString(rightType)}'`,
            expr.loc.start
          );
        }
        return BOOLEAN_TYPE;
      }

      case '==':
      case '!=': {
        try {
          unify(leftType, rightType);
        } catch {
          throw new TypeError(
            `Cannot compare incompatible types '${typeToString(
              leftType
            )}' and '${typeToString(rightType)}'`,
            expr.loc.start
          );
        }
        return BOOLEAN_TYPE;
      }

      case 'is':
      case 'is not': {
        return BOOLEAN_TYPE;
      }

      case 'and':
      case 'or': {
        try {
          unify(leftType, BOOLEAN_TYPE);
          unify(rightType, BOOLEAN_TYPE);
        } catch {
          throw new TypeError(
            `Logical operator '${expr.operator}' requires operands of type 'boolean', found '${typeToString(
              leftType
            )}' and '${typeToString(rightType)}'`,
            expr.loc.start
          );
        }
        return BOOLEAN_TYPE;
      }
    }
  }

  // --- Pass 3: AST Decoration ---

  private decorateProgram(program: Program): void {
    this.finalizeScopeSymbols(this.rootScope);

    for (const stmt of program.body) {
      this.decorateStatement(stmt);
    }
  }

  private finalizeScopeSymbols(scope: Scope): void {
    const prevScope = this.currentScope;
    this.currentScope = scope;

    for (const [, sym] of scope.getAllSymbols()) {
      if (sym.kind === 'variable' && sym.declarationNode) {
        if (sym.declarationNode.init) {
          try {
            const finalInitType = prune(this.inferExpression(sym.declarationNode.init));
            if (sym.isMutable) {
              sym.type = createUnionType([sym.type, finalInitType]);
            } else {
              sym.type = finalInitType;
            }
          } catch {
            // Retain existing type on error
          }
        }
        sym.declarationNode.inferredType = typeToString(prune(sym.type));
        sym.declarationNode.isConst = !sym.isMutable;
      }
    }
    for (const child of scope.children) {
      this.finalizeScopeSymbols(child);
    }

    this.currentScope = prevScope;
  }

  private decorateStatement(stmt: Statement): void {
    if (stmt.type === 'VariableDeclaration') {
      const sym = this.rootScope.resolve(stmt.id.name);
      if (sym) {
        stmt.inferredType = typeToString(prune(sym.type));
        stmt.isConst = !sym.isMutable;
      }
    } else if (stmt.type === 'FunctionDeclaration') {
      const fnType = this.functionTypes.get(stmt.id.name);
      if (fnType) {
        stmt.inferredReturnType = typeToString(fnType.returnType);
        stmt.inferredParamTypes = {};
        for (let i = 0; i < stmt.params.length; i++) {
          const param = stmt.params[i]!;
          const pType = fnType.paramTypes[i]!;
          stmt.inferredParamTypes[param.name] = typeToString(pType);
        }
      }
      for (const s of stmt.body.body) {
        this.decorateStatement(s);
      }
    } else if (stmt.type === 'IfStatement') {
      for (const s of stmt.consequent.body) {
        this.decorateStatement(s);
      }
      if (stmt.alternate) {
        if (stmt.alternate.type === 'IfStatement') {
          this.decorateStatement(stmt.alternate);
        } else {
          for (const s of stmt.alternate.body) {
            this.decorateStatement(s);
          }
        }
      }
    } else if (stmt.type === 'WhileStatement') {
      for (const s of stmt.body.body) {
        this.decorateStatement(s);
      }
    }
  }
}
