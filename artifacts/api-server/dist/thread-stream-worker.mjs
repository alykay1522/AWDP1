import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// ../../node_modules/thread-stream/node_modules/real-require/src/index.js
var require_src = __commonJS({
  "../../node_modules/thread-stream/node_modules/real-require/src/index.js"(exports, module) {
    var realImport2 = new Function("modulePath", "return import(modulePath)");
    function realRequire2(modulePath) {
      if (typeof __non_webpack__require__ === "function") {
        return __non_webpack__require__(modulePath);
      }
      return __require(modulePath);
    }
    module.exports = { realImport: realImport2, realRequire: realRequire2 };
  }
});

// ../../node_modules/thread-stream/lib/indexes.js
var require_indexes = __commonJS({
  "../../node_modules/thread-stream/lib/indexes.js"(exports, module) {
    "use strict";
    var SEQ_INDEX2 = 2;
    var WRITE_INDEX2 = 4;
    var READ_INDEX2 = 8;
    module.exports = {
      WRITE_INDEX: WRITE_INDEX2,
      READ_INDEX: READ_INDEX2,
      SEQ_INDEX: SEQ_INDEX2
    };
  }
});

// ../../node_modules/thread-stream/lib/wait.js
var require_wait = __commonJS({
  "../../node_modules/thread-stream/lib/wait.js"(exports, module) {
    "use strict";
    var WAIT_MS = 1e4;
    function wait(state2, index, expected, timeout, done) {
      const max = timeout === Infinity ? Infinity : Date.now() + timeout;
      const check = () => {
        const current = Atomics.load(state2, index);
        if (current === expected) {
          done(null, "ok");
          return;
        }
        if (max !== Infinity && Date.now() > max) {
          done(null, "timed-out");
          return;
        }
        const remaining = max === Infinity ? WAIT_MS : Math.min(WAIT_MS, Math.max(1, max - Date.now()));
        const result = Atomics.waitAsync(state2, index, current, remaining);
        if (result.async) {
          result.value.then(check);
        } else {
          setImmediate(check);
        }
      };
      check();
    }
    function waitDiff2(state2, index, expected, timeout, done) {
      const max = timeout === Infinity ? Infinity : Date.now() + timeout;
      const check = () => {
        const current = Atomics.load(state2, index);
        if (current !== expected) {
          done(null, "ok");
          return;
        }
        if (max !== Infinity && Date.now() > max) {
          done(null, "timed-out");
          return;
        }
        const remaining = max === Infinity ? WAIT_MS : Math.min(WAIT_MS, Math.max(1, max - Date.now()));
        const result = Atomics.waitAsync(state2, index, expected, remaining);
        if (result.async) {
          result.value.then((res) => {
            if (res === "ok") {
              done(null, "ok");
              return;
            }
            check();
          });
        } else {
          setImmediate(check);
        }
      };
      check();
    }
    module.exports = { wait, waitDiff: waitDiff2 };
  }
});

// ../../node_modules/thread-stream/lib/worker.js
var { realImport, realRequire } = require_src();
var { workerData, parentPort } = __require("worker_threads");
var { StringDecoder } = __require("string_decoder");
var { WRITE_INDEX, READ_INDEX, SEQ_INDEX } = require_indexes();
var { waitDiff } = require_wait();
var {
  dataBuf,
  filename,
  stateBuf
} = workerData;
var destination;
var flushQueue = [];
var flushing = false;
var state = new Int32Array(stateBuf);
var data = Buffer.from(dataBuf);
var decoder = new StringDecoder("utf8");
var keepAlive = setInterval(() => {
}, 60 * 60 * 1e3);
function onParentPortMessage(msg) {
  if (!msg || msg.code !== "FLUSH" || msg.context !== "thread-stream") {
    return;
  }
  flushQueue.push(msg.id);
  processFlushQueue();
}
function processFlushQueue() {
  if (flushing || !destination) {
    return;
  }
  const id = flushQueue.shift();
  if (id === void 0) {
    return;
  }
  flushing = true;
  flushDestination((err) => {
    flushing = false;
    if (err) {
      parentPort.postMessage({
        code: "ERROR",
        err
      });
      return;
    }
    parentPort.postMessage({
      code: "FLUSHED",
      context: "thread-stream",
      id
    });
    processFlushQueue();
  });
}
function flushDestination(cb) {
  if (typeof destination?.flush === "function") {
    if (destination.flush.length === 0) {
      try {
        const result = destination.flush();
        if (result && typeof result.then === "function") {
          result.then(() => cb(), cb);
        } else {
          cb();
        }
      } catch (err) {
        cb(err);
      }
      return;
    }
    let done = false;
    const onDone = (err) => {
      if (done) {
        return;
      }
      done = true;
      cb(err);
    };
    try {
      const result = destination.flush(onDone);
      if (result && typeof result.then === "function") {
        result.then(() => onDone(), onDone);
      }
    } catch (err) {
      onDone(err);
    }
    return;
  }
  if (typeof destination?.flushSync === "function") {
    try {
      destination.flushSync();
      cb();
    } catch (err) {
      cb(err);
    }
    return;
  }
  if (destination?.writableNeedDrain && !destination?.writableEnded) {
    destination.once("drain", cb);
    return;
  }
  cb();
}
async function start() {
  let worker;
  try {
    worker = await realImport(filename);
  } catch (error) {
    if ((error.code === "ENOTDIR" || error.code === "ERR_MODULE_NOT_FOUND") && filename.startsWith("file://")) {
      worker = realRequire(decodeURIComponent(filename.replace("file://", "")));
    } else if (error.code === void 0 || error.code === "ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING") {
      try {
        worker = realRequire(decodeURIComponent(filename.replace(process.platform === "win32" ? "file:///" : "file://", "")));
      } catch {
        throw error;
      }
    } else if (filename.endsWith(".ts") || filename.endsWith(".cts")) {
      try {
        if (!process[Symbol.for("ts-node.register.instance")]) {
          realRequire("ts-node/register");
        } else if (process.env.TS_NODE_DEV) {
          realRequire("ts-node-dev");
        }
        worker = realRequire(decodeURIComponent(filename.replace(process.platform === "win32" ? "file:///" : "file://", "")));
      } catch {
        throw error;
      }
    } else {
      throw error;
    }
  }
  if (typeof worker === "object") worker = worker.default;
  if (typeof worker === "object") worker = worker.default;
  destination = await worker(workerData.workerData);
  destination.on("error", function(err) {
    Atomics.store(state, WRITE_INDEX, -2);
    Atomics.notify(state, WRITE_INDEX);
    Atomics.store(state, READ_INDEX, -2);
    Atomics.notify(state, READ_INDEX);
    parentPort.postMessage({
      code: "ERROR",
      err
    });
  });
  destination.on("close", function() {
    const end = Atomics.load(state, WRITE_INDEX);
    Atomics.store(state, READ_INDEX, end);
    Atomics.notify(state, READ_INDEX);
    clearInterval(keepAlive);
    setImmediate(() => {
      process.exit(0);
    });
  });
  processFlushQueue();
}
start().then(function() {
  parentPort.on("message", onParentPortMessage);
  parentPort.postMessage({
    code: "READY"
  });
  process.nextTick(run);
});
function readState() {
  while (true) {
    const seq = Atomics.load(state, SEQ_INDEX);
    if ((seq & 1) !== 0) {
      continue;
    }
    const current = Atomics.load(state, READ_INDEX);
    const end = Atomics.load(state, WRITE_INDEX);
    if (seq === Atomics.load(state, SEQ_INDEX)) {
      return { current, end, seq };
    }
  }
}
function run() {
  const { current, end, seq } = readState();
  if (end === current) {
    waitDiff(state, SEQ_INDEX, seq, Infinity, run);
    return;
  }
  if (end === -1) {
    const remaining = decoder.end();
    if (remaining.length > 0) {
      destination.write(remaining);
    }
    destination.end();
    return;
  }
  const toWrite = decoder.write(data.subarray(current, end));
  const res = destination.write(toWrite);
  if (res) {
    Atomics.store(state, READ_INDEX, end);
    Atomics.notify(state, READ_INDEX);
    setImmediate(run);
  } else {
    destination.once("drain", function() {
      Atomics.store(state, READ_INDEX, end);
      Atomics.notify(state, READ_INDEX);
      run();
    });
  }
}
process.on("unhandledRejection", function(err) {
  parentPort.postMessage({
    code: "ERROR",
    err
  });
  process.exit(1);
});
process.on("uncaughtException", function(err) {
  parentPort.postMessage({
    code: "ERROR",
    err
  });
  process.exit(1);
});
process.once("exit", (exitCode) => {
  if (exitCode !== 0) {
    process.exit(exitCode);
    return;
  }
  if (destination?.writableNeedDrain && !destination?.writableEnded) {
    parentPort.postMessage({
      code: "WARNING",
      err: new Error("ThreadStream: process exited before destination stream was drained. this may indicate that the destination stream try to write to a another missing stream")
    });
  }
  process.exit(0);
});
//# sourceMappingURL=thread-stream-worker.mjs.map
