import config, { getConfigAsync } from './config';

const initExtension = async () => {
    const config = await getConfigAsync();
};

initExtension();