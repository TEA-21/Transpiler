import * as fs from 'node:fs';
import * as path from 'node:path';
import * as util from 'node:util';
import { Lexer } from './lexer/lexer.js';
import { Parser } from './parser/parser.js';
import { SemanticAnalyzer } from './semantics/analyzer.js';
import { TokenType } from './lexer/tokens.js';

function runDemo(): void {
  const filePath = path.resolve(process.cwd(), 'demo.py');
  if (!fs.existsSync(filePath)) {
    console.error(`Error: demo file not found at ${filePath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(filePath, 'utf-8');

  console.log('='.repeat(80));
  console.log(' MINI-PYTHON TRANSPILER: REVIEW 1 DEMONSTRATION RUNNER');
  console.log(' Source File: demo.py');
  console.log('='.repeat(80));
  console.log('\n--- SOURCE CODE ---');
  console.log(source);

  // ==========================================
  // STAGE 1: LEXICAL ANALYSIS
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log(' [STAGE 1] LEXICAL ANALYSIS: TOKEN STREAM & VIRTUAL INDENTATION');
  console.log('='.repeat(80));

  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  const formattedTokens = tokens.map((token) => {
    const isVirtualLayout =
      token.type === TokenType.INDENT || token.type === TokenType.DEDENT;
    return {
      type: token.type,
      value: token.value,
      raw: token.raw,
      line: token.loc.start.line,
      column: token.loc.start.column,
      ...(isVirtualLayout ? { note: `>>> VIRTUAL ${token.type} TOKEN <<<` } : {}),
    };
  });

  console.log(
    util.inspect(formattedTokens, {
      depth: null,
      colors: true,
      maxArrayLength: null,
    })
  );

  const virtualIndents = tokens.filter((t) => t.type === TokenType.INDENT).length;
  const virtualDedents = tokens.filter((t) => t.type === TokenType.DEDENT).length;
  console.log(
    `\nTotal Tokens: ${tokens.length} | Virtual INDENTs: ${virtualIndents} | Virtual DEDENTs: ${virtualDedents}`
  );

  // ==========================================
  // STAGE 2: AST GENERATION (RAW UNTYPED AST)
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log(' [STAGE 2] AST GENERATION: RAW UNTYPED ABSTRACT SYNTAX TREE');
  console.log('='.repeat(80));

  const parser = new Parser(tokens);
  const rawAst = parser.parse();
  const rawAstSnapshot = JSON.parse(JSON.stringify(rawAst));

  console.log(
    util.inspect(rawAstSnapshot, {
      depth: null,
      colors: true,
    })
  );

  // ==========================================
  // STAGE 3: TYPE INFERENCE & SEMANTIC ANALYSIS
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log(' [STAGE 3] TYPE INFERENCE: DECORATED AST WITH DERIVED TYPE SIGNATURES');
  console.log('='.repeat(80));

  const analyzer = new SemanticAnalyzer();
  const { rootScope, program: decoratedAst } = analyzer.analyze(rawAst);

  console.log(
    util.inspect(decoratedAst, {
      depth: null,
      colors: true,
    })
  );

  // ==========================================
  // STAGE 4: SYMBOL TABLE & SCOPE CHAINS
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log(' [STAGE 4] SYMBOL TABLE: LEXICAL SCOPE CHAINS & STATIC INVARIANTS');
  console.log('='.repeat(80));

  const scopeDump = rootScope.toDumpObject();

  console.log(
    util.inspect(scopeDump, {
      depth: null,
      colors: true,
    })
  );

  console.log('\n' + '='.repeat(80));
  console.log(' DEMONSTRATION PIPELINE COMPLETED SUCCESSFULLY (ZERO ERRORS)');
  console.log('='.repeat(80));
}

runDemo();
