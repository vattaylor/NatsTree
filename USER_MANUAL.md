# NatsTree user manual

NatsTree is a live inspector for [NATS](https://nats.io). It subscribes to every subject (`>`), turns each message into a searchable tree, and lets you inspect current values, history, graphs, and unlimited CSV logs.

This manual is for operators and testers using the app. Developer install and packaging notes live in [README.md](README.md).

---

## Contents

1. [What NatsTree does](#1-what-natstree-does)
2. [Choose how to run it](#2-choose-how-to-run-it)
3. [The window](#3-the-window)
4. [Connect](#4-connect)
5. [Demo mode](#5-demo-mode)
6. [Subjects tree](#6-subjects-tree)
7. [Value panel](#7-value-panel)
8. [Logger](#8-logger)
9. [Remembered settings](#9-remembered-settings)
10. [Typical workflows](#10-typical-workflows)
11. [Status lights and messages](#11-status-lights-and-messages)
12. [Troubleshooting](#12-troubleshooting)
13. [Limits and behaviour notes](#13-limits-and-behaviour-notes)
14. [Glossary](#14-glossary)

---

## 1. What NatsTree does

When you connect, NatsTree:

1. Subscribes to **all subjects** (`>`).
2. Splits each subject on `.` into a folder-like tree. Example: `vehicle.engine.rpm` becomes `vehicle` → `engine` → `rpm`.
3. Unfolds JSON objects and arrays into nested tree nodes. A payload `{ "fl": true, "fr": false }` under `vehicle.doors` becomes `vehicle.doors.fl` and `vehicle.doors.fr`.
4. Keeps a short history on every leaf (default last 10 samples).
5. Optionally records matching leaves into the Logger with no row limit.

Text, numbers, booleans, and JSON all appear in the tree. Numbers can also be graphed.

NatsTree is a **viewer**. It does not publish messages, edit NATS configuration, or change data on the server.

---

## 2. Choose how to run it

There are four ways to open the same UI. They differ only in **how** they reach NATS.

| How you run it | Where it lives | How it talks to NATS | Port to type in the UI |
| --- | --- | --- | --- |
| **Desktop app** (Linux, Windows, macOS) | Installer or zip from [GitHub Releases](https://github.com/vattaylor/NatsTree/releases) | Local bridge → NATS **TCP** | Usually `4222` |
| **Docker** | `http://localhost:8888` | Container bridge → NATS **TCP** | Usually `4222` (use `host.docker.internal` if NATS is on the host) |
| **GitHub Pages** | [vattaylor.github.io/NatsTree](https://vattaylor.github.io/NatsTree/) | Browser → NATS **WebSocket** | WebSocket port, often `9222` or `8443` |
| **From source** (`npm run dev`) | [http://localhost:5173](http://localhost:5173) | Local bridge → NATS **TCP** | Usually `4222` |

Standard NATS TCP (`4222`) cannot be used from a web page. The desktop app, Docker, and `npm run dev` start a small bridge for that. GitHub Pages has no bridge, so the NATS server must expose WebSocket.

Installers, Docker, and Pages setup are described in [README.md](README.md).

---

## 3. The window

The layout is the same everywhere:

```
┌─────────────────────────────────────────────────────────────┐
│  NatsTree     Server  Port  User  Password  [Connect]  status │
├──────────────────┬──────────────────┬───────────────────────┤
│  Subjects        │  Value           │  Logger               │
│  tree of topics  │  selected leaf   │  recorded rows        │
└──────────────────┴──────────────────┴───────────────────────┘
```

- **Connection bar** (top): host, port, credentials, Connect/Stop, status pill.
- **Subjects** (left): live tree of every subject and nested JSON field.
- **Value** (middle): details, history, and graph for the leaf you clicked.
- **Logger** (right): unlimited recording of ticked branches, flags, and CSV download.

On a wide screen the three columns sit side by side and **each column scrolls on its own**. On a narrow window they stack; each panel is still independently scrollable.

Links:

- **GitHub** opens the source repository.
- **Live demo** (desktop and local web only) opens the GitHub Pages site. It is hidden when you are already on Pages.

---

## 4. Connect

### 4.1 Fields

| Field | What to enter |
| --- | --- |
| **Server** | Hostname or IP of the NATS server, or `demo` (see [Demo mode](#5-demo-mode)). |
| **Port** | Desktop / Docker / local web: NATS TCP port, usually **4222**. GitHub Pages: NATS **WebSocket** port, often **9222** (plain) or **8443** (TLS). |
| **User** | Optional. Only if the server requires a username. |
| **Password** | Optional. Only if the server requires a password. Not stored between visits. |

Fields are locked while you are connected or connecting. Click **Stop** to change them.

### 4.2 Connect and Stop

1. Fill in Server and Port (and credentials if needed).
2. Click **Connect**. The status pill shows **Connecting…**, then **Live** with a green light if it succeeded.
3. Messages start filling the Subjects tree.
4. Click **Stop** to disconnect. The tree, the Value panel, and the log **stay on screen** so you can keep inspecting them.

**Connect** is disabled if the local bridge is offline (desktop/dev). On GitHub Pages the status reads **Idle · browser WebSocket** and Connect is available immediately.

### 4.3 Desktop, Docker, and local web (TCP)

Example:

- Server: `127.0.0.1`
- Port: `4222`

If NATS is on another machine, use that hostname. From Docker, if NATS is on the same computer as Docker, use:

- Server: `host.docker.internal`
- Port: `4222`

### 4.4 GitHub Pages (WebSocket)

The public site is [https://vattaylor.github.io/NatsTree/](https://vattaylor.github.io/NatsTree/).

The NATS server must enable websocket, for example:

```
websocket {
  port: 9222
  no_tls: true
}
```

Then in NatsTree:

- Server: the NATS hostname
- Port: `9222`

If the page is HTTPS (GitHub Pages is), the browser uses **wss://**. The server then needs TLS on the websocket (a common port is `8443`), or the connection is blocked.

A **local** `ws://127.0.0.1` server cannot be used from GitHub Pages: browsers block insecure WebSockets from an HTTPS page. For a NATS process on your laptop, use the desktop app or Docker instead.

If you leave Port at `4222` on Pages, NatsTree also tries **9222**, which is the usual websocket port.

### 4.5 Authentication

If the server has no users, leave User and Password empty.

If it uses a username and password, fill both before Connect. A wrong password shows as an error in the status pill.

---

## 5. Demo mode

You do not need a NATS server to learn the UI.

1. Set **Server** to `demo` (any port is ignored).
2. Click **Connect**.
3. Sample vehicle telemetry appears: engine RPM, temperature, speed, gear, doors, GPS, and cluster status.

Use this to practise searching, graphing, logging, flags, and export. Click **Stop** when finished.

---

## 6. Subjects tree

This is the live map of everything received since you connected (and it remains after Stop).

### 6.1 Reading a row

Each row is one path segment.

- Folders (branches) are darker text. They have a **▾ / ▸** control.
- Leaves (end values) show the name in teal and the **current value** in blue.
- A row **flashes** briefly when that leaf is updated.
- The header shows **messages received** and how many **leaves** exist.

Click a leaf to inspect it in the Value panel.

### 6.2 Expand and collapse

- Click **▾ / ▸** to open or close one branch.
- **Expand all** opens every branch.
- **Collapse all** folds the tree back to the top level.
- Searching (below) temporarily opens matching branches.

### 6.3 Search

Type in **Search path or value…**. The tree keeps a node if:

- its path contains the text, or
- its current value contains the text, or
- any descendant matches.

Search is case-insensitive. Clear the box to show the full tree again.

### 6.4 Tick boxes (logging)

Tick a node to send that branch to the Logger.

- Ticking a **parent** logs every descendant. Ticking `vehicle.engine` logs `vehicle.engine.rpm`, `vehicle.engine.temp`, and anything else under it.
- Ticking a **leaf** logs only that leaf.
- Untick the box, or click **×** on the Logger chip, to stop recording that branch. Existing log rows stay until you Clear.

### 6.5 Show selected

**Show selected** hides every node that is not ticked. Ancestors of ticked nodes stay visible so the path still makes sense.

If nothing is ticked, the panel explains that you need to tick nodes first. Click **Show selected** again to turn the filter off.

### 6.6 Export tree

**Export tree** downloads a JSON snapshot of the current tree, including names, paths, current values, hit counts, and last-updated times.

Filename: `natstree-structure-<timestamp>.json`.

This is a snapshot of **structure and current values**, not the full Logger history.

---

## 7. Value panel

Select a leaf in the tree. The middle column shows that leaf only.

### 7.1 Summary fields

| Field | Meaning |
| --- | --- |
| **Path** | Tree path, for example `vehicle.engine.rpm`. |
| **NATS subject** | Original NATS subject the payload arrived on. Nested JSON fields still show the parent subject. |
| **Current** | Latest value. |
| **Updated** | Wall-clock time of the last sample, plus a relative age (for example `3s ago`). |
| **Hits** | How many times this leaf has been updated since you connected. |
| **Avg interval** | Average time between stored samples. Needs at least two samples. |

### 7.2 Keep last (history size)

**Keep last** controls how many samples this **viewed** leaf retains:

`10` · `100` · `1,000` · `10,000` · `50,000` · `100,000`

- Default for every leaf is **10**.
- Raising the limit only keeps **future** samples. Samples already discarded cannot be recovered.
- When you click a different leaf, the previous one is trimmed back to 10.
- The line next to the control shows how many samples are stored. If you have more hits than stored samples, older values were dropped.

Large histories are virtualised so the table stays usable. Graphs downsample long series.

### 7.3 History table

**History** lists stored samples, newest first: when, age, and value.

### 7.4 Graph

**Graph** is available when the leaf is a number (or has numeric samples).

- The line is value over time.
- Click the graph (or **Click to fill page**) to expand it to the full window.
- Close the full-page graph with **Close** or **Escape**.

---

## 8. Logger

The Logger records a stream of matching updates. It is independent of the 10-sample Value history: logging has **no row limit**.

### 8.1 Start recording

1. Tick one or more nodes in the Subjects tree.
2. Matching updates appear as rows (newest first).
3. Chips under the header list the branches being logged. Click **×** on a chip to stop that branch.

You can log before any messages arrive; the table fills as they come in.

### 8.2 Filter

**Filter path, subject, or value…** hides rows that do not contain the text. It also matches flag numbers (`3` or `flag 3`).

Clear the box to show every recorded row again. Download CSV always exports **all** rows, not only the filtered view.

### 8.3 Flags

**Flag 1** (then Flag 2, Flag 3, …) inserts a highlighted marker into the log at the moment you press it.

- Use flags to mark events (“button pressed”, “fault injected”, “test started”).
- Every **later** log row carries that flag number until you press Flag again.
- The Flag column shows the number. Marker rows are highlighted.
- **Clear** deletes all rows **and** resets the next flag to 1.

You can press Flag even if no tree branch is ticked.

### 8.4 Download CSV

**Download CSV** saves every recorded row.

Filename: `natstree-log-<timestamp>.csv`

| Column | Content |
| --- | --- |
| `timestamp` | Unix time in milliseconds |
| `iso` | ISO-8601 timestamp |
| `flag` | Flag number, or empty if none yet |
| `path` | Tree path |
| `nats_subject` | NATS subject |
| `value` | Value as text |

### 8.5 Clear

**Clear** deletes log rows only. It does **not**:

- disconnect from NATS
- untick tree checkboxes
- erase the Subjects tree or Value history

New matching messages start filling the log again immediately.

---

## 9. Remembered settings

NatsTree stores **Server**, **Port**, and **User** in the browser (or Electron profile) and restores them next time.

- Values are saved as you type and again when you click Connect.
- **Password is never stored.** Enter it each session if the server needs it.

---

## 10. Typical workflows

### Watch a live system

1. Connect to the NATS server.
2. Wait for subjects to appear, or use Search to jump to a known path.
3. Click a numeric leaf and open **Graph**.
4. Raise **Keep last** if you need a longer plot for that leaf.

### Capture a test run

1. Tick the branches you care about (or a parent such as `vehicle`).
2. Click **Flag** at the start of the test (Flag 1).
3. Exercise the system. Click **Flag** again at each interesting moment.
4. **Download CSV** when finished.
5. **Clear** before the next run if you want a fresh file and flags starting at 1.

### Inspect JSON telemetry

JSON objects unfold automatically. A message on `cluster.status` with payload `{"ok":true,"nodes":3}` becomes `cluster.status.ok` and `cluster.status.nodes`. Click those leaves in Value; tick a parent to log the whole object.

### Share the tree shape

With data on screen, click **Export tree** and send the JSON file. It is the current structure and values, not the Logger CSV.

---

## 11. Status lights and messages

The pill at the right of the connection bar:

| Light | Typical text | Meaning |
| --- | --- | --- |
| Grey | **Idle** | Bridge is ready; not connected yet. |
| Grey | **Idle · browser WebSocket** | GitHub Pages (or other static host); ready to connect over WebSocket. |
| Grey | **Bridge offline** | Desktop/dev UI cannot reach the local bridge. Wait, or restart the app. |
| Amber | **Connecting…** | Trying to reach NATS. |
| Green | **Live · …** | Subscribed. The text after Live is the server address or `demo`. |
| Red | Error text | Connection failed. See [Troubleshooting](#12-troubleshooting). |

---

## 12. Troubleshooting

### Connect stays disabled / Bridge offline

The UI cannot reach the local bridge (port `3847` in development). Restart the desktop app, or run `npm run dev` so both the UI and the bridge start. GitHub Pages does not use this bridge.

### Connection error on desktop or Docker

- Confirm NATS is listening (default `0.0.0.0:4222`).
- Host and port must be reachable from the machine running NatsTree.
- From Docker, `127.0.0.1` is the **container**, not your laptop. Use `host.docker.internal`.
- Check User and Password if the server requires them.

### Connection error on GitHub Pages

- Port must be the **WebSocket** port, not TCP `4222` (unless the server also speaks WebSocket there). Try `9222` or `8443`.
- The server needs a `websocket { ... }` block in `nats-server` config.
- From HTTPS Pages, the websocket must be **TLS (`wss://`)**. Plain `ws://` to a LAN box is blocked.
- Local NATS on your PC: use the desktop app or Docker instead of Pages.

### Tree is empty after Connect

You are connected but nothing has been published yet, or your account cannot subscribe to `>`. Publish a test message, or try **demo**.

### A value I saw earlier is gone from History

Unviewed leaves keep only **10** samples. Raise **Keep last** while that leaf is selected, then wait for new samples. Logging (tick + Logger) is the way to keep an unlimited record.

### Logger is empty

Tick at least one node. A parent must be an ancestor of the leaves you care about. Filter box may be hiding rows — clear it.

### CSV has more rows than the on-screen table

The filter only changes what is displayed. CSV is always the full recording.

### Graph does not appear

The leaf is not numeric (string, boolean, or object). Graph is only for numbers.

### Full-page graph will not open

Click the chart itself or the **Click to fill page** label. Close with **Close** or **Escape**.

### macOS will not open the app

The zip is unsigned. Right-click **NatsTree** → **Open**, or allow it under **System Settings → Privacy & Security**.

### Windows SmartScreen warning

The installer is not code-signed. Choose **More info** → **Run anyway**.

---

## 13. Limits and behaviour notes

- Subscribe is always `>` (everything the connection is allowed to see). There is no per-subject subscribe UI.
- Disconnect does not wipe the tree or the log.
- JSON objects and arrays become extra tree nodes; the original NATS subject is still shown on those leaves.
- Empty JSON objects or arrays are stored as a single leaf value.
- Logger memory grows without a cap. Clear the log if the process gets large.
- Value history for the selected leaf can be up to 100,000 samples; everything else stays at 10.
- One NatsTree window, one NATS connection. Opening a second desktop window is not supported (the app uses a single-instance lock).
- NatsTree does not publish, request/reply, or use JetStream consumers. It is a firehose viewer on `>`.

---

## 14. Glossary

| Term | Meaning in NatsTree |
| --- | --- |
| **Subject** | NATS topic name, for example `vehicle.engine.rpm`. |
| **Path** | Tree address after splitting the subject (and JSON keys) on `.`. |
| **Leaf** | Node with a current value (not only children). |
| **Branch** | Node that has children. Ticking it logs all descendants. |
| **Bridge** | Small local service that turns NATS TCP into a WebSocket the UI can use. |
| **Demo** | Built-in fake vehicle stream; no NATS server required. |
| **Flag** | Numbered marker you insert in the Logger to mark a moment in the recording. |
| **Hit** | One update of a leaf. |
| **Keep last** | How many samples the Value panel stores for the leaf you are viewing. |

---

## Further reading

- Project source and issues: [github.com/vattaylor/NatsTree](https://github.com/vattaylor/NatsTree)
- Installers: [GitHub Releases](https://github.com/vattaylor/NatsTree/releases)
- Live web UI: [vattaylor.github.io/NatsTree](https://vattaylor.github.io/NatsTree/)
- Install, Docker, and build: [README.md](README.md)
- NATS itself: [nats.io](https://nats.io)
