import { notifySettingsChanged } from "./nativeApp";
import { Utils } from "./utils";

export const UserSettingKey = {
  Language: "language",
  Theme: "theme",
  LastTeamId: "lastTeamId",
  LastBoardId: "lastBoardId",
  LastViewId: "lastViewId",
  EmojiMartSkin: "emoji-mart.skin",
  EmojiMartLast: "emoji-mart.last",
  EmojiMartFrequently: "emoji-mart.frequently",
  RandomIcons: "randomIcons",
  MobileWarningClosed: "mobileWarningClosed",
  WelcomePageViewed: "welcomePageViewed",
  HideCloudMessage: "hideCloudMessage",
  NameFormat: "nameFormat",
};

export class UserSettings {
  getKey(key) {
    return localStorage.getItem(key);
  }

  setKey(key, value) {
    if (!Object.values(UserSettingKey).includes(key)) {
      return;
    }
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
    notifySettingsChanged(key);
  }

  get language() {
    return UserSettings.get(UserSettingKey.Language);
  }

  set language(newValue) {
    UserSettings.set(UserSettingKey.Language, newValue);
  }

  get Theme() {
    return UserSettings.get(UserSettingKey.Theme);
  }

  set Theme(newValue) {
    UserSettings.set(UserSettingKey.Theme, newValue);
  }

  get lastTeamId() {
    return UserSettings.get(UserSettingKey.LastTeamId);
  }

  set lastTeamId(newValue) {
    UserSettings.set(UserSettingKey.LastTeamId, newValue);
  }

  get lastBoardId() {
    let rawData = UserSettings.get(UserSettingKey.LastBoardId) || "{}";
    if (rawData[0] !== "{") {
      rawData = "{}";
    }

    let mapping;
    try {
      mapping = JSON.parse(rawData);
    } catch {
      mapping = {};
    }

    return mapping;
  }

  set lastTeamID(teamID) {
    UserSettings.set(UserSettingKey.LastTeamId, teamID);
  }

  setLastBoardID(teamID, boardID) {
    const data = this.lastBoardId;
    if (boardID === null) {
      delete data[teamID];
    } else {
      data[teamID] = boardID;
    }
    UserSettings.set(UserSettingKey.LastBoardId, JSON.stringify(data));
  }

  get lastViewId() {
    const rawData = UserSettings.get(UserSettingKey.LastViewId) || "{}";
    let mapping;
    try {
      mapping = JSON.parse(rawData);
    } catch {
      mapping = {};
    }

    return mapping;
  }

  setLastViewId(boardID, viewID) {
    const data = this.lastViewId;
    if (viewID === null) {
      delete data[boardID];
    } else {
      data[boardID] = viewID;
    }
    UserSettings.set(UserSettingKey.LastViewId, JSON.stringify(data));
  }

  get prefillRandomIcons() {
    return UserSettings.get(UserSettingKey.RandomIcons) !== "false";
  }

  set prefillRandomIcons(newValue) {
    UserSettings.set(UserSettingKey.RandomIcons, JSON.stringify(newValue));
  }

  getEmojiMartSetting(key) {
    const prefixed = `emoji-mart.${key}`;
    Utils.assert(Object.values(UserSettingKey).includes(prefixed));
    const json = UserSettings.get(prefixed);

    return json ? JSON.parse(json) : null;
  }

  setEmojiMartSetting(key, value) {
    const prefixed = `emoji-mart.${key}`;
    Utils.assert(Object.values(UserSettingKey).includes(prefixed));
    UserSettings.set(prefixed, JSON.stringify(value));
  }

  get mobileWarningClosed() {
    return UserSettings.get(UserSettingKey.MobileWarningClosed) === "true";
  }

  set mobileWarningClosed(newValue) {
    UserSettings.set(UserSettingKey.MobileWarningClosed, String(newValue));
  }

  get hideCloudMessage() {
    return localStorage.getItem(UserSettingKey.HideCloudMessage) === "true";
  }

  set hideCloudMessage(newValue) {
    localStorage.setItem(
      UserSettingKey.HideCloudMessage,
      JSON.stringify(newValue)
    );
  }

  get nameFormat() {
    return UserSettings.get(UserSettingKey.NameFormat);
  }

  set nameFormat(newValue) {
    UserSettings.set(UserSettingKey.NameFormat, newValue);
  }
}

export function exportUserSettingsBlob() {
  return window.btoa(exportUserSettings());
}

function exportUserSettings() {
  const keys = Object.values(UserSettingKey);
  const settings = Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)])
  );
  settings.timestamp = `${Date.now()}`;
  return JSON.stringify(settings);
}

export function importUserSettingsBlob(blob) {
  return importUserSettings(window.atob(blob));
}

function importUserSettings(json) {
  const settings = parseUserSettings(json);
  if (!settings) {
    return [];
  }
  const timestamp = settings.timestamp;
  const lastTimestamp = localStorage.getItem("timestamp");
  if (
    !timestamp ||
    (lastTimestamp && Number(timestamp) <= Number(lastTimestamp))
  ) {
    return [];
  }
  const importedKeys = [];
  for (const [key, value] of Object.entries(settings)) {
    if (Object.values(UserSettingKey).includes(key)) {
      if (value) {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
      importedKeys.push(key);
    }
  }
  return importedKeys;
}

function parseUserSettings(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    return undefined;
  }
}
