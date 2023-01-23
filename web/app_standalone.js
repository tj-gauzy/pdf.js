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
      resizer: document.getElementById("sidebarResizer"),
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

export { App, genAppConfig };

export default App;
