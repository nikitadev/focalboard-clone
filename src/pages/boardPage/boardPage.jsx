import React, { useEffect, useState, useMemo, useCallback } from "react";
import { batch } from "react-redux";
import { Trans } from '@lingui/macro';

import { t } from "@lingui/macro";

import { useMatch } from "react-router-dom";

import Workspace from "../../components/workspace";
import CloudMessage from "../../components/messages/cloudMessage";
import VersionMessage from "../../components/messages/versionMessage";
import DbClient from "../../DbClient";
import { Utils } from "../../utils";
import { Logger } from "../../logger";
import { useWebsockets } from '../../hooks/websockets';
import {
  updateBoards,
  updateMembersEnsuringBoardsAndUsers,
  getCurrentBoardId,
  setCurrent as setCurrentBoard,
  fetchBoardMembers,
  addMyBoardMemberships,
} from "../../store/boards";
import {
  // getCurrentViewId,
  setCurrent as setCurrentView,
  updateViews,
} from "../../store/views";
import {
  initialLoad,
  initialReadOnlyLoad,
  loadBoardData,
} from "../../store/initialLoad";
import { setTeam } from "../../store/teams";
import { updateCards } from "../../store/cards";
import { updateComments } from "../../store/comments";
import { updateAttachments } from "../../store/attachments";
import { updateContents } from "../../store/contents";
import {
  fetchSubscriptions,
  getPerson,
  followBlock,
  unfollowBlock,
  patchProps,
  getConfig,
} from "../../store/users";
import { setGlobalError } from "../../store/globalError";
import { UserSettings } from "../../userSettings";

import { useDispatch, useSelector } from "react-redux";

import IconButton from "../../widgets/buttons/iconButton";
import CloseIcon from "../../widgets/icons/close";

import { Constants } from "../../constants";

import SetWindowTitleAndIcon from "./setWindowTitleAndIcon";
import TeamToBoardAndViewRedirect from "./teamToBoardAndViewRedirect";
import UndoRedoHotKeys from "./undoRedoHotKeys";
import BackwardCompatibilityQueryParamsRedirect from "./backwardCompatibilityQueryParamsRedirect";
import WebsocketConnection from "./websocketConnection";

import "./boardPage.scss";

const BoardPage = (props) => {
  const activeBoardId = useSelector(getCurrentBoardId);
  // const activeViewId = useSelector(getCurrentViewId);
  const dispatch = useDispatch();
  const match = useMatch();
  const [mobileWarningClosed, setMobileWarningClosed] = useState(
    UserSettings.mobileWarningClosed
  );
  const teamId =
    match.params.teamId ||
    UserSettings.lastTeamId ||
    Constants.globalTeamId;
  const viewId = match.params.viewId;
  const person = useSelector(getPerson);
  const config = useSelector(getConfig);

  if (Utils.isFocalboardLegacy() && !props.readonly) {
    window.location.href = window.location.href.replace(
      "/plugins/taskmanager",
      "/boards"
    );
  }

  const effect = useEffect(() => {
    if (!person) {
      return;
    }
    dispatch(fetchSubscriptions(person.id));
  }, [dispatch, person, person.id]);

  if (Utils.isPlugin()) {
    effect();
  }

  useEffect(() => {
    UserSettings.setLastTeamId(teamId);
    DbClient.teamId = teamId;
    dispatch(setTeam(teamId));
  }, [dispatch, teamId]);

  const loadAction = useMemo(() => {
    if (props.readonly) {
      return initialReadOnlyLoad;
    }

    return initialLoad;
  }, [props.readonly]);

  useWebsockets(
    teamId,
    (wsClient) => {
      const incrementalBlockUpdate = (_, blocks) => {
        const teamBlocks = blocks;

        batch(() => {
          dispatch(
            updateViews(
              teamBlocks.filter((b) => b.type === "view" || b.deleteAt !== 0)
            )
          );
          dispatch(
            updateCards(
              teamBlocks.filter((b) => b.type === "card" || b.deleteAt !== 0)
            )
          );
          dispatch(
            updateComments(
              teamBlocks.filter((b) => b.type === "comment" || b.deleteAt !== 0)
            )
          );
          dispatch(
            updateAttachments(
              teamBlocks.filter(
                (b) => b.type === "attachment" || b.deleteAt !== 0
              )
            )
          );
          dispatch(
            updateContents(
              teamBlocks.filter(
                (b) =>
                  b.type !== "card" &&
                  b.type !== "view" &&
                  b.type !== "board" &&
                  b.type !== "comment" &&
                  b.type !== "attachment"
              )
            )
          );
        });
      };

      const incrementalBoardUpdate = (_, boards) => {
        const teamBoards = boards.filter(
          (b) => b.teamId === Constants.globalTeamId || b.teamId === teamId
        );
        const activeBoard = teamBoards.find((b) => b.id === activeBoardId);
        dispatch(updateBoards(teamBoards));

        if (activeBoard) {
          dispatch(
            fetchBoardMembers({
              teamId,
              boardId: activeBoardId,
            })
          );
        }
      };

      const incrementalBoardMemberUpdate = (_, members) => {
        dispatch(updateMembersEnsuringBoardsAndUsers(members));

        if (person) {
          const myBoardMemberships = members.filter(
            (boardMember) => boardMember.userId === person.id
          );
          dispatch(addMyBoardMemberships(myBoardMemberships));
        }
      };

      const dispatchLoadAction = () => {
        dispatch(loadAction(match.params.boardId));
      };

      Logger.log("useWEbsocket adding onChange handler");
      wsClient.addOnChange(incrementalBlockUpdate, "block");
      wsClient.addOnChange(incrementalBoardUpdate, "board");
      wsClient.addOnChange(incrementalBoardMemberUpdate, "boardMembers");
      wsClient.addOnReconnect(dispatchLoadAction);

      wsClient.setOnFollowBlock((_, subscription) => {
        if (subscription.subscriberId === person?.id) {
          dispatch(followBlock(subscription));
        }
      });
      wsClient.setOnUnfollowBlock((_, subscription) => {
        if (subscription.subscriberId === person?.id) {
          dispatch(unfollowBlock(subscription));
        }
      });

      return () => {
        Logger.log("useWebsocket cleanup");
        wsClient.removeOnChange(incrementalBlockUpdate, "block");
        wsClient.removeOnChange(incrementalBoardUpdate, "board");
        wsClient.removeOnChange(incrementalBoardMemberUpdate, "boardMembers");
        wsClient.removeOnReconnect(dispatchLoadAction);
      };
    },
    [person?.id, activeBoardId]
  );

  const loadOrJoinBoard = useCallback(
    async (userId, boardTeamId, boardId) => {
      const result = await dispatch(loadBoardData(boardId));
      if (result.payload.blocks.length === 0 && userId) {
        const member = await DbClient.joinBoard(boardId);
        if (!member) {
          UserSettings.setLastBoardId(boardTeamId, null);
          UserSettings.setLastViewId(boardId, null);
          dispatch(setGlobalError("board-not-found"));
          return;
        }
        await dispatch(loadBoardData(boardId));
      }

      dispatch(
        fetchBoardMembers({
          teamId: boardTeamId,
          boardId,
        })
      );
    },
    [dispatch]
  );

  useEffect(() => {
    dispatch(loadAction(match.params.boardId));

    if (match.params.boardId) {
      // set the active board
      dispatch(setCurrentBoard(match.params.boardId));

      // and set it as most recently viewed board
      UserSettings.setLastBoardId(teamId, match.params.boardId);

      if (viewId !== Constants.globalTeamId) {
        // reset current, even if empty string
        dispatch(setCurrentView(viewId));
        if (viewId) {
          // don't reset per board if empty string
          UserSettings.setLastViewId(match.params.boardId, viewId);
        }
      }

      if (!props.readonly && person) {
        loadOrJoinBoard(person.id, teamId, match.params.boardId);
      }
    }
  }, [teamId, match.params.boardId, viewId, person.id, dispatch, loadAction, props.readonly, person, loadOrJoinBoard]);

  const handleUnhideBoard = async (boardId) => {
    Logger.log("handleUnhideBoard called");
    if (!person) {
      return;
    }

    const hiddenBoards = {
      ...(config.hiddenBoardIDs ? config.hiddenBoardIDs.value : {}),
    };

    delete hiddenBoards[boardId];
    const hiddenBoardsArray = Object.keys(hiddenBoards);
    const patch = {
      updatedFields: {
        hiddenBoardIDs: JSON.stringify(hiddenBoardsArray),
      },
    };
    const patchedProps = await DbClient.patchUserConfig(person.id, patch);
    if (!patchedProps) {
      return;
    }

    await dispatch(patchProps(patchedProps));
  };

  useEffect(() => {
    if (!teamId || !match.params.boardId) {
      return;
    }

    const hiddenBoardIDs = config.hiddenBoardIDs?.value || {};
    if (hiddenBoardIDs[match.params.boardId]) {
      handleUnhideBoard(match.params.boardId);
    }
  }, [dispatch, person.id, teamId, match.params.boardId, config.hiddenBoardIDs?.value, handleUnhideBoard]);

  return (
    <div className="BoardPage">
      {!props.new && <TeamToBoardAndViewRedirect />}
      <BackwardCompatibilityQueryParamsRedirect />
      <SetWindowTitleAndIcon />
      <UndoRedoHotKeys />
      <WebsocketConnection />
      <CloudMessage />
      <VersionMessage />

      {!mobileWarningClosed && (
        <div className="mobileWarning">
          <div>
            <Trans
              id="Error.mobileweb"
              message="Mobile web support is currently in early beta. Not all functionality may be present."
            />
          </div>
          <IconButton
            onClick={() => {
              UserSettings.mobileWarningClosed = true;
              setMobileWarningClosed(true);
            }}
            icon={<CloseIcon />}
            title="Close"
            className="margin-right"
          />
        </div>
      )}

      {props.readonly && activeBoardId === undefined && (
        <div className="error">
          {t({
            id: "BoardPage.syncFailed",
            message: "Board may be deleted or access revoked.",
          })}
        </div>
      )}

      {
        // Don't display Templates page
        // if readonly mode and no board defined.
        (!props.readonly || activeBoardId !== undefined) && (
          <Workspace readonly={props.readonly || false} />
        )
      }
    </div>
  );
};

export default BoardPage;
