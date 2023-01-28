import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import octoClient from "../octoClient";

import { Utils } from "../utils";

import { initialLoad } from "./initialLoad";

export const fetchTeams = createAsyncThunk("team/fetch", async () =>
  octoClient.getTeams()
);

export const regenerateSignupToken = createAsyncThunk(
  "team/regenerateSignupToken",
  async () => octoClient.regenerateTeamSignupToken()
);

export const refreshCurrentTeam = createAsyncThunk(
  "team/refreshCurrentTeam",
  async () => octoClient.getTeam()
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
      const teamID = action.payload;
      state.currentId = teamID;
      const team = state.allTeams.find((t) => t.id === teamID);
      if (!team) {
        Utils.log(`Unable to find team in store. TeamID: ${teamID}`);
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
