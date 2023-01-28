import React from 'react';

import DropdownIcon from '../icons/dropdown';
import MenuWrapper from '../menuWrapper';

import './buttonWithMenu.scss';

function ButtonWithMenu(props) {
    return (
        <div
            onClick={props.onClick}
            className='ButtonWithMenu'
            title={props.title}
        >
            <div className='button-text'>
                {props.text}
            </div>
            <MenuWrapper stopPropagationOnToggle={true}>
                <div className='button-dropdown'>
                    <DropdownIcon />
                </div>
                {props.children}
            </MenuWrapper>
        </div>
    );
}

export default React.memo(ButtonWithMenu);
