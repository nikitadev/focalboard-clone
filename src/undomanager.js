class Manager {
  #operations = [];
  #index = -1;
  #limit = 0;
  #isRunning = false;

  get currentState() {
    return this.index < 0 ? 0 : this.operations[this.index].state;
  }

  get note() {
    const operation = this.operations[this.index];

    return !operation ? undefined : operation.note;
  }

  get redoNote() {
    const operation = this.operations[this.index + 1];

    return !operation ? undefined : operation.note;
  }

  async #execute(operation, action = "undo" | "redo") {
    if (!operation || typeof operation[action] !== "function") {
      return this;
    }
    this.isRunning = true;

    if (action === "redo") {
      operation.value = await operation[action]();
    } else {
      await operation[action](operation.value);
    }

    this.isRunning = false;
    return this;
  }

  async perform(redo, undo, description, groupId, isDiscardable = false) {
    const value = await redo();
    this.registerUndo(
      { undo, redo },
      description,
      groupId,
      value,
      isDiscardable
    );

    return value;
  }

  register(operation, description, groupId, value, isDiscardable = false) {
    if (this.isRunning) {
      return this;
    }

    this.operations.splice(this.index + 1, this.operations.length - this.index);

    let timestamp;
    if (isDiscardable) {
      const count = this.operations.length - 1;
      timestamp = count > 0 ? this.operations[count].checkpoint : 0;
    } else {
      timestamp = Date.now();
    }

    this.operations.push({
      timestamp,
      undo: operation.undo,
      redo: operation.redo,
      description,
      groupId,
      value,
    });

    // If limit is set, remove items from the start
    if (this.limit && this.operations.length > this.limit) {
      this.operations = this.operations.splice(
        0,
        this.operations.length - this.limit
      );
    }

    // Set the current index to the end
    this.index = this.operations.length - 1;

    if (this.onOperationChanged) {
      this.onOperationChanged();
    }

    return this;
  }

  async undo() {
    if (this.isRunning) {
      return this;
    }
    let operation = this.operations[this.index];
    if (!operation) {
      return this;
    }

    const currentGroupId = operation.groupId;
    if (currentGroupId) {
      do {
        await this.execute(operation, "undo");
        this.index -= 1;
        operation = this.operations[this.index];
      } while (this.index >= 0 && currentGroupId === operation.groupId);
    } else {
      await this.execute(operation, "undo");
      this.index -= 1;
    }

    if (this.onOperationChanged) {
      this.onOperationChanged();
    }

    return this;
  }

  async redo() {
    if (this.isRunning) {
      return this;
    }
    let operation = this.operations[this.index + 1];
    if (!operation) {
      return this;
    }

    const currentGroupId = operation.groupId;
    if (currentGroupId) {
      do {
        await this.execute(operation, "redo");
        this.index += 1;
        operation = this.operations[this.index + 1];
      } while (
        this.index < this.operations.length - 1 &&
        currentGroupId === operation.groupId
      );
    } else {
      await this.execute(operation, "redo");
      this.index += 1;
    }

    if (this.onOperationChanged) {
      this.onOperationChanged();
    }

    return this;
  }

  clear() {
    const prevSize = this.operations.length;

    this.operations = [];
    this.index = -1;

    if (this.onOperationChanged && prevSize > 0) {
      this.onOperationChanged();
    }
  }

  get canUndo() {
    return this.index !== -1;
  }

  get canRedo() {
    return this.index < this.operations.length - 1;
  }
}

const manager = new Manager();
export { manager };
