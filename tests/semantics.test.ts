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

    it('infers union type on reassignment and rejects unsafe un-narrowed operations', () => {
      const input = [
        'count = 10',
        'count = "Alice"',
      ].join('\n');

      const { rootScope, program } = analyzeMiniPython(input);
      const countSym = rootScope.resolve('count');
      expect(countSym?.type).toEqual({
        kind: 'union',
        types: [
          { kind: 'primitive', name: 'number' },
          { kind: 'primitive', name: 'string' },
        ],
      });
      const decl0 = program.body[0] as VariableDeclaration;
      expect(decl0.inferredType).toBe('number | string');

      // Unsafe un-narrowed operation must throw TypeError
      const badInput = [
        'count = 10',
        'count = "Alice"',
        'bad = count - 5',
      ].join('\n');
      expect(() => analyzeMiniPython(badInput)).toThrowError(TypeError);
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

    it('infers union return type across multiple branches and rejects un-narrowed usage', () => {
      const input = [
        'def get_val(x):',
        '    if x > 0:',
        '        return 1',
        '    else:',
        '        return "negative"',
      ].join('\n');

      const { program } = analyzeMiniPython(input);
      const fnDecl = program.body[0] as FunctionDeclaration;
      expect(fnDecl.inferredReturnType).toBe('number | string');

      // Unsafe un-narrowed operation on returned union must throw TypeError
      const badCall = [
        input,
        'val = get_val(5)',
        'bad = val + 10',
      ].join('\n');
      expect(() => analyzeMiniPython(badCall)).toThrowError(TypeError);
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

  describe('Flow-Sensitive Occurrence Typing & Type Guards', () => {
    it('narrows union types in consequent and alternate branches using isinstance()', () => {
      const input = [
        'def process(val):',
        '    if isinstance(val, int):',
        '        return val + 100',
        '    else:',
        '        return val + " processed"',
        '',
        'n_res = process(5)',
        's_res = process("hello")',
      ].join('\n');

      const { program } = analyzeMiniPython(input);
      const fnDecl = program.body[0] as FunctionDeclaration;
      expect(fnDecl.inferredReturnType).toBe('number | string');
    });

    it('narrows optional types using is not None checks', () => {
      const input = [
        'def find_item(flag):',
        '    if flag:',
        '        return 42',
        '    return None',
        '',
        'item = find_item(True)',
        'out = 0',
        'if item is not None:',
        '    out = item + 1',
      ].join('\n');

      const { rootScope, program } = analyzeMiniPython(input);
      const fnDecl = program.body[0] as FunctionDeclaration;
      expect(fnDecl.inferredReturnType).toBe('number | null');
      const itemSym = rootScope.resolve('item');
      expect(itemSym?.type).toEqual({
        kind: 'union',
        types: [
          { kind: 'primitive', name: 'number' },
          { kind: 'primitive', name: 'null' },
        ],
      });
    });

    it('rejects indexing into union type without type narrowing', () => {
      const input = [
        'items = [1, 2, 3]',
        'items = 100',
        'bad = items[0]',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('infers slice expression types for arrays and strings', () => {
      const input = [
        'nums = [1, 2, 3, 4, 5]',
        'sub_nums = nums[1:3]',
        'rev_nums = nums[::-1]',
        'text = "hello world"',
        'sub_text = text[:5]',
      ].join('\n');

      const { rootScope } = analyzeMiniPython(input);
      expect(rootScope.resolve('sub_nums')?.type).toEqual({
        kind: 'array',
        elementType: { kind: 'primitive', name: 'number' },
      });
      expect(rootScope.resolve('rev_nums')?.type).toEqual({
        kind: 'array',
        elementType: { kind: 'primitive', name: 'number' },
      });
      expect(rootScope.resolve('sub_text')?.type).toEqual({
        kind: 'primitive',
        name: 'string',
      });
    });

    it('rejects slicing on non-indexable types', () => {
      const input = [
        'x = 42',
        'sub = x[1:2]',
      ].join('\n');

      expect(() => analyzeMiniPython(input)).toThrowError(TypeError);
    });

    it('infers list comprehension types with arithmetic mapping', () => {
      const input = [
        'nums = [1, 2, 3]',
        'doubles = [x * 2 for x in nums]',
      ].join('\n');

      const { rootScope } = analyzeMiniPython(input);
      expect(rootScope.resolve('doubles')?.type).toEqual({
        kind: 'array',
        elementType: { kind: 'primitive', name: 'number' },
      });
    });

    it('narrows union types inside list comprehension filters via occurrence typing', () => {
      const input = [
        'def format_payload(item):',
        '    if isinstance(item, int):',
        '        return item * 10',
        '    else:',
        '        return item',
        '',
        'item1 = format_payload(42)',
        'item2 = format_payload("SAMPLE_TOKEN")',
        'items = [item1, item2]',
        'only_ints = [x * 2 for x in items if isinstance(x, int)]',
      ].join('\n');

      const { rootScope } = analyzeMiniPython(input);
      expect(rootScope.resolve('only_ints')?.type).toEqual({
        kind: 'array',
        elementType: { kind: 'primitive', name: 'number' },
      });
    });
  });
});
