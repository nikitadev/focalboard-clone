import React from 'react';

import './iconButton.scss';
import { Utils } from '../../utils';

function IconButton(props) {
    const classNames = {
        IconButton: true,
        'style--inverted': Boolean(props.inverted),
    };
    classNames[`${props.className}`] = Boolean(props.className);
    classNames[`size--${props.size}`] = Boolean(props.size);

    return (
        <button
            type='button'
            onClick={props.onClick}
            onMouseDown={props.onMouseDown}
            className={Utils.generateClassName(classNames)}
            title={props.title}
            aria-label={props.title}
        >
            {props.icon}
        </button>
    );
}

export default React.memo(IconButton);
