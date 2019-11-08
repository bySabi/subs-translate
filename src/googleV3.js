const invariant = require('tiny-invariant');
const path = require('path-extra');
const { TranslationServiceClient } = require('@google-cloud/translate').v3beta1;
const { existsFileSync } = require('./util');

// Load ENV vars
require('dotenv').config();

// Google account settings
/// GOOGLE_APPLICATION_CREDENTIALS path already set in '.env'
const LOCATION = process.env.GOOGLE_LOCATION || 'global';
let PROJECT_ID; // come from JSON file

function googleAPIkeySetupValidation(key) {
  if (key) {
    // provide key file has priority over .env settings
    key = path.resolve(key);
    invariant(existsFileSync(key), `Provide "--key" file "${key}" cannot be found`);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = key; // rewrite env var
  }
  invariant(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'GOOGLE_APPLICATION_CREDENTIALS need to be set usign --key or through a env var'
  );
  PROJECT_ID = require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)).project_id;
  invariant(PROJECT_ID, `Invalid JSON key file ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
}

async function translate(text, slang = 'en', tlang = 'es') {
  const translationClient = new TranslationServiceClient();
  // Construct request
  const request = {
    parent: translationClient.locationPath(PROJECT_ID, LOCATION),
    contents: text,
    mimeType: 'text/plain', // mime types: text/plain, text/html
    sourceLanguageCode: slang,
    targetLanguageCode: tlang,
  };

  const [response] = await translationClient.translateText(request);
  return response.translations.map(res => res.translatedText);
}

module.exports = {
  googleAPITrans: translate,
  googleAPIkeySetupValidation,
};

// UNCOMMENT for test
/*
translate(["Google translator", "pencil", "dog", "cat"], "en", "es").then(res =>
  console.log(res)
);
*/
