import { configureStore } from "@reduxjs/toolkit";

import { reducer as usersReducer } from "./users";
import { reducer as teamsReducer } from "./teams";
import { reducer as channelsReducer } from "./channels";
import { reducer as languageReducer } from "./language";
/* import { reducer as globalTemplatesReducer } from './globalTemplates';
import { reducer as boardsReducer } from './boards';
import { reducer as viewsReducer } from './views';
import { reducer as cardsReducer } from './cards';
import { reducer as contentsReducer } from './contents';
import { reducer as commentsReducer } from './comments';
import { reducer as searchTextReducer } from './searchText';
import { reducer as globalErrorReducer } from './globalError';
import { reducer as clientConfigReducer } from './clientConfig';
import { reducer as sidebarReducer } from './sidebar';
import { reducer as limitsReducer } from './limits';
import { reducer as attachmentsReducer } from './attachments'; */

const store = configureStore({
  reducer: {
    users: usersReducer,
    teams: teamsReducer,
    channels: channelsReducer,
    language: languageReducer,
    /* globalTemplates: globalTemplatesReducer,
    boards: boardsReducer,
    views: viewsReducer,
    cards: cardsReducer,
    contents: contentsReducer,
    comments: commentsReducer,
    searchText: searchTextReducer,
    globalError: globalErrorReducer,
    clientConfig: clientConfigReducer,
    sidebar: sidebarReducer,
    limits: limitsReducer,
    attachments: attachmentsReducer, */
  },
});

export default store;
