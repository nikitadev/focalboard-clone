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
    const teamId = match.params.teamId || UserSettings.lastTeamId || Constants.globalTeamId;

    useEffect(() => {
        let boardId = match.params.boardId;
        if (!match.params.boardId) {
            boardId = UserSettings.lastBoardId[teamId];

            // if last visited board is unavailable, use the first board in categories list
            if (!boardId && categories.length > 0) {
                let goToBoardId = null

                for (const category of categories) {
                    for (const categoryBoardID of category.boardIDs) {
                        if (boards[categoryBoardID]) {
                            // pick the first category board that exists
                            goToBoardId = categoryBoardID
                            break
                        }
                    }
                }

                // there may even be no boards at all
                if (goToBoardId) {
                    boardId = goToBoardId
                }
            }

            if (boardId) {
                const newPath = generatePath(Utils.getBoardPagePath(match.path), { ...match.params, boardId, viewID: undefined });
                history.replace(newPath);

                return;
            }
        }

        let viewId = match.params.viewId;

        // when a view isn't open,
        // but the data is available, try opening a view
        if ((!viewId || viewId === '0') && boardId && boardId === match.params.boardId && boardViews && boardViews.length > 0) {
            // most recent view gets the first preference
            viewId = UserSettings.lastViewId[boardId];
            if (viewId) {
                UserSettings.setLastViewId(boardId, viewId);
                dispatch(setCurrentView(viewId));
            } else if (boardViews.length > 0) {
                // if most recent view is unavailable, pick the first view
                viewId = boardViews[0].id;
                UserSettings.setLastViewId(boardId, viewId);
                dispatch(setCurrentView(viewId));
            }

            if (viewId) {
                const newPath = generatePath(Utils.getBoardPagePath(match.path), { ...match.params, viewId });
                history.replace(newPath);
            }
        }
    }, [teamId, match.params.boardId, match.params.viewId, categories.length, boardViews.length, boardId, match.params, match.path, boardViews, categories, boards, history, dispatch]);

    return null;
}

export default TeamToBoardAndViewRedirect;
