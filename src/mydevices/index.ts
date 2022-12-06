import { ConfigOptions } from "../config";
import constants from "../constants.json";

const init = (config: ConfigOptions) => {
  const pairs = location.search.substring(1).split("&");
  for (const pair of pairs) {
    let key, val;
    try {
      [key, val] = pair.split("=");
      // Only look for "[CSS_PREFIX]-search-mac=[MAC Address]"
      if (
        decodeURIComponent(key) === `${constants.EXTENSION_PREFIX}-search-mac`
      ) {
        val = decodeURIComponent(val);
      } else continue;
    } catch (e) {
      continue;
    }
    // We found a MAC address to search for in the URL. Now we have to get the search form.
    const searchForm = document.querySelector<HTMLFormElement>(
      "form.mais-universal-search.search-form.navbar-search"
    );
    if (!searchForm) break;
    // We can extract the authentication token from its action attribute.
    const match = searchForm.action.match(/p_auth=([^&=]+)/);
    if (!match) break;
    const authToken = match[1];
    // Now that we have the auth token, we can perform the search by navigating straight to
    // the correct endpoint.
    location.replace(
      `https://mydevices.stanford.edu/group/mydevices/m?p_p_id=mydevicesportlet_WAR_maismydevicesportlet&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&_mydevicesportlet_WAR_maismydevicesportlet_action=deviceSearch&p_auth=${authToken}&_mydevicesportlet_WAR_maismydevicesportlet_searchInput=${encodeURIComponent(
        val
      )}`
    );
    break;
  }
};

export default init;
