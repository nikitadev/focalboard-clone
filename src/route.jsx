import React from "react";
import { Navigate, Route } from "react-router-dom";

import { useSelector } from "react-redux";

import { Utils } from "./utils";
import { getSignedIn, getPerson, getConfig } from "./store/users";
import { UserSettingKey } from "./userSettings";
import { getClientConfig } from "./store/clientConfig";

function MainRoute(props) {
  const signedIn = useSelector(getSignedIn);
  const person = useSelector(getPerson);
  const config = useSelector(getConfig);
  const clientConfig = useSelector(getClientConfig);

  let redirect = null;

  // No FTUE for guests
  const disableTour =
    person?.is_guest || clientConfig?.featureFlags?.disableTour || false;

  const showWelcomePage =
    !disableTour &&
    Utils.isPlugin() &&
    person?.id !== "single-user" &&
    props.path !== "/welcome" &&
    signedIn === true &&
    !config[UserSettingKey.WelcomePageViewed];

  if (showWelcomePage) {
    redirect = ({ match }) => {
      if (props.getOriginalPath) {
        return <Navigate to={`/welcome?r=${props.getOriginalPath(match)}`} />;
      }
      return <Navigate to="/welcome" />;
    };
  }

  if (redirect === null && signedIn === false && props.loginRequired) {
    redirect = ({ match }) => {
      if (props.getOriginalPath) {
        let redirectUrl = "/" + Utils.buildURL(props.getOriginalPath(match));
        if (redirectUrl.indexOf("//") === 0) {
          redirectUrl = redirectUrl.slice(1);
        }
        const loginUrl = `/error?id=not-logged-in&r=${encodeURIComponent(
          redirectUrl
        )}`;
        return <Navigate to={loginUrl} />;
      }
      return <Navigate to="/error?id=not-logged-in" />;
    };
  }

  return (
    <Route
      path={props.path}
      render={props.render}
      component={props.component}
      exact={props.exact}
    >
      {redirect || props.children}
    </Route>
  );
}

export default React.memo(MainRoute);
