import { dedent, TextAreaType, withReplacementDelimiters } from "./helpers";
import constants from "./constants.json";
import joinObjects from "./helpers/joinObjects";
import { replacementByTrigger } from "./replacements/data";

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export const defaultValues = {
  signature: dedent(`
    Best,
    ${withReplacementDelimiters("current_user.first_name")}
    Student Technical Support
  `),
  autoCompletes: {
    [TextAreaType.CloseNotes]: dedent(`
      Hi ${withReplacementDelimiters("ticket.requester.first_name")},

      ${withReplacementDelimiters(
        "cursor:Thanks for letting us know the issue was resolved. "
      )}We'll go ahead and close your ticket now. Please feel free to reach out to us if you run into any more issues in the future.

      ${withReplacementDelimiters("current_user.signature")}
    `),
    [TextAreaType.Comments]: dedent(`
      Hi ${withReplacementDelimiters("ticket.requester.first_name")},
      
      ${withReplacementDelimiters("cursor")}

      Please let us know if you have any questions or issues.
      
      ${withReplacementDelimiters("current_user.signature")}
    `),
    [TextAreaType.WorkNotes]: "",
  },
  enabled: {
    servicenow: {
      autocomplete: true,
      macros: true,
      markdown: true,
      smart_text: true,
    },
    netdb: {
      mac_links: true,
      history_highlight: true,
      node_history_links: true,
    },
    dhcp_log: {
      ip_links: true,
    },
  },
};

export type ConfigOptions = typeof defaultValues;

export interface ConfigType {
  /**
   * Asynchronously returns the entire config object.
   * @returns A Promise resolving to the config object.
   */
  getAsync(): Promise<ConfigOptions>;
  /**
   * Asynchronously returns the value of a single config option.
   * @param option The option to retrieve.
   * @returns A promise resolving to the value of the option.
   */
  getAsync<K extends keyof ConfigOptions>(option: K): Promise<ConfigOptions[K]>;
  /**
   * Asynchronously returns a subset of the config object.
   * @param options An iterable of the options to retrieve.
   * @returns A subset of the config object, with only the requested options.
   */
  getAsync<K extends keyof ConfigOptions>(
    options: K[]
  ): Promise<Pick<ConfigOptions, K>>;
  /**
   * Asynchronously sets the value of a single config option.
   * @param option The option to set.
   * @param value The value to set the option to.
   * @returns A promise resolving to void once the option has been saved.
   */
  setAsync<K extends keyof ConfigOptions>(
    option: K,
    value: ConfigOptions[K]
  ): Promise<void>;
  /**
   * Asynchronously sets the values of a subset of the config object.
   * @param partialConfig A subset of the config object, with each key being an option to set and
   *        the corresponding value being the value to set the option to.
   * @returns A promise resolving to void once the options have been saved.
   */
  setAsync(partialConfig: DeepPartial<ConfigOptions>): Promise<void>;
}

/**
 * A memoized version of the config option. It is only fetched once at the beginning and then
 * mutated over time to match the actual config option.
 */
let memo: null | ConfigOptions = null;
/**
 * Asynchronously returns the entire config object.
 * @returns A Promise resolving to the config object.
 */
const getConfig = async (): Promise<ConfigOptions> => {
  // Use the memoized value if we can.
  if (memo) {
    return memo;
  }

  // Otherwise, fetch it from localStorage.
  const stringified = localStorage.getItem(
    `${constants.EXTENSION_PREFIX}-config`
  );
  if (stringified) {
    memo = JSON.parse(stringified);
  } else {
    memo = defaultValues;
  }
  return memo!;
};

window.addEventListener("storage", () => {
  // Update `memo` to match `localStorage`.
  const stringified = localStorage.getItem(
    `${constants.EXTENSION_PREFIX}-config`
  );
  if (!stringified || !memo) return;
  const parsed = JSON.parse(stringified);
  const keys = new Set(Object.keys(parsed));
  for (const key in parsed) {
    if (!keys.has(key)) {
      delete (memo as Record<string, unknown>)[key];
    }
  }
  for (const key in parsed) {
    (memo as Record<string, unknown>)[key] = parsed[key];
  }

  if (
    "current_user.signature" in replacementByTrigger &&
    "value" in replacementByTrigger["current_user.signature"]
  ) {
    replacementByTrigger["current_user.signature"].value = memo.signature;
  }
});

/**
 * An object with `getAsync` and `setAsync` methods for interacting with the config object.
 */
const config: ConfigType = {
  getAsync: async <K extends keyof ConfigOptions>(
    options?: K | Iterable<K>
  ): Promise<ConfigOptions | ConfigOptions[K] | Pick<ConfigOptions, K>> => {
    const config = await getConfig();
    if (options == null) {
      return config;
    }
    if (typeof options === "string") {
      return config[options];
    }
    const ret = {} as Pick<ConfigOptions, K>;
    for (const item of options) {
      ret[item] = config[item];
    }
    return ret;
  },
  setAsync: async <K extends keyof ConfigOptions>(
    option: K | DeepPartial<ConfigOptions>,
    value?: ConfigOptions[K]
  ): Promise<void> => {
    // Ensure we have `memo` loaded.
    if (!memo) {
      memo = await getConfig();
    }

    if (typeof option === "string") {
      memo[option] = value!;
    } else {
      joinObjects(memo, option);
    }
    // await chrome.storage.sync.set({ config: memo });
    localStorage.setItem(
      `${constants.EXTENSION_PREFIX}-config`,
      JSON.stringify(memo)
    );
  },
};

export const getConfigAsync = config.getAsync;
export const setConfigAsync = config.setAsync;
export default config;
