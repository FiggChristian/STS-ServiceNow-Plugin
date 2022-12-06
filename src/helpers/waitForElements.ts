import { CSSSelector, ElementListCallback } from "./types";
import constants from "../constants.json";
import escapeCSSSelector from "./escapeCSSSelector";

const ELEMENT_QUERIES: Record<CSSSelector, ElementListCallback[]> = {};
export const waitForElements: {
  /**
   * Add a callback that gets called when an element that matches the query is added to the DOM.
   * Each element only gets processed once by each callback. If there are already elements in the
   * DOM matching the specified query, those elements are also immediately processed once by the
   * callback.
   * @param query The CSS query to match elements against.
   * @param callback A callback that gets called with an Array of elements that match the query.
   */
  <T extends keyof HTMLElementTagNameMap>(
    query: T,
    callback: ElementListCallback<HTMLElementTagNameMap[T]>
  ): void;
  (query: CSSSelector, callback: ElementListCallback): void;
  /**
   * Add a callback that gets called when an element that matches any of the queries is added to
   * the DOM. Each element only gets processed once by each callback. If there are already
   * elements in the DOM matching the specified query, those elements are also immediately
   * processed once by the callback.
   *
   * The individual queries are combined with ',' to make one big query.
   *
   * @param queries The CSS query to match elements against.
   * @param callback A callback that gets called with an Array of elements that match the query.
   */
  (queries: CSSSelector[], callback: ElementListCallback): void;
} = (
  queries: CSSSelector | CSSSelector[],
  callback: ElementListCallback
): void => {
  if (queries === "#settings_modal .settings-tabs .sn-widget-list_v2") {
    // debugger;
  }
  const query = typeof queries === "string" ? queries : queries.join(",");
  ELEMENT_QUERIES[query] ??= [];
  ELEMENT_QUERIES[query].push(callback);

  // Check if there are existing elements already in the DOM that have already been processed, and
  // call this callback on them.
  const attribute = `${
    constants.EXTENSION_PREFIX
  }-element-processed--${escapeCSSSelector(query)}`;
  const elementList = Array.from(document.querySelectorAll(query)).filter(
    (element) => element.hasAttribute(attribute)
  );
  if (elementList.length) {
    callback(elementList);
  }
  // Process any potential elements that haven't been processed yet.
  mutationObserverCallback();
};

const mutationObserverCallback = () => {
  // Go through the queries to look for matching elements.
  for (const query in ELEMENT_QUERIES) {
    const attribute = `${
      constants.EXTENSION_PREFIX
    }-element-processed--${escapeCSSSelector(query)}`;
    // Include :not([attribute]) to prevent already-processed elements from being processed
    // again.
    const elementList = Array.from(document.querySelectorAll(query)).filter(
      (element) => !element.hasAttribute(attribute)
    );
    if (elementList.length) {
      for (const element of elementList) {
        // Set the attribute to prevent this element from being processed again.
        element.setAttribute(attribute, "true");
      }
      // Call any callbacks associated with this query.
      for (const callback of ELEMENT_QUERIES[query]) {
        callback(elementList);
      }
    }
  }
};

/**
 * Create a new MutationObserver that listens for new elements that match anything in
 * `ELEMENT_QUERIES` and processes new elements.
 */
new MutationObserver(mutationObserverCallback).observe(document, {
  childList: true,
  subtree: true,
});
mutationObserverCallback();

export default waitForElements;
