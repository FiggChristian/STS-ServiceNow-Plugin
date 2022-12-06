import { ConfigOptions, getConfigAsync } from "./config";
import initMarkdown from "./markdown";
import initAutoComplete from "./autocomplete";
import initReplacements from "./replacements";
import initMacros from "./macros";
import initSmartText from "./smarttext";
import initMyDevices from "./mydevices";
import initSettingsInjector from "./settings/injector";
import initNetDB from "./netdb";
import initDHCPLog from "./dhcplog";
import initSettings from "./settings";
import { replacementByTrigger, replacements } from "./replacements/data";
import wait from "./helpers/wait";
import constants from "./constants.json";

/**
 * A Promise that resolves when the window has loaded.
 * @returns A Promise that resolves when the window has loaded.
 */
const windowHasLoaded = new Promise<void>((resolve) => {
  // Resolve right away if the document is already loaded.
  if (window.document.readyState === "complete") {
    resolve();
  }

  // Otherwise, wait for window.onload, or 200 ms, whichever comes first.
  window.addEventListener("load", () => {
    resolve();
  });
  wait(200).then(resolve);
});

const initServiceNowExtension = async (config: ConfigOptions) => {
  // Add additional replacements from the config object.
  const signatureReplacement = {
    triggers: ["current_user.signature"],
    value: config.signature,
    description: "Your signature for the end of tickets",
  };
  replacements.push(signatureReplacement);
  replacementByTrigger["current_user.signature"] = signatureReplacement;

  // Check whether this is a custom page.
  const path = location.pathname.substring(1).split("/");
  if (path[0] === constants.EXTENSION_PREFIX) {
    if (path[1].startsWith("settings")) {
      initSettings(config);
      return;
    }
  }

  initMarkdown(config);
  initAutoComplete(config);
  initReplacements(config);
  initMacros(config);
  initSmartText(config);
  initSettingsInjector(config);
};

const initExtension = async () => {
  const [config] = await Promise.all([getConfigAsync(), windowHasLoaded]);

  if (location.hostname === "mydevices.stanford.edu") {
    initMyDevices(config);
  } else if (location.hostname === "netdb.stanford.edu") {
    initNetDB(config);
  } else if (location.hostname === "day.stanford.edu") {
    initDHCPLog(config);
  } else if (location.hostname === "stanford.service-now.com") {
    await initServiceNowExtension(config);
  }
};

initExtension();
