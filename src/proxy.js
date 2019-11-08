const fetch = require("node-fetch");
const moment = require("moment");
const invariant = require("tiny-invariant");
const store = require("./store");
const { translateWithProxy } = require("./puppy");

const PROXY_LIST_URL =
  "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt";

let FETCHED_PROXYLIST;
let CURRENT_PROXY;

function invalidCurrentProxy() {
  store.del("proxy.working");
}

async function rotateProxy() {
  // last stored working proxy
  let proxy = store.get("proxy.working");
  if (proxy) {
    return proxy;
  }

  // update proxy list
  if (!FETCHED_PROXYLIST) await init();

  // pop last proxy in the list
  proxy = FETCHED_PROXYLIST.pop();

  // write back proxy list updated
  store.set("proxy.fetched", FETCHED_PROXYLIST);
  // fail is proxy list is empty
  invariant(proxy, "PROXY_LIST_IS_EMPTY!! remove '--proxy' option");
  store.set("proxy.working", proxy);
  return proxy;
}

async function testedProxy() {
  // already have a current working proxy
  if (CURRENT_PROXY) {
    return CURRENT_PROXY;
  }

  // test each proxy recursivelly until proxy list is empty or non proxy error were throw
  let success = false;
  const proxy = await rotateProxy();
  try {
    // test EN->ES traslation: "dog"->"perro"
    const res = await translateWithProxy(["dog"], "en", "es", proxy);
    invariant(res[0] === "perro", "TRANSLATE_USING_PROXY_FAILED");
    success = true;
  } catch (err) {
    console.error(`FAIL proxy: ${proxy} => ${err.message}`);
    invalidCurrentProxy();
    success = false;
  }
  // save working proxy
  if (!success) {
    return await testedProxy();
  } else {
    return (CURRENT_PROXY = proxy);
  }
}

async function proxyList() {
  const res = await fetch(PROXY_LIST_URL);
  const list = await res.text();
  return list.split("\n").slice(0, -1);
}

async function init() {
  // Last time count was updated. From `store.json`
  let LAST_FETCHED_PROXYLIST = store.get("LAST_FETCHED_PROXYLIST");
  if (LAST_FETCHED_PROXYLIST) {
    LAST_FETCHED_PROXYLIST = moment.utc(LAST_FETCHED_PROXYLIST);
  }

  if (
    !LAST_FETCHED_PROXYLIST ||
    LAST_FETCHED_PROXYLIST.diff(Date.now(), "days") !== 0 ||
    !store.has("proxy.fetched")
  ) {
    store.set("LAST_FETCH_PROXYLIST", new Date().toUTCString());
    FETCHED_PROXYLIST = await proxyList();
    store.set("proxy.fetched", FETCHED_PROXYLIST);
  }
  FETCHED_PROXYLIST = store.get("proxy.fetched");
}

module.exports = testedProxy;
