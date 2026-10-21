import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';
import { SemanticAnalyzer } from '../semantics/analyzer.js';
import { emitTypeScript } from '../codegen/emitter.js';
import { TokenType } from '../lexer/tokens.js';
import { TranspilerError } from '../errors/diagnostic.js';

const PORT = 3000;
const PUBLIC_DIR = path.resolve(process.cwd(), 'src', 'ui', 'public');

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'text/plain; charset=utf-8';
  }
}

function handleTranspile(source: string): Record<string, unknown> {
  const start = performance.now();
  try {
    // Stage 1: Lexer
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const formattedTokens = tokens.map((t) => ({
      type: t.type,
      value: t.value,
      raw: t.raw,
      line: t.loc.start.line,
      column: t.loc.start.column,
      isVirtual: t.type === TokenType.INDENT || t.type === TokenType.DEDENT,
    }));

    const virtualIndents = tokens.filter((t) => t.type === TokenType.INDENT).length;
    const virtualDedents = tokens.filter((t) => t.type === TokenType.DEDENT).length;

    // Stage 2: Parser
    const parser = new Parser(tokens);
    const rawAst = parser.parse();

    // Stage 3 & 4: Semantic Analysis & Symbol Table
    const analyzer = new SemanticAnalyzer();
    const { rootScope, program: decoratedAst } = analyzer.analyze(rawAst);
    const scopeDump = rootScope.toDumpObject();

    // Stage 5: Emitter
    const tsCode = emitTypeScript(decoratedAst);
    const elapsed = Number((performance.now() - start).toFixed(2));

    return {
      success: true,
      latencyMs: elapsed,
      metrics: {
        tokenCount: tokens.length,
        virtualIndents,
        virtualDedents,
        astStatementCount: decoratedAst.body.length,
      },
      tokens: formattedTokens,
      rawAst,
      decoratedAst,
      symbolTable: scopeDump,
      tsCode,
    };
  } catch (err: unknown) {
    const elapsed = Number((performance.now() - start).toFixed(2));
    if (err instanceof TranspilerError) {
      return {
        success: false,
        latencyMs: elapsed,
        errorType: err.name,
        message: err.message,
        line: err.position.line,
        column: err.position.column,
      };
    }

    return {
      success: false,
      latencyMs: elapsed,
      errorType: 'CompilerError',
      message: (err as Error).message || String(err),
      line: 1,
      column: 1,
    };
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API endpoint for transpilation
  if (req.method === 'POST' && pathname === '/api/transpile') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const source = typeof payload.source === 'string' ? payload.source : '';
        const result = handleTranspile(source);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(result));
      } catch (err: unknown) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Invalid JSON request payload' }));
      }
    });
    return;
  }

  // Pre-flight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // Static file serving
  let targetPath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check to avoid path traversal
  if (!targetPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    res.writeHead(200, { 'Content-Type': getMimeType(targetPath) });
    fs.createReadStream(targetPath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` MINI-PYTHON TRANSPILER WORKBENCH SERVER RUNNING`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
