import { createUnionType, prune, Type, typesAreEqual, typeToString, TypeVar, unionIncludes } from './types.js';

export class UnificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnificationError';
  }
}

export function unify(t1: Type, t2: Type): void {
  const p1 = prune(t1);
  const p2 = prune(t2);

  if (p1 === p2) {
    return;
  }

  if (p1.kind === 'typevar') {
    if (occursInType(p1, p2)) {
      throw new UnificationError(
        `Recursive type constraint detected (${p1.id} in ${typeToString(p2)})`
      );
    }
    if (p1.guardedTypes && p1.guardedTypes.length > 0) {
      p1.instance = createUnionType([...p1.guardedTypes, p2]);
      p1.instance.guardedTypes = p1.guardedTypes;
    } else {
      p1.instance = p2;
    }
    return;
  }

  if (p2.kind === 'typevar') {
    if (occursInType(p2, p1)) {
      throw new UnificationError(
        `Recursive type constraint detected (${p2.id} in ${typeToString(p1)})`
      );
    }
    if (p2.guardedTypes && p2.guardedTypes.length > 0) {
      p2.instance = createUnionType([...p2.guardedTypes, p1]);
      p2.instance.guardedTypes = p2.guardedTypes;
    } else {
      p2.instance = p1;
    }
    return;
  }

  if (p1.kind === 'primitive' && p2.kind === 'primitive') {
    if (p1.name !== p2.name) {
      throw new UnificationError(
        `Cannot unify incompatible types '${p1.name}' and '${p2.name}'`
      );
    }
    return;
  }

  if (p1.kind === 'array' && p2.kind === 'array') {
    unify(p1.elementType, p2.elementType);
    return;
  }

  if (p1.kind === 'function' && p2.kind === 'function') {
    if (p1.paramTypes.length !== p2.paramTypes.length) {
      throw new UnificationError(
        `Function arity mismatch: expected ${p1.paramTypes.length} arguments, found ${p2.paramTypes.length}`
      );
    }
    for (let i = 0; i < p1.paramTypes.length; i++) {
      const param1 = p1.paramTypes[i];
      const param2 = p2.paramTypes[i];
      if (param1 && param2) {
        unify(param1, param2);
      }
    }
    unify(p1.returnType, p2.returnType);
    return;
  }

  if (p1.kind === 'union' && p2.kind === 'union') {
    if (typesAreEqual(p1, p2)) {
      return;
    }
  }

  if (p1.kind === 'union' && unionIncludes(p1, p2)) {
    return;
  }

  if (p2.kind === 'union' && unionIncludes(p2, p1)) {
    return;
  }

  throw new UnificationError(
    `Cannot unify incompatible types '${typeToString(p1)}' and '${typeToString(p2)}'`
  );
}

function occursInType(v: TypeVar, t: Type): boolean {
  const pruned = prune(t);
  if (pruned === v) {
    return true;
  }
  if (pruned.kind === 'array') {
    return occursInType(v, pruned.elementType);
  }
  if (pruned.kind === 'function') {
    return (
      pruned.paramTypes.some((p) => occursInType(v, p)) ||
      occursInType(v, pruned.returnType)
    );
  }
  if (pruned.kind === 'union') {
    return pruned.types.some((u) => occursInType(v, u));
  }
  return false;
}
