const fs = require("fs");
const path = require("path");

const patches = [
  {
    targetFile: path.join(__dirname, "..", "..", "..", "node_modules", "expo", "android", "build.gradle"),
    transform(original) {
      return original
        .split("useExpoPublishing()").join("")
        .replace(/def nodeModulesVersion = providers\.exec \{[\s\S]*?\}\.standardOutput\.asText\.get\(\)\.trim\(\)/, 'def nodeModulesVersion = safeExtGet("reactNativeVersion", "0.74.5")');
    },
    description: "expo/android/build.gradle"
  },
  {
    targetFile: path.join(__dirname, "..", "..", "..", "node_modules", "expo-dev-launcher", "android", "build.gradle"),
    transform(original) {
      return original.replace(
        /def getNodeModulesPackageVersion\(packageName, overridePropName\) \{[\s\S]*?def version = safeExtGet\(overridePropName, nodeModulesVersion\)/,
        'def getNodeModulesPackageVersion(packageName, overridePropName) {\n  def version = safeExtGet(overridePropName, "0.74.5")'
      );
    },
    description: "expo-dev-launcher/android/build.gradle"
  },
  {
    targetFile: path.join(__dirname, "..", "..", "..", "node_modules", "expo-dev-menu", "android", "build.gradle"),
    transform(original) {
      return original.replace(
        /def getNodeModulesPackageVersion\(packageName, overridePropName\) \{[\s\S]*?def version = safeExtGet\(overridePropName, nodeModulesVersion\)/,
        'def getNodeModulesPackageVersion(packageName, overridePropName) {\n  def version = safeExtGet(overridePropName, "0.74.5")'
      );
    },
    description: "expo-dev-menu/android/build.gradle"
  }
];

for (const patch of patches) {
  if (!fs.existsSync(patch.targetFile)) {
    continue;
  }

  const original = fs.readFileSync(patch.targetFile, "utf8");
  const patched = patch.transform(original);

  if (patched !== original) {
    fs.writeFileSync(patch.targetFile, patched);
    console.log(`Patched ${patch.description}.`);
  }
}
