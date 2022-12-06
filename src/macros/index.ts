import {
  addToSubBar,
  assertNotNull,
  dedent,
  escapeHTML,
  getTextAreaData,
  getTextAreaOfType,
  getTicketType,
  interceptStyles,
  isInstance,
  makeElement,
  resolveReplacements,
  setDropdown,
  showTextArea,
  ticketStateToString,
  writeToTextArea,
} from "../helpers";
import { TextAreaType, TicketType } from "../helpers/types";
import {
  AssignmentGroup,
  ChangeableFields,
  Components,
  Macro,
  TicketState,
} from "./types";
import constants from "../constants.json";
import { macros } from "./data";
import "./styles.scss";
import { setDataList } from "../helpers/setInputs";
import { ConfigOptions } from "../config";

const applyMacro = async (macro: Macro) => {
  // Hide the macro modal.
  changeMacroModalVisibility(false);

  // Get a list of fields we want to change.
  const fields = Object.keys(macro.fields) as (keyof ChangeableFields)[];

  // Move work_notes, comments, and close_notes to the end so that the textareas are focused when
  // we're done applying the macro.
  if ("work_notes" in macro.fields) {
    fields.splice(fields.indexOf("work_notes"), 1);
    fields.push("work_notes");
  }
  if ("additional_comments" in macro.fields) {
    fields.splice(fields.indexOf("additional_comments"), 1);
    fields.push("additional_comments");
  }
  if ("close_notes" in macro.fields) {
    fields.splice(fields.indexOf("close_notes"), 1);
    fields.push("close_notes");
  }

  // Go through the fields we recognize and perform their action.
  for (const key of fields) {
    const rawValue = macro.fields[key];
    const value = typeof rawValue === "string" ? dedent(rawValue) : rawValue;

    try {
      switch (key) {
        case "additional_comments": {
          if ("work_notes" in macro.fields) {
            // If both additional_comments and work_notes are being changed, show both types of
            // textareas.
            showTextArea(TextAreaType.CommentsAndWorkNotes);
          } else {
            // Otherwise just show comments.
            showTextArea(TextAreaType.Comments);
          }

          const element = assertNotNull(
            getTextAreaOfType(TextAreaType.Comments),
            "Could not find comments textarea."
          );
          assertNotNull(
            getTextAreaData(element),
            "No textarea data is associated with the comments textarea."
          );
          writeToTextArea(element, value as string);
          break;
        }
        case "work_notes": {
          if ("additional_comments" in macro.fields) {
            // If both additional_comments and work_notes are being changed, let the additional_comments
            // take care of focusing both text fields.
          } else {
            // Otherwise just show work notes.
            showTextArea(TextAreaType.WorkNotes);
          }

          const element = assertNotNull(
            getTextAreaOfType(TextAreaType.WorkNotes),
            "Could not find comments textarea."
          );
          assertNotNull(
            getTextAreaData(element),
            "No textarea data is associated with the comments textarea."
          );
          writeToTextArea(element, value as string);
          break;
        }
        case "close_notes": {
          if (getTicketType() === TicketType.Task) {
            // Tasks do not have close notes. If this macro wants to write to the Close Notes, try
            // writing to the Comments instead, *unless* the Comments are also being written to. In that
            // case, there's nowhere to write to.
            if ("additional_comments" in macro.fields) {
              continue;
            }
            showTextArea(TextAreaType.Comments);
            const element = assertNotNull(
              getTextAreaOfType(TextAreaType.Comments),
              "Could not find comments textarea."
            );
            assertNotNull(
              getTextAreaData(element),
              "No textarea data is associated with the comments textarea."
            );
            writeToTextArea(element, value as string);
          } else {
            showTextArea(TextAreaType.CloseNotes);
            const element = assertNotNull(
              getTextAreaOfType(TextAreaType.CloseNotes),
              "Could not find close_notes textarea."
            );
            assertNotNull(
              getTextAreaData(element),
              "No textarea data is associated with the close_notes textarea."
            );
            writeToTextArea(element, value as string);
          }
          break;
        }
        case "assignment_group": {
          const element = assertNotNull(
            {
              [TicketType.Incident]: document.getElementById(
                "sys_display.incident.assignment_group"
              ),
              [TicketType.SupportRequest]: document.getElementById(
                "sys_display.ticket.assignment_group"
              ),
              [TicketType.Task]: document.getElementById(
                "sys_display.sc_task.assignment_group"
              ),
            }[getTicketType()],
            "Could not find assignment_group element."
          );

          await setDataList(element, value as AssignmentGroup);
          break;
        }
        case "assigned_to": {
          const element = assertNotNull(
            {
              [TicketType.Incident]: document.getElementById(
                "sys_display.incident.assigned_to"
              ),
              [TicketType.SupportRequest]: document.getElementById(
                "sys_display.ticket.assigned_to"
              ),
              [TicketType.Task]: document.getElementById(
                "sys_display.sc_task.assigned_to"
              ),
            }[getTicketType()],
            "Could not find assigned_to element."
          );

          await setDataList(element, value as AssignmentGroup);
          break;
        }
        case "state": {
          const element = assertNotNull(
            {
              [TicketType.Incident]: document.getElementById("incident.state"),
              [TicketType.SupportRequest]:
                document.getElementById("ticket.state"),
              [TicketType.Task]: document.getElementById("sc_task.state"),
            }[getTicketType()],
            "Could not find state element."
          );

          setDropdown(element, ticketStateToString(value as TicketState));
          break;
        }
      }
    } catch (e) {
      console.warn(`Failed to apply macro field "${key}":`, e);
    }
  }
};

const macroModalComponents = {} as Components;
const shownMacros: Macro[] = [];

const getMacroIndex = (
  element?: HTMLElement | EventTarget | null | undefined
): number | null => {
  if (!element || !isInstance(element, HTMLElement)) return null;
  const attr = element.getAttribute(
    `data-${constants.EXTENSION_PREFIX}-visible-macro-index`
  );
  if (!attr) return null;
  const index = parseInt(attr, 10);
  return isNaN(index) ? null : index;
};

const closeModalOnEscape = (e: KeyboardEvent) => {
  if (e.code === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    changeMacroModalVisibility(false);
  }
};

const populateMacros = () => {
  macroModalComponents.macroList.innerText = "";
  shownMacros.length = 0;

  const searchWords = macroModalComponents.search.value
    .toLowerCase()
    .split(/[^a-z\d]+/);
  if (searchWords[0] === "") {
    searchWords.shift();
  }

  let doneMacros = 0;
  for (let i = 0; i < macros.length; i++) {
    const macro = macros[i];

    if (searchWords.length) {
      let doesNotMatch = false;
      for (const word of searchWords) {
        if (
          !macro.name.toLowerCase().includes(word) &&
          !macro.description.toLowerCase().includes(word)
        ) {
          doesNotMatch = true;
          break;
        }
      }
      if (doesNotMatch) continue;
    }

    shownMacros.push(macro);

    const macroTab = makeElement(
      "span",
      {
        role: "tab",
        className: "sn-widget-list-item",
        tabIndex: "0",
      },
      `
          <div class="sn-widget-list-content">
            <span class="sn-widget-list-title">
              ${escapeHTML(macro.name)}
              <span class="sn-widget-list-subtitle">${macro.description}</span>
            </span>
          </div>
          <div class="sn-widget-list-content sn-widget-list-content_static">
            <div class="sn-widget-list-image icon-preview"></div>
          </div>
        `
    );
    macroTab.setAttribute(
      `data-${constants.EXTENSION_PREFIX}-visible-macro-index`,
      doneMacros.toString()
    );
    macroTab.setAttribute(
      `data-${constants.EXTENSION_PREFIX}-macro-index`,
      i.toString()
    );
    doneMacros++;

    macroTab.lastElementChild!.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    });

    macroTab.lastElementChild!.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const index = getMacroIndex(e.currentTarget);
      if (index == null) return;
      focusMacroItem(index);
    });

    macroTab.lastElementChild!.addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          e.stopPropagation();
          if (isInstance(e.currentTarget, HTMLElement)) e.currentTarget.click();
        }
      }
    );

    macroTab.addEventListener("keydown", (e: KeyboardEvent) => {
      const index = getMacroIndex(e.currentTarget);
      if (index == null) return;

      if (e.code === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (index > 0) {
          focusMacroItem(index - 1);
        } else {
          macroModalComponents.search.focus();
        }
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (index < macroModalComponents.macroList.children.length - 1) {
          focusMacroItem(index + 1);
        } else {
          macroModalComponents.search.focus();
        }
      } else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        clickTab(e);
      }
    });

    const clickTab = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const index = getMacroIndex(e.currentTarget);
      if (index == null) return;
      applyMacro(shownMacros[index]);
    };

    macroTab.addEventListener("mousedown", clickTab);
    macroTab.addEventListener("click", clickTab);

    macroTab.addEventListener("focus", function (e) {
      const index = getMacroIndex(e.currentTarget);
      if (index == null) return;
      focusMacroItem(index);
    });

    macroModalComponents.macroList.appendChild(macroTab);
  }

  focusMacroItem(-1);
};

function focusMacroItem(index: number) {
  for (const child of Array.from(macroModalComponents.macroList.children)) {
    child.classList.remove("state-active");
    child.ariaSelected = "false";
  }

  if (index < 0 || index >= macroModalComponents.macroList.children.length) {
    macroModalComponents.leftPanel.classList.replace("col-sm-4", "col-sm-8");
    macroModalComponents.rightPanel.classList.replace("col-sm-8", "col-sm-4");
    macroModalComponents.previewBody.innerText = "";
    macroModalComponents.header.innerText = "Preview";
  } else {
    macroModalComponents.leftPanel.classList.replace("col-sm-8", "col-sm-4");
    macroModalComponents.rightPanel.classList.replace("col-sm-4", "col-sm-8");

    const focusedItem = macroModalComponents.macroList.children[
      index
    ] as HTMLElement;
    focusedItem.focus();
    focusedItem.classList.add("state-active");
    focusedItem.ariaSelected = "true";

    const macroIndex = getMacroIndex(focusedItem);
    if (macroIndex == null) return;
    const macro = macros[macroIndex];

    macroModalComponents.header.innerText = macro.name;

    macroModalComponents.previewBody.innerHTML = `
      <div class="${constants.EXTENSION_PREFIX}-preview-header">
        <button class="${constants.EXTENSION_PREFIX}-back-button btn close icon-arrow-left" style="float: none">
          <span class="sr-only">Back</span>
        </button>
      </div>
      <div id="${constants.EXTENSION_PREFIX}-preview-fields"></div>
    `;
    macroModalComponents.previewBody.firstElementChild!.firstElementChild!.addEventListener(
      "click",
      (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        focusMacroItem(-1);
      }
    );

    const fieldsContainer =
      macroModalComponents.previewBody.firstElementChild!.nextElementSibling!;

    const fields = Object.keys(macro.fields) as (keyof ChangeableFields)[];
    let fieldsIndex: number;

    // Make sure Additional Comments, Work Notes, and Close Notes shows up first.
    if (~(fieldsIndex = fields.indexOf("work_notes"))) {
      fields.splice(fieldsIndex, 1);
      fields.unshift("work_notes");
    }
    if (~(fieldsIndex = fields.indexOf("close_notes"))) {
      fields.splice(fieldsIndex, 1);
      fields.unshift("close_notes");
    }
    if (~(fieldsIndex = fields.indexOf("additional_comments"))) {
      fields.splice(fieldsIndex, 1);
      fields.unshift("additional_comments");
    }

    // Go through the fields that would be changed.
    for (const field of fields) {
      // Make sure this is a recognized field, and translate the name into a more readable form.
      const fieldName =
        {
          additional_comments: "Additional Comments (Customer Visible)",
          close_notes: "Close Notes",
          work_notes: "Work Notes",
          assignment_group: "Assignment Group",
          state: "State",
          assigned_to: "Assigned To",
        }[field] ?? null;

      if (fieldName == null) {
        continue;
      }

      let fieldValue = null;

      if (field === "state") {
        fieldValue = ticketStateToString(macro.fields.state!);
      } else {
        // Get the value that would be replaced.
        const value = dedent(macro.fields[field]!);

        // Resolve any replacements
        let [replacedValue, caretPositions] = resolveReplacements(value);

        // If there's only one caret position, and it's at the end, we don't want to show it
        // since that's not significant.
        if (
          caretPositions.length === 1 &&
          caretPositions[0][0] === caretPositions[0][1] &&
          caretPositions[0][0] === replacedValue.length
        ) {
          caretPositions = [];
        } else if (caretPositions.length > 0) {
          // Replace any caret positions with a special <span> that will show caret positions.
          // Also escape any HTML in between these <span>s.
          for (let i = caretPositions.length - 1; i >= 0; i--) {
            replacedValue = `${replacedValue.substring(
              0,
              caretPositions[i][0]
            )}<span class="${constants.EXTENSION_PREFIX}-caret-position-span ${
              constants.EXTENSION_PREFIX
            }-span-${
              caretPositions[i][0] === caretPositions[i][1] ? "empty" : "full"
            }"><span></span><span></span><span>${escapeHTML(
              replacedValue.substring(
                caretPositions[i][0],
                caretPositions[i][1]
              )
            )}</span></span>${escapeHTML(
              replacedValue.substring(
                caretPositions[i][1],
                i === caretPositions.length - 1
                  ? replacedValue.length
                  : caretPositions[i + 1][0]
              )
            )}${replacedValue.substring(
              i === caretPositions.length - 1
                ? replacedValue.length
                : caretPositions[i + 1][0]
            )}`;
          }
          replacedValue =
            escapeHTML(replacedValue.substring(0, caretPositions[0][0])) +
            replacedValue.substring(caretPositions[0][0]);
        }

        fieldValue = replacedValue;
      }

      // Now make the element that will display this field value.
      const container = document.createElement("div");
      container.classList.add(
        `${constants.EXTENSION_PREFIX}-preview-field-container`
      );
      container.innerHTML = `
        <div>${fieldName}</div>
        <div class="${constants.EXTENSION_PREFIX}-preview-field-value ${
        field === "work_notes"
          ? `${constants.EXTENSION_PREFIX}-preview-work_notes-value`
          : ""
      } form-control">${fieldValue}</div>
        `;
      fieldsContainer.appendChild(container);
    }
  }
}

const changeMacroModalVisibility = (value: boolean) => {
  if (value) {
    macroModalComponents.search.value = "";
    populateMacros();
    macroModalComponents.leftPanel.classList.replace("col-sm-4", "col-sm-8");
    macroModalComponents.rightPanel.classList.replace("col-sm-8", "col-sm-4");
    macroModalComponents.backdrop.style.display = "block";
    macroModalComponents.root.style.display = "block";
    macroModalComponents.search.focus();
    document.addEventListener("keydown", closeModalOnEscape);
    (window.top ?? window).document.addEventListener(
      "keydown",
      closeModalOnEscape
    );
  } else {
    macroModalComponents.backdrop.style.display = "none";
    macroModalComponents.root.style.display = "none";
    document.removeEventListener("keydown", closeModalOnEscape);
    (window.top ?? window).document.removeEventListener(
      "keydown",
      closeModalOnEscape
    );
  }
};

const createMacroModal = () => {
  // Make the macro elements and add them to the document.
  const backdrop = makeElement("div", {
    className: "modal-backdrop in stacked",
    style: "display: none;",
  });
  (window.top ?? window).document.body.appendChild(backdrop);

  const modalRoot = makeElement(
    "div",
    {
      id: `${constants.EXTENSION_PREFIX}-macros_modal`,
      role: "dialog",
      className: "modal in settings-modal",
      style: "display: none;",
    },
    // This is taken from ServiceNow's #settings_modal, with some modifications.
    `
      <div class="modal-dialog modal-lg ng-scope compact">
        <div class="modal-content">
          <div class="modal-body clearfix" style="min-height:50vmin">
            <div class="tab-aside col-sm-8" id="${constants.EXTENSION_PREFIX}-macro-list-panel">
              <header class="modal-header clearfix">Macros</header>
              <div class="settings-tabs">
                <div class="sn-aside sn-aside_left sn-aside_min-width">
                  <div class="sn-aside-body ${constants.EXTENSION_PREFIX}-macro-list-flex">
                    <div id="${constants.EXTENSION_PREFIX}-macro-search-container" class="modal-header">
                      <input id="${constants.EXTENSION_PREFIX}-macro-search" placeholder="Filter macros" class="form-control">
                    </div>
                    <div class="sn-widget-list_v2" role="tablist" aria-label="List of macros" id="${constants.EXTENSION_PREFIX}-macro-list"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="tab-content col-sm-4" id="${constants.EXTENSION_PREFIX}-macro-preview-panel">
              <header class="modal-header clearfix">
                <div class="modal-header-right"></div>
                <div class="modal-header-center">
                  <h4 class="modal-title text-center" id="${constants.EXTENSION_PREFIX}-macros_modal_panel_header">Preview</h4>
                </div>
                <div class="modal-header-left">
                  <button class="btn close icon-cross" id="${constants.EXTENSION_PREFIX}-dismiss-icon">
                    <span class="sr-only">Close</span>
                  </button>
                </div>
              </header>
              <div class="form-horizontal view-stack settings-tab-panels" aria-labelledby="${constants.EXTENSION_PREFIX}-macros_modal_panel_header">
                <div class="tab-pane view-stack-item" role="tabpanel" aria-labelledby="${constants.EXTENSION_PREFIX}-macros_modal_panel_header" id="${constants.EXTENSION_PREFIX}-macros_modal_preview-body"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <i class="focus-trap-boundary-south" tabindex="0"></i>
    `
  );

  macroModalComponents.root = modalRoot;
  macroModalComponents.backdrop = backdrop;
  macroModalComponents.leftPanel = modalRoot.querySelector(
    `#${constants.EXTENSION_PREFIX}-macro-list-panel`
  )!;
  macroModalComponents.rightPanel = modalRoot.querySelector(
    `#${constants.EXTENSION_PREFIX}-macro-preview-panel`
  )!;
  macroModalComponents.macroList = modalRoot.querySelector(
    `#${constants.EXTENSION_PREFIX}-macro-list`
  )!;
  macroModalComponents.previewBody = modalRoot.querySelector(
    `#${constants.EXTENSION_PREFIX}-macros_modal_preview-body`
  )!;
  macroModalComponents.header = modalRoot.querySelector(
    `#${constants.EXTENSION_PREFIX}-macros_modal_panel_header`
  )!;
  macroModalComponents.search = modalRoot.querySelector(
    `#${constants.EXTENSION_PREFIX}-macro-search`
  )!;

  macroModalComponents.search.addEventListener("input", function (e) {
    e.stopPropagation();
    populateMacros();
  });

  macroModalComponents.search.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (shownMacros.length === 0) {
        return;
      }
      if (e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        applyMacro(shownMacros[0]);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        focusMacroItem(0);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        focusMacroItem(shownMacros.length - 1);
      }
    }
  );

  macroModalComponents.search.addEventListener("focus", function () {
    focusMacroItem(-1);
  });

  modalRoot
    .querySelector(`#${constants.EXTENSION_PREFIX}-dismiss-icon`)!
    .addEventListener("click", function (e) {
      e.preventDefault();
      changeMacroModalVisibility(false);
    });

  (window.top ?? window).document.body.appendChild(modalRoot);
  modalRoot.addEventListener("click", function (e) {
    if (e.target !== e.currentTarget) {
      return;
    }
    e.preventDefault();
    changeMacroModalVisibility(false);
  });
};

const init = (config: ConfigOptions): void => {
  if (!config.enabled.servicenow.macros) return;

  addToSubBar((textarea) => {
    // The description textarea does not have macros applied to it because it is the customer's
    // notes, not ours.
    if (textarea.id.includes("description")) {
      return null;
    }
    const btn = makeElement(
      "button",
      {
        type: "button",
        className: `${constants.EXTENSION_PREFIX}-md-previewer-btn btn btn-default`,
      },
      "Apply Macro"
    );
    btn.addEventListener("click", () => {
      changeMacroModalVisibility(true);
    });
    return btn;
  });

  createMacroModal();

  interceptStyles(
    "#settings_modal",
    `#${constants.EXTENSION_PREFIX}-macros_modal`
  );
};

export default init;
