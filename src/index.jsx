import React from "react";
import ReactDOM from "react-dom";
import { Provider as ReduxProvider } from "react-redux";
import { Store as emojiMartStore } from "emoji-mart";

import App from "./app";
import { initThemes } from "./theme";
import { importNativeAppSettings } from "./nativeApp";
import { UserSettings } from "./userSettings";

/* import { getMe } from "./store/users";
import { useSelector } from "react-redux"; */

import reportWebVitals from "./reportWebVitals";

import "@mattermost/compass-icons/css/compass-icons.css";

import "./styles/variables.scss";
import "./styles/main.scss";
import "./styles/labels.scss";
import "./styles/_markdown.scss";

import store from "./store";

emojiMartStore.setHandlers({
  getter: UserSettings.getEmojiMartSetting,
  setter: UserSettings.setEmojiMartSetting,
});
importNativeAppSettings();
initThemes();

const MainApp = () => {
  // const me = useSelector(getMe);

  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ReduxProvider store={store}>
    <MainApp />
  </ReduxProvider>,
  document.getElementById("focalboard-app")
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

