export function readProperties(props) {
  const result = {};

  props.forEach((prop) => {
    if (prop.name === "hiddenBoardIDs") {
      const ids = JSON.parse(prop.value);
      prop.value = {};
      ids.forEach((id) => {
        prop.value[id] = true;
      });
    }
    result[prop.name] = prop;
  });

  return result;
}
