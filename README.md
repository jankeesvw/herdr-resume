# Herdr Resume

![Herdr Resume: a Resume button in the pane header, next to the folder](preview.png)

A **Resume** button in the pane header of the [Herdr](https://herdr.dev) desktop app. Quit Claude Code or Codex, and one click brings that terminal's last session back.

- **The right session.** Each terminal remembers its own last session, so you never pick from a list.
- **Only when it helps.** The button shows while a shell runs in a terminal that has a session to go back to. While the agent runs, it's gone.
- **Your permissions stay.** A Claude Code session started with `--dangerously-skip-permissions` or `--permission-mode` comes back with the same flag.
- **Background runs don't count.** `claude -p`, `codex exec` and `codex review` never replace the session you were working in.

## Install

You need Herdr with `hc`, and Claude Code, Codex or both.

```sh
git clone https://github.com/jankeesvw/herdr-resume.git
cd herdr-resume
cp -R mods/resume ~/.config/herdr-app/mods/
mkdir -p ~/.local/bin
install -m 755 hooks/herdr-resume-label ~/.local/bin/
```

### 1. Put the header on a layout

Herdr's own layouts are read-only, so clone `main` and point its pane header at this mod:

```sh
herdr-app do layout.clone '{"name":"main","as":"main-resume"}'
perl -pi -e 's/"mod": "pane"/"mod": "resume"/' ~/.config/herdr-app/layouts/main-resume.json
```

`ctrl-shift-l` switches back to any other layout. In a layout of your own, set the pane header of the tab block:

```json
{ "id": "main", "type": "block", "content": { "tab": "active",
  "pane": { "header": { "content": { "mod": "resume" }, "height": 30, "position": "top", "reveal": "always" } } } }
```

### 2. Add the hooks

For Claude Code, add this to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "$HOME/.local/bin/herdr-resume-label claude", "timeout": 5 }] }
    ]
  }
}
```

For Codex, add this to `~/.codex/hooks.json`, then run `/hooks` in Codex and trust it. Codex skips a hook until you do.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact|fork",
        "hooks": [{ "type": "command", "command": "$HOME/.local/bin/herdr-resume-label codex", "timeout": 5 }]
      }
    ]
  }
}
```

Agents that were already running get the button after their next session start.

## Options

Set these as `props` on the header's content, for example `"content": { "mod": "resume", "props": { "focusToHover": true } }`.

- `focusToHover`: the pane under the pointer gets the keyboard, as in [Herdr Focus to Hover](https://github.com/jankeesvw/herdr-focus-to-hover). Off by default.
- `delay`: with `focusToHover`, the milliseconds the pointer rests before the pane gets the keyboard. Default 0.

## How it works

When a session starts, the hook stores it on the terminal with `hc label`: `session.resume=claude:<id>` or `session.resume=codex:<id>`, plus Claude's permission flags in `session.resume.flags`. The header reads those labels. A click types `claude --resume <id>` or `codex resume <id>` into the shell with `hc send`. Labels are checked against a strict pattern first, because they end up on a command line.

## Known limits

- Only Claude's permission flags come back. Other flags like `--model` don't, and Codex resumes without its own flags.
- Claude Code finds a session by folder, so resuming fails if you moved the shell to another folder after quitting.
- Tested on Linux. On macOS the hook falls back to `ps`, which splits quoted prompts on spaces, so a Codex session started with a prompt whose first word is `exec`, `e` or `review` gets no button.

## Tests

```sh
sh test/hook_test.sh
```

## License

MIT (`LICENSE`). The header is a copy of the pane mod that ships with [Herdr](https://herdr.dev); that code keeps Herdr's Apache License 2.0 (`LICENSE-APACHE`).
