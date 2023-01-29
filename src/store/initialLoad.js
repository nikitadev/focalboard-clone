import { createAsyncThunk, createSelector } from "@reduxjs/toolkit";

import { default as client } from "../dbClient";
import { ErrorId } from "../errors";

export const initialLoad = createAsyncThunk("initialLoad", async () => {
  const [
    person,
    config,
    team,
    teams,
    boards,
    boardsMemberships,
    boardTemplates,
    limits,
  ] = await Promise.all([
    client.getPerson(),
    client.getConfig(),
    client.getTeam(),
    client.getTeams(),
    client.getBoards(),
    client.getMyBoardMemberships(),
    client.getTeamTemplates(),
    client.getBoardsCloudLimits(),
  ]);

  // if no me, normally user not logged in
  if (!person) {
    throw new Error(ErrorId.NotLoggedIn);
  }

  // if no team, either bad id, or user doesn't have access
  if (!team) {
    throw new Error(ErrorId.TeamUndefined);
  }
  return {
    team,
    teams,
    boards,
    boardsMemberships,
    boardTemplates,
    limits,
    config,
  };
});

export const initialReadOnlyLoad = createAsyncThunk(
  "initialReadOnlyLoad",
  async (boardId) => {
    const [board, blocks] = await Promise.all([
      client.getBoard(boardId),
      client.getAllBlocks(boardId),
    ]);

    // if no board, read_token invalid
    if (!board) {
      throw new Error(ErrorId.InvalidReadOnlyBoard);
    }

    return { board, blocks };
  }
);

export const loadBoardData = createAsyncThunk(
  "loadBoardData",
  async (boardID) => {
    const blocks = await client.getAllBlocks(boardID);
    return {
      blocks,
    };
  }
);

export const loadBoards = createAsyncThunk("loadBoards", async () => {
  const boards = await client.getBoards();
  return {
    boards,
  };
});

export const loadMyBoardsMemberships = createAsyncThunk(
  "loadMyBoardsMemberships",
  async () => {
    const boardsMemberships = await client.getMyBoardMemberships();
    return {
      boardsMemberships,
    };
  }
);

export const getUserBlockSubscriptions = (state) =>
  state.users.blockSubscriptions;

export const getUserBlockSubscriptionList = createSelector(
  getUserBlockSubscriptions,
  (subscriptions) => subscriptions
);
