/**
 * Turn unsafe text into text that won't render HTML when added inside .innerHTML.
 * @param string The unsafe text to escape.
 * @returns A string with HTML characters escaped.
 */
export const escapeHTML = (string: string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

export default escapeHTML;
