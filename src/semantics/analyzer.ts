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
  FunctionType,
  NUMBER_TYPE,
  prune,
  resetTypeVarCounter,
  STRING_TYPE,
  Type,
  typeToString,
  TypeVar,
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
      // Reassignment: enforce static invariant type
      try {
        unify(existing.type, initType);
      } catch {
        throw new TypeError(
          `Conflicting reassignment: variable '${stmt.id.name}' of static type '${typeToString(
            existing.type
          )}' cannot be reassigned with value of type '${typeToString(initType)}'`,
          stmt.id.loc.start
        );
      }
      existing.isMutable = true;
      stmt.inferredType = typeToString(prune(existing.type));
    } else {
      // Initial declaration in current scope
      this.currentScope.define({
        name: stmt.id.name,
        kind: 'variable',
        type: initType,
        loc: stmt.id.loc,
        isMutable: false,
      });
      stmt.inferredType = typeToString(prune(initType));
    }
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

    this.analyzeBlockStatement(stmt.consequent);

    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        this.analyzeIfStatement(stmt.alternate);
      } else {
        this.analyzeBlockStatement(stmt.alternate);
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

    this.analyzeBlockStatement(stmt.body);
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
        throw new TypeError(
          `Incompatible return type: expected '${typeToString(
            this.currentFunction.returnType
          )}', found '${typeToString(returnExprType)}'`,
          stmt.argument.loc.start
        );
      }
    } else {
      try {
        unify(this.currentFunction.returnType, VOID_TYPE);
      } catch {
        throw new TypeError(
          `Empty return statement in function expecting type '${typeToString(
            this.currentFunction.returnType
          )}'`,
          stmt.loc.start
        );
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
      case 'Identifier':
        return this.inferIdentifier(expr);
      case 'ArrayLiteral':
        return this.inferArrayLiteral(expr);
      case 'IndexExpression':
        return this.inferIndexExpression(expr);
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
    return symbol.type;
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

  private inferCallExpression(expr: CallExpression): Type {
    // Special handling for built-in print
    if (expr.callee.type === 'Identifier' && expr.callee.name === 'print') {
      for (const arg of expr.arguments) {
        this.inferExpression(arg);
      }
      return VOID_TYPE;
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
    for (const stmt of program.body) {
      this.decorateStatement(stmt);
    }
  }

  private decorateStatement(stmt: Statement): void {
    if (stmt.type === 'VariableDeclaration') {
      const sym = this.rootScope.resolve(stmt.id.name);
      if (sym) {
        stmt.inferredType = typeToString(sym.type);
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
