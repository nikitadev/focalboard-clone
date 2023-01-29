import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import DbClient from "../dbClient";

import { Logger } from "../logger";

import { initialLoad } from "./initialLoad";

export const fetchTeams = createAsyncThunk("team/fetch", async () =>
  DbClient.getTeams()
);

export const regenerateSignupToken = createAsyncThunk(
  "team/regenerateSignupToken",
  async () => DbClient.regenerateTeamSignupToken()
);

export const refreshCurrentTeam = createAsyncThunk(
  "team/refreshCurrentTeam",
  async () => DbClient.getTeam()
);

const teamSlice = createSlice({
  name: "teams",
  initialState: {
    current: null,
    currentId: "",
    allTeams: [],
  },
  reducers: {
    setTeam: (state, action) => {
      const teamId = action.payload;
      state.currentId = teamId;
      const team = state.allTeams.find((t) => t.id === teamId);
      if (!team) {
        Logger.log(`Unable to find team in store. TeamID: ${teamId}`);
        return;
      }

      if (state.current === team) {
        return;
      }

      state.current = team;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initialLoad.fulfilled, (state, action) => {
      state.current = action.payload.team;
      state.allTeams = action.payload.teams;
      state.allTeams.sort((a, b) => (a.title < b.title ? -1 : 1));
    });
    builder.addCase(fetchTeams.fulfilled, (state, action) => {
      state.allTeams = action.payload;
      state.allTeams.sort((a, b) => (a.title < b.title ? -1 : 1));
    });
    builder.addCase(refreshCurrentTeam.fulfilled, (state, action) => {
      state.current = action.payload;
    });
  },
});

export const { setTeam } = teamSlice.actions;
export const { reducer } = teamSlice;

export const getCurrentTeamId = (state) => state.teams.currentId;
export const getCurrentTeam = (state) => state.teams.current;
export const getFirstTeam = (state) => state.teams.allTeams[0];
export const getAllTeams = (state) => state.teams.allTeams;
