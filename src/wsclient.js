import { Utils } from "./utils";

import { OctoUtils } from "./octoUtils";

export const ACTION_UPDATE_BOARD = "UPDATE_BOARD";
export const ACTION_UPDATE_MEMBER = "UPDATE_MEMBER";
export const ACTION_DELETE_MEMBER = "DELETE_MEMBER";
export const ACTION_UPDATE_BLOCK = "UPDATE_BLOCK";
export const ACTION_AUTH = "AUTH";
export const ACTION_SUBSCRIBE_BLOCKS = "SUBSCRIBE_BLOCKS";
export const ACTION_SUBSCRIBE_TEAM = "SUBSCRIBE_TEAM";
export const ACTION_UNSUBSCRIBE_TEAM = "UNSUBSCRIBE_TEAM";
export const ACTION_UNSUBSCRIBE_BLOCKS = "UNSUBSCRIBE_BLOCKS";
export const ACTION_UPDATE_CLIENT_CONFIG = "UPDATE_CLIENT_CONFIG";
export const ACTION_UPDATE_CATEGORY = "UPDATE_CATEGORY";
export const ACTION_UPDATE_BOARD_CATEGORY = "UPDATE_BOARD_CATEGORY";
export const ACTION_UPDATE_SUBSCRIPTION = "UPDATE_SUBSCRIPTION";
export const ACTION_UPDATE_CARD_LIMIT_TIMESTAMP = "UPDATE_CARD_LIMIT_TIMESTAMP";
export const ACTION_REORDER_CATEGORIES = "REORDER_CATEGORIES";

class WSClient {
  ws = null;
  client = null;
  onPluginReconnect = null;
  token = "";
  pluginId = "";
  pluginVersion = "";
  teamId = "";
  onAppVersionChangeHandler = null;
  clientPrefix = "";
  serverUrl;
  state = "init";
  onStateChange = [];
  onReconnect = [];
  onChange = {
    Block: [],
    Category: [],
    BoardCategory: [],
    Board: [],
    BoardMember: [],
    CategoryReorder: [],
  };
  onError = [];
  onConfigChange = [];
  onCardLimitTimestampChange = [];
  onFollowBlock = () => {};
  onUnfollowBlock = () => {};
  #notificationDelay = 100;
  #reopenDelay = 3000;
  #updatedData = {
    Blocks: [],
    Categories: [],
    BoardCategories: [],
    Boards: [],
    BoardMembers: [],
    CategoryOrder: [],
  };
  #updateTimeout;
  #errorPollId;
  subscriptions = { Teams: {} };

  #logged = false;

  #getBaseURL() {
    const baseURL = (this.serverUrl || Utils.getBaseURL(true)).replace(
      /\/$/,
      ""
    );

    if (!this.logged) {
      Utils.log(`WSClient serverUrl: ${baseURL}`);
      this.logged = true;
    }

    return baseURL;
  }

  constructor(serverUrl) {
    this.serverUrl = serverUrl;
  }

  initPlugin(pluginId, pluginVersion, client) {
    this.pluginId = pluginId;
    this.pluginVersion = pluginVersion;
    this.clientPrefix = `custom_${pluginId}_`;
    this.client = client;
    Utils.log(`WSClient initialised for plugin id "${pluginId}"`);
  }

  resetSubscriptions() {
    this.subscriptions = { Teams: {} };
  }

  subscribe() {
    Utils.log("Sending commands for the registered subscriptions");
    Object.keys(this.subscriptions.Teams).forEach((teamId) =>
      this.sendSubscribeToTeamCommand(teamId)
    );
  }

  sendCommand(command) {
    try {
      if (this.client !== null) {
        const { action, ...data } = command;
        this.client.sendMessage(this.clientPrefix + action, data);
        return;
      }

      this.ws?.send(JSON.stringify(command));
    } catch (e) {
      Utils.logError(`WSClient failed to send command ${command.action}: ${e}`);
    }
  }

  sendAuthenticationCommand(token) {
    const command = { action: ACTION_AUTH, token };

    this.sendCommand(command);
  }

  sendSubscribeToTeamCommand(teamId) {
    const command = {
      action: ACTION_SUBSCRIBE_TEAM,
      teamId,
    };

    this.sendCommand(command);
  }

  sendUnsubscribeToTeamCommand(teamId) {
    const command = {
      action: ACTION_UNSUBSCRIBE_TEAM,
      teamId,
    };

    this.sendCommand(command);
  }

  addOnChange(handler, type) {
    switch (type) {
      case "block":
        this.onChange.Block.push(handler);
        break;
      case "category":
        this.onChange.Category.push(handler);
        break;
      case "blockCategories":
        this.onChange.BoardCategory.push(handler);
        break;
      case "board":
        this.onChange.Board.push(handler);
        break;
      case "boardMembers":
        this.onChange.BoardMember.push(handler);
        break;
      case "categoryOrder":
        this.onChange.CategoryReorder.push(handler);
        break;
      default:
        break;
    }
  }

  removeOnChange(needle, type) {
    let haystack = [];
    switch (type) {
      case "block":
        haystack = this.onChange.Block;
        break;
      case "blockCategories":
        haystack = this.onChange.BoardCategory;
        break;
      case "board":
        haystack = this.onChange.Board;
        break;
      case "boardMembers":
        haystack = this.onChange.BoardMember;
        break;
      case "category":
        haystack = this.onChange.Category;
        break;
      case "categoryOrder":
        haystack = this.onChange.CategoryReorder;
        break;
      default:
        break;
    }

    if (!haystack) {
      return;
    }

    const index = haystack.indexOf(needle);
    if (index !== -1) {
      haystack.splice(index, 1);
    }
  }

  addOnReconnect(handler) {
    this.onReconnect.push(handler);
  }

  removeOnReconnect(handler) {
    const index = this.onReconnect.indexOf(handler);
    if (index !== -1) {
      this.onReconnect.splice(index, 1);
    }
  }

  addOnStateChange(handler) {
    this.onStateChange.push(handler);
  }

  removeOnStateChange(handler) {
    const index = this.onStateChange.indexOf(handler);
    if (index !== -1) {
      this.onStateChange.splice(index, 1);
    }
  }

  addOnError(handler) {
    this.onError.push(handler);
  }

  removeOnError(handler) {
    const index = this.onError.indexOf(handler);
    if (index !== -1) {
      this.onError.splice(index, 1);
    }
  }

  addOnConfigChange(handler) {
    this.onConfigChange.push(handler);
  }

  removeOnConfigChange(handler) {
    const index = this.onConfigChange.indexOf(handler);
    if (index !== -1) {
      this.onConfigChange.splice(index, 1);
    }
  }

  addOnCardLimitTimestampChange(handler) {
    this.onCardLimitTimestampChange.push(handler);
  }

  removeOnCardLimitTimestampChange(handler) {
    const index = this.onCardLimitTimestampChange.indexOf(handler);
    if (index !== -1) {
      this.onCardLimitTimestampChange.splice(index, 1);
    }
  }

  open() {
    if (this.client !== null) {
      // configure the Mattermost websocket client callbacks
      const onConnect = () => {
        Utils.log("WSClient in plugin mode, reusing Mattermost WS connection");

        // if there are any subscriptions set by the
        // components, send their subscribe messages
        this.subscribe();

        for (const handler of this.onStateChange) {
          handler(this, "open");
        }
        this.state = "open";
      };

      const onReconnect = () => {
        Utils.logWarn("WSClient reconnected");

        onConnect();
        for (const handler of this.onReconnect) {
          handler(this);
        }
      };
      this.onPluginReconnect = onReconnect;

      const onClose = (connectFailCount) => {
        Utils.logError(
          `WSClient has been closed, connect fail count: ${connectFailCount}`
        );

        for (const handler of this.onStateChange) {
          handler(this, "close");
        }
        this.state = "close";

        if (!this.errorPollId) {
          this.errorPollId = setInterval(() => {
            Utils.logWarn(
              `Polling websockets connection for state: ${this.client?.conn?.readyState}`
            );
            if (this.client?.conn?.readyState === 1) {
              onReconnect();
              clearInterval(this.errorPollId);
              this.errorPollId = undefined;
            }
          }, 500);
        }
      };

      const onError = (event) => {
        Utils.logError(
          `WSClient websocket onerror. data: ${JSON.stringify(event)}`
        );

        for (const handler of this.onError) {
          handler(this, event);
        }
      };

      this.client.addFirstConnectListener(onConnect);
      this.client.addErrorListener(onError);
      this.client.addCloseListener(onClose);
      this.client.addReconnectListener(onReconnect);

      return;
    }

    const url = new URL(this.getBaseURL());
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const wsServerUrl = `${protocol}//${url.host}${url.pathname.replace(
      /\/$/,
      ""
    )}/ws`;
    Utils.log(`WSClient open: ${wsServerUrl}`);
    const ws = new WebSocket(wsServerUrl);
    this.ws = ws;

    ws.onopen = () => {
      Utils.log("WSClient webSocket opened.");
      this.state = "open";

      if (this.token) {
        this.sendAuthenticationCommand(this.token);
      }

      this.subscribe();

      for (const handler of this.onStateChange) {
        handler(this, "open");
      }
    };

    ws.onerror = (e) => {
      Utils.logError(`WSClient websocket onerror. data: ${e}`);
      for (const handler of this.onError) {
        handler(this, e);
      }
    };

    ws.onclose = (e) => {
      Utils.log(
        `WSClient websocket onclose, code: ${e.code}, reason: ${e.reason}`
      );
      if (ws === this.ws) {
        // Unexpected close, re-open
        Utils.logError("Unexpected close, re-opening websocket");
        for (const handler of this.onStateChange) {
          handler(this, "close");
        }
        this.state = "close";
        setTimeout(() => {
          // ToDo: assert that this actually runs the onopen
          // contents (auth + this.subscribe())
          this.open();
          for (const handler of this.onReconnect) {
            handler(this);
          }
        }, this.reopenDelay);
      }
    };

    ws.onmessage = (e) => {
      if (ws !== this.ws) {
        Utils.log("Ignoring closed ws");
        return;
      }

      try {
        const message = JSON.parse(e.data);
        if (message.error) {
          Utils.logError(`Listener websocket error: ${message.error}`);
          return;
        }

        switch (message.action) {
          case ACTION_UPDATE_BOARD:
            this.updateHandler(message);
            break;
          case ACTION_UPDATE_MEMBER:
            this.updateHandler(message);
            break;
          case ACTION_DELETE_MEMBER:
            this.updateHandler(message);
            break;
          case ACTION_UPDATE_BLOCK:
            this.updateHandler(message);
            break;
          case ACTION_UPDATE_CATEGORY:
            this.updateHandler(message);
            break;
          case ACTION_UPDATE_BOARD_CATEGORY:
            this.updateHandler(message);
            break;
          case ACTION_UPDATE_SUBSCRIPTION:
            this.updateSubscriptionHandler(message);
            break;
          case ACTION_REORDER_CATEGORIES:
            this.updateHandler(message);
            break;
          default:
            Utils.logError(`Unexpected action: ${message.action}`);
        }
      } catch (err) {
        Utils.log("message is not an object");
      }
    };
  }

  hasConn() {
    return this.ws?.readyState === 1 || this.client !== null;
  }

  updateHandler(message) {
    if (message.teamId && message.teamId !== this.teamId) {
      return;
    }

    const [data, type] = Utils.fixWSData(message);
    if (data) {
      this.queueUpdateNotification(data, type);
    }
  }

  setOnFollowBlock(handler) {
    this.onFollowBlock = handler;
  }

  setOnUnfollowBlock(handler) {
    this.onUnfollowBlock = handler;
  }

  updateClientConfigHandler(config) {
    for (const handler of this.onConfigChange) {
      handler(this, config);
    }
  }

  updateCardLimitTimestampHandler(action) {
    for (const handler of this.onCardLimitTimestampChange) {
      handler(this, action.timestamp);
    }
  }

  updateSubscriptionHandler(message) {
    Utils.log(
      "updateSubscriptionHandler: " +
        message.action +
        "; blockId=" +
        message.subscription?.blockId
    );

    if (!message.subscription) {
      return;
    }

    const handler = message.subscription.deleteAt
      ? this.onUnfollowBlock
      : this.onFollowBlock;
    handler(this, message.subscription);
  }

  setOnAppVersionChangeHandler(fn) {
    this.onAppVersionChangeHandler = fn;
  }

  pluginStatusesChangedHandler(data) {
    if (this.pluginId === "" || !this.onAppVersionChangeHandler) {
      return;
    }

    const focalboardStatusChange = data.plugin_statuses.find(
      (s) => s.plugin_id === this.pluginId
    );
    if (focalboardStatusChange) {
      // if the plugin version is greater than the current one,
      // show the new version banner
      if (
        Utils.compareVersions(
          this.pluginVersion,
          focalboardStatusChange.version
        ) > 0
      ) {
        Utils.log("Boards plugin has been updated");
        this.onAppVersionChangeHandler(true);
      }

      // if the plugin version is greater or equal, trigger a
      // reconnect to resubscribe in case the interface hasn't
      // been reloaded
      if (
        Utils.compareVersions(
          this.pluginVersion,
          focalboardStatusChange.version
        ) >= 0
      ) {
        // this is a temporal solution that leaves a second
        // between the message and the reconnect so the server
        // has time to register the WS handler
        setTimeout(() => {
          if (this.onPluginReconnect) {
            Utils.log("Reconnecting after plugin update");
            this.onPluginReconnect();
          }
        }, 1000);
      }
    }
  }

  authenticate(token) {
    if (!token) {
      Logger.assertRefusal("WSClient trying to authenticate without a token");
      return;
    }

    if (this.hasConn()) {
      this.sendAuthenticationCommand(token);
    }

    this.token = token;
  }

  subscribeToTeam(teamId) {
    if (!this.subscriptions.Teams[teamId]) {
      Utils.log(`First component subscribing to team ${teamId}`);

      if (this.hasConn()) {
        this.sendSubscribeToTeamCommand(teamId);
      }

      this.teamId = teamId;
      this.subscriptions.Teams[teamId] = 1;
      return;
    }

    this.subscriptions.Teams[teamId] += 1;
  }

  unsubscribeToTeam(teamId) {
    if (!this.subscriptions.Teams[teamId]) {
      Utils.logError(
        "Component trying to unsubscribe to a team when no subscriptions are registered. Doing nothing"
      );
      return;
    }

    this.subscriptions.Teams[teamId] -= 1;
    if (this.subscriptions.Teams[teamId] === 0) {
      Utils.log(`Last subscription to team ${teamId} being removed`);
      if (this.hasConn()) {
        this.sendUnsubscribeToTeamCommand(teamId);
      }

      if (teamId === this.teamId) {
        this.teamId = "";
      }
      delete this.subscriptions.Teams[teamId];
    }
  }

  subscribeToBlocks(teamId, blockIds, readToken = "") {
    if (!this.hasConn()) {
      Logger.assertRefusal("WSClient.subscribeToBlocks: ws is not open");
      return;
    }

    const command = {
      action: ACTION_SUBSCRIBE_BLOCKS,
      blockIds,
      teamId,
      readToken,
    };

    this.sendCommand(command);
  }

  unsubscribeFromBlocks(teamId, blockIds, readToken = "") {
    if (!this.hasConn()) {
      Logger.assertRefusal("WSClient.removeBlocks: ws is not open");
      return;
    }

    const command = {
      action: ACTION_UNSUBSCRIBE_BLOCKS,
      blockIds,
      teamId,
      readToken,
    };

    this.sendCommand(command);
  }

  #queueUpdateNotification(data, type) {
    if (!data) {
      return;
    }

    // Remove existing queued update
    if (type === "block") {
      this.updatedData.Blocks = this.updatedData.Blocks.filter(
        (o) => o.id !== data.id
      );
      this.updatedData.Blocks.push(OctoUtils.hydrateBlock(data));
    } else if (type === "category") {
      this.updatedData.Categories = this.updatedData.Categories.filter(
        (c) => c.id !== data.id
      );
      this.updatedData.Categories.push(data);
    } else if (type === "blockCategories") {
      this.updatedData.BoardCategories =
        this.updatedData.BoardCategories.filter(
          (b) =>
            !data.find((boardCategory) => boardCategory.boardID === b.boardID)
        );
      this.updatedData.BoardCategories.push(...data);
    } else if (type === "board") {
      this.updatedData.Boards = this.updatedData.Boards.filter(
        (b) => b.id !== data.id
      );
      this.updatedData.Boards.push(data);
    } else if (type === "boardMembers") {
      this.updatedData.BoardMembers = this.updatedData.BoardMembers.filter(
        (m) => m.userId !== data.userId || m.boardId !== data.boardId
      );
      this.updatedData.BoardMembers.push(data);
    } else if (type === "categoryOrder") {
      this.updatedData.CategoryOrder = data;
    }

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = undefined;
    }

    this.updateTimeout = setTimeout(() => {
      this.flushUpdateNotifications();
    }, this.notificationDelay);
  }

  #logUpdateNotification() {
    for (const block of this.updatedData.Blocks) {
      Utils.log(`WSClient flush update block: ${block.id}`);
    }

    for (const category of this.updatedData.Categories) {
      Utils.log(`WSClient flush update category: ${category.id}`);
    }

    for (const blockCategories of this.updatedData.BoardCategories) {
      Utils.log(
        `WSClient flush update blockCategory: ${blockCategories.boardID} ${blockCategories.categoryID}`
      );
    }

    for (const board of this.updatedData.Boards) {
      Utils.log(`WSClient flush update board: ${board.id}`);
    }

    for (const boardMember of this.updatedData.BoardMembers) {
      Utils.log(
        `WSClient flush update boardMember: ${boardMember.userId} ${boardMember.boardId}`
      );
    }

    Utils.log(
      `WSClient flush update categoryOrder: ${this.updatedData.CategoryOrder}`
    );
  }

  #flushUpdateNotifications() {
    this.logUpdateNotification();

    for (const handler of this.onChange.Block) {
      handler(this, this.updatedData.Blocks);
    }

    for (const handler of this.onChange.Category) {
      handler(this, this.updatedData.Categories);
    }

    for (const handler of this.onChange.BoardCategory) {
      handler(this, this.updatedData.BoardCategories);
    }

    for (const handler of this.onChange.Board) {
      handler(this, this.updatedData.Boards);
    }

    for (const handler of this.onChange.BoardMember) {
      handler(this, this.updatedData.BoardMembers);
    }

    for (const handler of this.onChange.CategoryReorder) {
      handler(this, this.updatedData.CategoryOrder);
    }

    this.updatedData = {
      Blocks: [],
      Categories: [],
      BoardCategories: [],
      Boards: [],
      BoardMembers: [],
      CategoryOrder: [],
    };
  }

  close() {
    if (!this.hasConn()) {
      return;
    }

    Utils.log(`WSClient close: ${this.ws?.url}`);

    const ws = this.ws;
    this.ws = null;
    this.onChange = {
      Block: [],
      Category: [],
      BoardCategory: [],
      Board: [],
      BoardMember: [],
      CategoryReorder: [],
    };
    this.onReconnect = [];
    this.onStateChange = [];
    this.onError = [];

    // if running in plugin mode, nothing else needs to be done
    if (this.client) {
      return;
    }

    try {
      ws?.close();
    } catch {
      try {
        ws?.websocket?.close();
      } catch {
        Utils.log("WSClient unable to close the websocket");
      }
    }
  }
}

const wsClient = new WSClient();

export { WSClient };
export default wsClient;
