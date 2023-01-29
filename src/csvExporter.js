import { t } from "@lingui/macro";

import { Utils } from "./utils";
import propsRegistry from "./properties";

let window;
const hashSignToken = "___hash_sign___";

class CsvExporter {
  static exportTableCsv(board, activeView, cards, view) {
    const viewToExport = view ?? activeView;

    if (!viewToExport) {
      return;
    }

    const rows = CsvExporter.generateTableArray(board, cards, viewToExport);

    let csvContent = "data:text/csv;charset=utf-8,";

    rows.forEach((row) => {
      const encodedRow = row.join(",");
      csvContent += encodedRow + "\r\n";
    });

    const encodedUri = encodeURI(csvContent).replace(hashSignToken, "%23");

    const filename = `${Utils.sanitizeFilename(
      viewToExport.title || "Untitled"
    )}.csv`;
    const link = document.createElement("a");
    link.style.display = "none";
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link); // FireFox support

    link.click();

    // TODO: Review if this is needed in the future, this is to fix the problem with linux webview links
    if (window.openInNewBrowser) {
      window.openInNewBrowser(encodedUri);
    }

    // TODO: Remove or reuse link
  }

  static #encodeText(text) {
    return text.replace(/"/g, '""').replace(/#/g, hashSignToken);
  }

  static #generateTableArray(board, cards, viewToExport) {
    const rows = [];
    const visibleProperties = board.cardProperties.filter((template) =>
      viewToExport.fields.visiblePropertyIds.includes(template.id)
    );

    if (
      viewToExport.fields.viewType === "calendar" &&
      viewToExport.fields.dateDisplayPropertyId &&
      !viewToExport.fields.visiblePropertyIds.includes(
        viewToExport.fields.dateDisplayPropertyId
      )
    ) {
      const dateDisplay = board.cardProperties.find(
        (template) => viewToExport.fields.dateDisplayPropertyId === template.id
      );
      if (dateDisplay) {
        visibleProperties.push(dateDisplay);
      }
    }

    {
      // Header row
      const row = [
        t({
          id: "TableComponent.name",
          message: "Name",
        }),
      ];
      visibleProperties.forEach((template) => {
        row.push(template.name);
      });
      rows.push(row);
    }

    cards.forEach((card) => {
      const row = [];
      row.push(`"${CsvExporter.encodeText(card.title)}"`);
      visibleProperties.forEach((template) => {
        let propertyValue = card.fields.properties[template.id];
        const property = propsRegistry.get(template.type);
        if (property.type === "createdBy") {
          propertyValue = card.createdBy;
        }
        if (property.type === "updatedBy") {
          propertyValue = card.modifiedBy;
        }
        row.push(property.exportValue(propertyValue, card, template));
      });
      rows.push(row);
    });

    return rows;
  }
}

export { CsvExporter };
