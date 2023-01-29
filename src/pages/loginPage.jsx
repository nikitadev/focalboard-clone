import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { Trans } from '@lingui/macro';

import { useDispatch, useSelector } from "react-redux";

import { fetchPerson, getSignedIn } from "../store/users";

import Button from "../widgets/buttons/button";
import client from "../DbClient";
import "./loginPage.scss";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const dispatch = useDispatch();
  const signedIn = useSelector(getSignedIn);
  const queryParams = new URLSearchParams(useLocation().search);
  const history = useNavigate();

  const handleLogin = async () => {
    const signed = await client.login(username, password);
    if (signed) {
      await dispatch(fetchPerson());
      if (queryParams) {
        history.push(queryParams.get("r") || "/");
      } else {
        history.push("/");
      }
    } else {
      setErrorMessage("Login failed");
    }
  };

  if (signedIn) {
    return <Navigate to={"/"} />;
  }

  return (
    <div className="LoginPage">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <div className="title">
          <Trans id="login.log-in-title" message="Log in" />
        </div>
        <div className="username">
          <input
            id="login-username"
            placeholder={"Enter username"}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setErrorMessage("");
            }}
          />
        </div>
        <div className="password">
          <input
            id="login-password"
            type="password"
            placeholder={"Enter password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorMessage("");
            }}
          />
        </div>
        <Button filled={true} submit={true}>
          <Trans id="login.log-in-button" message="Log in" />
        </Button>
      </form>
      <Link to="/register">
        <Trans
          id="login.register-button"
          message={"or create an account if you don't have one"}
        />
      </Link>
      {errorMessage && <div className="error">{errorMessage}</div>}
    </div>
  );
};

export default React.memo(LoginPage);
