import {
  BinaryExpression,
  BlockStatement,
  CallExpression,
  Expression,
  FunctionDeclaration,
  IfStatement,
  SliceExpression,
  ListComprehension,
  Program,
  ReturnStatement,
  Statement,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
} from '../parser/ast.js';

export function toCamelCase(name: string): string {
  if (name === 'print') {
    return 'console.log';
  }
  if (!name.includes('_')) {
    return name;
  }
  return name.replace(/_([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase());
}

export interface EmitterOptions {
  moduleMode?: boolean;
}

export class TypeScriptEmitter {
  private indentLevel = 0;
  private scopeStack: Set<string>[] = [new Set()];
  private isModule = false;

  public emit(program: Program, options?: EmitterOptions): string {
    this.indentLevel = 0;
    this.scopeStack = [new Set()];
    this.isModule = Boolean(options?.moduleMode);
    const lines: string[] = [];

    for (let i = 0; i < program.body.length; i++) {
      const stmt = program.body[i]!;
      lines.push(this.emitStatement(stmt));
      // Add empty line between top-level statements for readability
      if (
        stmt.type === 'FunctionDeclaration' ||
        (i + 1 < program.body.length &&
          program.body[i + 1]!.type === 'FunctionDeclaration')
      ) {
        lines.push('');
      }
    }

    return lines.filter((l, idx, arr) => !(l === '' && arr[idx - 1] === '')).join('\n') + '\n';
  }

  private indent(): string {
    return '  '.repeat(this.indentLevel);
  }

  private isDeclared(name: string): boolean {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      if (this.scopeStack[i]!.has(name)) {
        return true;
      }
    }
    return false;
  }

  private declareVariable(name: string): void {
    const current = this.scopeStack[this.scopeStack.length - 1]!;
    current.add(name);
  }

  private enterScope(): void {
    this.scopeStack.push(new Set());
  }

  private exitScope(): void {
    this.scopeStack.pop();
  }

  public emitStatement(stmt: Statement): string {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return this.emitVariableDeclaration(stmt);
      case 'FunctionDeclaration':
        return this.emitFunctionDeclaration(stmt);
      case 'IfStatement':
        return this.emitIfStatement(stmt);
      case 'WhileStatement':
        return this.emitWhileStatement(stmt);
      case 'ReturnStatement':
        return this.emitReturnStatement(stmt);
      case 'BlockStatement':
        return this.emitBlockStatement(stmt);
      case 'ExpressionStatement':
        return `${this.indent()}${this.emitExpression(stmt.expression)};`;
    }
  }

  private emitVariableDeclaration(stmt: VariableDeclaration): string {
    const rawName = stmt.id.name;
    const camelName = toCamelCase(rawName);
    const initCode = this.emitExpression(stmt.init);

    if (this.isDeclared(rawName)) {
      // Reassignment
      return `${this.indent()}${camelName} = ${initCode};`;
    }

    // Initial declaration
    this.declareVariable(rawName);
    const typeSig = stmt.inferredType ? `: ${stmt.inferredType}` : '';
    const keyword = stmt.isConst ? 'const' : 'let';
    const isTopLevel = this.scopeStack.length === 1;
    const exportPrefix = this.isModule && isTopLevel && stmt.isConst ? 'export ' : '';
    return `${this.indent()}${exportPrefix}${keyword} ${camelName}${typeSig} = ${initCode};`;
  }

  private emitFunctionDeclaration(stmt: FunctionDeclaration): string {
    const fnName = toCamelCase(stmt.id.name);
    const isTopLevel = this.scopeStack.length === 1;
    const exportPrefix = this.isModule && isTopLevel ? 'export ' : '';
    this.declareVariable(stmt.id.name);

    this.enterScope();
    const typedParams = stmt.params.map((param) => {
      this.declareVariable(param.name);
      const paramName = toCamelCase(param.name);
      const pType = stmt.inferredParamTypes?.[param.name] ?? 'number';
      return `${paramName}: ${pType}`;
    });

    const retType = stmt.inferredReturnType ?? 'void';
    const header = `${this.indent()}${exportPrefix}function ${fnName}(${typedParams.join(', ')}): ${retType} {`;

    this.indentLevel++;
    const bodyLines = stmt.body.body.map((s) => this.emitStatement(s));
    this.indentLevel--;
    this.exitScope();

    if (bodyLines.length === 0) {
      return `${header}\n${this.indent()}}`;
    }

    return `${header}\n${bodyLines.join('\n')}\n${this.indent()}}`;
  }

  private emitIfStatement(stmt: IfStatement): string {
    const testCode = this.emitExpression(stmt.test);
    let output = `${this.indent()}if (${testCode}) {\n`;

    this.enterScope();
    this.indentLevel++;
    const consLines = stmt.consequent.body.map((s) => this.emitStatement(s));
    output += consLines.join('\n') + '\n';
    this.indentLevel--;
    this.exitScope();

    output += `${this.indent()}}`;

    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        const elifCode = this.emitIfStatement(stmt.alternate).trimStart();
        output += ` else ${elifCode}`;
      } else {
        output += ` else {\n`;
        this.enterScope();
        this.indentLevel++;
        const altLines = stmt.alternate.body.map((s) => this.emitStatement(s));
        output += altLines.join('\n') + '\n';
        this.indentLevel--;
        this.exitScope();
        output += `${this.indent()}}`;
      }
    }

    return output;
  }

  private emitWhileStatement(stmt: WhileStatement): string {
    const testCode = this.emitExpression(stmt.test);
    let output = `${this.indent()}while (${testCode}) {\n`;

    this.enterScope();
    this.indentLevel++;
    const bodyLines = stmt.body.body.map((s) => this.emitStatement(s));
    output += bodyLines.join('\n') + '\n';
    this.indentLevel--;
    this.exitScope();

    output += `${this.indent()}}`;
    return output;
  }

  private emitReturnStatement(stmt: ReturnStatement): string {
    if (!stmt.argument) {
      return `${this.indent()}return;`;
    }
    return `${this.indent()}return ${this.emitExpression(stmt.argument)};`;
  }

  private emitBlockStatement(stmt: BlockStatement): string {
    this.enterScope();
    this.indentLevel++;
    const lines = stmt.body.map((s) => this.emitStatement(s));
    this.indentLevel--;
    this.exitScope();
    return lines.join('\n');
  }

  public emitExpression(expr: Expression): string {
    switch (expr.type) {
      case 'NumericLiteral':
        return String(expr.value);
      case 'StringLiteral':
        return JSON.stringify(expr.value);
      case 'BooleanLiteral':
        return expr.value ? 'true' : 'false';
      case 'NoneLiteral':
        return 'null';
      case 'Identifier':
        return toCamelCase(expr.name);
      case 'ArrayLiteral':
        return `[${expr.elements.map((e) => this.emitExpression(e)).join(', ')}]`;
      case 'IndexExpression': {
        const isNegative =
          (expr.index.type === 'UnaryExpression' && expr.index.operator === '-') ||
          (expr.index.type === 'NumericLiteral' && expr.index.value < 0);
        if (isNegative) {
          return `${this.emitExpression(expr.object)}.at(${this.emitExpression(expr.index)})!`;
        }
        return `${this.emitExpression(expr.object)}[${this.emitExpression(expr.index)}]`;
      }
      case 'SliceExpression':
        return this.emitSliceExpression(expr);
      case 'ListComprehension':
        return this.emitListComprehension(expr);
      case 'UnaryExpression':
        return this.emitUnaryExpression(expr);
      case 'BinaryExpression':
        return this.emitBinaryExpression(expr);
      case 'CallExpression':
        return this.emitCallExpression(expr);
    }
  }

  private emitSliceExpression(expr: SliceExpression): string {
    const obj = this.emitExpression(expr.object);

    if (!expr.step) {
      if (expr.start && expr.stop) {
        return `${obj}.slice(${this.emitExpression(expr.start)}, ${this.emitExpression(expr.stop)})`;
      } else if (expr.start) {
        return `${obj}.slice(${this.emitExpression(expr.start)})`;
      } else if (expr.stop) {
        return `${obj}.slice(0, ${this.emitExpression(expr.stop)})`;
      } else {
        return `${obj}.slice()`;
      }
    }

    const isStepMinusOne =
      (expr.step.type === 'UnaryExpression' &&
        expr.step.operator === '-' &&
        expr.step.argument.type === 'NumericLiteral' &&
        expr.step.argument.value === 1) ||
      (expr.step.type === 'NumericLiteral' && expr.step.value === -1);

    if (isStepMinusOne) {
      if (expr.start && expr.stop) {
        return `${obj}.slice(${this.emitExpression(expr.start)}, ${this.emitExpression(expr.stop)}).reverse()`;
      } else if (expr.start) {
        return `${obj}.slice(${this.emitExpression(expr.start)}).reverse()`;
      } else if (expr.stop) {
        return `${obj}.slice(0, ${this.emitExpression(expr.stop)}).reverse()`;
      } else {
        if (expr.inferredResultType === 'string') {
          return `${obj}.split('').reverse().join('')`;
        }
        return `${obj}.slice().reverse()`;
      }
    }

    const stepStr = this.emitExpression(expr.step);
    let baseSlice: string;
    if (expr.start && expr.stop) {
      baseSlice = `${obj}.slice(${this.emitExpression(expr.start)}, ${this.emitExpression(expr.stop)})`;
    } else if (expr.start) {
      baseSlice = `${obj}.slice(${this.emitExpression(expr.start)})`;
    } else if (expr.stop) {
      baseSlice = `${obj}.slice(0, ${this.emitExpression(expr.stop)})`;
    } else {
      baseSlice = `${obj}.slice()`;
    }

    if (expr.inferredResultType === 'string') {
      return `${baseSlice}.split('').filter((_, i) => i % (${stepStr}) === 0).join('')`;
    }
    return `${baseSlice}.filter((_, i) => i % (${stepStr}) === 0)`;
  }

  private emitListComprehension(expr: ListComprehension): string {
    if (expr.clauses.length === 1) {
      const clause = expr.clauses[0]!;
      const targetName = toCamelCase(clause.target.name);
      const iterStr = this.emitExpression(clause.iter);

      if (clause.ifs.length === 0) {
        return `${iterStr}.map((${targetName}) => ${this.emitExpression(expr.element)})`;
      }

      const filterPred = this.emitFilterPredicate(targetName, clause.ifs);
      return `${iterStr}.filter(${filterPred}).map((${targetName}) => ${this.emitExpression(expr.element)})`;
    }

    let inner = '';
    for (let i = expr.clauses.length - 1; i >= 0; i--) {
      const clause = expr.clauses[i]!;
      const targetName = toCamelCase(clause.target.name);
      const iterStr = this.emitExpression(clause.iter);

      if (i === expr.clauses.length - 1) {
        if (clause.ifs.length === 0) {
          inner = `${iterStr}.map((${targetName}) => ${this.emitExpression(expr.element)})`;
        } else {
          const filterPred = this.emitFilterPredicate(targetName, clause.ifs);
          inner = `${iterStr}.filter(${filterPred}).map((${targetName}) => ${this.emitExpression(expr.element)})`;
        }
      } else {
        if (clause.ifs.length === 0) {
          inner = `${iterStr}.flatMap((${targetName}) => ${inner})`;
        } else {
          const filterPred = this.emitFilterPredicate(targetName, clause.ifs);
          inner = `${iterStr}.filter(${filterPred}).flatMap((${targetName}) => ${inner})`;
        }
      }
    }
    return inner;
  }

  private emitFilterPredicate(targetName: string, ifs: Expression[]): string {
    const filterConditions = ifs.map((cond) => this.emitExpression(cond)).join(' && ');

    for (const cond of ifs) {
      if (
        cond.type === 'CallExpression' &&
        cond.callee.type === 'Identifier' &&
        cond.callee.name === 'isinstance' &&
        cond.arguments.length === 2 &&
        cond.arguments[0]?.type === 'Identifier' &&
        toCamelCase(cond.arguments[0].name) === targetName &&
        cond.arguments[1]?.type === 'Identifier'
      ) {
        const typeName = cond.arguments[1].name;
        let tsType = '';
        if (typeName === 'int') tsType = 'number';
        else if (typeName === 'str') tsType = 'string';
        else if (typeName === 'bool') tsType = 'boolean';
        if (tsType) {
          return `(${targetName}): ${targetName} is ${tsType} => ${filterConditions}`;
        }
      }
    }

    return `(${targetName}) => ${filterConditions}`;
  }

  private emitUnaryExpression(expr: UnaryExpression): string {
    const op = expr.operator === 'not' ? '!' : expr.operator;
    const arg = this.emitExpression(expr.argument);
    return `${op}${arg}`;
  }

  private emitBinaryExpression(expr: BinaryExpression): string {
    const left = this.emitExpression(expr.left);
    const right = this.emitExpression(expr.right);

    let op: string = expr.operator;
    if (expr.operator === 'and') op = '&&';
    else if (expr.operator === 'or') op = '||';
    else if (expr.operator === '==') op = '===';
    else if (expr.operator === '!=') op = '!==';
    else if (expr.operator === 'is') op = '===';
    else if (expr.operator === 'is not') op = '!==';

    return `${left} ${op} ${right}`;
  }

  private emitCallExpression(expr: CallExpression): string {
    if (expr.callee.type === 'Identifier' && expr.callee.name === 'print') {
      const args = expr.arguments.map((a) => this.emitExpression(a)).join(', ');
      return `console.log(${args})`;
    }

    if (expr.callee.type === 'Identifier' && expr.callee.name === 'isinstance') {
      const target = this.emitExpression(expr.arguments[0]!);
      const typeArg = expr.arguments[1];
      const typeName = typeArg && typeArg.type === 'Identifier' ? typeArg.name : '';
      let tsType = 'object';
      if (typeName === 'int') tsType = 'number';
      else if (typeName === 'str') tsType = 'string';
      else if (typeName === 'bool') tsType = 'boolean';
      return `typeof ${target} === "${tsType}"`;
    }

    const calleeCode = this.emitExpression(expr.callee);
    const args = expr.arguments.map((a) => this.emitExpression(a)).join(', ');
    return `${calleeCode}(${args})`;
  }
}

export function emitTypeScript(program: Program, options?: EmitterOptions): string {
  const emitter = new TypeScriptEmitter();
  return emitter.emit(program, options);
}
