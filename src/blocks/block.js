import difference from "lodash/difference";

import { Utils } from "../utils";

const contentBlockTypes = [
  "text",
  "image",
  "divider",
  "checkbox",
  "h1",
  "h2",
  "h3",
  "list-item",
  "attachment",
  "quote",
  "video",
];

// ToDo: remove type board
const blockTypes = [
  ...contentBlockTypes,
  "board",
  "view",
  "card",
  "comment",
  "attachment",
  "unknown",
];

function createBlock(block) {
  const now = Date.now();
  return {
    id: block?.id || Utils.newGuid(Utils.blockTypeToIdentityType(block?.type)),
    schema: 1,
    boardId: block?.boardId || "",
    parentId: block?.parentId || "",
    createdBy: block?.createdBy || "",
    modifiedBy: block?.modifiedBy || "",
    type: block?.type || "unknown",
    fields: block?.fields ? { ...block?.fields } : {},
    title: block?.title || "",
    createAt: block?.createAt || now,
    updateAt: block?.updateAt || now,
    deleteAt: block?.deleteAt || 0,
    limited: !!block?.limited,
  };
}

function createPatchesFromBlocks(newBlock, oldBlock) {
  const newDeletedFields = difference(
    Object.keys(newBlock.fields),
    Object.keys(oldBlock.fields)
  );
  const newUpdatedFields = {};
  const newUpdatedData = {};
  Object.keys(newBlock.fields).forEach((val) => {
    if (oldBlock.fields[val] !== newBlock.fields[val]) {
      newUpdatedFields[val] = newBlock.fields[val];
    }
  });
  Object.keys(newBlock).forEach((val) => {
    if (val !== "fields" && oldBlock[val] !== newBlock[val]) {
      newUpdatedData[val] = newBlock[val];
    }
  });

  const oldDeletedFields = difference(
    Object.keys(oldBlock.fields),
    Object.keys(newBlock.fields)
  );
  const oldUpdatedFields = {};
  const oldUpdatedData = {};
  Object.keys(oldBlock.fields).forEach((val) => {
    if (oldBlock.fields[val] !== newBlock.fields[val]) {
      oldUpdatedFields[val] = oldBlock.fields[val];
    }
  });
  Object.keys(oldBlock).forEach((val) => {
    if (val !== "fields" && oldBlock[val] !== newBlock[val]) {
      oldUpdatedData[val] = oldBlock[val];
    }
  });

  return [
    {
      ...newUpdatedData,
      updatedFields: newUpdatedFields,
      deletedFields: oldDeletedFields,
    },
    {
      ...oldUpdatedData,
      updatedFields: oldUpdatedFields,
      deletedFields: newDeletedFields,
    },
  ];
}

export { blockTypes, contentBlockTypes, createBlock, createPatchesFromBlocks };
