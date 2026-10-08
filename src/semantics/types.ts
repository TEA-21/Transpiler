export type PrimitiveTypeKind = 'number' | 'string' | 'boolean' | 'void';

export interface PrimitiveType {
  kind: 'primitive';
  name: PrimitiveTypeKind;
}

export interface ArrayType {
  kind: 'array';
  elementType: Type;
}

export interface FunctionType {
  kind: 'function';
  paramTypes: Type[];
  returnType: Type;
}

export interface TypeVar {
  kind: 'typevar';
  id: string;
  instance?: Type;
}

export type Type = PrimitiveType | ArrayType | FunctionType | TypeVar;

export const NUMBER_TYPE: PrimitiveType = { kind: 'primitive', name: 'number' };
export const STRING_TYPE: PrimitiveType = { kind: 'primitive', name: 'string' };
export const BOOLEAN_TYPE: PrimitiveType = { kind: 'primitive', name: 'boolean' };
export const VOID_TYPE: PrimitiveType = { kind: 'primitive', name: 'void' };

let typeVarCounter = 0;

export function resetTypeVarCounter(): void {
  typeVarCounter = 0;
}

export function createTypeVar(prefix = 'T'): TypeVar {
  typeVarCounter++;
  return {
    kind: 'typevar',
    id: `${prefix}${typeVarCounter}`,
  };
}

export function createArrayType(elementType: Type): ArrayType {
  return {
    kind: 'array',
    elementType,
  };
}

export function createFunctionType(paramTypes: Type[], returnType: Type): FunctionType {
  return {
    kind: 'function',
    paramTypes,
    returnType,
  };
}

export function prune(type: Type): Type {
  if (type.kind === 'typevar') {
    if (type.instance) {
      type.instance = prune(type.instance);
      return type.instance;
    }
    return type;
  }
  if (type.kind === 'array') {
    return {
      kind: 'array',
      elementType: prune(type.elementType),
    };
  }
  if (type.kind === 'function') {
    return {
      kind: 'function',
      paramTypes: type.paramTypes.map(prune),
      returnType: prune(type.returnType),
    };
  }
  return type;
}

export function typeToString(type: Type): string {
  const pruned = prune(type);
  switch (pruned.kind) {
    case 'primitive':
      return pruned.name;
    case 'array':
      return `${typeToString(pruned.elementType)}[]`;
    case 'function': {
      const params = pruned.paramTypes.map(typeToString).join(', ');
      return `(${params}) => ${typeToString(pruned.returnType)}`;
    }
    case 'typevar':
      return pruned.instance ? typeToString(pruned.instance) : pruned.id;
  }
}

export function typesAreEqual(t1: Type, t2: Type): boolean {
  const p1 = prune(t1);
  const p2 = prune(t2);

  if (p1 === p2) {
    return true;
  }

  if (p1.kind === 'typevar' || p2.kind === 'typevar') {
    return false;
  }

  if (p1.kind !== p2.kind) {
    return false;
  }

  if (p1.kind === 'primitive' && p2.kind === 'primitive') {
    return p1.name === p2.name;
  }

  if (p1.kind === 'array' && p2.kind === 'array') {
    return typesAreEqual(p1.elementType, p2.elementType);
  }

  if (p1.kind === 'function' && p2.kind === 'function') {
    if (p1.paramTypes.length !== p2.paramTypes.length) {
      return false;
    }
    for (let i = 0; i < p1.paramTypes.length; i++) {
      const param1 = p1.paramTypes[i];
      const param2 = p2.paramTypes[i];
      if (!param1 || !param2 || !typesAreEqual(param1, param2)) {
        return false;
      }
    }
    return typesAreEqual(p1.returnType, p2.returnType);
  }

  return false;
}
