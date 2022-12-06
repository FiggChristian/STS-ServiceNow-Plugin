export interface TextAreaDataSlice {
  isAutoCompleting: boolean;
  closedAutoComplete: boolean;
  activeAutoComplete: string | null;
  previousPlaceholder: string | null;
  previousHeight: string | null;
}
