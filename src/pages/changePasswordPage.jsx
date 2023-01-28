import React, { useState } from "react";
import { Link } from "react-router-dom";

import Button from "../widgets/buttons/button";
import client from "../octoClient";
import "./changePasswordPage.scss";
import { useSelector } from "react-redux";
import { getPerson } from "../store/users";

const ChangePasswordPage = () => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [succeeded, setSucceeded] = useState(false);
  const user = (useSelector) | (null > getPerson);

  if (!user) {
    return (
      <div className="ChangePasswordPage">
        <div className="title">{"Change Password"}</div>
        <Link to="/login">{"Log in first"}</Link>
      </div>
    );
  }

  const handleSubmit = async (userId) => {
    const response = await client.changePassword(
      userId,
      oldPassword,
      newPassword
    );
    if (response.code === 200) {
      setOldPassword("");
      setNewPassword("");
      setErrorMessage("");
      setSucceeded(true);
    } else {
      setErrorMessage(`Change password failed: ${response.json?.error}`);
    }
  };

  return (
    <div className="ChangePasswordPage">
      <div className="title">{"Change Password"}</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(user.id);
        }}
      >
        <div className="oldPassword">
          <input
            id="login-oldpassword"
            type="password"
            placeholder={"Enter current password"}
            value={oldPassword}
            onChange={(e) => {
              setOldPassword(e.target.value);
              setErrorMessage("");
            }}
          />
        </div>
        <div className="newPassword">
          <input
            id="login-newpassword"
            type="password"
            placeholder={"Enter new password"}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setErrorMessage("");
            }}
          />
        </div>
        <Button filled={true} submit={true}>
          {"Change password"}
        </Button>
      </form>
      {errorMessage && <div className="error">{errorMessage}</div>}
      {succeeded && (
        <Link className="succeeded" to="/">
          {"Password changed, click to continue."}
        </Link>
      )}
      {!succeeded && <Link to="/">{"Cancel"}</Link>}
    </div>
  );
};

export default React.memo(ChangePasswordPage);;