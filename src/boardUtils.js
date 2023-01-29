function groupCardsByOptions(cards, optionIds, groupByProperty) {
  const groups = [];
  for (const optionId of optionIds) {
    if (optionId) {
      const option = groupByProperty?.options.find((o) => o.id === optionId);
      if (option) {
        groups.push({
          option,
          cards: cards.filter(
            (o) => optionId === o.fields?.properties[groupByProperty.id]
          ),
        });
      }
    } else {
      // Empty group
      const emptyGroupCards = cards.filter((card) => {
        const groupByOptionId =
          card.fields.properties[groupByProperty?.id || ""];

        return (
          !groupByOptionId ||
          !groupByProperty?.options.find(
            (option) => option.id === groupByOptionId
          )
        );
      });

      const group = {
        option: { id: "", value: `No ${groupByProperty?.name}`, color: "" },
        cards: emptyGroupCards,
      };

      groups.push(group);
    }
  }

  return groups;
}

function getOptionGroups(
  cards,
  visibleOptionIds,
  hiddenOptionIds,
  groupByProperty
) {
  let unassignedOptionIds = [];
  if (groupByProperty) {
    unassignedOptionIds = groupByProperty.options
      .filter(
        (o) =>
          !visibleOptionIds.includes(o.id) && !hiddenOptionIds.includes(o.id)
      )
      .map((o) => o.id);
  }
  const allVisibleOptionIds = [...visibleOptionIds, ...unassignedOptionIds];

  if (!allVisibleOptionIds.includes("") && !hiddenOptionIds.includes("")) {
    allVisibleOptionIds.unshift("");
  }

  const visibleGroups = groupCardsByOptions(
    cards,
    allVisibleOptionIds,
    groupByProperty
  );
  const hiddenGroups = groupCardsByOptions(
    cards,
    hiddenOptionIds,
    groupByProperty
  );
  return { visible: visibleGroups, hidden: hiddenGroups };
}

export function getVisibleAndHiddenGroups(
  cards,
  visibleOptionIds,
  hiddenOptionIds,
  groupByProperty
) {
  if (
    groupByProperty?.type === "createdBy" ||
    groupByProperty?.type === "updatedBy" ||
    groupByProperty?.type === "person"
  ) {
    return getPersonGroups(cards, groupByProperty, hiddenOptionIds);
  }

  return getOptionGroups(
    cards,
    visibleOptionIds,
    hiddenOptionIds,
    groupByProperty
  );
}

function getPersonGroups(cards, groupByProperty, hiddenOptionIds) {
  const groups = cards.reduce((unique, item) => {
    let key = item.fields.properties[groupByProperty.id];
    if (groupByProperty?.type === "createdBy") {
      key = item.createdBy;
    } else if (groupByProperty?.type === "updatedBy") {
      key = item.modifiedBy;
    }

    const curGroup = unique[key] ?? [];
    return { ...unique, [key]: [...curGroup, item] };
  }, {});

  const hiddenGroups = [];
  const visibleGroups = [];
  Object.entries(groups).forEach(([key, value]) => {
    const propertyOption = { id: key, value: key, color: "" };
    if (hiddenOptionIds.find((e) => e === key)) {
      hiddenGroups.push({ option: propertyOption, cards: value });
    } else {
      visibleGroups.push({ option: propertyOption, cards: value });
    }
  });

  return { visible: visibleGroups, hidden: hiddenGroups };
}
