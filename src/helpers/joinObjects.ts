/**
 * Joins two objects together recursively. If the two objects have nested objects under the same
 * key, those two objects will be joined together as well. If any of the arguments is not an object,
 * `source` is returned.
 * @param target The object to join to.
 * @param source The object to join from.
 * @returns `target` with the properties of `source` merged in recursively, or `source` if `source`
 *        or `target` is not an object.
 */
export const joinObjects = <T, U>(target: T, source: U): JoinObjects<T, U> => {
  if (
    typeof source !== "object" ||
    typeof target !== "object" ||
    source === null ||
    target === null
  ) {
    return source as JoinObjects<T, U>;
  }

  for (const key in source) {
    const value = source[key];
    if (key in target) {
      (target as Record<typeof key, unknown>)[key] = joinObjects(
        (target as Record<typeof key, typeof value>)[key],
        value
      );
    } else {
      (target as Record<typeof key, unknown>)[key] = value;
    }
  }

  return target as JoinObjects<T, U>;
};

/**
 * The TypeScript version of `joinObjects`: given two arguments, returns the joined version of the
 * two objects.
 */
type JoinObjects<T, U> = U extends Record<string, unknown>
  ? T extends Record<string, unknown>
    ? {
        [key in keyof T]: key extends keyof U
          ? JoinObjects<T[key], U[key]>
          : T[key];
      } & {
        [key in Exclude<keyof U, keyof T>]: U[key];
      }
    : U
  : U;

export default joinObjects;
