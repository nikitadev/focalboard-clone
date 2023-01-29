import React from "react";

import { Trans } from '@lingui/macro'

import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import BoardWelcomePNG from "../../static/boards-welcome.png";
import BoardWelcomeSmallPNG from "../../static/boards-welcome-small.png";

import Button from "../../widgets/buttons/button";
import CompassIcon from "../../widgets/icons/compassIcon";
import { Utils } from "../../utils";

import "./welcomePage.scss";
import mutator from "../../mutator";
import { fetchPerson, getPerson, getConfig, patchProps } from "../../store/users";
import { getCurrentTeam } from "../../store/teams";
import DbClient from "../../DbClient";
import { FINISHED, TOUR_ORDER } from "../../components/onboardingTour";

import { UserSettingKey } from "../../userSettings";

const WelcomePage = () => {
  const history = useNavigate();
  const queryString = new URLSearchParams(useLocation().search);
  const person = useSelector(getPerson);
  const config = useSelector(getConfig);
  const currentTeam = useSelector(getCurrentTeam);
  const dispatch = useDispatch();

  const setWelcomePageViewed = async (userID) => {
    const patch = {};
    patch.updatedFields = {};
    patch.updatedFields[UserSettingKey.WelcomePageViewed] = "1";

    const updatedProps = await mutator.patchUserConfig(userID, patch);
    if (updatedProps) {
      return dispatch(patchProps(updatedProps));
    }

    return Promise.resolve();
  };

  const goForward = () => {
    if (queryString.get("r")) {
      history.replace(queryString.get("r"));
      return;
    }
    if (currentTeam) {
      history.replace(`/team/${currentTeam?.id}`);
    } else {
      history.replace("/");
    }
  };

  const skipTour = async () => {
    if (person) {
      await setWelcomePageViewed(person.id);
      const patch = {
        updatedFields: {
          tourCategory: TOUR_ORDER[TOUR_ORDER.length - 1],
          onboardingTourStep: FINISHED.toString(),
        },
      };

      const patchedProps = await DbClient.patchUserConfig(person.id, patch);
      if (patchedProps) {
        await dispatch(patchProps(patchedProps));
      }
    }

    goForward();
  };

  const startTour = async () => {
    if (!person) {
      return;
    }
    if (!currentTeam) {
      return;
    }

    await setWelcomePageViewed(person.id);
    const onboardingData = await DbClient.prepareOnboarding(currentTeam.id);
    await dispatch(fetchPerson());
    const newPath = `/team/${onboardingData?.teamID}/${onboardingData?.boardID}`;
    history.replace(newPath);
  };

  // It's still possible for a guest to end up at this route/page directly, so
  // let's mark it as viewed, if necessary, and route them forward
  if (person?.is_guest) {
    if (!config[UserSettingKey.WelcomePageViewed]) {
      (async () => {
        await setWelcomePageViewed(person.id);
      })();
    }
    goForward();
    return null;
  }

  if (config[UserSettingKey.WelcomePageViewed]) {
    goForward();
    return null;
  }

  return (
    <div className="WelcomePage">
      <div className="wrapper">
        <h1 className="text-heading9">
          <Trans
            id="WelcomePage.Heading"
            message="Welcome To Boards"
          />
        </h1>
        <div className="WelcomePage__subtitle">
          <Trans
            id="WelcomePage.Description"
            message="Boards is a project management tool that helps define, organize, track, and manage work across teams using a familiar Kanban board view."
          />
        </div>

        {/* This image will be rendered on large screens over 2000px */}
        <img
          src={Utils.buildURL(BoardWelcomePNG, true)}
          className="WelcomePage__image WelcomePage__image--large"
          alt="Boards Welcome Image"
        />

        {/* This image will be rendered on small screens below 2000px */}
        <img
          src={Utils.buildURL(BoardWelcomeSmallPNG, true)}
          className="WelcomePage__image WelcomePage__image--small"
          alt="Boards Welcome Image"
        />

        {person?.is_guest !== true && (
          <Button
            onClick={startTour}
            filled={true}
            size="large"
            icon={
              <CompassIcon icon="chevron-right" className="Icon Icon--right" />
            }
            rightIcon={true}
          >
            <Trans
              id="WelcomePage.Explore.Button"
              message="Take a tour"
            />
          </Button>
        )}

        {person?.is_guest !== true && (
          <a className="skip" onClick={skipTour}>
            <Trans
              id="WelcomePage.NoThanks.Text"
              message="No thanks, I'll figure it out myself"
            />
          </a>
        )}
        {person?.is_guest === true && (
          <Button onClick={skipTour} filled={true} size="large">
            <Trans
              id="WelcomePage.StartUsingIt.Text"
              message="Start using it"
            />
          </Button>
        )}
      </div>
    </div>
  );
};

export default React.memo(WelcomePage);
