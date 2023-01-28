import messages_en from "../locales/en.json";
import messages_ru from "../locales/ru.json";

import { UserSettings } from "../userSettings";

const supportedLanguages = [
  "ca",
  "de",
  "el",
  "en",
  "es",
  "fr",
  "id",
  "it",
  "ja",
  "nl",
  "oc",
  "pt-br",
  "ru",
  "sv",
  "tr",
  "zh-cn",
  "zh-tw",
];

export function getMessages(lang) {
  switch (lang) {
    case "ru":
      return messages_ru;
    default:
      return messages_en;
  }
}
export function getCurrentLanguage() {
  let lang = UserSettings.language;
  if (!lang) {
    if (supportedLanguages.includes(navigator.language)) {
      lang = navigator.language;
    } else if (
      supportedLanguages.includes(navigator.language.split(/[-_]/)[0])
    ) {
      lang = navigator.language.split(/[-_]/)[0];
    } else {
      lang = "en";
    }
  }
  return lang;
}

export function storeLanguage(lang) {
  UserSettings.language = lang;
}
