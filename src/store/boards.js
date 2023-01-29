import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";

import { default as client } from "../dbClient";

import {
  initialLoad,
  initialReadOnlyLoad,
  loadBoardData,
  loadBoards,
  loadMyBoardsMemberships,
} from "./initialLoad";

import { addBoardUsers, removeBoardUsersById, setBoardUsers } from "./users";

export const fetchBoardMembers = createAsyncThunk(
  "boardMembers/fetch",
  async ({ teamId, boardId }, thunkAPI) => {
    const members = await client.getBoardMembers(teamId, boardId);
    const users = [];
    const userIDs = members.map((member) => member.userId);

    const usersData = await client.getUsersList(userIDs);
    users.push(...usersData);

    thunkAPI.dispatch(setBoardUsers(users));
    return members;
  }
);

export const updateMembersEnsuringBoardsAndUsers = createAsyncThunk(
  "updateMembersEnsuringBoardsAndUsers",
  async (members, thunkAPI) => {
    const me = thunkAPI.getState().users.me;
    if (me) {
      // ensure the boards for the new memberships get loaded or removed
      const boards = thunkAPI.getState().boards.boards;
      const myMemberships = members.filter((m) => m.userId === me.id);
      const boardsToUpdate = [];
      /* eslint-disable no-await-in-loop */
      for (const member of myMemberships) {
        if (
          !member.schemeAdmin &&
          !member.schemeEditor &&
          !member.schemeViewer &&
          !member.schemeCommenter
        ) {
          boardsToUpdate.push({ id: member.boardId, deleteAt: 1 });
          continue;
        }

        if (boards[member.boardId]) {
          continue;
        }

        const board = await client.getBoard(member.boardId);
        if (board) {
          boardsToUpdate.push(board);
        }
      }
      /* eslint-enable no-await-in-loop */

      thunkAPI.dispatch(updateBoards(boardsToUpdate));
    }

    // ensure the users for the new memberships get loaded
    const boardUsers = thunkAPI.getState().users.boardUsers;
    members.forEach(async (m) => {
      const deleted =
        !m.schemeAdmin &&
        !m.schemeEditor &&
        !m.schemeViewer &&
        !m.schemeCommenter;
      if (deleted) {
        thunkAPI.dispatch(removeBoardUsersById([m.userId]));
        return;
      }
      if (boardUsers[m.userId]) {
        return;
      }
      const user = await client.getUser(m.userId);
      if (user) {
        thunkAPI.dispatch(addBoardUsers([user]));
      }
    });

    return members;
  }
);

export const updateMembersHandler = (state, action) => {
  if (action.payload.length === 0) {
    return;
  }

  const boardId = action.payload[0].boardId;
  const boardMembers = state.membersInBoards[boardId] || {};

  for (const member of action.payload) {
    boardMembers[member.userId] =
      !member.schemeAdmin &&
      !member.schemeEditor &&
      !member.schemeViewer &&
      !member.schemeCommenter
        ? undefined
        : member;
  }

  for (const member of action.payload) {
    if (
      state.myBoardMemberships[member.boardId] &&
      state.myBoardMemberships[member.boardId].userId === member.userId
    ) {
      state.myBoardMemberships[member.boardId] =
        !member.schemeAdmin &&
        !member.schemeEditor &&
        !member.schemeViewer &&
        !member.schemeCommenter
          ? undefined
          : member;
    }
  }
};

const boardsSlice = createSlice({
  name: "boards",
  initialState: {
    loadingBoard: false,
    linkToChannel: "",
    boards: {},
    templates: {},
    membersInBoards: {},
    myBoardMemberships: {},
  },
  reducers: {
    setCurrent: (state, action) => {
      state.current = action.payload;
    },
    setLinkToChannel: (state, action) => {
      state.linkToChannel = action.payload;
    },
    updateBoards: (state, action) => {
      for (const board of action.payload) {
        if (board.deleteAt !== 0) {
          delete state.boards[board.id];
          delete state.templates[board.id];
        } else if (board.isTemplate) {
          state.templates[board.id] = board;
        } else {
          state.boards[board.id] = board;
        }
      }
    },
    updateMembers: updateMembersHandler,
    addMyBoardMemberships: (state, action) => {
      action.payload.forEach((member) => {
        state.myBoardMemberships[member.boardId] =
          !member.schemeAdmin &&
          !member.schemeEditor &&
          !member.schemeViewer &&
          !member.schemeCommenter
            ? undefined
            : member;
      });
    },
  },

  extraReducers: (builder) => {
    builder.addCase(loadBoardData.pending, (state) => {
      state.loadingBoard = true;
    });
    builder.addCase(loadBoardData.fulfilled, (state) => {
      state.loadingBoard = false;
    });
    builder.addCase(loadBoardData.rejected, (state) => {
      state.loadingBoard = false;
    });
    builder.addCase(initialReadOnlyLoad.fulfilled, (state, action) => {
      state.boards = {};
      state.templates = {};
      if (action.payload.board) {
        if (action.payload.board.isTemplate) {
          state.templates[action.payload.board.id] = action.payload.board;
        } else {
          state.boards[action.payload.board.id] = action.payload.board;
        }
      }
    });
    builder.addCase(initialLoad.fulfilled, (state, action) => {
      state.boards = {};
      action.payload.boards.forEach((board) => {
        state.boards[board.id] = board;
      });
      state.templates = {};
      action.payload.boardTemplates.forEach((board) => {
        state.templates[board.id] = board;
      });
      state.myBoardMemberships = {};
      action.payload.boardsMemberships.forEach((boardMember) => {
        state.myBoardMemberships[boardMember.boardId] = boardMember;
      });
    });
    builder.addCase(loadBoards.fulfilled, (state, action) => {
      state.boards = {};
      action.payload.boards.forEach((board) => {
        state.boards[board.id] = board;
      });
    });
    builder.addCase(loadMyBoardsMemberships.fulfilled, (state, action) => {
      state.myBoardMemberships = {};
      action.payload.boardsMemberships.forEach((boardMember) => {
        state.myBoardMemberships[boardMember.boardId] = boardMember;
      });
    });
    builder.addCase(fetchBoardMembers.fulfilled, (state, action) => {
      if (action.payload.length === 0) {
        return;
      }

      // all members should belong to the same boardId, so we
      // get it from the first one
      const boardId = action.payload[0].boardId;
      const boardMembersMap = action.payload.reduce((acc, val) => {
        acc[val.userId] = val;
        return acc;
      }, {});
      state.membersInBoards[boardId] = boardMembersMap;
    });
    builder.addCase(
      updateMembersEnsuringBoardsAndUsers.fulfilled,
      updateMembersHandler
    );
  },
});

export const {
  updateBoards,
  setCurrent,
  setLinkToChannel,
  updateMembers,
  addMyBoardMemberships,
} = boardsSlice.actions;
export const { reducer } = boardsSlice;

export const getBoards = (state) => state.boards?.boards || {};

export const getMySortedBoards = createSelector(
  getBoards,
  (state) => state.boards?.myBoardMemberships || {},
  (boards, myBoardMemberships) => {
    return Object.values(boards)
      .filter((b) => myBoardMemberships[b.id])
      .sort((a, b) => a.title.localeCompare(b.title));
  }
);

export const getTemplates = (state) => state.boards.templates;

export const getSortedTemplates = createSelector(getTemplates, (templates) => {
  return Object.values(templates).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
});

export function getBoard(boardId) {
  return (state) => {
    if (state.boards.boards && state.boards.boards[boardId]) {
      return state.boards.boards[boardId];
    } else if (state.boards.templates && state.boards.templates[boardId]) {
      return state.boards.templates[boardId];
    }
    return null;
  };
}

export const isLoadingBoard = (state) => state.boards.loadingBoard;

export const getCurrentBoardId = (state) => state.boards.current || "";

export const getCurrentBoard = createSelector(
  getCurrentBoardId,
  getBoards,
  getTemplates,
  (boardId, boards, templates) => {
    return boards[boardId] || templates[boardId];
  }
);

export const getCurrentBoardMembers = createSelector(
  (state) => state.boards.current,
  (state) => state.boards.membersInBoards,
  (boardId, membersInBoards) => {
    return membersInBoards[boardId] || {};
  }
);

export function getPersonBoardMembership(boardId) {
  return (state) => {
    return state.boards.myBoardMemberships[boardId] || null;
  };
}

export const getCurrentLinkToChannel = (state) => state.boards.linkToChannel;