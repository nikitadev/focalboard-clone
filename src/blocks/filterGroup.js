import { createFilterClause } from "./filterClause";

function isAFilterGroupInstance(object) {
  return "operation" in object && "filters" in object;
}

function createFilterGroup(o) {
  let filters = [];
  if (o?.filters) {
    filters = o.filters.map((p) => {
      if (isAFilterGroupInstance(p)) {
        return createFilterGroup(p);
      }
      return createFilterClause(p);
    });
  }
  return {
    operation: o?.operation || "and",
    filters,
  };
}

export { createFilterGroup, isAFilterGroupInstance };
