import { createBlock } from "./block";
import { createFilterGroup } from "./filterGroup";

function createBoardView(block) {
  return {
    ...createBlock(block),
    type: "view",
    fields: {
      viewType: block?.fields.viewType || "board",
      groupById: block?.fields.groupById,
      dateDisplayPropertyId: block?.fields.dateDisplayPropertyId,
      sortOptions: block?.fields.sortOptions?.map((o) => ({ ...o })) || [],
      visiblePropertyIds: block?.fields.visiblePropertyIds?.slice() || [],
      visibleOptionIds: block?.fields.visibleOptionIds?.slice() || [],
      hiddenOptionIds: block?.fields.hiddenOptionIds?.slice() || [],
      collapsedOptionIds: block?.fields.collapsedOptionIds?.slice() || [],
      filter: createFilterGroup(block?.fields.filter),
      cardOrder: block?.fields.cardOrder?.slice() || [],
      columnWidths: { ...(block?.fields.columnWidths || {}) },
      columnCalculations: { ...(block?.fields.columnCalculations || {}) },
      kanbanCalculations: { ...(block?.fields.kanbanCalculations || {}) },
      defaultTemplateId: block?.fields.defaultTemplateId || "",
    },
  };
}

function sortBoardViewsAlphabetically(views) {
  // Strip leading emoji to prevent unintuitive results
  return views
    .map((v) => {
      return { view: v, title: v.title.replace(/^\p{Emoji}*\s*/u, "") };
    })
    .sort((v1, v2) => v1.title.localeCompare(v2.title))
    .map((v) => v.view);
}

export { sortBoardViewsAlphabetically, createBoardView };
