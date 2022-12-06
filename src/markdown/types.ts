import type { marked } from "marked";

export interface TextAreaDataSlice {
  /**
   * A boolean indicating whether the textarea has its markdown previewer visible.
   */
  isPreviewingMarkdown: boolean;
  /**
   * An HTMLElement representing the textarea's markdown previewer.
   */
  markdownPreviewer: HTMLElement;
  decorator: HTMLElement | null;
}

export interface FormTableToken extends Omit<marked.Tokens.Generic, "tokens"> {
  type: "formTable";
  tokens: FormTableRowToken[];
}

export interface FormTableRowToken extends marked.Tokens.Generic {
  type: "formTableRow";
  before: marked.Token[];
  after: marked.Token[];
}

export interface MarkdownParsingCodeToken {
  type: "code";
  insideCodeValue: string;
  outsideCodeValue: null;
  insideCodePenalty: number;
  outsideCodePenalty: number;
}

export interface MarkdownParsingPlainToken {
  type: "plain";
  insideCodeValue: string;
  outsideCodeValue: string;
  insideCodePenalty: number;
  outsideCodePenalty: number;
}

export interface MarkdownParsingEscapedToken {
  type: "escaped";
  insideCodeValue: string;
  outsideCodeValue: string;
  insideCodePenalty: number;
  outsideCodePenalty: number;
}

export interface MarkdownParsingStartToken {
  type: "start";
  insideCodeValue: null;
  outsideCodeValue: string;
  insideCodePenalty: number;
  outsideCodePenalty: number;
}

export type MarkdownParsingToken =
  | MarkdownParsingCodeToken
  | MarkdownParsingPlainToken
  | MarkdownParsingEscapedToken
  | MarkdownParsingStartToken;
