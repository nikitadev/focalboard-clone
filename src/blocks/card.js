import { createBlock } from "./block";

function newCard(block) {
  const contentOrder = [];
  const contentIds = block?.fields?.contentOrder?.filter((id) => id !== null);

  if (contentIds?.length > 0) {
    for (const contentId of contentIds) {
      if (typeof contentId === "string") {
        contentOrder.push(contentId);
      } else {
        contentOrder.push(contentId.slice());
      }
    }
  }
  return {
    ...createBlock(block),
    type: "card",
    fields: {
      icon: block?.fields.icon || "",
      properties: { ...(block?.fields.properties || {}) },
      contentOrder,
      isTemplate: block?.fields.isTemplate || false,
    },
  };
}

export { newCard };
