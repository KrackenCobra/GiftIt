// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * `npm run preview` renders the real screens in a browser with sample data, for design review.
 * Only a WEB bundle started with EXPO_PUBLIC_PREVIEW=1 swaps these modules; iOS and Android
 * builds always resolve the real encrypted services.
 */
if (process.env.EXPO_PUBLIC_PREVIEW === '1') {
  const root = __dirname;
  const swaps = {
    [path.join(root, 'App.tsx')]: path.join(root, 'preview/PreviewApp.tsx'),
  };
  for (const name of ['auth', 'circles', 'items', 'plans', 'suggestions', 'wishlist']) {
    swaps[path.join(root, `src/services/${name}.ts`)] = path.join(root, `preview/services/${name}.ts`);
  }
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const res = upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
    if (platform === 'web' && res.type === 'sourceFile' && swaps[res.filePath]) {
      return { type: 'sourceFile', filePath: swaps[res.filePath] };
    }
    return res;
  };
}

module.exports = config;
