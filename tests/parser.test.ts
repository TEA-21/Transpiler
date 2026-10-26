import { describe, it, expect } from 'vitest';
import { parseMiniPython } from '../src/index.js';
import {
  BinaryExpression,
  CallExpression,
  IfStatement,
  NumericLiteral,
  StringLiteral,
  UnaryExpression,
  VariableDeclaration,
} from '../src/parser/ast.js';
import { ParserError } from '../src/errors/diagnostic.js';

describe('Base AST Parser', () => {
  it('parses primitive variable bindings', () => {
    const input = [
      'count = 10',
      'name = "Alice"',
      'is_valid = True',
      'flag = False',
    ].join('\n');

    const ast = parseMiniPython(input);

    expect(ast.type).toBe('Program');
    expect(ast.body.length).toBe(4);

    const decl1 = ast.body[0] as VariableDeclaration;
    expect(decl1.type).toBe('VariableDeclaration');
    expect(decl1.id.name).toBe('count');
    expect((decl1.init as NumericLiteral).value).toBe(10);
    expect(decl1.loc.start).toEqual({ line: 1, column: 1 });

    const decl2 = ast.body[1] as VariableDeclaration;
    expect(decl2.id.name).toBe('name');
    expect((decl2.init as StringLiteral).value).toBe('Alice');

    const decl3 = ast.body[2] as VariableDeclaration;
    expect(decl3.id.name).toBe('is_valid');
    expect(decl3.init.type).toBe('BooleanLiteral');
    if (decl3.init.type === 'BooleanLiteral') {
      expect(decl3.init.value).toBe(true);
    }

    const decl4 = ast.body[3] as VariableDeclaration;
    expect(decl4.id.name).toBe('flag');
    if (decl4.init.type === 'BooleanLiteral') {
      expect(decl4.init.value).toBe(false);
    }
  });

  it('correctly evaluates binary arithmetic with operator precedence', () => {
    // 5 + 3 * 2 should be parsed as 5 + (3 * 2)
    const input = 'total = 5 + 3 * 2';
    const ast = parseMiniPython(input);

    const decl = ast.body[0] as VariableDeclaration;
    const binExpr = decl.init as BinaryExpression;

    expect(binExpr.type).toBe('BinaryExpression');
    expect(binExpr.operator).toBe('+');
    expect((binExpr.left as NumericLiteral).value).toBe(5);

    const rightExpr = binExpr.right as BinaryExpression;
    expect(rightExpr.type).toBe('BinaryExpression');
    expect(rightExpr.operator).toBe('*');
    expect((rightExpr.left as NumericLiteral).value).toBe(3);
    expect((rightExpr.right as NumericLiteral).value).toBe(2);
  });

  it('respects parenthesized expressions in operator precedence', () => {
    // (5 + 3) * 2 should be parsed as (5 + 3) * 2
    const input = 'res = (5 + 3) * 2';
    const ast = parseMiniPython(input);

    const decl = ast.body[0] as VariableDeclaration;
    const binExpr = decl.init as BinaryExpression;

    expect(binExpr.type).toBe('BinaryExpression');
    expect(binExpr.operator).toBe('*');

    const leftExpr = binExpr.left as BinaryExpression;
    expect(leftExpr.type).toBe('BinaryExpression');
    expect(leftExpr.operator).toBe('+');
    expect((leftExpr.left as NumericLiteral).value).toBe(5);
    expect((leftExpr.right as NumericLiteral).value).toBe(3);

    expect((binExpr.right as NumericLiteral).value).toBe(2);
  });

  it('parses unary expressions (negation and logical not)', () => {
    const input = [
      'neg = -5',
      'inv = not is_valid',
    ].join('\n');

    const ast = parseMiniPython(input);

    const decl1 = ast.body[0] as VariableDeclaration;
    const unary1 = decl1.init as UnaryExpression;
    expect(unary1.type).toBe('UnaryExpression');
    expect(unary1.operator).toBe('-');
    expect((unary1.argument as NumericLiteral).value).toBe(5);

    const decl2 = ast.body[1] as VariableDeclaration;
    const unary2 = decl2.init as UnaryExpression;
    expect(unary2.type).toBe('UnaryExpression');
    expect(unary2.operator).toBe('not');
    expect(unary2.argument.type).toBe('Identifier');
  });

  it('parses conditional if/else blocks and print statements', () => {
    const input = [
      'if total > 10:',
      '    print("High")',
      'else:',
      '    print("Low")',
    ].join('\n');

    const ast = parseMiniPython(input);

    expect(ast.body.length).toBe(1);
    const ifStmt = ast.body[0] as IfStatement;
    expect(ifStmt.type).toBe('IfStatement');

    // Condition
    const testExpr = ifStmt.test as BinaryExpression;
    expect(testExpr.type).toBe('BinaryExpression');
    expect(testExpr.operator).toBe('>');
    expect(testExpr.left.type).toBe('Identifier');
    expect((testExpr.right as NumericLiteral).value).toBe(10);

    // Consequent block
    expect(ifStmt.consequent.type).toBe('BlockStatement');
    expect(ifStmt.consequent.body.length).toBe(1);
    const call1 = ifStmt.consequent.body[0] as any;
    expect(call1.type).toBe('ExpressionStatement');
    expect(call1.expression.type).toBe('CallExpression');
    expect(call1.expression.callee.name).toBe('print');
    expect(call1.expression.arguments[0].value).toBe('High');

    // Alternate block
    expect(ifStmt.alternate).not.toBeNull();
    const altBlock = ifStmt.alternate as any;
    expect(altBlock.type).toBe('BlockStatement');
    expect(altBlock.body.length).toBe(1);
    const call2 = altBlock.body[0] as any;
    expect(call2.expression.arguments[0].value).toBe('Low');
  });

  it('parses nested if statements', () => {
    const input = [
      'if a > 0:',
      '    if b > 0:',
      '        print("Both positive")',
    ].join('\n');

    const ast = parseMiniPython(input);
    const outerIf = ast.body[0] as IfStatement;
    expect(outerIf.type).toBe('IfStatement');
    expect(outerIf.consequent.body.length).toBe(1);

    const innerIf = outerIf.consequent.body[0] as IfStatement;
    expect(innerIf.type).toBe('IfStatement');
    expect(innerIf.consequent.body.length).toBe(1);
  });

  it('parses if-elif-else ladders', () => {
    const input = [
      'if score >= 90:',
      '    grade = "A"',
      'elif score >= 80:',
      '    grade = "B"',
      'else:',
      '    grade = "C"',
    ].join('\n');

    const ast = parseMiniPython(input);
    const ifStmt = ast.body[0] as IfStatement;
    expect(ifStmt.type).toBe('IfStatement');
    expect(ifStmt.alternate).not.toBeNull();
    expect(ifStmt.alternate?.type).toBe('IfStatement');

    const elifStmt = ifStmt.alternate as IfStatement;
    expect(elifStmt.alternate?.type).toBe('BlockStatement');
  });

  it('supports multiple arguments in function calls like print', () => {
    const input = 'print("Result:", total, True)';
    const ast = parseMiniPython(input);

    const stmt = ast.body[0] as any;
    const call = stmt.expression as CallExpression;
    expect(call.type).toBe('CallExpression');
    expect(call.arguments.length).toBe(3);
    expect(call.arguments[0]?.type).toBe('StringLiteral');
    expect(call.arguments[1]?.type).toBe('Identifier');
    expect(call.arguments[2]?.type).toBe('BooleanLiteral');
  });

  it('attaches accurate source location diagnostics to AST nodes', () => {
    const input = 'x = 100';
    const ast = parseMiniPython(input);

    expect(ast.loc).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 8 },
    });

    const decl = ast.body[0] as VariableDeclaration;
    expect(decl.loc).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 8 },
    });
  });

  it('throws ParserError when a colon is missing after if condition', () => {
    const input = [
      'if total > 10',
      '    print("Fail")',
    ].join('\n');

    expect(() => parseMiniPython(input)).toThrowError(ParserError);
  });

  it('throws ParserError on unexpected token in assignment', () => {
    const input = 'x = = 10';
    expect(() => parseMiniPython(input)).toThrowError(ParserError);
  });

  it('throws ParserError on unclosed parenthesis', () => {
    const input = 'x = (5 + 3';
    expect(() => parseMiniPython(input)).toThrowError(ParserError);
  });

  it('parses while loops with block bodies', () => {
    const input = [
      'while count > 0:',
      '    count = count - 1',
    ].join('\n');

    const ast = parseMiniPython(input);
    expect(ast.body.length).toBe(1);
    const whileStmt = ast.body[0] as any;
    expect(whileStmt.type).toBe('WhileStatement');
    expect(whileStmt.test.type).toBe('BinaryExpression');
    expect(whileStmt.test.operator).toBe('>');
    expect(whileStmt.body.type).toBe('BlockStatement');
    expect(whileStmt.body.body.length).toBe(1);
  });

  it('parses function declarations with parameters and return statements', () => {
    const input = [
      'def add(a, b):',
      '    return a + b',
    ].join('\n');

    const ast = parseMiniPython(input);
    expect(ast.body.length).toBe(1);
    const fnDecl = ast.body[0] as any;
    expect(fnDecl.type).toBe('FunctionDeclaration');
    expect(fnDecl.id.name).toBe('add');
    expect(fnDecl.params.length).toBe(2);
    expect(fnDecl.params[0].name).toBe('a');
    expect(fnDecl.params[1].name).toBe('b');
    expect(fnDecl.body.body.length).toBe(1);
    expect(fnDecl.body.body[0].type).toBe('ReturnStatement');
    expect(fnDecl.body.body[0].argument.type).toBe('BinaryExpression');
  });

  it('parses array literals and index expressions', () => {
    const input = [
      'items = [1, 2, 3]',
      'first = items[0]',
    ].join('\n');

    const ast = parseMiniPython(input);
    expect(ast.body.length).toBe(2);

    const decl1 = ast.body[0] as any;
    expect(decl1.init.type).toBe('ArrayLiteral');
    expect(decl1.init.elements.length).toBe(3);

    const decl2 = ast.body[1] as any;
    expect(decl2.init.type).toBe('IndexExpression');
    expect(decl2.init.object.name).toBe('items');
    expect(decl2.init.index.value).toBe(0);
  });

  it('parses None literal and is / is not binary comparisons', () => {
    const input = [
      'res = None',
      'is_null = res is None',
      'has_val = res is not None',
    ].join('\n');

    const ast = parseMiniPython(input);
    expect(ast.body.length).toBe(3);

    const decl1 = ast.body[0] as any;
    expect(decl1.init.type).toBe('NoneLiteral');
    expect(decl1.init.value).toBe(null);

    const decl2 = ast.body[1] as any;
    expect(decl2.init.type).toBe('BinaryExpression');
    expect(decl2.init.operator).toBe('is');
    expect(decl2.init.left.name).toBe('res');
    expect(decl2.init.right.type).toBe('NoneLiteral');

    const decl3 = ast.body[2] as any;
    expect(decl3.init.type).toBe('BinaryExpression');
    expect(decl3.init.operator).toBe('is not');
    expect(decl3.init.left.name).toBe('res');
    expect(decl3.init.right.type).toBe('NoneLiteral');
  });

  it('parses isinstance() call expressions', () => {
    const input = 'check = isinstance(val, int)';
    const ast = parseMiniPython(input);

    const decl = ast.body[0] as any;
    expect(decl.init.type).toBe('CallExpression');
    expect(decl.init.callee.name).toBe('isinstance');
    expect(decl.init.arguments.length).toBe(2);
    expect(decl.init.arguments[0].name).toBe('val');
    expect(decl.init.arguments[1].name).toBe('int');
  });

  it('parses slice expressions with various bound and step combinations', () => {
    const input = [
      'sub1 = items[1:4]',
      'sub2 = items[:3]',
      'sub3 = items[2:]',
      'sub4 = items[::2]',
      'sub5 = items[::-1]',
    ].join('\n');

    const ast = parseMiniPython(input);
    expect(ast.body.length).toBe(5);

    const d1 = (ast.body[0] as any).init;
    expect(d1.type).toBe('SliceExpression');
    expect(d1.start.value).toBe(1);
    expect(d1.stop.value).toBe(4);
    expect(d1.step).toBeNull();

    const d2 = (ast.body[1] as any).init;
    expect(d2.type).toBe('SliceExpression');
    expect(d2.start).toBeNull();
    expect(d2.stop.value).toBe(3);

    const d3 = (ast.body[2] as any).init;
    expect(d3.type).toBe('SliceExpression');
    expect(d3.start.value).toBe(2);
    expect(d3.stop).toBeNull();

    const d4 = (ast.body[3] as any).init;
    expect(d4.type).toBe('SliceExpression');
    expect(d4.start).toBeNull();
    expect(d4.stop).toBeNull();
    expect(d4.step.value).toBe(2);

    const d5 = (ast.body[4] as any).init;
    expect(d5.type).toBe('SliceExpression');
    expect(d5.start).toBeNull();
    expect(d5.stop).toBeNull();
    expect(d5.step.type).toBe('UnaryExpression');
  });

  it('parses single and nested list comprehensions with filters', () => {
    const input = [
      'doubles = [x * 2 for x in nums]',
      'evens = [x for x in nums if x > 0]',
      'flattened = [item for row in matrix for item in row if item != 0]',
    ].join('\n');

    const ast = parseMiniPython(input);
    expect(ast.body.length).toBe(3);

    const d1 = (ast.body[0] as any).init;
    expect(d1.type).toBe('ListComprehension');
    expect(d1.clauses.length).toBe(1);
    expect(d1.clauses[0].target.name).toBe('x');
    expect(d1.clauses[0].iter.name).toBe('nums');
    expect(d1.clauses[0].ifs.length).toBe(0);

    const d2 = (ast.body[1] as any).init;
    expect(d2.type).toBe('ListComprehension');
    expect(d2.clauses[0].ifs.length).toBe(1);

    const d3 = (ast.body[2] as any).init;
    expect(d3.type).toBe('ListComprehension');
    expect(d3.clauses.length).toBe(2);
    expect(d3.clauses[0].target.name).toBe('row');
    expect(d3.clauses[1].target.name).toBe('item');
    expect(d3.clauses[1].ifs.length).toBe(1);
  });
});
