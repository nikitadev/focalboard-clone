import React, { useEffect } from 'react';
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

import messages_en from "./locales/en.json";
import messages_ru from "./locales/ru.json";

import { FlashMessages } from './components/flashMessages';
import NewVersionBanner from './components/newVersionBanner';
import { fetchPerson } from './store/users';
import { fetchLanguage } from './store/language';
import { useDispatch } from "react-redux";
import { fetchClientConfig } from './store/clientConfig';
import BoardRouter from './router';

const App = (props) => {

  i18n.load({
    en: messages_en,
    ru: messages_ru,
  });
  i18n.activate("ru");
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchLanguage());
    dispatch(fetchPerson());
    dispatch(fetchClientConfig());
  }, [dispatch]);

  return (
    <I18nProvider i18n={i18n}>
      <FlashMessages milliseconds={2000} />
      <div id='frame'>
        <div id='main'>
          <NewVersionBanner />
          <BoardRouter history={props.history} />
        </div>
      </div>
    </I18nProvider>
  )
}

export default React.memo(App);