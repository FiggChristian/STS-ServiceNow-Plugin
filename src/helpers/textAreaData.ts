import isInstance from "./isInstance";
import {
  TextAreaCallback,
  TextAreaData,
  TextAreaDataGenerator,
  TextAreaDataSlice,
} from "./types";
import waitForElements from "./waitForElements";

const TEXTAREA_DATA = new Map<HTMLTextAreaElement, TextAreaData>();
const TEXTAREA_DATA_GENERATORS: TextAreaDataGenerator[] = [];
const TEXTAREA_CALLBACKS: TextAreaCallback[] = [];

/**
 * Returns the data object associated with a textarea, or null if there is none.
 * @param textarea The textarea to retrieve the data object for.
 * @returns The textarea's associated data object, or null if there is none.
 */
export const getTextAreaData = <
  T extends Record<never, unknown> = Record<never, unknown>
>(
  textarea?: HTMLTextAreaElement | null | undefined
): (T & TextAreaDataSlice) | null => {
  if (isInstance(textarea, HTMLTextAreaElement)) {
    return (
      (TEXTAREA_DATA.get(textarea) as (T & TextAreaDataSlice) | undefined) ??
      null
    );
  }
  return null;
};

/**
 * Adds additional data to a textarea's data object.
 * @param callback A callback that is expected to return an object to merge into the textarea's data
 *    object. The callback receives the textarea, and the existing data object as its two arguments.
 */
export const addTextAreaData = (callback: TextAreaDataGenerator): void => {
  // Go through any existing textareas and update their data objects.
  for (const [textarea, textareaData] of TEXTAREA_DATA) {
    Object.assign(textareaData, callback(textarea, textareaData));
  }
  // Add the callback to the list for future textareas.
  TEXTAREA_DATA_GENERATORS.push(callback);
};

export const addTextAreaCallback = (callback: TextAreaCallback): void => {
  // Go through any existing textareas and call the callback on them.
  for (const [textarea] of TEXTAREA_DATA) {
    callback(textarea);
  }
  // Add the callback to the list for future textareas.
  TEXTAREA_CALLBACKS.push(callback);
};

/**
 * Given a textarea, returns a new data object for the textarea by running all generators in
 * `TEXTAREA_DATA_GENERATORS` with the textarea as the argument and merging the results.
 * @param textarea The textarea to generate data for.
 * @returns The generated data object.
 */
const generateTextAreaData = (textarea: HTMLTextAreaElement): TextAreaData => {
  const data = {} as TextAreaData;
  for (const generator of TEXTAREA_DATA_GENERATORS) {
    Object.assign(data, generator(textarea, data));
  }
  return data;
};

waitForElements("textarea", (textareas) => {
  for (const textarea of textareas) {
    // Generate a new data object for this textarea.
    TEXTAREA_DATA.set(textarea, generateTextAreaData(textarea));
    // Call the callbacks on this textarea.
    for (const callback of TEXTAREA_CALLBACKS) {
      callback(textarea);
    }
  }
});

export default getTextAreaData;
