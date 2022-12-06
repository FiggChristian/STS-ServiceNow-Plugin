export interface TextAreaDataSlice {
  /**
   * The element that shows up when the user starts a replacement. It shows them the possible
   * replacements they can select.
   */
  replacementAutoFiller: HTMLElement;
  /**
   * Whether the user is currently in the process of selecting a replacement. If true, the auto
   * filler element should be shown.
   */
  isReplacing: boolean;
  /**
   * The index of the currently selected replacement. This is used to highlight the currently
   * selected item. This will be null if the user is not currently replacing.
   */
  replacementAutoFillerFocusedIndex: number | null;
}
export type Trigger = string;
interface BaseReplacement {
  triggers: Trigger[];
  description?: string | null | undefined;
}
export interface ExecutableReplacement extends BaseReplacement {
  exec: (...args: string[]) => string | null;
}
export interface StringReplacement extends BaseReplacement {
  value: string;
}
export type Replacement = ExecutableReplacement | StringReplacement;
export interface Namespace {
  name: string;
  insert: string;
  icon: string;
}

export interface NOWType {
  user?: {
    firstName?: string;
    lastName?: string;
  };
  user_display_name?: string;
  user_email?: string;
}
