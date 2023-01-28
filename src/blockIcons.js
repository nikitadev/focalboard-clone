import { randomEmojiList } from "./emojiList";

class BlockIcons {
  static shared = new BlockIcons();

  randomIcon() {
    const index = Math.floor(Math.random() * randomEmojiList.length);
    const icon = randomEmojiList[index];
    return icon;
  }
}

export { BlockIcons };
