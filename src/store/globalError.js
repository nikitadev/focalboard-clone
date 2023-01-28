import { createSlice } from "@reduxjs/toolkit";

import { initialLoad, initialReadOnlyLoad } from "./initialLoad";

const globalErrorSlice = createSlice({
  name: "globalError",
  initialState: { value: "" },
  reducers: {
    setGlobalError: (state, action) => {
      state.value = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initialReadOnlyLoad.rejected, (state, action) => {
      state.value = action.error.message || "";
    });
    builder.addCase(initialLoad.rejected, (state, action) => {
      state.value = action.error.message || "";
    });
  },
});

export const { setGlobalError } = globalErrorSlice.actions;
export const { reducer } = globalErrorSlice;

export const getGlobalError = (state) => state.globalError.value;
