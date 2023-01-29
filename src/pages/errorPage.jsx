import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trans } from '@lingui/macro';

import ErrorIllustration from '../svg/error-illustration';

import Button from '../widgets/buttons/button';
import './errorPage.scss';

import { errorDefFromId, ErrorId } from '../errors';
import { Utils } from '../utils';

const ErrorPage = () => {
  const history = useNavigate();
  const queryParams = new URLSearchParams(useLocation().search);
  const errid = queryParams.get('id');
  const errorDef = errorDefFromId(errid);

  const handleButtonClick = useCallback((path) => {
    let url = '/';
    if (typeof path === 'function') {
      url = path(queryParams);
    } else if (path) {
      url = path;
    }
    if (url === window.location.origin) {
      window.location.href = url;
    } else {
      history.push(url);
    }
  }, [history, queryParams]);

  const makeButton = ((path, txt, fill) => {
    return (
      <Button
        filled={fill}
        size='large'
        onClick={async () => {
          handleButtonClick(path);
        }}
      >
        {txt}
      </Button>
    );
  });

    if (!Utils.isPlugin() && errid === ErrorId.NotLoggedIn) {
      handleButtonClick(errorDef.button1Redirect);
    }

    return (
        <div className='ErrorPage'>
            <div>
                <div className='title'>
                    <Trans
                        id='error.page.title'
                        message={'Sorry, something went wrong'}
                    />
                </div>
                <div className='subtitle'>
                    {errorDef.title}
                </div>
                <ErrorIllustration/>
                <br/>
                {
                    (errorDef.button1Enabled ? makeButton(errorDef.button1Redirect, errorDef.button1Text, errorDef.button1Fill) : null)
                }
                {
                    (errorDef.button2Enabled ? makeButton(errorDef.button2Redirect, errorDef.button2Text, errorDef.button2Fill) : null)
                }
            </div>
        </div>
    )
}

export default React.memo(ErrorPage);