import {
  getDisplayOrderForNetDB,
  isInstance,
  makeElement,
  mappedMin,
  turnNoIndexInto,
  waitForElements,
  withMaxTimeout,
} from "../helpers";
import constants from "../constants.json";
import { OUIsType } from "./types";
import "./styles.scss";
import stylesAsString from "!!to-string-loader!css-loader?importLoaders=1!postcss-loader!sass-loader!../../prepend-sass-variables-loader.js!./styles.scss";
import { ConfigOptions } from "../config";

const MAC_ADDRESS_REGEX =
  /\b(?:[a-f\d]{12}(?![a-f\d])|[a-f\d]{4}(?:[-–][a-f\d]{4}){2}|[a-f\d]{4}([^a-z\d\s])[a-f\d]{4}\1[a-f\d]{4}(?!\1?[a-f\d])|[a-f\d]{2}(?:[-–][a-f\d]{2}){5}|[a-f\d]{2}([^a-z\d])[a-f\d]{2}(?:\2[a-f\d]{2}){4})(?!\2?[a-f\d])/i;
const IP_ADDRESS_REGEX =
  /(^|[^.])\b((?:[1-9]?\d|1\d\d|2[0-4]\d|25[0-5])(?:\.(?:[1-9]?\d|1\d\d|2[0-4]\d|25[0-5])){3})\b(?!\.\d)/;
const NODE_NAME_REGEX =
  /\b(rescomp-\d+-\d+|sr\d+-[\da-f]+)(?:\.stanford\.edu)?\b/;
const TICKET_REGEX = /\b(?:CALL|CHG|INC|REQ|RITM|SR|TASK)\d+\b/;

const OUIsPopulated = new Promise<string>((resolve, reject) => {
  const url = "https://gitlab.com/wireshark/wireshark/-/raw/master/manuf";

  let primaryFailed = false;
  let fallbackFailed = false;
  let fallback: string | null = null;

  // Try to fetch up-to-date information from the `url` above. This *usually* works, but not always
  // because it needs to go through allorigins.win to get through CORS. If this fetch succeeds,resolve
  // right away. If it fails, fallback to the second fetch.
  withMaxTimeout(
    fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(
        url
      )}&timestamp=${new Date().valueOf()}`
    ),
    5000
  )
    .then((response) => response.json())
    .then((response: { contents: string }) => response.contents)
    .then(resolve, () => {
      if (fallback) return resolve(fallback);
      if (fallbackFailed) return reject();
      primaryFailed = true;
    });

  fetch(
    `https://raw.githubusercontent.com/FiggChristian/PTS-Scripts/main/OUI_list.txt?timestamp=${new Date().valueOf()}`
  )
    .then((response) => response.text())
    .then((text) => {
      if (primaryFailed) return resolve(text);
      fallback = text;
    }),
    () => {
      if (primaryFailed) return reject();
      fallbackFailed = true;
    };
}).then((text) => getOUIObject(text));

const getOUIObject = (response: string): OUIsType => {
  // The list of OUIs we will populate.
  const OUIs: Record<string, string | number> = {};
  // Separate the response into lines.
  for (let index = 0; ~(index = response.indexOf("\n", index)); index++) {
    // If the beginning of this line starts with a "#", it is a comment and we can ignore it.
    if (response[index + 1] === "#" || response[index + 1] === "\n") {
      continue;
    }
    // Get the line as a standalone string.
    const line = response.substring(
      index + 1,
      response.indexOf("\n", index + 1)
    );
    // Split it by tabs to get the individual components.
    const components = line.split("\t");

    // The 0th item is the MAC address prefix. It can be in the form of 6 digits or a full MAC
    // address followed by a "/" and number. The number indicates how many digits the prefix is.
    // E.g., "A1:B2:C3:D4:E5:F6/36" indicates we should look at the first 36/4=9 digits only.
    // A six-digit MAC address is treated as the full six digits.
    if (components[0].length === 8) {
      // 6 digits plus 2 colons
      // The 2nd item is the full name of the vendor. The 1st item is the shortened name of the
      // vendor. We prefer to use the full name but go to the short name when that's not available
      OUIs[components[0]] = components[2] || components[1];
    } else if (components[0][17] === "/") {
      // If we find a prefix length other than 6, we overwrite the OUI for the six digit version
      // with the new length.
      const digits = parseInt(components[0].substring(18)) / 4;
      const prefix = components[0].substring(
        0,
        digits + Math.ceil(digits / 2 - 1)
      );
      OUIs[components[0].substring(0, 8)] = prefix.length;
      OUIs[prefix] = components[2] || components[1];
    } else {
      continue;
    }
  }
  return OUIs;
};

const getOUI = (OUIs: OUIsType, macAddress: string): string | null => {
  let prefix = macAddress.substring(0, 8);
  const item = OUIs[prefix];
  if (typeof item === "string") {
    return item;
  } else if (typeof item === "number") {
    prefix = macAddress.substring(0, OUIs[prefix] as number);
    if (prefix in OUIs) {
      return OUIs[prefix] as string;
    } else {
      return null;
    }
  } else {
    return null;
  }
};

/**
 * Returns whether a node is a Text node.
 * @param node The node to check.
 * @returns A boolean indicating whether the node is a Text node.
 */
const isTextNode = (node?: Node | null | undefined): node is Text =>
  node?.nodeType === Node.TEXT_NODE;
/**
 * Returns whether a node is an Element node.
 * @param node The node to check.
 * @returns A boolean indicating whether the node is an Element node.
 */
const isElementNode = (node: Node | null | undefined): node is Element =>
  node?.nodeType === Node.ELEMENT_NODE;
/**
 * Returns whether a node is a DocumentFragment node.
 * @param node The node to check.
 * @returns A boolean indicating whether the node is a Document Fragment node.
 */
const isDocumentFragmentNode = (
  node: Node | null | undefined
): node is DocumentFragment => node?.nodeType === Node.DOCUMENT_FRAGMENT_NODE;

/**
 * Adds smart text replacements within an node. This function is called recursively on every child
 * node from the starting node.
 * @param node The node to make smart text replacements within.
 */
export const replaceSmartText = (node: Node): void => {
  if (isTextNode(node)) {
    let macAddressMatch;
    let ipAddressMatch;
    let nodeNameMatch;
    let ticketMatch;

    for (;;) {
      const textContent = node.textContent ?? "";
      macAddressMatch = MAC_ADDRESS_REGEX.exec(textContent);
      ipAddressMatch = IP_ADDRESS_REGEX.exec(textContent);
      nodeNameMatch = NODE_NAME_REGEX.exec(textContent);
      ticketMatch = TICKET_REGEX.exec(textContent);

      const firstMatch = mappedMin(
        (match) => match?.index,
        macAddressMatch,
        ipAddressMatch,
        nodeNameMatch,
        ticketMatch
      );

      // Break if there are no matches.
      if (firstMatch == null) {
        break;
      }

      if (firstMatch === macAddressMatch) {
        // Links sometimes have random numbers in them that look like they could be a MAC address,
        // but are usually just random numbers as part of the link. To check if that's the case, we
        // look at the the location in the text where the MAC address is. We check for a space
        // before and after the MAC address and then check if that "word" that the MAC address is in
        // is a URL.

        // `preText` is all the text inside any text nodes that precede the current text node. If
        // there's a link such as https://example.com/a1b2c3d4e5f6-a1b2c3d4e5f6, it has two "MAC
        // addresses" in it. The first one will be detected and not replaced with smart text. Instead
        // it gets replaced with its own text node so we can move on to the next thing. The text
        // nodes (after finding it and replacing it) will be:
        // "https://example.com/",
        // "a1b2c3d4e5f6", and
        // "-a1b2c3d4e5f6".
        // The next text node after will be looked at, and the second MAC address will be seen as
        // well. Since that text node's content is only "-a1b2c3d4e5f6", we won't recognize that as
        // a URL because the URL has been broken up into multiple text nodes, but we still *do* want
        // to to recognize that it's just a second MAC address in a URL. `preText` is filled with all
        // the text content that precedes the current text node. In that case, it would be
        // "https://example.com/a1b2c3d4e5f6". When we concatenate it with the text node's content,
        // we get the full URL back as one contiguous string, and we can detect that the entire
        // string is in fact a URL.
        let preText = "";
        for (
          let preNode = node.previousSibling;
          isTextNode(preNode);
          preNode = preNode.previousSibling
        ) {
          preText = preNode.textContent + preText;
        }

        const prevWhiteSpaceIndex = Math.max(
          0,
          ...[" ", "\t", "\n"].map((whitespaceChar) =>
            (preText + node.textContent).lastIndexOf(
              whitespaceChar,
              firstMatch.index + preText.length
            )
          )
        );
        const nextWhiteSpaceIndex = mappedMin(
          (value) => turnNoIndexInto(Infinity, value),
          textContent.length + preText.length,
          ...[" ", "\t", "\n"].map((whitespaceChar) =>
            (preText + node.textContent).indexOf(
              whitespaceChar,
              firstMatch.index + firstMatch[0].length + preText.length
            )
          )
        );

        // Get the entire "word" the MAC address is in. In most cases, it's just the MAC address on
        // its own, or it's a URL.
        const macWord = (preText + node.textContent).substring(
          prevWhiteSpaceIndex,
          nextWhiteSpaceIndex
        );
        // Check if it's a valid URL by using the URL builtin constructor.
        let isURL = false;
        try {
          // Check if value can be parsed as a URL.
          const url = new URL(macWord);
          // Make sure this is a "normal" URL. This means other URL protocols like "chrome:" or
          // "data:" will not be counted as URLs, which can create some false negatives, but this
          // also prevents MAC addresses from being counted as a URL. "AB:CD:EF:12:34:56" for
          // example can be read as a URL with protocol "ab:", which would result in false
          // positives, and this happens way more often since no one really sends non-http(s) URLs
          // anyway.
          isURL =
            url.protocol === "https:" ||
            url.protocol === "http:" ||
            url.protocol === "file:";
        } catch {
          /* pass */
        }
        // If this MAC address looks like it's in a URL, we don't highlight it. Instead, we keep it
        // as-is in its own text node.
        if (isURL && node.parentNode) {
          node.parentNode.insertBefore(
            document.createTextNode(textContent.substring(0, firstMatch.index)),
            node
          );
          node.parentNode.insertBefore(
            document.createTextNode(firstMatch[0]),
            node
          );
          node.textContent = textContent.substring(
            macAddressMatch.index + firstMatch[0].length
          );
          continue;
        }

        const formatted = macAddressMatch[0]
          .toUpperCase()
          .replace(/[^A-F\d]/g, "")
          .replace(/(.{2})/g, ":$1")
          .substring(1);
        const macSpan = makeElement(
          "span",
          {
            className: `${constants.EXTENSION_PREFIX}-smart-text-span ${constants.EXTENSION_PREFIX}-smart-text-span-mac-address`,
            [`data-${constants.EXTENSION_PREFIX}-mac-address`]: formatted,
          },
          // prettier-ignore
          `
            <input value="${formatted}" readonly/>
            <span>
              <span class="${constants.EXTENSION_PREFIX}-smart-text-anchor-text">${firstMatch[0]}</span>
              <ul class="${constants.EXTENSION_PREFIX}-smart-text-popup dropdown-menu">
                <li>MAC Address</li>
                <li class="${constants.EXTENSION_PREFIX}-mac-address-oui" style="font-style:italic">Loading OUIs...</li>
                <li>
                  <button class="btn ${constants.EXTENSION_PREFIX}-smart-text-copy">Copy</button>
                </li>
                <li>Search in:</li>
                <li>
                  <ul>
                    <li>
                      <a target="_blank" href="https://netdb.stanford.edu/fs_node_result?${getDisplayOrderForNetDB(["hardware_address", "object", "ip_address", "node_state", "make_and_model", "os", "department", "user"])}&column=Name&direction=ascending&purge=&hardware_address=${formatted}">NetDB</a>
                    </li>
                    <li>
                      <a target="_blank" href="http://day.stanford.edu:9696/manage/dhcplog/check_db?input=${formatted}#ACK">DHCP Log</a>
                    </li>
                    <li>
                      <a target="_blank" href="https://archer.stanford.edu/webacs/welcomeAction.do#pageId=full_search_pageId&query=${encodeURIComponent(formatted)}&forceLoad=true">Cisco Prime</a>
                    </li>
                    <li>
                      <a target="_blank" href="https://mydevices.stanford.edu/group/mydevices?${encodeURIComponent(`${constants.EXTENSION_PREFIX}-search-mac`)}=${encodeURIComponent(formatted)}">MyDevices</a>
                    </li>
                    <li>
                      <a target="_blank" href="https://iprequest.stanford.edu/iprequest/process/search.jsp?ipaddr=&macaddress=${encodeURIComponent(formatted)}&search=0&sort=UPPER%28lastname%29%2C+UPPER%28firstname%29">IPRequest</a>
                    </li>
                  </ul>
                </li>
              </ul>
            </span>
          `
        );

        macSpan.addEventListener("click", (e: MouseEvent) =>
          e.stopPropagation()
        );

        const input = macSpan.firstElementChild as HTMLInputElement;
        const anchorText = macSpan.querySelector<HTMLElement>(
          `.${constants.EXTENSION_PREFIX}-smart-text-anchor-text`
        )!;
        const OUISpan = macSpan.querySelector<HTMLElement>(
          `.${constants.EXTENSION_PREFIX}-mac-address-oui`
        )!;
        OUIsPopulated.then(
          (OUIs) => {
            const OUI = getOUI(OUIs, formatted);
            if (OUI === null) {
              OUISpan.textContent = "Unregistered OUI";
              OUISpan.style.color = "#C00";
              anchorText.style.color = "#C00";
              anchorText.style.fontWeight = "bold";
            } else {
              OUISpan.textContent = `OUI: ${OUI}`;
              OUISpan.style.fontStyle = "initial";
            }
          },
          () => {
            OUISpan.textContent = "Couldn't Load OUIs";
          }
        );

        const copySpan = macSpan.querySelector<HTMLElement>(
          `.${constants.EXTENSION_PREFIX}-smart-text-copy`
        )!;
        copySpan.addEventListener("click", (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            navigator.clipboard.writeText(formatted);
          } catch (e) {
            input.focus();
            if (!document.execCommand("selectAll", false)) {
              input.setSelectionRange(0, input.value.length);
            }
            document.execCommand("copy", false);
          }
        });

        if (node.parentNode) {
          node.parentNode.insertBefore(
            document.createTextNode(
              textContent.substring(0, macAddressMatch.index)
            ),
            node
          );
          node.parentNode.insertBefore(macSpan, node);
          node.textContent = textContent.substring(
            macAddressMatch.index + macAddressMatch[0].length
          );
        }
      } else if (firstMatch === ipAddressMatch) {
        const formatted = firstMatch[2];
        const ipSpan = makeElement(
          "span",
          {
            className: `${constants.EXTENSION_PREFIX}-smart-text-span ${constants.EXTENSION_PREFIX}-smart-text-ip-address`,
            [`data-${constants.EXTENSION_PREFIX}-ip-address`]: formatted,
          },
          // prettier-ignore
          `
            <input value="${formatted}" readonly/>
            <span>
              <span>${firstMatch[2]}</span>
              <ul class="${constants.EXTENSION_PREFIX}-smart-text-popup dropdown-menu">
                <li>IP Address</li>
                <li>
                  <button class="btn ${constants.EXTENSION_PREFIX}-smart-text-copy">Copy</button>
                </li>
                <li>Search in:</li>
                <li>
                  <ul>
                    <li>
                      <a target="_blank" href="https://netdb.stanford.edu/fs_network_result?${getDisplayOrderForNetDB(["object", "address_space", "location", "comment"])}&column=Name&direction=ascending&purge=&address_space=${formatted}">NetDB</a>
                    </li>
                    <li>
                      <a target="_blank" href="https://archer.stanford.edu/webacs/welcomeAction.do#pageId=full_search_pageId&query=${encodeURIComponent(formatted)}&forceLoad=true">Cisco Prime</a>
                    </li>
                    <li>
                      <a target="_blank" href="https://iprequest.stanford.edu/iprequest/process/search.jsp?ipaddr=${encodeURIComponent(formatted)}&macaddress=&search=0&sort=UPPER%28lastname%29%2C+UPPER%28firstname%29">IPRequest</a>
                    </li>
                  </ul>
                </li>
              </ul>
            </span>
          `
        );
        ipSpan.addEventListener("click", (e: MouseEvent) =>
          e.stopPropagation()
        );
        const input = ipSpan.firstElementChild as HTMLInputElement;
        const copySpan = ipSpan.querySelector(
          `.${constants.EXTENSION_PREFIX}-smart-text-copy`
        )!;
        copySpan.addEventListener("click", (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            navigator.clipboard.writeText(formatted);
          } catch (e) {
            input.focus();
            if (!document.execCommand("selectAll", false)) {
              input.setSelectionRange(0, input.value.length);
            }
            document.execCommand("copy", false);
          }
        });
        if (node.parentElement) {
          node.parentElement.insertBefore(
            document.createTextNode(
              textContent.substring(0, firstMatch.index + firstMatch[1].length)
            ),
            node
          );
          node.parentElement.insertBefore(ipSpan, node);
          node.textContent = textContent.substring(
            firstMatch.index + firstMatch[0].length
          );
        }
      } else if (firstMatch === nodeNameMatch) {
        const formatted = firstMatch[1];
        const nodeSpan = makeElement(
          "span",
          {
            className: `${constants.EXTENSION_PREFIX}-smart-text-span ${constants.EXTENSION_PREFIX}-smart-text-node-name`,
            [`data-${constants.EXTENSION_PREFIX}-node-name`]: formatted,
          },
          // prettier-ignore
          `
            <input value="${formatted}" readonly/>
            <span>
              <span>${firstMatch[0]}</span>
              <ul class="${constants.EXTENSION_PREFIX}-smart-text-popup dropdown-menu">
                <li>Node Name</li>
                <li>
                  <button class="btn ${constants.EXTENSION_PREFIX}-smart-text-copy">Copy</button>
                </li>
                <li>Search in:</li>
                <li>
                  <ul>
                    <li>
                      <a target="_blank" href="https://netdb.stanford.edu/node_info?name=${formatted}.stanford.edu">NetDB</a>
                    </li>
                    <li>
                      <a target="_blank" href="https://iprequest.stanford.edu/iprequest/process/search.jsp?ipaddr=&macaddress=&hostname=${encodeURIComponent(formatted)}&search=0&sort=UPPER%28lastname%29%2C+UPPER%28firstname%29">IPRequest</a>
                    </li>
                  </ul>
                </li>
              </ul>
            </span>
          `
        );
        nodeSpan.addEventListener("click", (e: MouseEvent) =>
          e.stopPropagation()
        );
        const input = nodeSpan.firstElementChild as HTMLInputElement;
        const copySpan = nodeSpan.querySelector(
          `.${constants.EXTENSION_PREFIX}-smart-text-copy`
        )!;
        copySpan.addEventListener("click", (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            navigator.clipboard.writeText(formatted);
          } catch (e) {
            input.focus();
            if (!document.execCommand("selectAll", false)) {
              input.setSelectionRange(0, input.value.length);
            }
            document.execCommand("copy", false);
          }
        });
        if (node.parentElement) {
          node.parentElement.insertBefore(
            document.createTextNode(textContent.substring(0, firstMatch.index)),
            node
          );
          node.parentElement.insertBefore(nodeSpan, node);
          node.textContent = textContent.substring(
            firstMatch.index + firstMatch[0].length
          );
        }
      } else if (firstMatch === ticketMatch) {
        const formatted = firstMatch[0];
        const ticketSpan = makeElement(
          "span",
          {
            className: `${constants.EXTENSION_PREFIX}-smart-text-span ${constants.EXTENSION_PREFIX}-smart-text-ticket`,
            [`data-${constants.EXTENSION_PREFIX}-ticket`]: formatted,
          },
          // prettier-ignore
          `
            <input value="${formatted}" readonly/>
            <span>
              <span>${firstMatch[0]}</span>
              <ul class="${constants.EXTENSION_PREFIX}-smart-text-popup dropdown-menu">
                <li>Ticket Number</li>
                <li>
                  <button class="btn ${constants.EXTENSION_PREFIX}-smart-text-copy">Copy</button>
                </li>
                <li>Search in:</li>
                <li>
                  <ul>
                    <li>
                      <a href="https://stanford.service-now.com/text_search_exact_match.do?sysparm_search=${formatted}">ServiceNow</a>
                    </li>
                  </ul>
                </li>
              </ul>
            </span>
          `
        );
        ticketSpan.addEventListener("click", (e: MouseEvent) =>
          e.stopPropagation()
        );
        const input = ticketSpan.firstElementChild as HTMLInputElement;
        const copySpan = ticketSpan.querySelector(
          `.${constants.EXTENSION_PREFIX}-smart-text-copy`
        )!;
        copySpan.addEventListener("click", (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            navigator.clipboard.writeText(formatted);
          } catch (e) {
            input.focus();
            if (!document.execCommand("selectAll", false)) {
              input.setSelectionRange(0, input.value.length);
            }
            document.execCommand("copy", false);
          }
        });
        if (node.parentElement) {
          node.parentElement.insertBefore(
            document.createTextNode(textContent.substring(0, firstMatch.index)),
            node
          );
          node.parentElement.insertBefore(ticketSpan, node);
          node.textContent = textContent.substring(
            firstMatch.index + firstMatch[0].length
          );
        }
      }
    }
  } else if (isElementNode(node) && node.shadowRoot) {
    const root = node.shadowRoot;
    if (
      !root.firstElementChild ||
      !root.firstElementChild.classList.contains(
        `${constants.EXTENSION_PREFIX}-shadow-style`
      )
    ) {
      const stylesheet = makeElement(
        "style",
        {
          className: `${constants.EXTENSION_PREFIX}-shadow-style`,
        },
        stylesAsString
      );
      node.shadowRoot.insertBefore(stylesheet, root.firstChild);
    }
    replaceSmartText(root);
  } else if (isElementNode(node) || isDocumentFragmentNode(node)) {
    // Make `<a>` open in a new tab instead of on the same page. This isn't really "smart text", but
    // it just makes it a lot easier when there are links in tickets.
    try {
      if (
        isInstance(node, HTMLAnchorElement) &&
        new URL(node.href).hostname !== location.hostname
      ) {
        node.target = "_blank";
      }
    } catch {
      /* pass */
    }

    // Iterate through the child nodes in reverse order so that nodes can be added without affecting
    // the ordering.
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      replaceSmartText(node.childNodes[i]);
    }
  }
};

/**
 * Initialize smart text replacement.
 */
const init = (config: ConfigOptions) => {
  if (!config.enabled.servicenow.smart_text) return;

  waitForElements(
    [
      ".sn-widget-textblock-body",
      ".sn-widget-list-table-cell",
      "sn-html-content-wrapper",
    ],
    (comments: HTMLElement[]) => {
      for (const comment of comments) {
        for (
          let node: HTMLElement | null = comment;
          node;
          node = node.parentElement
        ) {
          node.style.overflow = "visible";
          if (isInstance(node, HTMLLIElement)) {
            node.style.display = "inline-block";
            node.style.width = "100%";
          } else if (
            node.classList.contains("h-card-wrapper") &&
            node.classList.contains("activities-form")
          ) {
            break;
          }
        }

        replaceSmartText(comment);
      }
    }
  );

  waitForElements(`.doctype-stream.form-stream`, (streams: HTMLElement[]) => {
    for (const stream of streams) {
      stream.style.overflow = "visible";
    }
  });
};

export default init;
