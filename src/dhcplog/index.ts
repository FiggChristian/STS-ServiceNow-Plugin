import { ConfigOptions } from "../config";
import { isInstance, makeElement } from "../helpers";

let hasInitialized = false;

const init = (config: ConfigOptions) => {
  // Make sure we are at a proper URL
  if (
    location.host !== "day.stanford.edu:9696" ||
    !location.search.startsWith("?input=")
  ) {
    return;
  }

  if (hasInitialized) return;
  hasInitialized = true;
  if (config.enabled.dhcp_log.ip_links) initIPLinking();
  initTypeLinking();
};

const initIPLinking = () => {
  const allPres = document.querySelectorAll("pre");
  if (allPres.length !== 1) return;
  const pre = allPres[0];
  pre.normalize();

  for (const child of Array.from(pre.childNodes)) {
    if (!isInstance(child, Text)) continue;
    let text = child.nodeValue ?? "";
    let match: RegExpMatchArray | null;
    let index: number;
    while ((match = text.match(/\d+\.\d+\.\d+\.\d+/))) {
      const fullMatch = match[0];
      index = text.indexOf(fullMatch);
      pre.insertBefore(
        document.createTextNode(text.substring(0, index)),
        child
      );
      const a = makeElement(
        "a",
        {
          href: `https://netdb.stanford.edu/qsearch?search_string=${fullMatch}&search_type=Networks`,
          target: "_blank",
        },
        fullMatch
      );
      pre.insertBefore(a, child);
      text = text.substring(index + fullMatch.length);
      child.nodeValue = text;
    }
  }
};

const initTypeLinking = () => {
  const allPres = document.querySelectorAll("pre");
  if (allPres.length !== 1) return;
  const pre = allPres[0];
  pre.normalize();

  for (const child of Array.from(pre.childNodes)) {
    if (!isInstance(child, Text)) continue;
    let text = child.nodeValue ?? "";
    let match: RegExpMatchArray | null;
    let index: number;
    while ((match = text.match(/(?:ACK|NAK|DISCOVER|OFFER|REQUEST)(?=:)/))) {
      const fullMatch = match[0];
      index = text.indexOf(fullMatch);
      pre.insertBefore(
        document.createTextNode(text.substring(0, index)),
        child
      );
      const a = makeElement(
        "a",
        {
          href: `#${fullMatch}`,
          id: fullMatch,
        },
        fullMatch
      );
      pre.insertBefore(a, child);
      if (location.hash === `#${fullMatch}`) {
        a.scrollIntoView();
      }
      text = text.substring(index + fullMatch.length);
      child.nodeValue = text;
    }
  }
};

export default init;
