class Logger {
  static assertValue(valueObject) {
    const name = Object.keys(valueObject)[0];
    const value = valueObject[name];
    if (!value) {
      Logger.error(`ASSERT VALUE [${name}]`);
    }
  }

  static assert(condition, tag = "") {
    /// #!if ENV !== "production"
    if (!condition) {
      Logger.error(`ASSERT [${tag ?? new Error().stack}]`);
    }

    /// #!endif
  }

  static assertRefusal(tag = "") {
    /// #!if ENV !== "production"
    Logger.assert(false, tag);

    /// #!endif
  }

  static log(message) {
    /// #!if ENV !== "production"
    const timestamp = (Date.now() / 1000).toFixed(2);
    // eslint-disable-next-line no-console
    console.log(`[${timestamp}] ${message}`);

    /// #!endif
  }

  static error(message) {
    /// #!if ENV !== "production"
    const timestamp = (Date.now() / 1000).toFixed(2);
    // eslint-disable-next-line no-console
    console.error(`[${timestamp}] ${message}`);

    /// #!endif
  }

  static warn(message) {
    /// #!if ENV !== "production"
    const timestamp = (Date.now() / 1000).toFixed(2);
    // eslint-disable-next-line no-console
    console.warn(`[${timestamp}] ${message}`);

    /// #!endif
  }
}

export { Logger };
