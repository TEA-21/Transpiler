import { SourceLocation } from '../errors/diagnostic.js';
import { VariableDeclaration } from '../parser/ast.js';
import { Type, typeToString } from './types.js';

export type SymbolKind = 'variable' | 'function' | 'parameter';

export interface Symbol {
  name: string;
  kind: SymbolKind;
  type: Type;
  currentType?: Type;
  loc: SourceLocation;
  isMutable: boolean;
  declarationNode?: VariableDeclaration;
}

export type ScopeType = 'global' | 'function' | 'block' | 'loop';

export interface ScopeDump {
  scopeName: string;
  scopeType: ScopeType;
  symbols: Record<string, { kind: SymbolKind; type: string; isMutable: boolean }>;
  children: ScopeDump[];
}

export class Scope {
  public readonly name: string;
  public readonly scopeType: ScopeType;
  public readonly parent: Scope | null;
  public readonly children: Scope[] = [];
  private readonly symbols: Map<string, Symbol> = new Map();

  constructor(name: string, scopeType: ScopeType, parent: Scope | null = null) {
    this.name = name;
    this.scopeType = scopeType;
    this.parent = parent;
  }

  public define(symbol: Symbol): void {
    this.symbols.set(symbol.name, symbol);
  }

  public narrow(name: string, narrowedType: Type): void {
    const original = this.resolve(name);
    if (original) {
      this.symbols.set(name, {
        ...original,
        currentType: narrowedType,
      });
    }
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
    const child = new Scope(name, scopeType, this);
    this.children.push(child);
    return child;
  }

  public getAllSymbols(): Map<string, Symbol> {
    return new Map(this.symbols);
  }

  public toDumpObject(): ScopeDump {
    const symbolsObj: Record<string, { kind: SymbolKind; type: string; isMutable: boolean }> = {};
    for (const [name, sym] of this.symbols) {
      symbolsObj[name] = {
        kind: sym.kind,
        type: typeToString(sym.type),
        isMutable: sym.isMutable,
      };
    }
    return {
      scopeName: this.name,
      scopeType: this.scopeType,
      symbols: symbolsObj,
      children: this.children.map((c) => c.toDumpObject()),
    };
  }
}
