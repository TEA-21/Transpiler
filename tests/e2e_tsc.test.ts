import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { transpileMiniPython } from '../src/index.js';

function verifyWithTsc(tsCode: string): void {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(
    tmpDir,
    `transpiler_e2e_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.ts`
  );

  try {
    fs.writeFileSync(tmpFile, tsCode, 'utf-8');
    execSync(
      `npx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target ES2022 --module ESNext --moduleDetection force "${tmpFile}"`,
      { stdio: 'pipe' }
    );
  } catch (err: any) {
    const msg = err.stdout?.toString() || err.stderr?.toString() || err.message;
    throw new Error(`tsc compilation failed:\n${msg}\n\nEmitted TypeScript:\n${tsCode}`);
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
}

describe('End-to-End Automated tsc Compiler Verification', () => {
  it('compiles the full Review 2 demonstration pipeline under strict tsc with 0 errors', () => {
    const input = [
      'base_limit = 100',
      'system_status = "OPERATIONAL"',
      'strict_mode = True',
      '',
      'def compute_weighted_average(total_weight, sample_count):',
      '    if sample_count == 0:',
      '        return 0',
      '    return total_weight / sample_count',
      '',
      'samples = [15, 30, 45, 60]',
      'cursor = 0',
      'accumulator = 0',
      '',
      'while cursor < 4:',
      '    accumulator = accumulator + samples[cursor]',
      '    cursor = cursor + 1',
      '',
      'final_score = compute_weighted_average(accumulator, cursor)',
      '',
      'if final_score >= 35 and strict_mode:',
      '    print("STATUS_PASS")',
      'else:',
      '    print("STATUS_REVISE")',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(() => verifyWithTsc(tsCode)).not.toThrow();
  });

  it('compiles Flow-Sensitive Occurrence Typing with isinstance() type guards under strict tsc with 0 errors', () => {
    const input = [
      'def format_output(value):',
      '    if isinstance(value, int):',
      '        return value * 2',
      '    else:',
      '        return value + " is a text string"',
      '',
      'num_result = format_output(50)',
      'str_result = format_output("hello")',
      '',
      'print(num_result)',
      'print(str_result)',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(() => verifyWithTsc(tsCode)).not.toThrow();
  });

  it('compiles optional return types and is not None checks under strict tsc with 0 errors', () => {
    const input = [
      'def lookup_item(key_id):',
      '    if key_id > 100:',
      '        return key_id * 10',
      '    return None',
      '',
      'res = lookup_item(105)',
      'if res is not None:',
      '    doubled = res * 2',
      '    print(doubled)',
      'else:',
      '    print("Not found")',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(() => verifyWithTsc(tsCode)).not.toThrow();
  });

  it('compiles module export declarations with strict types under tsc with 0 errors', () => {
    const input = [
      'tax_rate = 0.18',
      'currency_code = "INR"',
      '',
      'def compute_invoice(subtotal):',
      '    tax_amount = subtotal * tax_rate',
      '    return subtotal + tax_amount',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input, { moduleMode: true });
    expect(tsCode).toContain('export const taxRate: number = 0.18;');
    expect(tsCode).toContain('export function computeInvoice(subtotal: number): number {');
    expect(() => verifyWithTsc(tsCode)).not.toThrow();
  });

  it('compiles multi-branch union widening and narrowing under strict tsc with 0 errors', () => {
    const input = [
      'def parse_status(code):',
      '    if code == 200:',
      '        return "OK"',
      '    if code == 404:',
      '        return False',
      '    return code',
      '',
      'resp_status = parse_status(200)',
      'if isinstance(resp_status, str):',
      '    print("String: " + resp_status)',
      'else:',
      '    print("Non-string")',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(() => verifyWithTsc(tsCode)).not.toThrow();
  });

  it('compiles polymorphic guarded parameters with identity return under strict tsc with 0 errors', () => {
    const input = [
      'def format_payload(item):',
      '    if isinstance(item, int):',
      '        return item * 10',
      '    else:',
      '        return item',
      '',
      'val_int = format_payload(42)',
      'val_str = format_payload("SAMPLE_TOKEN")',
      'print(val_int)',
      'print(val_str)',
    ].join('\n');

    const { tsCode } = transpileMiniPython(input);
    expect(() => verifyWithTsc(tsCode)).not.toThrow();
  });
});
