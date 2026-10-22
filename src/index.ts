export * from './errors/diagnostic.js';
export * from './lexer/index.js';
export * from './parser/index.js';
export * from './semantics/index.js';
export * from './codegen/index.js';

import { Lexer } from './lexer/lexer.js';
import { Parser } from './parser/parser.js';
import { Program } from './parser/ast.js';
import { SemanticAnalyzer } from './semantics/analyzer.js';
import { Scope } from './semantics/symbolTable.js';
import { emitTypeScript, EmitterOptions } from './codegen/emitter.js';

export function parseMiniPython(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

export function analyzeMiniPython(source: string): { rootScope: Scope; program: Program } {
  const ast = parseMiniPython(source);
  const analyzer = new SemanticAnalyzer();
  return analyzer.analyze(ast);
}

export function transpileMiniPython(
  source: string,
  options?: EmitterOptions
): {
  rootScope: Scope;
  program: Program;
  tsCode: string;
} {
  const { rootScope, program } = analyzeMiniPython(source);
  const tsCode = emitTypeScript(program, options);
  return { rootScope, program, tsCode };
}
