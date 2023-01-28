import React from 'react';

import './button.scss';
import { Utils } from '../../utils';

function Button(props) {
    const classNames = {
        Button: true,
        active: !!props.active,
        filled: !!props.filled,
        danger: !!props.danger,
    };
    classNames[`emphasis--${props.emphasis}`] = !!props.emphasis;
    classNames[`size--${props.size}`] = !!props.size;
    classNames[`${props.className}`] = !!props.className;

    return (
        <button
            type={props.submit ? 'submit' : 'button'}
            onClick={props.onClick}
            onMouseOver={props.onMouseOver}
            onMouseLeave={props.onMouseLeave}
            className={Utils.generateClassName(classNames)}
            title={props.title}
            onBlur={props.onBlur}
            disabled={props?.disabled}
        >
            {!props.rightIcon && props.icon}
            <span>{props.children}</span>
            {props.rightIcon && props.icon}
        </button>
    );
}

export default React.memo(Button);
