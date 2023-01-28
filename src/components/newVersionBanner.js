import React, { useState, useEffect } from "react";
import { Trans } from "@lingui/react";

import wsClient from "../wsclient";

import "./newVersionBanner.scss";

const NewVersionBanner = () => {
  const [appVersionChanged, setAppVersionChanged] = useState(false);
  useEffect(() => {
    wsClient.onAppVersionChangeHandler = setAppVersionChanged;
  }, []);

  if (!appVersionChanged) {
    return null;
  }

  const newVersionReload = function (e) {
    e.preventDefault();
    // location.reload();
  };

  return (
    <div className="NewVersionBanner">
      <a target="_blank" rel="noreferrer" onClick={newVersionReload}>
        <Trans
          id="BoardPage.newVersion"
          comment="A new version of Boards is available, click here to reload."
        />
      </a>
    </div>
  );
};

export default NewVersionBanner;
