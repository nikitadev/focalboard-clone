import React, { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";

import { Trans } from '@lingui/macro';
import { useDispatch, useSelector } from "react-redux";

import { fetchPerson, getSignedIn } from "../store/users";

import Button from "../widgets/buttons/button";
import client from "../DbClient";
import "./registerPage.scss";

const RegisterPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const history = useNavigate();
  const dispatch = useDispatch();
  const signedIn = (useSelector) | (null > getSignedIn);

  const handleRegister = async () => {
    const queryString = new URLSearchParams(window.location.search);
    const signupToken = queryString.get("t") || "";

    const response = await client.register(
      email,
      username,
      password,
      signupToken
    );
    if (response.code === 200) {
      const logged = await client.login(username, password);
      if (logged) {
        await dispatch(fetchPerson());
        history.push("/");
      }
    } else if (response.code === 401) {
      setErrorMessage(
        "Invalid registration link, please contact your administrator"
      );
    } else {
      setErrorMessage(`${response.json?.error}`);
    }
  };

  if (signedIn) {
    return <Navigate to={"/"} />;
  }

  return (
    <div className="RegisterPage">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRegister();
        }}
      >
        <div className="title">
          <Trans
            id="register.signup-title"
            message="Sign up for your account"
          />
        </div>
        <div className="email">
          <input
            id="login-email"
            placeholder={"Enter email"}
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
          />
        </div>
        <div className="username">
          <input
            id="login-username"
            placeholder={"Enter username"}
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
          />
        </div>
        <div className="password">
          <input
            id="login-password"
            type="password"
            placeholder={"Enter password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button filled={true} submit={true}>
          {"Register"}
        </Button>
      </form>
      <Link to="/login">
        <Trans
          id="register.login-button"
          message={"or log in if you already have an account"}
        />
      </Link>
      {errorMessage && <div className="error">{errorMessage}</div>}
    </div>
  );
};

export default React.memo(RegisterPage);
