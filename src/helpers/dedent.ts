export const dedent = (string: string): string => {
  // Similar to python's textwrap.dedent:
  // https://docs.python.org/3/library/textwrap.html#textwrap.dedent
  const lines = string.split("\n");
  let longestCommonPrefix: string | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim().length) {
      lines[i] = "";
      continue;
    }
    const prefix = lines[i].substring(
      0,
      lines[i].length - lines[i].trimLeft().length
    );
    if (longestCommonPrefix == null) {
      longestCommonPrefix = prefix;
      continue;
    }
    if (prefix === longestCommonPrefix) {
      continue;
    }
    const shorter: string =
      prefix.length < longestCommonPrefix.length ? prefix : longestCommonPrefix;
    const longer: string =
      prefix.length < longestCommonPrefix.length ? longestCommonPrefix : prefix;
    for (let i = 1; i < shorter.length; i++) {
      if (shorter.substring(0, i) !== longer.substring(0, i)) {
        longestCommonPrefix = shorter.substring(0, i - 1);
        if (i === 1) {
          break;
        }
        continue;
      }
    }
    longestCommonPrefix = shorter;
  }
  if (longestCommonPrefix) {
    for (let i = lines.length - 1; i >= 0; i--) {
      lines[i] = lines[i].substring(longestCommonPrefix.length);
    }
  }
  while (lines[lines.length - 1] === "") {
    lines.pop();
  }
  while (lines[0] === "") {
    lines.shift();
  }
  return lines.join("\n");
};

export default dedent;
