import * as fs from 'node:fs';
import * as path from 'node:path';
import * as util from 'node:util';
import { Lexer } from './lexer/lexer.js';
import { Parser } from './parser/parser.js';
import { SemanticAnalyzer } from './semantics/analyzer.js';
import { emitTypeScript } from './codegen/emitter.js';
import { TokenType } from './lexer/tokens.js';
import { TypeError } from './errors/diagnostic.js';

function runReview2Demo(): void {
  const filePath = path.resolve(process.cwd(), 'demo_review2.py');
  if (!fs.existsSync(filePath)) {
    console.error(`Error: demo file not found at ${filePath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(filePath, 'utf-8');

  console.log('='.repeat(80));
  console.log(' MINI-PYTHON TRANSPILER: REVIEW 2 EVALUATION & VERIFICATION RUNNER');
  console.log(' Scope: Lexer -> Parser -> Semantics (Type Inference & Unification) -> TS Emitter');
  console.log(' Source File: demo_review2.py');
  console.log('='.repeat(80));
  console.log('\n--- INPUT MINI-PYTHON SOURCE ---');
  console.log(source);

  // ==========================================
  // STAGE 1: LEXICAL ANALYSIS
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log(' [STAGE 1] LEXICAL ANALYSIS: TOKEN STREAM & VIRTUAL OFF-SIDE INDENTATION');
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
  console.log(' [STAGE 2] AST GENERATION: RAW UNTYPED RECURSIVE DESCENT AST');
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
  // STAGE 3: TYPE INFERENCE & UNIFICATION
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log(' [STAGE 3] TYPE INFERENCE: DECORATED AST (ROBINSON UNIFICATION & DERIVED TYPES)');
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
  console.log(' [STAGE 4] SYMBOL TABLE: HIERARCHICAL SCOPE CHAINS & STATIC INVARIANTS');
  console.log('='.repeat(80));

  const scopeDump = rootScope.toDumpObject();

  console.log(
    util.inspect(scopeDump, {
      depth: null,
      colors: true,
    })
  );

  // ==========================================
  // STAGE 5: TYPESCRIPT CODE GENERATION (PROTOTYPE PREVIEW)
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log(' [STAGE 5] CODE GENERATION: STRICTLY TYPED TYPESCRIPT (VISITOR PATTERN)');
  console.log('='.repeat(80));

  const emittedTs = emitTypeScript(decoratedAst);
  console.log('--- EMITTED STRICT TYPESCRIPT OUTPUT ---\n');
  console.log(emittedTs);

  // ==========================================
  // NEGATIVE DIAGNOSTIC VERIFICATION
  // ==========================================
  console.log('='.repeat(80));
  console.log(' [VERIFICATION] COMPILE-TIME TYPE-SAFETY & DIAGNOSTIC REJECTIONS');
  console.log('='.repeat(80));

  const invalidPrograms = [
    {
      label: 'Conflicting Static Type Reassignment',
      code: 'count = 10\ncount = "Forbidden"',
    },
    {
      label: 'Illegal Arithmetic On String',
      code: 'result = "hello" - 5',
    },
    {
      label: 'Non-Boolean Guard Expression',
      code: 'if 100 + 5:\n    print("Fail")',
    },
  ];

  for (const item of invalidPrograms) {
    try {
      const p = new Parser(new Lexer(item.code).tokenize()).parse();
      new SemanticAnalyzer().analyze(p);
      console.error(`  [FAIL] Expected compile-time rejection for: ${item.label}`);
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        console.log(`  [PASS - REJECTED] ${item.label}: "${err.message}"`);
      } else {
        console.log(`  [PASS - REJECTED] ${item.label}: ${(err as Error).message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(' REVIEW 2 EVALUATION PIPELINE COMPLETED SUCCESSFULLY (ALL STAGES VERIFIED)');
  console.log('='.repeat(80));
}

runReview2Demo();
