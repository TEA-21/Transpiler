import { describe, it, expect } from 'vitest';
import { transpileMiniPython } from '../src/index.js';

describe('TypeScript Emitter (Prototype Code Generator)', () => {
  it('emits typed primitive declarations and converts snake_case to camelCase', () => {
    const input = [
      'user_count = 42',
      'user_name = "Alice"',
      'is_active = True',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('let userCount: number = 42;');
    expect(tsCode).toContain('let userName: string = "Alice";');
    expect(tsCode).toContain('let isActive: boolean = true;');
  });

  it('emits reassignments without duplicate let declarations', () => {
    const input = [
      'count = 10',
      'count = count + 1',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    const lines = tsCode.trim().split('\n');
    expect(lines[0]).toBe('let count: number = 10;');
    expect(lines[1]).toBe('count = count + 1;');
  });

  it('translates logical and comparison operators to TypeScript idioms', () => {
    const input = [
      'a = 10',
      'b = 20',
      'res = (a == b) and not (a != b)',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('let res: boolean = a === b && !a !== b;');
  });

  it('emits strictly typed function declarations and calls', () => {
    const input = [
      'def add_numbers(first_val, second_val):',
      '    return first_val + second_val',
      '',
      'total = add_numbers(10, 25)',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('function addNumbers(firstVal: number, secondVal: number): number {');
    expect(tsCode).toContain('  return firstVal + secondVal;');
    expect(tsCode).toContain('let total: number = addNumbers(10, 25);');
  });

  it('translates print statements to console.log', () => {
    const input = 'print("Calculation completed")';
    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('console.log("Calculation completed");');
  });

  it('emits while loops and homogeneous array indexing', () => {
    const input = [
      'scores = [10, 20, 30]',
      'idx = 0',
      'total = 0',
      'while idx < 3:',
      '    total = total + scores[idx]',
      '    idx = idx + 1',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('let scores: number[] = [10, 20, 30];');
    expect(tsCode).toContain('while (idx < 3) {');
    expect(tsCode).toContain('  total = total + scores[idx];');
    expect(tsCode).toContain('  idx = idx + 1;');
  });

  it('emits nested if/else statements with block braces', () => {
    const input = [
      'threshold = 50',
      'if threshold > 20:',
      '    print("Above")',
      'else:',
      '    print("Below")',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('if (threshold > 20) {');
    expect(tsCode).toContain('  console.log("Above");');
    expect(tsCode).toContain('} else {');
    expect(tsCode).toContain('  console.log("Below");');
  });
});
