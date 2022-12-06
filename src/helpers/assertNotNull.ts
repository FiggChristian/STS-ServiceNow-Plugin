/**
 * A helper function to assert that a value is not null or undefined. If the passed-in value *is*
 * nullish, an error is thrown with an optional error message.
 * @param value The value to test for null or undefined.
 * @param message An optional string to use as the Error message if `value` is nullish.
 * @returns The passed-in value. Only returns if `value` is not nullish.
 */
export const assertNotNull = <T>(
  value: T,
  message?: string | null | undefined
): NonNullable<T> => {
  if (value == null) {
    throw new Error(
      typeof message === "string" ? message : "Received nullish value."
    );
  }
  return value;
};

export default assertNotNull;
