// This APK is a standalone demo signed with Expo's bundled test keystore.
// No personal signing credentials are created or uploaded.
const fs = require('node:fs');
const path = require('node:path');
const versionCode = Number(process.env.MOONLINE_VERSION_CODE);
if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
  throw new Error('Invalid Android version code');
}
const file = path.join(__dirname, '../android/app/build.gradle');
const source = fs.readFileSync(file, 'utf8');
if (!/versionCode \d+/.test(source)) throw new Error('Expo version configuration changed');
fs.writeFileSync(file, source.replace(/versionCode \d+/, `versionCode ${versionCode}`));
console.log(`Configured standalone demo APK, versionCode ${versionCode}`);
