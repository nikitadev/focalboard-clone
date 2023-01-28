import { useEffect } from 'react';

import wsClient from '../wsclient';

export const useWebsockets = (teamId, fn) => {
    useEffect(() => {
        if (!teamId) {
            return () => { }
        }

        wsClient.subscribeToTeam(teamId)
        const teardown = fn(wsClient)

        return () => {
            teardown()
            wsClient.unsubscribeToTeam(teamId)
        }
    }, [fn, teamId]);
}
