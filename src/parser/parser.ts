import { ParserError } from '../errors/diagnostic.js';
import { Token, TokenType } from '../lexer/tokens.js';
import {
  ArrayLiteral,
  BinaryOperator,
  BlockStatement,
  BooleanLiteral,
  CallExpression,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  Identifier,
  IfStatement,
  IndexExpression,
  NumericLiteral,
  Program,
  ReturnStatement,
  Statement,
  StringLiteral,
  UnaryOperator,
  VariableDeclaration,
  WhileStatement,
} from './ast.js';

export class Parser {
  private readonly tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): Program {
    const startLoc = this.peek().loc.start;
    const body: Statement[] = [];

    this.skipNewlines();

    while (!this.isAtEnd()) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }

    const endLoc = this.previous().loc.end;
    return {
      type: 'Program',
      body,
      loc: { start: startLoc, end: endLoc },
    };
  }

  private parseStatement(): Statement {
    this.skipNewlines();

    if (this.match(TokenType.KEYWORD_IF)) {
      return this.parseIfStatement();
    }

    if (this.match(TokenType.KEYWORD_WHILE)) {
      return this.parseWhileStatement();
    }

    if (this.match(TokenType.KEYWORD_DEF)) {
      return this.parseFunctionDeclaration();
    }

    if (this.match(TokenType.KEYWORD_RETURN)) {
      return this.parseReturnStatement();
    }

    // Check for variable declaration / assignment: IDENTIFIER = expression
    if (this.check(TokenType.IDENTIFIER) && this.checkAhead(1, TokenType.ASSIGN)) {
      return this.parseVariableDeclaration();
    }

    return this.parseExpressionStatement();
  }

  private parseVariableDeclaration(): VariableDeclaration {
    const idToken = this.consume(TokenType.IDENTIFIER, 'Expected variable identifier');
    const startLoc = idToken.loc.start;

    const id: Identifier = {
      type: 'Identifier',
      name: idToken.value,
      loc: idToken.loc,
    };

    this.consume(TokenType.ASSIGN, "Expected '=' after variable identifier");
    const init = this.parseExpression();

    this.consumeStatementTerminator();

    return {
      type: 'VariableDeclaration',
      id,
      init,
      loc: { start: startLoc, end: init.loc.end },
    };
  }

  private parseIfStatement(): IfStatement {
    const ifToken = this.previous();
    const startLoc = ifToken.loc.start;

    const test = this.parseExpression();
    this.consume(TokenType.COLON, "Expected ':' after if condition");
    this.consumeStatementTerminator();

    const consequent = this.parseBlock();
    let alternate: IfStatement | BlockStatement | null = null;

    this.skipNewlines();

    if (this.match(TokenType.KEYWORD_ELIF)) {
      alternate = this.parseIfStatement();
    } else if (this.match(TokenType.KEYWORD_ELSE)) {
      this.consume(TokenType.COLON, "Expected ':' after else");
      this.consumeStatementTerminator();
      alternate = this.parseBlock();
    }

    const endLoc = alternate ? alternate.loc.end : consequent.loc.end;

    return {
      type: 'IfStatement',
      test,
      consequent,
      alternate,
      loc: { start: startLoc, end: endLoc },
    };
  }

  private parseWhileStatement(): WhileStatement {
    const whileToken = this.previous();
    const startLoc = whileToken.loc.start;

    const test = this.parseExpression();
    this.consume(TokenType.COLON, "Expected ':' after while condition");
    this.consumeStatementTerminator();

    const body = this.parseBlock();

    return {
      type: 'WhileStatement',
      test,
      body,
      loc: { start: startLoc, end: body.loc.end },
    };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const defToken = this.previous();
    const startLoc = defToken.loc.start;

    const idToken = this.consume(TokenType.IDENTIFIER, "Expected function name after 'def'");
    const id: Identifier = {
      type: 'Identifier',
      name: idToken.value,
      loc: idToken.loc,
    };

    this.consume(TokenType.LPAREN, "Expected '(' after function name");
    const params: Identifier[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        this.skipNewlines();
        if (this.check(TokenType.RPAREN)) {
          break;
        }
        const paramToken = this.consume(TokenType.IDENTIFIER, 'Expected parameter identifier');
        params.push({
          type: 'Identifier',
          name: paramToken.value,
          loc: paramToken.loc,
        });
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RPAREN, "Expected ')' after parameter list");
    this.consume(TokenType.COLON, "Expected ':' after function signature");
    this.consumeStatementTerminator();

    const body = this.parseBlock();

    return {
      type: 'FunctionDeclaration',
      id,
      params,
      body,
      loc: { start: startLoc, end: body.loc.end },
    };
  }

  private parseReturnStatement(): ReturnStatement {
    const retToken = this.previous();
    const startLoc = retToken.loc.start;

    let argument: Expression | null = null;
    if (!this.check(TokenType.NEWLINE) && !this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      argument = this.parseExpression();
    }

    this.consumeStatementTerminator();

    return {
      type: 'ReturnStatement',
      argument,
      loc: { start: startLoc, end: argument ? argument.loc.end : retToken.loc.end },
    };
  }

  private parseBlock(): BlockStatement {
    const indentToken = this.consume(TokenType.INDENT, 'Expected indented block');
    const startLoc = indentToken.loc.start;
    const body: Statement[] = [];

    this.skipNewlines();

    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }

    const dedentToken = this.consume(TokenType.DEDENT, "Expected 'DEDENT' to close block");
    const endLoc = dedentToken.loc.end;

    return {
      type: 'BlockStatement',
      body,
      loc: { start: startLoc, end: endLoc },
    };
  }

  private parseExpressionStatement(): ExpressionStatement {
    const expr = this.parseExpression();
    this.consumeStatementTerminator();

    return {
      type: 'ExpressionStatement',
      expression: expr,
      loc: expr.loc,
    };
  }

  // --- Expression Parsing (Precedence Climbing) ---

  public parseExpression(): Expression {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expression {
    let expr = this.parseLogicalAnd();

    while (this.match(TokenType.KEYWORD_OR)) {
      const op = 'or' as BinaryOperator;
      const right = this.parseLogicalAnd();
      expr = {
        type: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc: { start: expr.loc.start, end: right.loc.end },
      };
    }

    return expr;
  }

  private parseLogicalAnd(): Expression {
    let expr = this.parseComparison();

    while (this.match(TokenType.KEYWORD_AND)) {
      const op = 'and' as BinaryOperator;
      const right = this.parseComparison();
      expr = {
        type: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc: { start: expr.loc.start, end: right.loc.end },
      };
    }

    return expr;
  }

  private parseComparison(): Expression {
    let expr = this.parseAdditive();

    while (
      this.match(
        TokenType.EQ,
        TokenType.NEQ,
        TokenType.LT,
        TokenType.LTE,
        TokenType.GT,
        TokenType.GTE
      )
    ) {
      const opToken = this.previous();
      const op = opToken.value as BinaryOperator;
      const right = this.parseAdditive();
      expr = {
        type: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc: { start: expr.loc.start, end: right.loc.end },
      };
    }

    return expr;
  }

  private parseAdditive(): Expression {
    let expr = this.parseMultiplicative();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const opToken = this.previous();
      const op = (opToken.value === '+' ? '+' : '-') as BinaryOperator;
      const right = this.parseMultiplicative();
      expr = {
        type: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc: { start: expr.loc.start, end: right.loc.end },
      };
    }

    return expr;
  }

  private parseMultiplicative(): Expression {
    let expr = this.parseUnary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const opToken = this.previous();
      const op = opToken.value as BinaryOperator;
      const right = this.parseUnary();
      expr = {
        type: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc: { start: expr.loc.start, end: right.loc.end },
      };
    }

    return expr;
  }

  private parseUnary(): Expression {
    if (this.match(TokenType.MINUS, TokenType.PLUS, TokenType.KEYWORD_NOT)) {
      const opToken = this.previous();
      const op = (opToken.value === 'not' ? 'not' : opToken.value) as UnaryOperator;
      const argument = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: op,
        argument,
        loc: { start: opToken.loc.start, end: argument.loc.end },
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    let expr: Expression;
    const token = this.peek();

    // Numeric Literal
    if (this.match(TokenType.NUMBER)) {
      const numToken = this.previous();
      const numVal: NumericLiteral = {
        type: 'NumericLiteral',
        value: Number(numToken.value),
        raw: numToken.raw,
        loc: numToken.loc,
      };
      expr = numVal;
    } else if (this.match(TokenType.STRING)) {
      // String Literal
      const strToken = this.previous();
      const strVal: StringLiteral = {
        type: 'StringLiteral',
        value: strToken.value,
        raw: strToken.raw,
        loc: strToken.loc,
      };
      expr = strVal;
    } else if (this.match(TokenType.BOOLEAN)) {
      // Boolean Literal
      const boolToken = this.previous();
      const boolVal: BooleanLiteral = {
        type: 'BooleanLiteral',
        value: boolToken.value === 'true',
        raw: boolToken.raw,
        loc: boolToken.loc,
      };
      expr = boolVal;
    } else if (this.match(TokenType.IDENTIFIER, TokenType.KEYWORD_PRINT)) {
      // Identifier (or print)
      const idToken = this.previous();
      const idVal: Identifier = {
        type: 'Identifier',
        name: idToken.value,
        loc: idToken.loc,
      };
      expr = idVal;
    } else if (this.match(TokenType.LBRACKET)) {
      // Array Literal
      const startLoc = this.previous().loc.start;
      const elements: Expression[] = [];

      if (!this.check(TokenType.RBRACKET)) {
        do {
          this.skipNewlines();
          if (this.check(TokenType.RBRACKET)) {
            break;
          }
          elements.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }

      const rbracket = this.consume(TokenType.RBRACKET, "Expected ']' to close array literal");
      const arrVal: ArrayLiteral = {
        type: 'ArrayLiteral',
        elements,
        loc: { start: startLoc, end: rbracket.loc.end },
      };
      expr = arrVal;
    } else if (this.match(TokenType.LPAREN)) {
      // Parenthesized Group
      const startLoc = this.previous().loc.start;
      const inner = this.parseExpression();
      const closingParen = this.consume(
        TokenType.RPAREN,
        "Expected ')' after parenthesized expression"
      );
      expr = {
        ...inner,
        loc: { start: startLoc, end: closingParen.loc.end },
      };
    } else {
      throw new ParserError(
        `Unexpected token '${token.value || token.type}'`,
        token.loc.start
      );
    }

    return this.parsePostfix(expr);
  }

  private parsePostfix(expr: Expression): Expression {
    while (true) {
      if (this.match(TokenType.LPAREN)) {
        expr = this.finishCallExpression(expr);
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.parseExpression();
        const rbracket = this.consume(TokenType.RBRACKET, "Expected ']' after index expression");
        const idxExpr: IndexExpression = {
          type: 'IndexExpression',
          object: expr,
          index,
          loc: { start: expr.loc.start, end: rbracket.loc.end },
        };
        expr = idxExpr;
      } else {
        break;
      }
    }
    return expr;
  }

  private finishCallExpression(callee: Expression): CallExpression {
    const args: Expression[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        this.skipNewlines();
        if (this.check(TokenType.RPAREN)) {
          break;
        }
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    const rparen = this.consume(TokenType.RPAREN, "Expected ')' after function arguments");

    return {
      type: 'CallExpression',
      callee,
      arguments: args,
      loc: { start: callee.loc.start, end: rparen.loc.end },
    };
  }

  // --- Helper Methods ---

  private consumeStatementTerminator(): void {
    if (this.isAtEnd()) {
      return;
    }
    if (this.match(TokenType.NEWLINE)) {
      return;
    }
    if (this.check(TokenType.DEDENT)) {
      return;
    }
    const token = this.peek();
    throw new ParserError(
      `Expected newline or end of statement, got '${token.value || token.type}'`,
      token.loc.start
    );
  }

  private skipNewlines(): void {
    while (this.match(TokenType.NEWLINE)) {
      // Intentionally empty
    }
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) {
      return type === TokenType.EOF;
    }
    return this.peek().type === type;
  }

  private checkAhead(offset: number, type: TokenType): boolean {
    const index = this.current + offset;
    if (index >= this.tokens.length) {
      return false;
    }
    return this.tokens[index]?.type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return (
      this.tokens[this.current] ?? {
        type: TokenType.EOF,
        value: '',
        raw: '',
        loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
      }
    );
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? this.peek();
  }

  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new ParserError(errorMessage, token.loc.start);
  }
}
