import {
  addTextAreaCallback,
  addTextAreaData,
  calculateTextPosition,
  escapeHTML,
  getTextAreaData,
  isInstance,
  makeElement,
  turnNoIndexInto,
  writeToTextArea,
} from "../helpers";
import constants from "../constants.json";
import { TextAreaDataSlice } from "./types";
import { namespaces, replacementByTrigger, replacements } from "./data";
import "./styles.scss";
import { ConfigOptions } from "../config";

/**
 * Gives a textarea, returns the trigger name the user is currently typing out. An incomplete
 * trigger name is the text from the user's current selection to the start replacement delimiter
 * that precedes it. If the user is not currently typing out a trigger name, this function returns
 * null.
 *
 * As an example, if the user has typed out `"this is a {{test"`, the incomplete trigger name will
 * be `"test"` since it is the start of a potential trigger, but is not yet complete (since it
 * doesn't have a closing replacement delimiter yet).
 *
 * @param textarea The textarea to get the incomplete trigger name from.
 * @returns The incomplete trigger name the user is in the process of typing, or null if there is
 *        none.
 */
const getIncompleteTriggerName = (
  textarea: HTMLTextAreaElement
): string | null => {
  const data = getTextAreaData(textarea);
  if (!data) return null;

  // If there are less characters in the textarea than there are characters in
  // constants.REPLACEMENT_DELIMITERS.START, there's no way that our caret is positioned after a
  // start delimiter.
  if (
    data.element.selectionStart < constants.REPLACEMENT_DELIMITERS.START.length
  ) {
    return null;
  }

  // Determine if our caret is positioned after a starting delimiter, but not if there is an end-
  // ing delimiter that closes it.
  const startDelimIndex = data.element.value.lastIndexOf(
    constants.REPLACEMENT_DELIMITERS.START,
    data.element.selectionStart - constants.REPLACEMENT_DELIMITERS.START.length
  );
  const endDelimIndex = data.element.value.lastIndexOf(
    constants.REPLACEMENT_DELIMITERS.END,
    data.element.selectionStart - 1
  );
  if (
    !~startDelimIndex ||
    (~endDelimIndex && startDelimIndex < endDelimIndex)
  ) {
    return null;
  }

  // If there is a newline character between the start delimiter and our cursor, we don't want to
  // show the auto filler because more than likely, the user will still want to use the up and
  // down arrow keys to move the caret instead of scrolling through the auto filler menu.
  const newLineIndex = data.element.value.indexOf("\n", startDelimIndex);
  if (~newLineIndex && newLineIndex < data.element.selectionStart) {
    return null;
  }

  // Return the text from the starting delimiter up to the caret.
  return data.element.value.substring(
    startDelimIndex + constants.REPLACEMENT_DELIMITERS.START.length,
    data.element.selectionStart
  );
};

/**
 * Updates the position and content of a textarea's auto-filler. As the user types, the auto-filler
 * may need to change position and/or content, so calling this will do both of those.
 * @param textarea The textarea to update the auto-filler for.
 */
const updateAutoFiller = (textarea: HTMLTextAreaElement): void => {
  const data = getTextAreaData<TextAreaDataSlice>(textarea);
  if (!data) return;

  const incompleteTriggerName = getIncompleteTriggerName(textarea);

  // If we are not currently typing out a macro, we can hide the autoFiller and return.
  if (incompleteTriggerName === null || document.activeElement !== textarea) {
    data.replacementAutoFiller.style.display = "none";
    data.isReplacing = false;
    data.replacementAutoFillerFocusedIndex = null;
    return;
  }

  if (!data.isReplacing) {
    // Otherwise, we want to show the autoFiller and calculate where to show it.
    data.replacementAutoFiller.style.display = "block";
    data.isReplacing = true;
  }

  // Copy the textarea's content to the mirror. We first paste all the text up to the starting
  // delimiter. Then, we insert a <span> with the start delimiter, as well as the word that
  // follows it (i.e., everything up to the next space). Then we calculate the vertical and
  // horizontal position of the span to determine where to place the replacementAutoFiller box.

  // Calculate the positions of the auto filler box by determining where the cursor is currently
  // positioned.
  const startDelimIndex = textarea.value.lastIndexOf(
    constants.REPLACEMENT_DELIMITERS.START,
    textarea.selectionStart - constants.REPLACEMENT_DELIMITERS.START.length
  );
  const whiteSpaceIndex = Math.min(
    turnNoIndexInto(
      textarea.value.length,
      textarea.value.indexOf(" ", startDelimIndex)
    ),
    turnNoIndexInto(
      textarea.value.length,
      textarea.value.indexOf("\n", startDelimIndex)
    ),
    turnNoIndexInto(
      textarea.value.length,
      textarea.value.indexOf("\t", startDelimIndex)
    )
  );

  const caretPosition = calculateTextPosition(
    textarea,
    textarea.value.substring(0, startDelimIndex),
    textarea.value.substring(startDelimIndex, whiteSpaceIndex)
  );

  // Now we can position the replacementAutoFiller directly underneath the opening delimiter.
  data.replacementAutoFiller.style.left =
    Math.min(caretPosition.left, parseFloat(data.mirror.style.width) - 260) +
    parseFloat(data.elementStyles.paddingLeft) +
    parseFloat(data.elementStyles.borderLeftWidth) +
    textarea.offsetLeft -
    textarea.scrollLeft +
    "px";
  data.replacementAutoFiller.style.top =
    caretPosition.top +
    parseFloat(data.elementStyles.paddingTop) +
    parseFloat(data.elementStyles.borderTopWidth) +
    textarea.offsetTop -
    textarea.scrollTop +
    "px";

  // Set the replacementAutoFiller's artificial focus index to 0 (the first item in the list).
  data.replacementAutoFillerFocusedIndex = 0;

  populateAutoFiller(textarea, incompleteTriggerName);
};

/**
 * Populates a textarea's auto-filler with the appropriate replacements according to their current
 * search query. For example, if the user has entered "link.", only replacements withing the "Links"
 * namespace will be shown in the auto-filler.
 * @param textarea The textarea we want to populate the auto-filler for.
 * @param incompleteTriggerName The text that user has typed in for filtering search results.
 */
const populateAutoFiller = (
  textarea: HTMLTextAreaElement,
  incompleteTriggerName: string
): void => {
  const data = getTextAreaData<TextAreaDataSlice>(textarea);
  if (!data) return;

  incompleteTriggerName = incompleteTriggerName.trim().toLowerCase();

  // Make a fragment where we will add all the results.
  const fragment = document.createDocumentFragment();

  // If there is no incomplete trigger name yet (i.e., we haven't typed anything yet), we want to
  // show the list of namespaces instead of filtering results.
  if (incompleteTriggerName.replace(/[^a-zA-Z\d]+/g, "") === "") {
    for (const namespace_object of namespaces) {
      // Each namespace gets its own <li>.
      const li = makeElement(
        "li",
        {
          [`data-${constants.EXTENSION_PREFIX}-autofill-type`]: "namespace",
          [`data-${constants.EXTENSION_PREFIX}-insertion-text`]:
            namespace_object.insert,
          [`data-${constants.EXTENSION_PREFIX}-append-end-delimiter`]: "false",
        },
        `
          <div class="sn-card-component_accent-bar"></div>
          <i class="icon-${namespace_object.icon}"></i>
          <strong>${escapeHTML(namespace_object.name) || '""'}</strong>
          <i class="icon-arrow-right-rounded"></i>
        `
      );

      configureListItem(li, textarea);

      fragment.appendChild(li);
    }
  } else {
    // Otherwise, we can treat the text as a search query and look for replacements that match.

    // Treat the trigger name as a search query.
    let searchQuery = incompleteTriggerName;
    // Get a list of replacements that we are going to search through.
    let searchableReplacements = Object.keys(replacementByTrigger);

    let triggerSubstringIndex = 0;

    // Check if our search query has a namespace. If it does, filter out any macros that do not
    // fall into that namespace.
    const periodIndex = incompleteTriggerName.indexOf(".");
    if (~periodIndex) {
      const namespace = incompleteTriggerName.substring(0, periodIndex + 1);
      const matchingNamespace = namespaces.filter(
        (namespaceObject) => namespace === namespaceObject.insert
      );
      if (matchingNamespace.length === 1) {
        searchableReplacements = searchableReplacements.filter((trigger) =>
          trigger.startsWith(matchingNamespace[0].insert)
        );
        searchQuery = incompleteTriggerName.substring(periodIndex + 1);
        triggerSubstringIndex = periodIndex + 1;
      }
    }

    // Only show words that match each word of the search query.
    const searchWords = searchQuery.split(/[^a-zA-Z\d]+/);
    for (const word of searchWords) {
      searchableReplacements = searchableReplacements.filter((trigger) =>
        trigger.substring(triggerSubstringIndex).includes(word)
      );
    }

    // Now we have a list of triggers that correspond to a different replacement. Some triggers
    // may correspond to the same replacement, so we need to filter them out. We do this by
    // making a Map where each key is the replacement, and each key is the index of its
    // .triggers array that corresponds to the trigger we searched for. We want to keep the
    // earliest trigger in the list.
    const replacementTriggerIndices = new Map();
    for (const trigger of searchableReplacements) {
      const replacement = replacementByTrigger[trigger];
      if (replacementTriggerIndices.has(replacement)) {
        const prevIndex = replacementTriggerIndices.get(replacement);
        const newIndex = replacement.triggers.indexOf(trigger);
        if (newIndex < prevIndex) {
          replacementTriggerIndices.set(replacement, newIndex);
        }
      } else {
        replacementTriggerIndices.set(
          replacement,
          replacement.triggers.indexOf(trigger)
        );
      }
    }

    // Sort the filtered replacements according to the order they show up in in
    // REPLACEMENTS.
    const orderedReplacements = [];
    for (const replacement of replacements) {
      if (replacementTriggerIndices.has(replacement)) {
        orderedReplacements.push(replacement);
      }
    }

    // Now we can make the <li>s for each of the search results.
    for (const replacement of orderedReplacements) {
      // Each replacement gets its own <li>.
      const li = makeElement(
        "li",
        {
          [`data-${constants.EXTENSION_PREFIX}-autofill-type`]: "replacement",
          [`data-${constants.EXTENSION_PREFIX}-insertion-text`]:
            replacement.triggers[replacementTriggerIndices.get(replacement)],
          [`data-${constants.EXTENSION_PREFIX}-append-end-delimiter`]: "true",
        },
        `
          <div class="sn-card-component_accent-bar"></div>
            <div>
              <strong>${constants.REPLACEMENT_DELIMITERS.START}${
          escapeHTML(
            replacement.triggers[replacementTriggerIndices.get(replacement)]
          ) || ""
        }${constants.REPLACEMENT_DELIMITERS.END}</strong>
              <small>${replacement.description}</small>
          </div>
          <i class="icon-chevron-right"></i>
        `
      );

      configureListItem(li, textarea);

      fragment.appendChild(li);
    }
  }

  // If the auto filler is empty, we want to hide it completely.
  if (fragment.children.length === 0) {
    data.replacementAutoFiller.style.display = "none";
    data.isReplacing = false;
    data.replacementAutoFillerFocusedIndex = null;
    return;
  }

  data.replacementAutoFillerFocusedIndex = 0;

  // Replace the content of the autoFiller with the new items.
  data.replacementAutoFiller.innerText = "";
  data.replacementAutoFiller.appendChild(fragment);

  focusAutoFillItem(textarea);
};

/**
 * Adds the appropriate event listeners to a `<li>` element being added into a textarea's
 * auto-filler. This makes the `<li>` act like a button as well as an item in a list that can be
 * focused or pass focus onto another item in the list.
 * @param li The HTMLLIElement to configure.
 * @param textarea The textarea this `<li>` is being added to.
 */
const configureListItem = (
  li: HTMLLIElement,
  textarea: HTMLTextAreaElement
): void => {
  const data = getTextAreaData<TextAreaDataSlice>(textarea);
  if (!data) return;

  // Make the `<li>` focus-able like a button.
  li.tabIndex = 0;
  li.setAttribute("role", "button");

  // Add a click listener to make it insert the text.
  li.addEventListener("click", (e) => selectAutoFillerItem(e, textarea));
  // Also add a keydown listener for Enter and Spacebar to activate the click listener like how a
  // button would.
  li.addEventListener("keydown", (e) => {
    if (e.code === "Enter" || e.code === "Space")
      selectAutoFillerItem(e, textarea);
  });
  // Add a hover-in listener for marking the item as being hovered.
  li.addEventListener("mouseenter", () => {
    li.setAttribute(`data-${constants.EXTENSION_PREFIX}-hovering`, "true");
    li.firstElementChild!.classList.add("sn-card-component_accent-bar_dark");
  });
  // Hover-out listener to un-highlight the item.
  li.addEventListener("mouseleave", () => {
    li.setAttribute(`data-${constants.EXTENSION_PREFIX}-hovering`, "false");
    if (
      li.getAttribute(`data-${constants.EXTENSION_PREFIX}-focusing`) !==
        "true" &&
      li.getAttribute(
        `data-${constants.EXTENSION_PREFIX}-artificial-focusing`
      ) !== "true"
    ) {
      li.firstElementChild!.classList.remove(
        "sn-card-component_accent-bar_dark"
      );
    }
  });
  // Focusing on the item is treated the same same as hovering in.
  li.addEventListener("focus", () => {
    li.setAttribute(`data-${constants.EXTENSION_PREFIX}-focusing`, "true");
    li.firstElementChild!.classList.add("sn-card-component_accent-bar_dark");
    // Also update the focusedIndex we have saved to match.
    data.replacementAutoFillerFocusedIndex = Array.from(
      li.parentNode!.children
    ).indexOf(li);
    focusAutoFillItem(textarea);
  });
  // Blurring the item is the same as hovering out.
  li.addEventListener("blur", () => {
    li.setAttribute(`data-${constants.EXTENSION_PREFIX}-focusing`, "false");
    if (
      li.getAttribute(`data-${constants.EXTENSION_PREFIX}-hovering`) !==
        "true" &&
      li.getAttribute(
        `data-${constants.EXTENSION_PREFIX}-artificial-focusing`
      ) !== "true"
    ) {
      li.firstElementChild!.classList.remove(
        "sn-card-component_accent-bar_dark"
      );
    }
  });
};

/**
 * Focuses a textarea's currently selected item in the auto-filler. The index to focus is determined
 * by the textarea's data object's `replacementAutoFillerFocusedIndex` property.
 * @param textarea The textarea we want to change the auto-filler focused item on.
 */
const focusAutoFillItem = (textarea: HTMLTextAreaElement): void => {
  const data = getTextAreaData<TextAreaDataSlice>(textarea);
  if (!data) return;
  const options = data.replacementAutoFiller.children;

  if (options.length === 0) {
    data.replacementAutoFiller.style.display = "none";
    data.isReplacing = false;
    data.replacementAutoFillerFocusedIndex = null;
    return;
  }

  if (data.replacementAutoFillerFocusedIndex! < 0) {
    data.replacementAutoFillerFocusedIndex = 0;
  } else if (data.replacementAutoFillerFocusedIndex! >= options.length) {
    data.replacementAutoFillerFocusedIndex = options.length - 1;
  }

  const index = data.replacementAutoFillerFocusedIndex!;

  // Look for any children that were previously being focused.
  for (const li of Array.from(data.replacementAutoFiller.children)) {
    li.setAttribute(
      `data-${constants.EXTENSION_PREFIX}-artificial-focusing`,
      "false"
    );
    if (
      li.getAttribute(`data-${constants.EXTENSION_PREFIX}-hovering`) !==
        "true" &&
      li.getAttribute(`data-${constants.EXTENSION_PREFIX}-focusing`) !== "true"
    ) {
      li.firstElementChild!.classList.remove(
        "sn-card-component_accent-bar_dark"
      );
    }
  }

  const focusedItem = options[index] as Element & {
    scrollIntoViewIfNeeded?: () => void;
  };

  focusedItem.setAttribute(
    `data-${constants.EXTENSION_PREFIX}-artificial-focusing`,
    "true"
  );
  focusedItem.firstElementChild!.classList.add(
    "sn-card-component_accent-bar_dark"
  );
  // Scroll it into view to appear as if it is focused.
  if (typeof focusedItem.scrollIntoViewIfNeeded == "function") {
    focusedItem.scrollIntoViewIfNeeded();
  }
};

/**
 * Inserts the currently selected autocomplete item into the specified textarea. The textarea's text
 * will be updated to have the replaced value and the caret position may change.
 * @param e The Event that triggered the selection.
 * @param textarea The textarea we are inserting text into via the auto-filler.
 */
const selectAutoFillerItem = (
  e: Event,
  textarea: HTMLTextAreaElement
): void => {
  const data = getTextAreaData<TextAreaDataSlice>(textarea);
  const item = e.currentTarget as HTMLElement | null;
  if (!data || !item) return;
  const name = item.getAttribute(
    `data-${constants.EXTENSION_PREFIX}-insertion-text`
  );
  if (!name) return;

  const previousStartDelimIndex = textarea.value.lastIndexOf(
    constants.REPLACEMENT_DELIMITERS.START,
    data.element.selectionStart - constants.REPLACEMENT_DELIMITERS.START.length
  );
  const nextStartDelimIndex = data.element.value.indexOf(
    constants.REPLACEMENT_DELIMITERS.START,
    data.element.selectionStart
  );
  const nextEndDelimIndex = data.element.value.indexOf(
    constants.REPLACEMENT_DELIMITERS.END,
    data.element.selectionStart
  );

  let newValue;
  let newCaretPos;
  if (
    ~nextEndDelimIndex &&
    (!~nextStartDelimIndex || nextEndDelimIndex > nextStartDelimIndex)
  ) {
    // If there is a closing delimiter after the current selection, and it is not the closing
    // delimiter for another opening delimiter, we can replace up to that point.
    newValue =
      data.element.value.substring(
        0,
        previousStartDelimIndex + constants.REPLACEMENT_DELIMITERS.START.length
      ) +
      name +
      data.element.value.substring(nextEndDelimIndex);
    newCaretPos =
      previousStartDelimIndex +
      constants.REPLACEMENT_DELIMITERS.START.length +
      name.length +
      constants.REPLACEMENT_DELIMITERS.END.length;
  } else {
    // Otherwise, we just want to replace from the start delimiter up to the caret, and insert
    // the closing delimiter ourself.
    const insertClosing =
      item.getAttribute(
        `data-${constants.EXTENSION_PREFIX}-append-end-delimiter`
      ) === "true";
    newValue =
      data.element.value.substring(
        0,
        previousStartDelimIndex + constants.REPLACEMENT_DELIMITERS.START.length
      ) +
      name +
      (insertClosing ? constants.REPLACEMENT_DELIMITERS.END : "") +
      data.element.value.substring(
        Math.max(data.element.selectionStart, data.element.selectionEnd)
      );
    newCaretPos =
      previousStartDelimIndex +
      constants.REPLACEMENT_DELIMITERS.START.length +
      name.length +
      (insertClosing ? constants.REPLACEMENT_DELIMITERS.END.length : 0);
  }

  writeToTextArea(textarea, newValue, [newCaretPos, newCaretPos]);
};

const init = (config: ConfigOptions) => {
  addTextAreaData((textarea) => {
    const replacementAutoFiller = makeElement("ul", {
      className: `${constants.EXTENSION_PREFIX}-auto-filler h-card dropdown-menu`,
      style: "display: none;",
    });

    if (textarea.parentNode) {
      textarea.parentNode.appendChild(replacementAutoFiller);
    }

    return {
      replacementAutoFiller,
      isReplacing: false,
      replacementAutoFillerFocusedIndex: null,
    };
  });

  addTextAreaCallback((textarea) => {
    textarea.addEventListener("keydown", function (e) {
      const data = getTextAreaData<TextAreaDataSlice>(textarea);
      if (!data) return;
      if (data.isReplacing) {
        if (e.code === "ArrowDown") {
          data.replacementAutoFillerFocusedIndex!++;
          focusAutoFillItem(textarea);
          e.preventDefault();
        } else if (e.code === "ArrowUp") {
          data.replacementAutoFillerFocusedIndex!--;
          focusAutoFillItem(textarea);
          e.preventDefault();
        } else if (e.code === "Enter" || e.code === "Tab") {
          const focusedItem = data.replacementAutoFiller.children[
            data.replacementAutoFillerFocusedIndex!
          ] as HTMLElement;
          focusedItem.click();
          e.preventDefault();
        }
      }
    });

    if (textarea.parentNode) {
      textarea.parentNode.addEventListener("focusout", (e: FocusEvent) => {
        if (
          e.relatedTarget == null ||
          e.currentTarget == null ||
          (isInstance(e.relatedTarget, HTMLElement) &&
            !(e.currentTarget as Element).contains(e.relatedTarget))
        ) {
          updateAutoFiller(textarea);
        }
      });
    }
  });

  document.addEventListener("input", (e) => {
    if (!isInstance(e.target, HTMLTextAreaElement)) return;
    const data = getTextAreaData(e.target);
    if (!data) return;
    updateAutoFiller(e.target);

    // Don't re-write to the textarea if we are suppressing input.
    if (data.suppressInputs) return;

    // Write the same data to the textarea. This will take care of resolving replacements and
    // handling caret positioning. If the textarea does not need to be changed, nothing will happen.
    writeToTextArea(e.target, e.target.value);
  });
};

export default init;
