import { SourceLocation } from '../errors/diagnostic.js';

export interface BaseNode {
  type: string;
  loc: SourceLocation;
}

export interface Program extends BaseNode {
  type: 'Program';
  body: Statement[];
}

export type Statement =
  | VariableDeclaration
  | IfStatement
  | WhileStatement
  | FunctionDeclaration
  | ReturnStatement
  | BlockStatement
  | ExpressionStatement;

export interface VariableDeclaration extends BaseNode {
  type: 'VariableDeclaration';
  id: Identifier;
  init: Expression;
  inferredType?: string;
}

export interface IfStatement extends BaseNode {
  type: 'IfStatement';
  test: Expression;
  consequent: BlockStatement;
  alternate: IfStatement | BlockStatement | null;
}

export interface WhileStatement extends BaseNode {
  type: 'WhileStatement';
  test: Expression;
  body: BlockStatement;
}

export interface FunctionDeclaration extends BaseNode {
  type: 'FunctionDeclaration';
  id: Identifier;
  params: Identifier[];
  body: BlockStatement;
  inferredReturnType?: string;
  inferredParamTypes?: Record<string, string>;
}

export interface ReturnStatement extends BaseNode {
  type: 'ReturnStatement';
  argument: Expression | null;
}

export interface BlockStatement extends BaseNode {
  type: 'BlockStatement';
  body: Statement[];
}

export interface ExpressionStatement extends BaseNode {
  type: 'ExpressionStatement';
  expression: Expression;
}

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'and'
  | 'or';

export interface BinaryExpression extends BaseNode {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export type UnaryOperator = '-' | '+' | 'not';

export interface UnaryExpression extends BaseNode {
  type: 'UnaryExpression';
  operator: UnaryOperator;
  argument: Expression;
}

export interface Identifier extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface NumericLiteral extends BaseNode {
  type: 'NumericLiteral';
  value: number;
  raw: string;
}

export interface StringLiteral extends BaseNode {
  type: 'StringLiteral';
  value: string;
  raw: string;
}

export interface BooleanLiteral extends BaseNode {
  type: 'BooleanLiteral';
  value: boolean;
  raw: string;
}

export type Literal = NumericLiteral | StringLiteral | BooleanLiteral;

export interface ArrayLiteral extends BaseNode {
  type: 'ArrayLiteral';
  elements: Expression[];
  inferredElementType?: string;
}

export interface IndexExpression extends BaseNode {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
}

export interface CallExpression extends BaseNode {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | IndexExpression
  | ArrayLiteral
  | Identifier
  | Literal;

export type ASTNode = Program | Statement | Expression;
