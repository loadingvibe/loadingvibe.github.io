import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { attachBlogPreview } from "../src/integrations/blog-preview.mjs";

const root = new URL("file:///tmp/blog-preview-fixture/");

function createServer() {
  const events = [];
  const watcher = new EventEmitter();
  watcher.add = () => {};
  const httpServer = new EventEmitter();
  const environments = {
    client: { hot: { send: (...args) => events.push(["client", ...args]) } },
  };
  for (const name of ["ssr", "prerender"]) {
    const content = { id: "\0astro:data-layer-content" };
    const page = { id: "/tmp/blog-preview-fixture/src/pages/blog/[...slug].astro" };
    environments[name] = {
      moduleGraph: {
        idToModuleMap: new Map([[content.id, content], [page.id, page]]),
        invalidateModule(module, invalidated) {
          invalidated.add(module);
          invalidated.add(page);
          events.push([name, "graph", module.id]);
        },
      },
      runner: {
        evaluatedModules: {
          getModuleById: (id) => ({ id }),
          invalidateModule: ({ id }) => events.push([name, "runner", id]),
        },
      },
      hot: { send: (...args) => events.push([name, ...args]) },
    };
  }
  return { server: { watcher, httpServer, environments }, events };
}

test("store persistence clears all server caches before the native browser reload", () => {
  const { server, events } = createServer();
  server.watcher.on("change", (file) => {
    if (file.endsWith("data-store.json")) events.push(["native", "full-reload"]);
  });
  const dispose = attachBlogPreview(server, { root });
  server.watcher.emit("blog:updated", { filePath: "/tmp/blog-preview-fixture/Blog/中文笔记.md" });
  assert.deepEqual(events, [], "loader completion must not reload stale persisted data");

  server.watcher.emit("change", "/tmp/blog-preview-fixture/.astro/data-store.json");
  for (const environment of ["ssr", "prerender"]) {
    assert.ok(events.some(([name, kind, id]) => name === environment && kind === "runner"
      && id.endsWith("[...slug].astro")), `${environment} must invalidate cached route props`);
    assert.ok(events.some(([name, kind]) => name === environment && kind === "astro:content-changed"));
  }
  assert.deepEqual(events.at(-1), ["native", "full-reload"]);
  dispose();
});

test("adding, replacing, or deleting a Chinese-named attachment reloads once", async () => {
  const { server, events } = createServer();
  const dispose = attachBlogPreview(server, { root, debounceMs: 5 });
  server.watcher.emit("change", "/tmp/blog-preview-fixture/Blog/中文笔记.md");
  server.watcher.emit("change", "/tmp/blog-preview-fixture/Blog/English note.MARKDOWN");
  server.watcher.emit("change", "/tmp/blog-preview-fixture/Blog/文档.txt");
  server.watcher.emit("change", "/tmp/blog-preview-fixture/Blog-other/图像.png");
  await delay(15);
  assert.deepEqual(events, []);

  server.watcher.emit("add", "/tmp/blog-preview-fixture/Blog/中文笔记.assets/图像.png");
  server.watcher.emit("change", "/tmp/blog-preview-fixture/Blog/中文笔记.assets/图像.png");
  server.watcher.emit("unlink", "/tmp/blog-preview-fixture/Blog/中文笔记.assets/图像.png");
  server.watcher.emit("change", "/tmp/blog-preview-fixture/Blog/中文笔记.assets/附件说明.md");
  await delay(15);
  assert.deepEqual(events, [["client", { type: "full-reload", path: "*" }]]);
  dispose();
});

test("server shutdown cancels pending attachment refreshes and detaches listeners", async () => {
  const { server, events } = createServer();
  attachBlogPreview(server, { root, debounceMs: 5 });
  server.watcher.emit("change", "/tmp/blog-preview-fixture/Blog/图像.png");
  server.httpServer.emit("close");
  await delay(15);
  assert.deepEqual(events, []);
  for (const event of ["add", "change", "unlink", "addDir", "unlinkDir", "blog:updated"]) {
    assert.equal(server.watcher.listenerCount(event), 0);
  }
});

test("empty top-level category creation and removal refresh cached desktop and mobile navigation", async () => {
  const { server, events } = createServer();
  const dispose = attachBlogPreview(server, { root, debounceMs: 5 });
  for (const folder of [".private", "_drafts", "note.assets", "朋友圈/子目录", "../Outside", ""]) {
    server.watcher.emit("addDir", `/tmp/blog-preview-fixture/Blog/${folder}`);
  }
  await delay(15);
  assert.deepEqual(events, []);
  server.watcher.emit("addDir", "/tmp/blog-preview-fixture/Blog/新门类");
  server.watcher.emit("unlinkDir", "/tmp/blog-preview-fixture/Blog/旧门类");
  await delay(15);
  for (const environment of ["ssr", "prerender"]) {
    assert.ok(events.some(([name, kind]) => name === environment && kind === "runner"));
  }
  assert.equal(events.filter(([name, message]) => name === "client" && message.type === "full-reload").length, 1);
  dispose();
});
