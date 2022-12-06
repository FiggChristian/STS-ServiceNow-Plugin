import { ConfigOptions } from "../config";
import {
  addTextAreaCallback,
  addTextAreaData,
  calculateTextPosition,
  getTextAreaData,
  getTextAreaType,
  resolveReplacements,
  setTextAreaTooltip,
  writeToTextArea,
} from "../helpers";
import { TextAreaDataSlice } from "./types";
import constants from "../constants.json";

const checkForAutoComplete = (
  textarea: HTMLTextAreaElement,
  config: ConfigOptions
): void => {
  const data = getTextAreaData<TextAreaDataSlice>(textarea);
  if (!data) return;

  if (
    data.closedAutoComplete ||
    textarea.value !== "" ||
    document.activeElement !== textarea
  ) {
    textarea.style.height = data.previousHeight ?? textarea.style.height;
    data.closedAutoComplete = false;
    data.isAutoCompleting = false;
    data.activeAutoComplete = null;
    textarea.placeholder = data.previousPlaceholder ?? "";
    textarea.removeAttribute(
      `data-${constants.EXTENSION_PREFIX}-is-auto-completing`
    );
    setTextAreaTooltip(textarea, null);
  } else {
    // We *should* be showing auto complete for this textarea.
    const type = getTextAreaType(textarea);
    if (type == null) return;

    const autoComplete = config.autoCompletes[type];
    if (!autoComplete) return;

    data.isAutoCompleting = true;
    data.activeAutoComplete = autoComplete;
    data.previousPlaceholder ??= textarea.placeholder;
    data.previousHeight ??= textarea.style.height;
    // Resolve any {{replacements}} so the person sees the actual replacement text, not a bunch of
    // {{}}s.
    const [resolvedAutoComplete] = resolveReplacements(autoComplete);
    textarea.placeholder = resolvedAutoComplete;
    const { top } = calculateTextPosition(textarea, resolvedAutoComplete);
    const newHeight =
      top +
      parseFloat(data.elementStyles.borderTopWidth) +
      parseFloat(data.elementStyles.borderBottomWidth) +
      parseFloat(data.elementStyles.paddingTop) +
      parseFloat(data.elementStyles.paddingBottom);
    textarea.style.height = `${newHeight}px`;
    textarea.setAttribute(
      `data-${constants.EXTENSION_PREFIX}-is-auto-completing`,
      "true"
    );
    setTextAreaTooltip(textarea, `Press <kbd>Enter</kbd> to accept.`, () => {
      data.closedAutoComplete = true;
      checkForAutoComplete(textarea, config);
    });
  }
};

const acceptAutoComplete = (
  textarea: HTMLTextAreaElement,
  config: ConfigOptions
): void => {
  const data = getTextAreaData<TextAreaDataSlice>(textarea);
  if (!data || !data.isAutoCompleting || data.activeAutoComplete == null)
    return;

  writeToTextArea(textarea, data.activeAutoComplete);
  checkForAutoComplete(textarea, config);
};

const init = (config: ConfigOptions): void => {
  if (!config.enabled.servicenow.autocomplete) return;
  addTextAreaData(() => ({
    isAutoCompleting: false,
  }));

  addTextAreaCallback((textarea) => {
    const cb = () => checkForAutoComplete(textarea, config);
    textarea.addEventListener("focus", cb);
    textarea.addEventListener("blur", () => {
      const data = getTextAreaData<TextAreaDataSlice>(textarea);
      if (data?.previousHeight != null)
        textarea.style.height = data.previousHeight;
      cb();
    });
    textarea.addEventListener("input", () => {
      const data = getTextAreaData<TextAreaDataSlice>(textarea);
      if (data) data.previousHeight = null;
      cb();
    });
    textarea.addEventListener("keypress", (e) => {
      if (e.key !== "Enter") return;
      const data = getTextAreaData<TextAreaDataSlice>(textarea);
      if (!data || !data.isAutoCompleting) return;
      e.preventDefault();
      acceptAutoComplete(textarea, config);
    });
  });
};

export default init;
