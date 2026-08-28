# NatsTree

NatsTree is a desktop and web app for watching a [NATS](https://nats.io) server. It subscribes to every subject (`>`), turns messages into a searchable tree, and lets you inspect live values, history, graphs, and unlimited CSV logs.

Browsers cannot speak NATS TCP, so NatsTree runs a small local bridge that opens the NATS connection for the UI.

---

## What you need

- A NATS server you can reach (default `127.0.0.1:4222`), **or** use the built-in `demo` mode (no server required).
- Optional NATS username and password if your server requires them.

Pre-built installers are provided for **Linux** and **Windows**. On **macOS**, install from source (or build a `.dmg` on a Mac).

---

## Install on Linux

Built files are in `release/`:

- `NatsTree-1.0.0-linux-x86_64.AppImage` — runs without installing
- `NatsTree-1.0.0-linux-amd64.deb` — installs into the system

### AppImage (any distribution)

1. Copy `NatsTree-1.0.0-linux-x86_64.AppImage` onto the machine.
2. Make it executable and run it:

```bash
chmod +x NatsTree-1.0.0-linux-x86_64.AppImage
./NatsTree-1.0.0-linux-x86_64.AppImage
```

If the desktop asks to integrate the AppImage, you can accept that so it appears in the application menu.

### Debian / Ubuntu package

```bash
sudo dpkg -i NatsTree-1.0.0-linux-amd64.deb
```

If `dpkg` reports missing dependencies:

```bash
sudo apt-get install -f
```

Start NatsTree from the application menu, or run:

```bash
nats-tree
```

To remove it later:

```bash
sudo dpkg -r nats-tree
```

---

## Install on Windows

Built files are in `release/`:

- `NatsTree-1.0.0-win-x64-setup.exe` — installer (recommended)
- `NatsTree-1.0.0-win-x64.zip` — portable copy, no install

### Setup program

1. Copy `NatsTree-1.0.0-win-x64-setup.exe` onto the Windows PC.
2. Double-click it. Windows SmartScreen may warn because the file is not code-signed; choose **More info** → **Run anyway**.
3. Confirm the install prompt. Files go to `%LOCALAPPDATA%\Programs\NatsTree` (no administrator account needed).
4. Desktop and Start Menu shortcuts named **NatsTree** are created, then the app starts.

To uninstall, delete `%LOCALAPPDATA%\Programs\NatsTree` and the Desktop / Start Menu **NatsTree** shortcuts.

### Portable zip

1. Unzip `NatsTree-1.0.0-win-x64.zip`.
2. Open the folder and double-click `NatsTree.exe`.

---

## Install on macOS

There is no pre-built Mac installer in `release/` when the project is packaged on Linux. On a Mac, run NatsTree from source or build a `.dmg` locally.

### From source (recommended)

1. Install [Node.js 22](https://nodejs.org/) (LTS).
2. Open Terminal in the project folder.
3. Install dependencies and start the desktop app:

```bash
npm install
npm run electron:dev
```

An Electron window opens. Use it the same way as on Linux or Windows.

You can also use the browser UI instead of Electron:

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

### Build a Mac installer (on a Mac)

```bash
npm install
npm run dist:mac
```

That writes a `.dmg` and a `.zip` under `release/`. Open the `.dmg` and drag **NatsTree** into **Applications**.

---

## How to use

The window has a connection bar at the top and three columns: **Subjects**, **Value**, and **Logger**.

### Connect to a NATS server

1. Enter the **Server** host (for example `127.0.0.1` or a hostname).
2. Enter the **Port** (NATS TCP is usually `4222`).
3. Optionally enter **User** and **Password** if the server requires them.
4. Click **Connect**. The status pill turns green and shows **Live**.
5. Click **Stop** to disconnect. The tree stays on screen so you can keep inspecting it.

NatsTree subscribes to all subjects (`>`). Each message is split on `.` (and JSON objects are unfolded) into the tree on the left.

### Try it without a server

Set **Server** to `demo` and click **Connect**. NatsTree feeds sample vehicle telemetry so you can learn the UI.

### Subjects tree

- New subjects appear as they arrive. Use **Expand all** / **Collapse all** to open or fold the tree.
- Type in **Search path or value…** to filter nodes.
- Tick a checkbox next to any node to log that branch (see Logger below).
- Click a **leaf** (an end value, shown in blue) to inspect it in the middle column.

The header shows how many messages have been received and how many leaf values exist.

### Value (last 10 samples and graph)

After you click a leaf:

- **Path** is the tree path (for example `vehicle.engine.rpm`).
- **Current** is the latest value.
- **Updated** is the last change time.
- **Hits** is how many times that leaf has been updated.
- The table lists the **last 10 values** with timestamps.

If the value is a number, use **Graph** to plot those samples.

### Logger and CSV

1. Tick one or more nodes in the tree (a parent logs every descendant).
2. Matching updates are recorded with **no limit**. The counter shows how many rows have been stored.
3. The table lists time, path, NATS subject, and value (newest first).
4. Click **Download CSV** to save everything recorded so far.
5. **Clear** deletes the log rows (it does not stop logging). Remove a branch by unticking it or clicking **×** on its chip.

CSV columns: `timestamp`, `iso`, `path`, `nats_subject`, `value`.

---

## Run and build from source (developers)

Requires **Node.js 22+**.

```bash
npm install
npm run dev              # browser UI at http://localhost:5173
npm run electron:dev     # desktop window
npm run dist:linux       # AppImage + .deb → release/
npm run dist:win         # Windows setup.exe + zip → release/
npm run dist:mac         # .dmg + zip (run on macOS) → release/
npm run dist             # Linux + Windows packages
```

The web UI talks to a local bridge on port `3847`. The packaged desktop app starts that bridge automatically.
