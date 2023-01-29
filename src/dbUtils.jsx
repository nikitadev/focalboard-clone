import { t } from "@lingui/macro";

import { createCommentBlock } from "./blocks/commentBlock";
import { createCheckboxBlock } from "./blocks/checkboxBlock";
import { createDividerBlock } from "./blocks/dividerBlock";
import { createImageBlock } from "./blocks/imageBlock";
import { createTextBlock } from "./blocks/textBlock";
import { createH1Block } from "./blocks/h1Block";
import { createH2Block } from "./blocks/h2Block";
import { createH3Block } from "./blocks/h3Block";
import { createAttachmentBlock } from "./blocks/attachmentBlock";
import { Utils } from "./utils";
import { Logger } from "./logger";

class DbUtils {
  static hydrateBlock(block) {
    switch (block.type) {
      /* case "view": {
        return createBoardView(block);
      }
      case "card": {
        return newCard(block);
      } */
      case "text": {
        return createTextBlock(block);
      }
      case "h1": {
        return createH1Block(block);
      }
      case "h2": {
        return createH2Block(block);
      }
      case "h3": {
        return createH3Block(block);
      }
      case "image": {
        return createImageBlock(block);
      }
      case "divider": {
        return createDividerBlock(block);
      }
      case "comment": {
        return createCommentBlock(block);
      }
      case "checkbox": {
        return createCheckboxBlock(block);
      }
      case "attachment": {
        return createAttachmentBlock(block);
      }
      default: {
        Logger.assertRefusal(`Can't hydrate unknown block type: ${block.type}`);
        return; //createBlock(block);
      }
    }
  }

  static hydrateBlocks(blocks) {
    return blocks.map((block) => this.hydrateBlock(block));
  }

  static mergeBlocks(blocks, updatedBlocks) {
    const updatedBlockIds = updatedBlocks.map((o) => o.id);
    const newBlocks = blocks.filter((o) => !updatedBlockIds.includes(o.id));
    const updatedAndNotDeletedBlocks = updatedBlocks.filter(
      (o) => o.deleteAt === 0
    );
    newBlocks.push(...updatedAndNotDeletedBlocks);
    return newBlocks;
  }

  static duplicateBlockTree(blocks, sourceBlockId) {
    const idMap = {};
    const now = Date.now();
    const newBlocks = blocks.map((block) => {
      const newBlock = this.hydrateBlock(block);
      newBlock.id = Utils.newGuid(Utils.blockTypeToIdentityType(newBlock.type));
      newBlock.createAt = now;
      newBlock.updateAt = now;
      idMap[block.id] = newBlock.id;
      return newBlock;
    });

    const newSourceBlockId = idMap[sourceBlockId];

    let newBoardId;
    const sourceBlock = blocks.find((block) => block.id === sourceBlockId);
    if (sourceBlock.boardId === sourceBlock.id) {
      const newSourceRootBlock = newBlocks.find(
        (block) => block.id === newSourceBlockId
      );
      newBoardId = newSourceRootBlock.id;
    }

    newBlocks.forEach((newBlock) => {
      if (newBlock.id !== newSourceBlockId && newBlock.parentId) {
        newBlock.parentId = idMap[newBlock.parentId] || newBlock.parentId;
        Logger.assert(
          newBlock.parentId,
          `Block ${newBlock.id} (${newBlock.type} ${newBlock.title}) has no parent`
        );
      }

      if (newBoardId) {
        newBlock.boardId = newBoardId;
      }

      if (newBlock.type === "view") {
        const view = newBlock;
        view.fields.cardOrder = view.fields.cardOrder.map((o) => idMap[o]);
      }

      if (newBlock.type === "card") {
        const card = newBlock;
        card.fields.contentOrder = card.fields.contentOrder.map((o) =>
          Array.isArray(o) ? o.map((o2) => idMap[o2]) : idMap[o]
        );
      }
    });

    const newSourceBlock = newBlocks.find(
      (block) => block.id === newSourceBlockId
    );
    return [newBlocks, newSourceBlock, idMap];
  }

  static filterConditionDisplayString(filterCondition, filterValueType) {
    if (filterValueType === "options" || filterValueType === "person") {
      switch (filterCondition) {
        case "includes":
          return t({
            id: "Filter.includes",
            message: "includes",
          });
        case "notIncludes":
          return t({
            id: "Filter.not-includes",
            message: "doesn't include",
          });
        case "isEmpty":
          return t({
            id: "Filter.is-empty",
            message: "is empty",
          });
        case "isNotEmpty":
          return t({
            id: "Filter.is-not-empty",
            message: "is not empty",
          });
        default: {
          return t({
            id: "Filter.includes",
            message: "includes",
          });
        }
      }
    } else if (filterValueType === "boolean") {
      switch (filterCondition) {
        case "isSet":
          return t({
            id: "Filter.is-set",
            message: "is set",
          });
        case "isNotSet":
          return t({
            id: "Filter.is-not-set",
            message: "is not set",
          });
        default: {
          return t({
            id: "Filter.is-set",
            message: "is set",
          });
        }
      }
    } else if (filterValueType === "text") {
      switch (filterCondition) {
        case "is":
          return t({ id: "Filter.is", message: "is" });
        case "contains":
          return t({
            id: "Filter.contains",
            message: "contains",
          });
        case "notContains":
          return t({
            id: "Filter.not-contains",
            message: "doesn't contain",
          });
        case "startsWith":
          return t({
            id: "Filter.starts-with",
            message: "starts with",
          });
        case "notStartsWith":
          return t({
            id: "Filter.not-starts-with",
            message: "doesn't start with",
          });
        case "endsWith":
          return t({
            id: "Filter.ends-with",
            message: "ends with",
          });
        case "notEndsWith":
          return t({
            id: "Filter.not-ends-with",
            message: "doesn't end with",
          });
        default: {
          return t({ id: "Filter.is", message: "is" });
        }
      }
    } else if (filterValueType === "date") {
      switch (filterCondition) {
        case "is":
          return t({ id: "Filter.is", message: "is" });
        case "isBefore":
          return t({
            id: "Filter.is-before",
            message: "is before",
          });
        case "isAfter":
          return t({
            id: "Filter.is-after",
            message: "is after",
          });
        case "isSet":
          return t({
            id: "Filter.is-set",
            message: "is set",
          });
        case "isNotSet":
          return t({
            id: "Filter.is-not-set",
            message: "is not set",
          });
        default: {
          return t({ id: "Filter.is", message: "is" });
        }
      }
    } else {
      Logger.assertRefusal();
      return "(unknown)";
    }
  }

  static filterConditionValidOrDefault(
    filterValueType,
    currentFilterCondition
  ) {
    if (filterValueType === "options") {
      switch (currentFilterCondition) {
        case "includes":
        case "notIncludes":
        case "isEmpty":
        case "isNotEmpty":
          return currentFilterCondition;
        default: {
          return "includes";
        }
      }
    } else if (filterValueType === "boolean") {
      switch (currentFilterCondition) {
        case "isSet":
        case "isNotSet":
          return currentFilterCondition;
        default: {
          return "isSet";
        }
      }
    } else if (filterValueType === "text") {
      switch (currentFilterCondition) {
        case "is":
        case "contains":
        case "notContains":
        case "startsWith":
        case "notStartsWith":
        case "endsWith":
        case "notEndsWith":
          return currentFilterCondition;
        default: {
          return "is";
        }
      }
    } else if (filterValueType === "date") {
      switch (currentFilterCondition) {
        case "is":
        case "isBefore":
        case "isAfter":
        case "isSet":
        case "isNotSet":
          return currentFilterCondition;
        default: {
          return "is";
        }
      }
    }
    Logger.assertRefusal();
    return "includes";
  }
}

export { DbUtils };
