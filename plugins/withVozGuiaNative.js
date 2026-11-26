const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainApplication } = require('expo/config-plugins');

const NATIVE_FILES = [
  'VozGuiaPackage.java',
  path.join('mesh', 'VozGuiaMeshModule.java'),
  path.join('speech', 'VozGuiaSpeechModule.java'),
];

function copyNativeModules(projectRoot, androidPlatformRoot) {
  const srcRoot = path.join(projectRoot, 'native', 'android');
  const dstRoot = path.join(
    androidPlatformRoot,
    'app',
    'src',
    'main',
    'java',
    'com',
    'deepcode',
    'vozguia'
  );

  for (const relPath of NATIVE_FILES) {
    const src = path.join(srcRoot, relPath);
    const dst = path.join(dstRoot, relPath);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function withVozGuiaNative(config) {
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      copyNativeModules(
        modConfig.modRequest.projectRoot,
        modConfig.modRequest.platformProjectRoot
      );
      return modConfig;
    },
  ]);

  config = withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('VozGuiaPackage()')) {
      const anchor = 'PackageList(this).packages.apply {';
      if (contents.includes(anchor)) {
        contents = contents.replace(
          anchor,
          `${anchor}\n              add(VozGuiaPackage())`
        );
      }
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });

  return config;
}

module.exports = withVozGuiaNative;
