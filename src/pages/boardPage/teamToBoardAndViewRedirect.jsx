// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import { useEffect } from 'react';
import { generatePath, useNavigate, useMatch } from 'react-router-dom';

import { getBoards, getCurrentBoardId } from '../../store/boards';
import { setCurrent as setCurrentView, getCurrentBoardViews } from '../../store/views';
import { useDispatch, useSelector } from "react-redux";
import { UserSettings } from '../../userSettings';
import { Utils } from '../../utils';
import { getSidebarCategories } from '../../store/sidebar';
import { Constants } from '../../constants';

const TeamToBoardAndViewRedirect = () => {
    const boardId = useSelector(getCurrentBoardId);
    const boardViews = useSelector(getCurrentBoardViews);
    const dispatch = useDispatch();
    const history = useNavigate();
    const match = useMatch();
    const categories = useSelector(getSidebarCategories);
    const boards = useSelector(getBoards);
    const teamId = match.params.teamId || UserSettings.getLastTeamId() || Constants.globalTeamId;

    useEffect(() => {
        let boardID = match.params.boardId;
        if (!match.params.boardId) {
            // first preference is for last visited board
            boardID = UserSettings.getLastBoardId()[teamId];

            // if last visited board is unavailable, use the first board in categories list
            if (!boardID && categories.length > 0) {
                let goToBoardID = null

                for (const category of categories) {
                    for (const categoryBoardID of category.boardIDs) {
                        if (boards[categoryBoardID]) {
                            // pick the first category board that exists
                            goToBoardID = categoryBoardID
                            break
                        }
                    }
                }

                // there may even be no boards at all
                if (goToBoardID) {
                    boardID = goToBoardID
                }
            }

            if (boardID) {
                const newPath = generatePath(Utils.getBoardPagePath(match.path), { ...match.params, boardId: boardID, viewID: undefined });
                history.replace(newPath);

                return;
            }
        }

        let viewID = match.params.viewId;

        // when a view isn't open,
        // but the data is available, try opening a view
        if ((!viewID || viewID === '0') && boardId && boardId === match.params.boardId && boardViews && boardViews.length > 0) {
            // most recent view gets the first preference
            viewID = UserSettings.lastViewId[boardID];
            if (viewID) {
                UserSettings.setLastViewId(boardID, viewID);
                dispatch(setCurrentView(viewID));
            } else if (boardViews.length > 0) {
                // if most recent view is unavailable, pick the first view
                viewID = boardViews[0].id;
                UserSettings.setLastViewId(boardID, viewID);
                dispatch(setCurrentView(viewID));
            }

            if (viewID) {
                const newPath = generatePath(Utils.getBoardPagePath(match.path), { ...match.params, viewId: viewID });
                history.replace(newPath);
            }
        }
    }, [teamId, match.params.boardId, match.params.viewId, categories.length, boardViews.length, boardId, match.params, match.path, boardViews, categories, boards, history, dispatch]);

    return null;
}

export default TeamToBoardAndViewRedirect;
