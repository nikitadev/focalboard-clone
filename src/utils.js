import { marked } from "marked";
import { i18n } from "@lingui/core";
import moment from "moment";

import { generatePath } from "react-router-dom";

import { createBoard } from "./blocks/board";
import { createBoardView } from "./blocks/boardView";
import { createCard } from "./blocks/card";
import { createCommentBlock } from "./blocks/commentBlock";
import { UserSettings } from "./userSettings";

let window;

const imageURLForUser =
  typeof window === "undefined"
    ? undefined
    : window.Components?.imageURLForUser;
const IconClass = "octo-icon";
const OpenButtonClass = "open-button";
const SpacerClass = "octo-spacer";
const HorizontalGripClass = "HorizontalGrip";
const base32Alphabet = "ybndrfg8ejkmcpqxot1uwisza345h769";

export const SYSTEM_ADMIN_ROLE = "system_admin";
export const TEAM_ADMIN_ROLE = "team_admin";

const IDType = {
  None: "7",
  Workspace: "w",
  Board: "b",
  Card: "c",
  View: "v",
  Session: "s",
  User: "u",
  Token: "k",
  BlockID: "a",
};

export const KeyCodes = {
  ENTER: ["Enter", 13],
  COMPOSING: ["Composing", 229],
};

export const ShowUsername = "username";
export const ShowNicknameFullName = "nickname_full_name";
export const ShowFullName = "full_name";

class Utils {
  static newGuid(idType) {
    const data = Utils.randomArray(16);
    return idType + Utils.base32encode(data, false);
  }

  static blockTypeToIDType(blockType) {
    let ret = IDType.None;
    switch (blockType) {
      case "workspace":
        ret = IDType.Workspace;
        break;
      case "board":
        ret = IDType.Board;
        break;
      case "card":
        ret = IDType.Card;
        break;
      case "view":
        ret = IDType.View;
        break;
      default:
        break;
    }
    return ret;
  }

  static getProfilePicture(userId) {
    const defaultImageUrl =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="fill: rgb(192, 192, 192);"><rect width="100" height="100" /></svg>';

    return imageURLForUser && userId
      ? imageURLForUser(userId)
      : defaultImageUrl;
  }

  static getUserDisplayName(user, configNameFormat) {
    let nameFormat = configNameFormat;
    if (UserSettings.getNameFormat()) {
      nameFormat = UserSettings.getNameFormat();
    }

    let displayName = user.username;

    if (nameFormat === ShowNicknameFullName) {
      if (user.nickname === "") {
        const fullName = Utils.getFullName(user);
        if (fullName !== "") {
          displayName = fullName;
        }
      } else {
        displayName = user.nickname;
      }
    } else if (nameFormat === ShowFullName) {
      const fullName = Utils.getFullName(user);
      if (fullName !== "") {
        displayName = fullName;
      }
    }

    return displayName;
  }

  static getFullName(user) {
    if (user.firstname !== "" && user.lastname !== "") {
      return user.firstname + " " + user.lastname;
    } else if (user.firstname !== "") {
      return user.firstname;
    } else if (user.lastname !== "") {
      return user.lastname;
    }
    return "";
  }

  static randomArray(size) {
    const crypto = window.crypto || window.msCrypto;
    const rands = new Uint8Array(size);
    if (crypto && crypto.getRandomValues) {
      crypto.getRandomValues(rands);
    } else {
      for (let i = 0; i < size; i++) {
        rands[i] = Math.floor(Math.random() * 255);
      }
    }
    return rands;
  }

  static base32encode(data, pad) {
    const dview = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let bits = 0;
    let value = 0;
    let output = "";

    for (let i = 0; i < dview.byteLength; i++) {
      value = (value << 8) | dview.getUint8(i);
      bits += 8;

      while (bits >= 5) {
        output += base32Alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += base32Alphabet[(value << (5 - bits)) & 31];
    }
    if (pad) {
      while (output.length % 8 !== 0) {
        output += "=";
      }
    }
    return output;
  }

  // general purpose (non-secure) hash
  static hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return h;
  }

  static htmlToElement(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();

    return template.content.firstChild;
  }

  static getElementById(elementId) {
    const element = document.getElementById(elementId);
    Utils.assert(element, `getElementById "${elementId}$`);

    return element;
  }

  static htmlEncode(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  static htmlDecode(text) {
    return String(text)
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
  }

  static canvas;
  static getTextWidth(displayText, fontDescriptor) {
    if (displayText !== "") {
      if (!Utils.canvas) {
        Utils.canvas = document.createElement("canvas");
      }
      const context = Utils.canvas.getContext("2d");
      if (context) {
        context.font = fontDescriptor;
        const metrics = context.measureText(displayText);
        return Math.ceil(metrics.width);
      }
    }
    return 0;
  }

  static getFontAndPaddingFromCell = (cell) => {
    const style = getComputedStyle(cell);
    const padding = Utils.getTotalHorizontalPadding(style);

    return Utils.getFontAndPaddingFromChildren(cell.children, padding);
  };

  static getFontAndPaddingFromChildren = (children, pad) => {
    const myResults = {
      fontDescriptor: "",
      padding: pad,
    };
    Array.from(children).forEach((element) => {
      const style = getComputedStyle(element);
      if (element.tagName === "svg") {
        myResults.padding += element.clientWidth;
        myResults.padding += Utils.getHorizontalBorder(style);
        myResults.padding += Utils.getHorizontalMargin(style);
        myResults.fontDescriptor = Utils.getFontString(style);
      } else {
        switch (element.className) {
          case IconClass:
          case HorizontalGripClass:
            myResults.padding += element.clientWidth;
            break;
          case SpacerClass:
          case OpenButtonClass:
            break;
          default: {
            myResults.fontDescriptor = Utils._getFontString(style);
            myResults.padding += Utils._getTotalHorizontalPadding(style);
            const childResults = Utils._getFontAndPaddingFromChildren(
              element.children,
              myResults.padding
            );
            if (childResults.fontDescriptor !== "") {
              myResults.fontDescriptor = childResults.fontDescriptor;
              myResults.padding = childResults.padding;
            }
          }
        }
      }
    });

    return myResults;
  };

  static _getFontString(style) {
    if (style.font) {
      return style.font;
    }
    const {
      fontStyle,
      fontVariant,
      fontWeight,
      fontSize,
      lineHeight,
      fontFamily,
    } = style;
    const props = [fontStyle, fontVariant, fontWeight];
    if (fontSize) {
      props.push(lineHeight ? `${fontSize} / ${lineHeight}` : fontSize);
    }
    props.push(fontFamily);
    return props.join(" ");
  }

  static _getHorizontalMargin(style) {
    return parseInt(style.marginLeft, 10) + parseInt(style.marginRight, 10);
  }

  static getHorizontalBorder(style) {
    return (
      parseInt(style.borderLeftWidth, 10) + parseInt(style.borderRightWidth, 10)
    );
  }

  static getHorizontalPadding(style) {
    return parseInt(style.paddingLeft, 10) + parseInt(style.paddingRight, 10);
  }

  static getTotalHorizontalPadding(style) {
    return (
      Utils.getHorizontalPadding(style) +
      Utils.getHorizontalMargin(style) +
      Utils.getHorizontalBorder(style)
    );
  }

  static htmlFromMarkdown(text) {
    // HACKHACK: Somehow, marked doesn't encode angle brackets
    const renderer = new marked.Renderer();
    renderer.link = (href, title, contents) => {
      return (
        "<a " +
        'target="_blank" ' +
        'rel="noreferrer" ' +
        `href="${encodeURI(decodeURI(href || ""))}" ` +
        `title="${title || ""}" ` +
        `onclick="${
          window.openInNewBrowser
            ? " openInNewBrowser && openInNewBrowser(event.target.href);"
            : ""
        }"` +
        ">" +
        contents +
        "</a>"
      );
    };

    renderer.table = (header, body) => {
      return `<div class="table-responsive"><table class="markdown__table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
    };

    return this.htmlFromMarkdownWithRenderer(text, renderer);
  }

  static htmlFromMarkdownWithRenderer(text, renderer) {
    const html = marked(text.replace(/</g, "&lt;"), { renderer, breaks: true });
    return html.trim();
  }

  static countCheckboxesInMarkdown(text) {
    let total = 0;
    let checked = 0;
    const renderer = new marked.Renderer();
    renderer.checkbox = (isChecked) => {
      ++total;
      if (isChecked) {
        ++checked;
      }
      return "";
    };
    this.htmlFromMarkdownWithRenderer(text, renderer);

    return { total, checked };
  }

  static _yearOption(date) {
    const isCurrentYear = date.getFullYear() === new Date().getFullYear();
    return isCurrentYear ? undefined : "numeric";
  }

  static displayDate(date) {
    return i18n.date(date, {
      year: Utils.yearOption(date),
      month: "long",
      day: "2-digit",
    });
  }

  static inputDate(date) {
    return i18n.formatDate(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  static displayDateTime(date) {
    return i18n.formatDate(date, {
      year: Utils.yearOption(date),
      month: "long",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
    });
  }

  static relativeDisplayDateTime(date) {
    return moment(date).locale(i18n.locale.toLowerCase()).fromNow();
  }

  static sleep(miliseconds) {
    return new Promise((resolve) => setTimeout(resolve, miliseconds));
  }

  // favicon

  static setFavicon(icon) {
    if (Utils.isFocalboardPlugin()) {
      // Do not change the icon from focalboard plugin
      return;
    }

    if (!icon) {
      document.querySelector("link[rel*='icon']")?.remove();
      return;
    }
    const link = document.createElement("link");
    link.type = "image/x-icon";
    link.rel = "shortcut icon";
    link.href = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`;
    document.querySelectorAll("link[rel*='icon']").forEach((n) => n.remove());
    document.getElementsByTagName("head")[0].appendChild(link);
  }

  // URL

  static replaceUrlQueryParam(paramName, value) {
    const queryString = new URLSearchParams(window.location.search);
    const currentValue = queryString.get(paramName) || "";
    if (currentValue !== value) {
      const newUrl = new URL(window.location.toString());
      if (value) {
        newUrl.searchParams.set(paramName, value);
      } else {
        newUrl.searchParams.delete(paramName);
      }
      window.history.pushState({}, document.title, newUrl.toString());
    }
  }

  static ensureProtocol(url) {
    return url.match(/^.+:\/\//) ? url : `https://${url}`;
  }

  // File names

  static sanitizeFilename(filename) {
    // TODO: Use an industrial-strength sanitizer
    let sanitizedFilename = filename;
    const illegalCharacters = [
      "\\",
      "/",
      "?",
      ":",
      "<",
      ">",
      "*",
      "|",
      '"',
      ".",
    ];
    illegalCharacters.forEach((character) => {
      sanitizedFilename = sanitizedFilename.replace(character, "");
    });
    return sanitizedFilename;
  }

  static selectLocalFile(onSelect, accept = ".jpg,.jpeg,.png") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files[0];
      onSelect?.(file);
    };

    input.style.display = "none";
    document.body.appendChild(input);
    input.click();

    // TODO: Remove or reuse input
  }

  static arraysEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (a === null || b === null) {
      return false;
    }
    if (a === undefined || b === undefined) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  static arrayMove(arr, srcIndex, destIndex) {
    arr.splice(destIndex, 0, arr.splice(srcIndex, 1)[0]);
  }

  // Clipboard

  static copyTextToClipboard(text) {
    const textField = document.createElement("textarea");
    textField.innerText = text;
    textField.style.position = "fixed";
    textField.style.opacity = "0";

    document.body.appendChild(textField);
    textField.select();

    let result = false;
    try {
      result = document.execCommand("copy");
    } catch (err) {
      Utils.logError(`copyTextToClipboard ERROR: ${err}`);
      result = false;
    }
    textField.remove();

    return result;
  }

  static isMobile() {
    const toMatch = [
      /Android/i,
      /webOS/i,
      /iPhone/i,
      /iPad/i,
      /iPod/i,
      /BlackBerry/i,
      /Windows Phone/i,
    ];

    return toMatch.some((toMatchItem) => {
      return navigator.userAgent.match(toMatchItem);
    });
  }

  static getBaseURL(absolute) {
    let baseURL = window.baseURL || "";
    baseURL = baseURL.replace(/\/+$/, "");
    if (baseURL.indexOf("/") === 0) {
      baseURL = baseURL.slice(1);
    }
    if (absolute) {
      return window.location.origin + "/" + baseURL;
    }
    return baseURL;
  }

  static getFrontendBaseURL(absolute) {
    let frontendBaseURL = window.frontendBaseURL || Utils.getBaseURL();
    frontendBaseURL = frontendBaseURL.replace(/\/+$/, "");
    if (frontendBaseURL.indexOf("/") === 0) {
      frontendBaseURL = frontendBaseURL.slice(1);
    }
    if (absolute) {
      return window.location.origin + "/" + frontendBaseURL;
    }

    return frontendBaseURL;
  }

  static buildURL(path, absolute) {
    if (!Utils.isFocalboardPlugin() || process.env.TARGET_IS_PRODUCT) {
      return path;
    }

    const baseURL = Utils.getBaseURL();
    let finalPath = baseURL + path;
    if (path.indexOf("/") !== 0) {
      finalPath = baseURL + "/" + path;
    }
    if (absolute) {
      if (finalPath.indexOf("/") === 0) {
        finalPath = finalPath.slice(1);
      }
      return window.location.origin + "/" + finalPath;
    }

    return finalPath;
  }

  static roundTo(num, decimalPlaces) {
    return (
      Math.round(num * Math.pow(10, decimalPlaces)) /
      Math.pow(10, decimalPlaces)
    );
  }

  static isPlugin() {
    return !!window.isPlugin;
  }

  static isLegacy() {
    return window.location.pathname.includes("/plugins/taskmanager");
  }

  static fixWSData(message) {
    if (message.block) {
      return [this.fixBlock(message.block), "block"];
    } else if (message.board) {
      return [this.fixBoard(message.board), "board"];
    } else if (message.category) {
      return [message.category, "category"];
    } else if (message.blockCategories) {
      return [message.blockCategories, "blockCategories"];
    } else if (message.member) {
      return [message.member, "boardMembers"];
    } else if (message.categoryOrder) {
      return [message.categoryOrder, "categoryOrder"];
    }
    return [null, "block"];
  }

  static fixBlock(block) {
    switch (block.type) {
      case "view":
        return createBoardView(block);
      case "card":
        return createCard(block);
      case "comment":
        return createCommentBlock(block);
      default:
        return block;
    }
  }

  static fixBoard(board) {
    return createBoard(board);
  }

  static userAgent() {
    return window.navigator.userAgent;
  }

  static isDesktopApp() {
    return (
      Utils.userAgent().indexOf("Mattermost") !== -1 &&
      Utils.userAgent().indexOf("Electron") !== -1
    );
  }

  static getDesktopVersion() {
    // use if the value window.desktop.version is not set yet
    const regex = /Mattermost\/(\d+\.\d+\.\d+)/gm;
    const match = regex.exec(window.navigator.appVersion)?.[1] || "";
    return match;
  }

  /**
   * Function to check how a version compares to another
   *
   * eg.  versionA = 4.16.0, versionB = 4.17.0 returns  1
   *      versionA = 4.16.1, versionB = 4.16.1 returns  0
   *      versionA = 4.16.1, versionB = 4.15.0 returns -1
   */
  static compareVersions(versionA, versionB) {
    if (versionA === versionB) {
      return 0;
    }

    // We only care about the numbers
    const versionANumber = (versionA || "")
      .split(".")
      .filter((x) => /^[0-9]+$/.exec(x) !== null);
    const versionBNumber = (versionB || "")
      .split(".")
      .filter((x) => /^[0-9]+$/.exec(x) !== null);

    for (
      let i = 0;
      i < Math.max(versionANumber.length, versionBNumber.length);
      i++
    ) {
      const a = parseInt(versionANumber[i], 10) || 0;
      const b = parseInt(versionBNumber[i], 10) || 0;
      if (a > b) {
        return -1;
      }

      if (a < b) {
        return 1;
      }
    }

    // If all components are equal, then return true
    return 0;
  }

  static isDesktop() {
    return (
      Utils.isDesktopApp() &&
      Utils.compareVersions(Utils.getDesktopVersion(), "5.0.0") <= 0
    );
  }

  static getReadToken() {
    const queryString = new URLSearchParams(window.location.search);
    const readToken = queryString.get("r") || "";

    return readToken;
  }

  static generateClassName(conditions) {
    return Object.entries(conditions)
      .map(([className, condition]) => (condition ? className : ""))
      .filter((className) => className !== "")
      .join(" ");
  }

  static buildOriginalPath(
    teamID = "",
    boardId = "",
    viewId = "",
    cardId = ""
  ) {
    let originalPath = "";

    if (teamID) {
      originalPath += `${teamID}/`;
    }

    if (boardId) {
      originalPath += `${boardId}/`;
    }

    if (viewId) {
      originalPath += `${viewId}/`;
    }

    if (cardId) {
      originalPath += `${cardId}/`;
    }

    return originalPath;
  }

  static uuid() {
    return window.URL.createObjectURL(new Blob([])).substr(-36);
  }

  static isKeyPressed(event, key) {
    // There are two types of keyboards
    // 1. English with different layouts(Ex: Dvorak)
    // 2. Different language keyboards(Ex: Russian)
    if (event.keyCode === KeyCodes.COMPOSING[1]) {
      return false;
    }

    // checks for event.key for older browsers and also for the case of different English layout keyboards.
    if (
      typeof event.key !== "undefined" &&
      event.key !== "Unidentified" &&
      event.key !== "Dead"
    ) {
      const isPressedByCode =
        event.key === key[0] || event.key === key[0].toUpperCase();
      if (isPressedByCode) {
        return true;
      }
    }

    // used for different language keyboards to detect the position of keys
    return event.keyCode === key[1];
  }

  static isMac() {
    return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  }

  static cmdOrCtrlPressed(e, allowAlt = false) {
    if (allowAlt) {
      return (Utils.isMac() && e.metaKey) || (!Utils.isMac() && e.ctrlKey);
    }

    return (
      (Utils.isMac() && e.metaKey) || (!Utils.isMac() && e.ctrlKey && !e.altKey)
    );
  }

  static getBoardPagePath(currentPath) {
    if (currentPath === "/team/:teamId/new/:channelId") {
      return "/team/:teamId/:boardId?/:viewId?/:cardId?";
    }
    return currentPath;
  }

  static showBoard(boardId, match, history) {
    // if the same board, reuse the match params
    // otherwise remove viewId and cardId, results in first view being selected
    const params = { ...match.params, boardId: boardId || "" };
    if (boardId !== match.params.boardId) {
      params.viewId = undefined;
      params.cardId = undefined;
    }
    const newPath = generatePath(Utils.getBoardPagePath(match.path), params);
    history.push(newPath);
  }

  static humanFileSize(bytesParam, si = false, dp = 1) {
    let bytes = bytesParam;
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
      return bytes + " B";
    }

    const units = si
      ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
      : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
    let u = -1;
    const r = 10 ** dp;

    do {
      bytes /= thresh;
      ++u;
    } while (
      Math.round(Math.abs(bytes) * r) / r >= thresh &&
      u < units.length - 1
    );

    return bytes.toFixed(dp) + " " + units[u];
  }

  static spaceSeparatedStringIncludes(item, spaceSeparated) {
    if (spaceSeparated) {
      const items = spaceSeparated?.split(" ");
      return items.includes(item);
    }

    return false;
  }

  static isSystemAdmin(roles) {
    return Utils.spaceSeparatedStringIncludes(SYSTEM_ADMIN_ROLE, roles);
  }

  static isTeamAdmin(roles) {
    return Utils.spaceSeparatedStringIncludes(TEAM_ADMIN_ROLE, roles);
  }

  static isAdmin(roles) {
    return Utils.isSystemAdmin(roles) || Utils.isTeamAdmin(roles);
  }
}

export { Utils, IDType };
