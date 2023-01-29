import { anyEmojis } from "./emojis";

class BlockIcons {
  static instance = new BlockIcons();

  random() {
    const index = Math.floor(Math.random() * anyEmojis.length);
    const icon = anyEmojis[index];

    return icon;
  }
}

export { BlockIcons };
