# Herdr Resume

A pane header with a Resume button: after you quit Claude Code or Codex in a terminal, one click right next to the folder brings that terminal's last session back, with Claude's permission flags.

![Herdr Resume](preview.png)

## What you see

- **The pane header**, 30px, as in Herdr's own `pane` mod: the program's 14px icon, its name in `foreground`, the folder in `dim` with the home as `~`, then the agent's status on the right, and split, zoom and close buttons while hovered.
- **The Resume button**, directly after the folder: 22px high, 8px side padding, 6px corners, a 5px gap, on `solid` with `solid_foreground` text, 12px semibold. It holds a 14px provider glyph and the word "Resume". Claude's glyph is `#D97757`, Codex's is `solid_foreground`.
- A long folder truncates; the button keeps its size.

## How it behaves

- The button shows only while the terminal's program is a shell and its `session.resume` label is valid. With an agent running, or without a label, the header looks like Herdr's own.
- A click focuses the pane and types `cd '<folder>' && claude [flags] --resume <id>` or `cd '<folder>' && codex resume <id>` into the shell, with the folder from `session.resume.cwd`. Without a usable folder the `cd` is left out. A second click within 3 seconds does nothing, because it would land in the agent as a prompt.
- If sending fails, an error toast "Could not resume" shows the reason and the button works again at once.
- Hover turns the button `accent` with `accent_foreground`.
- Agent status is Herdr's: a spinner for working, "Needs you" for blocked, a dot for done, nothing for idle.
- With the prop `focusToHover: true`, the pane under the pointer gets the keyboard, after `delay` ms (default 0).

## The Agents panel

- `agents-resume` looks and works like Herdr's Agents panel, plus an **Exited** group under the others, in both sort orders, with a count like the other groups and folding the same way.
- An agent lands there when it leaves `agents()`, with its labels as they were while it ran (`terminals()` leaves finished terminals out). Only agents seen in this run count, because right after a start the list is empty. The list is kept in the mod's `localStorage` under `exited`, so it survives a restart, and each entry goes after `keepMinutes` (default 60).
- It shows, newest first, in one of two ways. Its terminal is live and runs a shell: Resume goes into that terminal ("here"). Its terminal is finished or gone, and it was on this computer: Resume opens a new tab ("tab"). A live terminal running something else hides it.
- It's hidden while a live agent terminal carries the same session, and a session that quit twice shows once. For "tab" rows the panel asks `hc get` at most every 30 seconds whether the terminal still exists; a removed one is dropped. Entries stored before labels were kept get them from that call.
- A row: the agent's icon as it was while running, the space in `muted` and `· tab` in `dim`, the time since it quit, and a Resume pill (20px high, 7px side padding, 5px corners, `solid` with `solid_foreground`, 11px semibold; hover `accent`). Hovering the row swaps the time for an ×, which takes it off the list.
- A click on the pill, "here": focus the terminal and send the same command as the header. "tab": drop the entry and run `tab.new` with the old space (if it still exists), the old tab's name (unless it was a number), the folder and the session's `argv`. The folder comes from `session.resume.cwd`, else from where the panel saw the agent run (`foreground.cwd` of its terminal). A click on the row focuses the terminal, or selects the space for "tab".
- The rail (narrow sidebar) leaves the group out.

## Built from

- **Mod** `mods/resume/`: a copy of Herdr's `pane` (0.1.16) with `lastSession`, `resume` and `resumeButton` added. The command itself comes from `session.js`, plain JavaScript that `test/session_test.mjs` runs in Node. `follow.js` comes from `github.com/jankeesvw/herdr-focus-to-hover`. Its own glyphs are `claude.svg` and `codex.svg`, made from Herdr's icons.
- **Mod** `mods/agents-resume/`: a copy of Herdr's `agents` (0.1.18) with `notice`, `exitedRows`, `resume` and `exitedRow` added, and its own copy of `session.js`, because a mod can't import another mod's files. The test checks that both copies match.
- **herdr**: `panes`, `terminals` (for `labels`), `props`, `layout`, `theme`, `home`, `run` (`pane.focus`, `pane.split`, `pane.zoom`, `pane.close`), `hc` (`send`), `notify`.
- **Hook** `hooks/herdr-resume-label <claude|codex>`: a POSIX `sh` script for SessionStart in Claude Code and Codex. It reads `session_id` from stdin and `HC_TERMINAL_ID` from the environment, finds the nearest agent process above it, and runs `hc label <terminal> session.resume=<provider>:<id> session.resume.flags=<flags> session.resume.cwd=<folder>`. The folder is the payload's `cwd`, else the hook's own; one that isn't absolute or holds a quote or a control character is written empty.
- **Layout**: any layout whose tab block has `pane.header.content.mod` set to `resume`.

## Watch out

- `herdr-app check` doesn't lay out or draw. Check the button with `herdr-app shot`.
- `flex_shrink()` needs a number. The folder uses `.flex_shrink(1).min_w(0).truncate()`, with a `flex_1` spacer after the button, so the button stays right after the folder.
- `image()` can stay blank when the button first appears, so the glyphs are one-color `svg()` with a text color.
- Codex fires SessionStart for `codex exec` and `codex review` too. Without a filter, those replace the session to resume. Find the subcommand by skipping options and their values.
- Codex skips a hook until it's trusted with `/hooks`.
- `hc send` from inside an agent's terminal wraps text sent to another agent in `<hc>` tags. From the app it doesn't. Testing from an agent, send with `env -u HC_TERMINAL_ID hc send ...`, and quit a test Claude with `hc keys <t> ctrl+c` twice, because a wrapped `/exit` is just a message.
- Herdr rewrites its own mods on every start, so `agents-resume` is a copy under another name, not an edit of `agents`.
- `pane.close` from `herdr-app do` ends the terminal a little later than the key does, and the panel can take up to its 30-second tick to notice. A Herdr mod folder that replaced a symlink while Herdr ran isn't watched; replace the folder again to reload it.
- `agents()` is empty right after a start. Remembering the agents seen in this run only in memory keeps a restart from moving every agent to Exited.
- Herdr refuses a module that is a symlink to a file outside the mod folder. A symlink to the whole mod folder works, but then Herdr doesn't reload it when a file changes.
- A second Herdr window with its own `HERDR_APP_HOME` still shares the core's layout. Test with your own `HC_SESSION` and scratch XDG paths too.

## Done when

- `herdr-app check mods/resume` and `herdr-app check mods/agents-resume` pass, and `sh test/hook_test.sh` and `node --test test/` report no failures.
- In a Herdr terminal, start `claude --dangerously-skip-permissions`, send one message and `/exit`: the button shows right after the folder with Claude's glyph.
- A click resumes that session, with the flag on the new process, and the button is gone while it runs.
- The same works for Codex after trusting the hook in `/hooks`.
- `codex exec` and `claude -p` in that terminal leave the label unchanged.
- With `agents-resume` in the layout, quit an agent and `cd /tmp`: it shows under Exited with a Resume pill, and a click starts it again in its own folder with the same session. The row is gone while it runs.
- Close an agent's pane with `ctrl-space x`: it shows under Exited, and Resume opens a tab with the old name in the same space, running the session in its folder. `hc rm` on the closed terminal drops the row within 30 seconds.
