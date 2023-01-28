export function parseUserProps(props) {
  const processedProps = {};

  props.forEach((prop) => {
    const processedProp = prop;
    if (prop.name === "hiddenBoardIDs") {
      const hiddenBoardIDs = JSON.parse(processedProp.value);
      processedProp.value = {};
      hiddenBoardIDs.forEach((boardID) => {
        processedProp.value[boardID] = true;
      });
    }
    processedProps[processedProp.name] = processedProp;
  });

  return processedProps;
}
