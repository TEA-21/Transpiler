import { describe, it, expect } from 'vitest';
import { analyzeMiniPython } from '../src/index.js';
import { TypeError, SemanticError } from '../src/errors/diagnostic.js';
import { FunctionDeclaration, VariableDeclaration } from '../src/parser/ast.js';

describe('Semantic Analysis & Type Inference', () => {
  describe('Primitive Bindings & Local Type Inference', () => {
    it('infers number, string, and boolean primitive types', () => {
      const input = [
        'count = 10',
        'name = "Alice"',
        'is_valid = True',
      ].join('\n');

      const { rootScope, program } = analyzeMiniPython(input);

      const countSym = rootScope.resolve('count');
      expect(countSym?.type).toEqual({ kind: 'primitive', name: 'number' });

      const nameSym = rootScope.resolve('name');
      expect(nameSym?.type).toEqual({ kind: 'primitive', name: 'string' });

      const isValidSym = rootScope.resolve('is_valid');
      expect(isValidSym?.type).toEqual({ kind: 'primitive', name: 'boolean' });

      const decl0 = program.body[0] as VariableDeclaration;
      expect(decl0.inferredType).toBe('number');
      const decl1 = program.body[1] as VariableDeclaration;
      expect(decl1.inferredType).toBe('string');
      const decl2 = program.body[2] as VariableDeclaration;
      expect(decl2.inferredType).toBe('boolean');
    });

    it('allows valid reassignment maintaining invariant static type', () => {
      const input = [
        'count = 10',
        'count = count + 1',
      ].join('\n');

      const { rootScope } = analyzeMiniPython(input);
      const countSym = rootScope.resolve('count');
      expect(countSym?.type).toEqual({ kind: 'primitive', name: 'number' });
      expect(countSym?.isMutable).toBe(true);
    });

    it('rejects conflicting reassignment with incompatible type', () => {
      const input = [
        'count = 10',
        'count = "Alice"',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });
  });

  describe('Arithmetic & Expression Type Safety', () => {
    it('infers binary arithmetic expressions', () => {
      const input = [
        'total = 5 + 3 * 2',
        'ratio = total / 2',
      ].join('\n');

      const { rootScope } = analyzeMiniPython(input);
      expect(rootScope.resolve('total')?.type).toEqual({ kind: 'primitive', name: 'number' });
      expect(rootScope.resolve('ratio')?.type).toEqual({ kind: 'primitive', name: 'number' });
    });

    it('supports string concatenation via binary +', () => {
      const input = 'greeting = "Hello, " + "world"';
      const { rootScope } = analyzeMiniPython(input);
      expect(rootScope.resolve('greeting')?.type).toEqual({ kind: 'primitive', name: 'string' });
    });

    it('rejects arithmetic on strings (e.g. subtraction or multiplication)', () => {
      const input = 'bad = "hello" - 2';
      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('rejects binary + adding string and number', () => {
      const input = 'bad = "hello" + 5';
      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('infers comparison operators as boolean and requires numeric operands', () => {
      const input = 'is_high = 10 > 5';
      const { rootScope } = analyzeMiniPython(input);
      expect(rootScope.resolve('is_high')?.type).toEqual({ kind: 'primitive', name: 'boolean' });
    });

    it('rejects comparison on incompatible types', () => {
      const input = 'bad = "hello" > 5';
      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });
  });

  describe('Conditionals & While Loops Guard Validation', () => {
    it('accepts boolean guard expressions in if/else statements', () => {
      const input = [
        'total = 15',
        'if total > 10:',
        '    print("High")',
        'else:',
        '    print("Low")',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).not.toThrow();
    });

    it('rejects non-boolean guard expressions in if statements', () => {
      const input = [
        'total = 15',
        'if total + 10:',
        '    print("Invalid")',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('validates boolean termination condition in while loops', () => {
      const input = [
        'count = 10',
        'while count > 0:',
        '    count = count - 1',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).not.toThrow();
    });

    it('rejects non-boolean termination conditions in while loops', () => {
      const input = [
        'while 1:',
        '    print("Infinite")',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('rejects conflicting reassignment inside while loop body', () => {
      const input = [
        'count = 10',
        'while count > 0:',
        '    count = "zero"',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });
  });

  describe('Functions & Bidirectional Constraint Propagation', () => {
    it('derives function parameter types and return type across call sites', () => {
      const input = [
        'def add(a, b):',
        '    return a + b',
        '',
        'total = add(10, 20)',
      ].join('\n');

      const { rootScope, program } = analyzeMiniPython(input);
      const totalSym = rootScope.resolve('total');
      expect(totalSym?.type).toEqual({ kind: 'primitive', name: 'number' });

      const fnDecl = program.body[0] as FunctionDeclaration;
      expect(fnDecl.inferredReturnType).toBe('number');
      expect(fnDecl.inferredParamTypes).toEqual({ a: 'number', b: 'number' });
    });

    it('propagates internal arithmetic constraints to parameters and callers', () => {
      const input = [
        'def compute(x):',
        '    return x - 5',
        '',
        'res = compute(10)',
      ].join('\n');

      const { rootScope, program } = analyzeMiniPython(input);
      expect(rootScope.resolve('res')?.type).toEqual({ kind: 'primitive', name: 'number' });

      const fnDecl = program.body[0] as FunctionDeclaration;
      expect(fnDecl.inferredReturnType).toBe('number');
      expect(fnDecl.inferredParamTypes).toEqual({ x: 'number' });
    });

    it('unifies return types across multiple branches', () => {
      const input = [
        'def sign(x):',
        '    if x > 0:',
        '        return 1',
        '    else:',
        '        return -1',
        '',
        's = sign(5)',
      ].join('\n');

      const { rootScope } = analyzeMiniPython(input);
      expect(rootScope.resolve('s')?.type).toEqual({ kind: 'primitive', name: 'number' });
    });

    it('rejects functions with conflicting return branch types', () => {
      const input = [
        'def broken(x):',
        '    if x > 0:',
        '        return 1',
        '    else:',
        '        return "negative"',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('rejects call sites with wrong number of arguments (arity mismatch)', () => {
      const input = [
        'def add(a, b):',
        '    return a + b',
        '',
        'total = add(10)',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('rejects call sites violating inferred parameter constraints', () => {
      const input = [
        'def sub(a, b):',
        '    return a - b',
        '',
        'total = sub("hello", "world")',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('infers void return type for functions with no return statement', () => {
      const input = [
        'def log_msg(msg):',
        '    print(msg)',
        '',
        'log_msg("Hello")',
      ].join('\n');

      const { program } = analyzeMiniPython(input);
      const fnDecl = program.body[0] as FunctionDeclaration;
      expect(fnDecl.inferredReturnType).toBe('void');
    });
  });

  describe('Array Constructs & Indexing', () => {
    it('infers homogeneous array types and element access', () => {
      const input = [
        'numbers = [1, 2, 3]',
        'first = numbers[0]',
      ].join('\n');

      const { rootScope } = analyzeMiniPython(input);
      const numsSym = rootScope.resolve('numbers');
      expect(numsSym?.type).toEqual({
        kind: 'array',
        elementType: { kind: 'primitive', name: 'number' },
      });

      const firstSym = rootScope.resolve('first');
      expect(firstSym?.type).toEqual({ kind: 'primitive', name: 'number' });
    });

    it('rejects heterogeneous array literals', () => {
      const input = 'mixed = [1, "two", 3]';
      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('rejects non-numeric index access', () => {
      const input = [
        'items = [10, 20]',
        'val = items["0"]',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('rejects indexing into non-array/string values', () => {
      const input = [
        'num = 42',
        'val = num[0]',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });
  });

  describe('Scoping & Diagnostics', () => {
    it('rejects use of undefined identifiers', () => {
      const input = 'y = unknown_var + 1';
      expect(() => analyzeMiniPython(input)).toThrowError(SemanticError);
    });

    it('resolves variables from outer lexical scopes inside functions', () => {
      const input = [
        'global_base = 100',
        'def add_base(x):',
        '    return x + global_base',
        '',
        'res = add_base(5)',
      ].join('\n');

      const { rootScope } = analyzeMiniPython(input);
      expect(rootScope.resolve('res')?.type).toEqual({ kind: 'primitive', name: 'number' });
    });
  });
});
