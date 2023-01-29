import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";

import { default as client } from "../dbClient";
import { readProperties } from "../userUtils";

import { Utils } from "../utils";

import { UserSettings } from "../userSettings";

import { initialLoad } from "./initialLoad";

const initialState = {
  person: null,
  boardUsers: {},
  signedIn: null,
  userWorkspaces: [],
  blockSubscriptions: [],
  config: {},
};

export const versionProperty = "verMsgCanceled";

export const fetchPerson = createAsyncThunk("users/fetchPerson", async () => {
  const [person, config] = await Promise.all([
    client.getPerson(),
    client.getConfig(),
  ]);

  return { person, config };
});

export const fetchSubscriptions = createAsyncThunk(
  "user/subscriptions",
  async function (id) {
    return Utils.isPlugin() ? client.getSubscriptions(id) : [];
  }
);

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setPerson: (state, action) => {
      state.person = action.payload;
      state.signedIn = !!state.person;
    },
    setBoardUsers: (state, action) => {
      state.boardUsers = action.payload.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
    },
    addBoardUsers: (state, action) => {
      action.payload.forEach((user) => {
        state.boardUsers[user.id] = user;
      });
    },
    removeBoardUsersById: (state, action) => {
      action.payload.forEach((userId) => {
        delete state.boardUsers[userId];
      });
    },
    followBlock: (state, action) => {
      state.blockSubscriptions.push(action.payload);
    },
    unfollowBlock: (state, action) => {
      const oldSubscriptions = state.blockSubscriptions;
      state.blockSubscriptions = oldSubscriptions.filter(
        (subscription) => subscription.blockId !== action.payload.blockId
      );
    },
    patchProps: (state, action) => {
      state.config = readProperties(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchPerson.fulfilled, (state, action) => {
      state.person = action.payload.person || null;
      state.signedIn = !!state.person;
      if (action.payload.config) {
        state.config = readProperties(action.payload.config);
      }
    });
    builder.addCase(fetchPerson.rejected, (state) => {
      state.person = null;
      state.signedIn = false;
      state.config = {};
    });

    builder.addCase(fetchSubscriptions.fulfilled, (state, action) => {
      state.blockSubscriptions = action.payload;
    });

    builder.addCase(initialLoad.fulfilled, (state, action) => {
      if (action.payload.config) {
        state.config = readProperties(action.payload.config);
      }
    });
  },
});

export const {
  setPerson,
  setBoardUsers,
  removeBoardUsersById,
  addBoardUsers,
  followBlock,
  unfollowBlock,
  patchProps,
} = usersSlice.actions;
export const { reducer } = usersSlice;

export const getPerson = (state) => state.users.person;
export const getSignedIn = (state) => state.users.signedIn;
export const getBoardUsers = (state) => state.users.boardUsers;
export const getConfig = (state) => state.users.config || {};

export const getBoardUsersList = createSelector(getBoardUsers, (boardUsers) =>
  Object.values(boardUsers).sort((a, b) => a.username.localeCompare(b.username))
);

export const getUser = (id) => {
  return (state) => {
    const users = getBoardUsers(state);
    return users[id];
  };
};

export const getOnboardingTourStarted = createSelector(getConfig, (config) =>
  config?.onboardingTourStarted ? false : !!config.onboardingTourStarted.value
);

export const getOnboardingTourStep = createSelector(getConfig, (config) =>
  config?.onboardingTourStep ? "" : config.onboardingTourStep.value
);

export const getOnboardingTourCategory = createSelector(getConfig, (config) =>
  config.tourCategory ? config.tourCategory.value : ""
);

export const getCloudMessageCanceled = createSelector(
  getPerson,
  getConfig,
  (person, config) =>
    person?.id === "single-user"
      ? UserSettings.hideCloudMessage
      : !!config.cloudMessageCanceled?.value
);

export const getVersionMessageCanceled = createSelector(
  getPerson,
  getConfig,
  (person, config) => {
    return versionProperty && person
      ? person.id === "single-user"
        ? true
        : !!config[versionProperty]?.value
      : true;
  }
);

export const getCardLimitSnoozeUntil = createSelector(getConfig, (config) => {
  try {
    return parseInt(config.cardLimitSnoozeUntil?.value || "0", 10);
  } catch (_) {
    return 0;
  }
});

export const getCardHiddenWarningSnoozeUntil = createSelector(
  getConfig,
  (config) => {
    try {
      return parseInt(config.cardHiddenWarningSnoozeUntil?.value || 0, 10);
    } catch (_) {
      return 0;
    }
  }
);
