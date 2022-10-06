export interface ConfigOptions {
  MARKDOWN: boolean;
  HOVER_TEXT: boolean;
  REPLACEMENTS: boolean;
  MACROS: boolean;
}

const defaultValues: ConfigOptions = {
  MARKDOWN: true,
  HOVER_TEXT: true,
  REPLACEMENTS: true,
  MACROS: true,
};

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
  getAsync<K extends keyof ConfigOptions>(options: K[]): Promise<Pick<ConfigOptions, K>>;
  /**
   * Asynchronously sets the value of a single config option.
   * @param option The option to set.
   * @param value The value to set the option to.
   * @returns A promise resolving to void once the option has been saved.
   */
  setAsync<K extends keyof ConfigOptions>(option: K, value: ConfigOptions[K]): Promise<void>;
  /**
   * Asynchronously sets the values of a subset of the config object.
   * @param partialConfig A subset of the config object, with each key being an option to set and
   *        the corresponding value being the value to set the option to.
   * @returns A promise resolving to void once the options have been saved.
   */
  setAsync(partialConfig: Partial<ConfigOptions>): Promise<void>;
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
  // USe the memoized value if we can.
  if (memo) {
    return memo;
  }

  // Otherwise, fetch it from Chrome.
  memo = (await chrome.storage.sync.get({
    config: defaultValues,
  })).config;
  return memo!;
}

/**
 * An object with `getAsync` and `setAsync` methods for interacting with the config object.
 */
const config: ConfigType = {
    getAsync: async <K extends keyof ConfigOptions>(options?: K | Iterable<K>): Promise<ConfigOptions | ConfigOptions[K] | Pick<ConfigOptions, K>> => {
      const config = await getConfig();
      if (options == null) {
        return config;
      }
      if (typeof options === 'string') {
        return config[options];
      }
      const ret = {} as Pick<ConfigOptions, K>;
      for (const item of options) {
        ret[item] = config[item];
      }
      return ret;
    },
    setAsync: async <K extends keyof ConfigOptions>(option: K | Partial<ConfigOptions>, value?: ConfigOptions[K]): Promise<void> => {
      // Ensure we have `memo` loaded.
      if (!memo) {
        memo = await getConfig();
      }
      if (typeof option === 'string') {
        memo[option] = value!;
      } else {
        Object.assign(memo, option);
      }
      await chrome.storage.sync.set({ config: memo });
    }
}

export const getConfigAsync = config.getAsync;
export const setConfigAsync = config.setAsync;
export default config;
