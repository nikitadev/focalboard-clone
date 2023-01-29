import { DateUtils } from "react-day-picker";
import moment from "moment";

import { isAFilterGroupInstance } from "./blocks/filterGroup";
import { Logger } from "./logger";

const halfDay = 12 * 60 * 60 * 1000;

class CardFilter {
  static createDatePropertyFromString(initialValue) {
    let dateProperty = {};
    if (initialValue) {
      const singleDate = moment().date(Number(initialValue)).toDate();
      if (singleDate && DateUtils.isDate(singleDate)) {
        dateProperty.from = singleDate.getTime();
      } else {
        try {
          dateProperty = JSON.parse(initialValue);
        } catch {
          //Don't do anything, return empty dateProperty
        }
      }
    }

    return dateProperty;
  }

  static applyFilterGroup(filterGroup, templates, cards) {
    return cards.filter((card) =>
      this.isFilterGroupMet(filterGroup, templates, card)
    );
  }

  static isFilterGroupMet(filterGroup, templates, card) {
    const { filters } = filterGroup;

    if (filterGroup.filters.length < 1) {
      return true;
    }

    if (filterGroup.operation === "or") {
      for (const filter of filters) {
        if (isAFilterGroupInstance(filter)) {
          if (this.isFilterGroupMet(filter, templates, card)) {
            return true;
          }
        } else if (this.isClauseMet(filter, templates, card)) {
          return true;
        }
      }
      return false;
    }
    Logger.assert(filterGroup.operation === "and");
    for (const filter of filters) {
      if (isAFilterGroupInstance(filter)) {
        if (!this.isFilterGroupMet(filter, templates, card)) {
          return false;
        }
      } else if (!this.isClauseMet(filter, templates, card)) {
        return false;
      }
    }
    return true;
  }

  static isClauseMet(filter, templates, card) {
    let value = card.fields.properties[filter.propertyId];
    if (filter.propertyId === "title") {
      value = card.title.toLowerCase();
    }
    const template = templates.find((o) => o.id === filter.propertyId);
    let dateValue;
    if (template?.type === "date") {
      dateValue = this.createDatePropertyFromString(value);
    }
    if (!value && template) {
      if (template.type === "createdBy") {
        value = card.createdBy;
      } else if (template.type === "updatedBy") {
        value = card.modifiedBy;
      } else if (template && template.type === "createdTime") {
        value = card.createAt.toString();
        dateValue = this.createDatePropertyFromString(value);
      } else if (template && template.type === "updatedTime") {
        value = card.updateAt.toString();
        dateValue = this.createDatePropertyFromString(value);
      }
    }

    switch (filter.condition) {
      case "includes": {
        if (filter.values?.length < 1) {
          break;
        } // No values = ignore clause (always met)
        return (
          filter.values.find((cValue) =>
            Array.isArray(value) ? value.includes(cValue) : cValue === value
          ) !== undefined
        );
      }
      case "notIncludes": {
        if (filter.values?.length < 1) {
          break;
        } // No values = ignore clause (always met)
        return (
          filter.values.find((cValue) =>
            Array.isArray(value) ? value.includes(cValue) : cValue === value
          ) === undefined
        );
      }
      case "isEmpty": {
        return (value || "").length <= 0;
      }
      case "isNotEmpty": {
        return (value || "").length > 0;
      }
      case "isSet": {
        return Boolean(value);
      }
      case "isNotSet": {
        return !value;
      }
      case "is": {
        if (filter.values.length === 0) {
          return true;
        }
        if (dateValue !== undefined) {
          const numericFilter = parseInt(filter.values[0], 10);
          if (
            template &&
            (template.type === "createdTime" || template.type === "updatedTime")
          ) {
            if (dateValue.from) {
              return (
                dateValue.from > numericFilter - halfDay &&
                dateValue.from < numericFilter + halfDay
              );
            }
            return false;
          }

          if (dateValue.from && dateValue.to) {
            return (
              dateValue.from <= numericFilter && dateValue.to >= numericFilter
            );
          }
          return dateValue.from === numericFilter;
        }
        return filter.values[0]?.toLowerCase() === value;
      }
      case "contains": {
        if (filter.values.length === 0) {
          return true;
        }
        return value.includes(filter.values[0]?.toLowerCase());
      }
      case "notContains": {
        if (filter.values.length === 0) {
          return true;
        }
        return !value.includes(filter.values[0]?.toLowerCase());
      }
      case "startsWith": {
        if (filter.values.length === 0) {
          return true;
        }
        return value.startsWith(filter.values[0]?.toLowerCase());
      }
      case "notStartsWith": {
        if (filter.values.length === 0) {
          return true;
        }
        return !value.startsWith(filter.values[0]?.toLowerCase());
      }
      case "endsWith": {
        if (filter.values.length === 0) {
          return true;
        }
        return value.endsWith(filter.values[0]?.toLowerCase());
      }
      case "notEndsWith": {
        if (filter.values.length === 0) {
          return true;
        }
        return !value.endsWith(filter.values[0]?.toLowerCase());
      }
      case "isBefore": {
        if (filter.values.length === 0) {
          return true;
        }
        if (dateValue !== undefined) {
          const numericFilter = parseInt(filter.values[0], 10);
          if (
            template &&
            (template.type === "createdTime" || template.type === "updatedTime")
          ) {
            if (dateValue.from) {
              return dateValue.from < numericFilter - halfDay;
            }
            return false;
          }

          return dateValue.from ? dateValue.from < numericFilter : false;
        }
        return false;
      }
      case "isAfter": {
        if (filter.values.length === 0) {
          return true;
        }
        if (dateValue !== undefined) {
          const numericFilter = parseInt(filter.values[0], 10);
          if (
            template &&
            (template.type === "createdTime" || template.type === "updatedTime")
          ) {
            if (dateValue.from) {
              return dateValue.from > numericFilter + halfDay;
            }
            return false;
          }

          if (dateValue.to) {
            return dateValue.to > numericFilter;
          }
          return dateValue.from ? dateValue.from > numericFilter : false;
        }
        return false;
      }

      default: {
        Logger.assertRefusal(`Invalid filter condition ${filter.condition}`);
      }
    }
    return true;
  }

  static propertiesThatMeetFilterGroup(filterGroup, templates) {
    // TODO: Handle filter groups
    if (!filterGroup) {
      return {};
    }

    const filters = filterGroup.filters.filter(
      (o) => !isAFilterGroupInstance(o)
    );
    if (filters.length < 1) {
      return {};
    }

    if (filterGroup.operation === "or") {
      // Just need to meet the first clause
      const property = this.propertyThatMeetsFilterClause(
        filters[0],
        templates
      );
      const result = {};
      if (property.value) {
        result[property.id] = property.value;
      }
      return result;
    }

    // And: Need to meet all clauses
    const result = {};
    filters.forEach((filterClause) => {
      const property = this.propertyThatMeetsFilterClause(
        filterClause,
        templates
      );
      if (property.value) {
        result[property.id] = property.value;
      }
    });
    return result;
  }

  static propertyThatMeetsFilterClause(filterClause, templates) {
    const template = templates.find((o) => o.id === filterClause.propertyId);
    if (!template) {
      Logger.assertRefusal(
        `propertyThatMeetsFilterClause. Cannot find template: ${filterClause.propertyId}`
      );
      return { id: filterClause.propertyId };
    }

    if (template.type === "createdBy" || template.type === "updatedBy") {
      return { id: filterClause.propertyId };
    }

    switch (filterClause.condition) {
      case "includes": {
        if (filterClause.values.length < 1) {
          return { id: filterClause.propertyId };
        }
        return { id: filterClause.propertyId, value: filterClause.values[0] };
      }
      case "notIncludes": {
        return { id: filterClause.propertyId };
      }
      case "isEmpty": {
        return { id: filterClause.propertyId };
      }
      case "isNotEmpty": {
        if (template.type === "select") {
          if (template.options.length > 0) {
            const option = template.options[0];
            return { id: filterClause.propertyId, value: option.id };
          }
          return { id: filterClause.propertyId };
        }

        // TODO: Handle non-select types
        return { id: filterClause.propertyId };
      }
      default: {
        // Handle filter clause that cannot be set
        return { id: filterClause.propertyId };
      }
    }
  }
}

export { CardFilter };
