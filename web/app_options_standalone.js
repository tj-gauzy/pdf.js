import {
  compatibilityParams,
  defaultOptions,
  OptionKind,
} from "./app_options.js";

/**
 * Standalone version of AppOptions.
 */
class AppOption {
  userOptions = Object.create(null);

  get(name) {
    const userOption = this.userOptions[name];
    if (userOption !== undefined) {
      return userOption;
    }
    const defaultOption = defaultOptions[name];
    if (defaultOption !== undefined) {
      return compatibilityParams[name] ?? defaultOption.value;
    }
    return undefined;
  }

  getAll(kind = null) {
    const options = Object.create(null);
    for (const name in defaultOptions) {
      const defaultOption = defaultOptions[name];
      if (kind) {
        if ((kind & defaultOption.kind) === 0) {
          continue;
        }
        if (kind === OptionKind.PREFERENCE) {
          const value = defaultOption.value,
            valueType = typeof value;
          if (
            valueType === "boolean" ||
            valueType === "string" ||
            (valueType === "number" && Number.isInteger(value))
          ) {
            options[name] = value;
            continue;
          }
          throw new Error(`Invalid type for preference: ${name}`);
        }
      }
      const userOption = this.userOptions[name];
      options[name] =
        userOption !== undefined
          ? userOption
          : compatibilityParams[name] ?? defaultOption.value;
    }
    return options;
  }

  set(name, value) {
    this.userOptions[name] = value;
  }

  setAll(options) {
    for (const name in options) {
      this.userOptions[name] = options[name];
    }
  }

  remove(name) {
    delete this.userOptions[name];
  }

  _hasUserOptions() {
    return Object.keys(this.userOptions).length > 0;
  }

  getUserOptions() {
    return this.userOptions ?? {};
  }
}

export { AppOption };
