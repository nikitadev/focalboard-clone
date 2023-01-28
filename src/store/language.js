import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

import {
  getCurrentLanguage,
  storeLanguage as i18nStoreLanguage,
} from "../i18n";

export const fetchLanguage = createAsyncThunk("language/fetch", async () =>
  getCurrentLanguage()
);

export const storeLanguage = createAsyncThunk("language/store", (lang) => {
  i18nStoreLanguage(lang);
  return lang;
});

const languageSlice = createSlice({
  name: "language",
  initialState: { value: "en" },
  reducers: {
    setLanguage: (state, action) => {
      state.value = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchLanguage.fulfilled, (state, action) => {
      state.value = action.payload;
    });
    builder.addCase(storeLanguage.fulfilled, (state, action) => {
      state.value = action.payload;
    });
  },
});

export const { reducer } = languageSlice;

export function getLanguage(state) {
  return state.language.value;
}
