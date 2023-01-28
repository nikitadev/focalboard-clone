import { createBlock } from "./block";

function createCommentBlock(block) {
  return {
    ...createBlock(block),
    type: "comment",
  };
}

export { createCommentBlock };
