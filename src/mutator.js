import { batch } from "react-redux";
import cloneDeep from "lodash/cloneDeep";
import { t } from "@lingui/macro";

import { BlockIcons } from "./blockIcons";
import { createPatchesFromBlocks } from "./blocks/block";
import {
  createBoard,
  createPatchesFromBoards,
  createPatchesFromBoardsAndBlocks,
  createCardPropertiesPatches,
} from "./blocks/board";
import { createBoardView } from "./blocks/boardView";
import { createCard } from "./blocks/card";
import octoClient from "./octoClient";
import { manager } from "./undoManager";
import { Utils, IDType } from "./utils";
import { Logger } from "./logger";
import { UserSettings } from "./userSettings";

/* eslint-disable max-lines */
import store from "./store";
import { updateBoards } from "./store/boards";
import { updateViews } from "./store/views";
import { updateCards } from "./store/cards";
import { updateComments } from "./store/comments";
import { updateContents } from "./store/contents";
import { addBoardUsers, removeBoardUsersById } from "./store/users";

function updateAllBoardsAndBlocks(boards, blocks) {
  return batch(() => {
    store.dispatch(updateBoards(boards.filter((b) => b.deleteAt !== 0)));
    store.dispatch(
      updateViews(blocks.filter((b) => b.type === "view" || b.deleteAt !== 0))
    );
    store.dispatch(
      updateCards(blocks.filter((b) => b.type === "card" || b.deleteAt !== 0))
    );
    store.dispatch(
      updateComments(
        blocks.filter((b) => b.type === "comment" || b.deleteAt !== 0)
      )
    );
    store.dispatch(
      updateContents(
        blocks.filter(
          (b) =>
            b.type !== "card" &&
            b.type !== "view" &&
            b.type !== "board" &&
            b.type !== "comment"
        )
      )
    );
  });
}

class Mutator {
  #groupId;
  #displayId;

  #startUndoGroup() {
    if (this.groupId) {
      Logger.assertRefusal("manager does not support nested groups");
      return undefined;
    }
    this.groupId = Utils.newGuid(IDType.None);

    return this.groupId;
  }

  #endUndoGroup(groupId) {
    if (this.groupId !== groupId) {
      Logger.assertRefusal(
        "Mismatched groupId. manager does not support nested groups"
      );
      return;
    }
    this.groupId = undefined;
  }

  async performAsUndoGroup(actions) {
    const groupId = this.startUndoGroup();
    try {
      await actions();
    } catch (err) {
      Logger.assertRefusal(`ERROR: ${err}`);
    }
    if (groupId) {
      this.endUndoGroup(groupId);
    }
  }

  async updateBlock(boardId, newBlock, oldBlock, description) {
    const [updatePatch, undoPatch] = createPatchesFromBlocks(
      newBlock,
      oldBlock
    );
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, newBlock.id, updatePatch);
      },
      async () => {
        await octoClient.patchBlock(boardId, oldBlock.id, undoPatch);
      },
      description,
      this.groupId
    );
  }

  async #updateBlocks(boardId, newBlocks, oldBlocks, description) {
    if (newBlocks.length !== oldBlocks.length) {
      throw new Error(
        "new and old blocks must have the same length when updating blocks"
      );
    }

    const updatePatches = [];
    const undoPatches = [];

    newBlocks.forEach((newBlock, i) => {
      const [updatePatch, undoPatch] = createPatchesFromBlocks(
        newBlock,
        oldBlocks[i]
      );
      updatePatches.push(updatePatch);
      undoPatches.push(undoPatch);
    });

    return manager.perform(
      async () => {
        await Promise.all(
          updatePatches.map((patch, i) =>
            octoClient.patchBlock(boardId, newBlocks[i].id, patch)
          )
        );
      },
      async () => {
        await Promise.all(
          undoPatches.map((patch, i) =>
            octoClient.patchBlock(boardId, newBlocks[i].id, patch)
          )
        );
      },
      description,
      this.groupId
    );
  }

  async insertBlock(
    boardId,
    block,
    description = "add",
    afterRedo,
    beforeUndo
  ) {
    return manager.perform(
      async () => {
        const res = await octoClient.insertBlock(boardId, block);
        const jsonres = await res.json();
        const newBlock = jsonres[0];
        await afterRedo?.(newBlock);
        return newBlock;
      },
      async (newBlock) => {
        await beforeUndo?.(newBlock);
        await octoClient.deleteBlock(boardId, newBlock.id);
      },
      description,
      this.groupId
    );
  }

  async insertBlocks(
    boardId,
    blocks,
    description = "add",
    afterRedo,
    beforeUndo,
    sourceBoardID
  ) {
    return manager.perform(
      async () => {
        const res = await octoClient.insertBlocks(
          boardId,
          blocks,
          sourceBoardID
        );
        const newBlocks = await res.json();
        updateAllBoardsAndBlocks([], newBlocks);
        await afterRedo?.(newBlocks);
        return newBlocks;
      },
      async (newBlocks) => {
        await beforeUndo?.();
        const awaits = [];
        for (const block of newBlocks) {
          awaits.push(octoClient.deleteBlock(boardId, block.id));
        }
        await Promise.all(awaits);
      },
      description,
      this.groupId
    );
  }

  async deleteBlock(block, description, beforeRedo, afterUndo) {
    const actualDescription = description || `delete ${block.type}`;

    await manager.perform(
      async () => {
        await beforeRedo?.();
        await octoClient.deleteBlock(block.boardId, block.id);
      },
      async () => {
        await octoClient.undeleteBlock(block.boardId, block.id);
        await afterUndo?.();
      },
      actualDescription,
      this.groupId
    );
  }

  async createBoardsAndBlocks(bab, description = "add", afterRedo, beforeUndo) {
    return manager.perform(
      async () => {
        const res = await octoClient.createBoardsAndBlocks(bab);
        const newBab = await res.json();
        await afterRedo?.(newBab);
        return newBab;
      },
      async (newBab) => {
        await beforeUndo?.(newBab);

        const boardIds = newBab.boards.map((b) => b.id);
        const blockIds = newBab.blocks.map((b) => b.id);
        await octoClient.deleteBoardsAndBlocks(boardIds, blockIds);
      },
      description,
      this.groupId
    );
  }

  async updateBoard(newBoard, oldBoard, description) {
    const [updatePatch, undoPatch] = createPatchesFromBoards(
      newBoard,
      oldBoard
    );
    await manager.perform(
      async () => {
        await octoClient.patchBoard(newBoard.id, updatePatch);
      },
      async () => {
        await octoClient.patchBoard(oldBoard.id, undoPatch);
      },
      description,
      this.groupId
    );
  }

  async deleteBoard(board, description, afterRedo, beforeUndo) {
    await manager.perform(
      async () => {
        await octoClient.deleteBoard(board.id);
        await afterRedo?.(board);
      },
      async () => {
        await beforeUndo?.(board);
        await octoClient.undeleteBoard(board.id);
      },
      description,
      this.groupId
    );
  }

  async changeBlockTitle(
    boardId,
    blockId,
    oldTitle,
    newTitle,
    description = "change block title"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, blockId, { title: newTitle });
      },
      async () => {
        await octoClient.patchBlock(boardId, blockId, { title: oldTitle });
      },
      description,
      this.groupId
    );
  }

  async changeBoardTitle(
    boardId,
    oldTitle,
    newTitle,
    description = "change board title"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBoard(boardId, { title: newTitle });
      },
      async () => {
        await octoClient.patchBoard(boardId, { title: oldTitle });
      },
      description,
      this.groupId
    );
  }

  async setDefaultTemplate(
    boardId,
    blockId,
    oldTemplateId,
    templateId,
    description = "set default template"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, blockId, {
          updatedFields: { defaultTemplateId: templateId },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, blockId, {
          updatedFields: { defaultTemplateId: oldTemplateId },
        });
      },
      description,
      this.groupId
    );
  }

  async clearDefaultTemplate(
    boardId,
    blockId,
    oldTemplateId,
    description = "set default template"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, blockId, {
          updatedFields: { defaultTemplateId: "" },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, blockId, {
          updatedFields: { defaultTemplateId: oldTemplateId },
        });
      },
      description,
      this.groupId
    );
  }

  async changeBoardIcon(
    boardId,
    oldIcon,
    icon,
    description = "change board icon"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBoard(boardId, { icon });
      },
      async () => {
        await octoClient.patchBoard(boardId, { icon: oldIcon });
      },
      description,
      this.groupId
    );
  }

  async changeBlockIcon(
    boardId,
    blockId,
    oldIcon,
    icon,
    description = "change block icon"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, blockId, {
          updatedFields: { icon },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, blockId, {
          updatedFields: { icon: oldIcon },
        });
      },
      description,
      this.groupId
    );
  }

  async changeBoardDescription(
    boardId,
    blockId,
    oldBlockDescription,
    blockDescription,
    description = "change description"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBoard(boardId, { description: blockDescription });
      },
      async () => {
        await octoClient.patchBoard(boardId, {
          description: oldBlockDescription,
        });
      },
      description,
      this.groupId
    );
  }

  async showBoardDescription(
    boardId,
    oldShowDescription,
    showDescription = true,
    description
  ) {
    let actionDescription = description;
    if (!actionDescription) {
      actionDescription = showDescription
        ? "show description"
        : "hide description";
    }

    await manager.perform(
      async () => {
        await octoClient.patchBoard(boardId, { showDescription });
      },
      async () => {
        await octoClient.patchBoard(boardId, {
          showDescription: oldShowDescription,
        });
      },
      actionDescription,
      this.groupId
    );
  }

  async changeCardContentOrder(
    boardId,
    cardId,
    oldContentOrder,
    contentOrder,
    description = "reorder"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, cardId, {
          updatedFields: { contentOrder },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, cardId, {
          updatedFields: { contentOrder: oldContentOrder },
        });
      },
      description,
      this.groupId
    );
  }

  async createBoardMember(member, description = "create board member") {
    await manager.perform(
      async () => {
        await octoClient.createBoardMember(member);
      },
      async () => {
        await octoClient.deleteBoardMember(member);
      },
      description,
      this.groupId
    );
  }

  async updateBoardMember(
    newMember,
    oldMember,
    description = "update board member"
  ) {
    await manager.perform(
      async () => {
        await octoClient.updateBoardMember(newMember);
      },
      async () => {
        await octoClient.updateBoardMember(oldMember);
      },
      description,
      this.groupId
    );
  }

  async deleteBoardMember(member, description = "delete board member") {
    await manager.perform(
      async () => {
        await octoClient.deleteBoardMember(member);
        store.dispatch(removeBoardUsersById([member.userId]));
      },
      async () => {
        await octoClient.createBoardMember(member);
        const user = await octoClient.getUser(member.userId);
        if (user) {
          store.dispatch(addBoardUsers([user]));
        }
      },
      description,
      this.groupId
    );
  }

  async insertPropertyTemplate(board, activeView, index = -1, template) {
    if (!activeView) {
      Logger.assertRefusal("insertPropertyTemplate: no activeView");
      return "";
    }

    const newTemplate = template || {
      id: Utils.newGuid(IDType.BlockID),
      name: "New Property",
      type: "text",
      options: [],
    };

    const oldBlocks = [];
    const oldBoard = board;
    const newBoard = createBoard(board);

    const startIndex = index >= 0 ? index : board.cardProperties.length;
    if (index >= 0) {
      newBoard.cardProperties.splice(startIndex, 0, newTemplate);
    } else {
      newBoard.cardProperties.push(newTemplate);
    }

    if (activeView.fields.viewType === "table") {
      const changedBlocks = [];
      const changedBlockIDs = [];

      oldBlocks.push(activeView);

      const newActiveView = createBoardView(activeView);

      // insert in proper location in activeview.fields.visiblePropetyIds
      const viewIndex =
        index > 0 ? index : activeView.fields.visiblePropertyIds.length;
      newActiveView.fields.visiblePropertyIds.splice(
        viewIndex,
        0,
        newTemplate.id
      );
      changedBlocks.push(newActiveView);
      changedBlockIDs.push(activeView.id);

      const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(
        newBoard,
        oldBoard,
        changedBlockIDs,
        changedBlocks,
        oldBlocks
      );
      await manager.perform(
        async () => {
          await octoClient.patchBoardsAndBlocks(updatePatch);
        },
        async () => {
          await octoClient.patchBoardsAndBlocks(undoPatch);
        },
        "add column",
        this.groupId
      );
    } else {
      this.updateBoard(newBoard, oldBoard, "add property");
    }

    return newTemplate.id;
  }

  async duplicatePropertyTemplate(board, activeView, propertyId) {
    if (!activeView) {
      Logger.assertRefusal("duplicatePropertyTemplate: no activeView");
    }

    const oldBlocks = [];
    const oldBoard = board;

    const newBoard = createBoard(board);
    const changedBlocks = [];
    const changedBlockIDs = [];
    const index = newBoard.cardProperties.findIndex((o) => o.id === propertyId);
    if (index === -1) {
      Logger.assertRefusal(`Cannot find template with id: ${propertyId}`);
      return;
    }
    const srcTemplate = newBoard.cardProperties[index];
    const newTemplate = {
      id: Utils.newGuid(IDType.BlockID),
      name: `${srcTemplate.name} copy`,
      type: srcTemplate.type,
      options: srcTemplate.options.slice(),
    };
    newBoard.cardProperties.splice(index + 1, 0, newTemplate);

    let description = "duplicate property";
    if (activeView.fields.viewType === "table") {
      oldBlocks.push(activeView);

      const newActiveView = createBoardView(activeView);
      newActiveView.fields.visiblePropertyIds.push(newTemplate.id);
      changedBlocks.push(newActiveView);
      changedBlockIDs.push(newActiveView.id);

      description = "duplicate column";
      const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(
        newBoard,
        oldBoard,
        changedBlockIDs,
        changedBlocks,
        oldBlocks
      );
      await manager.perform(
        async () => {
          await octoClient.patchBoardsAndBlocks(updatePatch);
        },
        async () => {
          await octoClient.patchBoardsAndBlocks(undoPatch);
        },
        description,
        this.groupId
      );
    } else {
      this.updateBoard(newBoard, oldBoard, description);
    }
  }

  async changePropertyTemplateOrder(board, template, destIndex) {
    const templates = board.cardProperties;
    const newValue = templates.slice();

    const srcIndex = templates.indexOf(template);
    Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`);
    newValue.splice(destIndex, 0, newValue.splice(srcIndex, 1)[0]);

    const newBoard = createBoard(board);
    newBoard.cardProperties = newValue;

    await this.updateBoard(newBoard, board, "reorder properties");
  }

  async deleteProperty(board, views, cards, propertyId) {
    const newBoard = createBoard(board);
    newBoard.cardProperties = board.cardProperties.filter(
      (o) => o.id !== propertyId
    );

    const oldBlocks = [];
    const changedBlocks = [];
    const changedBlockIDs = [];

    views.forEach((view) => {
      if (view.fields.visiblePropertyIds.includes(propertyId)) {
        oldBlocks.push(view);

        const newView = createBoardView(view);
        newView.fields.visiblePropertyIds =
          view.fields.visiblePropertyIds.filter((o) => o !== propertyId);
        changedBlocks.push(newView);
        changedBlockIDs.push(newView.id);
      }
    });
    cards.forEach((card) => {
      if (card.fields.properties[propertyId]) {
        oldBlocks.push(card);

        const newCard = createCard(card);
        delete newCard.fields.properties[propertyId];
        changedBlocks.push(newCard);
        changedBlockIDs.push(newCard.id);
      }
    });

    const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(
      newBoard,
      board,
      changedBlockIDs,
      changedBlocks,
      oldBlocks
    );
    await manager.perform(
      async () => {
        await octoClient.patchBoardsAndBlocks(updatePatch);
      },
      async () => {
        await octoClient.patchBoardsAndBlocks(undoPatch);
      },
      "delete property",
      this.groupId
    );
  }

  async updateBoardCardProperties(
    boardId,
    oldProperties,
    newProperties,
    description = "update card properties"
  ) {
    const [updatePatch, undoPatch] = createCardPropertiesPatches(
      newProperties,
      oldProperties
    );
    await manager.perform(
      async () => {
        await octoClient.patchBoard(boardId, updatePatch);
      },
      async () => {
        await octoClient.patchBoard(boardId, undoPatch);
      },
      description,
      this.groupId
    );
  }

  async insertPropertyOption(
    boardId,
    oldCardProperties,
    template,
    option,
    description = "add option"
  ) {
    Utils.assert(oldCardProperties.includes(template));

    const newCardProperties = cloneDeep(oldCardProperties);
    const newTemplate = newCardProperties.find((o) => o.id === template.id);
    newTemplate.options.push(option);

    await this.updateBoardCardProperties(
      boardId,
      oldCardProperties,
      newCardProperties,
      description
    );
  }

  async deletePropertyOption(boardId, oldCardProperties, template, option) {
    const newCardProperties = cloneDeep(oldCardProperties);
    const newTemplate = newCardProperties.find((o) => o.id === template.id);
    newTemplate.options = newTemplate.options.filter((o) => o.id !== option.id);

    await this.updateBoardCardProperties(
      boardId,
      oldCardProperties,
      newCardProperties,
      "delete option"
    );
  }

  async changePropertyOptionOrder(
    boardId,
    oldCardProperties,
    template,
    option,
    destIndex
  ) {
    const srcIndex = template.options.indexOf(option);
    Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`);

    const newCardProperties = cloneDeep(oldCardProperties);
    const newTemplate = newCardProperties.find((o) => o.id === template.id);
    newTemplate.options.splice(
      destIndex,
      0,
      newTemplate.options.splice(srcIndex, 1)[0]
    );

    await this.updateBoardCardProperties(
      boardId,
      oldCardProperties,
      newCardProperties,
      "reorder option"
    );
  }

  async changePropertyOptionValue(
    boardId,
    oldCardProperties,
    propertyTemplate,
    option,
    value
  ) {
    const newCardProperties = cloneDeep(oldCardProperties);
    const newTemplate = newCardProperties.find(
      (o) => o.id === propertyTemplate.id
    );
    const newOption = newTemplate.options.find((o) => o.id === option.id);
    newOption.value = value;

    await this.updateBoardCardProperties(
      boardId,
      oldCardProperties,
      newCardProperties,
      "rename option"
    );

    return newCardProperties;
  }

  async changePropertyOptionColor(
    boardId,
    oldCardProperties,
    template,
    option,
    color
  ) {
    const newCardProperties = cloneDeep(oldCardProperties);
    const newTemplate = newCardProperties.find((o) => o.id === template.id);
    const newOption = newTemplate.options.find((o) => o.id === option.id);
    newOption.color = color;
    await this.updateBoardCardProperties(
      boardId,
      oldCardProperties,
      newCardProperties,
      "rename option"
    );
  }

  async changePropertyValue(
    boardId,
    card,
    propertyId,
    value,
    description = "change property"
  ) {
    const oldValue = card.fields.properties[propertyId];

    // dont save anything if property value was not changed.
    if (oldValue === value) {
      return;
    }

    const newCard = createCard(card);
    if (value) {
      newCard.fields.properties[propertyId] = value;
    } else {
      delete newCard.fields.properties[propertyId];
    }
    await this.updateBlock(boardId, newCard, card, description);
  }

  async changePropertyTypeAndName(
    board,
    cards,
    propertyTemplate,
    newType,
    newName
  ) {
    if (
      propertyTemplate.type === newType &&
      propertyTemplate.name === newName
    ) {
      return;
    }

    const oldBoard = board;
    const newBoard = createBoard(board);
    const newTemplate = newBoard.cardProperties.find(
      (o) => o.id === propertyTemplate.id
    );

    if (propertyTemplate.type !== newType) {
      newTemplate.options = [];
    }

    newTemplate.type = newType;
    newTemplate.name = newName;

    const oldBlocks = [];
    const newBlocks = [];
    const newBlockIDs = [];

    if (propertyTemplate.type !== newType) {
      if (
        propertyTemplate.type === "select" ||
        propertyTemplate.type === "multiSelect"
      ) {
        const isNewTypeSelectOrMulti =
          newType === "select" || newType === "multiSelect";

        for (const card of cards) {
          const oldValue = Array.isArray(
            card.fields.properties[propertyTemplate.id]
          )
            ? card.fields.properties[propertyTemplate.id].length > 0 &&
              card.fields.properties[propertyTemplate.id][0]
            : card.fields.properties[propertyTemplate.id];
          if (oldValue) {
            const newValue = isNewTypeSelectOrMulti
              ? propertyTemplate.options.find((o) => o.id === oldValue)?.id
              : propertyTemplate.options.find((o) => o.id === oldValue)?.value;
            const newCard = createCard(card);

            if (newValue) {
              newCard.fields.properties[propertyTemplate.id] =
                newType === "multiSelect" ? [newValue] : newValue;
            } else {
              // This was an invalid select option, so delete it
              delete newCard.fields.properties[propertyTemplate.id];
            }

            newBlocks.push(newCard);
            newBlockIDs.push(newCard.id);
            oldBlocks.push(card);
          }

          if (isNewTypeSelectOrMulti) {
            newTemplate.options = propertyTemplate.options;
          }
        }
      } else if (newType === "select" || newType === "multiSelect") {
        for (const card of cards) {
          const oldValue = card.fields.properties[propertyTemplate.id];
          if (oldValue) {
            let option = newTemplate.options.find((o) => o.value === oldValue);
            if (!option) {
              option = {
                id: Utils.newGuid(IDType.None),
                value: oldValue,
                color: "propColorDefault",
              };
              newTemplate.options.push(option);
            }

            const newCard = createCard(card);
            newCard.fields.properties[propertyTemplate.id] =
              newType === "multiSelect" ? [option.id] : option.id;

            newBlocks.push(newCard);
            newBlockIDs.push(newCard.id);
            oldBlocks.push(card);
          }
        }
      }
    }

    if (newBlockIDs.length > 0) {
      const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(
        newBoard,
        board,
        newBlockIDs,
        newBlocks,
        oldBlocks
      );
      await manager.perform(
        async () => {
          await octoClient.patchBoardsAndBlocks(updatePatch);
        },
        async () => {
          await octoClient.patchBoardsAndBlocks(undoPatch);
        },
        "change property type and name",
        this.groupId
      );
    } else {
      this.updateBoard(newBoard, oldBoard, "change property name");
    }
  }

  // Views

  async changeViewSortOptions(boardId, viewId, oldSortOptions, sortOptions) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { sortOptions },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { sortOptions: oldSortOptions },
        });
      },
      "sort",
      this.groupId
    );
  }

  async changeViewFilter(boardId, viewId, oldFilter, filter) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { filter },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { filter: oldFilter },
        });
      },
      "filter",
      this.groupId
    );
  }

  async changeViewGroupById(boardId, viewId, oldGroupById, groupById) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { groupById },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { groupById: oldGroupById },
        });
      },
      "group by",
      this.groupId
    );
  }

  async changeViewDateDisplayPropertyId(
    boardId,
    viewId,
    oldDateDisplayPropertyId,
    dateDisplayPropertyId
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { dateDisplayPropertyId },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { dateDisplayPropertyId: oldDateDisplayPropertyId },
        });
      },
      "display by",
      this.displayId
    );
  }

  async changeViewVisiblePropertiesOrder(
    boardId,
    view,
    template,
    destIndex,
    description = "change property order"
  ) {
    const oldVisiblePropertyIds = view.fields.visiblePropertyIds;
    const newOrder = oldVisiblePropertyIds.slice();

    const srcIndex = oldVisiblePropertyIds.indexOf(template.id);
    Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`);

    newOrder.splice(destIndex, 0, newOrder.splice(srcIndex, 1)[0]);

    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, view.id, {
          updatedFields: { visiblePropertyIds: newOrder },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, view.id, {
          updatedFields: { visiblePropertyIds: oldVisiblePropertyIds },
        });
      },
      description,
      this.groupId
    );
  }

  async changeViewVisibleProperties(
    boardId,
    viewId,
    oldVisiblePropertyIds,
    visiblePropertyIds,
    description = "show / hide property"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { visiblePropertyIds },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { visiblePropertyIds: oldVisiblePropertyIds },
        });
      },
      description,
      this.groupId
    );
  }

  async changeViewVisibleOptionIds(
    boardId,
    viewId,
    oldVisibleOptionIds,
    visibleOptionIds,
    description = "reorder"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { visibleOptionIds },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { visibleOptionIds: oldVisibleOptionIds },
        });
      },
      description,
      this.groupId
    );
  }

  async changeViewHiddenOptionIds(
    boardId,
    viewId,
    oldHiddenOptionIds,
    hiddenOptionIds,
    description = "reorder"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { hiddenOptionIds },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { hiddenOptionIds: oldHiddenOptionIds },
        });
      },
      description,
      this.groupId
    );
  }

  async changeViewKanbanCalculations(
    boardId,
    viewId,
    oldCalculations,
    calculations,
    description = "updated kanban calculations"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { kanbanCalculations: calculations },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { kanbanCalculations: oldCalculations },
        });
      },
      description,
      this.groupId
    );
  }

  async changeViewColumnCalculations(
    boardId,
    viewId,
    oldCalculations,
    calculations,
    description = "updated kanban calculations"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { columnCalculations: calculations },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { columnCalculations: oldCalculations },
        });
      },
      description,
      this.groupId
    );
  }

  async changeViewCardOrder(
    boardId,
    viewId,
    oldCardOrder,
    cardOrder,
    description = "reorder"
  ) {
    await manager.perform(
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { cardOrder },
        });
      },
      async () => {
        await octoClient.patchBlock(boardId, viewId, {
          updatedFields: { cardOrder: oldCardOrder },
        });
      },
      description,
      this.groupId
    );
  }

  async hideViewColumns(boardId, view, columnOptionIds) {
    if (columnOptionIds.every((o) => view.fields.hiddenOptionIds.includes(o))) {
      return;
    }

    const newView = createBoardView(view);
    newView.fields.visibleOptionIds = newView.fields.visibleOptionIds.filter(
      (o) => !columnOptionIds.includes(o)
    );
    newView.fields.hiddenOptionIds = [
      ...newView.fields.hiddenOptionIds,
      ...columnOptionIds,
    ];
    await this.updateBlock(boardId, newView, view, "hide column");
  }

  async hideViewColumn(boardId, view, columnOptionId) {
    return this.hideViewColumns(boardId, view, [columnOptionId]);
  }

  async unhideViewColumns(boardId, view, columnOptionIds) {
    if (
      columnOptionIds.every((o) => view.fields.visibleOptionIds.includes(o))
    ) {
      return;
    }

    const newView = createBoardView(view);
    newView.fields.hiddenOptionIds = newView.fields.hiddenOptionIds.filter(
      (o) => !columnOptionIds.includes(o)
    );

    // Put the columns at the end of the visible list
    newView.fields.visibleOptionIds = newView.fields.visibleOptionIds.filter(
      (o) => !columnOptionIds.includes(o)
    );
    newView.fields.visibleOptionIds = [
      ...newView.fields.visibleOptionIds,
      ...columnOptionIds,
    ];
    await this.updateBlock(boardId, newView, view, "show column");
  }

  async unhideViewColumn(boardId, view, columnOptionId) {
    return this.unhideViewColumns(boardId, view, [columnOptionId]);
  }

  async createCategory(category) {
    await octoClient.createSidebarCategory(category);
  }

  async deleteCategory(teamID, categoryID) {
    await octoClient.deleteSidebarCategory(teamID, categoryID);
  }

  async updateCategory(category) {
    await octoClient.updateSidebarCategory(category);
  }

  async moveBoardToCategory(teamID, blockID, toCategoryID, fromCategoryID) {
    await octoClient.moveBoardToCategory(
      teamID,
      blockID,
      toCategoryID,
      fromCategoryID
    );
  }

  async followBlock(blockId, blockType, userId) {
    await manager.perform(
      async () => {
        await octoClient.followBlock(blockId, blockType, userId);
      },
      async () => {
        await octoClient.unfollowBlock(blockId, blockType, userId);
      },
      "follow block",
      this.groupId
    );
  }

  async unfollowBlock(blockId, blockType, userId) {
    await manager.perform(
      async () => {
        await octoClient.unfollowBlock(blockId, blockType, userId);
      },
      async () => {
        await octoClient.followBlock(blockId, blockType, userId);
      },
      "follow block",
      this.groupId
    );
  }

  async patchUserConfig(userID, patch) {
    return octoClient.patchUserConfig(userID, patch);
  }

  // Duplicate

  async duplicateCard(
    cardId,
    boardId,
    fromTemplate = false,
    description = "duplicate card",
    asTemplate = false,
    propertyOverrides,
    afterRedo,
    beforeUndo
  ) {
    return manager.perform(
      async () => {
        const blocks = await octoClient.duplicateBlock(
          boardId,
          cardId,
          asTemplate
        );
        const newRootBlock = blocks && blocks[0];
        if (!newRootBlock) {
          Utils.log("Unable to duplicate card");
          return [[], ""];
        }
        if (asTemplate === fromTemplate) {
          // Copy template
          newRootBlock.title = `${newRootBlock.title} copy`;
        } else if (asTemplate) {
          // Template from card
          newRootBlock.title = "New card template";
        } else {
          // Card from template
          newRootBlock.title = "";

          // If the template doesn't specify an icon, initialize it to a random one
          if (!newRootBlock.fields.icon && UserSettings.prefillRandomIcons) {
            newRootBlock.fields.icon = BlockIcons.shared.randomIcon();
          }
        }
        const patch = {
          updatedFields: {
            icon: newRootBlock.fields.icon,
            properties: {
              ...newRootBlock.fields.properties,
              ...propertyOverrides,
            },
          },
          title: newRootBlock.title,
        };
        await octoClient.patchBlock(
          newRootBlock.boardId,
          newRootBlock.id,
          patch
        );
        if (blocks) {
          updateAllBoardsAndBlocks([], blocks);
          await afterRedo?.(newRootBlock.id);
        }
        return [blocks, newRootBlock.id];
      },
      async (newBlocks) => {
        await beforeUndo?.();
        const newRootBlock = newBlocks && newBlocks[0];
        if (newRootBlock) {
          await octoClient.deleteBlock(newRootBlock.boardId, newRootBlock.id);
        }
      },
      description,
      this.groupId
    );
  }

  async duplicateBoard(
    boardId,
    description = "duplicate board",
    asTemplate = false,
    afterRedo,
    beforeUndo,
    toTeam
  ) {
    return manager.perform(
      async () => {
        const boardsAndBlocks = await octoClient.duplicateBoard(
          boardId,
          asTemplate,
          toTeam
        );
        if (boardsAndBlocks) {
          updateAllBoardsAndBlocks(
            boardsAndBlocks.boards,
            boardsAndBlocks.blocks
          );
          await afterRedo?.(boardsAndBlocks.boards[0]?.id);
        }
        return boardsAndBlocks;
      },
      async (boardsAndBlocks) => {
        await beforeUndo?.();
        const awaits = [];
        for (const block of boardsAndBlocks.blocks) {
          awaits.push(octoClient.deleteBlock(block.boardId, block.id));
        }
        for (const board of boardsAndBlocks.boards) {
          awaits.push(octoClient.deleteBoard(board.id));
        }
        await Promise.all(awaits);
      },
      description,
      this.groupId
    );
  }

  async moveContentBlock(
    blockId,
    dstBlockId,
    where = "after" | "before",
    srcBlockId,
    srcWhere = "after" | "before",
    description
  ) {
    return manager.perform(
      async () => {
        await octoClient.moveBlockTo(blockId, where, dstBlockId);
      },
      async () => {
        await octoClient.moveBlockTo(blockId, srcWhere, srcBlockId);
      },
      description,
      this.groupId
    );
  }

  async addBoardFromTemplate(afterRedo, beforeUndo, boardTemplateId, toTeam) {
    const asTemplate = false;
    const actionDescription = t({
      id: "Mutator.new-board-from-template",
      message: "new board from template",
    });
    return mutator.duplicateBoard(
      boardTemplateId,
      actionDescription,
      asTemplate,
      afterRedo,
      beforeUndo,
      toTeam
    );
  }

  async addEmptyBoard(teamId, afterRedo, beforeUndo) {
    const board = createBoard();
    board.teamId = teamId;

    const view = createBoardView();
    view.fields.viewType = "board";
    view.parentId = board.id;
    view.boardId = board.id;
    view.title = t({ id: "View.NewBoardTitle", message: "Board view" });

    return mutator.createBoardsAndBlocks(
      { boards: [board], blocks: [view] },
      "add board",
      async (bab) => {
        const newBoard = bab.boards[0];

        await afterRedo(newBoard?.id || "");
      },
      beforeUndo
    );
  }

  async addEmptyBoardTemplate(teamId, afterRedo, beforeUndo) {
    const boardTemplate = createBoard();
    boardTemplate.isTemplate = true;
    boardTemplate.teamId = teamId;
    boardTemplate.title = t({
      id: "View.NewTemplateDefaultTitle",
      message: "Untitled Template",
    });

    const view = createBoardView();
    view.fields.viewType = "board";
    view.parentId = boardTemplate.id;
    view.boardId = boardTemplate.id;
    view.title = t({ id: "View.NewBoardTitle", message: "Board view" });

    return mutator.createBoardsAndBlocks(
      { boards: [boardTemplate], blocks: [view] },
      "add board template",
      async (bab) => {
        const newBoard = bab.boards[0];

        afterRedo(newBoard?.id || "");
      },
      beforeUndo
    );
  }

  async exportBoardArchive(boardID) {
    return octoClient.exportBoardArchive(boardID);
  }

  async exportFullArchive(teamID) {
    return octoClient.exportFullArchive(teamID);
  }

  async importFullArchive(file) {
    return octoClient.importFullArchive(file);
  }

  get canUndo() {
    return manager.canUndo;
  }

  get canRedo() {
    return manager.canRedo;
  }

  get undoDescription() {
    return manager.description;
  }

  get redoDescription() {
    return manager.redoDescription;
  }

  async undo() {
    await manager.undo();
  }

  async redo() {
    await manager.redo();
  }
}

const mutator = new Mutator();
export default mutator;

export { mutator };
