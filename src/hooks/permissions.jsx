import { useSelector } from "react-redux";
import { getMyBoardMembership, getCurrentBoardId, getBoard } from '../store/boards';
import { getCurrentTeam } from '../store/teams';
import { Utils } from '../utils';
import { Permission } from '../constants';
import { MemberRole } from '../blocks/board';

export const useHasPermissions = (teamId, boardId, permissions) => {
    if (!boardId || !teamId) {
        return false;
    }

    const member = useSelector(() => getMyBoardMembership(boardId));
    const board = useSelector(() => getBoard(boardId));

    if (!board) {
        return false;
    }

    if (!member) {
        return false;
    }

    if (!Utils.isFocalboardPlugin()) {
        return true;
    }

    const adminPermissions = [Permission.ManageBoardType, Permission.DeleteBoard, Permission.ShareBoard, Permission.ManageBoardRoles, Permission.DeleteOthersComments];
    const editorPermissions = [Permission.ManageBoardCards, Permission.ManageBoardProperties];
    const commenterPermissions = [Permission.CommentBoardCards];
    const viewerPermissions = [Permission.ViewBoard];

    for (const permission of permissions) {
        if (adminPermissions.includes(permission) && member.schemeAdmin) {
            return true;
        }
        if (editorPermissions.includes(permission) && (member.schemeAdmin || member.schemeEditor || board.minimumRole === MemberRole.Editor)) {
            return true;
        }
        if (commenterPermissions.includes(permission) && (member.schemeAdmin || member.schemeEditor || member.schemeCommenter || board.minimumRole === MemberRole.Commenter || board.minimumRole === MemberRole.Editor)) {
            return true;
        }
        if (viewerPermissions.includes(permission) && (member.schemeAdmin || member.schemeEditor || member.schemeCommenter || member.schemeViewer || board.minimumRole === MemberRole.Viewer || board.minimumRole === MemberRole.Commenter || board.minimumRole === MemberRole.Editor)) {
            return true;
        }
    }
    return false;
}

export const useHasCurrentTeamPermissions = (boardId, permissions) => {
    const currentTeam = useSelector(getCurrentTeam);
    return useHasPermissions(currentTeam?.id || '', boardId, permissions);
}

export const useHasCurrentBoardPermissions = (permissions) => {
    const currentBoardId = useSelector(getCurrentBoardId);

    return useHasCurrentTeamPermissions(currentBoardId || '', permissions);
}
