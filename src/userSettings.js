import { notifySettingsChanged } from "./nativeApp";
import { Logger } from "./logger";

export const UserSettingKey = {
  Language: "lang",
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
  static get(key) {
    return localStorage.getItem(key);
  }

  static set(key, value) {
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

  static get language() {
    return UserSettings.get(UserSettingKey.Language);
  }

  static set language(newValue) {
    UserSettings.set(UserSettingKey.Language, newValue);
  }

  static get theme() {
    return UserSettings.get(UserSettingKey.Theme);
  }

  static set theme(newValue) {
    UserSettings.set(UserSettingKey.Theme, newValue);
  }

  static get lastTeamId() {
    return UserSettings.get(UserSettingKey.LastTeamId);
  }

  static set lastTeamId(newValue) {
    UserSettings.set(UserSettingKey.LastTeamId, newValue);
  }

  static get lastBoardId() {
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

  /**
   * @param {number} id
   */
  static setLastTeamId(id) {
    UserSettings.set(UserSettingKey.LastTeamId, id);
  }

  static setLastBoardId(teamId, boardId) {
    const data = this.lastBoardId;
    if (boardId === null) {
      delete data[teamId];
    } else {
      data[teamId] = boardId;
    }
    UserSettings.set(UserSettingKey.LastBoardId, JSON.stringify(data));
  }

  static get lastViewId() {
    const rawData = UserSettings.get(UserSettingKey.LastViewId) || "{}";
    let mapping;
    try {
      mapping = JSON.parse(rawData);
    } catch {
      mapping = {};
    }

    return mapping;
  }

  static setLastViewId(boardId, viewId) {
    const data = this.lastViewId;
    if (viewId === null) {
      data[boardId] = undefined;
    } else {
      data[boardId] = viewId;
    }

    UserSettings.set(UserSettingKey.LastViewId, JSON.stringify(data));
  }

  static get prefillRandomIcons() {
    return UserSettings.get(UserSettingKey.RandomIcons) !== "false";
  }

  static set prefillRandomIcons(newValue) {
    UserSettings.set(UserSettingKey.RandomIcons, JSON.stringify(newValue));
  }

  static getEmojiMartSetting(key) {
    const prefixed = `emoji-mart.${key}`;
    Logger.assert(Object.values(UserSettingKey).includes(prefixed));
    const json = UserSettings.get(prefixed);

    return json ? JSON.parse(json) : null;
  }

  static setEmojiMartSetting(key, value) {
    const prefixed = `emoji-mart.${key}`;
    Logger.assert(Object.values(UserSettingKey).includes(prefixed));
    UserSettings.set(prefixed, JSON.stringify(value));
  }

  static get mobileWarningClosed() {
    return UserSettings.get(UserSettingKey.MobileWarningClosed) === "true";
  }

  static set mobileWarningClosed(newValue) {
    UserSettings.set(UserSettingKey.MobileWarningClosed, String(newValue));
  }

  static get hideCloudMessage() {
    return localStorage.getItem(UserSettingKey.HideCloudMessage) === "true";
  }

  static set hideCloudMessage(newValue) {
    localStorage.setItem(
      UserSettingKey.HideCloudMessage,
      JSON.stringify(newValue)
    );
  }

  static get nameFormat() {
    return UserSettings.get(UserSettingKey.NameFormat);
  }

  static set nameFormat(newValue) {
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
