import React, { useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Navigate,
  useMatch,
  useNavigate,
  generatePath,
  useLocation,
} from "react-router-dom";
import { createBrowserHistory } from "history";

import { useDispatch, useSelector } from "react-redux";

import BoardPage from "./pages/boardPage/boardPage";
import ChangePasswordPage from "./pages/changePasswordPage";
import WelcomePage from "./pages/welcome/welcomePage";
import ErrorPage from "./pages/errorPage";
import LoginPage from "./pages/loginPage";
import RegisterPage from "./pages/registerPage";
import { Utils } from "./utils";
import octoClient from "./octoClient";
import { setGlobalError, getGlobalError } from "./store/globalError";
import { getFirstTeam, fetchTeams } from "./store/teams";
import { UserSettings } from "./userSettings";
import MainRoute from "./route";

let window;

const UUID_REGEX = new RegExp(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
);

export const CounterComponent = ({ value }) => {
  const dispatch = useDispatch();

  return (
    <div>
      <span>{value}</span>
      <button onClick={() => dispatch({ type: "increment-counter" })}>
        Increment counter
      </button>
    </div>
  );
};

function HomeToCurrentTeam(props) {
  const dispatch = useDispatch();
  const firstTeam = useSelector(getFirstTeam);
  const effect = useEffect(() => {
    dispatch(fetchTeams());
  });

  return (
    <MainRoute
      path={props.path}
      exact={props.exact}
      loginRequired={true}
      component={() => {
        effect();
        let teamID =
          (window.getCurrentTeamId && window.getCurrentTeamId()) || "";
        const lastTeamID = UserSettings.getLastTeamId();
        if (!teamID && !firstTeam && !lastTeamID) {
          return <></>;
        }
        teamID = teamID || lastTeamID || firstTeam?.id || "";

        if (UserSettings.getLastBoardId()) {
          const lastBoardID = UserSettings.getLastBoardId()[teamID];
          const lastViewID = UserSettings.getLastViewId()[lastBoardID];

          if (lastBoardID && lastViewID) {
            return (
              <Navigate to={`/team/${teamID}/${lastBoardID}/${lastViewID}`} />
            );
          }
          if (lastBoardID) {
            return <Navigate to={`/team/${teamID}/${lastBoardID}`} />;
          }
        }

        return <Navigate to={`/team/${teamID}`} />;
      }}
    />
  );
}

function WorkspaceToTeamRedirect() {
  const match = useMatch();
  const queryParams = new URLSearchParams(useLocation().search);
  const history = useNavigate();

  useEffect(() => {
    octoClient.getBoard(match.params.boardId).then((board) => {
      if (board) {
        let newPath = generatePath(
          match.path.replace("/workspace/:workspaceId", "/team/:teamId"),
          {
            teamId: board?.teamId,
            boardId: board?.id,
            viewId: match.params.viewId,
            cardId: match.params.cardId,
          }
        );
        if (queryParams) {
          newPath += "?" + queryParams;
        }
        history.replace(newPath);
      }
    });
  }, [history, match.params.boardId, match.params.cardId, match.params.viewId, match.path, queryParams]);

  return null;
}

function GlobalErrorRedirect() {
  const dispatch = useDispatch();
  const globalError = useSelector(getGlobalError);

  const history = useNavigate();

  useEffect(() => {
    if (globalError) {
      dispatch(setGlobalError(""));
      history.replace(`/error?id=${globalError}`);
    }
  }, [dispatch, globalError, history]);

  return null;
}

const BoardRouter = function (props) {
  const isPlugin = Utils.isPlugin();
  const callmemo = useMemo(() => {
    return createBrowserHistory({ basename: Utils.getFrontendBaseURL() });
  }, []);

  let browserHistory;
  if (props.history) {
    browserHistory = props.history;
  } else {
    browserHistory = callmemo();
  }

  const effect = useEffect(() => {
    if (window.frontendBaseURL) {
      browserHistory.replace(
        window.location.pathname.replace(window.frontendBaseURL, "")
      );
    }
  });

  if (isPlugin) {
    effect();
  }

  return (
    <Router history={browserHistory}>
      <GlobalErrorRedirect />
      <Routes>
        {isPlugin && <HomeToCurrentTeam path="/" exact={true} />}
        {isPlugin && (
          <MainRoute exact={true} path="/welcome">
            <WelcomePage />
          </MainRoute>
        )}

        <MainRoute path="/error">
          <ErrorPage />
        </MainRoute>

        {!isPlugin && (
          <MainRoute path="/login">
            <LoginPage />
          </MainRoute>
        )}
        {!isPlugin && (
          <MainRoute path="/register">
            <RegisterPage />
          </MainRoute>
        )}
        {!isPlugin && (
          <MainRoute path="/change_password">
            <ChangePasswordPage />
          </MainRoute>
        )}

        <MainRoute path={["/team/:teamId/new/:channelId"]}>
          <BoardPage new={true} />
        </MainRoute>

        <MainRoute
          path={[
            "/team/:teamId/shared/:boardId?/:viewId?/:cardId?",
            "/shared/:boardId?/:viewId?/:cardId?",
          ]}
        >
          <BoardPage readonly={true} />
        </MainRoute>

        <MainRoute
          loginRequired={true}
          path="/board/:boardId?/:viewId?/:cardId?"
          getOriginalPath={({ params: { boardId, viewId, cardId } }) => {
            return `/board/${Utils.buildOriginalPath(
              "",
              boardId,
              viewId,
              cardId
            )}`;
          }}
        >
          <BoardPage />
        </MainRoute>
        <MainRoute
          path={[
            "/workspace/:workspaceId/shared/:boardId?/:viewId?/:cardId?",
            "/workspace/:workspaceId/:boardId?/:viewId?/:cardId?",
          ]}
        >
          <WorkspaceToTeamRedirect />
        </MainRoute>
        <MainRoute
          loginRequired={true}
          path="/team/:teamId/:boardId?/:viewId?/:cardId?"
          getOriginalPath={({
            params: { teamId, boardId, viewId, cardId },
          }) => {
            return `/team/${Utils.buildOriginalPath(
              teamId,
              boardId,
              viewId,
              cardId
            )}`;
          }}
        >
          <BoardPage />
        </MainRoute>

        {!isPlugin && (
          <MainRoute
            path="/:boardId?/:viewId?/:cardId?"
            loginRequired={true}
            getOriginalPath={({ params: { boardId, viewId, cardId } }) => {
              const boardIdIsValidUUIDV4 = UUID_REGEX.test(boardId || "");
              if (boardIdIsValidUUIDV4) {
                return `/${Utils.buildOriginalPath(
                  "",
                  boardId,
                  viewId,
                  cardId
                )}`;
              }
              return "";
            }}
          >
            <BoardPage />
          </MainRoute>
        )}
      </Routes>
    </Router>
  );
};

export default React.memo(BoardRouter);
