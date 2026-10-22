import { describe, it, expect } from 'vitest';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/tokens.js';
import { IndentationError, LexerError } from '../src/errors/diagnostic.js';

describe('Lexer', () => {
  it('tokenizes primitive variable bindings', () => {
    const input = [
      'count = 10',
      'name = "Alice"',
      'is_valid = True',
      'ratio = 3.14',
      'flag = False',
    ].join('\n');

    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    const types = tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.IDENTIFIER,
      TokenType.ASSIGN,
      TokenType.NUMBER,
      TokenType.NEWLINE,

      TokenType.IDENTIFIER,
      TokenType.ASSIGN,
      TokenType.STRING,
      TokenType.NEWLINE,

      TokenType.IDENTIFIER,
      TokenType.ASSIGN,
      TokenType.BOOLEAN,
      TokenType.NEWLINE,

      TokenType.IDENTIFIER,
      TokenType.ASSIGN,
      TokenType.NUMBER,
      TokenType.NEWLINE,

      TokenType.IDENTIFIER,
      TokenType.ASSIGN,
      TokenType.BOOLEAN,
      TokenType.NEWLINE,

      TokenType.EOF,
    ]);

    expect(tokens[2]?.value).toBe('10');
    expect(tokens[6]?.value).toBe('Alice');
    expect(tokens[10]?.value).toBe('true');
    expect(tokens[14]?.value).toBe('3.14');
    expect(tokens[18]?.value).toBe('false');
  });

  it('tokenizes arithmetic expressions and parentheses', () => {
    const input = 'total = (5 + 3) * 2 / 4 % 1';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    const types = tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.IDENTIFIER,
      TokenType.ASSIGN,
      TokenType.LPAREN,
      TokenType.NUMBER,
      TokenType.PLUS,
      TokenType.NUMBER,
      TokenType.RPAREN,
      TokenType.STAR,
      TokenType.NUMBER,
      TokenType.SLASH,
      TokenType.NUMBER,
      TokenType.PERCENT,
      TokenType.NUMBER,
      TokenType.NEWLINE,
      TokenType.EOF,
    ]);
  });

  it('tokenizes comparison and logical operators', () => {
    const input = 'a == b != c < d <= e > f >= g and not h or i';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    const types = tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.IDENTIFIER,
      TokenType.EQ,
      TokenType.IDENTIFIER,
      TokenType.NEQ,
      TokenType.IDENTIFIER,
      TokenType.LT,
      TokenType.IDENTIFIER,
      TokenType.LTE,
      TokenType.IDENTIFIER,
      TokenType.GT,
      TokenType.IDENTIFIER,
      TokenType.GTE,
      TokenType.IDENTIFIER,
      TokenType.KEYWORD_AND,
      TokenType.KEYWORD_NOT,
      TokenType.IDENTIFIER,
      TokenType.KEYWORD_OR,
      TokenType.IDENTIFIER,
      TokenType.NEWLINE,
      TokenType.EOF,
    ]);
  });

  it('correctly tracks line and column diagnostic positions', () => {
    const input = 'x = 42\ny = "hi"';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    expect(tokens[0]?.loc).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 2 },
    });
    expect(tokens[1]?.loc).toEqual({
      start: { line: 1, column: 3 },
      end: { line: 1, column: 4 },
    });
    expect(tokens[2]?.loc).toEqual({
      start: { line: 1, column: 5 },
      end: { line: 1, column: 7 },
    });
    // y on line 2
    expect(tokens[4]?.loc).toEqual({
      start: { line: 2, column: 1 },
      end: { line: 2, column: 2 },
    });
  });

  it('emits virtual INDENT and DEDENT tokens for conditionals', () => {
    const input = [
      'if total > 10:',
      '    print("High")',
      'else:',
      '    print("Low")',
    ].join('\n');

    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    const types = tokens.map((t) => t.type);
    expect(types).toEqual([
      TokenType.KEYWORD_IF,
      TokenType.IDENTIFIER,
      TokenType.GT,
      TokenType.NUMBER,
      TokenType.COLON,
      TokenType.NEWLINE,
      TokenType.INDENT,
      TokenType.KEYWORD_PRINT,
      TokenType.LPAREN,
      TokenType.STRING,
      TokenType.RPAREN,
      TokenType.NEWLINE,
      TokenType.DEDENT,
      TokenType.KEYWORD_ELSE,
      TokenType.COLON,
      TokenType.NEWLINE,
      TokenType.INDENT,
      TokenType.KEYWORD_PRINT,
      TokenType.LPAREN,
      TokenType.STRING,
      TokenType.RPAREN,
      TokenType.NEWLINE,
      TokenType.DEDENT,
      TokenType.EOF,
    ]);
  });

  it('handles multiple nested indentation levels with cascade DEDENTs', () => {
    const input = [
      'if a > 0:',
      '    if b > 0:',
      '        print("nested")',
      'print("done")',
    ].join('\n');

    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    const types = tokens.map((t) => t.type);
    expect(types).toContain(TokenType.INDENT);
    expect(types).toContain(TokenType.DEDENT);

    // After nested print("nested")\n, there should be 2 DEDENTs before print("done")
    const printDoneIndex = tokens.findIndex(
      (t) => t.type === TokenType.KEYWORD_PRINT && t.loc.start.line === 4
    );
    expect(printDoneIndex).toBeGreaterThan(0);
    expect(tokens[printDoneIndex - 1]?.type).toBe(TokenType.DEDENT);
    expect(tokens[printDoneIndex - 2]?.type).toBe(TokenType.DEDENT);
  });

  it('handles blank lines and comment lines within indented blocks without altering indentation', () => {
    const input = [
      'if total > 10:',
      '    # Comment 1',
      '    x = 1',
      '',
      '    # Comment 2',
      '    y = 2',
    ].join('\n');

    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    // Should only have 1 INDENT at start, and 1 DEDENT at EOF
    const indents = tokens.filter((t) => t.type === TokenType.INDENT);
    const dedents = tokens.filter((t) => t.type === TokenType.DEDENT);
    expect(indents.length).toBe(1);
    expect(dedents.length).toBe(1);
  });

  it('throws IndentationError on inconsistent unindent level', () => {
    const input = [
      'if total > 10:',
      '    x = 1',
      '  y = 2',
    ].join('\n');

    const lexer = new Lexer(input);
    expect(() => lexer.tokenize()).toThrowError(IndentationError);
  });

  it('throws LexerError on unterminated string', () => {
    const input = 'x = "unclosed';
    const lexer = new Lexer(input);
    expect(() => lexer.tokenize()).toThrowError(LexerError);
  });

  it('handles escaped characters in strings correctly', () => {
    const input = 'msg = "hello\\nworld \\"escaped\\""';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    expect(tokens[2]?.type).toBe(TokenType.STRING);
    expect(tokens[2]?.value).toBe('hello\nworld "escaped"');
  });

  it('scans None, is, and is not keywords correctly', () => {
    const input = 'val = None\ncheck = val is None\nnot_check = val is not None';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    const types = tokens.map((t) => t.type);
    expect(types).toContain(TokenType.KEYWORD_NONE);
    expect(types).toContain(TokenType.KEYWORD_IS);
    expect(types).toContain(TokenType.KEYWORD_NOT);
  });
});
