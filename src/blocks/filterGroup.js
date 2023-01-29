import { createFilterClause } from "./filterClause";

function isAFilterGroupInstance(object) {
  return "operation" in object && "filters" in object;
}

function createFilterGroup(o) {
  const filters = o?.filters?.map((p) => {
    return isAFilterGroupInstance(p)
      ? createFilterGroup(p)
      : createFilterClause(p);
  });

  return {
    operation: o?.operation || "and",
    filters: filters || [],
  };
}

export { createFilterGroup, isAFilterGroupInstance };
