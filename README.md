# VIRTUAL-LAB

A collaborative 2D physics sandbox for university-level learning. Multiple students join a shared room and build, drag, and connect physical bodies in real time, while a side panel shows live velocity and kinetic-energy graphs, AI explanations, lessons, and quizzes.

## Features

### Core sandbox
- **Room system** — join a shared room by name (no login).
- **Physics canvas** powered by Matter.js: draggable boxes, circles, custom polygons, gravity, walls, mouse interaction.
- **Toolbar** with Add Box / Add Circle / Polygon / Pause / Play / Step / Undo / Redo / Grid / Speed / Delete / Reset.
- **Constraint panel** that creates ropes, springs, and pivots between bodies, with a live list and per-constraint delete.
- **Object Properties panel** to edit mass, friction, restitution, and colour of the selected body.
- **Realtime multi-user sync** via Socket.io, with smooth interpolation to hide network jitter and a connection-status badge.
- **Undo / Redo** of scene changes (50-deep stack).
- **Touch support** so the lab is usable on tablets.
- **Velocity arrows, trajectory trails, kinetic heatmap colouring, collision flashes, and a metric grid overlay** — visualisation aids that can be toggled.

### Learning
- **Guided Lessons** — three lesson chapters (Pendulums, Springs, Collisions) with goals, hints, and a one-click setup button.
- **Predict-Then-Observe** cards prompt students to commit to a prediction before they press Play.
- **Quiz Mode** — multiple-choice physics check with score.
- **Glossary** — searchable definitions of the core terms used in the dashboard.
- **AI Lab Assistant** — a chat panel that answers scene-aware physics questions. Optional; only active if `OPENAI_API_KEY` is set.

### Data
- **Analytics dashboard** with live velocity and kinetic-energy charts (Recharts), with a friendly empty state.
- **Experiment Library** — save scenes to MongoDB and reload them later.
- **Template Library** — load prebuilt experiments grouped by topic (Oscillations, Collisions, Motion, Waves).
- **Data Export** — download the current scene as JSON or the chart history as CSV.
- **REST API** for experiments (`GET` / `POST /api/experiments`) and the AI assistant (`POST /api/assistant`).

## Folder structure

```
virtual-lab/
├── client/                              # React frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── PhysicsCanvas.jsx
│   │   │   ├── Toolbar.jsx
│   │   │   ├── ConstraintPanel.jsx
│   │   │   ├── ObjectPropertiesPanel.jsx
│   │   │   ├── AnalyticsDashboard.jsx
│   │   │   ├── ExperimentLibrary.jsx
│   │   │   ├── TemplateLibraryPanel.jsx
│   │   │   ├── DataExportPanel.jsx
│   │   │   ├── GuidedLessonsPanel.jsx
│   │   │   ├── PredictionPanel.jsx
│   │   │   ├── QuizPanel.jsx
│   │   │   ├── GlossaryPanel.jsx
│   │   │   ├── AIAssistantPanel.jsx
│   │   │   ├── ConnectionStatus.jsx
│   │   │   ├── ToastContainer.jsx
│   │   │   ├── Tooltip.jsx
│   │   │   └── RoomJoin.jsx
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   └── usePhysicsEngine.js
│   │   ├── utils/
│   │   │   ├── physicsHelpers.js
│   │   │   ├── interpolation.js
│   │   │   └── learningContent.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── server/                              # Node.js + Express backend
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   └── Experiment.js
│   ├── routes/
│   │   ├── experiments.js
│   │   └── assistant.js                 # OpenAI proxy with rate-limit + size cap
│   ├── sockets/
│   │   ├── socketHandler.js
│   │   └── roomManager.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
└── README.md
```

## Installation

You need **Node.js 18+** (required for the native `fetch` used in the assistant route) and a running **MongoDB** instance (local or Atlas).

```bash
# After unzipping, install dependencies for both apps:
cd virtual-lab
cd server && npm install
cd ../client && npm install
```

## Configuration

Copy `server/.env.example` to `server/.env`:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/virtual-lab
CLIENT_URL=http://localhost:3000

# Optional. Without this, the AI Assistant panel returns a friendly
# "not configured" message and the rest of the app works normally.
# OPENAI_API_KEY=sk-your-openai-key
# OPENAI_MODEL=gpt-4o-mini
```

## MongoDB setup

The simplest option is to run MongoDB locally on the default port `27017`:

- **macOS**: `brew install mongodb-community && brew services start mongodb-community`
- **Ubuntu**: follow the official MongoDB Community installation guide and run `sudo systemctl start mongod`
- **Windows**: install from the MongoDB website and start the service

If you prefer MongoDB Atlas, just replace `MONGO_URI` with your Atlas connection string.

## Running the backend

```bash
cd server
npm start
```

You should see:

```
[db] MongoDB connected
[server] Listening on http://localhost:5000
```

## Running the frontend

In a separate terminal:

```bash
cd client
npm start
```

This opens [http://localhost:3000](http://localhost:3000). Enter any room name and click **Enter Lab**. To test multi-user sync, open the same URL in another browser window and join the same room.

## Socket.io explanation

The realtime layer uses Socket.io rooms. The lifecycle is:

1. The client opens a WebSocket to the server (`useSocket` hook) and emits `join-room` with the chosen room name.
2. The server adds the socket to the room and replies with `room-state` — a snapshot of the bodies and constraints already present.
3. Whenever a user adds, removes, or edits a body or constraint, the client emits the corresponding event. The server validates the payload, stores it in memory, and broadcasts it to everyone else in the room.
4. While bodies are moving, the **owner** of each body emits frequent `body-update` events at ~10 Hz. Other clients apply these with `smoothMoveBody` for jitter-free motion.
5. The server enforces hard limits: max 200 bodies per room, max 200 constraints per room, max 8 KB per body payload, and max 256 KB per `load-state` payload. These exist to stop a malicious client from exhausting memory.

Empty rooms are kept for 30 seconds after the last user leaves so a brief refresh doesn't lose state.

## Matter.js explanation

Matter.js is a 2D rigid-body physics engine. The setup lives in `usePhysicsEngine.js`:

- `Matter.Engine.create()` builds the simulation engine.
- `Matter.Render.create()` renders the world to a `<canvas>` appended to the wrapper `div`.
- Static walls keep bodies inside the canvas.
- A `Matter.MouseConstraint` plus our own touch-event handler give click-and-drag on desktop and tablets.
- `Matter.Runner` advances the simulation each frame; pause / play / step controls toggle this runner.

Bodies are created via the helpers in `physicsHelpers.js` and serialised to plain JSON for the network and database. Constraints are created with `Matter.Constraint.create` using different stiffness values (rope 0.9, spring 0.05, pivot 1.0).

## REST API

| Method | Endpoint              | Description                                              |
| ------ | --------------------- | -------------------------------------------------------- |
| GET    | `/api/experiments`    | List up to 50 saved experiments, newest first            |
| POST   | `/api/experiments`    | Save a new experiment (rejects empty / duplicate names)  |
| POST   | `/api/assistant`      | Ask the AI lab assistant about the current scene         |

`POST /api/assistant` is rate-limited to 10 requests per minute per IP and rejects scene snapshots over 64 KB.

## AI assistant security notes

The `/api/assistant` route is a thin proxy in front of the OpenAI Responses API. It enforces:

- **Per-IP rate limit** — 10 requests/minute (in-memory, single-process). For multi-process deployments, replace the in-memory token bucket in `server/routes/assistant.js` with a Redis-backed limiter.
- **Question length cap** — 800 characters.
- **Scene size cap** — 64 KB.
- **Upstream timeout** — 25 seconds, after which an `AbortController` cancels the call.
- **API key never exposed to the client** — the browser only ever talks to our server.

The client also supports cancelling an in-flight request, so if the user navigates away or asks a new question while the previous one is still pending, the old request is aborted cleanly.

## Future improvements

- Live count of users present in the room and per-user cursors.
- Authentication and per-user experiment ownership.
- Replay / scrubber for saved sessions.
- WebRTC voice chat in the room.
- 3D mode using Three.js.
- Production deployment (Docker, NGINX, HTTPS, Sentry).
- Move room state to Redis so multiple Node processes can serve the same room.

## Team contribution division (3 students)

This is a suggested split for a team of three:

- **Student A — Backend & Realtime**: `server/` folder. Owns Express setup, MongoDB schema, REST routes, Socket.io router, AI proxy with rate-limit / size cap, payload validation in `socketHandler.js`.
- **Student B — Physics & Canvas**: Matter.js integration. Owns `usePhysicsEngine.js`, `PhysicsCanvas.jsx` (the largest file), `physicsHelpers.js`, `interpolation.js`, the constraint creation logic, and all canvas overlays (velocity arrows, trails, heatmap, collision flashes, polygon tool).
- **Student C — UI, Learning, Analytics**: Tailwind layout and React components. Owns `App.jsx`, `Toolbar.jsx`, `ConstraintPanel.jsx`, `ObjectPropertiesPanel.jsx`, `AnalyticsDashboard.jsx`, `ExperimentLibrary.jsx`, `TemplateLibraryPanel.jsx`, `DataExportPanel.jsx`, `GuidedLessonsPanel.jsx`, `PredictionPanel.jsx`, `QuizPanel.jsx`, `GlossaryPanel.jsx`, `AIAssistantPanel.jsx`, the toast system, the connection-status badge, plus the Recharts plumbing and the `api.js` service.

Glue work (`useSocket.js`, README, `learningContent.js`) can be paired between any two students.
