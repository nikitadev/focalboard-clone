import { createSlice } from "@reduxjs/toolkit";

export const ChannelTypeOpen = "O";
export const ChannelTypePrivate = "P";
export const ChannelTypeDirectMessage = "D";
export const ChannelTypeGroupMessage = "G";
//const channelTypes = [ChannelTypeOpen, ChannelTypePrivate, ChannelTypeDirectMessage, ChannelTypeGroupMessage];

const channelSlice = createSlice({
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

export const { setChannel } = channelSlice.actions;
export const { reducer } = channelSlice;

export const getCurrentChannel = (state) => state.channels.current;
