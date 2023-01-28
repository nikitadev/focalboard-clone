import React, { useCallback, useEffect, useState } from 'react';
import { generatePath, useMatch, useNavigate } from 'react-router-dom';
import { Trans } from '@lingui/macro';

import { getCurrentBoard, isLoadingBoard, getTemplates } from '../store/boards';
import { refreshCards, getCardLimitTimestamp, getCurrentBoardHiddenCardsCount, setLimitTimestamp, getCurrentViewCardsSortedFilteredAndGrouped, setCurrent as setCurrentCard } from '../store/cards';
import {
    getCurrentBoardViews,
    getCurrentViewGroupBy,
    getCurrentViewId,
    getCurrentViewDisplayBy,
    getCurrentView,
} from '../store/views';
import { useDispatch, useSelector } from "react-redux";

import { getClientConfig, setClientConfig } from '../store/clientConfig';

import { Utils } from '../utils';
import propsRegistry from '../properties';

import { getPerson, getConfig } from '../store/users';
import wsClient from '../wsclient'

import CenterPanel from './centerPanel';
import BoardTemplateSelector from './boardTemplateSelector/boardTemplateSelector';
import GuestNoBoards from './guestNoBoards';

import Sidebar from './sidebar/sidebar';

import './workspace.scss';

function CenterContent(props) {
    const isLoading = useSelector(isLoadingBoard);
    const match = useMatch();
    const board = useSelector(getCurrentBoard);
    const templates = useSelector(getTemplates);
    const cards = useSelector(getCurrentViewCardsSortedFilteredAndGrouped);
    const activeView = useSelector(getCurrentView);
    const views = useSelector(getCurrentBoardViews);
    const groupByProperty = useSelector(getCurrentViewGroupBy);
    const dateDisplayProperty = useSelector(getCurrentViewDisplayBy);
    const clientConfig = useSelector(getClientConfig);
    const hiddenCardsCount = useSelector(getCurrentBoardHiddenCardsCount);
    const cardLimitTimestamp = useSelector(getCardLimitTimestamp);
    const history = useNavigate();
    const dispatch = useDispatch();
    const config = useSelector(getConfig);
    const person = useSelector(getPerson);

    const isBoardHidden = () => {
        const hiddenBoardIDs = config.hiddenBoardIDs?.value || {};
        return hiddenBoardIDs[board.id];
    }

    const showCard = useCallback((cardId) => {
        const params = { ...match.params, cardId };
        let newPath = generatePath(Utils.getBoardPagePath(match.path), params);
        if (props.readonly) {
            newPath += `?r=${Utils.getReadToken()}`;
        }
        history.push(newPath);
        dispatch(setCurrentCard(cardId || ''));
    }, [match.params, match.path, props.readonly, history, dispatch]);

    useEffect(() => {
        const onConfigChangeHandler = (_, config) => {
            dispatch(setClientConfig(config));
        }
        wsClient.addOnConfigChange(onConfigChangeHandler);

        const onCardLimitTimestampChangeHandler = (_, timestamp) => {
            dispatch(setLimitTimestamp({ timestamp, templates }));
            if (cardLimitTimestamp > timestamp) {
                dispatch(refreshCards(timestamp));
            }
        }
        wsClient.addOnCardLimitTimestampChange(onCardLimitTimestampChangeHandler);

        return () => {
            wsClient.removeOnConfigChange(onConfigChangeHandler);
        }
    }, [cardLimitTimestamp, dispatch, match.params.boardId, templates]);

    const templateSelector = (
        <BoardTemplateSelector
            title={
                <Trans
                    id='BoardTemplateSelector.plugin.no-content-title'
                    message='Create a board'
                />
            }
            description={
                <Trans
                    id='BoardTemplateSelector.plugin.no-content-description'
                    message='Add a board to the sidebar using any of the templates defined below or start from scratch.'
                />
            }
            channelId={match.params.channelId}
        />
    )

    if (match.params.channelId) {
        if (person?.is_guest) {
            return <GuestNoBoards/>
        }
        return templateSelector
    }

    if (board && !isBoardHidden() && activeView) {
        let property = groupByProperty
        if ((!property || !propsRegistry.get(property.type).canGroup) && activeView.fields.viewType === 'board') {
            property = board?.cardProperties.find((o) => propsRegistry.get(o.type).canGroup)
        }

        let displayProperty = dateDisplayProperty
        if (!displayProperty && activeView.fields.viewType === 'calendar') {
            displayProperty = board.cardProperties.find((o) => propsRegistry.get(o.type))
        }

        return (
            <CenterPanel
                clientConfig={clientConfig}
                readonly={props.readonly}
                board={board}
                cards={cards}
                shownCardId={match.params.cardId}
                showCard={showCard}
                activeView={activeView}
                groupByProperty={property}
                dateDisplayProperty={displayProperty}
                views={views}
                hiddenCardsCount={hiddenCardsCount}
            />
        )
    }

    if ((board && !isBoardHidden()) || isLoading) {
        return null
    }

    return person?.is_guest ? <GuestNoBoards /> : templateSelector;
}

const Workspace = (props) => {
    const board = useSelector(getCurrentBoard);

    const viewId = useSelector(getCurrentViewId);
    const [boardTemplateSelectorOpen, setBoardTemplateSelectorOpen] = useState(false);

    const closeBoardTemplateSelector = useCallback(() => {
        setBoardTemplateSelectorOpen(false)
    }, []);
    const openBoardTemplateSelector = useCallback(() => {
        if (board) {
            setBoardTemplateSelectorOpen(true)
        }
    }, [board]);
    useEffect(() => {;
        setBoardTemplateSelectorOpen(false)
    }, [board, viewId]);

    return (
        <div className='Workspace'>
            {!props.readonly &&
                <Sidebar
                    onBoardTemplateSelectorOpen={openBoardTemplateSelector}
                    onBoardTemplateSelectorClose={closeBoardTemplateSelector}
                    activeBoardId={board?.id}
                />
            }
            <div className='mainFrame'>
                {boardTemplateSelectorOpen &&
                    <BoardTemplateSelector onClose={closeBoardTemplateSelector} />}
                {(board?.isTemplate) &&
                    <div className='banner'>
                        <Trans
                            id='Workspace.editing-board-template'
                            defaultMessage="You're editing a board template."
                        />
                    </div>}
                <CenterContent
                    readonly={props.readonly}
                />
            </div>
        </div>
    );
}

export default React.memo(Workspace);
