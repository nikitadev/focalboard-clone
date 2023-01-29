import difference from "lodash/difference";
import moment from "moment";

import { Utils, IdentityType } from "../utils";

import { createPatchesFromBlocks } from "./block";

const BoardTypeOpen = "O";
const BoardTypePrivate = "P";
// const boardTypes = [BoardTypeOpen, BoardTypePrivate];

const MemberRole = {
  Viewer: "viewer",
  Commenter: "commenter",
  Editor: "editor",
  Admin: "admin",
  None: "",
};

// type PropertyTypeEnum = 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'person' | 'multiPerson' | 'file' | 'checkbox' | 'url' | 'email' | 'phone' | 'createdTime' | 'createdBy' | 'updatedTime' | 'updatedBy' | 'unknown';

function newBoard(board) {
  const now = moment();
  let cardProperties = [];
  const selectProperties = cardProperties.find((o) => o.type === "select");
  if (!selectProperties) {
    const property = {
      id: Utils.newGuid(IdentityType.BlockId),
      name: "Status",
      type: "select",
      options: [],
    };
    cardProperties.push(property);
  }

  if (board?.cardProperties) {
    cardProperties = board?.cardProperties.map((o) => {
      return {
        id: o.id,
        name: o.name,
        type: o.type,
        options: o.options ? o.options.map((option) => ({ ...option })) : [],
      };
    });
  }

  return {
    id: board?.id || Utils.newGuid(IdentityType.Board),
    teamId: board?.teamId || "",
    channelId: board?.channelId || "",
    createdBy: board?.createdBy || "",
    modifiedBy: board?.modifiedBy || "",
    type: board?.type || BoardTypePrivate,
    minimumRole: board?.minimumRole || MemberRole.None,
    title: board?.title || "",
    description: board?.description || "",
    icon: board?.icon || "",
    showDescription: board?.showDescription || false,
    isTemplate: board?.isTemplate || false,
    templateVersion: board?.templateVersion || 0,
    properties: board?.properties || {},
    cardProperties,
    createAt: board?.createAt || now,
    updateAt: board?.updateAt || now,
    deleteAt: board?.deleteAt || 0,
  };
}

function getPropertiesDifference(propsA, propsB) {
  const diff = [];
  propsA.forEach((val) => {
    if (!propsB.find((p) => p.id === val.id)) {
      diff.push(val.id);
    }
  });

  return diff;
}

function isPropertyEqual(propA, propB) {
  for (const val of Object.keys(propA)) {
    if (val !== "options" && propA[val] !== propB[val]) {
      return false;
    }
  }

  if (propA.options.length !== propB.options.length) {
    return false;
  }

  for (const opt of propA.options) {
    const optionB = propB.options.find((o) => o.id === opt.id);
    if (!optionB) {
      return false;
    }

    for (const val of Object.keys(opt)) {
      if (opt[val] !== optionB[val]) {
        return false;
      }
    }
  }

  return true;
}

function newCardPropertiesPatches(newCardProperties, oldCardProperties) {
  const newDeletedCardProperties = getPropertiesDifference(
    newCardProperties,
    oldCardProperties
  );
  const oldDeletedCardProperties = getPropertiesDifference(
    oldCardProperties,
    newCardProperties
  );
  const newUpdatedCardProperties = [];
  newCardProperties.forEach((val) => {
    const oldCardProperty = oldCardProperties.find((o) => o.id === val.id);
    if (!oldCardProperty || !isPropertyEqual(val, oldCardProperty)) {
      newUpdatedCardProperties.push(val);
    }
  });
  const oldUpdatedCardProperties = [];
  oldCardProperties.forEach((val) => {
    const newCardProperty = newCardProperties.find((o) => o.id === val.id);
    if (!newCardProperty || !isPropertyEqual(val, newCardProperty)) {
      oldUpdatedCardProperties.push(val);
    }
  });

  return [
    {
      updatedCardProperties: newUpdatedCardProperties,
      deletedCardProperties: oldDeletedCardProperties,
    },
    {
      updatedCardProperties: oldUpdatedCardProperties,
      deletedCardProperties: newDeletedCardProperties,
    },
  ];
}

function createPatchesFromBoards(newBoard, oldBoard) {
  const newDeletedProperties = difference(
    Object.keys(newBoard.properties || {}),
    Object.keys(oldBoard.properties || {})
  );

  const newUpdatedProperties = {};
  Object.keys(newBoard.properties || {}).forEach((val) => {
    if (oldBoard.properties[val] !== newBoard.properties[val]) {
      newUpdatedProperties[val] = newBoard.properties[val];
    }
  });

  const newData = {};
  Object.keys(newBoard).forEach((val) => {
    if (
      val !== "properties" &&
      val !== "cardProperties" &&
      oldBoard[val] !== newBoard[val]
    ) {
      newData[val] = newBoard[val];
    }
  });

  const oldDeletedProperties = difference(
    Object.keys(oldBoard.properties || {}),
    Object.keys(newBoard.properties || {})
  );

  const oldUpdatedProperties = {};
  Object.keys(oldBoard.properties || {}).forEach((val) => {
    if (newBoard.properties[val] !== oldBoard.properties[val]) {
      oldUpdatedProperties[val] = oldBoard.properties[val];
    }
  });

  const oldData = {};
  Object.keys(oldBoard).forEach((val) => {
    if (
      val !== "properties" &&
      val !== "cardProperties" &&
      newBoard[val] !== oldBoard[val]
    ) {
      oldData[val] = oldBoard[val];
    }
  });

  const [cardPropertiesPatch, cardPropertiesUndoPatch] =
    newCardPropertiesPatches(newBoard.cardProperties, oldBoard.cardProperties);

  return [
    {
      ...newData,
      ...cardPropertiesPatch,
      updatedProperties: newUpdatedProperties,
      deletedProperties: oldDeletedProperties,
    },
    {
      ...oldData,
      ...cardPropertiesUndoPatch,
      updatedProperties: oldUpdatedProperties,
      deletedProperties: newDeletedProperties,
    },
  ];
}

function createPatchesFromBoardsAndBlocks(
  updatedBoard,
  oldBoard,
  updatedBlockIds,
  updatedBlocks,
  oldBlocks
) {
  const blockUpdatePatches = [];
  const blockUndoPatches = [];
  updatedBlocks.forEach((newBlock, i) => {
    const [updatePatch, undoPatch] = createPatchesFromBlocks(
      newBlock,
      oldBlocks[i]
    );
    blockUpdatePatches.push(updatePatch);
    blockUndoPatches.push(undoPatch);
  });

  const [boardUpdatePatch, boardUndoPatch] = createPatchesFromBoards(
    updatedBoard,
    oldBoard
  );

  const updatePatch = {
    blockIds: updatedBlockIds,
    blockPatches: blockUpdatePatches,
    boardIds: [updatedBoard.id],
    boardPatches: [boardUpdatePatch],
  };

  const undoPatch = {
    blockIds: updatedBlockIds,
    blockPatches: blockUndoPatches,
    boardIds: [updatedBoard.id],
    boardPatches: [boardUndoPatch],
  };

  return [updatePatch, undoPatch];
}

export {
  newBoard,
  BoardTypeOpen,
  BoardTypePrivate,
  MemberRole,
  createPatchesFromBoards,
  createPatchesFromBoardsAndBlocks,
  newCardPropertiesPatches,
};
