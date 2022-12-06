export type TextAreaData = Record<string | number | symbol, unknown>;
export type CSSSelector = string;
export type ElementListCallback<T extends Element = Element> = (
  elements: T[]
) => void;
export enum TextAreaType {
  Comments,
  WorkNotes,
  CloseNotes,
  CommentsAndWorkNotes,
}
export enum TicketType {
  Incident,
  SupportRequest,
  Task,
}
export enum ServiceNowUITab {
  Notes = "Notes",
  ClosureInfo = "Closure Information",
}

/**
 * A callback that is expected to return an object to merge into the textarea's existing data
 * object.
 * @param textarea The textarea element.
 * @param data The textarea's existing data object.
 * @returns An object that is merged into the textarea's existing data object.
 */
export type TextAreaDataGenerator = (
  textarea: HTMLTextAreaElement,
  existingData: TextAreaData
) => Partial<TextAreaData>;

/**
 * A callback that gets run with a textarea element as its only argument.
 * @param textarea The textarea element.
 */
export type TextAreaCallback = (textarea: HTMLTextAreaElement) => void;

/**
 * A callback that returns an element to add to the sub-bar or null.
 * @param textarea The textarea whose sub-bar the button is being added to.
 */
export type SubBarElementCallback = (
  textarea: HTMLTextAreaElement
) => Node | null;

/**
 * A callback that gets called when the user closes out of the textarea tooltip.
 * @param The event that triggered the closing.
 */
export type TooltipClosingCallback = (event: Event) => void;

export interface TextAreaDataSlice {
  /**
   * The textarea element associated with this data object.
   */
  element: HTMLTextAreaElement;
  /**
   * The CSSDeclaration associated with this textarea.
   */
  elementStyles: CSSStyleDeclaration;
  /**
   * A boolean indicating whether we should ignore inputs on this textarea temporarily.
   */
  suppressInputs: boolean;
  /**
   * The mirror element for this textarea used for calculating text positions.
   */
  mirror: HTMLElement;
  /**
   * The element used for showing the tooltip for this text area.
   */
  tooltip: HTMLElement;
  /**
   * The callback to call when the user exits out of the tooltip.
   */
  tooltipCloser: TooltipClosingCallback | null;
  /**
   * The textarea's sub-bar element.
   */
  subBar: HTMLElement;
  /**
   * The currently focused 1-based index of the form field, if a field is present. 0 if the form is
   * not being used as a form. The value may also be a half-integer value (e.g. 1.5) if the caret
   * is positioned between two fields.
   */
  formFieldIndex: number;
  /**
   * Whether the user is currently able to tab between form fields.
   */
  isTabbingFormFields: boolean;
  /**
   * Whether the user was previously able to tab between form fields.
   */
  wasTabbingFormFields: boolean;
  /**
   * An array of text that shows up between form fields, or null if the form is not currently being
   * used as a form.
   */
  textBetweenFormFields: string[] | null;
  /**
   * The character counter clone that is showing the number of characters in the textarea, or null
   * if there is none.
   */
  characterCounter: HTMLElement | null;
  /**
   * The hidden character counter clone that ServiceNow updates and that we listen for changes on,
   * or null if there is none.
   */
  hiddenCharacterCounter: HTMLElement | null;
  /**
   * A function that converts the textarea's value into a length. For a textarea without Markdown
   * support, this will be just the textarea's value's length. For a textarea with Markdown support,
   * the length of the Markdown-processed value will be used instead.
   */
  characterCounterFunction: (text: string) => number;
}

export type CaretPosition = [number, number];

export type DataListAutoCompletableNode = HTMLElement & {
  ac?: DataListAutoCompleter;
};

export interface DataListAutoCompleter {
  PROCESSOR: string;
  element: DataListAutoCompletableNode;
  max: string;
  cacheGet: (key: string) => XMLDocument | undefined;
  cachePut: (key: string, value: XMLDocument) => void;
  searchChars: string;
  _processItems: (xml: XMLDocument) => { label: string; name: string }[];
  _processRecents: (xml: XMLDocument) => { label: string; name: string }[];
  referenceSelect: (id: string, value: string) => void;
  /**
   * A method that generates a list of query parameters.
   */
  addSysParms: () => string;
  /**
   * A method that generates a list of query parameters.
   */
  addDependentValue: () => string;
  /**
   * A method that generates a list of query parameters.
   */
  addRefQualValues: () => string;
  /**
   * A method that generates a list of query parameters.
   */
  addTargetTable: () => string;
  /**
   * A method that generates a list of query parameters.
   */
  addAdditionalValues: () => string;
  /**
   * A method that generates a list of query parameters.
   */
  addAttributes: (prefix: string) => string;
}

/**
 * A class implemented by ServiceNow to create an auto-completer for a specified element.
 */
export declare class AJAXReferenceCompleter {
  /**
   * @param node The element to create the auto-completer for.
   * @param ref The element's data-ref attribute.
   * @param idk Seriously, I don't know what this parameter does but it should be an empty string.
   * @param emptyStringIGuess Same thing here: I don't know, just pass an empty string.
   */
  constructor(
    node: DataListAutoCompletableNode,
    ref: string | null,
    idk: "",
    emptyStringIGuess: ""
  );
}

export declare class GlideAjax {
  constructor(scriptName: string);
  setQueryString: (queryString: string) => void;
  getXML: (callback: (response: XMLHttpRequest) => void) => void;
}

declare global {
  interface Window {
    AJAXReferenceCompleter: typeof AJAXReferenceCompleter;
    GlideAjax: typeof GlideAjax;
  }
}
