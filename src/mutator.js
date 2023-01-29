import { batch } from "react-redux";
import cloneDeep from "lodash/cloneDeep";
import { t } from "@lingui/macro";

import { BlockIcons } from "./blockIcons";
import { createPatchesFromBlocks } from "./blocks/block";
import {
  newBoard,
  createPatchesFromBoards,
  createPatchesFromBoardsAndBlocks,
  newCardPropertiesPatches,
} from "./blocks/board";
import { createBoardView } from "./blocks/boardView";
import { newCard } from "./blocks/card";
import DbClient from "./dbClient";
import { manager } from "./undoManager";
import { Utils, IdentityType } from "./utils";
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
    if (this.#groupId) {
      Logger.assertRefusal("manager does not support nested groups");
      return undefined;
    }
    this.#groupId = Utils.newGuid(IdentityType.None);

    return this.#groupId;
  }

  #endUndoGroup(groupId) {
    if (this.#groupId !== groupId) {
      Logger.assertRefusal(
        "Mismatched groupId. manager does not support nested groups"
      );
      return;
    }
    this.#groupId = undefined;
  }

  async performAsUndoGroup(actions) {
    const groupId = this.#startUndoGroup();
    try {
      await actions();
    } catch (err) {
      Logger.assertRefusal(`ERROR: ${err}`);
    }
    if (groupId) {
      this.#endUndoGroup(groupId);
    }
  }

  async updateBlock(boardId, newBlock, oldBlock, description) {
    const [updatePatch, undoPatch] = createPatchesFromBlocks(
      newBlock,
      oldBlock
    );
    await manager.perform(
      async () => {
        await DbClient.patchBlock(boardId, newBlock.id, updatePatch);
      },
      async () => {
        await DbClient.patchBlock(boardId, oldBlock.id, undoPatch);
      },
      description,
      this.#groupId
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
            DbClient.patchBlock(boardId, newBlocks[i].id, patch)
          )
        );
      },
      async () => {
        await Promise.all(
          undoPatches.map((patch, i) =>
            DbClient.patchBlock(boardId, newBlocks[i].id, patch)
          )
        );
      },
      description,
      this.#groupId
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
        const res = await DbClient.insertBlock(boardId, block);
        const jsonres = await res.json();
        const newBlock = jsonres[0];
        await afterRedo?.(newBlock);
        return newBlock;
      },
      async (newBlock) => {
        await beforeUndo?.(newBlock);
        await DbClient.deleteBlock(boardId, newBlock.id);
      },
      description,
      this.#groupId
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
        const res = await DbClient.insertBlocks(boardId, blocks, sourceBoardID);
        const newBlocks = await res.json();
        updateAllBoardsAndBlocks([], newBlocks);
        await afterRedo?.(newBlocks);
        return newBlocks;
      },
      async (newBlocks) => {
        await beforeUndo?.();
        const awaits = [];
        for (const block of newBlocks) {
          awaits.push(DbClient.deleteBlock(boardId, block.id));
        }
        await Promise.all(awaits);
      },
      description,
      this.#groupId
    );
  }

  async deleteBlock(block, description, beforeRedo, afterUndo) {
    const actualDescription = description || `delete ${block.type}`;

    await manager.perform(
      async () => {
        await beforeRedo?.();
        await DbClient.deleteBlock(block.boardId, block.id);
      },
      async () => {
        await DbClient.undeleteBlock(block.boardId, block.id);
        await afterUndo?.();
      },
      actualDescription,
      this.#groupId
    );
  }

  async createBoardsAndBlocks(bab, description = "add", afterRedo, beforeUndo) {
    return manager.perform(
      async () => {
        const res = await DbClient.createBoardsAndBlocks(bab);
        const newBab = await res.json();
        await afterRedo?.(newBab);
        return newBab;
      },
      async (newBab) => {
        await beforeUndo?.(newBab);

        const boardIds = newBab.boards.map((b) => b.id);
        const blockIds = newBab.blocks.map((b) => b.id);
        await DbClient.deleteBoardsAndBlocks(boardIds, blockIds);
      },
      description,
      this.#groupId
    );
  }

  async updateBoard(board, currentBoard, description) {
    const [updatePatch, undoPatch] = createPatchesFromBoards(
      board,
      currentBoard
    );
    await manager.perform(
      async () => {
        await DbClient.patchBoard(board.id, updatePatch);
      },
      async () => {
        await DbClient.patchBoard(currentBoard.id, undoPatch);
      },
      description,
      this.#groupId
    );
  }

  async deleteBoard(board, description, afterRedo, beforeUndo) {
    await manager.perform(
      async () => {
        await DbClient.deleteBoard(board.id);
        await afterRedo?.(board);
      },
      async () => {
        await beforeUndo?.(board);
        await DbClient.undeleteBoard(board.id);
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, blockId, { title: newTitle });
      },
      async () => {
        await DbClient.patchBlock(boardId, blockId, { title: oldTitle });
      },
      description,
      this.#groupId
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
        await DbClient.patchBoard(boardId, { title: newTitle });
      },
      async () => {
        await DbClient.patchBoard(boardId, { title: oldTitle });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, blockId, {
          updatedFields: { defaultTemplateId: templateId },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, blockId, {
          updatedFields: { defaultTemplateId: oldTemplateId },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, blockId, {
          updatedFields: { defaultTemplateId: "" },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, blockId, {
          updatedFields: { defaultTemplateId: oldTemplateId },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBoard(boardId, { icon });
      },
      async () => {
        await DbClient.patchBoard(boardId, { icon: oldIcon });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, blockId, {
          updatedFields: { icon },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, blockId, {
          updatedFields: { icon: oldIcon },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBoard(boardId, { description: blockDescription });
      },
      async () => {
        await DbClient.patchBoard(boardId, {
          description: oldBlockDescription,
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBoard(boardId, { showDescription });
      },
      async () => {
        await DbClient.patchBoard(boardId, {
          showDescription: oldShowDescription,
        });
      },
      actionDescription,
      this.#groupId
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
        await DbClient.patchBlock(boardId, cardId, {
          updatedFields: { contentOrder },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, cardId, {
          updatedFields: { contentOrder: oldContentOrder },
        });
      },
      description,
      this.#groupId
    );
  }

  async createBoardMember(member, description = "create board member") {
    await manager.perform(
      async () => {
        await DbClient.createBoardMember(member);
      },
      async () => {
        await DbClient.deleteBoardMember(member);
      },
      description,
      this.#groupId
    );
  }

  async updateBoardMember(
    newMember,
    oldMember,
    description = "update board member"
  ) {
    await manager.perform(
      async () => {
        await DbClient.updateBoardMember(newMember);
      },
      async () => {
        await DbClient.updateBoardMember(oldMember);
      },
      description,
      this.#groupId
    );
  }

  async deleteBoardMember(member, description = "delete board member") {
    await manager.perform(
      async () => {
        await DbClient.deleteBoardMember(member);
        store.dispatch(removeBoardUsersById([member.userId]));
      },
      async () => {
        await DbClient.createBoardMember(member);
        const user = await DbClient.getUser(member.userId);
        if (user) {
          store.dispatch(addBoardUsers([user]));
        }
      },
      description,
      this.#groupId
    );
  }

  async insertPropertyTemplate(board, activeView, index = -1, template) {
    if (!activeView) {
      Logger.assertRefusal("insertPropertyTemplate: no activeView");
      return "";
    }

    const newTemplate = template || {
      id: Utils.newGuid(IdentityType.BlockId),
      name: "New Property",
      type: "text",
      options: [],
    };

    const oldBlocks = [];
    const oldBoard = board;
    const nextBoard = newBoard(board);

    const startIndex = index >= 0 ? index : board.cardProperties.length;
    if (index >= 0) {
      nextBoard.cardProperties.splice(startIndex, 0, newTemplate);
    } else {
      nextBoard.cardProperties.push(newTemplate);
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
        nextBoard,
        oldBoard,
        changedBlockIDs,
        changedBlocks,
        oldBlocks
      );
      await manager.perform(
        async () => {
          await DbClient.patchBoardsAndBlocks(updatePatch);
        },
        async () => {
          await DbClient.patchBoardsAndBlocks(undoPatch);
        },
        "add column",
        this.#groupId
      );
    } else {
      this.updateBoard(nextBoard, oldBoard, "add property");
    }

    return newTemplate.id;
  }

  async duplicatePropertyTemplate(board, activeView, propertyId) {
    if (!activeView) {
      Logger.assertRefusal("duplicatePropertyTemplate: no activeView");
    }

    const oldBlocks = [];
    const oldBoard = board;

    const nextBoard = newBoard(board);
    const changedBlocks = [];
    const changedBlockIDs = [];
    const index = nextBoard.cardProperties.findIndex(
      (o) => o.id === propertyId
    );
    if (index === -1) {
      Logger.assertRefusal(`Cannot find template with id: ${propertyId}`);
      return;
    }
    const srcTemplate = nextBoard.cardProperties[index];
    const newTemplate = {
      id: Utils.newGuid(IdentityType.BlockId),
      name: `${srcTemplate.name} copy`,
      type: srcTemplate.type,
      options: srcTemplate.options.slice(),
    };
    nextBoard.cardProperties.splice(index + 1, 0, newTemplate);

    let description = "duplicate property";
    if (activeView.fields.viewType === "table") {
      oldBlocks.push(activeView);

      const newActiveView = createBoardView(activeView);
      newActiveView.fields.visiblePropertyIds.push(newTemplate.id);
      changedBlocks.push(newActiveView);
      changedBlockIDs.push(newActiveView.id);

      description = "duplicate column";
      const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(
        nextBoard,
        oldBoard,
        changedBlockIDs,
        changedBlocks,
        oldBlocks
      );
      await manager.perform(
        async () => {
          await DbClient.patchBoardsAndBlocks(updatePatch);
        },
        async () => {
          await DbClient.patchBoardsAndBlocks(undoPatch);
        },
        description,
        this.#groupId
      );
    } else {
      this.updateBoard(nextBoard, oldBoard, description);
    }
  }

  async changePropertyTemplateOrder(board, template, destIndex) {
    const templates = board.cardProperties;
    const newValue = templates.slice();

    const srcIndex = templates.indexOf(template);
    Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`);
    newValue.splice(destIndex, 0, newValue.splice(srcIndex, 1)[0]);

    const nextBoard = newBoard(board);
    nextBoard.cardProperties = newValue;

    await this.updateBoard(nextBoard, board, "reorder properties");
  }

  async deleteProperty(board, views, cards, propertyId) {
    const nextBoard = newBoard(board);
    nextBoard.cardProperties = board.cardProperties.filter(
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

        const nCard = newCard(card);
        delete nCard.fields.properties[propertyId];
        changedBlocks.push(nCard);
        changedBlockIDs.push(nCard.id);
      }
    });

    const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(
      nextBoard,
      board,
      changedBlockIDs,
      changedBlocks,
      oldBlocks
    );
    await manager.perform(
      async () => {
        await DbClient.patchBoardsAndBlocks(updatePatch);
      },
      async () => {
        await DbClient.patchBoardsAndBlocks(undoPatch);
      },
      "delete property",
      this.#groupId
    );
  }

  async updateBoardCardProperties(
    boardId,
    oldProperties,
    newProperties,
    description = "update card properties"
  ) {
    const [updatePatch, undoPatch] = newCardPropertiesPatches(
      newProperties,
      oldProperties
    );
    await manager.perform(
      async () => {
        await DbClient.patchBoard(boardId, updatePatch);
      },
      async () => {
        await DbClient.patchBoard(boardId, undoPatch);
      },
      description,
      this.#groupId
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

    const nextCard = newCard(card);
    if (value) {
      nextCard.fields.properties[propertyId] = value;
    } else {
      delete nextCard.fields.properties[propertyId];
    }
    await this.updateBlock(boardId, nextCard, card, description);
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

    const nextBoard = newBoard(board);
    const newTemplate = nextBoard.cardProperties.find(
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
            const nextCard = newCard(card);

            if (newValue) {
              nextCard.fields.properties[propertyTemplate.id] =
                newType === "multiSelect" ? [newValue] : newValue;
            } else {
              // This was an invalid select option, so delete it
              delete nextCard.fields.properties[propertyTemplate.id];
            }

            newBlocks.push(nextCard);
            newBlockIDs.push(nextCard.id);
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
                id: Utils.newGuid(IdentityType.None),
                value: oldValue,
                color: "propColorDefault",
              };
              newTemplate.options.push(option);
            }

            const nextCard = newCard(card);
            nextCard.fields.properties[propertyTemplate.id] =
              newType === "multiSelect" ? [option.id] : option.id;

            newBlocks.push(nextCard);
            newBlockIDs.push(nextCard.id);
            oldBlocks.push(card);
          }
        }
      }
    }

    if (newBlockIDs.length > 0) {
      const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(
        nextBoard,
        board,
        newBlockIDs,
        newBlocks,
        oldBlocks
      );
      await manager.perform(
        async () => {
          await DbClient.patchBoardsAndBlocks(updatePatch);
        },
        async () => {
          await DbClient.patchBoardsAndBlocks(undoPatch);
        },
        "change property type and name",
        this.#groupId
      );
    } else {
      this.updateBoard(nextBoard, board, "change property name");
    }
  }

  // Views

  async changeViewSortOptions(boardId, viewId, oldSortOptions, sortOptions) {
    await manager.perform(
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { sortOptions },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { sortOptions: oldSortOptions },
        });
      },
      "sort",
      this.#groupId
    );
  }

  async changeViewFilter(boardId, viewId, oldFilter, filter) {
    await manager.perform(
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { filter },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { filter: oldFilter },
        });
      },
      "filter",
      this.#groupId
    );
  }

  async changeViewGroupById(boardId, viewId, oldGroupById, groupById) {
    await manager.perform(
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { groupById },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { groupById: oldGroupById },
        });
      },
      "group by",
      this.#groupId
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
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { dateDisplayPropertyId },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { dateDisplayPropertyId: oldDateDisplayPropertyId },
        });
      },
      "display by",
      this.#displayId
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
        await DbClient.patchBlock(boardId, view.id, {
          updatedFields: { visiblePropertyIds: newOrder },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, view.id, {
          updatedFields: { visiblePropertyIds: oldVisiblePropertyIds },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { visiblePropertyIds },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { visiblePropertyIds: oldVisiblePropertyIds },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { visibleOptionIds },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { visibleOptionIds: oldVisibleOptionIds },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { hiddenOptionIds },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { hiddenOptionIds: oldHiddenOptionIds },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { kanbanCalculations: calculations },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { kanbanCalculations: oldCalculations },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { columnCalculations: calculations },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { columnCalculations: oldCalculations },
        });
      },
      description,
      this.#groupId
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
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { cardOrder },
        });
      },
      async () => {
        await DbClient.patchBlock(boardId, viewId, {
          updatedFields: { cardOrder: oldCardOrder },
        });
      },
      description,
      this.#groupId
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
    await DbClient.createSidebarCategory(category);
  }

  async deleteCategory(teamID, categoryID) {
    await DbClient.deleteSidebarCategory(teamID, categoryID);
  }

  async updateCategory(category) {
    await DbClient.updateSidebarCategory(category);
  }

  async moveBoardToCategory(teamID, blockID, toCategoryID, fromCategoryID) {
    await DbClient.moveBoardToCategory(
      teamID,
      blockID,
      toCategoryID,
      fromCategoryID
    );
  }

  async followBlock(blockId, blockType, userId) {
    await manager.perform(
      async () => {
        await DbClient.followBlock(blockId, blockType, userId);
      },
      async () => {
        await DbClient.unfollowBlock(blockId, blockType, userId);
      },
      "follow block",
      this.#groupId
    );
  }

  async unfollowBlock(blockId, blockType, userId) {
    await manager.perform(
      async () => {
        await DbClient.unfollowBlock(blockId, blockType, userId);
      },
      async () => {
        await DbClient.followBlock(blockId, blockType, userId);
      },
      "follow block",
      this.#groupId
    );
  }

  async patchUserConfig(userID, patch) {
    return DbClient.patchUserConfig(userID, patch);
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
        const blocks = await DbClient.duplicateBlock(
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
            newRootBlock.fields.icon = BlockIcons.instance.randomIcon();
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
        await DbClient.patchBlock(newRootBlock.boardId, newRootBlock.id, patch);
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
          await DbClient.deleteBlock(newRootBlock.boardId, newRootBlock.id);
        }
      },
      description,
      this.#groupId
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
        const boardsAndBlocks = await DbClient.duplicateBoard(
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
          awaits.push(DbClient.deleteBlock(block.boardId, block.id));
        }
        for (const board of boardsAndBlocks.boards) {
          awaits.push(DbClient.deleteBoard(board.id));
        }
        await Promise.all(awaits);
      },
      description,
      this.#groupId
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
        await DbClient.moveBlockTo(blockId, where, dstBlockId);
      },
      async () => {
        await DbClient.moveBlockTo(blockId, srcWhere, srcBlockId);
      },
      description,
      this.#groupId
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
    const board = newBoard();
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
        const firstBoard = bab.boards[0];

        await afterRedo(firstBoard?.id || "");
      },
      beforeUndo
    );
  }

  async addEmptyBoardTemplate(teamId, afterRedo, beforeUndo) {
    const boardTemplate = newBoard();
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
        const firstBoard = bab.boards[0];

        afterRedo(firstBoard?.id || "");
      },
      beforeUndo
    );
  }

  async exportBoardArchive(id) {
    return DbClient.exportBoardArchive(id);
  }

  async exportFullArchive(id) {
    return DbClient.exportFullArchive(id);
  }

  async importAllArchiveToFile(file) {
    return DbClient.importAllArchiveToFile(file);
  }

  get canUndo() {
    return manager.canUndo;
  }

  get canRedo() {
    return manager.canRedo;
  }

  get undoNote() {
    return manager.note;
  }

  get redoNote() {
    return manager.redoNote;
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
