import { Dict, Name, Ref } from "./primitives.js";
import { bytesToString } from "../shared/util.js";
import { calculateMD5 } from "./crypto.js";

const MAX_XREF_SCAN_ENTRIES = 0x800000;
const MAX_PROOF_RANGES = 4096;
const PROOF_CHUNK_BYTES = 1024 * 1024;
const PROOF_WINDOW_BYTES = 16 * PROOF_CHUNK_BYTES;

class SourceReadError extends Error {}

function rawRef(value) {
  return value instanceof Ref ? { num: value.num, gen: value.gen } : null;
}

function matchesXRef(xref, ref) {
  return ref instanceof Ref && xref.getEntry(ref.num)?.gen === ref.gen;
}

function readTrailerKeys(trailer) {
  const keys = trailer?.getKeys();
  let chars = 4096;
  return keys?.length <= 64 && keys.every(key => (chars -= key.length) >= 0)
    ? keys
    : null;
}

function readIds(value) {
  if (value === undefined) {
    return undefined;
  }
  let chars = 4096;
  return Array.isArray(value) &&
    value.length <= 16 &&
    value.every(id => typeof id === "string" && (chars -= id.length) >= 0)
    ? value
    : null;
}

function summarizeEntries(entries) {
  // Limit the scan even if a malformed subsection made the array very sparse.
  if (entries.length > MAX_XREF_SCAN_ENTRIES) {
    return null;
  }
  let minOffset = Infinity,
    maxOffset = -Infinity,
    minGeneration = Infinity,
    maxGeneration = -Infinity;
  for (const entry of entries) {
    if (!entry || entry.free) {
      continue;
    }
    if (!entry.uncompressed) {
      return { hasCompressedEntries: true };
    }
    minOffset = Math.min(minOffset, entry.offset);
    maxOffset = Math.max(maxOffset, entry.offset);
    minGeneration = Math.min(minGeneration, entry.gen);
    maxGeneration = Math.max(maxGeneration, entry.gen);
  }
  return {
    hasCompressedEntries: false,
    minOffset,
    maxOffset,
    minGeneration,
    maxGeneration,
  };
}

function readSourceInfo(doc, loadState) {
  const { xref, stream, startXRef: previous } = doc;
  const { trailer, root, entries } = xref;
  const { length } = stream;
  const canReadXRefHead =
    Number.isSafeInteger(previous) && previous >= 0 && previous + 5 <= length;
  const tailStart = Math.max(canReadXRefHead ? previous : 0, length - 4096);
  const rootRef = trailer?.getRaw("Root");
  const infoRef = trailer?.getRaw("Info");
  const size = trailer?.getRaw("Size");
  const catalogType = root?.get("Type");
  return {
    ...loadState,
    length,
    start: stream.start,
    previous,
    header: bytesToString(stream.getByteRange(0, 9)),
    xrefHead: canReadXRefHead
      ? bytesToString(stream.getByteRange(previous, previous + 5))
      : null,
    tail: bytesToString(stream.getByteRange(tailStart, length)),
    linearized: !!doc.linearization,
    encrypted: !!(xref.encrypt || trailer?.has("Encrypt")),
    hasAcroForm: !!root?.has("AcroForm"),
    hasPerms: !!root?.has("Perms"),
    hasDss: !!root?.has("DSS"),
    repairedPages: doc.catalog.hasActualNumPages,
    repairedXRef: !!xref.hasXRefTableRepairs,
    hasXRefStream: xref.lastXRefStreamPos !== null,
    trailerKeys: readTrailerKeys(trailer),
    size: typeof size === "number" ? size : null,
    entryCount: entries.length,
    entryZeroFree: !!entries[0]?.free,
    entrySummary: summarizeEntries(entries),
    root: rawRef(rootRef),
    rootMatchesXRef: matchesXRef(xref, rootRef),
    catalogType:
      catalogType instanceof Name && catalogType.name.length <= 4096
        ? catalogType.name
        : null,
    info: infoRef === undefined ? undefined : rawRef(infoRef),
    infoMatchesXRef: infoRef === undefined || matchesXRef(xref, infoRef),
    ids: readIds(trailer?.getRaw("ID")),
  };
}

function useChars(value, budget) {
  budget.chars -= value.length;
  if (budget.chars < 0) {
    throw new SourceReadError("PAGE_CHAR_LIMIT");
  }
}

function serializePageValue(value, budget, depth = 0) {
  if (depth > 32 || --budget.nodes < 0) {
    throw new SourceReadError("PAGE_STRUCTURE_LIMIT");
  }
  if (value instanceof Dict) {
    const keys = value.getKeys();
    if (keys.length > budget.nodes) {
      throw new SourceReadError("PAGE_STRUCTURE_LIMIT");
    }
    // Keep decoded keys as ordered key/value pairs, including unusual names.
    const dict = [];
    for (const key of keys) {
      useChars(key, budget);
      const child = serializePageValue(value.getRaw(key), budget, depth + 1);
      // The top-level annotation list is returned separately, dereferenced.
      if (depth !== 0 || key !== "Annots") {
        dict.push([key, child]);
      }
    }
    return { dict };
  }
  if (Array.isArray(value)) {
    if (value.length > budget.nodes) {
      throw new SourceReadError("PAGE_STRUCTURE_LIMIT");
    }
    return value.map(item => serializePageValue(item, budget, depth + 1));
  }
  if (value instanceof Ref) {
    return rawRef(value);
  }
  if (value instanceof Name) {
    useChars(value.name, budget);
    return { name: value.name };
  }
  if (typeof value === "string") {
    useChars(value, budget);
    return value;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  throw new SourceReadError("PAGE_VALUE");
}

function readIndirect(xref, ref) {
  const entry = ref instanceof Ref && xref.getEntry(ref.num);
  if (!entry?.uncompressed || entry.gen !== ref.gen) {
    throw new SourceReadError("PAGE_REFERENCE");
  }
  // Decode the bytes again, outside the rendering path's object cache.
  return xref.fetchUncompressed(ref, entry, false, false);
}

function readPageDictionary(doc, ref) {
  const { xref } = doc;
  const page = readIndirect(xref, ref);
  if (!(page instanceof Dict)) {
    throw new SourceReadError("PAGE_DICTIONARY");
  }
  const rawAnnots = page.getRaw("Annots");
  const annotsRef = rawRef(rawAnnots);
  let annots = rawAnnots === undefined ? [] : rawAnnots;
  if (annotsRef) {
    annots = readIndirect(xref, rawAnnots);
  }
  if (!Array.isArray(annots) || annots.length > 4096) {
    throw new SourceReadError("ANNOTATIONS_LIMIT");
  }
  const dictionary = serializePageValue(page, {
    nodes: 16384,
    chars: 128 * 1024,
  });
  return {
    ref: rawRef(ref),
    dictionary,
    annotsRef,
    annots: annots.map(rawRef),
    annotsMatchXRef: annots.every(annot => matchesXRef(xref, annot)),
  };
}

function proofWindow(stream, start) {
  if (!Number.isSafeInteger(start) || start < 0 || start >= stream.length) {
    throw new SourceReadError("PROOF_SOURCE");
  }
  const end = Math.min(start + PROOF_WINDOW_BYTES, stream.length);
  const chunkSize = stream.chunkSize;
  const ranges = [];
  // Hash resident bytes only. Reading holes would force loading the whole PDF.
  for (let pos = start; pos < end; ) {
    const maxEnd = Math.min(end, pos + PROOF_CHUNK_BYTES);
    let until = maxEnd;
    if (chunkSize && !stream.isDataLoaded) {
      const chunk = Math.floor(pos / chunkSize);
      if (pos < stream.progressiveDataLength) {
        until = Math.min(until, stream.progressiveDataLength);
      } else if (stream.hasChunk(chunk)) {
        let current = chunk;
        while (stream.hasChunk(current) && (current + 1) * chunkSize < maxEnd) {
          current++;
        }
        until = Math.min(
          until,
          current * chunkSize + (stream.hasChunk(current) ? chunkSize : 0)
        );
      } else {
        pos = Math.min(end, (chunk + 1) * chunkSize);
        continue;
      }
    }
    if (ranges.length >= MAX_PROOF_RANGES) {
      throw new SourceReadError("PROOF_RANGE_LIMIT");
    }
    const hash = Array.from(
      calculateMD5(stream.bytes, pos, until - pos),
      byte => byte.toString(16).padStart(2, "0")
    ).join("");
    ranges.push({ start: pos, end: until, hash });
    pos = until;
  }
  return { ranges, end };
}

async function getIncrementalSource(pdfManager, loadState, action, payload) {
  const doc = pdfManager.pdfDocument;
  try {
    switch (action) {
      case "info":
        return await pdfManager.ensure(
          { read: () => readSourceInfo(doc, loadState) },
          "read"
        );
      case "page": {
        const pageIndex = payload?.pageIndex;
        if (
          !Number.isInteger(pageIndex) ||
          pageIndex < 0 ||
          pageIndex >= doc.numPages
        ) {
          return { error: "PAGE_INDEX" };
        }
        const { ref } = await pdfManager.getPage(pageIndex);
        return await pdfManager.ensure(
          { read: () => readPageDictionary(doc, ref) },
          "read"
        );
      }
      case "proof":
        return proofWindow(doc.stream, payload?.start);
      default:
        return { error: "ACTION" };
    }
  } catch (reason) {
    if (reason instanceof SourceReadError) {
      return { error: reason.message };
    }
    throw reason;
  }
}

export { getIncrementalSource };
