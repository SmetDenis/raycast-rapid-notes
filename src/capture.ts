import { Toast, showToast } from "@raycast/api";
import { join } from "node:path";
import { readCaptureInputs } from "./lib/capture-inputs";
import { upsertUpdatedField } from "./lib/frontmatter";
import {
  type RoutedAppendConfig,
  planSilentAppend,
  planSilentCreate,
  renderAppendedFile,
} from "./lib/plan";
import { parseTags } from "./lib/tags";
import { type TemplateFn } from "./lib/templates";
import {
  type Source,
  fileExists,
  readClipboardText,
  readFile,
  readSelection,
  readSource,
  writeFile,
} from "./shared";

// Adapter helpers shared by the no-view (instant) commands. Not unit-tested (they import
// @raycast/api); all real logic lives in ./lib. Verify behaviour via `make dev`.

/** The @raycast/api-backed readers injected into lib's readCaptureInputs. */
const captureReaders = {
  readSelection,
  readClipboard: readClipboardText,
};

/** Read capture inputs for `source`, injecting the real selection/clipboard readers. */
function readInputs(
  source: Source,
  useSelection: boolean,
  useClipboard: boolean,
) {
  return readCaptureInputs(
    { bundleId: source.bundleId, useSelection, useClipboard },
    captureReaders,
  );
}

/** Prefs common to both instant paths. */
interface BasePrefs {
  dateFormat: string;
  useClipboard: boolean;
  mergeSeparator: string;
}

/** Prefs the instant APPEND path needs. Adds `useSelection` (append-only); no tag source / filename format. */
export interface AppendPrefs extends BasePrefs {
  useSelection: boolean;
}

/**
 * Prefs the instant CREATE path needs: adds the filename format and the tag source. NOTE: create has
 * no `useSelection` toggle — those commands (New Task / New Note) are EXPERIMENTAL and always read the
 * selection (preserving their prior behaviour); only append gained the opt-in selection toggle.
 */
export interface CreatePrefs extends BasePrefs {
  filenameDateFormat: string;
  defaultTags: string;
}

export interface CommandArgs {
  text?: string;
  project?: string;
  title?: string;
}

// RoutedAppendConfig lives in ./lib/plan (pure) and is re-exported for the command adapters.
export type { RoutedAppendConfig };

/**
 * Instant append (no-view): read selection/clipboard, then delegate the whole decision to the pure
 * `planSilentAppend` (content merge + shape routing + rendering + empty/missing branches). This
 * adapter only does I/O and UI: read the target file, write the spliced result, and map the plan's
 * discriminated outcome to a Toast (green Success / red Failure).
 */
export async function runSilentAppend(
  args: CommandArgs,
  config: RoutedAppendConfig,
  prefs: AppendPrefs,
): Promise<void> {
  const source = await readSource();
  const inputs = await readInputs(
    source,
    prefs.useSelection,
    prefs.useClipboard,
  );
  const plan = planSilentAppend({
    args,
    inputs,
    source: { url: source.url, title: source.title, app: source.app },
    config,
    now: new Date(),
    dateFormat: prefs.dateFormat,
    mergeSeparator: prefs.mergeSeparator,
  });

  switch (plan.kind) {
    case "emptyTerminal":
      // A non-AX terminal can't expose its selection to the AX API — only its clipboard
      // (copy-on-select) is reachable — so an empty capture there gets a terminal-specific
      // message (enable a toggle / pass an argument) rather than the generic "nothing selected".
      await showToast({
        style: Toast.Style.Failure,
        title: "Nothing to capture in this terminal",
        message:
          "GPU terminals expose only the clipboard — enable Use Selection or Use Clipboard, or pass text as an argument.",
      });
      return;
    case "emptyGeneric":
      await showToast({
        style: Toast.Style.Failure,
        title: "Nothing to append",
        message: plan.usedClipboard
          ? "Nothing selected and clipboard is empty"
          : "Nothing selected",
      });
      return;
    case "missingTarget":
      await showToast({
        style: Toast.Style.Failure,
        title: `Set the append ${plan.format} file in preferences`,
      });
      return;
  }

  try {
    const appended = renderAppendedFile(readFile(plan.file), plan);
    writeFile(plan.file, upsertUpdatedField(appended, plan.updated));
    await showToast({ style: Toast.Style.Success, title: "Appended" });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to append",
      message: String(error),
    });
  }
}

/**
 * Instant create (no-view): read selection/clipboard, then delegate to the pure `planSilentCreate`
 * (empty guard + argument merge + frontmatter-file composition + collision-free filename). This
 * adapter only does I/O and UI. NOTE: create (New Task / New Note) is EXPERIMENTAL and has no
 * useSelection toggle — it always reads the selection (its prior behaviour); only append opted in.
 */
export async function runSilentCreate(
  args: CommandArgs,
  config: {
    directory: string;
    template: TemplateFn;
    frontmatter: string;
  },
  prefs: CreatePrefs,
  label: string,
): Promise<void> {
  const source = await readSource();
  const inputs = await readInputs(source, true, prefs.useClipboard);
  try {
    const plan = planSilentCreate({
      args,
      inputs,
      source: { url: source.url, title: source.title, app: source.app },
      directory: config.directory,
      template: config.template,
      frontmatter: config.frontmatter,
      tags: parseTags(prefs.defaultTags ?? ""),
      now: new Date(),
      dateFormat: prefs.dateFormat,
      filenameDateFormat: prefs.filenameDateFormat,
      mergeSeparator: prefs.mergeSeparator,
      exists: (name) => fileExists(join(config.directory, name)),
    });
    switch (plan.kind) {
      case "missingDirectory":
        await showToast({
          style: Toast.Style.Failure,
          title: `Set the ${label} directory in preferences`,
        });
        return;
      case "empty":
        await showToast({
          style: Toast.Style.Failure,
          title: "Nothing to capture",
        });
        return;
    }
    writeFile(join(plan.directory, plan.filename), plan.file);
    await showToast({
      style: Toast.Style.Success,
      title: "Created",
      message: plan.filename,
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to create",
      message: String(error),
    });
  }
}
