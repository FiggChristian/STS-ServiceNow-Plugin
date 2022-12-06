import { isInstance, resolveReplacements } from ".";
import { DataListAutoCompletableNode, DataListAutoCompleter } from "./types";

export const setDropdown: {
  /**
   * Changes a ServiceNow dropdown's value to the specified value.
   *
   * @param dropdown The dropdown element to change the value of. If the passed in node is not an
   *        HTMLSelectElement, this function will do nothing.
   * @param value The value to change the dropdown to.
   * @returns A boolean indicating whether the dropdown was changed.
   */
  (dropdown: Node, value: string): boolean;
  /**
   * Changes a ServiceNow dropdown's value to the first available value in a set of values.
   *
   * @param dropdown The dropdown element to change the value of. If the passed in node is not an
   *        HTMLSelectElement, this function will do nothing.
   * @param values An array of strings to try changing the dropdown to. The first value in the array
   *        that is a valid option for the dropdown will be used (any that follow it will not be
   *        considered).
   * @returns A boolean indicating whether the dropdown was changed.
   */
  (dropdown: Node, values: string[]): boolean;
} = (dropdown: Node, values: string[] | string): boolean => {
  if (!isInstance(dropdown, HTMLSelectElement)) return false;

  if (typeof values === "string") values = [values];

  const options = Array.from(dropdown.children).flatMap((child) =>
    isInstance(child, HTMLOptGroupElement)
      ? Array.from(child.children)
      : [child]
  ) as HTMLOptionElement[];

  let newValue: string | null = null;
  for (const value of values) {
    const [resolvedValue] = resolveReplacements(value);
    for (const option of options) {
      if (
        option.value === resolvedValue ||
        option.innerText === resolvedValue
      ) {
        newValue = option.value;
        break;
      }
    }
    if (newValue) break;
  }

  if (newValue == null) return false;

  dropdown.value = newValue;
  dropdown.dispatchEvent(new Event("change"));
  return true;
};

// Sets the assignment group given the <input> element and the new value. The new value must be a
// valid assignment group, otherwise the entire thing fails and nothing is changed. This uses
// ServiceNow's own code to mimic what's happening under the hood, but that also means it's prone to
// break if ServiceNow updates the way it works.
export const setDataList: {
  /**
   * Changes ServiceNow's version of a `<datalist>` to the specified value.
   *
   * Note that {{replacement}}s are **not** resolved automatically: the passed in string is treated
   * exactly as it is passed in.
   *
   * @param datalist The HTML element to change the value of. If the passed in node is not an
   *        HTMLElement, this function will do nothing.
   * @param value The value to change the dropdown to.
   * @returns A Promise resolving to a boolean indicating whether the datalist was changed.
   */
  (datalist: Node, value: string): Promise<boolean>;
} = async (
  datalist: DataListAutoCompletableNode,
  value: string
): Promise<boolean> => {
  if (!isInstance(datalist, HTMLInputElement)) return false;
  datalist = datalist as DataListAutoCompletableNode & HTMLInputElement;

  // Make sure the input has an auto-completer associated with it.
  if (!datalist.ac || datalist.ac.element !== datalist) {
    new window.AJAXReferenceCompleter(
      datalist,
      datalist.getAttribute("data-ref"),
      "",
      ""
    );
  }

  const ac = datalist.ac;
  // If there still is no auto-completer, then we can't do anything.
  if (!ac) return false;

  // Sets the maximum number to return from ServiceNow's backend.
  if (!ac.max) {
    ac.max = "15";
  }

  const [resolvedValue] = resolveReplacements(value);

  const xml = ac.cacheGet(resolvedValue);
  let name2ID: Record<string, string>;
  if (xml) {
    name2ID = parseXML(ac, xml);
  } else {
    // Set the input's search characters so it knows what to search on the backend. We set it to the
    // exact value we want to set it to so that only that one value is returned (unless it's a
    // prefix of another value, but that shouldn't mess anything up).
    ac.searchChars = resolvedValue;
    // The GlideAjax is what performs the HTTP request to get the search results.
    const ga = new window.GlideAjax(ac.PROCESSOR);
    // Build up the query by adding a bunch of parameters from the auto completer's methods.
    // This is also what is done by ServiceNow.
    const query =
      ac.addSysParms() +
      ac.addDependentValue() +
      ac.addRefQualValues() +
      ac.addTargetTable() +
      ac.addAdditionalValues() +
      ac.addAttributes("ac_");
    ga.setQueryString(query);

    // Tell the GlideAjax to perform the request and parse the XML when it returns.
    name2ID = await new Promise((resolve) => {
      ga.getXML((response) => {
        if (response.responseXML) {
          // Add the result to the cache for the future.
          ac.cachePut(resolvedValue, response.responseXML);
          resolve(parseXML(ac, response.responseXML));
        }
      });
    });
  }

  // If the value we want to set it to was not returned by the search results, it means the value
  // is not a valid value and we don't have anything to set it to.
  if (!(resolvedValue in name2ID)) return false;
  ac.referenceSelect(name2ID[resolvedValue], resolvedValue);
  ac.element.blur();
  return true;
};

const parseXML = (
  ac: DataListAutoCompleter,
  xml: XMLDocument
): Record<string, string> => {
  // Parse the XML's items using ServiceNow's methods.
  const items = ac._processItems(xml).concat(ac._processRecents(xml));
  // Get the names and associated labels from the search results.
  const name2ID: Record<string, string> = {};
  for (const item of items) {
    name2ID[item.label] = item.name;
  }
  return name2ID;
};
