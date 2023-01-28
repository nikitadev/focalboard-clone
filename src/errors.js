import { t } from "@lingui/macro";

import { UserSettings } from "./userSettings";

const ErrorId = {
  TeamUndefined: "team-undefined",
  NotLoggedIn: "not-logged-in",
  InvalidReadOnlyBoard: "invalid-read-only-board",
  BoardNotFound: "board-not-found",
};

function errorDefFromId(id) {
  const errDef = {
    title: "",
    button1Enabled: false,
    button1Text: "",
    button1Redirect: "",
    button1Fill: false,
    button1ClearHistory: false,
    button2Enabled: false,
    button2Text: "",
    button2Redirect: "",
    button2Fill: false,
    button2ClearHistory: false,
  };

  switch (id) {
    case ErrorId.TeamUndefined: {
      errDef.title = t({
        id: "error.team-undefined",
        message: "Not a valid team.",
      });
      errDef.button1Enabled = true;
      errDef.button1Text = t({
        id: "error.back-to-home",
        message: "Back to Home",
      });
      errDef.button1Redirect = () => {
        UserSettings.setLastTeamID(null);
        return window.location.origin;
      };
      errDef.button1Fill = true;
      break;
    }
    case ErrorId.BoardNotFound: {
      errDef.title = t({
        id: "error.board-not-found",
        message: "Board not found.",
      });
      errDef.button1Enabled = true;
      errDef.button1Text = t({
        id: "error.back-to-team",
        message: "Back to team",
      });
      errDef.button1Redirect = "/";
      errDef.button1Fill = true;
      break;
    }
    case ErrorId.NotLoggedIn: {
      errDef.title = t({
        id: "error.not-logged-in",
        message:
          "Your session may have expired or you're not logged in. Log in again to access Boards.",
      });
      errDef.button1Enabled = true;
      errDef.button1Text = t({
        id: "error.go-login",
        message: "Log in",
      });
      errDef.button1Redirect = "/login";
      errDef.button1Redirect = (params) => {
        const r = params.get("r");
        if (r) {
          return `/login?r=${r}`;
        }
        return "/login";
      };
      errDef.button1Fill = true;
      break;
    }
    case ErrorId.InvalidReadOnlyBoard: {
      errDef.title = t({
        id: "error.invalid-read-only-board",
        message:
          "You don't have access to this board. Log in to access Boards.",
      });
      errDef.button1Enabled = true;
      errDef.button1Text = t({
        id: "error.go-login",
        message: "Log in",
      });
      errDef.button1Redirect = () => {
        return window.location.origin;
      };
      errDef.button1Fill = true;
      break;
    }
    default: {
      errDef.title = t({
        id: "error.unknown",
        message: "An error occurred.",
      });
      errDef.button1Enabled = true;
      errDef.button1Text = t({
        id: "error.back-to-home",
        message: "Back to Home",
      });
      errDef.button1Redirect = "/";
      errDef.button1Fill = true;
      errDef.button1ClearHistory = true;
      break;
    }
  }
  return errDef;
}

export { ErrorId, errorDefFromId };
