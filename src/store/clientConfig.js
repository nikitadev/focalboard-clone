import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

import { default as client } from "../DbClient";

import { ShowUsername } from "../utils";

export const fetchClientConfig = createAsyncThunk(
  "clientConfig/fetchClientConfig",
  async () => client.getClientConfig()
);

const clientConfigSlice = createSlice({
  name: "config",
  initialState: {
    value: {
      telemetry: false,
      telemetryid: "",
      enablePublicSharedBoards: false,
      teammateNameDisplay: ShowUsername,
      featureFlags: {},
      maxFileSize: 0,
    },
  },
  reducers: {
    setClientConfig: (state, action) => {
      state.value = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchClientConfig.fulfilled, (state, action) => {
      state.value = action.payload || {
        telemetry: false,
        telemetryid: "",
        enablePublicSharedBoards: false,
        teammateNameDisplay: ShowUsername,
        featureFlags: {},
        maxFileSize: 0,
      };
    });
  },
});

export const { setClientConfig } = clientConfigSlice.actions;
export const { reducer } = clientConfigSlice;

export function getClientConfig(state) {
  return state.clientConfig.value;
}
