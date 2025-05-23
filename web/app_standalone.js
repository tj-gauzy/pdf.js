import {
  DefaultExternalServices,
  PDFViewerApplication,
  setActiveAppInstance,
} from "./app.js";
import { GenericL10n, setL10n } from "./genericl10n.js";
import { AppOption } from "./app_options_standalone.js";
import { DownloadManager as BaseDownloadManager } from "./download_manager.js";
import { BasePreferences } from "./preferences.js";
import { ViewHistory as BaseViewHistory } from "./view_history.js";
import { GenericScripting } from "./generic_scripting.js";
import { PDFViewer } from "./pdf_viewer.js";
import { PromiseCapability } from "pdfjs-lib";

// #region PDFAPP

/**
 * Create a functional class that extends PDFViewerApplication
 * This class is used to create multiple instances
 * of PDFViewerApplication in the same page
 */
function App(config) {
  const {
    appConfig = null,
    appOptions = null,
    l10n = null,
    ...params
  } = config || {};

  this._initializedCapability = new PromiseCapability();
  this.appConfig = appConfig || genAppConfig(document);
  this.appOptions = new AppOption();

  if (l10n) {
    setL10n(l10n);
  }

  if (appOptions) {
    this.appOptions.setAll(appOptions);
  }
  if (Object.keys(params).length > 0) {
    Object.assign(this, params);
  }

  if (!App.INSTANCES) {
    App.INSTANCES = {};
  }

  while (true) {
    this.signature = parseInt(100000 * Math.random());
    if (!App.INSTANCES[this.signature]) {
      break;
    }
  }

  App.INSTANCES[this.signature] = this;
  this.restore().then();
}

App.prototype = PDFViewerApplication;

/**
 * Activate the current pdfviewer instance
 * @returns {App} Returns the current pdfviewer instance
 */
App.prototype.restore = async function () {
  if (this.isActive()) {
    return this;
  }

  const signature = App.ACTIVE_INSTANCE;
  if (signature && App.INSTANCES[signature]) {
    App.INSTANCES[signature].freeze();
  }

  // Activate Current instance
  App.ACTIVE_INSTANCE = this.signature;
  setActiveAppInstance(this);
  this.setDocStyle();
  this.appConfig.appContainer.focus();

  // wait for pdfviewer to be initialized
  if (!this.eventBus) {
    await this.initializedPromise;
  }

  // Rebinder events for current instance
  if (!this._boundEvents.windowResize) {
    this.bindWindowEvents();
  }

  this.unbindAutoRestore();
  this.eventBus.dispatch("pdfjs:restored", {
    instance: this,
  });

  return this;
};

/**
 * freeze the current pdfviewer instance
 */
App.prototype.freeze = function () {
  if (!this.isActive()) {
    return;
  }

  // Unbind events for current instance
  if (this._boundEvents.windowResize) {
    this.unbindWindowEvents();
  }

  App.ACTIVE_INSTANCE = null;

  this.bindAutoRestore();
  this.eventBus.dispatch("pdfjs:frozen", {
    instance: this,
  });
};
/**
 * @returns {boolean} check if current instance is active
 */
App.prototype.isActive = function () {
  return App.ACTIVE_INSTANCE === this.signature;
};

/**
 * Add Event listener to auto activate pdfviewer instance when pointer moves in
 */
App.prototype.bindAutoRestore = function () {
  this._restore_listener = () => {
    if (this.isActive()) {
      return;
    }
    this.restore();
  };

  this._restore_listener = this.appConfig.documentRootElement.addEventListener(
    "pointerover",
    this._restore_listener,
    true
  );
};

/**
 * When instance is active, remove the auto activate event listener
 */
App.prototype.unbindAutoRestore = function () {
  if (!this._restore_listener) {
    return;
  }

  this.appConfig.documentRootElement.removeEventListener(
    "pointerover",
    this._restore_listener,
    true
  );
  this._restore_listener = null;
};

/**
 * set the instance style root
 */
App.prototype.setDocStyle = function (style) {
  if (!style) {
    style = this.appOptions.get("docStyle") || document.documentElement.style;
  }
  PDFViewer.setDocStyle(style);
};

// #endregion

/**
 * Generate an app config object
 * @param {document|root} document root document object
 * @param {*} overrides Overriding configurations
 * overrides param support {key: value},
 *    when value is an object, will do cascade merge
 * key supports . spliter,
 *    e.g. {toolbar: {container: null}} is equal to {toolbar.container: null}
 * @returns {{}} app config object
 */
function genAppConfig(document, overrides = {}) {
  const config = {
    eventDelegate: window,
    documentRootElement: document.querySelector("html"),
    appContainer: document.body,
    mainContainer: document.getElementById("viewerContainer"),
    viewerContainer: document.getElementById("viewer"),
    toolbar: {
      container: document.getElementById("toolbarViewer"),
      numPages: document.getElementById("numPages"),
      pageNumber: document.getElementById("pageNumber"),
      scaleSelect: document.getElementById("scaleSelect"),
      customScaleOption: document.getElementById("customScaleOption"),
      previous: document.getElementById("previous"),
      next: document.getElementById("next"),
      zoomIn: document.getElementById("zoomIn"),
      zoomOut: document.getElementById("zoomOut"),
      viewFind: document.getElementById("viewFind"),
      openFile:
        typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")
          ? document.getElementById("openFile")
          : null,
      print: document.getElementById("print"),
      editorFreeTextButton: document.getElementById("editorFreeText"),
      editorFreeTextParamsToolbar: document.getElementById(
        "editorFreeTextParamsToolbar"
      ),
      editorInkButton: document.getElementById("editorInk"),
      editorInkParamsToolbar: document.getElementById("editorInkParamsToolbar"),
      editorStampButton: document.getElementById("editorStamp"),
      editorStampParamsToolbar: document.getElementById(
        "editorStampParamsToolbar"
      ),
      download: document.getElementById("download"),
    },
    secondaryToolbar: {
      toolbar: document.getElementById("secondaryToolbar"),
      toggleButton: document.getElementById("secondaryToolbarToggle"),
      presentationModeButton: document.getElementById("presentationMode"),
      openFileButton:
        typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")
          ? document.getElementById("secondaryOpenFile")
          : null,
      printButton: document.getElementById("secondaryPrint"),
      downloadButton: document.getElementById("secondaryDownload"),
      viewBookmarkButton: document.getElementById("viewBookmark"),
      firstPageButton: document.getElementById("firstPage"),
      lastPageButton: document.getElementById("lastPage"),
      pageRotateCwButton: document.getElementById("pageRotateCw"),
      pageRotateCcwButton: document.getElementById("pageRotateCcw"),
      cursorSelectToolButton: document.getElementById("cursorSelectTool"),
      cursorHandToolButton: document.getElementById("cursorHandTool"),
      scrollPageButton: document.getElementById("scrollPage"),
      scrollVerticalButton: document.getElementById("scrollVertical"),
      scrollHorizontalButton: document.getElementById("scrollHorizontal"),
      scrollWrappedButton: document.getElementById("scrollWrapped"),
      spreadNoneButton: document.getElementById("spreadNone"),
      spreadOddButton: document.getElementById("spreadOdd"),
      spreadEvenButton: document.getElementById("spreadEven"),
      documentPropertiesButton: document.getElementById("documentProperties"),
    },
    sidebar: {
      // Divs (and sidebar button)
      outerContainer: document.getElementById("outerContainer"),
      sidebarContainer: document.getElementById("sidebarContainer"),
      toggleButton: document.getElementById("sidebarToggle"),
      resizer: document.getElementById("sidebarResizer"),
      // Buttons
      thumbnailButton: document.getElementById("viewThumbnail"),
      outlineButton: document.getElementById("viewOutline"),
      attachmentsButton: document.getElementById("viewAttachments"),
      layersButton: document.getElementById("viewLayers"),
      // Views
      thumbnailView: document.getElementById("thumbnailView"),
      outlineView: document.getElementById("outlineView"),
      attachmentsView: document.getElementById("attachmentsView"),
      layersView: document.getElementById("layersView"),
      // View-specific options
      outlineOptionsContainer: document.getElementById(
        "outlineOptionsContainer"
      ),
      currentOutlineItemButton: document.getElementById("currentOutlineItem"),
    },
    progressBar: document.getElementById("loadingBar"),
    sidebarResizer: {
      outerContainer: document.getElementById("outerContainer"),
    },
    findBar: {
      bar: document.getElementById("findbar"),
      toggleButton: document.getElementById("viewFind"),
      findField: document.getElementById("findInput"),
      highlightAllCheckbox: document.getElementById("findHighlightAll"),
      caseSensitiveCheckbox: document.getElementById("findMatchCase"),
      matchDiacriticsCheckbox: document.getElementById("findMatchDiacritics"),
      entireWordCheckbox: document.getElementById("findEntireWord"),
      findMsg: document.getElementById("findMsg"),
      findResultsCount: document.getElementById("findResultsCount"),
      findPreviousButton: document.getElementById("findPrevious"),
      findNextButton: document.getElementById("findNext"),
    },
    passwordOverlay: {
      dialog: document.getElementById("passwordDialog"),
      label: document.getElementById("passwordText"),
      input: document.getElementById("password"),
      submitButton: document.getElementById("passwordSubmit"),
      cancelButton: document.getElementById("passwordCancel"),
    },
    documentProperties: {
      dialog: document.getElementById("documentPropertiesDialog"),
      closeButton: document.getElementById("documentPropertiesClose"),
      fields: {
        fileName: document.getElementById("fileNameField"),
        fileSize: document.getElementById("fileSizeField"),
        title: document.getElementById("titleField"),
        author: document.getElementById("authorField"),
        subject: document.getElementById("subjectField"),
        keywords: document.getElementById("keywordsField"),
        creationDate: document.getElementById("creationDateField"),
        modificationDate: document.getElementById("modificationDateField"),
        creator: document.getElementById("creatorField"),
        producer: document.getElementById("producerField"),
        version: document.getElementById("versionField"),
        pageCount: document.getElementById("pageCountField"),
        pageSize: document.getElementById("pageSizeField"),
        linearized: document.getElementById("linearizedField"),
      },
    },
    annotationEditorParams: {
      editorFreeTextFontSize: document.getElementById("editorFreeTextFontSize"),
      editorFreeTextColor: document.getElementById("editorFreeTextColor"),
      editorInkColor: document.getElementById("editorInkColor"),
      editorInkThickness: document.getElementById("editorInkThickness"),
      editorInkOpacity: document.getElementById("editorInkOpacity"),
      editorStampAddImage: document.getElementById("editorStampAddImage"),
    },
    printContainer: document.getElementById("printContainer"),
    openFileInput: document.getElementById("openFile"),
  };

  Object.keys(overrides || {}).forEach(function (key) {
    let override = overrides[key];

    if (key.indexOf(".") > 0) {
      const [parentKey, childKey] = key.split(".");

      key = parentKey;
      override = { [childKey]: override };
    }

    if (
      typeof override === "object" &&
      override !== null &&
      !override.tagName
    ) {
      if (!config[key]) {
        config[key] = {};
      }
      Object.assign(config[key], override);
    } else {
      config[key] = override;
    }
  });

  return config;
}

// #region Services

class DownloadManager extends BaseDownloadManager {
  constructor({ app }) {
    super();

    this.app = app || {};
  }
}

class Preferences extends BasePreferences {
  constructor({ app }) {
    super();

    const readStoragePromise = this.initializedPromise;

    this.initializedPromise = new PromiseCapability();

    this.app = app || {};

    readStoragePromise
      .then(() => {
        return this.initialize();
      })
      .then(() => {
        this.initializedPromise.resolve();
      });
  }

  async initialize() {
    return Promise.resolve();
  }

  async waitForApp() {
    return new Promise(resolve => {
      const func = () => {
        if (this.app) {
          resolve();
        } else {
          requestAnimationFrame(func);
        }
      };

      func();
    });
  }

  async _writeToStorage(prefObj) {
    localStorage.setItem("pdfjs.preferences", JSON.stringify(prefObj));
  }

  async _readFromStorage(prefObj) {
    await this.waitForApp();

    return JSON.parse(localStorage.getItem("pdfjs.preferences"));
  }

  async reset() {
    await this.initializedPromise;
    this.prefs = Object.create(null);
    return this._writeToStorage({}).catch(reason => {
      this.pref = {};
      throw reason;
    });
  }

  async set(name, value) {
    await this.initializedPromise;
    const defaultValue = this.defaults[name],
      prefs = this.prefs;
    if (defaultValue === undefined) {
      throw new Error(`Set preference: "${name}" is undefined.`);
    } else if (value === undefined) {
      throw new Error("Set preference: no value is specified.");
    }
    const valueType = typeof value,
      defaultType = typeof defaultValue;
    if (valueType !== defaultType) {
      if (valueType === "number" && defaultType === "string") {
        value = value.toString();
      } else {
        throw new Error(
          `Set preference: "${value}" is a ${valueType}, expected a ${defaultType}.`
        );
      }
    } else {
      if (valueType === "number" && !Number.isInteger(value)) {
        throw new Error(`Set preference: "${value}" must be an integer.`);
      }
    }
    if (value === defaultValue) {
      delete prefs[name];
    }

    prefs[name] = value;
    return this._writeToStorage(prefs).catch(reason => {
      this.prefs = prefs;
      throw reason;
    });
  }

  async getAll() {
    await this.initializedPromise;
    const obj = Object.create(null);
    const defaults = this.defaults;
    const prefs = this.prefs;
    const initialOptions = this.app
      ? this.app.appOptions.getUserOptions() || {}
      : {};
    for (const name in defaults) {
      obj[name] = prefs[name] ?? initialOptions[name] ?? defaults[name];
    }
    return obj;
  }
}

const DEFAULT_VIEW_HISTORY_CACHE_SIZE = 50;
class ViewHistory extends BaseViewHistory {
  app = null;

  constructor(fingerprint, app) {
    super(
      fingerprint,
      typeof app === "number" ? app : DEFAULT_VIEW_HISTORY_CACHE_SIZE
    );

    if (!app) {
      app = {};
    }
    this.app = typeof app !== "number" ? app : {};
  }

  async waitForApp() {
    return new Promise(resolve => {
      const func = () => {
        if (this.app) {
          resolve();
        } else {
          requestAnimationFrame(func);
        }
      };

      func();
    });
  }

  async _readFromStorage() {
    await this.waitForApp();
    return localStorage.getItem("pdfjs.history");
  }
}

const defaultServices = {
  DownloadManager,
  Preferences,
  ViewHistory,
  L10n: GenericL10n,
  Scripting: GenericScripting,
};

/**
 * Create a new ExternalServices class with the given overrides
 * @param {{}} overrides
 * @param {EventBus} eventBus
 * @returns DefaultExternalServices
 */
function genExternalServices(overrides = {}) {
  const services = Object.assign({}, defaultServices, overrides);

  class ExternalServices extends DefaultExternalServices {
    static createDownloadManager(options) {
      return new services.DownloadManager(options);
    }

    static createPreferences(options) {
      return new services.Preferences(options);
    }

    static createL10n({ locale = "zh-CN" }) {
      return new services.L10n(locale);
    }

    static createScripting({ sandboxBundleSrc }) {
      return new services.Scripting(sandboxBundleSrc);
    }

    static createViewHistory({ fingerprint, app }) {
      return new services.ViewHistory(fingerprint, app);
    }
  }

  return ExternalServices;
}

// #endregion

export {
  App,
  DownloadManager,
  genAppConfig,
  genExternalServices,
  Preferences,
  ViewHistory,
};

export default App;
