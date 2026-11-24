// A terminal's last Claude Code or Codex session, read from the labels the
// SessionStart hook writes, as the command that resumes it in its own folder.
//
// Plain JavaScript without Herdr, so test/session_test.mjs runs it in Node.
// mods/resume and mods/agents-resume each carry a copy, because a mod can't
// import a file from another mod; the test checks that they match.

// The permission flags Claude started with, the only ones a resume takes over.
const FLAG = "--dangerously-skip-permissions|--permission-mode[= ][A-Za-z]+";
const SAFE_FLAGS = new RegExp(`^(?:${FLAG})(?: (?:${FLAG}))*$`);

// The folder goes between single quotes: absolute, without a quote, and without
// a control character, which could press enter halfway.
const SAFE_FOLDER = /^\/[^'\u0000-\u001f\u007f]*$/;

const COMMANDS = {
  claude: (id, flags) => ["claude", flags, "--resume", id].filter(Boolean).join(" "),
  codex: (id) => `codex resume ${id}`,
};

// labels: the terminal's labels. fallback: a folder to go to when the labels
// don't name a usable one, such as where the agent ran when the panel last saw it.
// The labels end up on a command line, so only an exact match counts.
export function lastSession(labels, fallback = null) {
  const match = /^(claude|codex):([A-Za-z0-9_-]+)$/.exec(labels?.["session.resume"] ?? "");
  if (!match) return null;
  const [, provider, id] = match;
  const flags = labels["session.resume.flags"] ?? "";
  const resume = COMMANDS[provider](id, SAFE_FLAGS.test(flags) ? flags : "");
  const folder = [labels["session.resume.cwd"], fallback].find((f) => typeof f === "string" && SAFE_FOLDER.test(f)) ?? null;
  return { provider, id, folder, command: folder ? `cd '${folder}' && ${resume}` : resume };
}
