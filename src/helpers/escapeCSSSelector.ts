/**
 * Escapes a string to make it safe to use as a CSS attribute or class name. Any character that is
 * not a lowercase letter or a number is replaced by an its codepoint, surrounded by two
 * underscores.
 * @param string The string to escape.
 * @returns The escapes string.
 */
export const escapeCSSSelector = (string: string): string => {
  let s = "";
  for (let i = 0; i < string.length; i++) {
    const codePoint = string.codePointAt(i)!;
    s +=
      codePoint < 48 || (57 < codePoint && codePoint < 97) || 122 < codePoint
        ? "_" + codePoint.toString(16) + "_"
        : string[i];
  }
  return s;
};

export default escapeCSSSelector;
