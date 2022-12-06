import { ConfigOptions, defaultValues, setConfigAsync } from "../config";
import {
  addTextAreaCallback,
  addToSubBar,
  calculateTextPosition,
  getTextAreaData,
  makeElement,
  TextAreaType,
} from "../helpers";
import bodyHTML from "./page.html";
import stylesAsString from "!!to-string-loader!css-loader?importLoaders=1!postcss-loader!sass-loader!../../prepend-sass-variables-loader.js!./styles.scss";
import { CheckBoxIDs, TextBoxIDs } from "./types";
import { getDeep, ObjectPaths, setDeep } from "../helpers/deepObject";

const init = (config: ConfigOptions) => {
  document.title = "STS ServiceNow Plugin Settings";
  document.body.innerHTML = bodyHTML;
  const styles = document.createElement("style");
  styles.textContent = stylesAsString;
  document.head.appendChild(styles);

  const signatureTextarea = document.getElementById(
    TextBoxIDs.SIGNATURE
  )! as HTMLTextAreaElement;
  signatureTextarea.value = config.signature;
  signatureTextarea.addEventListener("input", (e) => {
    resizeTextarea(signatureTextarea);
    setConfigAsync({ signature: (e.target as HTMLTextAreaElement).value });
  });

  const autocompleteCommentsTextarea = document.getElementById(
    TextBoxIDs.AUTOCOMPLETE_COMMENTS
  )! as HTMLTextAreaElement;
  autocompleteCommentsTextarea.value =
    config.autoCompletes[TextAreaType.Comments] ?? "";
  autocompleteCommentsTextarea.addEventListener("input", () => {
    resizeTextarea(autocompleteCommentsTextarea);
    setConfigAsync({
      autoCompletes: {
        [TextAreaType.Comments]: autocompleteCommentsTextarea.value,
      },
    });
  });

  const autocompleteWorkNotesTextarea = document.getElementById(
    TextBoxIDs.AUTOCOMPLETE_WORK_NOTES
  )! as HTMLTextAreaElement;
  autocompleteWorkNotesTextarea.value =
    config.autoCompletes[TextAreaType.WorkNotes] ?? "";
  autocompleteWorkNotesTextarea.addEventListener("input", () => {
    resizeTextarea(autocompleteWorkNotesTextarea);
    setConfigAsync({
      autoCompletes: {
        [TextAreaType.WorkNotes]: autocompleteWorkNotesTextarea.value,
      },
    });
  });

  const autocompleteCloseNotesTextarea = document.getElementById(
    TextBoxIDs.AUTOCOMPLETE_CLOSE_NOTES
  )! as HTMLTextAreaElement;
  autocompleteCloseNotesTextarea.value =
    config.autoCompletes[TextAreaType.CloseNotes] ?? "";
  autocompleteCloseNotesTextarea.addEventListener("input", () => {
    resizeTextarea(autocompleteCloseNotesTextarea);
    setConfigAsync({
      autoCompletes: {
        [TextAreaType.CloseNotes]: autocompleteCloseNotesTextarea.value,
      },
    });
  });

  addToSubBar((textarea) => {
    if (!Object.values(TextBoxIDs).includes(textarea.id as TextBoxIDs))
      return null;
    const resetBtn = makeElement(
      "button",
      {
        type: "button",
        className: `btn btn-default`,
      },
      "Reset"
    );
    resetBtn.addEventListener("click", () => {
      switch (textarea.id) {
        case TextBoxIDs.SIGNATURE: {
          textarea.value = defaultValues.signature;
          textarea.dispatchEvent(new InputEvent("input"));
          break;
        }
        case TextBoxIDs.AUTOCOMPLETE_COMMENTS: {
          textarea.value = defaultValues.autoCompletes[TextAreaType.Comments];
          textarea.dispatchEvent(new InputEvent("input"));
          break;
        }
        case TextBoxIDs.AUTOCOMPLETE_WORK_NOTES: {
          textarea.value = defaultValues.autoCompletes[TextAreaType.WorkNotes];
          textarea.dispatchEvent(new InputEvent("input"));
          break;
        }
        case TextBoxIDs.AUTOCOMPLETE_CLOSE_NOTES: {
          textarea.value = defaultValues.autoCompletes[TextAreaType.CloseNotes];
          textarea.dispatchEvent(new InputEvent("input"));
          break;
        }
      }
    });

    textarea.addEventListener("input", () => {
      switch (textarea.id) {
        case TextBoxIDs.SIGNATURE: {
          resetBtn.disabled = textarea.value === defaultValues.signature;
          break;
        }
        case TextBoxIDs.AUTOCOMPLETE_COMMENTS: {
          resetBtn.disabled =
            textarea.value ===
            defaultValues.autoCompletes[TextAreaType.Comments];
          break;
        }
        case TextBoxIDs.AUTOCOMPLETE_WORK_NOTES: {
          resetBtn.disabled =
            textarea.value ===
            defaultValues.autoCompletes[TextAreaType.WorkNotes];
          break;
        }
        case TextBoxIDs.AUTOCOMPLETE_CLOSE_NOTES: {
          resetBtn.disabled =
            textarea.value ===
            defaultValues.autoCompletes[TextAreaType.CloseNotes];
          break;
        }
      }
    });

    return resetBtn;
  });

  addTextAreaCallback((textarea) =>
    textarea.dispatchEvent(new InputEvent("input"))
  );

  configureCheckboxes(config);
};

const configureCheckboxes = (config: ConfigOptions) => {
  const enabledCheckboxes = {} as Record<CheckBoxIDs, HTMLInputElement>;
  for (const key in CheckBoxIDs) {
    const id = CheckBoxIDs[key as keyof typeof CheckBoxIDs];
    enabledCheckboxes[id] = document.getElementById(id)! as HTMLInputElement;
  }

  // connectCheckboxesToParent(enabledCheckboxes[CheckBoxIDs.ALL], [
  //   enabledCheckboxes[CheckBoxIDs.DHCP_LOG],
  //   enabledCheckboxes[CheckBoxIDs.NETDB],
  //   enabledCheckboxes[CheckBoxIDs.SERVICENOW],
  // ]);

  // connectCheckboxesToParent(enabledCheckboxes[CheckBoxIDs.NETDB], [
  //   enabledCheckboxes[CheckBoxIDs.NETDB_HISTORY_HIGHLIGHT],
  //   enabledCheckboxes[CheckBoxIDs.NETDB_MAC_LINKING],
  // ]);

  connectCheckboxesToParent(
    enabledCheckboxes[CheckBoxIDs.ALL], // enabledCheckboxes[CheckBoxIDs.SERVICENOW],
    [
      enabledCheckboxes[CheckBoxIDs.SERVICENOW_AUTOCOMPLETE],
      enabledCheckboxes[CheckBoxIDs.SERVICENOW_MACROS],
      enabledCheckboxes[CheckBoxIDs.SERVICENOW_MARKDOWN],
      enabledCheckboxes[CheckBoxIDs.SERVICENOW_SMART_TEXT],
    ]
  );

  const resetBtn = document.getElementById(
    "enabled-reset"
  )! as HTMLButtonElement;
  enabledCheckboxes[CheckBoxIDs.ALL].addEventListener("change", () => {
    resetBtn.disabled =
      enabledCheckboxes[CheckBoxIDs.ALL].checked &&
      !enabledCheckboxes[CheckBoxIDs.ALL].indeterminate;
  });

  resetBtn.addEventListener("click", () => {
    changeCheckboxValues([enabledCheckboxes[CheckBoxIDs.ALL]], true);
  });

  // bindCheckbox(enabledCheckboxes[CheckBoxIDs.DHCP_LOG], config, [
  //   "enabled",
  //   "dhcp_log",
  //   "ip_links",
  // ]);
  // bindCheckbox(enabledCheckboxes[CheckBoxIDs.NETDB_MAC_LINKING], config, [
  //   "enabled",
  //   "netdb",
  //   "mac_links",
  // ]);
  // bindCheckbox(enabledCheckboxes[CheckBoxIDs.NETDB_HISTORY_HIGHLIGHT], config, [
  //   "enabled",
  //   "netdb",
  //   "history_highlight",
  // ]);
  bindCheckbox(enabledCheckboxes[CheckBoxIDs.SERVICENOW_AUTOCOMPLETE], config, [
    "enabled",
    "servicenow",
    "autocomplete",
  ]);
  bindCheckbox(enabledCheckboxes[CheckBoxIDs.SERVICENOW_MACROS], config, [
    "enabled",
    "servicenow",
    "macros",
  ]);
  bindCheckbox(enabledCheckboxes[CheckBoxIDs.SERVICENOW_MARKDOWN], config, [
    "enabled",
    "servicenow",
    "markdown",
  ]);
  bindCheckbox(enabledCheckboxes[CheckBoxIDs.SERVICENOW_SMART_TEXT], config, [
    "enabled",
    "servicenow",
    "smart_text",
  ]);
};

const bindCheckbox = (
  checkbox: HTMLInputElement,
  config: ConfigOptions,
  path: ObjectPaths<ConfigOptions>
) => {
  const initialValue = getDeep(config, path, true) as boolean;
  changeCheckboxValues([checkbox], initialValue);
  checkbox.addEventListener("change", () => {
    setDeep(config, path, checkbox.checked);
    setConfigAsync(config);
  });
};

const changeCheckboxValues = (
  checkboxes: HTMLInputElement[],
  value: boolean | null
): void => {
  for (const checkbox of checkboxes) {
    if (value === null) {
      // Check if anything needs to be changed. If not, continue without
      // dispatching a change event.
      if (!checkbox.checked && checkbox.indeterminate) continue;
      checkbox.checked = false;
      checkbox.indeterminate = true;
    } else {
      if (checkbox.checked === value && !checkbox.indeterminate) continue;
      checkbox.checked = value;
      checkbox.indeterminate = false;
    }
    checkbox.dispatchEvent(new Event("change"));
  }
};

const connectCheckboxesToParent = (
  parent: HTMLInputElement,
  children: HTMLInputElement[]
) => {
  for (const child of children) {
    child.addEventListener("change", () => {
      const expected = child.checked;
      for (const sibling of children) {
        if (sibling.checked !== expected || sibling.indeterminate) {
          changeCheckboxValues([parent], null);
          return;
        }
      }
      changeCheckboxValues([parent], expected);
    });
  }

  parent.addEventListener("change", () => {
    if (parent.indeterminate) return;
    changeCheckboxValues(children, parent.checked);
  });
};

const resizeTextarea = (textarea: HTMLTextAreaElement) => {
  const data = getTextAreaData(textarea);
  if (!data) return;

  const { top } = calculateTextPosition(textarea, textarea.value, "\u200b");
  textarea.style.height =
    top +
    parseFloat(data.elementStyles.borderTopWidth || "0") +
    parseFloat(data.elementStyles.borderBottomWidth || "0") +
    "px";
};

export default init;
