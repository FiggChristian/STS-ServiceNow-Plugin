/**
 * Adds an item to the beginning of a tuple and returns the resulting tuple.
 */
type UnshiftTuple<H, T> = T extends unknown[]
  ? Parameters<(h: H, ...t: T) => void>
  : never;
/**
 * Removes an item from the beginning of a tuple and returns the resulting tuple.
 */
type ShiftTuple<T> = T extends Readonly<[unknown, ...infer R]>
  ? Readonly<R>
  : never;
/**
 * Returns the previous number in the sequence. Only works for numbers 1-10. Numbers greater than
 * 10 will return 10.
 */
type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...10[]];

/**
 * Returns all the paths of a given object to the given depth. The depth should only be a number
 * between 1 and 10. If the depth is greater than 10, it will be treated as 10.
 * @example
 * ```ts
 * type Example1 = Paths<{ foo: { bar: "baz" }}>
 * // Returns
 * ["foo"] | ["foo", "bar"]
 *
 * type Example2 = Paths<{ foo: { bar: "baz", qux: "corge" }}>
 * // Returns
 * ["foo"] | ["foo", "bar"] | ["foo", "qux"]
 * ```
 */
export type ObjectPaths<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?:
        | [K]
        | (ObjectPaths<T[K], Prev[D]> extends infer P
            ? P extends []
              ? never
              : UnshiftTuple<K, P>
            : never);
    }[keyof T]
  : [];

/**
 * Extracts the value of an object at the given path.
 * @example
 * ```ts
 * type Example1 = DeepObjectExtract<{ a: { b: number } }, ["a", "b"]>
 * // Returns
 * number
 *
 * type Example1 = DeepObjectExtract<{ a?: { b: { c: string } } }, ["a", "b", "c"]>
 * // Returns
 * string | undefined
 * ```
 */
type DeepObjectExtract<T, K, U = never> = T extends object
  ? K extends Readonly<unknown[]>
    ? K[0] extends keyof T
      ? ShiftTuple<K> extends Readonly<[]>
        ? U | T[K[0]]
        : undefined extends T[K[0]]
        ? DeepObjectExtract<T[K[0]], ShiftTuple<K>, undefined>
        : DeepObjectExtract<T[K[0]], ShiftTuple<K>, U>
      : never
    : never
  : never;
type DeepObjectExtractNoUndefined<T, K> = T extends object
  ? K extends Readonly<unknown[]>
    ? K[0] extends keyof T
      ? ShiftTuple<K> extends Readonly<[]>
        ? T[K[0]]
        : DeepObjectExtractNoUndefined<T[K[0]], ShiftTuple<K>>
      : never
    : never
  : never;

export const getDeep: {
  /**
   * Retrieves a value within an object at the given path. The path should be an array of
   * strings/numbers/symbols for indexing the next item in the nested object. If any part of the
   * path does not correspond to an object while traversing the nested object, an object will be
   * created and assigned to the path. If the final, most nested object does not have a value at the
   * specified path, `undefined`` will be assigned to the path and returned.
   *
   * To have correct type information, you should define the array as `const`.
   *
   * @example
   * ```ts
   * getDeep({ foo: { bar: "baz"} }, ["foo", "bar"] as const);
   * // Returns
   * "baz"
   *
   * getDeep({} as { foo?: { bar: string } }, ["foo", "bar"] as const);
   * // Returns
   * undefined
   * // Also modifies the object to be { foo: { bar: undefined } }
   * ```
   * @param object The base object to traverse and retrieve the item from.
   * @param path The path to the item to retrieve. Mark `as const` for correct type information.
   * @returns The item at the specified path or `undefined` if it does not exist.
   */
  <
    P extends Readonly<ObjectPaths<T>>,
    T extends Record<string | number | symbol, unknown>
  >(
    object: T,
    path: P
  ): DeepObjectExtract<T, P>;
  /**
   * Retrieves a value within an object at the given path. The path should be an array of
   * strings/numbers/symbols for indexing the next item in the nested object. If any part of the
   * path does not correspond to an object while traversing the nested object, an object will be
   * created and assigned to the path. If the final, most nested object does not have a value at the
   * specified path, `defaultValue` will be assigned to the path and returned.
   *
   * To have correct type information, you should define the array as `const`.
   *
   * @example
   * ```ts
   * getDeep({ foo: { bar: "baz"} }, ["foo", "bar"] as const);
   * // Returns
   * "baz"
   *
   * getDeep({} as { foo?: { bar: string } }, ["foo", "bar"] as const, "baz");
   * // Returns
   * "baz"
   * // Also modifies the object to be { foo: { bar: "baz" } }
   * ```
   * @param object The base object to traverse and retrieve the item from.
   * @param path The path to the item to retrieve. Mark `as const` for correct type information.
   * @param defaultValue The default value to assign to the path if it does not exist.
   * @returns The item at the specified path or `defaultValue` if it does not exist.
   */
  <
    P extends Readonly<ObjectPaths<T>>,
    T extends Record<string | number | symbol, unknown>
  >(
    object: T,
    path: P,
    defaultValue: DeepObjectExtract<T, P>
  ): DeepObjectExtractNoUndefined<T, P>;
} = <
  P extends Readonly<ObjectPaths<T>>,
  T extends Record<string | number | symbol, unknown>
>(
  object: T,
  path: P,
  defaultValue?: DeepObjectExtract<T, P>
): DeepObjectExtract<T, P> => {
  let current = object as Record<string | number | symbol, unknown>;
  for (let i = 0; i < path.length; i++) {
    const key: string | number | symbol = path[i];
    const value = current[key];
    if (i !== path.length - 1 && typeof value !== "object") {
      current[path[i]] = {};
    } else if (i === path.length - 1 && !(key in current)) {
      current[path[i]] = defaultValue;
    }
    current = current[path[i]] as typeof current;
  }
  return current as DeepObjectExtract<T, P>;
};

export const setDeep: {
  /**
   * Sets a value within an object at the given path. The path should be an array of
   * strings/numbers/symbols for indexing the next item in the nested object. If any part of the
   * path does not correspond to an object while traversing the nested object, an object will be
   * created and assigned to the path.
   *
   * @example
   * ```ts
   * setDeep({ foo: { bar: "baz"} }, ["foo", "bar"], "qux");
   * // Returns
   * { foo: { bar: "qux" } } // (the mutated object)
   *
   * getDeep({} as { foo?: { bar: string } }, ["foo", "bar"], "qux");
   * // Returns
   * { foo: { bar: "qux" } } // (the mutated object)
   * ```
   * @param object The base object to traverse and set the item for.
   * @param path The path to the item to set.
   * @param newValue The value to assign at the specified path.
   * @returns The original `object`, mutated with the assigned value.
   */
  <
    P extends Readonly<ObjectPaths<T>>,
    T extends Record<string | number | symbol, unknown>
  >(
    object: T,
    path: P,
    newValue: DeepObjectExtractNoUndefined<T, P>
  ): T;
} = <
  P extends Readonly<ObjectPaths<T>>,
  T extends Record<string | number | symbol, unknown>
>(
  object: T,
  path: P,
  newValue: DeepObjectExtractNoUndefined<T, P>
): T => {
  let current = object as Record<string | number | symbol, unknown>;
  for (let i = 0; i < path.length; i++) {
    const key: string | number | symbol = path[i];
    const value = current[key];
    if (i !== path.length - 1 && typeof value !== "object") {
      current[path[i]] = {};
    } else if (i === path.length - 1) {
      current[path[i]] = newValue;
    }
    current = current[path[i]] as typeof current;
  }
  return object;
};
