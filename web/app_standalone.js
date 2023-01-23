import { PDFViewerApplication, setActiveAppInstance } from "./app.js";
import { PDFViewer } from "./pdf_viewer.js";
import { AppOption } from "./app_options_standalone.js";
import { setL10n } from "./genericl10n.js";

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

  this.appConfig = appConfig;
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
  setActiveAppInstance(this);
  this.setDocStyle();
}

App.prototype = PDFViewerApplication;

/**
 * Activate the current pdfviewer instance
 * @returns {App} Returns the current pdfviewer instance
 */
App.prototype.restore = function () {
  if (this.isActive()) {
    return this;
  }

  const signature = App.ACTIVE_INSTANCE;
  if (signature && App.INSTANCES[signature]) {
    App.INSTANCES[signature].freeze();
  }
  App.ACTIVE_INSTANCE = this.signature;

  this.bindEvents();
  this.bindWindowEvents();
  this.unbindAutoRestore();
  this.setDocStyle();
  this.appConfig.appContainer.focus();

  /* Activate Current instance */
  setActiveAppInstance(this);

  this.eventBus.dispatch("restored", {
    instance: this,
  });

  return this;
};

/**
 * freeze the current pdfviewer instance
 */
App.prototype.freeze = function () {
  this.unbindEvents();
  this.unbindWindowEvents();
  this.bindAutoRestore();

  App.ACTIVE_INSTANCE = null;

  this.eventBus.dispatch("frozen", {
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

export default App;
