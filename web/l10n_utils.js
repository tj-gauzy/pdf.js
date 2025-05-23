/* Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * PLEASE NOTE: This file is currently imported in both the `web/` and
 *              `src/display/` folders, hence be EXTREMELY careful about
 *              introducing any dependencies here since that can lead to an
 *              unexpected/unnecessary size increase of the *built* files.
 */

/**
 * A subset of the l10n strings in the `l10n/en-US/viewer.properties` file.
 */
const DEFAULT_L10N_STRINGS = {
  of_pages: "of {{pagesCount}}",
  page_of_pages: "({{pageNumber}} of {{pagesCount}})",

  document_properties_kb: "{{size_kb}} KB ({{size_b}} bytes)",
  document_properties_mb: "{{size_mb}} MB ({{size_b}} bytes)",
  document_properties_date_string: "{{date}}, {{time}}",
  document_properties_page_size_unit_inches: "in",
  document_properties_page_size_unit_millimeters: "mm",
  document_properties_page_size_orientation_portrait: "portrait",
  document_properties_page_size_orientation_landscape: "landscape",
  document_properties_page_size_name_a3: "A3",
  document_properties_page_size_name_a4: "A4",
  document_properties_page_size_name_letter: "Letter",
  document_properties_page_size_name_legal: "Legal",
  document_properties_page_size_dimension_string:
    "{{width}} × {{height}} {{unit}} ({{orientation}})",
  document_properties_page_size_dimension_name_string:
    "{{width}} × {{height}} {{unit}} ({{name}}, {{orientation}})",
  document_properties_linearized_yes: "Yes",
  document_properties_linearized_no: "No",

  additional_layers: "Additional Layers",
  page_landmark: "Page {{page}}",
  thumb_page_title: "Page {{page}}",
  thumb_page_canvas: "Thumbnail of Page {{page}}",

  find_reached_top: "Reached top of document, continued from bottom",
  find_reached_bottom: "Reached end of document, continued from top",
  "find_match_count[one]": "{{current}} of {{total}} match",
  "find_match_count[other]": "{{current}} of {{total}} matches",
  "find_match_count_limit[one]": "More than {{limit}} match",
  "find_match_count_limit[other]": "More than {{limit}} matches",
  find_not_found: "Phrase not found",

  page_scale_width: "Page Width",
  page_scale_fit: "Page Fit",
  page_scale_auto: "Automatic Zoom",
  page_scale_actual: "Actual Size",
  page_scale_percent: "{{scale}}%",

  loading_error: "An error occurred while loading the PDF.",
  invalid_file_error: "Invalid or corrupted PDF file.",
  missing_file_error: "Missing PDF file.",
  unexpected_response_error: "Unexpected server response.",
  rendering_error: "An error occurred while rendering the page.",

  annotation_date_string: "{{date}}, {{time}}",

  printing_not_supported:
    "Warning: Printing is not fully supported by this browser.",
  printing_not_ready: "Warning: The PDF is not fully loaded for printing.",
  web_fonts_disabled:
    "Web fonts are disabled: unable to use embedded PDF fonts.",

  free_text2_default_content: "Start typing…",
  editor_free_text2_aria_label: "Text Editor",
  editor_ink2_aria_label: "Draw Editor",
  editor_ink_canvas_aria_label: "User-created image",
  editor_alt_text_button_label: "Alt text",
  editor_alt_text_edit_button_label: "Edit alt text",
  editor_alt_text_decorative_tooltip: "Marked as decorative",
  editor_resizer_label_topLeft: "Top left corner — resize",
  editor_resizer_label_topMiddle: "Top middle — resize",
  editor_resizer_label_topRight: "Top right corner — resize",
  editor_resizer_label_middleRight: "Middle right — resize",
  editor_resizer_label_bottomRight: "Bottom right corner — resize",
  editor_resizer_label_bottomMiddle: "Bottom middle — resize",
  editor_resizer_label_bottomLeft: "Bottom left corner — resize",
  editor_resizer_label_middleLeft: "Middle left — resize",
};
if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("MOZCENTRAL")) {
  DEFAULT_L10N_STRINGS.print_progress_percent = "{{progress}}%";
}

function getL10nFallback(key, args) {
  switch (key) {
    case "find_match_count":
      key = `find_match_count[${args.total === 1 ? "one" : "other"}]`;
      break;
    case "find_match_count_limit":
      key = `find_match_count_limit[${args.limit === 1 ? "one" : "other"}]`;
      break;
  }
  return DEFAULT_L10N_STRINGS[key] || "";
}

const PARTIAL_LANG_CODES = {
  en: "en-US",
  es: "es-ES",
  fy: "fy-NL",
  ga: "ga-IE",
  gu: "gu-IN",
  hi: "hi-IN",
  hy: "hy-AM",
  nb: "nb-NO",
  ne: "ne-NP",
  nn: "nn-NO",
  pa: "pa-IN",
  pt: "pt-PT",
  sv: "sv-SE",
  zh: "zh-CN",
};

// Try to support "incompletely" specified language codes (see issue 13689).
function fixupLangCode(langCode) {
  return PARTIAL_LANG_CODES[langCode?.toLowerCase()] || langCode;
}

// Replaces {{arguments}} with their values.
function formatL10nValue(text, args) {
  if (!args) {
    return text;
  }
  return text.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (all, name) => {
    return name in args ? args[name] : "{{" + name + "}}";
  });
}

/**
 * No-op implementation of the localization service.
 * @implements {IL10n}
 */
const NullL10n = {
  async getLanguage() {
    return "en-us";
  },

  async getDirection() {
    return "ltr";
  },

  async get(key, args = null, fallback = getL10nFallback(key, args)) {
    return formatL10nValue(fallback, args);
  },

  async translate(element) {},
};

export { fixupLangCode, getL10nFallback, NullL10n };
