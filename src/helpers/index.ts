import {
  CaretPosition,
  CSSSelector,
  TooltipClosingCallback,
  ServiceNowUITab,
  SubBarElementCallback,
} from "./types";
import constants from "../constants.json";
import { TextAreaType, TicketType } from "./types";
import { replacementByTrigger } from "../replacements/data";
import dedent from "./dedent";
import assertNotNull from "./assertNotNull";
import isInstance from "./isInstance";
import {
  addTextAreaCallback,
  addTextAreaData,
  getTextAreaData,
} from "./textareaData";
import makeElement from "./makeElement";
import escapeHTML from "./escapeHTML";
import "./styles.scss";
import { TicketState } from "../macros/types";
import { TextAreaDataSlice as ReplacementsTextAreaDataSlice } from "../replacements/types";

export { TextAreaType, TicketType } from "./types";
export { dedent } from "./dedent";
export { getTextAreaData } from "./textareaData";
export { calculateTextPosition } from "./calculateTextPosition";
export { isInstance } from "./isInstance";
export { assertNotNull } from "./assertNotNull";
export { setDropdown } from "./setInputs";
export { addTextAreaData, addTextAreaCallback } from "./textareaData";
export { escapeHTML } from "./escapeHTML";
export { wait } from "./wait";
export { waitForElements } from "./waitForElements";
export { makeElement } from "./makeElement";
export { withMaxTimeout } from "./withMaxTimeout";

// addTextareaCallback(function (data) {
//   this.addEventListener("keydown", function (e) {
//     if (
//       e.code == "Tab" &&
//       (data.isTabbingFormFields || data.wasTabbingFormFields) &&
//       !data.isAutoFillingReplacement
//     ) {
//       const index = e.shiftKey
//         ? Math.ceil(data.formFieldIndex) - 1
//         : Math.floor(data.formFieldIndex) + 1;
//       let caretIndices = getCaretIndicesOfTabField(data, index);
//       // Allow a Tab event to go through as normal if we are no longer focusing on
//       // a tabbable field.
//       if (caretIndices) {
//         e.preventDefault();
//         data.formFieldIndex = index;
//         data.element.setSelectionRange(...caretIndices);
//         data.formFieldIndicator.lastElementChild.innerText = `${index}/${
//           data.formFieldInnerText.length - 1
//         }`;
//         events.trigger("focus_form_field", data, index);
//       }
//     }
//   });

//   this.parentNode.addEventListener("focusout", function (e) {
//     // If we focus an element outside the textarea, we want to stop showing the tab indicator.
//     if (
//       e.relatedTarget === null ||
//       (e.relatedTarget instanceof HTMLElement &&
//         !e.currentTarget.contains(e.relatedTarget))
//     ) {
//       data.isTabbingFormFields = false;
//       data.wasTabbingFormFields = true;
//       data.formFieldIndicator.style.display = "none";
//     }
//   });
// });

const getTrimStart = (string: string): string => {
  const trimmed = string.trimStart();
  return string.slice(0, string.length - trimmed.length);
};

const getTrimEnd = (string: string): string => {
  const trimmed = string.trimEnd();
  return string.slice(trimmed.length);
};

/**
 * Given a textarea, returns a list of indices that represent where each tab field starts and ends.
 * @param textarea The textarea to get the caret indices for.
 * @returns An array of 2-tuples. where item in the array corresponds to [start, end] of a tab field
 *        in the textarea. The array will have length `data.textBetweenFormFields.length - 1`. Each
 *        tuple has the start caret position and the end caret position. If the textarea's value
 *        does not match the expected formatting (i.e., `data.textBetweenFormFields`), this will
 *        return null since we can no longer match according to the form.
 */
const getFormFieldIndices = (
  textarea: HTMLTextAreaElement
): [startPosition: number, endPosition: number][] | null => {
  // Make sure we have valid data.
  const data = getTextAreaData(textarea);
  if (!data || !Array.isArray(data.textBetweenFormFields)) {
    return null;
  }

  // Check if the first entry of textBetweenFormFields matches the beginning of the textarea's value.
  const value = data.element.value;
  const betweenText = data.textBetweenFormFields;
  if (!value.trimStart().startsWith(betweenText[0].trimStart())) {
    return null;
  }

  const indices = Array.from<[number, number]>({ length: betweenText.length });

  let lastIndex = 0;
  for (let i = 0; i < betweenText.length; i++) {
    const nextText = betweenText[i];
    const nextWhitespace = getTrimStart(nextText);
    const trimmedNextText = nextText.trim();
    // Look for the next instance of nextText, but with its whitespace trimmed to be more forgiving
    // if the user deletes a space or something.
    const nextIndex = value.indexOf(trimmedNextText, lastIndex);
    if (!~nextIndex) return null;
    let offsetNextIndex = nextIndex;
    // Go through and add back any whitespace we find.
    for (let j = nextWhitespace.length - 1; j >= 0; j--) {
      if (nextWhitespace[j] === value[offsetNextIndex - 1]) {
        offsetNextIndex--;
      }
    }
    // Add the indices we have to the list of indices.
    indices[i] = [lastIndex, offsetNextIndex];
    // Update lastIndex for the next iteration.
    lastIndex = nextIndex + trimmedNextText.length;
    const prevWhitespace = getTrimEnd(nextText);
    // Go through and add back any whitespace we find.
    for (let j = 0; j < prevWhitespace.length; j++) {
      if (prevWhitespace[j] === value[lastIndex]) {
        lastIndex++;
      }
    }
  }

  // Remove the first item from indices since that just holds indices for the beginning of the text
  // but does not correspond to an actual tab field.
  indices.shift();

  return indices;
};

/**
 * Sets or hides a textarea's tooltip text.
 * @param textarea The textarea to set the tooltip for.
 * @param tooltipHTML The innerHTML of the tooltip, or null to hide the tooltip.
 * @param closeCallback The optional callback that gets invoked when the user closes out of the
 *        tooltip.
 */
export const setTextAreaTooltip = (
  textarea: HTMLTextAreaElement,
  tooltipHTML: string | null,
  closeCallback?: TooltipClosingCallback | null | undefined
): void => {
  const data = getTextAreaData(textarea);
  if (!data) return;

  if (tooltipHTML == null) {
    // Remove any tooltip currently showing.
    data.tooltipCloser = null;
    data.tooltip.style.display = "none";
  } else {
    // Show the tooltip with the specified HTML and closer callback.
    data.tooltipCloser = closeCallback ?? null;
    data.tooltip.lastElementChild!.innerHTML = tooltipHTML;
    data.tooltip.style.display = "";
  }
};

/**
 * Wraps a string in code delimiters.
 * @param text The text to wrap in code delimiters.
 * @returns The text, wrapped in code delimiters.
 */
export const withCodeDelimiters = (text: string): string => {
  return constants.CODE_DELIMITERS.START + text + constants.CODE_DELIMITERS.END;
};

/**
 * Wraps a string in replacement delimiters.
 * @param text The text to wrap in replacement delimiters.
 * @returns The text, wrapped in replacement delimiters.
 */
export const withReplacementDelimiters = (text: string): string => {
  return (
    constants.REPLACEMENT_DELIMITERS.START +
    text +
    constants.REPLACEMENT_DELIMITERS.END
  );
};

/**
 * Returns another value instead of `-1` when we use `.indexOf()` (i.e., turns "no index" into
 * something else).
 * @param otherValue The value to switch to if `index` is `-1`.
 * @param index The index to check for `-1`.
 * @returns Either `index` or `otherValue` if `index` is `-1`.
 */
export const turnNoIndexInto = <T>(
  otherValue: T,
  index: number
): number | T => {
  return index === -1 ? otherValue : index;
};

/**
 * A wrapper around Node.cloneNode that returns the proper Node type.
 * @param node The Node to clone.
 * @param deep Whether to also clone the node's descendants.
 * @returns The cloned Node.
 */
export const cloneNode = <T extends Node>(node: T, deep?: boolean): T => {
  return node.cloneNode(deep) as T;
};

/**
 * Returns the type of ticket being viewed.
 * @returns The type of ticket being viewed.
 */
export const getTicketType = (): TicketType => {
  const path = location.pathname;
  if (path.startsWith("/sc_task")) {
    return TicketType.Task;
  } else if (path.startsWith("/incident")) {
    return TicketType.Incident;
  } else if (path.startsWith("/ticket")) {
    return TicketType.SupportRequest;
  } else {
    throw new Error("Encountered unrecognized ticket type.");
  }
};

/**
 * Navigates to a specific tab in the ServiceNow UI.
 * @param tab The tab to navigate to.
 * @returns A boolean indicating whether the tab was found and navigated to.
 */
export const showTab = (tab: string): boolean => {
  const tabBar = assertNotNull(
    document.getElementById("tabs2_section"),
    "Could not find tab bar (#tabs2_section) element."
  );

  const re = new RegExp(`\\b${tab}\\b`);
  const tabBtn = Array.from(tabBar.children).find((item) =>
    isInstance(item, HTMLElement) ? item.innerText.match(re) : false
  )?.firstElementChild;

  if (isInstance(tabBtn, HTMLElement)) {
    tabBtn.click();
    return true;
  } else {
    return false;
  }
};

/**
 * Shows a specific textarea in the ServiceNow UI.
 *
 * Task tickets do not have a CloseNotes textarea, so attempting to show that textarea in a Task
 * ticket will not do anything.
 *
 * @param type The type of text area to show.
 */
export const showTextArea = (type: TextAreaType): void => {
  const isNewTicket = getIsNewTicket();

  switch (type) {
    case TextAreaType.CloseNotes: {
      // Navigate to the Closure Information tab if one exists, and that's all we need to do.
      showTab(ServiceNowUITab.ClosureInfo);
      break;
    }
    case TextAreaType.Comments: {
      switch (getTicketType()) {
        case TicketType.Task:
          // Task tickets always have the comments text area being shown, so we don't need to do
          // anything extra here.
          break;
        case TicketType.Incident:
        case TicketType.SupportRequest: {
          // Show the Notes tab where the textareas are.
          showTab(ServiceNowUITab.Notes);

          // Determine if both the comments and work notes are being displayed already.
          const multipleTextFieldContainer = document.getElementById(
            "multiple-input-journal-entry"
          );
          if (
            (multipleTextFieldContainer &&
              multipleTextFieldContainer.offsetParent) ||
            isNewTicket
          ) {
            // The container for multiple fields is already being shown; no need to do anything
            // more.
            return;
          }

          // Otherwise, only one textarea is being shown. It *may* be the comments textarea, but it
          // might also be the work notes textarea, so we need to check that and switch to the
          // comments textarea if necessary.
          const checkboxes = document.querySelectorAll<HTMLInputElement>(
            "input[type=checkbox][name=comments-journal-checkbox]," +
              "input[type=checkbox][name=work_notes-journal-checkbox]"
          );

          if (checkboxes.length === 0) {
            throw new Error(
              "Could not find comment / work notes toggle checkbox."
            );
          }
          if (checkboxes.length > 1) {
            console.warn(
              "Multiple comment / work notes toggle checkboxes found. Using the first one."
            );
          }
          const checkbox = checkboxes[0];

          const parent = assertNotNull(
            checkbox.parentElement,
            "Could not find parent element of comment / work notes toggle checkbox."
          );

          // Check if this is a Work Notes or Comments checkbox.
          const isWorkNotesEnabled = parent.innerText
            .toLowerCase()
            .includes("work notes")
            ? checkbox.checked
            : !checkbox.checked;

          // If work notes are enabled, we need to disable them by clicking the checkbox.
          if (isWorkNotesEnabled) {
            checkbox.click();
          }
          break;
        }
      }
      break;
    }
    case TextAreaType.WorkNotes: {
      switch (getTicketType()) {
        case TicketType.Task: {
          // Task tickets always have the Work Notes text area visible in the Notes tab, so we just
          // need to switch to that tab.
          showTab(ServiceNowUITab.Notes);
          break;
        }
        case TicketType.Incident:
        case TicketType.SupportRequest: {
          // Show the Notes tab where the textareas are.
          showTab(ServiceNowUITab.Notes);

          // Determine if both the comments and work notes are being displayed already.
          const multipleTextFieldContainer = document.getElementById(
            "multiple-input-journal-entry"
          );
          if (
            (multipleTextFieldContainer &&
              multipleTextFieldContainer.offsetParent) ||
            isNewTicket
          ) {
            // The container for multiple fields is already being shown; no need to do anything
            // more.
            return;
          }

          // Otherwise, only one textarea is being shown. It *may* be the comments textarea, but it
          // might also be the work notes textarea, so we need to check that and switch to the
          // comments textarea if necessary.
          const checkboxes = document.querySelectorAll<HTMLInputElement>(
            "input[type=checkbox][name*=journal-checkbox]"
          );

          if (checkboxes.length === 0) {
            throw new Error(
              "Could not find comment / work notes toggle checkbox."
            );
          }
          if (checkboxes.length > 1) {
            console.warn(
              "Multiple comment / work notes toggle checkboxes found. Using the first one."
            );
          }
          const checkbox = checkboxes[0];

          const parent = assertNotNull(
            checkbox.parentElement,
            "Could not find parent element of comment / work notes toggle checkbox."
          );

          // Check if this is a Work Notes or Comments checkbox.
          const isWorkNotesEnabled = parent.innerText
            .toLowerCase()
            .includes("work notes")
            ? checkbox.checked
            : !checkbox.checked;

          // If work notes are not enabled, we need to enable them by clicking the checkbox.
          if (!isWorkNotesEnabled) {
            checkbox.click();
          }
          break;
        }
      }
      break;
    }
    case TextAreaType.CommentsAndWorkNotes: {
      switch (getTicketType()) {
        case TicketType.Task: {
          // Task tickets always have the Comments text area visible, and the Work Notes text area
          // is visible in the Notes tab, so we just need to switch to that tab.
          showTab(ServiceNowUITab.Notes);
          break;
        }
        case TicketType.Incident:
        case TicketType.SupportRequest: {
          // Show the Notes tab where the textareas are.
          showTab(ServiceNowUITab.Notes);

          // Determine if both the comments and work notes are being displayed already.
          const multipleTextFieldContainer = document.getElementById(
            "multiple-input-journal-entry"
          );
          if (
            (multipleTextFieldContainer &&
              multipleTextFieldContainer.offsetParent) ||
            isNewTicket
          ) {
            // The container for multiple fields is already being shown; no need to do anything
            // more.
            return;
          }

          const singleTextFieldContainer = assertNotNull(
            document.getElementById("single-input-journal-entry"),
            "Could not find #single-input-journal-entry element."
          );

          const toggleBtn = assertNotNull(
            singleTextFieldContainer.querySelector(
              ".form-toggle-inputs button"
            ),
            "Could not find single/multi-textarea toggle button."
          ) as HTMLButtonElement;

          toggleBtn.click();
          break;
        }
      }
      break;
    }
  }
};

addTextAreaData((textarea) => {
  const elementStyles = getComputedStyle(textarea);

  const mirror = makeElement("div", {
    className: `${constants.EXTENSION_PREFIX}-textarea-mirror`,
  });
  document.body.appendChild(mirror);

  const tooltip = makeElement(
    "div",
    {
      className: `${constants.EXTENSION_PREFIX}-textarea-tooltip form-control`,
      style: "display: none; width: auto !important;",
    },
    `<button class="btn btn-default"><span class="icon icon-connect-close"></span></button><span></span>`
  );
  if (textarea.parentNode) {
    textarea.parentNode.appendChild(tooltip);
  }
  tooltip.firstElementChild!.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  tooltip.firstElementChild!.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Call the closer callback associated with the textarea.
    getTextAreaData(textarea)?.tooltipCloser?.(e);
    // Remove the tooltip.
    setTextAreaTooltip(textarea, null);
  });

  // Now, we can add the bar element after the textarea.
  const subBar = makeElement("div", {
    className: `${constants.EXTENSION_PREFIX}-textarea-sub-bar form-control`,
  });

  if (textarea.parentNode) {
    textarea.parentNode.insertBefore(subBar, textarea.nextElementSibling);
  }
  textarea.setAttribute(
    `data-${constants.EXTENSION_PREFIX}-has-sub-bar`,
    "false"
  );

  // If the textarea has a height of 0 and is a direct descendant of <body>, we probably
  // don't want to show this sub bar since the textarea is hidden and probably won't be shown.
  if (textarea.offsetHeight <= 1 && textarea.parentNode === document.body) {
    subBar.style.display = "none";
  }

  // formFieldInnerText: null,
  // isTabbingFormFields: false,
  // wasTabbingFormFields: false,

  return {
    element: textarea,
    elementStyles,
    suppressInputs: false,
    mirror,
    tooltip,
    subBar,
    formFieldIndex: 0,
    isTabbingFormFields: false,
    textBetweenFormFields: null,
    characterCounter: null,
    hiddenCharacterCounter: null,
    characterCounterFunction: (text: string) => text.length,
  };
});

const characterCounterObserverCallback = (
  observer: MutationObserver,
  textarea: HTMLTextAreaElement
) => {
  // Check if this textarea has a character counter after it. If it does, we need to change it.
  // ServiceNow (most likely) waits for the textarea to update, and then uses .nextElementSibling to
  // retrieve the character counter, and then updates it. We want to insert an element right after
  // the textarea, and before the character counter though, so in order to prevent ServiceNow from
  // overwriting and elements we add in between that space, we make a hidden character counter
  // element that gets updated by ServiceNow. Every time that gets changed, we update the previous
  // character counter to match that text. That allows us to insert elements after the textarea, but
  // before the counter displayed text.
  const actualCounter = textarea.nextElementSibling?.classList.contains(
    "counter"
  )
    ? textarea.nextElementSibling
    : textarea.nextElementSibling?.nextElementSibling?.classList.contains(
        "counter"
      )
    ? textarea.nextElementSibling.nextElementSibling
    : null;
  const data = getTextAreaData(textarea);

  // Check that there is an actual counter associated with this element.
  if (!data || !isInstance(actualCounter, HTMLElement)) return;

  const match = actualCounter.innerText.match(
    /\d+ characters remaining of (\d+) characters/
  );
  const maxChars = match ? +match[1] : 0;

  observer.disconnect();
  data.characterCounter = actualCounter;
  const hiddenCounter = makeElement("span", {
    // Since ServiceNow just uses .nextElementSibling and overwrites its innerText, we can straight
    // up hide our counter with display: none. The text will still get updated.
    style: "display: none;",
    className: `counter ${constants.EXTENSION_PREFIX}-hidden-char-counter`,
  });
  data.hiddenCharacterCounter = hiddenCounter;
  // Wait for ServiceNow to update the hiddenCounter's innerText, and then copy that to the old
  // counter display.
  new MutationObserver(() => {
    const charCount = data.characterCounterFunction(textarea.value);
    const leftover = maxChars - charCount;
    actualCounter.innerText = `${leftover} characters remaining of ${maxChars} characters`;
    if (leftover >= 20) {
      actualCounter.classList.remove("warning", "exceeded");
    } else if (leftover >= 0) {
      actualCounter.classList.remove("exceeded");
      actualCounter.classList.add("warning");
    } else {
      actualCounter.classList.remove("warning");
      actualCounter.classList.add("exceeded");
    }
  }).observe(hiddenCounter, {
    characterData: true,
    childList: true,
    subtree: true,
  });
  if (textarea.parentNode) {
    textarea.parentNode.insertBefore(hiddenCounter, textarea.nextSibling);
    textarea.parentNode.insertBefore(data.subBar, actualCounter);
  }

  // The next, NEXT element may also need to be copied in the same way.
  const liveRegion = actualCounter.nextElementSibling?.id.includes(
    "live_region_text"
  )
    ? actualCounter.nextElementSibling
    : actualCounter.nextElementSibling?.nextElementSibling?.id.includes(
        "live_region_text"
      )
    ? actualCounter.nextElementSibling.nextElementSibling
    : null;
  if (!isInstance(liveRegion, HTMLElement)) return;
  const liveRegionClone = makeElement("span", {
    style: "display: none;",
  });
  new MutationObserver(() => {
    liveRegion.innerText = liveRegionClone.innerText;
  }).observe(liveRegionClone, {
    characterData: true,
    childList: true,
    subtree: true,
  });
  if (textarea.parentNode) {
    textarea.parentNode.insertBefore(
      liveRegionClone,
      hiddenCounter.nextSibling
    );
  }
};

addTextAreaCallback((textarea) => {
  /**
   * Add a keydown listener for tabbing between form fields when the field is being treated as a
   * form.
   */
  textarea.addEventListener("keydown", (e: KeyboardEvent) => {
    const data = getTextAreaData<ReplacementsTextAreaDataSlice>(textarea);
    if (!data) return;

    if (
      e.code === "Tab" &&
      (data.isTabbingFormFields || data.wasTabbingFormFields) &&
      Array.isArray(data.textBetweenFormFields) &&
      !data.isReplacing
    ) {
      const index = e.shiftKey
        ? Math.ceil(data.formFieldIndex) - 1
        : Math.floor(data.formFieldIndex) + 1;
      const caretIndices = getFormFieldIndices(textarea)?.[index - 1];
      // Allow a Tab event to go through as normal if we are no longer focusing on
      // a tabbable field.
      if (caretIndices) {
        e.preventDefault();
        data.formFieldIndex = index;
        data.element.setSelectionRange(caretIndices[0], caretIndices[1]);
        setTextAreaTooltip(
          textarea,
          `Use <kbd>Tab</kbd> to move to the next field (${index}/${
            data.textBetweenFormFields.length - 1
          })`,
          () => handleCloseFormTooltip(textarea)
        );
      }
    }
  });

  const observer = new MutationObserver((_, observer) =>
    characterCounterObserverCallback(observer, textarea)
  );
  if (textarea.parentNode) {
    observer.observe(textarea.parentNode, {
      childList: true,
    });
    characterCounterObserverCallback(observer, textarea);
  }

  // Update the decorator element (the golden side strip thingy) to match the height of the textarea
  // as it changes.
  for (
    let prevNode = textarea.previousElementSibling;
    prevNode;
    prevNode = prevNode.previousElementSibling
  ) {
    if (
      prevNode.classList.contains("sn-stream-input-decorator") &&
      isInstance(prevNode, HTMLElement)
    ) {
      const decorator = prevNode;
      decorator.style.bottom = "initial";
      const data = getTextAreaData(textarea);
      decorator.style.height =
        (data?.elementStyles
          ? parseFloat(data.elementStyles.height)
          : textarea.getBoundingClientRect().height) -
        6 +
        "px";
      new MutationObserver(() => {
        if (!data) return;
        decorator.style.height =
          parseFloat(data.elementStyles.height) - 6 + "px";
      }).observe(textarea, {
        attributes: true,
        attributeFilter: ["style"],
      });
      break;
    }
  }

  textarea.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      // If the user presses Escape while a tooltip is being shown, close it and invoke the close
      // listener.
      getTextAreaData(textarea)?.tooltipCloser?.(e);
      setTextAreaTooltip(textarea, null);
    }
  });
});

const handleCloseFormTooltip = (textarea: HTMLTextAreaElement) => {
  const data = getTextAreaData(textarea);
  if (!data) return;
  data.isTabbingFormFields = false;
  data.wasTabbingFormFields = false;
  data.formFieldIndex = 0;
  data.textBetweenFormFields = null;
};

document.addEventListener("selectionchange", () => {
  if (!isInstance(document.activeElement, HTMLTextAreaElement)) return;
  const data = getTextAreaData(document.activeElement);
  const textarea = document.activeElement;

  // If this textarea does not have data associated with it, or we are not currently using it as a
  // form, we don't need to do anything else.
  if (!data || (!data.wasTabbingFormFields && !data.isTabbingFormFields))
    return;

  // Determine which field is currently focused by checking where the caret lies.
  const caretPos = textarea.selectionStart;
  const tabFieldIndices = getFormFieldIndices(textarea);

  // If we aren't able to match the textfield's value with the form template, the form is broken and
  // we can no longer use it as a form.
  if (!tabFieldIndices) {
    data.isTabbingFormFields = false;
    data.wasTabbingFormFields = false;
    data.textBetweenFormFields = null;
    data.formFieldIndex = 0;
    setTextAreaTooltip(textarea, null);
    return;
  }

  let currentIndex = tabFieldIndices.length + 0.5;
  for (let fieldIndex = 0; fieldIndex < tabFieldIndices.length; fieldIndex++) {
    const [start, end] = tabFieldIndices[fieldIndex];
    if (caretPos < start) {
      currentIndex = fieldIndex + 0.5;
      break;
    } else if (caretPos <= end) {
      currentIndex = fieldIndex + 1;
      break;
    }
  }

  if (currentIndex % 1 === 0) {
    // We are focusing on a specific field. We can show the exact number in the tooltip.
    data.isTabbingFormFields = true;
    data.wasTabbingFormFields = false;
    data.formFieldIndex = currentIndex;
    setTextAreaTooltip(
      textarea,
      `Use <kbd>Tab</kbd> to move to the next field (${currentIndex}/${tabFieldIndices.length})`,
      () => handleCloseFormTooltip(textarea)
    );
  } else {
    // We are focusing on some index in between fields. Instead of showing the exact number, show a
    // "?" to indicate that we are not focused on any of the fields.
    data.isTabbingFormFields = false;
    data.wasTabbingFormFields = true;
    data.formFieldIndex = currentIndex;
    setTextAreaTooltip(
      textarea,
      `Use <kbd>Tab</kbd> to move to the next field (?/${tabFieldIndices.length})`,
      () => handleCloseFormTooltip(textarea)
    );
  }
});

/**
 * Given a textarea, returns its type.
 * @param textarea The textarea to get the text for.
 * @returns The textarea's type.
 */
export const getTextAreaType = (
  textarea: HTMLTextAreaElement
): Exclude<TextAreaType, TextAreaType.CommentsAndWorkNotes> | null => {
  const id = textarea.id;
  const ticketType = getTicketType();
  const isNewTicket = getIsNewTicket();
  if (id === "activity-stream-textarea") {
    const type = textarea.dataset.streamTextInput;
    if (type?.includes("comments")) {
      return TextAreaType.Comments;
    } else if (type?.includes("work_notes")) {
      return TextAreaType.WorkNotes;
    } else {
      return null;
    }
  } else if (
    id.includes("work_notes") &&
    (id.includes("activity-stream") || isNewTicket)
  ) {
    return TextAreaType.WorkNotes;
  } else if (
    id.includes("comments") &&
    (ticketType === TicketType.Task ||
      id.includes("activity-stream") ||
      isNewTicket)
  ) {
    return TextAreaType.Comments;
  } else if (id.includes("close_notes")) {
    return TextAreaType.CloseNotes;
  } else {
    return null;
  }
};

export const writeToTextArea: {
  /**
   * Writes the specified text to a textarea. Parses any replacements automatically.
   * @param textarea The textarea to update the text for.
   * @param value The value to write to the textarea.
   * @param caretPosition An optional caretPosition to maintain after writing to the textarea.
   */
  (
    textarea: HTMLTextAreaElement,
    value: string,
    caretPosition?: CaretPosition | null | undefined
  ): void;
  /**
   * Writes the specified text to a textarea. Parses any replacements automatically.
   * @param textarea The textarea to update the text for.
   * @param value The value to write to the textarea.
   * @param caretPositions An optional array of caretPositions to maintain after writing to the
   * textarea.
   */
  (
    textarea: HTMLTextAreaElement,
    value: string,
    caretPositions?: CaretPosition[] | null | undefined
  ): void;
} = (
  textarea: HTMLTextAreaElement,
  value: string,
  passedCaretPositions?: CaretPosition[] | CaretPosition | null | undefined
): void => {
  const data = getTextAreaData(textarea);
  if (!data) return;

  passedCaretPositions = Array.isArray(passedCaretPositions)
    ? passedCaretPositions.length === 2 &&
      typeof passedCaretPositions[0] === "number" &&
      typeof passedCaretPositions[1] === "number"
      ? [passedCaretPositions as CaretPosition]
      : (passedCaretPositions as CaretPosition[])
    : [];

  // Resolve any replacements in the text.
  const [resolvedValue, caretPositions] = resolveReplacements(
    value,
    passedCaretPositions
  );

  if (textarea.offsetParent) textarea.focus();

  if (textarea.value !== resolvedValue) {
    // Check if the browser will let us carry out the proper commands.
    const insertHTMLAllowed =
      document.queryCommandSupported("insertHTML") &&
      document.queryCommandEnabled("insertHTML");
    const insertTextAllowed =
      document.queryCommandSupported("insertText") &&
      document.queryCommandEnabled("insertText");

    // Instead of replacing the entire textarea's value, we just want to replace the subsection
    // that changes. For example, if the textarea already says "this is some text", and we want to
    // write "this is example text", we only need to replace "some" with "example". This makes it
    // easier for undoing and redoing.
    // Calculate where the first difference is.
    let startIndex = -1;
    for (
      let i = 0;
      i < Math.max(resolvedValue.length, textarea.value.length);
      i++
    ) {
      if (resolvedValue[i] !== textarea.value[i]) {
        startIndex = i;
        break;
      }
    }

    // Do the same from the end.
    let endIndex = -1;
    for (
      let i = 0;
      i < Math.max(resolvedValue.length, textarea.value.length);
      i++
    ) {
      if (
        resolvedValue[resolvedValue.length - i - 1] !==
        textarea.value[textarea.value.length - i - 1]
      ) {
        endIndex = i;
        break;
      }
    }

    let hasBeenReplaced = false;
    const replacementValue = resolvedValue.substring(
      startIndex,
      resolvedValue.length - endIndex
    );

    data.suppressInputs = true;
    if (insertHTMLAllowed && document.activeElement === textarea) {
      textarea.setSelectionRange(startIndex, textarea.value.length - endIndex);

      // We set the textarea's value using insertHTML to allow for undoing/redoing, and because
      // insertHTML seems to perform much faster than insertText in some browsers.
      hasBeenReplaced = document.execCommand(
        "insertHTML",
        false,
        escapeHTML(replacementValue) +
          (replacementValue[replacementValue.length - 1] === "\n" ? "<br>" : "")
      );
    } else if (insertTextAllowed && document.activeElement === data.element) {
      textarea.setSelectionRange(startIndex, textarea.value.length - endIndex);

      // Fall back to insertText if insertHTML is not enabled (Firefox).
      hasBeenReplaced = document.execCommand(
        "insertText",
        false,
        replacementValue
      );
    }

    if (!hasBeenReplaced) {
      // Set the value directly if all else fails.
      textarea.value = resolvedValue;
    }
    data.suppressInputs = false;
  }

  // If we have multiple places to insert a caret, turn this into a form with multiple fields to
  // tab to.
  if (caretPositions.length > 1) {
    setTextAreaTooltip(
      textarea,
      `Use <kbd>Tab</kbd> to move to the next field (1/${caretPositions.length})`,
      () => handleCloseFormTooltip(textarea)
    );
    data.isTabbingFormFields = true;
    data.formFieldIndex = 1;
    data.textBetweenFormFields = new Array(caretPositions.length + 1);
    for (let i = 0, lastIndex = 0; i < caretPositions.length; i++) {
      data.textBetweenFormFields[i] = resolvedValue.substring(
        lastIndex,
        caretPositions[i][0]
      );
      lastIndex = caretPositions[i][1];
    }
    data.textBetweenFormFields[caretPositions.length] = resolvedValue.substring(
      caretPositions[caretPositions.length - 1][1]
    );
  }
  if (caretPositions.length > 0) {
    textarea.setSelectionRange(...caretPositions[0]);
  }
};

export const resolveReplacements: {
  /**
   * Given a string with `{{replacements}}`, replaces those with their corresponding value and returns
   * the resulting string, along with any caret positions defined by `{{cursor}}`s.
   * @param value The string with replacements to resolve.
   * @param caretPosition The current caret position in the textarea, if any. The caret position is
   *        kept as close as possible to its original position.
   * @returns A 2-tuple where the first item is the string with replacements resolved, and the second
   *        item is an array of caret positions.
   */
  (value: string, caretPosition?: CaretPosition | null | undefined): [
    resolvedText: string,
    caretPositions: CaretPosition[]
  ];
  /**
   * Given a string with `{{replacements}}`, replaces those with their corresponding value and returns
   * the resulting string, along with any caret positions defined by `{{cursor}}`s.
   * @param value The string with replacements to resolve.
   * @param caretPositions The current caret positions in the textarea, if any. The caret positions
   *        are kept as close as possible to their original positions.
   * @returns A 2-tuple where the first item is the string with replacements resolved, and the second
   *        item is an array of caret positions.
   */
  (value: string, caretPositions?: CaretPosition[] | null | undefined): [
    resolvedText: string,
    caretPositions: CaretPosition[]
  ];
} = (
  value: string,
  passedCaretPositions?: CaretPosition[] | CaretPosition | null | undefined
): [resolvedText: string, caretPositions: CaretPosition[]] => {
  const [resolvedText, caretPositions] = resolveReplacementsRecursive(
    0,
    value,
    Array.isArray(passedCaretPositions)
      ? passedCaretPositions.length === 2 &&
        typeof passedCaretPositions[0] === "number" &&
        typeof passedCaretPositions[1] === "number"
        ? [passedCaretPositions as CaretPosition]
        : (passedCaretPositions as CaretPosition[])
      : []
  );
  // Sort caret positions by their starting index.
  caretPositions.sort((a, b) => a[0] - b[0]);
  return [resolvedText, caretPositions];
};

/**
 * The recursive function used by `resolveReplacements`. Each call will look for {{replacement}}s in
 * the passed-in string and resolve one layer, calling itself recursively to resolve any nested
 * replacements.
 * @param level The current level of recursion. Each recursive call adds 1 to this value, and stops
 *    `   once it reaches `constants.MAX_REPLACEMENT_RECURSION_DEPTH`.
 * @param value The string to resolve replacements for.
 * @param caretPositions A list of caret positions to maintain and add to when making replacements.
 * @returns A 2-tuple where the first item is the string with replacements resolved, and the second
 *        item is an array of caret positions.
 */
const resolveReplacementsRecursive = (
  level: number,
  value: string,
  caretPositions: CaretPosition[]
): [resolvedText: string, caretPositions: CaretPosition[]] => {
  let lastIndex = value.length;
  let startIndex: number;

  // Get the position of the last opening delimiter in the string and repeat until we're done.
  while (
    ~(startIndex = value.lastIndexOf(
      constants.REPLACEMENT_DELIMITERS.START,
      lastIndex
    )) &&
    lastIndex >= 0
  ) {
    // Check if there is a closing delimiter that follows this starting delimiter.
    const endIndex = value.indexOf(
      constants.REPLACEMENT_DELIMITERS.END,
      startIndex
    );
    // No end delimiter indicates there are no more replacements to make.
    if (!~endIndex) {
      break;
    }

    // Get the string between the two delimiters.
    const nestedString = value.substring(
      startIndex + constants.REPLACEMENT_DELIMITERS.START.length,
      endIndex
    );
    const [expansion, extraCaretPositions, gotExpanded] = expandString(
      level + 1,
      nestedString
    );

    // Move over any existing carets to account for the new replacement.
    caretPositions = caretPositions.map(([leftCaretPos, rightCaretPos]) => {
      let newLeftPos = leftCaretPos;
      let newRightPos = rightCaretPos;
      if (
        gotExpanded &&
        endIndex + constants.REPLACEMENT_DELIMITERS.END.length <= rightCaretPos
      ) {
        // If the caret position is after the current replacement, we need to move it to account
        // for the new characters.
        newRightPos +=
          expansion.length -
          (endIndex + constants.REPLACEMENT_DELIMITERS.END.length - startIndex);
      } else if (gotExpanded && startIndex < newRightPos) {
        // If the caretPosition is in between the starting end ending delimiters, we move the
        // caret position to be right after the replacement.
        newRightPos = startIndex + expansion.length;
      } else {
        // Otherwise we don't need to move the caret at all.
      }

      // Do the same for the left caret position.
      if (
        gotExpanded &&
        endIndex + constants.REPLACEMENT_DELIMITERS.END.length <= leftCaretPos
      ) {
        newLeftPos +=
          expansion.length -
          (endIndex + constants.REPLACEMENT_DELIMITERS.END.length - startIndex);
      } else if (gotExpanded && startIndex < newLeftPos) {
        newLeftPos = startIndex + expansion.length;
      }
      return [newLeftPos, newRightPos];
    });

    // Add the new caret positions to the list, after moving them over as well.
    caretPositions = caretPositions.concat(
      extraCaretPositions.map(([leftCaretPos, rightCaretPos]) => [
        leftCaretPos + startIndex,
        rightCaretPos + startIndex,
      ])
    );

    value =
      value.substring(0, startIndex) +
      expansion +
      value.substring(endIndex + constants.REPLACEMENT_DELIMITERS.END.length);
    // Update lastIndex so we only look for opening delimiters from before the current point.
    lastIndex = startIndex - 1;
  }

  // Return the value with replacements resolved, along with an array of cursor positions.
  return [value, caretPositions];
};

/**
 * Replaces the value inside replacement delimiters with the corresponding replacement. Since
 * replacements may contain other replacements, this function is recursive and has a maximum
 * recursion depth of `constants.MAX_REPLACEMENT_RECURSION_DEPTH`.
 * @param string The text inside replacement delimiters.
 * @param level The current level of nesting.
 * @returns A 3-tuple where the first item is the resolved string, the second item is a list of
 *        CaretPositions that were generated by this replacement, and the third item is a boolean
 *        indicating whether or not the string was expanded correctly. The second item can be false
 *        for a replacement that does not exist.
 */
const expandString = (
  level: number,
  string: string
): [
  expansion: string,
  caretPositions: CaretPosition[],
  gotExpanded: boolean
] => {
  if (level >= constants.MAX_REPLACEMENT_RECURSION_DEPTH) {
    return ["[Maximum recursion depth exceeded]", [], true];
  }
  const unchanged = string;
  let caretPositions: CaretPosition[] = [];

  // Check if this replacement has arguments by looking for a colon.
  const colonIndex = string.indexOf(":");

  // If there is a colon, we have to parse out parameters for the replacement.
  let parameters: ReturnType<typeof parseReplacementParameters> = [];
  if (~colonIndex) {
    // Resolve any replacements in the parameters as well.
    parameters = parseReplacementParameters(string.substring(colonIndex + 1));
    string = string.substring(0, colonIndex);
  }

  string = string.trim().toLowerCase();

  let replacedValue: string;
  if (string === "cursor") {
    // Handle the "cursor" replacement as a special one.
    replacedValue = parameters[0] || "";
    caretPositions.push([0, replacedValue.length]);
  } else if (string in replacementByTrigger) {
    // If this string is a valid trigger, replace it with its replacement value.
    const replacement = replacementByTrigger[string];
    // Check if the value is a function. If it is, we need to run that function to get the
    // value.
    if ("exec" in replacement) {
      const value = replacement.exec(...parameters);

      // If the function returns null, it means we shouldn't expand to anything.
      if (value == null) {
        return [withReplacementDelimiters(unchanged), [], false];
      }

      // Otherwise, save the dedented value to `replacedValue`.
      replacedValue = dedent(value);
    } else {
      // If it is not a function, we can just return the value directly, which was already dedented.
      replacedValue = replacement.value;
    }
  } else {
    // No trigger with this name; return the value unchanged.
    return [withReplacementDelimiters(unchanged), [], false];
  }

  // Now that we have the replaced value, check for nested replacements.
  [replacedValue, caretPositions] = resolveReplacementsRecursive(
    level,
    replacedValue,
    caretPositions
  );

  return [replacedValue, caretPositions, true];
};

/**
 * Given a string of parameters for a replacement, parses them into a list of strings.
 * @param string The string to parse parameters from.
 * @returns A list of stringified parameters.
 */
const parseReplacementParameters = (string: string): string[] => {
  // Add a comma to the end of the string so we can handle the final parameter like any other.
  string += ",";
  let closingQuote: string | null = null;
  const params: string[] = [];
  let lastIndex = 0;
  for (let i = 0; i < string.length; i++) {
    if (closingQuote == null && string[i] === ",") {
      params.push(string.substring(lastIndex, i));
      // Skip over the next space if there is one.
      if (string[i + 1] === " ") i++;
      lastIndex = i + 1;
    }
    if (
      closingQuote == null &&
      lastIndex === i &&
      (string[i] === '"' || string[i] === "'")
    ) {
      // Make sure there is a closing quote somewhere in the string.
      const hasClosing = !!~string.indexOf(string[i], i + 1);
      if (!hasClosing) {
        // If there is no closing quote, don't consider this quote as a special character.
        continue;
      }
      closingQuote = string[i];
      lastIndex++;
    } else if (closingQuote != null && string[i] === closingQuote) {
      // Check if the next char (after trimming) is a comma.
      if (string.substring(i + 1).trim()[0] === ",") {
        // This is a valid closing quote. Delete this quote so we don't include it in the params.
        // Also trim the space that follows so the next character is the comma.
        string = string.substring(0, i) + string.substring(i + 1).trimStart();
        // Decrement i so that when it gets incremented again, it will be at the comma.
        i--;
      } else {
        // This isn't a valid closing quote, and we should add the original quote back to the
        // string.
        lastIndex--;
      }
      closingQuote = null;
    } else if (string[i] === "\\") {
      // Delete this backslash and let the i counter move on to the next character so we can handle
      // escape sequences..
      string = string.substring(0, i) + string.substring(i + 1);
    }
  }
  return params;
};

/**
 * Allows you to insert an element in the sidebar underneath a textarea.
 * @param callback A callback that returns an element to add to the sub bar, or null.
 */
export const addToSubBar = (callback: SubBarElementCallback): void => {
  addTextAreaCallback((textarea) => {
    const data = getTextAreaData(textarea);
    if (!data) return;

    const element = callback(textarea);
    if (!element) return;

    data.subBar.appendChild(element);
    textarea.setAttribute(
      `data-${constants.EXTENSION_PREFIX}-has-sub-bar`,
      "true"
    );
  });
};

/**
 * Copies over styles from one CSS selector to another based on the stylesheets in the document.
 * Each CSS style that references the `oldSelector` will be copied and changed such that any
 * occurrence of `oldSelector` is replaced with `newSelector`, allowing elements that match
 * `newSelector` to have the same styles as elements that match `oldSelector`.
 * @param oldSelector The selector we want to replace with the `newSelector`.
 * @param newSelector The selector we want to replace `oldSelector` with.
 */
export const interceptStyles = (
  oldSelector: CSSSelector,
  newSelector: CSSSelector
): void => {
  // Call `interceptStylesWithinWindow` for every ancestor window and the current window.
  let currWindow: Window = window;
  while (currWindow) {
    interceptStylesWithinWindow(oldSelector, newSelector, currWindow);
    if (currWindow.parent === currWindow) break;
    currWindow = currWindow.parent;
  }
};

/**
 * The function used by `interceptStyles` to intercept styles in one particular window.
 * @see interceptStyles
 * @param oldSelector The old selector to replace with `newSelector`.
 * @param newSelector The new selector to replace `oldSelector` with.
 * @param window The window whose stylesheets should be intercepted.
 */
const interceptStylesWithinWindow = (
  oldSelector: CSSSelector,
  newSelector: CSSSelector,
  window: Window
): void => {
  const stylesheets = Array.from(window.document.styleSheets);

  for (const stylesheet of stylesheets) {
    // Skip over any stylesheets that don't mention the oldSelector we're looking for.
    if (
      isInstance(stylesheet.ownerNode, HTMLStyleElement) &&
      !stylesheet.ownerNode.innerHTML.includes(oldSelector)
    ) {
      continue;
    }

    replaceSheetSelector(oldSelector, newSelector, window, stylesheet);

    if (
      !isInstance(stylesheet.ownerNode, HTMLStyleElement) &&
      !isInstance(stylesheet.ownerNode, HTMLLinkElement)
    ) {
      continue;
    }
    const styleElem = stylesheet.ownerNode as
      | HTMLStyleElement
      | HTMLLinkElement;

    // Add a MutationObserver for this stylesheet in case it changes.
    new MutationObserver(function () {
      const sheet = styleElem.sheet;
      if (!sheet) return;
      replaceSheetSelector(oldSelector, newSelector, window, sheet);
    }).observe(styleElem, {
      characterData: styleElem.nodeName === "STYLE",
      childList: styleElem.nodeName === "STYLE",
      attributes: styleElem.nodeName === "LINK",
      attributeFilter: ["href"],
    });
  }

  // Add an observer in case new stylesheets are added later.
  new MutationObserver((mutationRecords) => {
    for (const record of mutationRecords) {
      for (const node of Array.from(record.addedNodes)) {
        if (isInstance(node, HTMLStyleElement)) {
          // <style>s always have a .sheet property right away since their CSS is parsed
          // synchronously.
          if (node.sheet)
            replaceSheetSelector(oldSelector, newSelector, window, node.sheet!);
        } else if (
          isInstance(node, HTMLLinkElement) &&
          node.rel.toLowerCase() === "stylesheet"
        ) {
          // <link>s make a request to get a stylesheet from another link, so they are loaded
          // asynchronously and thus may already have a .sheet, or may not be loaded yet. We take
          // care of both of these cases here.
          if (node.sheet) {
            replaceSheetSelector(oldSelector, newSelector, window, node.sheet);
          } else {
            node.addEventListener("load", () => {
              if (node.sheet)
                replaceSheetSelector(
                  oldSelector,
                  newSelector,
                  window,
                  node.sheet
                );
            });
          }
        }
      }
    }
  }).observe(window.document.head, {
    childList: true,
  });
};

/**
 * The function used by `interceptStylesWithinWindow` to replace styles within an individual
 * CSSStyleSheet object.
 * @see interceptStylesWithinWindow
 * @param oldSelector The old selector to replace with `newSelector`.
 * @param newSelector The new selector to replace `oldSelector` with.
 * @param window The window that the `stylesheet` belongs to.
 * @param stylesheet The `CSSStyleSheet` to replace styles in.
 */
const replaceSheetSelector = (
  oldSelector: CSSSelector,
  newSelector: CSSSelector,
  window: Window,
  stylesheet: CSSStyleSheet
): void => {
  const newRules = [];
  const oldRules = Array.from(stylesheet.cssRules).filter(
    // instanceof CSSStyleSheet doesn't work for whatever reason, and MDM recommends using
    // `constructor.name` to differentiate between different types of CSSRules.
    (rule) => rule.constructor.name === "CSSStyleRule"
  ) as CSSStyleRule[];

  // Iterate through the stylesheet's rules to look for any that mention the oldSelector. Add those
  // styles to newRules and replace oldSelector with newSelector.
  for (const rule of oldRules) {
    if (rule.selectorText.includes(oldSelector)) {
      newRules.push(rule.cssText.replaceAll(oldSelector, newSelector));
    }
  }

  // Insert this replacement stylesheet into the DOM.
  if (newRules.length) {
    window.document.head.appendChild(
      makeElement(
        "style",
        {
          [`data-${constants.EXTENSION_PREFIX}-intercepted-stylesheet`]: "true",
        },
        newRules.join("\n")
      )
    );
  }
};

/**
 *
 * @param state The state to convert into a state string.
 * @returns A string representing the ticket state.
 */
export const ticketStateToString = (state: TicketState): string => {
  const states: Record<TicketState, Record<TicketType, string>> = {
    [TicketState.New]: {
      [TicketType.Incident]: "New",
      [TicketType.SupportRequest]: "Open",
      [TicketType.Task]: "Open",
    },
    [TicketState.Active]: {
      [TicketType.Incident]: "Active",
      [TicketType.SupportRequest]: "Open",
      [TicketType.Task]: "Open",
    },
    [TicketState.Pending]: {
      [TicketType.Incident]: "Awaiting User Info",
      [TicketType.SupportRequest]: "Hold - Awaiting user information",
      [TicketType.Task]: "Pending",
    },
    [TicketState.Resolved]: {
      [TicketType.Incident]: "Resolved",
      [TicketType.SupportRequest]: "Resolved",
      [TicketType.Task]: "Closed Complete",
    },
  };
  return states[state][getTicketType()];
};

/**
 * Returns whether the current ticket is "new". A "new" ticket hasn't been saved to ServiceNow's
 * database yet. It is editable by the user still, and is created once they save the ticket.
 * @returns A boolean indicating whether this is a new, uncreated ticket.
 */
export const getIsNewTicket = (): boolean => {
  // New tickets have their sys_id unassigned to -1 still, which we can get from the URL.
  return new URLSearchParams(location.search).get("sys_id") === "-1";
};

export const getTextAreaOfType = (
  type: Exclude<TextAreaType, TextAreaType.CommentsAndWorkNotes>
): HTMLTextAreaElement | null => {
  const ticketType = getTicketType();
  const isNewTicket = getIsNewTicket();
  switch (ticketType) {
    case TicketType.Incident:
    case TicketType.SupportRequest: {
      switch (type) {
        case TextAreaType.WorkNotes: {
          // Determine if the single or multiple inputs view is being shown.
          const multipleEntries = document.getElementById(
            "multiple-input-journal-entry"
          );
          if (isNewTicket) {
            return (
              (document.getElementById(
                "incident.work_notes"
              ) as HTMLTextAreaElement | null) ??
              (document.getElementById(
                "ticket.work_notes"
              ) as HTMLTextAreaElement | null) ??
              null
            );
          } else if (multipleEntries?.offsetParent) {
            return (
              (document.getElementById(
                "activity-stream-work_notes-textarea"
              ) as HTMLTextAreaElement | null) ?? null
            );
          } else {
            const element = document.getElementById("activity-stream-textarea");
            return element &&
              element.getAttribute("data-stream-text-input") === "work_notes"
              ? (element as HTMLTextAreaElement)
              : null;
          }
        }
        case TextAreaType.Comments: {
          // Determine if the single or multiple inputs view is being shown.
          const multipleEntries = document.getElementById(
            "multiple-input-journal-entry"
          );
          if (isNewTicket) {
            return (
              (document.getElementById(
                "incident.comments"
              ) as HTMLTextAreaElement | null) ??
              (document.getElementById(
                "ticket.comments"
              ) as HTMLTextAreaElement | null) ??
              null
            );
          } else if (multipleEntries?.offsetParent) {
            return (
              (document.getElementById(
                "activity-stream-comments-textarea"
              ) as HTMLTextAreaElement | null) ?? null
            );
          } else {
            const element = document.getElementById("activity-stream-textarea");
            return element &&
              element.getAttribute("data-stream-text-input") === "comments"
              ? (element as HTMLTextAreaElement)
              : null;
          }
        }
        case TextAreaType.CloseNotes: {
          // "New" ticket close notes have the same ID as normal tickets.
          return (
            (document.getElementById(
              ticketType === TicketType.Incident
                ? "incident.close_notes"
                : "ticket.close_notes"
            ) as HTMLTextAreaElement | null) ?? null
          );
        }
      }
      break;
    }
    case TicketType.Task: {
      // "New" task tickets don't have any textareas, so we don't need to worry about those here.
      switch (type) {
        case TextAreaType.Comments: {
          return (
            (document.getElementById(
              "sc_task.parent.comments"
            ) as HTMLTextAreaElement | null) ?? null
          );
        }
        case TextAreaType.WorkNotes: {
          return (
            (document.getElementById(
              "activity-stream-textarea"
            ) as HTMLTextAreaElement | null) ?? null
          );
        }
        case TextAreaType.CloseNotes: {
          // Task tickets do not have close notes.
          return null;
        }
      }
      break;
    }
  }
};

/**
 * A mapped version of Math.min that returns the minimum item in an iterable after mapping each item
 * to a number.
 * @param map The function to call on each item in `items` to map it to a number. Any non-number is
 *        discarded.
 * @param items The items to return the minimum of.
 * @returns An item from `items` that mapped to the minimal value, or `undefined` if `items` is
 *        empty.
 */
export const mappedMin: {
  <T>(map: (item: T) => unknown): undefined;
  <T>(map: (item: T) => unknown, ...items: T[]): T | undefined;
} = <T>(map: (item: T) => unknown, ...items: T[]): T | undefined => {
  let minValue = Infinity;
  let minItem: T | undefined = undefined;
  for (const item of items) {
    const value = map(item);
    if (typeof value !== "number") continue;
    if (value < minValue) {
      minValue = value;
      minItem = item;
    }
  }
  return minItem;
};

/**
 * A mapped version of Math.max that returns the maximum item in an iterable after mapping each item
 * to a number.
 * @param map The function to call on each item in `items` to map it to a number. Any non-number is
 *        discarded.
 * @param items The items to return the maximum of.
 * @returns An item from `items` that mapped to the maximal value, or `undefined` if `items` is
 *        empty.
 */
export const mappedMax: {
  <T>(map: (item: T) => unknown): undefined;
  <T>(map: (item: T) => unknown, ...items: T[]): T;
} = <T>(map: (item: T) => unknown, ...items: T[]): T | undefined => {
  let maxValue = Infinity;
  let maxItem: T | undefined = undefined;
  for (const item of items) {
    const value = map(item);
    if (typeof value !== "number") continue;
    if (value > maxValue) {
      maxValue = value;
      maxItem = item;
    }
  }
  return maxItem;
};

export const getDisplayOrderForNetDB = (ordering: string[]): string => {
  const options = new URLSearchParams();
  for (let i = 0; i < ordering.length; i++) {
    options.append("display_order." + ordering[i], (i + 1).toString());
  }
  return options.toString();
};
