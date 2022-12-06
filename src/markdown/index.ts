import { marked } from "marked";
import {
  FormTableRowToken,
  FormTableToken,
  MarkdownParsingToken,
  TextAreaDataSlice,
} from "./types";
import "./styles.scss";
import constants from "../constants.json";
import {
  addTextAreaData,
  addToSubBar,
  cloneNode,
  escapeHTML,
  getTextAreaData,
  getTextAreaType,
  interceptStyles,
  isInstance,
  makeElement,
  TextAreaType,
  turnNoIndexInto,
  waitForElements,
  withCodeDelimiters,
  writeToTextArea,
} from "../helpers";
import { replaceSmartText } from "../smarttext";
import { ConfigOptions } from "../config";

let hasInitialized = false;

/**
 * A map of styles that get added with the Markdown if each of these tags are used at least once.
 * These additional styles help to keep the Markdown text look somewhat decent.
 */
const REPLACEMENT_SUBSTYLES = {
  code: ":not(pre)>code{background-color:#F5F5F5;border:1px solid#CCC;color:#4A4A4A;border-radius:.2em;font-size:90%;padding:0 .2em}",
  table: "table{border-collapse:collapse}table>*{vertical-align:top}",
  tr: "thead+tbody tr,tr+tr{border-top:1px solid#AAA}td+td{border-left:1px solid#AAA}td{padding:.1em .3em}",
  img: "img{max-width:100%}",
};

/**
 * Configures Marked so that it will work with ServiceNow's version of HTML. It adds [code][/code]
 * blocks around the appropriate HTML so that Markdown is parsed correctly by ServiceNow, and also
 * adds some additional functionality to the Markdown parser. Should only be called once.
 */
const configureMarked = (): void => {
  marked.use({
    tokenizer: {
      // Disable HTML block-level elements so that they are treated as normal paragraphs instead.
      html: () => false,
    },
    renderer: {
      code: (code) =>
        withCodeDelimiters("<pre><code>") +
        code.replace(/\n/g, withCodeDelimiters("<br>")) +
        withCodeDelimiters("</code></pre>"),
      blockquote: (quote) =>
        withCodeDelimiters("<blockquote>") +
        quote +
        withCodeDelimiters("</blockquote>"),
      // HTML is treated as plain text instead of trying to render it, so we don't wrap it in
      // [code] ... [/code] blocks.
      // html: (html) => {},
      heading: (text, level) =>
        withCodeDelimiters(`<h${level}>`) +
        text +
        withCodeDelimiters(`</h${level}>`),
      hr: () => withCodeDelimiters("<hr/>"),
      list: (body, ordered, start) =>
        withCodeDelimiters(
          `<${ordered ? `ol${start === 1 ? "" : ` start="${start}"`}` : "ul"}>`
        ) +
        body +
        withCodeDelimiters(ordered ? "</ol>" : "</ul>"),
      listitem: (text) =>
        withCodeDelimiters("<li>") + text + withCodeDelimiters("</li>"),
      checkbox: (checked) =>
        withCodeDelimiters(
          `<input type="checkbox"${checked ? " checked" : ""}>`
        ),
      paragraph: (text) =>
        withCodeDelimiters("<p>") + text + withCodeDelimiters("</p>"),
      table: (header, body) =>
        withCodeDelimiters("<table><thead>") +
        header +
        withCodeDelimiters("</thead><tbody>") +
        body +
        withCodeDelimiters("</tbody></table>"),
      tablerow: (content) =>
        withCodeDelimiters("<tr>") + content + withCodeDelimiters("</tr>"),
      tablecell: (content, flags) =>
        withCodeDelimiters(
          `<td${flags.align ? ` style="text-align:${flags.align}"` : ""}>`
        ) +
        content +
        withCodeDelimiters("</td>"),
      strong: (text) =>
        withCodeDelimiters("<strong>") + text + withCodeDelimiters("</strong>"),
      em: (text) =>
        withCodeDelimiters("<em>") + text + withCodeDelimiters("</em>"),
      codespan: (code) =>
        withCodeDelimiters("<code>") + code + withCodeDelimiters("</code>"),
      br: () => withCodeDelimiters("<br/>"),
      del: (text) =>
        withCodeDelimiters('<span style="text-decoration:line-through"><del>') +
        text +
        withCodeDelimiters("</del></span>"),
      link: (href, title, text) =>
        withCodeDelimiters(
          `<a href="${href}"${title ? ` title="${title}"` : ""}>`
        ) +
        text +
        withCodeDelimiters("</a>"),
      image: (src, title, alt) =>
        withCodeDelimiters(
          `<img src="${src}"${alt ? ` alt="${alt}"` : ""}${
            title ? ` title="${title}"` : ""
          }/>`
        ),
      text: (text) => text.replace(/\n/g, withCodeDelimiters("<br/>")),
    },
    extensions: [
      /**
       * This extension ensures [code][/code] blocks are kept intact. "[code][/code](link)"
       * for example would be parsed as "[code]" followed by a link "[/code](link)", so this
       * extension prevents that from happening so that "[code][/code]" blocks that are passed
       * in will always come out as normal.
       */
      {
        name: "codeBlock",
        level: "inline",
        start: (src) => {
          return turnNoIndexInto(
            src.length,
            src.indexOf(
              constants.CODE_DELIMITERS.START + constants.CODE_DELIMITERS.END
            )
          );
        },
        tokenizer: (src) => {
          if (
            src.startsWith(
              constants.CODE_DELIMITERS.START + constants.CODE_DELIMITERS.END
            )
          ) {
            return {
              type: "codeBlock",
              raw:
                constants.CODE_DELIMITERS.START + constants.CODE_DELIMITERS.END,
              tokens: [],
            };
          }
        },
        renderer: (token) => {
          if (token.type === "codeBlock") {
            return token.raw;
          } else return false;
        },
      },
      /**
       * This extension makes all stanford.edu links recognized automatically. Normally, only
       * links that begin with http:// or www. (e.g., https://google.com or www.google.com) are
       * recognized while links like google.com or cloud.google.com are not recognized. This
       * ensures that any stanford.edu link, including ones like iprequest.stanford.edu or just
       * stanford.edu are recognized as links even though they are missing the URL scheme at the
       * beginning (we just assume https:// here). It uses the same code (modified a little) that
       * Marked uses for recognizing other URLs.
       * @see {@link https://github.com/markedjs/marked/blob/e93f800ad610a42897351ed61ab521ab61874a15/src/Tokenizer.js#L702}
       */
      {
        name: "autoStanfordLink",
        level: "inline",
        start: (src) => {
          const match = src.match(
            /([a-zA-Z0-9-]+\.)*stanford\.edu(\/[^\s<]*|(?!\B))/i
          );
          return match ? match.index : src.length;
        },
        tokenizer: (src) => {
          const match =
            /^([a-zA-Z0-9-]+\.)*stanford\.edu(\/[^\s<]*|(?!\B))/i.exec(src);
          if (match) {
            let prevMatch;
            do {
              prevMatch = match[0];
              const newMatch =
                /(?:[^?!.,:;*_~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_~)]+(?!$))+/.exec(
                  match[0]
                );
              if (newMatch) {
                match[0] = newMatch[0];
              }
            } while (prevMatch !== match[0]);
            const text = escape(match[0]);
            const href = "https://" + text;
            return {
              // We return a "link" instead of "autoStanfordLinks" the way we're supposed
              // to, so that the token is parsed as a link like normal.
              type: "link",
              raw: match[0],
              text,
              href,
              tokens: [
                {
                  type: "text",
                  raw: text,
                  text,
                },
              ],
            };
          }
        },
      },
      /**
       * This extension converts forms into <tables>. As an example, instead of:
       * ```
       * key: value
       * form field: form value
       * some label: corresponding text
       * ```
       * we can treat this as a table:
       * ```html
       * <table>
       *   <tbody>
       *     <tr>
       *       <td>key</td>
       *       <td>value</td>
       *     <tr>
       *     ...
       *   </tbody>
       * </table>
       * ```
       * This is particularly helpful for macro forms, like Net Trouble Report. Only forms that
       * have at least three rows will be treated as tables to prevent converting just one or two
       * lines into a table.
       * The values can span multiple lines, e.g.,
       * ```
       * form field: a line of text
       * that spans multiple lines
       * ```
       * will be one row in the table, and the second cell will span two lines. Since it can span
       * multiple lines, it's hard to differentiate between a multi-line cell and a new row. E.g.,
       * form field: this is a multi-line string of
       * text with a colon ":" on the second line
       * That'll be translated as two rows instead of one row with a multi-line cell. To ensure it
       * is treated as the latter, you can add two spaces at the beginning of the line:
       * ```
       * form field: this is a multi-line string of
       *   text with a colon ":" that won't be translated as a new row.
       * ```
       * That'll ensure the second line doesn't get translated as a new row in the table.
       */
      {
        name: "formTable",
        level: "block",
        tokenizer: function (src) {
          const match =
            /^(?!\n)(?:(?:[^.\n]|\.\S)*?:(?:[^\S\n].+?|[^\S\n]*?)(?:\n.+)*?)(?:\n(?! |\t).*?:(?:[^\S\n].+?|[^\S\n]*?)(?:\n.+)*?){2,}(?=\n?$|\n\n)/.exec(
              src
            );
          if (match) {
            const rows = [];
            let newSrc = src.trimStart();
            while (newSrc) {
              const rowMatch =
                /^(?:.*?:(?:[^\S\n].+?|[^\S\n]*?)(?:\n.+)*?)(?=\n(?! {2}|\t).*?:([^\S\n].+?|[^\S\n]*?)(?:\n.+)*?|\n\n|\n?$)/.exec(
                  newSrc
                );
              if (!rowMatch) break;
              const row = rowMatch[0];
              rows.push(row);
              newSrc = newSrc.substring(row.length);
              // Break if there are two lines between these rows, indicating a
              // paragraph break.
              if (/^\n[^\S\n]*\n/.test(newSrc)) break;
              newSrc = newSrc.trimStart();
            }

            const used = src.substring(0, src.length - newSrc.length);
            const rowTokens: FormTableRowToken[] = [];

            for (const row of rows) {
              const colonIndex = row.indexOf(":");
              let [before, after] = [
                row.substring(0, colonIndex),
                row.substring(colonIndex + 1),
              ];
              before = before.trim();
              after = after
                .split("\n")
                .map((line) => line.trim())
                .join("\n");
              const token: FormTableRowToken = {
                type: "formTableRow",
                before: [],
                after: [],
                raw: row,
              };
              this.lexer.inline(before.trim(), token.before);
              this.lexer.inline(after.trim(), token.after);
              rowTokens.push(token);
            }

            return {
              type: "formTable",
              raw: used,
              // marked.Token does not include marked.Tokens.Generic for whatever
              // reason, so we have to typecast it ourselves.
              tokens: rowTokens as unknown as marked.Token[],
            };
          }
        },
        renderer: function (token) {
          const rows = (token as unknown as FormTableToken).tokens;
          let html = withCodeDelimiters("<table><tbody>");
          for (const row of rows) {
            html +=
              withCodeDelimiters("<tr><td>") +
              this.parser.parseInline(row.before) +
              withCodeDelimiters("</td><td>") +
              this.parser.parseInline(row.after) +
              withCodeDelimiters("</td></tr>");
          }
          html += withCodeDelimiters("</tbody></table>");
          return html;
        },
      },
    ],
  });
};

/**
 * Sets up a callback that replaces Save buttons in ServiceNow's UI with a clone of the buttons but
 * with additional functionality. Specifically, the Save buttons will convert textarea text into
 * Markdown, wait a few milliseconds, and then call the normal Save button's click handler so that
 * ServiceNow will treat the textareas as HTML instead of plain text. Should only be called once.
 */
const duplicateSaveButtons = (): void => {
  waitForElements(
    [
      `[id*=sysverb_update]:not([data-${constants.EXTENSION_PREFIX}-save-button-cloned])`,
      `[id*=sysverb_insert]:not([data-${constants.EXTENSION_PREFIX}-save-button-cloned])`,
      `button.activity-submit:not([data-${constants.EXTENSION_PREFIX}-save-button-cloned])`,
      `button[data-action="save"]:not([data-${constants.EXTENSION_PREFIX}-save-button-cloned])`,
    ],
    (buttons) => {
      for (const button of buttons) {
        // Let TypeScript know this is an HTMLElement
        if (!isInstance(button, HTMLElement)) continue;

        button.setAttribute(
          `data-${constants.EXTENSION_PREFIX}-save-button-cloned`,
          "true"
        );

        // Clone the button and remove any click event listener attributes to ensure it does not
        // inherit any click listeners from the original button.
        const previousOnClick = button.getAttribute("onclick");
        button.removeAttribute("onclick");
        const clone = cloneNode(button, true);
        if (previousOnClick) button.setAttribute("onclick", previousOnClick);

        // Give this new clone a different ID
        if (button.id) {
          clone.id = `${constants.EXTENSION_PREFIX}-clone-of-` + button.id;
        }

        // Insert the clone where the actual button should be.
        if (button.parentNode) button.parentNode.insertBefore(clone, button);
        // Hide the actual button so that the clone looks like it has replaced it
        // completely.
        button.style.opacity = "0";
        button.style.position = "absolute";
        button.style.pointerEvents = "none";
        button.tabIndex = -1;

        const onClick = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();

          const needsDelay = prepareTextAreasForTicketSave();

          if (needsDelay) {
            // If at least one textarea was changed, we need to give ServiceNow a small delay for it
            // to see the change and then update after that.
            setTimeout(() => {
              button.click();
            }, 200);
          } else {
            // If there weren't any changes, we can tell ServiceNow to execute the original button
            // click handler immediately.
            button.click();
          }
        };

        // When we click the cloned button, replace textarea values with Markdown escaped
        // text, and then click the original button.
        clone.addEventListener("click", onClick);
      }
    }
  );
};

/**
 * Initializes textarea data needed for displaying Markdown. Should only be called once.
 */
const configureTextAreaData = (): void => {
  addTextAreaData((textarea) => {
    // If the element before this has the class "sn-stream-input-decorator", keep track of it so we
    // can hide it later.
    let decorator: Element | null;
    for (
      decorator = textarea.previousElementSibling;
      decorator;
      decorator = decorator.previousElementSibling
    ) {
      if (decorator.classList.contains("sn-stream-input-decorator")) {
        break;
      }
    }

    const markdownPreviewer = makeElement("div", {
      className: `${constants.EXTENSION_PREFIX}-markdown-previewer form-control`,
      style: "display: none;",
    });
    const shadowRoot = markdownPreviewer.attachShadow({
      mode: "open",
    });
    shadowRoot.innerHTML = `
        <link href="styles/activity_encapsulated.css" rel="stylesheet" type="text/css">
        <style>:host img{max-width:100%;height:auto;overflow:hidden}</style>
        <div></div>
    `;
    if (textarea.parentNode) {
      textarea.parentNode.insertBefore(
        markdownPreviewer,
        decorator && textarea.previousElementSibling === decorator
          ? decorator
          : textarea
      );
    }

    return {
      isPreviewingMarkdown: false,
      markdownPreviewer,
      decorator,
      // Makes the character counter underneath textareas show a more accurate character count.
      // The value is parsed as Markdown so that the character count *after* parsing Markdown is
      // shown instead.
      characterCounterFunction: (value: string) => parseMarkdown(value).length,
      // markdownPreviewerSubBarIndex:
    };
  });
};

/**
 * Parses text inside textareas and replaces the text with ServiceNow-friendly HTML. Only textareas
 * that actually allow HTML are parsed.
 * @returns A boolean indicating whether at least one text area had its value changed.
 */
const prepareTextAreasForTicketSave = (): boolean => {
  const textareas = Array.from(
    document.getElementsByTagName("textarea")
  ).filter((textarea) => {
    const type = getTextAreaType(textarea);
    // Only Comments and Work Notes allow HTML.
    return type === TextAreaType.Comments || type === TextAreaType.WorkNotes;
  });

  let atLeastOneChanged = false;
  for (const textarea of textareas) {
    // Make sure the textarea isn't in previewing mode.
    changeTextAreaMarkdownPreviewerVisibility(textarea, false);
    const parsedValue = parseMarkdown(textarea.value);
    if (parsedValue !== textarea.value) {
      writeToTextArea(textarea, parsedValue);
      atLeastOneChanged = true;
    }
  }
  return atLeastOneChanged;
};

/**
 * Changes whether a textarea's markdown previewer is visible or not.
 * @param textarea The textarea to toggle the previewer for.
 * @param visible A boolean indicating whether the previewer should be visible or not.
 */
const changeTextAreaMarkdownPreviewerVisibility = (
  textarea: HTMLTextAreaElement,
  visible: boolean
): void => {
  const data = getTextAreaData<TextAreaDataSlice>(textarea);
  if (!data) return;
  data.isPreviewingMarkdown = visible;
  const previewerBtn = Array.from(data.subBar.children).find((child) =>
    child.classList.contains(
      `${constants.EXTENSION_PREFIX}-markdown-previewer-btn`
    )
  );
  if (previewerBtn) {
    previewerBtn.classList[visible ? "add" : "remove"](
      `${constants.EXTENSION_PREFIX}-is-previewing-markdown`
    );
  }

  data.markdownPreviewer.classList[visible ? "add" : "remove"](
    `${constants.EXTENSION_PREFIX}-is-previewing-markdown`
  );
  if (data.isPreviewingMarkdown) {
    // Parse the textarea's value.
    let parsed = parseMarkdown(textarea.value);

    // The returned string will have [code] blocks that we need to remove and evaluate. Everything
    // inside the code blocks will be left as-is, but everything outside will be escaped. We don't
    // have to worry about nested [code] blocks because parseMarkdown gets rid of those for us
    // already.
    let translated = "";
    let index: number;
    while (~(index = parsed.indexOf(constants.CODE_DELIMITERS.START))) {
      const closer = turnNoIndexInto(
        parsed.length,
        parsed.indexOf(constants.CODE_DELIMITERS.END)
      );
      translated += escapeHTML(parsed.substring(0, index));
      translated += parsed.substring(
        index + constants.CODE_DELIMITERS.START.length,
        closer
      );
      parsed = parsed.substring(closer + constants.CODE_DELIMITERS.END.length);
    }
    // Add the rest of the string that's left over to the translated value.
    translated += escapeHTML(parsed);

    // Insert the parsed markdown into the previewer's shadow root.
    data.markdownPreviewer.shadowRoot!.lastElementChild!.innerHTML = translated;

    // Update the previewer's styles to match the textarea's as closely as possible.
    data.markdownPreviewer.style.paddingLeft = data.elementStyles.paddingLeft;
    data.markdownPreviewer.style.paddingRight = data.elementStyles.paddingRight;
    data.markdownPreviewer.style.paddingTop = data.elementStyles.paddingTop;
    data.markdownPreviewer.style.paddingBottom =
      data.elementStyles.paddingBottom;

    replaceSmartText(data.markdownPreviewer);

    // Hide the textarea and show the previewer.
    data.markdownPreviewer.style.display = "block";
    textarea.style.display = "none";

    if (data.decorator) {
      data.decorator.style.display = "none";
    }
  } else {
    // Hide the previewer and show the textarea.
    data.markdownPreviewer.style.display = "none";
    textarea.style.display = "";

    if (data.decorator) {
      data.decorator.style.display = "";
    }
  }
};

/**
 * Parses a string of Markdown into ServiceNow-friendly HTML. ServiceNow only looks at code in
 * between [code] ... [/code] tags, so this will convert Markdown into HTML where the appropriate
 * HTML is sandwiched between [code] blocks so ServiceNow will render it correctly.
 * @param text The Markdown text to parse.
 * @returns A string where Markdown has been converted into ServiceNow-friendly HTML.
 */
const parseMarkdown = (text: string): string => {
  // First, we go through the text looking for [code] ... [/code] delimiters. Delimiters that are
  // empty or only have spaces in between them are unwrapped and replaced with its inner contents
  // since there is no code inside them that matters, and it will allow the markdown parser to read
  // them as spaces instead of "[code][/code]" text. Any [code] blocks that were not removed because
  // they have non-space content inside them are completely emptied out to leave only
  // "[code][/code]". When Marked parses the text, that will allow it to ignore all the text inside
  // inside the [code] blocks and treat it as a regular span of text. Once it has been parsed, we go
  // back through and replace each "[code][/code]" marker with all the text was originally inside
  // them so that the text inside remains unparsed.

  // To allow for <!-- HTML comments --> inside the text, we go through and remove any right away so
  // that it doesn't get parsed by Marked.
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // If the entire text is just "[code][/code]", we return as normal instead of returning "".
  if (text === withCodeDelimiters("")) return text;

  /**
   * `filteredText` is the text once all the [code] blocks have been filtered out.
   */
  let filteredText = "";
  /**
   * Keeps track of the text we find inside [code] blocks so we can insert it back into the text at
   * the end.
   */
  const codeBlocks: string[] = [];

  let startIndex: number;
  while (~(startIndex = text.indexOf(constants.CODE_DELIMITERS.START))) {
    // Add all the text up to the "[code]".
    filteredText += text.substring(0, startIndex);
    // Remove the text up to and including the "[code]".
    text = text.substring(startIndex + constants.CODE_DELIMITERS.START.length);
    // Keep track of the text inside the current code block.
    let codeBlock = "";

    // Keep track of how many nested "[code] ... [/code]" blocks we find. Start at 1 since we just
    // found the first "[code]".
    let codeInstances = 1;
    // Keep going until we get to 0 codeInstances to indicate we found a matching closing "[/code]".
    while (codeInstances) {
      // Get the indices for the next "[code]" and "[/code]".
      const startIndex = text.indexOf(constants.CODE_DELIMITERS.START);
      const endIndex = text.indexOf(constants.CODE_DELIMITERS.END);

      // If there is no "[/code]" block, it means we've reached the end of the string without being
      // able to close it. Add on an extra "[/code]" to the end so we can parse it on the next
      // iteration.
      if (!~endIndex) {
        text += "[/code]";
        continue;
      }

      if (~startIndex && startIndex < endIndex) {
        // If there is a "[code]" that comes before a "[/code]", it means we found a nested
        // "[code]", and will need to find an extra "[/code]". Nested [code]s are ignored by
        // ServiceNow, so we can just remove the "[code]" and "[/code]" altogether.
        // Add the text up to the "[code]" to the code block's text.
        codeBlock += text.substring(0, startIndex);
        // Remove the text up to and including the "[code]" so we can parse inside of it.
        text = text.substring(
          startIndex + constants.CODE_DELIMITERS.START.length
        );
        // Increment codeInstances we know to look for an extra "[/code]" block.
        codeInstances++;
      } else {
        // If we found a closing "[/code]", we add all the text up to the "[/code]" to the code
        // block.
        codeBlock += text.substring(0, endIndex);
        // Remove the "[/code]" from the text so we can parse after it now.
        text = text.substring(endIndex + constants.CODE_DELIMITERS.END.length);
        // Decrement codeInstances so we know how many more "[/code]" blocks to look for.
        codeInstances--;
      }
    }

    // Now we've parsed all the text inside a "[code][/code]" block and removed any nested
    // "[code][/code]" blocks that may have been inside. If the content of the code block is just
    // spaces, or nothing, we don't need to add this [code] block to the filteredText so that Marked
    // will just treat it as space instead of text.
    if (codeBlock.replace(/ +/, "") === "") {
      // Just add the spaces directly.
      filteredText += codeBlock;
    } else {
      // Otherwise, we will add a "[code][/code]" to serve as a marker for when we need to go back
      // and insert the text again.
      filteredText +=
        constants.CODE_DELIMITERS.START + constants.CODE_DELIMITERS.END;
      codeBlocks.push(codeBlock.replace(/\n/g, "<br/>"));
    }
  }
  // Now we need to add any remaining text to filteredText.
  filteredText += text;

  // We also want to escape any ampersands so that HTML entities are rendered as-is.
  filteredText = filteredText.replace(/&/g, "&amp;");

  // Use Marked to parse the text as Markdown.
  filteredText = marked(filteredText, {
    mangle: false,
    headerIds: false,
    smartLists: true,
  });

  // Get rid of any HTML entities that were produced by Marked.
  filteredText = filteredText
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

  // Now we go back through and replace instances of "[code][/code]" with the corresponding code
  // block.
  let codeIndex: number;
  while (
    ~(codeIndex = filteredText.lastIndexOf(
      constants.CODE_DELIMITERS.START + constants.CODE_DELIMITERS.END
    ))
  ) {
    filteredText =
      filteredText.substring(
        0,
        codeIndex + constants.CODE_DELIMITERS.START.length
      ) +
      codeBlocks.pop() +
      filteredText.substring(
        codeIndex + constants.CODE_DELIMITERS.START.length
      );
  }

  // Sometimes, newlines ("\n") seem to slip in sometimes, even though new lines in text are
  // *supposed* to be converted to <br>s. We just replace any lingering newlines into "" to get rid
  // of these.
  filteredText = filteredText.replaceAll("\n", "");

  // Now, to shorten the text a bit, get rid of any "[/code][code]" substrings (i.e., the end of a
  // [code] block followed immediately by the start of a code block) so that we can just collapse
  // adjacent [code] blocks.
  filteredText = filteredText.replaceAll(
    constants.CODE_DELIMITERS.END + constants.CODE_DELIMITERS.START,
    ""
  );

  // At this point, we're basically done. ServiceNow likes to limit some textareas to 4000
  // characters though, which is a problem because expanding something like "https://example.com" to
  // Markdown becomes "[code]<a href='https://example.com'>https://example.com</a>[/code]", which is
  // significantly longer. To make the expanded text as short as possible, we look for any
  // redundancies that we can remove.

  // Basically, we want to see where we can add "[code]" and "[/code]" to create the shortest
  // strings possible. If we want to make a "<p>paragraph</p>" for example, we could write it as
  // "[code]<p>[/code]paragraph[code]</p>[/code]", but an even shorter way to write it would be
  // "[code]<p>paragraph</p>[/code]". But then, what if we wanted to write
  // "<p>&ltp&gt;paragraph&lt;/p&gt;</p>" (i.e., show the literal text "<p>paragraph</p>" from
  // within a <p> element), there are two options:
  // 1. [code]<p>&lt;p&gt;paragraph&lt;/p&gt;</p>[/code]
  //    -> Change the inner HTML so it is not interpreted as HTML
  // 2. [code]<p>[/code]<p>paragraph</p>[code]</p>[/code]
  //    -> Leave a [code] block so the inner HTML is interpreted as plain text
  // In this case, 1. is shorter, so we need to figure out where it's most beneficial to add
  // "[code]" and "[/code]" blocks.

  // To do that, we use a dynamic programming approach in which we parse the text into three tokens:
  // plain, code, and escaped. Code tokens are any characters inside [code] blocks that *must* be
  // wrapped inside [code] blocks in the output. Escaped characters are HTML characters ("<", ">",
  // and "&"). These characters can be present inside or outside [code] blocks. If outside, we can
  // leave them as-is (i.e., "<", ">", "&"). If inside though, we have to escape them into "&lt;",
  // "&gt;" and "&amp;" to prevent them from being rendered as actual HTML. Plain tokens are any
  // other characters that can be present inside a code block or outside and we don't have to escape
  // them (e.g., plain letter and numbers).

  // Once we've parsed the text into these tokens, we iterate backwards through these tokens and
  // keep track of two arrays of penalty values. Both start at 0 and represent the penalty up to
  // that point if we are inside a [code] block, or outside a code block. When we run into a "code"
  // token, we know our only choice is to be inside a [code] block, so the penalty for NOT being
  // inside a [code] block will be Infinity. When we run into an "escaped" token, the penalty for
  // being inside the code block will be the extra characters it takes to escape the character
  // (e.g., the penalty for "<" is "&lt;".length - "<".length = 3). The penalty for being outside a
  // code block is 0 since we don't have to add any characters, we can just keep the "<" exactly as-
  // is. For "plain" tokens, the penalty for both is 0 because we don't have to add any characters
  // to escape these tokens. When we want to switch from the outside-[code]-block penalty array to
  // the inside-[code]-block array, we accumulate a penalty of "[code]".length because that's how
  // many characters it would take to switch to inside a [code] block. When we want to switch from
  // inside a code block to outside, we accumulate a penalty of "[/code]".length. Here's an example:
  // The input "[code]<p>[/code]<span>text</span>[code]</p>[/code]" represents a paragraph `<p>`
  // element with the text "<span>text & more text</span>" inside it as plain text. This would be
  // parsed as:
  //   {type: "code", value: "<p>"},
  //   {type: "escaped", value: "<"},
  //   {type: "plain", value: "span"},
  //   {type: "escaped", value: ">"},
  //   {type: "plain", value: "text "},
  //   {type: "escapes", value: "&"},
  //   {type: "plain", value: " more text"},
  //   {type: "escaped", value: "<"},
  //   {type: "plain", value: "/span"},
  //   {type: "escaped", value: ">"},
  //   {type: "code", value: "</p>"}
  // We will start two penalty arrays:
  //   inside-[code]: []
  //   outside-[code]: []
  // Since we have to end outside of a code block, we have to add a penalty to start with:
  //   inside-[code]: ["[/code]".length] = [7]
  //   outside-[code]: [0]               = [0]
  // That keeps track of the final penalty so that we always end outside of a [code] block.
  // Now we loop backwards and start with the "</p>" code token. Since it is inside a [code] block
  // we have to put a penalty of Infinity for the outside-[code] penalty array (and add a penalty
  // of 0 for inside-[code] since we don't need to add any characters):
  //   inside-[code]: [0+7, 7]       = [       7, 7]
  //   outside-[code]: [Infinity, 0] = [Infinity, 0]
  // Now for the escaped ">", we can stay within the [code] block at a penalty of "&lt;".length -
  // ">".length = 4 - 1 = 3. We can also leave the [code] block, at a cost of "[code]".length = 6:
  //   inside-[code]: [3+7, 7, 7]         = [10,        7, 7]
  //   outside-[code]: [6+7, Infinity, 0] = [13, Infinity, 0]
  // A plain "/span" token has a penalty of 0 for both:
  //   inside-[code]: [0+10, 10, 7, 7]        = [10, 10,        7, 7]
  //   outside-[code]: [0+13, 13, Infinity, 0] = [13, 13, Infinity, 0]
  // Another escaped "<" token that has an inside-[code] penalty of 3 and outside-[code] penalty
  // of 0:
  //   inside-[code]: [3+10, 10, 10, 7, 7]         = [13, 10, 10,        7, 7]
  //   outside-[code]: [0+13, 13, 13, Infinity, 0] = [13, 13, 13, Infinity, 0]
  // Another plain token doesn't do much (0 penalty):
  //   inside-[code]: [0+13, 13, 10, 10, 7, 7]         = [13, 13, 10, 10,        7, 7]
  //   outside-[code]: [0+13, 13, 13, 13, Infinity, 0] = [13, 13, 13, 13, Infinity, 0]
  // An escaped "&" token has an inside-[code] penalty of "&amp;".length - "&".length = 4.
  //   inside-[code]: [4+13, 13, 13, 10, 10, 7, 7]         = [17, 13, 13, 10, 10,        7, 7]
  //   outside-[code]: [0+13, 13, 13, 13, 13, Infinity, 0] = [13, 13, 13, 13, 13, Infinity, 0]
  // Plain token adds 0 to both:
  //   inside-[code]: [0+17, 17, 13, 13, 10, 10, 7, 7]         = [17, 17, 13, 13, 10, 10,        7, 7]
  //   outside-[code]: [0+13, 13, 13, 13, 13, 13, Infinity, 0] = [13, 13, 13, 13, 13, 13, Infinity, 0]
  // Another escape ">" token with an inside-[code] penalty of 3:
  //   inside-[code]: [3+17, 17, 17, 13, 13, 10, 10, 7, 7]         = [20, 17, 17, 13, 13, 10, 10,        7, 7]
  //   outside-[code]: [0+13, 13, 13, 13, 13, 13, 13, Infinity, 0] = [13, 13, 13, 13, 13, 13, 13, Infinity, 0]
  // Another plain token:
  //   inside-[code]: [0+20, 20, 17, 17, 13, 13, 10, 10, 7, 7]         = [20, 20, 17, 17, 13, 13, 10, 10,        7, 7]
  //   outside-[code]: [0+13, 13, 13, 13, 13, 13, 13, 13, Infinity, 0] = [13, 13, 13, 13, 13, 13, 13, 13, Infinity, 0]
  // This time, something new happens. We encounter an escaped "<" token, which has an
  // inside-[code] penalty of 3, which would bring the penalty up to 3 + 20 = 23. The alternative
  // option is to jump from outside-[code] to inside-[code] at a penalty of "[/code]".length plus
  // whatever the outside-[code] penalty is, which is 13 at this point. "[/code]".length + 13 =
  // 20, which is lower than 23, so we can use that instead:
  //   inside-[code]: ["[/code]".length + 13, 20, 20, 17, 17, 13, 13, 10, 10, 7, 7] = [20, 20, 17, 17, 13, 13, 10, 10,        7, 7]
  //   outside-[code]: [0+13, 13, 13, 13, 13, 13, 13, 13, 13, Infinity, 0]          = [13, 13, 13, 13, 13, 13, 13, 13, Infinity, 0]
  // Last token, we have a code token, which has a penalty of Infinity for outside-[code]:
  //   inside-[code]: [20, 20, 20, 20, 17, 17, 13, 13, 10, 10, 7, 7]               = [      20, 20, 20, 17, 17, 13, 13, 10, 10,        7, 7]
  //   outside-[code]: [Infinity, 13, 13, 13, 13, 13, 13, 13, 13, 13, Infinity, 0] = [Infinity, 13, 13, 13, 13, 13, 13, 13, 13, Infinity, 0]
  // To finish, we need to end outside a [code] block, which we can do by adding an infinite
  // penalty to the inside-[code] array and 0 to the inside-[code] array. Since 0 + Infinity is a
  // higher penalty than switching from inside-[code] to outside-[code], we instead add
  // "[code]".length + whatever the penalty is for inside-[code] (6 + 26 = 26).
  //   inside-[code]:  [Infinity,       20, 20, 20, 20, 17, 17, 13, 13, 10, 10,        7, 7]
  //   outside-[code]: [      26, Infinity, 13, 13, 13, 13, 13, 13, 13, 13, 13, Infinity, 0]
  // Now we go forwards through these arrays, starting outside of a code block. The first one, we
  // switched from inside-[code] to outside-[code]. Since we're going forwards instead of backwards,
  // this corresponds to adding a "[code]" to enter inside a [code] block:
  //   output: "[code]"
  // At the next step, we stay inside the [code] block so we just add the associated value:
  //   output: "[code]<p>"
  // Next step was where we switched from outside-[code] to inside-[code], which corresponds to
  // adding "[/code]" (since we're going backwards):
  //   output: "[code]<p>[/code]"
  // Now, we're outside a [code] block and we don't switch for a while:
  //   output: "[code]<p>[/code]<"
  //   output: "[code]<p>[/code]<span"
  //   output: "[code]<p>[/code]<span>"
  //   output: "[code]<p>[/code]<span>text "
  //   output: "[code]<p>[/code]<span>text &"
  //   output: "[code]<p>[/code]<span>text & more text"
  //   output: "[code]<p>[/code]<span>text & more text<"
  //   output: "[code]<p>[/code]<span>text & more text</span"
  //   output: "[code]<p>[/code]<span>text & more text</span>"
  // Now, this is farther back in the penalty arrays, this is where we switched from inside-[code]
  // to outside-[code] (when we added the 6+7), so we add a "[code]" and switch back into the
  // inside-[code] penalty array:
  //   output: "[code]<p>[/code]<span>text & more text</span>[code]"
  // Now we add the code value:
  //   output: "[code]<p>[/code]<span>text & more text</span>[code]</p>"
  // The last one was where we added the 7 to end of the array to indicate that we should switch
  // back out to ensure we end outside of a [code] block:
  //   output: "[code]<p>[/code]<span>text & more text</span>[code]</p>[/code]"
  // In this case, we ended up with exactly the same as the input, but if we had gone with another
  // example, like "[code]<p>[/code]<span>text</span>[code]</p>[/code]", the output would have
  // been "[code]<p>&lt;span&gt;text&lt;/span&gt;</p>[/code]" because the cheapest penalty would
  // have been to *never* switch out of the inside-[code] block array until the end, so the entire
  // text would have been inside a [code] block. The alternate, longer one would have been
  // "[code]<p>[/code]<span>text</span>[code]</p>[/code]", which has a length of 50 compared to 49
  // with the actual optimal solution.

  /**
   * textTokens keeps track of the tokens we are going to parse from the text. It starts with a
   * custom start token that has an infinite penalty for inside-[code] to ensure we start outside of
   * a [code] block.
   */
  const textTokens: MarkdownParsingToken[] = [
    {
      type: "start",
      insideCodeValue: null,
      outsideCodeValue: "",
      insideCodePenalty: Infinity,
      outsideCodePenalty: 0,
    },
  ];
  // Parse out any [code] blocks from the text into "code" tokens. We have not parsed out "escaped"
  // tokens just yet.
  let parsedFilteredText = filteredText;
  codeIndex = 0;
  while (
    ~(codeIndex = parsedFilteredText.indexOf(constants.CODE_DELIMITERS.START))
  ) {
    if (codeIndex !== 0) {
      textTokens.push({
        type: "plain",
        insideCodeValue: parsedFilteredText.substring(0, codeIndex),
        outsideCodeValue: parsedFilteredText.substring(0, codeIndex),
        insideCodePenalty: 0,
        outsideCodePenalty: 0,
      });
    }
    parsedFilteredText = parsedFilteredText.substring(
      codeIndex + constants.CODE_DELIMITERS.START.length
    );
    codeIndex = parsedFilteredText.indexOf(constants.CODE_DELIMITERS.END);
    if (!~codeIndex) {
      codeIndex = parsedFilteredText.length;
    }
    textTokens.push({
      type: "code",
      insideCodeValue: parsedFilteredText.substring(0, codeIndex),
      outsideCodeValue: null,
      insideCodePenalty: 0,
      outsideCodePenalty: Infinity,
    });
    parsedFilteredText = parsedFilteredText.substring(
      codeIndex + constants.CODE_DELIMITERS.END.length
    );
  }
  if (parsedFilteredText.length) {
    textTokens.push({
      type: "plain",
      insideCodeValue: parsedFilteredText,
      outsideCodeValue: parsedFilteredText,
      insideCodePenalty: 0,
      outsideCodePenalty: 0,
    });
  }

  let firstCode: MarkdownParsingToken | null = null;

  // Go through the tokens and look for any code blocks. If we find one, we want to search for any
  // elements that need to be styled. This is not directly related to the algorithm described
  // above. This is purely for adding additional styles into the text to ensure <code> elements
  // and the like are rendered with the proper styles.
  const stylesToIgnore = new Set(Object.keys(REPLACEMENT_SUBSTYLES));
  for (const token of textTokens) {
    if (token.type !== "code") {
      continue;
    }
    firstCode = firstCode || token;
    // Do a naive search for HTML elements. Instead of actually parsing the code block as HTML, we
    // just search for opening HTML tags like "<div>" (but without the closing ">" since it could
    // also be "<div attr="val">"). This can result in some false positives, for example if the text
    // contains just "not actually a <div element", which would be rendered as plain text without
    // any actual <div> elements. The likelihood of this is very low unless they intentionally add
    // something like that, and even then, a false positive just adds a small amount of characters
    // to the overall text, so it doesn't matter that much.
    const value = token.insideCodeValue!.toLowerCase();
    for (const elemName of stylesToIgnore) {
      if (value.includes("<" + elemName.toLowerCase())) {
        // Remove this element name from the list of styles to ignore.
        stylesToIgnore.delete(elemName);
      }
    }
    if (stylesToIgnore.size === 0) break;
  }

  // Add the appropriate styles to stylesheetText.
  let stylesheetText = "";
  for (const elemName in REPLACEMENT_SUBSTYLES) {
    if (stylesToIgnore.has(elemName)) continue;
    stylesheetText +=
      REPLACEMENT_SUBSTYLES[elemName as keyof typeof REPLACEMENT_SUBSTYLES];
  }

  // Insert the stylesheet inside the first [code] block. If there are no [code] blocks, it's okay
  // because in that case we don't have any elements to style in the first place and
  // stylesheetText will be empty.
  if (firstCode && stylesheetText) {
    firstCode.insideCodeValue =
      `<style>${stylesheetText}</style>` + firstCode.insideCodeValue;
  }

  // Back to the algorithm: look through our current plain tokens and parse out any HTML characters
  // that need to be escaped ("<", ">", and "&") and insert these back in as "escaped" tokens.
  for (let i = 0; i < textTokens.length - 1; i++) {
    const token = textTokens[i];
    if (token.type === "plain") {
      const firstIndex = Math.min(
        turnNoIndexInto(Infinity, token.outsideCodeValue.indexOf("<")),
        turnNoIndexInto(Infinity, token.outsideCodeValue.indexOf(">")),
        turnNoIndexInto(Infinity, token.outsideCodeValue.indexOf("&"))
      );

      if (!isFinite(firstIndex)) {
        continue;
      }

      const trailingText = token.outsideCodeValue.substring(firstIndex);
      textTokens[i].outsideCodeValue = token.outsideCodeValue.substring(
        0,
        firstIndex
      );
      textTokens[i].insideCodeValue = token.outsideCodeValue.substring(
        0,
        firstIndex
      );
      const translated = {
        ">": "&gt;",
        "<": "&lt;",
        "&": "&amp;",
      }[trailingText[0]]!;
      textTokens.splice(
        i + 1,
        0,
        {
          type: "escaped",
          insideCodeValue: translated,
          outsideCodeValue: trailingText[0],
          insideCodePenalty: translated.length - 1,
          outsideCodePenalty: 0,
        },
        {
          type: "plain",
          insideCodeValue: trailingText.substring(1),
          outsideCodeValue: trailingText.substring(1),
          insideCodePenalty: 0,
          outsideCodePenalty: 0,
        }
      );
      i++;
    }
  }

  // Start the inside-[code] and outside-[code] penalty arrays.
  const insideCodePenalties = new Array(textTokens.length + 1);
  const outsideCodePenalties = new Array(textTokens.length + 1);
  // Each entry in the penalty array will be a 2-long array where the first item is the numerical
  // penalty up to that point, and the second is a boolean indicating whether we are switching into
  // the other array at that point. Here, we add Infinity to inside-[code] to ensure we end outside
  // of a [code] block. The second item (the boolean) doesn't apply here since it's the end of the
  // array, so we just have null.
  insideCodePenalties[textTokens.length] = [Infinity, null];
  outsideCodePenalties[textTokens.length] = [0, null];
  // Now fill out the array backwards to forwards with the appropriate penalty values and keep track
  // of when we switch between arrays.
  for (let i = textTokens.length - 1; i >= 0; i--) {
    const insideStayPenalty =
      insideCodePenalties[i + 1][0] + textTokens[i].insideCodePenalty + 0;
    const insideTransitionPenalty =
      outsideCodePenalties[i + 1][0] +
      textTokens[i].insideCodePenalty +
      constants.CODE_DELIMITERS.END.length;
    const outsideStayPenalty =
      outsideCodePenalties[i + 1][0] + textTokens[i].outsideCodePenalty + 0;
    const outsideTransitionPenalty =
      insideCodePenalties[i + 1][0] +
      textTokens[i].outsideCodePenalty +
      constants.CODE_DELIMITERS.START.length;

    // The "<=" instead of "<" for the inside-[code] penalty array ensures we stay *outside* of a
    // [code] block when the penalties are the same since there's no extra penalty gain, and it
    // means less text we have to parse into HTML later.
    insideCodePenalties[i] = [
      Math.min(insideTransitionPenalty, insideStayPenalty),
      insideTransitionPenalty <= insideStayPenalty,
    ];
    outsideCodePenalties[i] = [
      Math.min(outsideTransitionPenalty, outsideStayPenalty),
      outsideTransitionPenalty < outsideStayPenalty,
    ];
  }

  // Now we've built out both penalty arrays and all that's left is to go forwards through them and
  // build out the shortened string.
  let shortenedText = "";
  // Start outside of a code block by setting to false to being with.
  let isInsideCodeBlock = false;
  for (let i = 0; i < textTokens.length; i++) {
    // Add the appropriate token value depending on whether we are currently inside or outside a
    // [code] block (i.e., a "<" will be added as "<" outside a [code] block and as "&lt;" inside a
    // [code] block).
    shortenedText += isInsideCodeBlock
      ? textTokens[i].insideCodeValue
      : textTokens[i].outsideCodeValue;
    // Determine whether we are switching from one array to the other.
    if (
      (isInsideCodeBlock ? insideCodePenalties[i] : outsideCodePenalties[i])[1]
    ) {
      isInsideCodeBlock = !isInsideCodeBlock;
      // Add [code] or [/code] depending on whether we are switching in or out of a [code] block.
      shortenedText += isInsideCodeBlock
        ? constants.CODE_DELIMITERS.START
        : constants.CODE_DELIMITERS.END;
    }
  }

  return shortenedText;
};

const addPreviewButton = (): void => {
  addToSubBar((textarea) => {
    // Only the Comments and Work Notes textareas should have a Preview button since only those have
    // their text parsed as Markdown.
    const type = getTextAreaType(textarea);
    if (type !== TextAreaType.Comments && type !== TextAreaType.WorkNotes)
      return null;
    const previewBtn = makeElement(
      "button",
      {
        type: "button",
        className: `${constants.EXTENSION_PREFIX}-markdown-previewer-btn btn btn-default`,
      },
      "Preview"
    );
    previewBtn.addEventListener("click", () => {
      const data = getTextAreaData<TextAreaDataSlice>(textarea);
      if (!data) return;
      const newValue = !data.isPreviewingMarkdown;
      changeTextAreaMarkdownPreviewerVisibility(textarea, newValue);
    });
    return previewBtn;
  });
};

const init = (config: ConfigOptions): void => {
  if (hasInitialized) return;
  hasInitialized = true;
  if (!config.enabled.servicenow.markdown) return;

  configureMarked();
  duplicateSaveButtons();
  configureTextAreaData();
  addPreviewButton();
  // Make the Preview button looked like it is beng pressed down when the previewer is active.
  interceptStyles(
    ".btn-default:active",
    `.${constants.EXTENSION_PREFIX}-markdown-previewer-btn.${constants.EXTENSION_PREFIX}-is-previewing-markdown`
  );
};

export default init;
