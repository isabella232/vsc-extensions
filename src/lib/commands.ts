import * as vscode from "vscode";
import { getEol } from "./env";
import {
  ExtensionContext,
  QuickPickOptions,
  QuickPickItem,
  Selection,
  TextEditor,
} from "vscode";
import { addTable } from "./tables";
import {
  surroundSelection,
  surroundBlockSelection,
  isAnythingSelected,
  isBlockMatch,
  replaceBlockSelection,
  prefixLines,
  getSurroundingWord,
  replaceSelection,
  getLineSelection,
  isMatch,
  getBlockSelection,
  reSelect,
} from "./editorHelpers";

interface CommandItem extends QuickPickItem {
  label: string;
}

class Command implements CommandItem {
  command: string;
  description?: string;
  showInCommandPalette: boolean;
  callback: () => void;
  label: string;

  constructor(
    command: string,
    callback: () => void,
    label: string,
    description?: string,
    showInCommandPalette?: boolean
  ) {
    this.command = command;
    this.callback = callback;
    this.label = label;
    this.description = description;
    this.showInCommandPalette = showInCommandPalette
      ? showInCommandPalette
      : false;
  }
}

const _commands: Command[] = [
  new Command(
    "toggleCitations",
    toggleCitations,
    "Toggle Citations",
    "> Citations",
    true
  ),
  new Command(
    "toggleStrikethrough",
    toggleStrikethrough,
    "Toggle Strikethrough",
    "~~Strikethrough text~~",
    true
  ),
  new Command(
    "showCommandPalette",
    showCommandPalette,
    "Show Command Palette",
    "",
    false
  ),
  new Command("toggleBold", toggleBold, "Toggle bold", "**Bold text**", true),
  new Command(
    "toggleItalic",
    toggleItalic,
    "Toggle italic",
    "_italic text_",
    true
  ),
  new Command(
    "toggleCodeBlock",
    toggleCodeBlock,
    "Toggle code block",
    "```Code block```",
    true
  ),
  new Command(
    "toggleInlineCode",
    toggleInlineCode,
    "Toggle inline code",
    "`Inline code`",
    true
  ),
  new Command(
    "toggleLink",
    toggleLink,
    "Toggle hyperlink",
    "[Link text](link_url)",
    true
  ),
  new Command(
    "toggleImage",
    toggleImage,
    "Toggle image",
    "![](image_url)",
    true
  ),
  new Command(
    "toggleBullets",
    toggleBullets,
    "Toggle bullet points",
    "* Bullet point",
    true
  ),
  new Command(
    "toggleNumbers",
    toggleNumberList,
    "Toggle number list",
    "1 Numbered list item",
    true
  ),
  new Command(
    "toggleTitleH1",
    toggleTitleH1,
    "Toggle title H1",
    "# Title",
    true
  ),
  new Command(
    "toggleTitleH2",
    toggleTitleH2,
    "Toggle title H2",
    "## Title",
    true
  ),
  new Command(
    "toggleTitleH3",
    toggleTitleH3,
    "Toggle title H3",
    "### Title",
    true
  ),
  new Command(
    "toggleTitleH4",
    toggleTitleH4,
    "Toggle title H4",
    "#### Title",
    true
  ),
  new Command(
    "toggleTitleH5",
    toggleTitleH5,
    "Toggle title H5",
    "##### Title",
    true
  ),
  new Command(
    "toggleTitleH6",
    toggleTitleH6,
    "Toggle title H6",
    "###### Title",
    true
  ),
  new Command(
    "toggleCheckboxes",
    toggleCheckboxes,
    "Toggle checkboxes",
    "- [x] Checkbox item",
    true
  ),
  new Command("addTable", addTable, "Add table", "Tabular | values", true),
  // Adobe Specific Commands
  new Command(
    "toggleNote",
    toggleNote,
    "Toggle note",
    ">[!NOTE]\r\n>This is a NOTE block.",
    true
  ),
  new Command(
    "toggleTip",
    toggleTip,
    "Toggle tip",
    ">[!TIP]\r\n>This is a TIP.",
    true
  ),
  new Command(
    "toggleCaution",
    toggleCaution,
    "Toggle caution",
    ">[!CAUTION]\r\n>This is a Caution block.",
    true
  ),
  new Command(
    "toggleWarning",
    toggleWarning,
    "Toggle warning",
    ">[!Warning]\r\n>This is a Warning block.",
    true
  ),
  new Command(
    "toggleImportant",
    toggleImportant,
    "Toggle Important",
    ">[!IMPORTANT]\r\n>This is a IMPORTANT block.",
    true
  ),
  new Command(
    "toggleAdministration",
    toggleAdministration,
    "Toggle administration",
    ">[!ADMINISTRATION]\r\n>This is a ADMINISTRATION block.",
    true
  ),
  new Command(
    "toggleAvailability",
    toggleAvailability,
    "Toggle availability",
    ">[!AVAILABILITY]\r\n>This is a AVAILABILITY block.",
    true
  ),
  new Command(
    "togglePrerequisites",
    togglePrerequisites,
    "Toggle Prerequisites",
    ">[!PREREQUISITES]\r\n>This is a PREREQUISITES block.",
    true
  ),
  new Command(
    "toggleError",
    toggleError,
    "Toggle Error",
    ">[!ERROR]\r\n>This is a ERROR block.",
    true
  ),
  new Command(
    "toggleInfo",
    toggleInfo,
    "Toggle Info",
    ">[!INFO]\r\n>This is a INFO block.",
    true
  ),
  new Command(
    "toggleSuccess",
    toggleSuccess,
    "Toggle Success",
    ">[!SUCCESS]\r\n>This is a SUCCESS block.",
    true
  ),
  new Command(
    "toggleMoreLikeThis",
    toggleMoreLikeThis,
    "Toggle More Like This",
    ">[!MORELIKETHIS]\r\n>This is a MORE LIKE THIS block.",
    true
  ),
  new Command(
    "toggleVideo",
    toggleVideo,
    "Toggle video",
    ">[!VIDEO](video_url))",
    true
  ),

  new Command(
    "toggleDNL",
    toggleDNL,
    "Toggle DNL",
    "[!DNL unlocalized text]",
    true
  ),

  new Command(
    "toggleUIControl",
    toggleUIControl,
    "Toggle UIControl",
    "[!UICONTROL text to be translated]",
    true
  ),
];

let newLine = getEol();

export function register(context: ExtensionContext) {
  _commands.map((cmd) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "md-shortcut." + cmd.command,
        cmd.callback
      )
    );
  });
}

function showCommandPalette() {
  const options: QuickPickOptions = { matchOnDescription: true };
  vscode.window
    .showQuickPick(
      _commands.filter((cmd) => cmd.showInCommandPalette),
      options
    )
    .then((cmd) => {
      if (!cmd) {
        return;
      }
      cmd.callback();
    });
}

const wordMatch: string = "[A-Za-z\\u00C0-\\u017F]";

interface BoldExpressions {
  [idx: string]: RegExp;
}

interface ItalicExpressions {
  [idx: string]: RegExp;
}

const toggleBoldExpressions: BoldExpressions = {
  "**": new RegExp(`\\*{2}${wordMatch}*\\*{2}|${wordMatch}+`),
  __: new RegExp(`_{2}${wordMatch}*_{2}|${wordMatch}+`),
};

const toggleItalicExpressions: ItalicExpressions = {
  "_": new RegExp(`\\_{1}${wordMatch}*\\_{1}|${wordMatch}+`),
  __: new RegExp(`\\{2}${wordMatch}*\\{2}|${wordMatch}+`),
};

function toggleBold(): void | Thenable<void> | Thenable<boolean> {
  const marker: string | undefined = vscode.workspace
    .getConfiguration("markdownShortcuts.bold")
    .get("marker");
  if (!marker) {
    return;
  }

  return surroundSelection(marker, marker, toggleBoldExpressions[marker]);
}

function toggleItalic(): void | Thenable<void> | Thenable<boolean> {
  const marker: string | undefined = vscode.workspace
    .getConfiguration("markdownShortcuts.italics")
    .get("marker");
  if (!marker) {
    return;
  }
  const pattern: RegExp = new RegExp(`\\${marker}?${wordMatch}*\\${marker}?`);

  return surroundSelection(marker, marker, toggleItalicExpressions[marker]);
}

const toggleStrikethroughPattern: RegExp = new RegExp(
  "~{2}" + wordMatch + "*~{2}|" + wordMatch + "+"
);
function toggleStrikethrough() {
  return surroundSelection("~~", "~~", toggleStrikethroughPattern);
}

const startingBlock: string = "```" + newLine;
const endingBlock: string = newLine + "```";
const codeBlockWordPattern: RegExp = new RegExp(
  `${startingBlock}.+${endingBlock}|.+`,
  "gm"
);
function toggleCodeBlock() {
  return surroundBlockSelection(
    startingBlock,
    endingBlock,
    codeBlockWordPattern
  );
}

const toggleInlineCodePattern = new RegExp(
  "`" + wordMatch + "*`|" + wordMatch + "+"
);
function toggleInlineCode() {
  return surroundSelection("`", "`", toggleInlineCodePattern);
}

const headerWordPattern = /#{1,6} .+|.+/;
function toggleTitleH1() {
  return surroundSelection("# ", "", headerWordPattern);
}

function toggleTitleH2() {
  return surroundSelection("## ", "", headerWordPattern);
}

function toggleTitleH3() {
  return surroundSelection("### ", "", headerWordPattern);
}

function toggleTitleH4() {
  return surroundSelection("#### ", "", headerWordPattern);
}

function toggleTitleH5() {
  return surroundSelection("##### ", "", headerWordPattern);
}

function toggleTitleH6() {
  return surroundSelection("###### ", "", headerWordPattern);
}

const addBullets: RegExp = /^(\s*)(.+)$/gm;
function toggleBullets() {
  const marker = vscode.workspace
    .getConfiguration("markdownShortcuts.bullets")
    .get("marker");

  if (!isAnythingSelected()) {
    return surroundSelection(
      marker + " ",
      "",
      new RegExp("\\" + marker + " .+|.+")
    );
  }

  const hasBullets = new RegExp("^(\\s*)\\" + marker + " (.*)$", "gm");

  if (isBlockMatch(hasBullets)) {
    return replaceBlockSelection((text) => text.replace(hasBullets, "$1$2"));
  } else {
    return replaceBlockSelection((text) =>
      text.replace(addBullets, "$1" + marker + " $2")
    );
  }
}

interface LineNums {
  [index: string]: number;
}

const hasNumbers: RegExp = /^(\s*)[0-9]\.+ (.*)$/gm;
const addNumbers: RegExp = /^(\n?)(\s*)(.+)$/gm;
function toggleNumberList() {
  if (!isAnythingSelected()) {
    return surroundSelection("1. ", "");
  }

  if (isBlockMatch(hasNumbers)) {
    return replaceBlockSelection((text) => text.replace(addNumbers, "$1$2"));
  } else {
    const lineNums: LineNums = {};
    return replaceBlockSelection((text) =>
      text.replace(addNumbers, (match, newline, whitespace, line) => {
        if (!lineNums[whitespace]) {
          lineNums[whitespace] = 1;
        }
        return newline + whitespace + lineNums[whitespace]++ + ". " + line;
      })
    );
  }
}

const hasCheckboxes: RegExp = /^(\s*)- \[[ x]{1}\] (.*)$/gim;
const addCheckboxes: RegExp = /^(\s*)(.+)$/gm;
function toggleCheckboxes() {
  if (!isAnythingSelected()) {
    return surroundSelection("- [ ] ", "", /- \[[ x]{1}\] .+|.+/gi);
  }

  if (isBlockMatch(hasCheckboxes)) {
    return replaceBlockSelection((text) => text.replace(hasCheckboxes, "$1$2"));
  } else {
    return replaceBlockSelection((text) =>
      text.replace(addCheckboxes, "$1- [ ] $2")
    );
  }
}

const hasCitations = /^(\s*)> (.*)$/gim;
const addCitations = /^(\s*)(.*)$/gm;

function toggleCitations() {
  if (!isAnythingSelected()) {
    return surroundSelection("> ", "", /> .+|.+/gi);
  }

  if (isBlockMatch(hasCitations)) {
    return replaceBlockSelection((text) => text.replace(hasCitations, "$1$2"));
  } else {
    return prefixLines("> ");
  }
}

interface LinkUrl {
  text: string;
  url: string | undefined;
}

function getLinkText(selection: Selection): Thenable<string | undefined> {
  if (selection.isEmpty) {
    return vscode.window.showInputBox({
      prompt: "Image alt text",
    });
  }

  return Promise.resolve("");
}

function getLinkUrl(
  linkText: string | undefined
): LinkUrl | Thenable<LinkUrl> | void {
  if (linkText === null || linkText === undefined) {
    return;
  }

  return vscode.window
    .showInputBox({
      prompt: "Image URL",
    })
    .then((url) => {
      return { text: linkText, url: url };
    });
}

function addTags(options: LinkUrl | void): void | Thenable<void> {
  if (!options || !options.url) {
    return;
  }
  surroundSelection("![" + options.text, "](" + options.url + ")");
}

const markdownLinkRegex: RegExp = /^\[.+\]\(.+\)$/;
const urlRegex: RegExp = /^(http[s]?:\/\/.+|<http[s]?:\/\/.+>)$/;
const markdownLinkWordPattern: RegExp = new RegExp(
  "[.+](.+)|" + wordMatch + "+"
);
function toggleLink():
  | Thenable<LinkUrl>
  | void
  | Thenable<void>
  | Thenable<boolean> {
  const editor: TextEditor | undefined = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  let selection: Selection = editor.selection;

  if (!isAnythingSelected()) {
    const withSurroundingWord = getSurroundingWord(
      editor,
      selection,
      markdownLinkWordPattern
    );

    if (withSurroundingWord) {
      selection = editor.selection = withSurroundingWord;
    }
  }

  if (isAnythingSelected()) {
    if (isMatch(markdownLinkRegex)) {
      //Selection is a MD link, replace it with the link text
      return replaceSelection((text) => {
        const mdLink: RegExpMatchArray | null = text.match(/\[(.+)\]/);
        return mdLink ? mdLink[1] : text;
      });
    }

    if (isMatch(urlRegex)) {
      //Selection is a URL, surround it with angle brackets
      return surroundSelection("<", ">");
    }
  }

  return getLinkText(selection).then(getLinkUrl).then(addTags);
}

const markdownImageRegex: RegExp = /!\[.*\]\((.+)\)/;
function toggleImage() {
  const editor: TextEditor | undefined = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  let selection: Selection = editor.selection;

  if (isAnythingSelected()) {
    if (isMatch(markdownImageRegex)) {
      //Selection is a MD link, replace it with the link text
      return replaceSelection((text) => {
        const textMatch: RegExpMatchArray | null = text.match(
          markdownImageRegex
        );
        return textMatch ? textMatch[1] : "";
      });
    }

    if (isMatch(urlRegex)) {
      return vscode.window
        .showInputBox({
          prompt: "Image alt text",
        })
        .then((text) => {
          if (text === null) {
            return;
          }
          replaceSelection((url) => "![" + text + "](" + url + ")");
        });
    }
  }
  return getLinkText(selection).then(getLinkUrl).then(addTags);
}

const startingNote: string = `>[!NOTE]${newLine}>${newLine}>`;
const endingNote: string = newLine;
const noteBlockWordPattern: RegExp = new RegExp(
  startingNote + ".+" + endingNote + "|.+",
  "gm"
);
function toggleNote() {
  return surroundBlockSelection(startingNote, endingNote, noteBlockWordPattern);
}

const startingTip: string = ">[!TIP]" + newLine + ">" + newLine + ">";
const endingTip: string = newLine;
const tipBlockWordPattern: RegExp = new RegExp(
  startingTip + ".+" + endingTip + "|.+",
  "gm"
);
function toggleTip() {
  return surroundBlockSelection(startingTip, endingTip, tipBlockWordPattern);
}

const startingCaution: string = ">[!CAUTION]" + newLine + ">" + newLine + ">";
const endingCaution: string = newLine;
const cautionBlockWordPattern: RegExp = new RegExp(
  startingCaution + ".+" + endingCaution + "|.+",
  "gm"
);
function toggleCaution() {
  return surroundBlockSelection(
    startingCaution,
    endingCaution,
    cautionBlockWordPattern
  );
}

const startingWarning: string = ">[!WARNING]" + newLine + ">" + newLine + ">";
const endingWarning = newLine;
const warningBlockWordPattern = new RegExp(
  startingWarning + ".+" + endingWarning + "|.+",
  "gm"
);
function toggleWarning() {
  return surroundBlockSelection(
    startingWarning,
    endingWarning,
    warningBlockWordPattern
  );
}

const startingImportant = ">[!IMPORTANT]" + newLine + ">" + newLine + ">";
const endingImportant = newLine;
const importantBlockWordPattern = new RegExp(
  startingImportant + ".+" + endingImportant + "|.+",
  "gm"
);
function toggleImportant() {
  return surroundBlockSelection(
    startingImportant,
    endingImportant,
    importantBlockWordPattern
  );
}

const startingAvailability: string = `>[!AVAILABILITY]${newLine}>${newLine}>`;
const endingAvailability: string = newLine;
const availabilityBlockWordPattern: RegExp = new RegExp(
  startingAvailability + ".+" + endingAvailability + "|.+",
  "gm"
);
function toggleAvailability() {
  return surroundBlockSelection(startingAvailability, endingAvailability, availabilityBlockWordPattern);
}

const startingAdministration: string = `>[!ADMINISTRATION]${newLine}>${newLine}>`;
const endingAdministration: string = newLine;
const administrationBlockWordPattern: RegExp = new RegExp(
  startingAdministration + ".+" + endingAdministration + "|.+",
  "gm"
);
function toggleAdministration() {
  return surroundBlockSelection(startingAdministration, endingAdministration, administrationBlockWordPattern);
}

const startingPrerequisites: string = `>[!PREREQUISITES]${newLine}>${newLine}>`;
const endingPrerequisites: string = newLine;
const prerequisitesBlockWordPattern: RegExp = new RegExp(
  startingPrerequisites + ".+" + endingPrerequisites + "|.+",
  "gm"
);
function togglePrerequisites() {
  return surroundBlockSelection(startingPrerequisites, endingPrerequisites, prerequisitesBlockWordPattern);
}

const startingError: string = `>[!ERROR]${newLine}>${newLine}>`;
const endingError: string = newLine;
const errorBlockWordPattern: RegExp = new RegExp(
  startingError + ".+" + endingError + "|.+",
  "gm"
);
function toggleError() {
  return surroundBlockSelection(startingError, endingError, errorBlockWordPattern);
}

const startingInfo: string = `>[!INFO]${newLine}>${newLine}>`;
const endingInfo: string = newLine;
const infoBlockWordPattern: RegExp = new RegExp(
  startingInfo + ".+" + endingInfo + "|.+",
  "gm"
);
function toggleInfo() {
  return surroundBlockSelection(startingInfo, endingInfo, infoBlockWordPattern);
}

const startingSuccess: string = `>[!SUCCESS]${newLine}>${newLine}>`;
const endingSuccess: string = newLine;
const successBlockWordPattern: RegExp = new RegExp(
  startingSuccess + ".+" + endingSuccess + "|.+",
  "gm"
);
function toggleSuccess() {
  return surroundBlockSelection(startingSuccess, endingSuccess, successBlockWordPattern);
}

const startingMoreLikeThis =
  ">[!MORELIKETHIS]" + newLine + '>' + newLine;
const endingMoreLikeThis = newLine;
const moreLikeThisBlockWordPattern = new RegExp(
  startingMoreLikeThis + ".+" + endingMoreLikeThis + "|.+",
  "gm"
);
function toggleMoreLikeThis(): Thenable<boolean | void> {
  return surroundBlockSelection(
    startingMoreLikeThis,
    endingMoreLikeThis,
    moreLikeThisBlockWordPattern
  );
}

function addTagsToVideo(url: string): Thenable<boolean> {
  return surroundSelection(`>[!VIDEO](${url})`, '');
}

function getLinkUrlToVideo(
): Thenable<string> {
  return vscode.window
    .showInputBox({
      prompt: "Video URL",
    })
    .then((url) => {
      return url || '';
    });
}

const markdownVideoRegex: RegExp = /^>\[\!VIDEO\]\(.+\).*/;
const videoUrlRegex: RegExp = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

function toggleVideo(): Thenable<boolean> {
  const editor: TextEditor | undefined = vscode.window.activeTextEditor;
  if (!editor) {
    return Promise.reject('No text editor available');
  }
  let selection: Selection = editor.selection = getLineSelection() || editor.selection;

  // If nothing is selected, select everything on the current line.
  // if (!isAnythingSelected()) {
  //   // const withSurroundingWord = getSurroundingWord(
  //   //   editor,
  //   //   selection,
  //   //   currentTextLine
  //   // );

  //   // if (withSurroundingWord) {
  //   //   selection = editor.selection = withSurroundingWord;
  //   // }
  //   selection = editor.selection = getLineSelection() || editor.selection;
  // }

  // If anything is selected, look for an existing VIDEO tag.
  if (isAnythingSelected()) {
    if (isMatch(markdownVideoRegex)) {
      //Selection is a MD link, replace it with the link text
      return replaceSelection((text) => {
        const videoUrl: RegExpMatchArray | null = text.match(/\((.+)\)/); // Match everything in parentheses
        return videoUrl ? videoUrl[1] : text;
      });
    }

    if (isMatch(videoUrlRegex)) {
      return replaceSelection((text) => {
        const videoUrl: RegExpMatchArray | null = text.match(videoUrlRegex);
        if (!(videoUrl && videoUrl.input)) {
          return text; // Should never happen because of the isMatch condition
        } else {
          if (videoUrl && videoUrl[0].length < videoUrl.input.length && videoUrl.index) {
            return `>[!VIDEO](${videoUrl[0]}) ${videoUrl.input}`;
          } else {
            return `>[!VIDEO](${videoUrl[0]})`;
          }
        }
      });
    }
  }

  const linkToVideo = getLinkUrlToVideo();

  return linkToVideo.then(
    (linkObj) => {
      if (linkObj) {
        return addTagsToVideo(linkObj);
      } else { return Promise.reject('No URL provided.'); };
    });

}

const toggleDNLPattern: RegExp = new RegExp(
  "[!DNL" + wordMatch + "]" + wordMatch + "+"
);
function toggleDNL() {
  return surroundSelection("[!DNL ", "]", toggleDNLPattern);
}

const toggleUIControlPattern: RegExp = new RegExp(
  "[!UICONTROL " + wordMatch + "]" + wordMatch + "+"
);
function toggleUIControl() {
  return surroundSelection("[!UICONTROL ", "]", toggleDNLPattern);
}
