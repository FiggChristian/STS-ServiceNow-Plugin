export const makeElement: {
  /**
   * Creates an element with the specified tag name.
   * @param elementName The tag name of the element to create.
   * @returns The created element.
   */
  <TagName extends keyof HTMLElementTagNameMap>(
    elementName: TagName
  ): HTMLElementTagNameMap[TagName];
  (elementName: string): Element;
  /**
   * Creates an element with the specified tag name and attributes.
   * @param elementName The tag name of the element to create.
   * @param attributes An object containing the attributes to set on the element.
   * @returns The created element.
   */
  <TagName extends keyof HTMLElementTagNameMap>(
    elementName: TagName,
    attributes: Record<string, string> | null | undefined
  ): HTMLElementTagNameMap[TagName];
  (
    elementName: string,
    attributes: Record<string, string> | null | undefined
  ): Element;
  /**
   * Creates an element with the specified tag name and innerHTML.
   * @param elementName The tag name of the element to create.
   * @param innerHTML The innerHTML of the element.
   * @returns The created element.
   */
  <TagName extends keyof HTMLElementTagNameMap>(
    elementName: TagName,
    innerHTML: string | null | undefined
  ): HTMLElementTagNameMap[TagName];
  (elementName: string, innerHTML: string | null | undefined): Element;
  /**
   * Creates an element with the specified tag name, attributes, and innerHTML.
   * @param elementName The tag name of the element to create.
   * @param attributes An object containing the attributes to set on the element.
   * @param innerHTML The innerHTML of the element.
   * @returns The created element.
   */
  <TagName extends keyof HTMLElementTagNameMap>(
    elementName: TagName,
    attributes: Record<string, string> | null | undefined,
    innerHTML: string | null | undefined
  ): HTMLElementTagNameMap[TagName];
  (
    elementName: string,
    attributes: Record<string, string> | null | undefined,
    innerHTML: string | null | undefined
  ): Element;
} = (
  elementName: string,
  attributesOrInnerHTML?: Record<string, string> | string | null | undefined,
  innerHTML?: string
): Element => {
  const element = document.createElement(elementName);
  if (typeof attributesOrInnerHTML === "string") {
    element.innerHTML = attributesOrInnerHTML;
  } else if (attributesOrInnerHTML == null && typeof innerHTML === "string") {
    element.innerHTML = innerHTML;
  } else if (attributesOrInnerHTML != null) {
    for (const attributeName in attributesOrInnerHTML) {
      const translatedName =
        attributeName === "className"
          ? "class"
          : attributeName === "htmlFor"
          ? "for"
          : attributeName;
      element.setAttribute(
        translatedName,
        attributesOrInnerHTML[attributeName]
      );
    }
    if (typeof innerHTML === "string") {
      element.innerHTML = innerHTML;
    }
  }
  return element;
};

export default makeElement;
