import { DbUtils } from "./dbUtils";
import { Utils } from "./utils";
import { Logger } from "./logger";
import { UserSettings } from "./userSettings";
import { Constants } from "./constants";

class DbClient {
  logged = false;

  getBaseURL() {
    const baseURL = (this.serverUrl || Utils.getBaseURL(true)).replace(
      /\/$/,
      ""
    );

    // Logging this for debugging.
    // Logging just once to avoid log noise.
    if (!this.logged) {
      Logger.log(`DbClient baseURL: ${baseURL}`);
      this.logged = true;
    }

    return baseURL;
  }

  get token() {
    return localStorage.getItem("focalboardSessionId") || "";
  }
  set token(value) {
    localStorage.setItem("focalboardSessionId", value);
  }

  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }

  async getJson(response, defaultValue) {
    // The server may return null or malformed json
    try {
      const value = await response.json();
      return value || defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async login(username, password) {
    const path = "/api/v2/login";
    const body = JSON.stringify({ username, password, type: "normal" });
    const response = await fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
      body,
    });
    if (response.status !== 200) {
      return false;
    }

    const responseJson = await this.getJson(response, {});
    if (responseJson.token) {
      localStorage.setItem("focalboardSessionId", responseJson.token);
      return true;
    }

    return false;
  }

  async logout() {
    const path = "/api/v2/logout";
    const response = await fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
    });
    localStorage.removeItem("focalboardSessionId");

    if (response.status !== 200) {
      return false;
    }
    return true;
  }

  async getClientConfig() {
    const path = "/api/v2/clientConfig";
    const response = await fetch(this.getBaseURL() + path, {
      method: "GET",
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return null;
    }

    const json = await this.getJson(response, {});
    return json;
  }

  async register(email, username, password, token) {
    const path = "/api/v2/register";
    const body = JSON.stringify({ email, username, password, token });
    const response = await fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
      body,
    });
    const json = await this.getJson(response, {});
    return { code: response.status, json };
  }

  async changePassword(userId, oldPassword, newPassword) {
    const path = `/api/v2/users/${encodeURIComponent(userId)}/changepassword`;
    const body = JSON.stringify({ oldPassword, newPassword });
    const response = await fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
      body,
    });
    const json = await this.getJson(response, {});
    return { code: response.status, json };
  }

  #headers() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: this.token ? `Bearer ${this.token}` : "",
      "X-Requested-With": "XMLHttpRequest",
    };
  }

  #teamPath(teamId) {
    let teamIdToUse = teamId;
    if (!teamId) {
      teamIdToUse =
        this.teamId === Constants.globalTeamId
          ? UserSettings.lastTeamId || this.teamId
          : this.teamId;
    }

    return `/api/v2/teams/${teamIdToUse}`;
  }

  #teamsPath() {
    return "/api/v2/teams";
  }

  async getPerson() {
    const path = "/api/v2/users/me";
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return undefined;
    }
    const user = await this.getJson(response, {});
    return user;
  }

  async getMyBoardMemberships() {
    const path = "/api/v2/users/me/memberships";
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return [];
    }
    const members = await this.getJson(response, []);
    return members;
  }

  async getUser(userId) {
    const path = `/api/v2/users/${encodeURIComponent(userId)}`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return undefined;
    }
    const user = await this.getJson(response, {});
    return user;
  }

  async getUsersList(userIds) {
    const path = "/api/v2/users";
    const body = JSON.stringify(userIds);
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
      method: "POST",
      body,
    });

    if (response.status !== 200) {
      return [];
    }

    return await this.getJson(response, []);
  }

  async getConfig() {
    const path = "/api/v2/users/me/config";
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
      method: "GET",
    });

    if (response.status !== 200) {
      return undefined;
    }

    return await this.getJson(response, []);
  }

  async patchUserConfig(userId, patch) {
    const path = `/api/v2/users/${encodeURIComponent(userId)}/config`;
    const body = JSON.stringify(patch);
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
      method: "PUT",
      body,
    });

    if (response.status !== 200) {
      return undefined;
    }

    return await this.getJson(response, {});
  }

  async exportBoardArchive(boardID) {
    const path = `/api/v2/boards/${boardID}/archive/export`;
    return fetch(this.getBaseURL() + path, { headers: this.#headers() });
  }

  async exportFullArchive(teamID) {
    const path = `/api/v2/teams/${teamID}/archive/export`;
    return fetch(this.getBaseURL() + path, { headers: this.#headers() });
  }

  async importAllArchiveToFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const headers = this.#headers();

    // TIPTIP: Leave out Content-Type here, it will be automatically set by the browser
    delete headers["Content-Type"];

    return fetch(`${this.getBaseURL()}${this.#teamPath()}/archive/import`, {
      method: "POST",
      headers,
      body: formData,
    });
  }

  async getBlocksWithParent(parentId, type) {
    let path;
    if (type) {
      path = `${this.#teamPath()}/blocks?parent_id=${encodeURIComponent(
        parentId
      )}&type=${encodeURIComponent(type)}`;
    } else {
      path = `${this.#teamPath()}/blocks?parent_id=${encodeURIComponent(
        parentId
      )}`;
    }
    return this.#getBlocksWithPath(path);
  }

  async getBlocksWithType(type) {
    const path = `${this.#teamPath()}/blocks?type=${encodeURIComponent(type)}`;
    return this.#getBlocksWithPath(path);
  }

  async getBlocksWithBlockID(blockID, boardID, optionalReadToken) {
    let path = `/api/v2/boards/${boardID}/blocks?block_id=${blockID}`;
    const readToken = optionalReadToken || Utils.getReadToken();
    if (readToken) {
      path += `&read_token=${readToken}`;
    }
    return this.#getBlocksWithPath(path);
  }

  async getAllBlocks(boardID) {
    let path = `/api/v2/boards/${boardID}/blocks?all=true`;
    const readToken = Utils.getReadToken();
    if (readToken) {
      path += `&read_token=${readToken}`;
    }
    return this.#getBlocksWithPath(path);
  }

  async #getBlocksWithPath(path) {
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return [];
    }
    const blocks = await this.getJson(response, []);
    return this.fixBlocks(blocks);
  }

  async #getBoardsWithPath(path) {
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return [];
    }
    const boards = await this.getJson(response, []);
    return boards;
  }

  async #getBoardMembersWithPath(path) {
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return [];
    }
    const boardMembers = await this.getJson(response, []);
    return boardMembers;
  }

  fixBlocks(blocks) {
    if (!blocks) {
      return [];
    }

    const fixedBlocks = DbUtils.hydrateBlocks(blocks);

    return fixedBlocks;
  }

  async patchBlock(boardId, blockId, blockPatch) {
    Logger.log(`patchBlock: ${blockId} block`);
    const body = JSON.stringify(blockPatch);
    return fetch(
      `${this.getBaseURL()}/api/v2/boards/${boardId}/blocks/${blockId}`,
      {
        method: "PATCH",
        headers: this.#headers(),
        body,
      }
    );
  }

  async patchBlocks(blocks, blockPatches) {
    Logger.log(`patchBlocks: ${blocks.length} blocks`);
    const blockIds = blocks.map((block) => block.id);
    const body = JSON.stringify({
      block_ids: blockIds,
      block_patches: blockPatches,
    });

    const path = `${this.getBaseURL()}${this.#teamPath()}/blocks`;
    const response = fetch(path, {
      method: "PATCH",
      headers: this.#headers(),
      body,
    });
    return response;
  }

  async deleteBlock(boardId, blockId) {
    Logger.log(`deleteBlock: ${blockId} on board ${boardId}`);

    return fetch(
      `${this.getBaseURL()}/api/v2/boards/${boardId}/blocks/${encodeURIComponent(
        blockId
      )}`,
      {
        method: "DELETE",
        headers: this.#headers(),
      }
    );
  }

  async undeleteBlock(boardId, blockId) {
    Logger.log(`undeleteBlock: ${blockId}`);

    return fetch(
      `${this.getBaseURL()}/api/v2/boards/${encodeURIComponent(
        boardId
      )}/blocks/${encodeURIComponent(blockId)}/undelete`,
      {
        method: "POST",
        headers: this.#headers(),
      }
    );
  }

  async undeleteBoard(boardId) {
    Logger.log(`undeleteBoard: ${boardId}`);
    return fetch(`${this.getBaseURL()}/api/v2/boards/${boardId}/undelete`, {
      method: "POST",
      headers: this.#headers(),
    });
  }

  async followBlock(blockId, blockType, userId) {
    const body = {
      blockType,
      blockId,
      subscriberType: "user",
      subscriberId: userId,
    };

    return fetch(`${this.getBaseURL()}/api/v2/subscriptions`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify(body),
    });
  }

  async unfollowBlock(blockId, userId) {
    return fetch(
      `${this.getBaseURL()}/api/v2/subscriptions/${blockId}/${userId}`,
      {
        method: "DELETE",
        headers: this.#headers(),
      }
    );
  }

  async insertBlock(boardId, block) {
    return this.insertBlocks(boardId, [block]);
  }

  async insertBlocks(boardId, blocks, sourceBoardID) {
    Logger.log(`insertBlocks: ${blocks.length} blocks(s) on board ${boardId}`);
    blocks.forEach((block) => {
      Logger.log(
        `\t ${block.type}, ${block.id}, ${block.title?.substr(0, 50) || ""}`
      );
    });
    const body = JSON.stringify(blocks);

    return fetch(
      `${this.getBaseURL()}/api/v2/boards/${boardId}/blocks` +
        (sourceBoardID
          ? `?sourceBoardID=${encodeURIComponent(sourceBoardID)}`
          : ""),
      {
        method: "POST",
        headers: this.#headers(),
        body,
      }
    );
  }

  async createBoardsAndBlocks(bab) {
    Logger.log(
      `createBoardsAndBlocks: ${bab.boards.length} board(s) ${bab.blocks.length} block(s)`
    );
    bab.boards.forEach((board) => {
      Logger.log(
        `\t Board ${board.id}, ${board.type}, ${
          board.title?.substr(0, 50) || ""
        }`
      );
    });
    bab.blocks.forEach((block) => {
      Logger.log(
        `\t Block ${block.id}, ${block.type}, ${
          block.title?.substr(0, 50) || ""
        }`
      );
    });

    const body = JSON.stringify(bab);
    return fetch(`${this.getBaseURL()}/api/v2/boards-and-blocks`, {
      method: "POST",
      headers: this.#headers(),
      body,
    });
  }

  async deleteBoardsAndBlocks(boardIds, blockIds) {
    Logger.log(
      `deleteBoardsAndBlocks: ${boardIds.length} board(s) ${blockIds.length} block(s)`
    );
    Logger.log(`\t Boards ${boardIds.join(", ")}`);
    Logger.log(`\t Blocks ${blockIds.join(", ")}`);

    const body = JSON.stringify({ boards: boardIds, blocks: blockIds });

    return fetch(`${this.getBaseURL()}/api/v2/boards-and-blocks`, {
      method: "DELETE",
      headers: this.#headers(),
      body,
    });
  }

  // BoardMember
  async createBoardMember(member) {
    Logger.log(
      `createBoardMember: user ${member.userId} and board ${member.boardId}`
    );

    const body = JSON.stringify(member);
    const response = await fetch(
      this.getBaseURL() + `/api/v2/boards/${member.boardId}/members`,
      {
        method: "POST",
        headers: this.#headers(),
        body,
      }
    );

    if (response.status !== 200) {
      return undefined;
    }

    return this.getJson(response, {});
  }

  async joinBoard(boardId) {
    Logger.log(`joinBoard: board ${boardId}`);

    const response = await fetch(
      `${this.getBaseURL()}/api/v2/boards/${boardId}/join`,
      {
        method: "POST",
        headers: this.#headers(),
      }
    );

    if (response.status !== 200) {
      return undefined;
    }

    return this.getJson(response, {});
  }

  async updateBoardMember(member) {
    Logger.log(
      `udpateBoardMember: user ${member.userId} and board ${member.boardId}`
    );

    const body = JSON.stringify(member);
    return fetch(
      this.getBaseURL() +
        `/api/v2/boards/${member.boardId}/members/${member.userId}`,
      {
        method: "PUT",
        headers: this.#headers(),
        body,
      }
    );
  }

  async deleteBoardMember(member) {
    Logger.log(
      `deleteBoardMember: user ${member.userId} and board ${member.boardId}`
    );

    return fetch(
      this.getBaseURL() +
        `/api/v2/boards/${member.boardId}/members/${member.userId}`,
      {
        method: "DELETE",
        headers: this.#headers(),
      }
    );
  }

  async patchBoardsAndBlocks(babp) {
    Logger.log(
      `patchBoardsAndBlocks: ${babp.boardIDs.length} board(s) ${babp.blockIDs.length} block(s)`
    );
    Logger.log(`\t Board ${babp.boardIDs.join(", ")}`);
    Logger.log(`\t Blocks ${babp.blockIDs.join(", ")}`);

    const body = JSON.stringify(babp);
    return fetch(this.getBaseURL() + "/api/v2/boards-and-blocks", {
      method: "PATCH",
      headers: this.#headers(),
      body,
    });
  }

  async getSharing(boardID) {
    const path = `/api/v2/boards/${boardID}/sharing`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return undefined;
    }
    return this.getJson(response, undefined);
  }

  async setSharing(boardID, sharing) {
    const path = `/api/v2/boards/${boardID}/sharing`;
    const body = JSON.stringify(sharing);
    const response = await fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
      body,
    });
    if (response.status !== 200) {
      return false;
    }

    return true;
  }

  async regenerateTeamSignupToken() {
    const path = `${this.#teamPath()}/regenerate_signup_token`;
    await fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
    });
  }

  async uploadFile(rootId, file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const headers = this.#headers();

      delete headers["Content-Type"];

      const response = await fetch(
        `${this.getBaseURL()}${this.#teamPath()}/${rootId}/files`,
        {
          method: "POST",
          headers,
          body: formData,
        }
      );
      if (response.status !== 200) {
        return undefined;
      }

      try {
        const text = await response.text();
        Logger.log(`uploadFile response: ${text}`);
        const json = JSON.parse(text);

        return json.fileId;
      } catch (e) {
        Logger.logError(`uploadFile json ERROR: ${e}`);
      }
    } catch (e) {
      Logger.logError(`uploadFile ERROR: ${e}`);
    }

    return undefined;
  }

  async uploadAttachment(rootId, file) {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();

    xhr.open(
      "POST",
      `${this.getBaseURL()}${this.#teamPath()}/${rootId}/files`,
      true
    );
    const headers = this.#headers();
    delete headers["Content-Type"];

    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader(
      "Authorization",
      this.token ? "Bearer " + this.token : ""
    );
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

    if (xhr.upload) {
      xhr.upload.onprogress = () => {};
    }
    xhr.send(formData);
    return xhr;
  }

  async getFileInfo(boardId, fileId) {
    let path = `api/v2/files/teams/${this.teamId}/${boardId}/${fileId}/info`;
    const readToken = Utils.getReadToken();
    if (readToken) {
      path += `?read_token=${readToken}`;
    }
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    let fileInfo = {};

    if (response.status === 200) {
      fileInfo = this.getJson(response, {});
    } else if (response.status === 400) {
      fileInfo = await this.getJson(response, {});
    }

    return fileInfo;
  }

  async getFileAsDataUrl(boardId, fileId) {
    let path =
      "/api/v2/files/teams/" + this.teamId + "/" + boardId + "/" + fileId;
    const readToken = Utils.getReadToken();
    if (readToken) {
      path += `?read_token=${readToken}`;
    }
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    let fileInfo = {};

    if (response.status === 200) {
      const blob = await response.blob();
      fileInfo.url = URL.createObjectURL(blob);
    } else if (response.status === 400) {
      fileInfo = await this.getJson(response, {});
    }

    return fileInfo;
  }

  async getTeam() {
    const path = this.#teamPath();
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return null;
    }

    return this.getJson(response, null);
  }

  async getTeams() {
    const path = this.#teamsPath();
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.headers(),
    });
    if (response.status !== 200) {
      return [];
    }

    return this.getJson(response, []);
  }

  async getTeamUsers(excludeBots) {
    let path = `${this.#teamPath()}/users`;
    if (excludeBots) {
      path += "?exclude_bots=true";
    }
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return [];
    }
    return await this.getJson(response, []);
  }

  async searchTeamUsers(searchQuery, excludeBots) {
    let path = `${this.#teamPath()}/users?search=${searchQuery}`;
    if (excludeBots) {
      path += "&exclude_bots=true";
    }
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return [];
    }
    return await this.getJson(response, []);
  }

  async getTeamTemplates(teamId) {
    const path = `${this.#teamPath(teamId)}/templates`;
    return this.#getBoardsWithPath(path);
  }

  async getBoards() {
    const path = `${this.#teamPath()}/boards`;
    return this.#getBoardsWithPath(path);
  }

  async getBoard(boardId) {
    let path = `/api/v2/boards/${boardId}`;
    const readToken = Utils.getReadToken();
    if (readToken) {
      path += `?read_token=${readToken}`;
    }
    const response = await fetch(this.getBaseURL() + path, {
      method: "GET",
      headers: this.#headers(),
    });

    if (response.status !== 200) {
      return undefined;
    }

    return this.getJson(response, {});
  }

  async duplicateBoard(boardId, asTemplate, toTeam) {
    let query = "?asTemplate=false";
    if (asTemplate) {
      query = "?asTemplate=true";
    }
    if (toTeam) {
      query += `&toTeam=${encodeURIComponent(toTeam)}`;
    }

    const path = `/api/v2/boards/${boardId}/duplicate${query}`;
    const response = await fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
    });

    if (response.status !== 200) {
      return undefined;
    }

    return this.getJson(response, {});
  }

  async duplicateBlock(boardId, blockId, asTemplate) {
    let query = "?asTemplate=false";
    if (asTemplate) {
      query = "?asTemplate=true";
    }
    const path = `/api/v2/boards/${boardId}/blocks/${blockId}/duplicate${query}`;
    const response = await fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
    });

    if (response.status !== 200) {
      return undefined;
    }

    return this.getJson(response, []);
  }

  async getBlocksForBoard(teamId, boardId) {
    const path = `${this.#teamPath(teamId)}/boards/${boardId}`;
    return this.#getBoardsWithPath(path);
  }

  async getBoardMembers(boardId) {
    const path = `/api/v2/boards/${boardId}/members`;
    return this.#getBoardMembersWithPath(path);
  }

  async createBoard(board) {
    Logger.log(`createBoard: ${board.title} [${board.type}]`);
    return fetch(`${this.getBaseURL()}${this.#teamPath(board.teamId)}/boards`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify(board),
    });
  }

  async patchBoard(boardId, boardPatch) {
    Logger.log(`patchBoard: ${boardId} board`);
    const body = JSON.stringify(boardPatch);
    return fetch(`${this.getBaseURL()}/api/v2/boards/${boardId}`, {
      method: "PATCH",
      headers: this.#headers(),
      body,
    });
  }

  async deleteBoard(boardId) {
    Logger.log(`deleteBoard: ${boardId}`);
    return fetch(`${this.getBaseURL()}/api/v2/boards/${boardId}`, {
      method: "DELETE",
      headers: this.#headers(),
    });
  }

  async getSidebarCategories(teamId) {
    const path = `/api/v2/teams/${teamId}/categories`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return [];
    }

    return await this.getJson(response, []);
  }

  async createSidebarCategory(category) {
    const path = `/api/v2/teams/${category.teamID}/categories`;
    const body = JSON.stringify(category);

    return fetch(this.getBaseURL() + path, {
      method: "POST",
      headers: this.#headers(),
      body,
    });
  }

  async deleteSidebarCategory(teamId, categoryId) {
    const url = `/api/v2/teams/${teamId}/categories/${categoryId}`;

    return fetch(this.getBaseURL() + url, {
      method: "DELETE",
      headers: this.#headers(),
    });
  }

  async updateSidebarCategory(category) {
    const path = `/api/v2/teams/${category.teamID}/categories/${category.id}`;
    const body = JSON.stringify(category);

    return fetch(this.getBaseURL() + path, {
      method: "PUT",
      headers: this.#headers(),
      body,
    });
  }

  async reorderSidebarCategories(teamId, newCategoryOrder) {
    const path = `/api/v2/teams/${teamId}/categories/reorder`;
    const body = JSON.stringify(newCategoryOrder);
    const response = await fetch(this.getBaseURL() + path, {
      method: "PUT",
      headers: this.#headers(),
      body,
    });

    if (response.status !== 200) {
      return [];
    }

    return await this.getJson(response, []);
  }

  async reorderSidebarCategoryBoards(teamId, categoryId, newBoardsOrder) {
    const path = `/api/v2/teams/${teamId}/categories/${categoryId}/boards/reorder`;
    const body = JSON.stringify(newBoardsOrder);
    const response = await fetch(this.getBaseURL() + path, {
      method: "PUT",
      headers: this.#headers(),
      body,
    });

    if (response.status !== 200) {
      return [];
    }

    return await this.getJson(response, []);
  }

  async moveBoardToCategory(teamId, boardId, toCategoryId, fromCategoryId) {
    const url = `/api/v2/teams/${teamId}/categories/${
      toCategoryId || "0"
    }/boards/${boardId}`;
    const payload = {
      fromCategoryId,
    };
    const body = JSON.stringify(payload);

    return fetch(this.getBaseURL() + url, {
      method: "POST",
      headers: this.#headers(),
      body,
    });
  }

  async search(teamId, query) {
    const url = `${this.#teamPath(teamId)}/boards/search?q=${encodeURIComponent(
      query
    )}`;
    const response = await fetch(this.getBaseURL() + url, {
      method: "GET",
      headers: this.#headers(),
    });

    if (response.status !== 200) {
      return [];
    }

    return await this.getJson(response, []);
  }

  async searchLinkableBoards(teamId, query) {
    const url = `${this.#teamPath(
      teamId
    )}/boards/search/linkable?q=${encodeURIComponent(query)}`;
    const response = await fetch(this.getBaseURL() + url, {
      method: "GET",
      headers: this.#headers(),
    });

    if (response.status !== 200) {
      return [];
    }

    return await this.getJson(response, []);
  }

  async searchAll(query) {
    const url = `/api/v2/boards/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(this.getBaseURL() + url, {
      method: "GET",
      headers: this.#headers(),
    });

    if (response.status !== 200) {
      return [];
    }

    return await this.getJson(response, []);
  }

  async getUserBlockSubscriptions(userId) {
    const path = `/api/v2/subscriptions/${userId}`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return [];
    }

    return await this.getJson(response, []);
  }

  async searchUserChannels(teamId, searchQuery) {
    const path = `/api/v2/teams/${teamId}/channels?search=${searchQuery}`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
      method: "GET",
    });
    if (response.status !== 200) {
      return undefined;
    }

    return await this.getJson(response, []);
  }

  async getChannel(teamId, channelId) {
    const path = `/api/v2/teams/${teamId}/channels/${channelId}`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
      method: "GET",
    });
    if (response.status !== 200) {
      return undefined;
    }

    return await this.getJson(response, {});
  }

  async prepareOnboarding(teamId) {
    const path = `/api/v2/teams/${teamId}/onboard`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
      method: "POST",
    });
    if (response.status !== 200) {
      return undefined;
    }

    return await this.getJson(response, {});
  }

  async notifyAdminUpgrade() {
    const path = `${this.teamPath()}/notifyadminupgrade`;
    await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
      method: "POST",
    });
  }

  async getBoardsCloudLimits() {
    const path = "/api/v2/limits";
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return undefined;
    }

    const limits = await this.getJson(response, {});
    Logger.log(`Cloud limits: cards=${limits.cards}   views=${limits.views}`);
    return limits;
  }

  async getSiteStatistics() {
    const path = "/api/v2/statistics";
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return undefined;
    }

    const stats = await this.getJson(response, {});
    Logger.log(
      `Site Statistics: cards=${stats.card_count}   boards=${stats.board_count}`
    );
    return stats;
  }

  async getMyTopBoards(timeRange, page, perPage, teamId) {
    const path = `/api/v2/users/me/boards/insights?time_range=${timeRange}&page=${page}&per_page=${perPage}&team_id=${teamId}`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return undefined;
    }

    return await this.getJson(response, {});
  }

  async getTeamTopBoards(timeRange, page, perPage, teamId) {
    const path = `/api/v2/teams/${teamId}/boards/insights?time_range=${timeRange}&page=${page}&per_page=${perPage}`;
    const response = await fetch(this.getBaseURL() + path, {
      headers: this.#headers(),
    });
    if (response.status !== 200) {
      return undefined;
    }

    return await this.getJson(response, {});
  }

  async moveBlockTo(blockId, where, dstBlockId) {
    return fetch(
      `${this.getBaseURL()}/api/v2/content-blocks/${blockId}/moveto/${where}/${dstBlockId}`,
      {
        method: "POST",
        headers: this.#headers(),
        body: "{}",
      }
    );
  }
}

const client = new DbClient();

export { client };
export default client;
