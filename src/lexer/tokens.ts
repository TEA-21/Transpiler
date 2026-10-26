import { SourceLocation } from '../errors/diagnostic.js';

export enum TokenType {
  // Keywords
  KEYWORD_IF = 'KEYWORD_IF',
  KEYWORD_ELIF = 'KEYWORD_ELIF',
  KEYWORD_ELSE = 'KEYWORD_ELSE',
  KEYWORD_WHILE = 'KEYWORD_WHILE',
  KEYWORD_DEF = 'KEYWORD_DEF',
  KEYWORD_RETURN = 'KEYWORD_RETURN',
  KEYWORD_PRINT = 'KEYWORD_PRINT',
  KEYWORD_TRUE = 'KEYWORD_TRUE',
  KEYWORD_FALSE = 'KEYWORD_FALSE',
  KEYWORD_AND = 'KEYWORD_AND',
  KEYWORD_OR = 'KEYWORD_OR',
  KEYWORD_NOT = 'KEYWORD_NOT',
  KEYWORD_NONE = 'KEYWORD_NONE',
  KEYWORD_IS = 'KEYWORD_IS',
  KEYWORD_FOR = 'KEYWORD_FOR',
  KEYWORD_IN = 'KEYWORD_IN',

  // Identifiers & Literals
  IDENTIFIER = 'IDENTIFIER',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',

  // Arithmetic Operators
  PLUS = 'PLUS',         // +
  MINUS = 'MINUS',       // -
  STAR = 'STAR',         // *
  SLASH = 'SLASH',       // /
  PERCENT = 'PERCENT',   // %

  // Comparison Operators
  EQ = 'EQ',             // ==
  NEQ = 'NEQ',           // !=
  LT = 'LT',             // <
  LTE = 'LTE',           // <=
  GT = 'GT',             // >
  GTE = 'GTE',           // >=

  // Assignment Operator
  ASSIGN = 'ASSIGN',     // =

  // Delimiters & Punctuation
  COLON = 'COLON',       // :
  LPAREN = 'LPAREN',     // (
  RPAREN = 'RPAREN',     // )
  LBRACKET = 'LBRACKET', // [
  RBRACKET = 'RBRACKET', // ]
  COMMA = 'COMMA',       // ,

  // Off-Side Indentation and Layout
  NEWLINE = 'NEWLINE',
  INDENT = 'INDENT',
  DEDENT = 'DEDENT',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  raw: string;
  loc: SourceLocation;
}

export const KEYWORDS: Record<string, TokenType> = {
  if: TokenType.KEYWORD_IF,
  elif: TokenType.KEYWORD_ELIF,
  else: TokenType.KEYWORD_ELSE,
  while: TokenType.KEYWORD_WHILE,
  def: TokenType.KEYWORD_DEF,
  return: TokenType.KEYWORD_RETURN,
  print: TokenType.KEYWORD_PRINT,
  True: TokenType.KEYWORD_TRUE,
  False: TokenType.KEYWORD_FALSE,
  and: TokenType.KEYWORD_AND,
  or: TokenType.KEYWORD_OR,
  not: TokenType.KEYWORD_NOT,
  None: TokenType.KEYWORD_NONE,
  is: TokenType.KEYWORD_IS,
  for: TokenType.KEYWORD_FOR,
  in: TokenType.KEYWORD_IN,
};
