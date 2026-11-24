// The resume command the buttons type: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lastSession } from "../mods/resume/session.js";

const id = "0562b924-f633-4a61-ad65-16b94eb6c791";
const command = (labels, fallback) => lastSession(labels, fallback)?.command ?? null;

test("both mods carry the same session.js", () => {
  const read = (mod) => readFileSync(new URL(`../mods/${mod}/session.js`, import.meta.url), "utf8");
  assert.equal(read("agents-resume"), read("resume"));
});

test("a Claude session goes back to its folder first", () => {
  assert.equal(command({ "session.resume": `claude:${id}`, "session.resume.cwd": "/work/portal" }), `cd '/work/portal' && claude --resume ${id}`);
});

test("Claude keeps its permission flags", () => {
  const labels = { "session.resume": `claude:${id}`, "session.resume.flags": "--dangerously-skip-permissions", "session.resume.cwd": "/work" };
  assert.equal(command(labels), `cd '/work' && claude --dangerously-skip-permissions --resume ${id}`);
});

test("a Codex session goes back to its folder first", () => {
  assert.equal(command({ "session.resume": `codex:${id}`, "session.resume.cwd": "/work" }), `cd '/work' && codex resume ${id}`);
});

test("a folder with spaces stays one argument", () => {
  assert.equal(command({ "session.resume": `claude:${id}`, "session.resume.cwd": "/home/me/my project" }), `cd '/home/me/my project' && claude --resume ${id}`);
});

test("without a folder label the fallback is used", () => {
  assert.equal(command({ "session.resume": `claude:${id}` }, "/work/seen"), `cd '/work/seen' && claude --resume ${id}`);
  assert.equal(command({ "session.resume": `claude:${id}`, "session.resume.cwd": "" }, "/work/seen"), `cd '/work/seen' && claude --resume ${id}`);
});

test("without any folder it resumes where the shell is", () => {
  assert.equal(command({ "session.resume": `claude:${id}` }), `claude --resume ${id}`);
});

test("a folder that could break out of the quotes is never used", () => {
  for (const cwd of ["/work/it's", "work", "/work\n rm -rf ~", "/work\u001b[A", "~/work"]) {
    assert.equal(command({ "session.resume": `claude:${id}`, "session.resume.cwd": cwd }), `claude --resume ${id}`, JSON.stringify(cwd));
  }
});

test("strange flags are dropped", () => {
  assert.equal(command({ "session.resume": `claude:${id}`, "session.resume.flags": "--permission-mode x;y" }), `claude --resume ${id}`);
});

test("a strange session is no session", () => {
  assert.equal(lastSession({ "session.resume": "claude:x; rm -rf ~" }), null);
  assert.equal(lastSession({ "session.resume": `vim:${id}` }), null);
  assert.equal(lastSession({}), null);
  assert.equal(lastSession(undefined), null);
});
