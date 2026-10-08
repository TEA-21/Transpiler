export interface Position {
  line: number;
  column: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export class TranspilerError extends Error {
  public readonly position: Position;

  constructor(message: string, position: Position, errorName = 'TranspilerError') {
    super(`[${position.line}:${position.column}] ${message}`);
    this.name = errorName;
    this.position = position;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LexerError extends TranspilerError {
  constructor(message: string, position: Position) {
    super(message, position, 'LexerError');
  }
}

export class IndentationError extends TranspilerError {
  constructor(message: string, position: Position) {
    super(message, position, 'IndentationError');
  }
}

export class ParserError extends TranspilerError {
  constructor(message: string, position: Position) {
    super(message, position, 'ParserError');
  }
}

export class SemanticError extends TranspilerError {
  constructor(message: string, position: Position) {
    super(message, position, 'SemanticError');
  }
}

export class TypeError extends TranspilerError {
  constructor(message: string, position: Position) {
    super(message, position, 'TypeError');
  }
}
