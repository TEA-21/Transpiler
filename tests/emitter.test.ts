import { describe, it, expect } from 'vitest';
import { transpileMiniPython } from '../src/index.js';

describe('TypeScript Emitter (Prototype Code Generator)', () => {
  it('emits typed primitive declarations with const and converts snake_case to camelCase', () => {
    const input = [
      'user_count = 42',
      'user_name = "Alice"',
      'is_active = True',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('const userCount: number = 42;');
    expect(tsCode).toContain('const userName: string = "Alice";');
    expect(tsCode).toContain('const isActive: boolean = true;');
  });

  it('emits reassignments with let for initial declaration and bare assignment for update', () => {
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
    expect(tsCode).toContain('const res: boolean = a === b && !a !== b;');
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
    expect(tsCode).toContain('const total: number = addNumbers(10, 25);');
  });

  it('translates print statements to console.log', () => {
    const input = 'print("Calculation completed")';
    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('console.log("Calculation completed");');
  });

  it('emits while loops and homogeneous array indexing with correct const/let distinction', () => {
    const input = [
      'scores = [10, 20, 30]',
      'idx = 0',
      'total = 0',
      'while idx < 3:',
      '    total = total + scores[idx]',
      '    idx = idx + 1',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('const scores: number[] = [10, 20, 30];');
    expect(tsCode).toContain('let idx: number = 0;');
    expect(tsCode).toContain('let total: number = 0;');
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
    expect(tsCode).toContain('const threshold: number = 50;');
    expect(tsCode).toContain('if (threshold > 20) {');
    expect(tsCode).toContain('  console.log("Above");');
    expect(tsCode).toContain('} else {');
    expect(tsCode).toContain('  console.log("Below");');
  });

  it('correctly classifies const static invariants vs let mutable variables in evaluation pipeline', () => {
    const input = [
      'base_limit = 100',
      'system_status = "OPERATIONAL"',
      'strict_mode = True',
      'samples = [15, 30, 45, 60]',
      'cursor = 0',
      'accumulator = 0',
      'while cursor < 4:',
      '    accumulator = accumulator + samples[cursor]',
      '    cursor = cursor + 1',
      'final_score = accumulator / cursor',
    ].join('\n');

    const { tsCode, program } = transpileMiniPython(input);

    // Verify AST decorations
    const baseLimitStmt = program.body[0] as any;
    expect(baseLimitStmt.isConst).toBe(true);

    const cursorStmt = program.body[4] as any;
    expect(cursorStmt.isConst).toBe(false);

    // Verify emitted TypeScript keywords
    expect(tsCode).toContain('const baseLimit: number = 100;');
    expect(tsCode).toContain('const systemStatus: string = "OPERATIONAL";');
    expect(tsCode).toContain('const strictMode: boolean = true;');
    expect(tsCode).toContain('const samples: number[] = [15, 30, 45, 60];');
    expect(tsCode).toContain('let cursor: number = 0;');
    expect(tsCode).toContain('const finalScore: number = accumulator / cursor;');
  });

  it('emits union types, null literals, and is / is not checks', () => {
    const input = [
      'def find_value(flag):',
      '    if flag:',
      '        return 42',
      '    return None',
      '',
      'res = find_value(True)',
      'if res is not None:',
      '    print(res)',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('function findValue(flag: boolean): number | null {');
    expect(tsCode).toContain('return null;');
    expect(tsCode).toContain('if (res !== null) {');
    expect(tsCode).toContain('const res: number | null = findValue(true);');
  });

  it('translates isinstance() type guards to TypeScript typeof checks', () => {
    const input = [
      'def handle(val):',
      '    if isinstance(val, int):',
      '        return val + 1',
      '    else:',
      '        return val + "!"',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(tsCode).toContain('if (typeof val === "number") {');
  });

  it('emits export keywords when moduleMode is enabled', () => {
    const input = [
      'api_limit = 500',
      'def calculate_tax(amount):',
      '    return amount * 0.18',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input, { moduleMode: true });
    expect(tsCode).toContain('export const apiLimit: number = 500;');
    expect(tsCode).toContain('export function calculateTax(amount: number): number {');
  });
});
