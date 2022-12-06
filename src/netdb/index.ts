import { ConfigOptions } from "../config";
import { isInstance, makeElement } from "../helpers";

/**
 * A regex that matches any characters that are not hex digits (lowercase only).
 */
const NON_HEX_REGEX = /[^a-f\d]/g;

let hasInitialized = false;

const init = (config: ConfigOptions) => {
  if (hasInitialized) return;
  hasInitialized = true;

  if (config.enabled.netdb.mac_links) initMacLinks();
  if (config.enabled.netdb.node_history_links) initNodeHistoryLinks();
  if (config.enabled.netdb.history_highlight) initHistoryHighlight();
  initIPFiltering();
};

/**
 * Adds a "DHCP Log" link next to each MAC address that takes the user to the DHCP log for that
 * address.
 */
const initMacLinks = () => {
  for (const td of Array.from(document.querySelectorAll("td"))) {
    if (td.innerText.trim() !== "Hardware\u00a0Address") continue;
    const container = td.nextElementSibling?.nextElementSibling;
    const address = container?.firstElementChild;
    if (
      !isInstance(container, HTMLElement) ||
      !isInstance(address, HTMLElement)
    ) {
      continue;
    }
    const link = makeElement(
      "a",
      {
        href: `http://day.stanford.edu:9696/manage/dhcplog/check_db?input=${address.innerText}#ACK`,
        target: "_blank",
      },
      "DHCP Log"
    );
    container.insertBefore(link, address.nextSibling);
    container.insertBefore(document.createTextNode(" "), link);
  }
};

/**
 * This highlights the MAC address that was searched for. NetDB usually includes a history in its
 * URL that lets us determine which MAC address was searched for, and highlight it on the node page.
 */
const initHistoryHighlight = () => {
  // Highlight the MAC address the user searched for, if any.
  for (const [key, value] of new URLSearchParams(location.search)) {
    if (key === "history") {
      let prevURL: URL;
      try {
        prevURL = new URL(
          decodeURIComponent(value),
          "https://netdb.stanford.edu"
        );
      } catch (e) {
        continue;
      }
      const isQuickSearch = prevURL.pathname === "/qsearch";
      const isFullSearch = prevURL.pathname === "/fs_node_result";

      let mac = "";
      for (const [innerKey, innerValue] of new URLSearchParams(
        prevURL.search
      )) {
        if (isFullSearch && innerKey === "hardware_address")
          mac = decodeURIComponent(innerValue)
            .toLowerCase()
            .replace(NON_HEX_REGEX, "");
        if (isQuickSearch && innerKey === "search_string")
          mac = decodeURIComponent(innerValue)
            .toLowerCase()
            .replace(NON_HEX_REGEX, "");
        if (mac) break;
      }

      if (!mac || mac.length !== 12) break;

      for (const td of Array.from(document.querySelectorAll("td"))) {
        if (td.innerText.trim() === "Hardware\u00A0Address") {
          const container = td.nextElementSibling?.nextElementSibling;
          const address = container?.firstElementChild;
          if (!isInstance(address, HTMLElement)) continue;
          if (
            address.innerText.toLowerCase().replace(NON_HEX_REGEX, "") === mac
          ) {
            address.style.backgroundColor = "yellow";
          }
        }
      }
    }
  }
};

/**
 * Adds a "Node History" link to NetDB nodes that lets the user view a node's history.
 */
const initNodeHistoryLinks = () => {
  for (const td of Array.from(document.querySelectorAll("td"))) {
    if (td.innerText.trim() !== "Record ID") continue;
    const container = td.nextElementSibling?.nextElementSibling;
    const id = container?.firstElementChild;
    if (!isInstance(container, HTMLElement) || !isInstance(id, HTMLElement)) {
      continue;
    }
    const link = makeElement(
      "a",
      {
        href: `https://netdb.stanford.edu/fs_log_result?display_order.date_of_action=1&display_order.record_name=2&display_order.ip_address=3&display_order.node_state=4&record_type=node&display_order.user=5&display_order.logaction=6&logaction=delete&logaction=update&logaction=insert&direction=descending&record_id=${id.innerText}`,
        target: "_blank",
      },
      "Node History"
    );
    container.insertBefore(link, id.nextSibling);
    container.insertBefore(document.createTextNode(" "), link);
  }
};

/**
 * Hides IP addresses on the Network page since they take up a TON of space and are pretty much
 * useless. This will hide them behind a toggle so that the user can still see if they want, while
 * making it easier to scroll through the page.
 */
const initIPFiltering = () => {
  for (const tr of Array.from(
    document.querySelector("table.table tr[bgcolor] + tr tbody")?.children ?? []
  )) {
    const child = tr.firstElementChild;
    if (!isInstance(child, HTMLElement)) continue;
    if (tr.children.length === 1 && child.getAttribute("colspan") === "3") {
      tr.classList.add("divider");
    } else if (child.innerText === "Dynamic DHCP Addresses") {
      tr.classList.add("addresses");
      const td = makeElement("td", { colspan: "2" });
      const label = makeElement(
        "label",
        { style: "margin-top: initial;" },
        "<span>Show</span> <input type='checkbox' style='height:initial;width:initial;clip-path:initial;position:relative'>"
      );
      const table = makeElement("table", { style: "display: none;" });

      label.addEventListener("change", () => {
        const value = (label.lastElementChild as HTMLInputElement).checked;
        if (value) {
          table.style.display = "";
          (label.firstElementChild as HTMLSpanElement).innerText = "Hide";
        } else {
          table.style.display = "none";
          (label.firstElementChild as HTMLSpanElement).innerText = "Show";
        }
      });

      table.appendChild(tr.lastElementChild!);

      td.appendChild(label);
      td.appendChild(table);
      tr.appendChild(td);
    }
  }
};

export default init;
