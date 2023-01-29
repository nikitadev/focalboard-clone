import { createSlice } from "@reduxjs/toolkit";

export const ChannelType = {
  Open: "O",
  Private: "P",
  DirectMessage: "D",
  GroupMessage: "G",
};

const channelFragment = createSlice({
  name: "channels",
  initialState: {
    current: null,
  },
  reducers: {
    setChannel: (state, action) => {
      const channel = action.payload;
      if (state.current === channel) {
        return;
      }

      state.current = channel;
    },
  },
});

export const { setChannel } = channelFragment.actions;
export const { reducer } = channelFragment;

export const getCurrentChannel = (state) => state.channels.current;
