import mutator from "./mutator";
import { Logger } from "./logger";
import moment from "moment";

class Archiver {
  static async exportBoardArchive(board) {
    Archiver.export(mutator.exportBoardArchive(board.id));
  }

  static async exportFullArchive(teamID) {
    Archiver.export(mutator.exportFullArchive(teamID));
  }

  static #export(prom) {
    prom.then((response) => {
      response.blob().then((blob) => {
        const link = document.createElement("a");
        link.style.display = "none";

        const date = moment();
        const filename = `archive-${date.toDate().getFullYear()}-${
          date.toDate().getMonth() + 1
        }-${date}.boardarchive`;

        const file = new Blob([blob], { type: "application/octet-stream" });
        link.href = URL.createObjectURL(file);
        link.download = filename;
        document.body.appendChild(link); // FireFox support

        link.click();

        // TODO: Review if this is needed in the future, this is to fix the problem with linux webview links
        if (window.openInNewBrowser) {
          window.openInNewBrowser(link.href);
        }

        // TODO: Remove or reuse link and revolkObjectURL to avoid memory leak
      });
    });
  }

  static async #importArchiveFromFile(file) {
    const response = await mutator.importAllArchiveToFile(file);
    if (response.status !== 200) {
      Logger.log("ERROR importing archive: " + response.text());
    }
  }

  static isBlockExists(block) {
    return !block.id || !block.boardId ? false : true;
  }

  static importFullArchive(onComplete) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".boardarchive";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (file) {
        await Archiver.importArchiveFromFile(file);
      }

      onComplete?.();
    };

    input.style.display = "none";
    document.body.appendChild(input);
    input.click();
  }
}

export { Archiver };
