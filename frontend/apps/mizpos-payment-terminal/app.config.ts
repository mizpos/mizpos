import { ExpoConfig, ConfigContext } from "expo/config";

const IS_DEV = process.env.APP_ENV === "development";

const getImagePath = (filename: string) => {
  const folder = IS_DEV ? "dev-images" : "images";
  return `./assets/${folder}/${filename}`;
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "mizpos-payment-terminal",
  slug: "mizpos-payment-terminal",
  version: "1.0.0",
  orientation: "portrait",
  icon: getImagePath("icon.png"),
  scheme: "mizpospaymentterminal",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.mizphses.mizpospaymentterminal",
    infoPlist: {
      NSBluetoothAlwaysUsageDescription:
        "決済端末との接続にBluetoothを使用します",
      NSBluetoothPeripheralUsageDescription:
        "決済端末との接続にBluetoothを使用します",
      NSLocationWhenInUseUsageDescription:
        "決済端末の検出に位置情報を使用します",
    },
  },
  android: {
    versionCode: 1,
    minSdkVersion: 26,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: getImagePath("android-icon-foreground.png"),
      backgroundImage: getImagePath("android-icon-background.png"),
      monochromeImage: getImagePath("android-icon-monochrome.png"),
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
    ],
    package: "com.mizphses.mizpospaymentterminal",
  },
  web: {
    output: "static",
    favicon: getImagePath("favicon.png"),
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,
        },
        ios: {
          deploymentTarget: "15.1",
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: getImagePath("icon.png"),
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "QRコードの読み取りにカメラを使用します",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
