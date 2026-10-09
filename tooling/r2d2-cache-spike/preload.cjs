"use strict";
// Diagnostic-only child process instrumentation and defense-in-depth: localhost sockets only.
const fs = require("node:fs");
const net = require("node:net");
const tls = require("node:tls");
const logfile = process.env.FLYTALLY_R2D2_SPIKE_MEMORY_LOG;
if (!logfile || process.env.FLYTALLY_R2D2_SPIKE !== "1") {
  throw new Error("R2D.2 preload may run only under its explicit isolated manual harness");
}
const allow = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
function hostOf(args) {
  const v = args[0];
  if (v && typeof v === "object") {
    if (v.path) return null;
    return v.host || v.hostname || "localhost";
  }
  if (typeof args[1] === "string") return args[1];
  return "localhost";
}
function guard(orig) {
  return function(...args) {
    const host = hostOf(args);
    if (host && !allow.has(host)) throw new Error("R2D.2 spike forbids remote sockets");
    return orig.apply(this,args);
  };
}
net.connect = guard(net.connect);
net.createConnection = guard(net.createConnection);
net.Socket.prototype.connect = guard(net.Socket.prototype.connect);
tls.connect = guard(tls.connect);
const timer = setInterval(() => {
  try {
    const m = process.memoryUsage();
    fs.appendFileSync(logfile, JSON.stringify({ t: Date.now(), pid: process.pid,
      rss: m.rss, heapUsed: m.heapUsed, external: m.external,
      arrayBuffers: m.arrayBuffers }) + "\n");
  } catch {}
}, 100);
timer.unref();
