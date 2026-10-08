import { IndentationError, LexerError, Position } from '../errors/diagnostic.js';
import { KEYWORDS, Token, TokenType } from './tokens.js';

export class Lexer {
  private readonly source: string;
  private pos = 0;
  private line = 1;
  private column = 1;

  private readonly indentStack: number[] = [0];
  private parenDepth = 0;
  private bracketDepth = 0;
  private atLineStart = true;
  private readonly tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  public tokenize(): Token[] {
    while (!this.isAtEnd()) {
      if (this.atLineStart && this.parenDepth === 0 && this.bracketDepth === 0) {
        this.handleIndentation();
        if (this.isAtEnd()) {
          break;
        }
      }

      this.scanToken();
    }

    this.finalizeTokens();
    return this.tokens;
  }

  private handleIndentation(): void {
    const indentLine = this.line;
    let indentCol = 0;
    let lookahead = this.pos;

    // Count indentation on current line
    while (lookahead < this.source.length) {
      const ch = this.source[lookahead];
      if (ch === ' ') {
        indentCol += 1;
        lookahead++;
      } else if (ch === '\t') {
        indentCol += 4 - (indentCol % 4);
        lookahead++;
      } else {
        break;
      }
    }

    // Check if the rest of line is empty or a comment
    if (lookahead < this.source.length) {
      const nextChar = this.source[lookahead];
      if (nextChar === '\r' || nextChar === '\n' || nextChar === '#') {
        // Advance pos to lookahead and let regular scanner skip comments/newlines
        this.advanceTo(lookahead);
        this.skipWhitespaceAndComments();
        return;
      }
    } else {
      // Reached EOF during leading whitespace
      this.advanceTo(lookahead);
      return;
    }

    // Line has content; apply indentation
    this.advanceTo(lookahead);
    this.atLineStart = false;

    const currentTop = this.indentStack[this.indentStack.length - 1] ?? 0;
    if (indentCol > currentTop) {
      this.indentStack.push(indentCol);
      this.tokens.push({
        type: TokenType.INDENT,
        value: 'INDENT',
        raw: this.source.slice(this.pos - indentCol, this.pos),
        loc: {
          start: { line: indentLine, column: 1 },
          end: { line: indentLine, column: indentCol + 1 },
        },
      });
    } else if (indentCol < currentTop) {
      while (
        this.indentStack.length > 0 &&
        (this.indentStack[this.indentStack.length - 1] ?? 0) > indentCol
      ) {
        this.indentStack.pop();
        this.tokens.push({
          type: TokenType.DEDENT,
          value: 'DEDENT',
          raw: '',
          loc: {
            start: { line: indentLine, column: 1 },
            end: { line: indentLine, column: indentCol + 1 },
          },
        });
      }

      const newTop = this.indentStack[this.indentStack.length - 1] ?? 0;
      if (newTop !== indentCol) {
        throw new IndentationError(
          `Unindent does not match any outer indentation level (expected ${newTop}, found ${indentCol})`,
          { line: indentLine, column: indentCol + 1 }
        );
      }
    }
  }

  private advanceTo(newPos: number): void {
    while (this.pos < newPos && this.pos < this.source.length) {
      this.advance();
    }
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t') {
        this.advance();
      } else if (ch === '#') {
        // Skip comment until newline or end of file
        while (!this.isAtEnd() && this.peek() !== '\n' && this.peek() !== '\r') {
          this.advance();
        }
      } else if (ch === '\r') {
        this.advance();
        if (this.peek() === '\n') {
          this.advance();
        }
        this.line++;
        this.column = 1;
        this.atLineStart = true;
        if (this.parenDepth === 0 && this.bracketDepth === 0) {
          this.handleIndentation();
        }
      } else if (ch === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
        this.atLineStart = true;
        if (this.parenDepth === 0 && this.bracketDepth === 0) {
          this.handleIndentation();
        }
      } else {
        break;
      }
    }
  }

  private scanToken(): void {
    const ch = this.peek();

    // Whitespace within the line
    if (ch === ' ' || ch === '\t') {
      this.advance();
      return;
    }

    // Inline comment
    if (ch === '#') {
      while (!this.isAtEnd() && this.peek() !== '\n' && this.peek() !== '\r') {
        this.advance();
      }
      return;
    }

    // Newlines
    if (ch === '\r' || ch === '\n') {
      const start = this.currentPosition();
      if (ch === '\r') {
        this.advance();
      }
      if (this.peek() === '\n') {
        this.advance();
      }
      const end = this.currentPosition();

      this.line++;
      this.column = 1;
      this.atLineStart = true;

      // Inside parentheses or brackets, newlines are ignored
      if (this.parenDepth > 0 || this.bracketDepth > 0) {
        return;
      }

      // Avoid consecutive NEWLINE tokens or NEWLINE right after INDENT
      const lastToken = this.tokens[this.tokens.length - 1];
      if (
        lastToken &&
        lastToken.type !== TokenType.NEWLINE &&
        lastToken.type !== TokenType.INDENT
      ) {
        this.tokens.push({
          type: TokenType.NEWLINE,
          value: '\n',
          raw: '\n',
          loc: { start, end },
        });
      }
      return;
    }

    const startPos = this.currentPosition();

    // String literals
    if (ch === '"' || ch === "'") {
      this.scanString(ch);
      return;
    }

    // Numeric literals
    if (this.isDigit(ch)) {
      this.scanNumber();
      return;
    }

    // Identifiers and keywords
    if (this.isAlphaOrUnderscore(ch)) {
      this.scanIdentifier();
      return;
    }

    // Delimiters and operators
    this.advance();

    // Check two-character operators
    if (ch === '=' && this.peek() === '=') {
      this.advance();
      this.addToken(TokenType.EQ, '==', '==', startPos);
      return;
    }
    if (ch === '!' && this.peek() === '=') {
      this.advance();
      this.addToken(TokenType.NEQ, '!=', '!=', startPos);
      return;
    }
    if (ch === '<' && this.peek() === '=') {
      this.advance();
      this.addToken(TokenType.LTE, '<=', '<=', startPos);
      return;
    }
    if (ch === '>' && this.peek() === '=') {
      this.advance();
      this.addToken(TokenType.GTE, '>=', '>=', startPos);
      return;
    }

    // Single-character tokens
    switch (ch) {
      case '=':
        this.addToken(TokenType.ASSIGN, '=', '=', startPos);
        break;
      case '<':
        this.addToken(TokenType.LT, '<', '<', startPos);
        break;
      case '>':
        this.addToken(TokenType.GT, '>', '>', startPos);
        break;
      case '+':
        this.addToken(TokenType.PLUS, '+', '+', startPos);
        break;
      case '-':
        this.addToken(TokenType.MINUS, '-', '-', startPos);
        break;
      case '*':
        this.addToken(TokenType.STAR, '*', '*', startPos);
        break;
      case '/':
        this.addToken(TokenType.SLASH, '/', '/', startPos);
        break;
      case '%':
        this.addToken(TokenType.PERCENT, '%', '%', startPos);
        break;
      case ':':
        this.addToken(TokenType.COLON, ':', ':', startPos);
        break;
      case '(':
        this.parenDepth++;
        this.addToken(TokenType.LPAREN, '(', '(', startPos);
        break;
      case ')':
        if (this.parenDepth > 0) {
          this.parenDepth--;
        }
        this.addToken(TokenType.RPAREN, ')', ')', startPos);
        break;
      case '[':
        this.bracketDepth++;
        this.addToken(TokenType.LBRACKET, '[', '[', startPos);
        break;
      case ']':
        if (this.bracketDepth > 0) {
          this.bracketDepth--;
        }
        this.addToken(TokenType.RBRACKET, ']', ']', startPos);
        break;
      case ',':
        this.addToken(TokenType.COMMA, ',', ',', startPos);
        break;
      default:
        throw new LexerError(`Unexpected character '${ch}'`, startPos);
    }
  }

  private scanString(quoteChar: string): void {
    const startPos = this.currentPosition();
    this.advance(); // consume opening quote
    let value = '';

    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === quoteChar) {
        this.advance(); // consume closing quote
        const endPos = this.currentPosition();
        this.tokens.push({
          type: TokenType.STRING,
          value,
          raw: this.source.slice(this.getIndexFromPos(startPos), this.pos),
          loc: { start: startPos, end: endPos },
        });
        return;
      }

      if (ch === '\n' || ch === '\r') {
        throw new LexerError('Unterminated string literal before end of line', startPos);
      }

      if (ch === '\\') {
        this.advance();
        if (this.isAtEnd()) {
          throw new LexerError('Unterminated escape sequence at end of file', startPos);
        }
        const escapeChar = this.peek();
        this.advance();
        switch (escapeChar) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          default:
            value += escapeChar;
            break;
        }
      } else {
        value += ch;
        this.advance();
      }
    }

    throw new LexerError('Unterminated string literal at end of file', startPos);
  }

  private scanNumber(): void {
    const startPos = this.currentPosition();
    const startIdx = this.pos;

    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      this.advance();
    }

    // Check for fractional part
    if (!this.isAtEnd() && this.peek() === '.' && this.pos + 1 < this.source.length && this.isDigit(this.source[this.pos + 1]!)) {
      this.advance(); // consume '.'
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const raw = this.source.slice(startIdx, this.pos);
    const endPos = this.currentPosition();
    this.tokens.push({
      type: TokenType.NUMBER,
      value: raw,
      raw,
      loc: { start: startPos, end: endPos },
    });
  }

  private scanIdentifier(): void {
    const startPos = this.currentPosition();
    const startIdx = this.pos;

    while (!this.isAtEnd() && (this.isAlphaOrUnderscore(this.peek()) || this.isDigit(this.peek()))) {
      this.advance();
    }

    const value = this.source.slice(startIdx, this.pos);
    const endPos = this.currentPosition();

    if (value === 'True' || value === 'False') {
      this.tokens.push({
        type: TokenType.BOOLEAN,
        value: value === 'True' ? 'true' : 'false',
        raw: value,
        loc: { start: startPos, end: endPos },
      });
      return;
    }

    const keywordType = KEYWORDS[value];
    if (keywordType) {
      this.tokens.push({
        type: keywordType,
        value,
        raw: value,
        loc: { start: startPos, end: endPos },
      });
      return;
    }

    this.tokens.push({
      type: TokenType.IDENTIFIER,
      value,
      raw: value,
      loc: { start: startPos, end: endPos },
    });
  }

  private addToken(type: TokenType, value: string, raw: string, startPos: Position): void {
    const endPos = this.currentPosition();
    this.tokens.push({
      type,
      value,
      raw,
      loc: { start: startPos, end: endPos },
    });
  }

  private finalizeTokens(): void {
    const lastToken = this.tokens[this.tokens.length - 1];

    // Emit trailing NEWLINE if not already ending in NEWLINE, INDENT, or DEDENT
    if (
      lastToken &&
      lastToken.type !== TokenType.NEWLINE &&
      lastToken.type !== TokenType.DEDENT
    ) {
      const pos = this.currentPosition();
      this.tokens.push({
        type: TokenType.NEWLINE,
        value: '\n',
        raw: '\n',
        loc: { start: pos, end: pos },
      });
    }

    // Dedent remaining indentation levels until stack returns to 0
    const endPos = this.currentPosition();
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.tokens.push({
        type: TokenType.DEDENT,
        value: 'DEDENT',
        raw: '',
        loc: { start: endPos, end: endPos },
      });
    }

    // Append EOF token
    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      raw: '',
      loc: { start: endPos, end: endPos },
    });
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlphaOrUnderscore(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private peek(): string {
    return this.source[this.pos] ?? '';
  }

  private advance(): string {
    const ch = this.source[this.pos] ?? '';
    this.pos++;
    this.column++;
    return ch;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private currentPosition(): Position {
    return { line: this.line, column: this.column };
  }

  private getIndexFromPos(pos: Position): number {
    let currLine = 1;
    let currCol = 1;
    for (let i = 0; i < this.source.length; i++) {
      if (currLine === pos.line && currCol === pos.column) {
        return i;
      }
      if (this.source[i] === '\n') {
        currLine++;
        currCol = 1;
      } else {
        currCol++;
      }
    }
    return this.source.length;
  }
}
