import React from 'react';

export default function CompassIcon(props) {
    return (
        <i className={`CompassIcon icon-${props.icon}${props.className === undefined ? '' : ` ${props.className}`}`} />
    );
}
