import { useEffect } from "react";

import webSocketClient from "../wsclient";

export const useWebsockets = (teamId, fn) => {
  useEffect(() => {
    if (!teamId) {
      return () => {};
    }

    webSocketClient.subscribeToTeam(teamId);
    const teardown = fn(webSocketClient);

    return () => {
      teardown();
      webSocketClient.unsubscribeToTeam(teamId);
    };
  }, [fn, teamId]);
};
