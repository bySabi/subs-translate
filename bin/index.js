#!/usr/bin/env node
"use strict";

const yargs = require("yargs");
const fs = require("fs");
const os = require("os");
const path = require("path-extra");
const srt2vtt = require("srt-to-vtt");
const webvtt = require("node-webvtt");
const invariant = require("tiny-invariant");
const updateDotenv = require("update-dotenv");
const moment = require("moment");
//const uniqueFilename = require("unique-filename");

const { TranslationServiceClient } = require("@google-cloud/translate").v3beta1;

const MAX_MONTHLY_CHAR_COUNT = 500000; // MAX Google API v3 Monthly free character counts
const SAFE_MONTHLY_CHAR_COUNT = MAX_MONTHLY_CHAR_COUNT - 300; // SAFE Counter of 499 700 characters

const TODAY = moment.utc(); // create UTC date
const TODAY_UTC_STR = TODAY.toDate().toUTCString();

// Load ENV vars
require("dotenv").config();

// Google account settings
const PROJECT_ID = require("../private-key.json").project_id;
const LOCATION = process.env.GOOGLE_LOCATION;

// Last time count was updated
const LAST_COUNT_DATE = moment.utc(process.env.LAST_COUNT_DATE); // UTC String Date

// this value will be MUTATE on each file translation
let CHAR_COUNT = parseInt(process.env.CHAR_COUNT || 0);

async function googleAPILimitCheck() {
  // START_BILL_DATE var is a UTC String Date
  const startBillDate = moment.utc(process.env.START_BILL_DATE);

  // PREVENT! translate subs beyond Google API 12 month trial
  invariant(
    TODAY.diff(startBillDate, "months") < 12,
    `Google APIv3 12 month trial limit reached`
  );

  const monthBillDate = startBillDate.add(
    // add months of difference between START_BILL_DATE and Today
    TODAY.diff(startBillDate, "months"),
    "months"
  );

  // cleanup monthly character counter if LAST_COUNT_DATE it is before the `monthBillDate`
  if (LAST_COUNT_DATE.diff(monthBillDate, "days") < 0) {
    CHAR_COUNT = 0;
    await updateDotenv({ CHAR_COUNT: CHAR_COUNT.toString() });
  }

  // PREVENT! translate subs beyond monthly char limit
  invariant(
    CHAR_COUNT < SAFE_MONTHLY_CHAR_COUNT,
    `Google APIv3 monthly character limit reached`
  );
}

yargs
  .usage("Usage: $0 <command> [options]")
  .command(
    "$0 <src> [dest]",
    "Translate source path SRT|VTT to VTT dest path",
    yargs => {},
    async argv => {
      await googleAPILimitCheck();
      handler(argv, { file: translateFile, dir: translateDir });
    }
  )
  .command(
    "convert <src> [dest]",
    "Convert only source path SRT to VTT dest path",
    yargs => {},
    argv => handler(argv, { file: convertFile, dir: convertDir })
  )
  .command(
    "info",
    "Show current monthly Google Translate APIv3 character counter",
    yargs => {},
    async argv => {
      await googleAPILimitCheck();
      console.log(`Current monthly character counter: ${CHAR_COUNT}`);
    }
  )
  .option("slang", {
    alias: "s",
    describe: "current lang of the file",
    default: "en-US"
  })
  .option("tlang", {
    alias: "t",
    describe: "target lang of the file",
    default: "es"
  })
  .option("depth", {
    describe: "depth folder recursion. Disable with '--no-depth'",
    default: true
  })
  .option("purge", {
    describe: "purge original file",
    default: false,
    type: "boolean"
  })
  .option("out", {
    describe: "output to folder",
    type: "string"
  })
  .option("force", {
    describe: "force overwrite existing file",
    default: false,
    type: "boolean"
  })
  .option("skip", {
    describe: "skip if already .LANG.vtt file exists",
    default: true,
    type: "boolean"
  })
  .alias("v", "version")
  .help("h")
  .alias("h", "help").argv;

function handler(argv, handle) {
  const { src } = argv;
  try {
    const stat = fs.lstatSync(src);
    if (stat.isFile(src)) {
      handle.file(argv);
    } else if (stat.isDirectory(src)) {
      handle.dir(argv);
    } else throw new Error(`Passed ${src} is unknown`);
  } catch (err) {
    console.error(err.message);
  }
}

function validatePath(argv, ext = ".vtt") {
  const { force, out } = argv;
  const src = path.resolve(argv.src); // absolute path
  let dest;
  // if we got '--out' folder '[dest]' are ignored
  if (out) {
    invariant(
      existsDirSync(out),
      `Provide "--out" path "${out}" is not a folder`
    );
    dest = path.resolve(out, path.basename(src, ".srt") + ext);
  } else if (argv.dest) {
    dest = path.resolve(argv.dest);
    invariant(
      !existsDirSync(dest),
      `Provide [dest] "${dest}" can't be a folder, use '--out'`
    );
  } else {
    dest = path.replaceExt(src, ext);
  }
  invariant(
    force || !existsSync(dest),
    `Provide [dest] "${dest}" file already exist, use '--force' for overwrite it`
  );
  return { src, dest };
}

function convertFile(argv) {
  const { purge } = argv;
  const { src, dest } = validatePath(argv);
  convert(src, dest);
  console.log(`CONVERTED file: ${dest}`);
  if (purge) {
    fs.unlinkSync(src);
    console.log(`PURGED file: ${src}`);
  }
}

function convertDir(argv_) {
  const { depth } = argv_;
  const argv = { ...argv_, out: "", dest: "" }; // 'out' and [dest] are ignored
  const src = path.resolve(argv_.src); // absolute path
  fs.readdirSync(src).forEach(file => {
    const fullPath = path.join(src, file);
    const isDirectory = fs.lstatSync(fullPath).isDirectory();
    const isSrt = fullPath.toLowerCase().endsWith(".srt");

    if (isDirectory && depth) {
      convertDir({ ...argv, src: fullPath });
    } else if (isSrt) {
      convertFile({ ...argv, src: fullPath });
    }
  });
}

function translateFile(argv) {
  const { purge, skip, slang, tlang } = argv;
  const { src, dest } = validatePath(argv, `.${tlang}.vtt`);

  // Avoid re-translate on folder recursion
  if (src.toLowerCase().endsWith(`.${tlang}.vtt`)) {
    return;
  }

  // Skip existing translation. Avoid re-translate file
  if (skip && existsFileSync(dest)) {
    console.log(`SKIPPED file: ${dest}`);
    return;
  }

  /* DISABLED: Automatic .srt check and convertion 
  const isSrt = src.toLowerCase().endsWith(".srt");
  if (isSrt) {
    const randomTmpfile = uniqueFilename(os.tmpdir()) + ".vtt";
    convertFile({ src, dest: randomTmpfile });
    src = path.resolve(randomTmpfile);
  }
*/
  translate(src, dest, slang, tlang).then(() => {
    console.log(`TRANSLATE file: ${dest}`);
    // purge? on success
    if (purge) {
      fs.unlinkSync(argv.src); // remove file original
      console.log(`PURGED file: ${argv.src}`);
    }
  });
}

function translateDir(argv_) {
  const { depth, tlang } = argv_;
  const argv = { ...argv_, out: "", dest: "" }; // 'out' and [dest] are ignored
  const src = path.resolve(argv_.src); // absolute path
  fs.readdirSync(src).forEach(file => {
    const fullPath = path.join(src, file);
    const isDirectory = fs.lstatSync(fullPath).isDirectory();

    const isVtt = fullPath.toLowerCase().endsWith(".vtt");

    if (isDirectory && depth) {
      translateDir({ ...argv, src: fullPath });
    } else if (isVtt) {
      translateFile({ ...argv, src: fullPath });
    }
  });
}

function convert(src, dest) {
  try {
    fs.createReadStream(src)
      .pipe(srt2vtt())
      .pipe(fs.createWriteStream(dest));
  } catch (e) {
    console.error(e);
    throw e;
  }
}

// default lang 'source:EN target:ES'
async function translate(src, dest, slang = "en-US", tlang = "es") {
  try {
    const data = fs.readFileSync(src, "utf8");
    const parsed = webvtt.parse(data);
    const parsedText = parsed.cues.map(cue => cue.text);
    const len = parsedText.reduce((c, text) => (c += text.length), 0); // get total chars lenght

    // this value will be write back to .env file on success translation
    CHAR_COUNT += len;
    invariant(
      // [dest] file will not be create is Google API free limit is reached
      CHAR_COUNT < SAFE_MONTHLY_CHAR_COUNT,
      `Reached secure character counter for Google API v3 monthly free plan`
    );

    // Google Part
    const translationClient = new TranslationServiceClient();
    // Construct request
    const request = {
      parent: translationClient.locationPath(PROJECT_ID, LOCATION),
      contents: parsedText,
      mimeType: "text/plain", // mime types: text/plain, text/html
      sourceLanguageCode: slang,
      targetLanguageCode: tlang
    };

    const [response] = await translationClient.translateText(request);

    for (let i = 0; i < parsedText.length; i++) {
      parsed.cues[i].text = response.translations[i].translatedText;
    }

    // update .env with translate details
    try {
      await updateDotenv({
        CHAR_COUNT: CHAR_COUNT.toString(),
        LAST_COUNT_DATE: TODAY_UTC_STR
      });
    } catch (e) {
      console.error(
        ".env file vars CHAT_COUNT and LAST_COUNT_DATE could not be update"
      );
      throw e;
    }

    // write to translate VTT
    const compiled = webvtt.compile(parsed);
    fs.writeFileSync(dest, compiled);
  } catch (e) {
    console.error(e);
    throw e;
  }
}

function existsSync(filePath) {
  try {
    fs.lstatSync(filePath);
  } catch (err) {
    if (err.code == "ENOENT") return false;
  }
  return true;
}

function existsDirSync(filePath) {
  let result;
  try {
    result = fs.lstatSync(filePath).isDirectory();
  } catch (err) {
    result = false;
  }
  return result;
}

function existsFileSync(filePath) {
  let result;
  try {
    result = fs.lstatSync(filePath).isFile();
  } catch (err) {
    result = false;
  }
  return result;
}
