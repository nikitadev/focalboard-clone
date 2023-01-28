import { Utils } from "../utils";

function createFilterClause(o) {
  return {
    propertyId: o?.propertyId || "",
    condition: o?.condition || "includes",
    values: o?.values?.slice() || [],
  };
}

function areEqual(a, b) {
  return (
    a.propertyId === b.propertyId &&
    a.condition === b.condition &&
    Utils.arraysEqual(a.values, b.values)
  );
}

export { createFilterClause, areEqual };
