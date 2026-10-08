import { SourceLocation } from '../errors/diagnostic.js';
import { Type } from './types.js';

export type SymbolKind = 'variable' | 'function' | 'parameter';

export interface Symbol {
  name: string;
  kind: SymbolKind;
  type: Type;
  loc: SourceLocation;
  isMutable: boolean;
}

export type ScopeType = 'global' | 'function' | 'block' | 'loop';

export class Scope {
  public readonly name: string;
  public readonly scopeType: ScopeType;
  public readonly parent: Scope | null;
  private readonly symbols: Map<string, Symbol> = new Map();

  constructor(name: string, scopeType: ScopeType, parent: Scope | null = null) {
    this.name = name;
    this.scopeType = scopeType;
    this.parent = parent;
  }

  public define(symbol: Symbol): void {
    this.symbols.set(symbol.name, symbol);
  }

  public resolve(name: string): Symbol | undefined {
    const symbol = this.symbols.get(name);
    if (symbol) {
      return symbol;
    }
    return this.parent?.resolve(name);
  }

  public resolveCurrent(name: string): Symbol | undefined {
    return this.symbols.get(name);
  }

  public hasCurrent(name: string): boolean {
    return this.symbols.has(name);
  }

  public has(name: string): boolean {
    return this.resolve(name) !== undefined;
  }

  public createChildScope(name: string, scopeType: ScopeType): Scope {
    return new Scope(name, scopeType, this);
  }

  public getAllSymbols(): Map<string, Symbol> {
    return new Map(this.symbols);
  }
}
