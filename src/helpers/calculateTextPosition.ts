import assertNotNull from "./assertNotNull";
import escapeHTML from "./escapeHTML";
import makeElement from "./makeElement";
import getTextAreaData from "./textareaData";

/**
 * Calculates the position of some text in a textarea.
 * @param textarea The textarea to calculate the text position for.
 * @param preText The text that comes before the currently selected text.
 * @param selectedText The currently selected text, or null if no text is selected.
 * @returns An object with top and left properties representing the position of the text cursor.
 */
export const calculateTextPosition = (
  textarea: HTMLTextAreaElement,
  preText: string,
  selectedText?: string | null | undefined
): { top: number; left: number } => {
  const data = assertNotNull(
    getTextAreaData(textarea),
    "Cannot calculate text position for element: no data found."
  );
  updateMirrorStyles(textarea);
  const { mirror } = data;
  mirror.innerText = preText;
  const selection = makeElement("span", escapeHTML(selectedText ?? ""));
  mirror.appendChild(selection);

  return {
    top: mirror.getBoundingClientRect().height,
    left: selection.offsetLeft,
  };
};

/**
 * Updates the styles of a textarea's mirror element to match the textarea's styles.
 * @param textarea The textarea to update the mirror for.
 */
const updateMirrorStyles = (textarea: HTMLTextAreaElement): void => {
  const data = getTextAreaData(textarea);
  if (!data) return;
  const { elementStyles, mirror } = data;
  mirror.style.width =
    textarea.getBoundingClientRect().width -
    parseFloat(elementStyles.paddingLeft) -
    parseFloat(elementStyles.paddingRight) -
    parseFloat(elementStyles.borderLeftWidth) -
    parseFloat(elementStyles.borderRightWidth) +
    "px";
  mirror.style.fontStyle = elementStyles.fontStyle;
  mirror.style.fontFamily = elementStyles.fontFamily;
  mirror.style.fontSize = elementStyles.fontSize;
  mirror.style.fontWeight = elementStyles.fontWeight;
  mirror.style.letterSpacing = elementStyles.letterSpacing;
  mirror.style.lineHeight = elementStyles.lineHeight;
};

export default calculateTextPosition;
