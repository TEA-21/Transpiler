export type PrimitiveTypeKind = 'number' | 'string' | 'boolean' | 'void' | 'null';

export interface PrimitiveType {
  kind: 'primitive';
  name: PrimitiveTypeKind;
  guardedTypes?: Type[];
}

export interface ArrayType {
  kind: 'array';
  elementType: Type;
  guardedTypes?: Type[];
}

export interface FunctionType {
  kind: 'function';
  paramTypes: Type[];
  returnType: Type;
  guardedTypes?: Type[];
}

export interface TypeVar {
  kind: 'typevar';
  id: string;
  instance?: Type;
  guardedTypes?: Type[];
}

export interface UnionType {
  kind: 'union';
  types: Type[];
  guardedTypes?: Type[];
}

export type Type = PrimitiveType | ArrayType | FunctionType | TypeVar | UnionType;

export const NUMBER_TYPE: PrimitiveType = { kind: 'primitive', name: 'number' };
export const STRING_TYPE: PrimitiveType = { kind: 'primitive', name: 'string' };
export const BOOLEAN_TYPE: PrimitiveType = { kind: 'primitive', name: 'boolean' };
export const VOID_TYPE: PrimitiveType = { kind: 'primitive', name: 'void' };
export const NULL_TYPE: PrimitiveType = { kind: 'primitive', name: 'null' };

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

export function createUnionType(members: Type[]): Type {
  const flattened: Type[] = [];
  for (const m of members) {
    const p = prune(m);
    if (p.kind === 'union') {
      flattened.push(...p.types);
    } else {
      flattened.push(p);
    }
  }

  // Deduplicate
  const unique: Type[] = [];
  for (const candidate of flattened) {
    if (!unique.some((u) => typesAreEqual(u, candidate))) {
      unique.push(candidate);
    }
  }

  if (unique.length === 0) {
    return VOID_TYPE;
  }
  const allGuarded = members.flatMap((m) => m.guardedTypes ?? []);
  const result: Type =
    unique.length === 1
      ? unique[0]!
      : {
          kind: 'union',
          types: unique,
        };
  if (allGuarded.length > 0) {
    result.guardedTypes = allGuarded;
  }
  return result;
}

export function unionSubtract(source: Type, toRemove: Type): Type {
  const pSource = prune(source);
  const pRemove = prune(toRemove);

  if (pSource.kind !== 'union') {
    if (typesAreEqual(pSource, pRemove)) {
      return VOID_TYPE;
    }
    return pSource;
  }

  const remaining = pSource.types.filter((t) => !typesAreEqual(t, pRemove));
  return createUnionType(remaining);
}

export function unionIncludes(union: Type, target: Type): boolean {
  const pUnion = prune(union);
  const pTarget = prune(target);

  if (pUnion.kind === 'union') {
    return pUnion.types.some((t) => typesAreEqual(t, pTarget));
  }
  return typesAreEqual(pUnion, pTarget);
}

export function prune(type: Type): Type {
  if (type.kind === 'typevar') {
    if (type.instance) {
      type.instance = prune(type.instance);
      return type.instance;
    }
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
    case 'union':
      return pruned.types.map(typeToString).join(' | ');
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

  if (p1.kind === 'union' && p2.kind === 'union') {
    if (p1.types.length !== p2.types.length) {
      return false;
    }
    return p1.types.every((tA) => p2.types.some((tB) => typesAreEqual(tA, tB)));
  }

  return false;
}
