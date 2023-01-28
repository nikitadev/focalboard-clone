import { exportUserSettingsBlob, importUserSettingsBlob } from "./userSettings";

const NativeApp = {
  settingsBlob: "",
};
let window;

export function importNativeAppSettings() {
  if (typeof NativeApp === "undefined" || !NativeApp.settingsBlob) {
    return;
  }
  const importedKeys = importUserSettingsBlob(NativeApp.settingsBlob);
  const messageType = importedKeys.length
    ? "didImportUserSettings"
    : "didNotImportUserSettings";
  postWebKitMessage({
    type: messageType,
    settingsBlob: exportUserSettingsBlob(),
    keys: importedKeys,
  });
  NativeApp.settingsBlob = null;
}

export function notifySettingsChanged(key) {
  postWebKitMessage({
    type: "didChangeUserSettings",
    settingsBlob: exportUserSettingsBlob(),
    key,
  });
}

function postWebKitMessage(message) {
  window.webkit?.messageHandlers.nativeApp?.postMessage(message);
}
