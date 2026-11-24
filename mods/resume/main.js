// Herdr Resume: a pane header with a Resume button for the terminal's last
// Claude Code or Codex session.
//
// The SessionStart hook (hooks/herdr-resume-label) stores that session as the
// terminal label session.resume=<provider>:<session id>, and Claude's permission
// flags as session.resume.flags, and its folder as session.resume.cwd. While a
// shell runs in that terminal, the button right after the folder types the
// resume command into it, after a cd to that folder.
//
// Put it on the panes of a layout:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "resume" } } } }
// Props: "focusToHover": true gives the keyboard to the pane under the pointer,
// "delay" is the ms the pointer rests first (default 0).
//
// The header is Herdr's own pane mod (Apache License 2.0): the program's icon,
// the agent's name or the terminal's title, the folder, and the agent's status;
// buttons split, zoom and close this pane. Props from the app: { pane, terminal }.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { hc, home, layout, notify, panes, props, run, terminals, theme } from "herdr";
import { follow, DELAY } from "./follow.js";
import { lastSession as sessionOf } from "./session.js";

// One-color glyphs, because an image() can stay blank when the button first appears.
const ICONS = {
  claude: () => svg("mods/resume/claude.svg").size(14).flex_none().text_color("#D97757"),
  codex: (t) => svg("mods/resume/codex.svg").size(14).flex_none().text_color(t.solid_foreground),
};

// A second click soon after the first would land in the agent as a prompt.
const CLICK_GUARD_MS = 3000;

// The command goes back to the session's folder first: Claude only finds a
// session from the folder it ran in.
function lastSession(address) {
  const session = sessionOf(terminals().find((x) => x.address === address)?.labels);
  return session && { icon: ICONS[session.provider], command: session.command };
}

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Resume extends View {
  init() {
    this.hovered = false;
    this.sentAt = 0;
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/resume/${icon}.svg`).size(14));
  }

  resume(p, session, cx) {
    const now = Date.now();
    if (now - this.sentAt < CLICK_GUARD_MS) return;
    this.sentAt = now;
    run("pane.focus", { pane: p.pane });
    cx.spawn(async () => {
      try {
        const result = await hc(["send", p.terminal, session.command]);
        if (result.code !== 0) throw new Error(result.stderr.trim() || `hc send: exit ${result.code}`);
      } catch (error) {
        this.sentAt = 0;
        notify({ title: "Could not resume", body: String(error?.message ?? error), level: "error" });
      }
    });
  }

  resumeButton(t, p, session) {
    return h_flex()
      .id(`ph-resume-${p.pane}`)
      .flex_none()
      .h(22)
      .px(8)
      .gap(5)
      .items_center()
      .rounded(6)
      .bg(t.solid)
      .text_size(12)
      .font_semibold()
      .text_color(t.solid_foreground)
      .hover((s) => s.bg(t.accent).text_color(t.accent_foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        this.resume(p, session, cx);
      })
      .child(session.icon(t))
      .child("Resume");
  }

  render(cx) {
    const pr = props() ?? {};
    const header = this.header(cx);
    return pr.focusToHover ? follow(this, pr.pane, header, pr.delay ?? DELAY) : header;
  }

  header(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    const session = p.terminal && p.program?.shell ? lastSession(p.terminal) : null;
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_shrink(1).min_w(0).truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(Boolean(session), el => el.child(this.resumeButton(t, p, session)))
      .child(div().flex_1())
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
