export * from './errors/diagnostic.js';
export * from './lexer/index.js';
export * from './parser/index.js';
export * from './semantics/index.js';

import { Lexer } from './lexer/lexer.js';
import { Parser } from './parser/parser.js';
import { Program } from './parser/ast.js';
import { SemanticAnalyzer } from './semantics/analyzer.js';
import { Scope } from './semantics/symbolTable.js';

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
