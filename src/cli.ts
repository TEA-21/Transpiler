#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { TranspilerError } from './errors/diagnostic.js';
import { analyzeMiniPython, transpileMiniPython } from './index.js';

interface CliArgs {
  inputFile?: string;
  outputFile?: string;
  checkOnly: boolean;
  emitAst: boolean;
  moduleMode: boolean;
  verifyTsc: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    checkOnly: false,
    emitAst: false,
    moduleMode: false,
    verifyTsc: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '-v' || arg === '--version') {
      result.version = true;
    } else if (arg === '--check' || arg === '--check-types') {
      result.checkOnly = true;
    } else if (arg === '--emit-ast') {
      result.emitAst = true;
    } else if (arg === '--module') {
      result.moduleMode = true;
    } else if (arg === '--verify-tsc') {
      result.verifyTsc = true;
    } else if (arg === '-o' || arg === '--output') {
      i++;
      if (i < args.length) {
        result.outputFile = args[i];
      }
    } else if (!arg.startsWith('-') && !result.inputFile) {
      result.inputFile = arg;
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
Mini-Python to Strict TypeScript Transpiler CLI

Usage:
  mini-python-transpile <input-file> [options]
  cat source.py | mini-python-transpile [options]

Options:
  -o, --output <file>    Write generated TypeScript to target file
  --check, --check-types Verify lexical, syntactic, and semantic types without emitting
  --emit-ast             Dump decorated Abstract Syntax Tree as JSON
  --module               Emit module export declarations
  --verify-tsc           Validate emitted TypeScript through tsc compiler
  -v, --version          Display version
  -h, --help             Display this help message
`);
}

export function runCli(argv = process.argv.slice(2)): number {
  const args = parseArgs(argv);

  if (args.help) {
    printUsage();
    return 0;
  }

  if (args.version) {
    console.log('mini-python-transpiler v1.0.0 (Production Release)');
    return 0;
  }

  let sourceCode = '';

  if (args.inputFile && args.inputFile !== '-') {
    if (!fs.existsSync(args.inputFile)) {
      console.error(`Error: Input file '${args.inputFile}' not found.`);
      return 1;
    }
    sourceCode = fs.readFileSync(args.inputFile, 'utf-8');
  } else {
    // Read from standard input synchronously
    try {
      sourceCode = fs.readFileSync(0, 'utf-8');
    } catch {
      console.error('Error: No input provided. Specify a file or pipe source code via stdin.');
      printUsage();
      return 1;
    }
  }

  try {
    if (args.checkOnly) {
      const { rootScope } = analyzeMiniPython(sourceCode);
      const symbolCount = rootScope.getAllSymbols().size;
      console.log(`✓ Type check passed: 0 errors (${symbolCount} top-level symbols resolved).`);
      return 0;
    }

    if (args.emitAst) {
      const { program } = analyzeMiniPython(sourceCode);
      const astJson = JSON.stringify(program, null, 2);
      if (args.outputFile) {
        fs.writeFileSync(args.outputFile, astJson, 'utf-8');
        console.log(`✓ AST JSON written to ${args.outputFile}`);
      } else {
        console.log(astJson);
      }
      return 0;
    }

    const { tsCode } = transpileMiniPython(sourceCode, { moduleMode: args.moduleMode });

    if (args.outputFile) {
      fs.writeFileSync(args.outputFile, tsCode, 'utf-8');
      console.log(`✓ Transpiled successfully: ${args.outputFile}`);
    } else {
      process.stdout.write(tsCode);
    }

    if (args.verifyTsc) {
      const tempFile = path.resolve(
        process.cwd(),
        `.temp_verify_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.ts`
      );
      try {
        fs.writeFileSync(tempFile, tsCode, 'utf-8');
        execSync(
          `npx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target ES2022 --module ESNext --moduleDetection force "${tempFile}"`,
          {
            stdio: 'pipe',
          }
        );
        console.log('✓ Verification passed: tsc confirms zero type errors.');
      } catch (tscErr: any) {
        console.error('✗ tsc verification failed:');
        console.error(tscErr.stdout?.toString() || tscErr.stderr?.toString() || tscErr.message);
        return 1;
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }

    return 0;
  } catch (err: unknown) {
    if (err instanceof TranspilerError) {
      console.error(`[Compiler Error] ${err.name} at line ${err.position.line}, col ${err.position.column}:`);
      console.error(`  ${err.message}`);
    } else if (err instanceof Error) {
      console.error(`[Error]: ${err.message}`);
    } else {
      console.error('[Error]: Unknown fatal compilation error.');
    }
    return 1;
  }
}

// Execute when invoked directly
if (process.argv[1] && (process.argv[1].endsWith('cli.ts') || process.argv[1].endsWith('cli.js'))) {
  const exitCode = runCli();
  process.exit(exitCode);
}
