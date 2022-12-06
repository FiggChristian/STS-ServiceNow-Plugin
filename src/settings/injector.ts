import constants from "../constants.json";
import { ConfigOptions } from "../config";
import { makeElement, waitForElements } from "../helpers";

const init = (config: ConfigOptions) => {
  waitForElements(
    "#settings_modal .settings-tabs .sn-widget-list_v2",
    (lists: HTMLElement[]) => {
      for (const list of lists) {
        list.appendChild(
          makeElement(
            "a",
            {
              href: `/${constants.EXTENSION_PREFIX}/settings`,
              target: "_blank",
              role: "tab",
              className: "sn-widget-list-item ng-scope",
              tabIndex: "-1",
              "aria-selected": "false",
            },
            // prettier-ignore
            `
              <div aria-hidden="true" class="sn-widget-list-content sn-widget-list-content_static">
                <div class="sn-widget-list-image icon-open-document-new-tab"></div>
              </div>
              <div class="sn-widget-list-content">
                <span class="sn-widget-list-title ng-binding">Plugin Settings</span>
              </div>
            `
          )
        );
      }
    }
  );
};

export default init;
