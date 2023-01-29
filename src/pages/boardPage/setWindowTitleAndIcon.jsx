import { useEffect } from "react";

import { Utils } from "../../utils";
import { getCurrentBoard } from "../../store/boards";
import { getCurrentView } from "../../store/views";
import { useSelector } from "react-redux";

const SetWindowTitleAndIcon = () => {
  const board = useSelector(getCurrentBoard);
  const activeView = useSelector(getCurrentView);

  useEffect(() => {
    Utils.setFavicon(board?.icon);
  }, [board?.icon]);

  useEffect(() => {
    if (board) {
      let title = `${board.title}`;
      if (activeView?.title) {
        title += ` | ${activeView.title}`;
      }
      document.title = title;
    } else if (Utils.isPlugin()) {
      document.title = "Boards - Mattermost";
    } else {
      document.title = "Focalboard";
    }
  }, [board.title, activeView.title, board]);

  return null;
};

export default SetWindowTitleAndIcon;
