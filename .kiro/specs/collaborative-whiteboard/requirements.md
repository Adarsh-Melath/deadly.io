# Requirements Document

## Introduction

This document defines the requirements for a production-ready collaborative real-time whiteboard application (MVP V1). The application allows multiple anonymous users to draw, annotate, and collaborate on a shared canvas simultaneously. Users access a board via an unguessable UUID link and see each other's cursors and changes in real time. The system persists board state to PostgreSQL and synchronises all clients over WebSocket/STOMP. No authentication system is included in V1.

---

## Glossary

- **Board**: A shared canvas identified by a UUID. Accessible to anyone who holds its link.
- **Shape**: A single drawable element on a Board. Types: `stroke`, `rectangle`, `ellipse`, `text`, `image`.
- **Stroke**: A free-draw shape composed of an ordered sequence of points.
- **Room**: The server-side session grouping all WebSocket connections for a single Board.
- **User**: An anonymous participant identified by a UUID stored in the browser's `localStorage`.
- **Presence**: The set of currently connected Users on a Board, including their cursor positions.
- **Snapshot**: The complete, authoritative state of a Board (all Shapes) sent by the Server to a client on join or reconnect.
- **Revision**: A monotonically increasing integer counter maintained by the Server for each Board, incremented on every accepted mutation.
- **Server**: The Spring Boot backend application.
- **Client**: The React/Vite frontend application running in a browser.
- **STOMP_Broker**: The Spring WebSocket STOMP message broker embedded in the Server.
- **Canvas**: The react-konva rendering surface displayed to the User.
- **Autosave_Buffer**: An in-memory structure on the Server that accumulates pending shape mutations before flushing to the database.
- **CI_Pipeline**: The GitHub Actions workflow that builds, tests, and validates the project on every push and pull request.

---

## Requirements

### Requirement 1: Anonymous User Identity

**User Story:** As a visitor, I want a persistent anonymous identity assigned automatically, so that I can be recognised across page reloads without creating an account.

#### Acceptance Criteria

1. WHEN a User opens the application for the first time, THE Client SHALL generate a UUID v4 and store it in `localStorage` under the key `userId`.
2. WHEN a User opens the application on a subsequent visit, THE Client SHALL read the existing `userId` from `localStorage` and use it as the User's identity.
3. THE Client SHALL include the `userId` in every WebSocket message sent to the Server.
4. IF `localStorage` is unavailable, THEN THE Client SHALL generate a session-scoped UUID v4 and use it for the duration of the browser session.

---

### Requirement 2: Board Creation and Room Access

**User Story:** As a user, I want to create a new board and share its link, so that collaborators can join the same canvas.

#### Acceptance Criteria

1. WHEN a User navigates to the application root (`/`), THE Client SHALL display a "Create Board" action.
2. WHEN a User triggers "Create Board", THE Client SHALL send a `POST /api/boards` request to the Server.
3. WHEN THE Server receives `POST /api/boards`, THE Server SHALL create a Board record with a UUID v4 `id`, a default name, and the current UTC timestamp, then return the Board `id` in the response body.
4. WHEN THE Server creates a Board, THE Server SHALL respond within 2000 ms under normal operating conditions.
5. WHEN THE Client receives the Board `id`, THE Client SHALL navigate the browser to `/board/{boardId}`.
6. WHEN a User navigates to `/board/{boardId}`, THE Client SHALL connect to the WebSocket endpoint and subscribe to the Room for that Board.
7. IF a User navigates to `/board/{boardId}` and no Board with that `id` exists, THEN THE Server SHALL return HTTP 404 and THE Client SHALL display a "Board not found" message.
8. THE Client SHALL display the Board URL in a copyable field so the User can share it with collaborators.

---

### Requirement 3: Board Snapshot on Join and Reconnect

**User Story:** As a user joining an existing board, I want to immediately see all current shapes, so that I am in sync with other collaborators.

#### Acceptance Criteria

1. WHEN a User subscribes to a Room, THE Server SHALL send a `BOARD_SNAPSHOT` message containing all Shapes for that Board and the current Revision.
2. THE `BOARD_SNAPSHOT` message SHALL include: `boardId`, `userId` (server-assigned echo), `timestamp`, `revision`, and an ordered array of all Shape objects.
3. WHEN THE Client receives a `BOARD_SNAPSHOT`, THE Client SHALL replace its entire local shape state with the Shapes from the snapshot.
4. WHEN a WebSocket connection is re-established after a disconnect, THE Server SHALL send a new `BOARD_SNAPSHOT` to the reconnecting Client.
5. IF a Board has zero Shapes, THEN THE Server SHALL send a `BOARD_SNAPSHOT` with an empty Shapes array.

---

### Requirement 4: Drawing Tools — Free Draw (Stroke)

**User Story:** As a user, I want to draw freehand strokes on the canvas, so that I can sketch ideas freely.

#### Acceptance Criteria

1. WHEN a User selects the pen tool and presses the pointer down on the Canvas, THE Client SHALL send a `STROKE_START` message containing a new Shape `id`, `boardId`, `userId`, `timestamp`, `revision`, stroke colour, stroke width, and the initial point `{x, y}`.
2. WHILE a User is drawing a stroke, THE Client SHALL send `STROKE_APPEND` messages containing the Shape `id` and new points at a maximum rate of one message per 16 ms (≈60 Hz).
3. WHEN a User releases the pointer, THE Client SHALL send a `STROKE_END` message containing the Shape `id`.
4. WHEN THE Server receives `STROKE_END`, THE Server SHALL persist the completed Stroke as a Shape record.
5. IF a Stroke accumulates more than 5000 points, THEN THE Server SHALL reject subsequent `STROKE_APPEND` messages for that Shape and send an error acknowledgement to the originating Client.
6. THE Client SHALL render stroke points locally without waiting for Server acknowledgement, to provide immediate visual feedback.

---

### Requirement 5: Drawing Tools — Rectangle

**User Story:** As a user, I want to draw rectangles on the canvas, so that I can create structured diagrams.

#### Acceptance Criteria

1. WHEN a User selects the rectangle tool and drags on the Canvas, THE Client SHALL render a rectangle preview using the drag start point as origin and the current pointer position as the opposite corner.
2. WHEN a User releases the pointer after dragging a rectangle, THE Client SHALL send a `CREATE_SHAPE` message with `type: "rectangle"`, `x`, `y`, `width`, `height`, `strokeColor`, `fillColor`, `strokeWidth`, `boardId`, `userId`, `timestamp`, and a client-generated UUID `id`.
3. WHEN THE Server receives a valid `CREATE_SHAPE` for a rectangle, THE Server SHALL persist the Shape and broadcast the `CREATE_SHAPE` message to all other subscribers of the Room.
4. IF `width` or `height` is zero or negative, THEN THE Server SHALL reject the `CREATE_SHAPE` message and return a validation error to the originating Client.

---

### Requirement 6: Drawing Tools — Ellipse

**User Story:** As a user, I want to draw ellipses on the canvas, so that I can represent circular or oval elements.

#### Acceptance Criteria

1. WHEN a User selects the ellipse tool and drags on the Canvas, THE Client SHALL render an ellipse preview centred on the drag midpoint with radii derived from the drag dimensions.
2. WHEN a User releases the pointer after dragging an ellipse, THE Client SHALL send a `CREATE_SHAPE` message with `type: "ellipse"`, `x`, `y`, `width`, `height`, `strokeColor`, `fillColor`, `strokeWidth`, `boardId`, `userId`, `timestamp`, and a client-generated UUID `id`.
3. WHEN THE Server receives a valid `CREATE_SHAPE` for an ellipse, THE Server SHALL persist the Shape and broadcast the `CREATE_SHAPE` message to all other subscribers of the Room.
4. IF `width` or `height` is zero or negative, THEN THE Server SHALL reject the `CREATE_SHAPE` message and return a validation error to the originating Client.

---

### Requirement 7: Drawing Tools — Text

**User Story:** As a user, I want to place and edit text labels on the canvas, so that I can annotate diagrams.

#### Acceptance Criteria

1. WHEN a User selects the text tool and clicks on the Canvas, THE Client SHALL create a text Shape at the clicked position and enter text-editing mode.
2. WHILE a User is editing a text Shape, THE Client SHALL send `TEXT_UPDATE` messages containing the Shape `id`, current `textContent`, `boardId`, `userId`, `timestamp`, and `revision`, throttled to one message per 50 ms.
3. WHEN a User exits text-editing mode (by pressing Escape or clicking outside the text Shape), THE Client SHALL send a final `TEXT_UPDATE` message with the complete `textContent`.
4. WHEN THE Server receives a `TEXT_UPDATE`, THE Server SHALL update the Shape record and broadcast the update to all other subscribers of the Room.
5. IF `textContent` exceeds 1000 characters, THEN THE Server SHALL reject the `TEXT_UPDATE` and return a validation error to the originating Client.
6. THE Client SHALL display the text Shape with the specified `fontSize` and `strokeColor` as the text colour.

---

### Requirement 8: Drawing Tools — Image by URL

**User Story:** As a user, I want to place images on the canvas by providing a URL, so that I can include reference visuals without uploading files.

#### Acceptance Criteria

1. WHEN a User selects the image tool and provides a URL, THE Client SHALL send a `CREATE_SHAPE` message with `type: "image"`, `src` (the URL), `x`, `y`, `width`, `height`, `boardId`, `userId`, `timestamp`, and a client-generated UUID `id`.
2. WHEN THE Server receives a valid `CREATE_SHAPE` for an image, THE Server SHALL persist the Shape and broadcast the `CREATE_SHAPE` message to all other subscribers of the Room.
3. THE Client SHALL render the image Shape by loading the image from the provided `src` URL using the browser's native image loading.
4. IF the image fails to load in the browser, THEN THE Client SHALL display a placeholder indicating the image could not be loaded.
5. THE Server SHALL NOT fetch or validate the image URL; URL validation is the responsibility of the Client before sending.
6. THE Client SHALL validate that the `src` value is a well-formed HTTP or HTTPS URL before sending the `CREATE_SHAPE` message.

---

### Requirement 9: Select, Move, and Resize Shapes

**User Story:** As a user, I want to select, move, and resize shapes, so that I can rearrange and refine my diagrams.

#### Acceptance Criteria

1. WHEN a User selects the select tool and clicks on a Shape, THE Client SHALL highlight the Shape with selection handles.
2. WHEN a User drags a selected Shape, THE Client SHALL update the Shape's `x` and `y` locally and send an `UPDATE_SHAPE` message with the new `x`, `y`, `boardId`, `userId`, `timestamp`, and `revision` when the drag ends.
3. WHEN a User drags a resize handle on a selected Shape, THE Client SHALL update the Shape's `width` and `height` locally and send an `UPDATE_SHAPE` message with the new dimensions when the resize ends.
4. WHEN THE Server receives a valid `UPDATE_SHAPE`, THE Server SHALL update the Shape record and broadcast the `UPDATE_SHAPE` message to all other subscribers of the Room.
5. IF `UPDATE_SHAPE` references a Shape `id` that does not exist on the Board, THEN THE Server SHALL return a not-found error to the originating Client.
6. THE Client SHALL apply `UPDATE_SHAPE` messages received from the Server to the local shape state immediately upon receipt.

---

### Requirement 10: Delete Shapes

**User Story:** As a user, I want to delete shapes from the canvas, so that I can remove unwanted elements.

#### Acceptance Criteria

1. WHEN a User selects a Shape and triggers the delete action (Delete key or UI button), THE Client SHALL send a `DELETE_SHAPE` message containing the Shape `id`, `boardId`, `userId`, `timestamp`, and `revision`.
2. WHEN THE Server receives a valid `DELETE_SHAPE`, THE Server SHALL remove the Shape record and broadcast the `DELETE_SHAPE` message to all other subscribers of the Room.
3. WHEN THE Client receives a `DELETE_SHAPE` message, THE Client SHALL remove the corresponding Shape from the local state and re-render the Canvas.
4. IF `DELETE_SHAPE` references a Shape `id` that does not exist on the Board, THEN THE Server SHALL return a not-found error to the originating Client without broadcasting.

---

### Requirement 11: Board Shape Limit

**User Story:** As a system operator, I want a cap on shapes per board, so that the system remains performant and storage is bounded.

#### Acceptance Criteria

1. THE Server SHALL reject any `CREATE_SHAPE` or `STROKE_END` message that would cause the total Shape count for a Board to exceed 1000.
2. WHEN THE Server rejects a Shape creation due to the limit, THE Server SHALL send an error message to the originating Client with a human-readable reason.
3. THE Client SHALL display the error message to the User when a shape creation is rejected by the Server.

---

### Requirement 12: Real-Time Presence — Cursor Sharing

**User Story:** As a user, I want to see other collaborators' cursors moving on the canvas, so that I know where they are working.

#### Acceptance Criteria

1. WHILE a User is connected to a Room, THE Client SHALL send `CURSOR_MOVE` messages containing `boardId`, `userId`, `x`, `y`, `timestamp`, throttled to one message per 50 ms.
2. WHEN THE Server receives a `CURSOR_MOVE` message, THE Server SHALL broadcast it to all other subscribers of the Room without persisting it to the database.
3. WHEN THE Client receives a `CURSOR_MOVE` message, THE Client SHALL render a cursor indicator at the specified `x`, `y` position labelled with the sender's `userId` (first 8 characters).
4. WHEN a User's `CURSOR_MOVE` messages stop for more than 5000 ms, THE Client SHALL hide that User's cursor indicator.

---

### Requirement 13: Real-Time Presence — User List

**User Story:** As a user, I want to see who is currently on the board, so that I know how many collaborators are active.

#### Acceptance Criteria

1. WHEN a User connects to a Room, THE Server SHALL broadcast a `USER_JOIN` message to all subscribers of the Room containing the joining `userId` and `timestamp`.
2. WHEN a User disconnects from a Room, THE Server SHALL broadcast a `USER_LEAVE` message to all subscribers of the Room containing the departing `userId` and `timestamp`.
3. THE Client SHALL maintain a local list of active Users derived from `USER_JOIN`, `USER_LEAVE`, and `BOARD_SNAPSHOT` messages.
4. THE Client SHALL display the count of active Users and their abbreviated `userId` values (first 8 characters) in a presence panel.

---

### Requirement 14: Conflict Resolution — Last Write Wins

**User Story:** As a system designer, I want a simple conflict strategy, so that the system remains predictable without a CRDT engine.

#### Acceptance Criteria

1. WHEN THE Server receives concurrent `UPDATE_SHAPE` messages for the same Shape `id`, THE Server SHALL apply them in the order they are received and the last received update SHALL be the authoritative state.
2. THE Server SHALL be the single source of truth for all Shape state.
3. WHEN THE Server broadcasts a mutation to Room subscribers, THE Client SHALL apply the mutation to local state regardless of the Client's current local state for that Shape.

---

### Requirement 15: Autosave

**User Story:** As a user, I want my board to be saved automatically, so that I never lose work due to a browser close or network drop.

#### Acceptance Criteria

1. WHEN a Shape mutation (`CREATE_SHAPE`, `UPDATE_SHAPE`, `DELETE_SHAPE`, `STROKE_END`, `TEXT_UPDATE`) is processed by THE Server, THE Server SHALL mark the Board's Autosave_Buffer as dirty.
2. WHILE the Autosave_Buffer for a Board is dirty, THE Server SHALL flush all pending mutations to PostgreSQL within 5000 ms.
3. WHEN a User disconnects from a Room, THE Server SHALL immediately flush the Autosave_Buffer for that Board to PostgreSQL if it is dirty.
4. THE Server SHALL NOT write to PostgreSQL on every `STROKE_APPEND` message.
5. WHEN THE Server flushes the Autosave_Buffer, THE Server SHALL update the `updated_at` timestamp on the Board record.

---

### Requirement 16: REST API — Board and Shape Retrieval

**User Story:** As a client application, I want REST endpoints for board and shape data, so that I can load initial state without WebSocket.

#### Acceptance Criteria

1. THE Server SHALL expose `GET /api/boards/{boardId}` which returns the Board metadata (id, name, created_at, updated_at) with HTTP 200.
2. THE Server SHALL expose `GET /api/boards/{boardId}/shapes` which returns all Shapes for the Board as a JSON array with HTTP 200.
3. IF a Board with the requested `boardId` does not exist, THEN THE Server SHALL return HTTP 404 for both endpoints.
4. THE Server SHALL respond to `GET /api/boards/{boardId}/shapes` within 2000 ms for boards with up to 1000 Shapes under normal operating conditions.

---

### Requirement 17: Data Persistence — Database Schema

**User Story:** As a system operator, I want a well-defined database schema, so that board data is stored reliably and queryable.

#### Acceptance Criteria

1. THE Server SHALL maintain a `boards` table with columns: `id` (UUID primary key), `name` (VARCHAR), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
2. THE Server SHALL maintain a `shapes` table with columns: `id` (UUID primary key), `board_id` (UUID foreign key referencing `boards.id`), `type` (ENUM: `stroke`, `rectangle`, `ellipse`, `text`, `image`), `x` (DOUBLE), `y` (DOUBLE), `width` (DOUBLE), `height` (DOUBLE), `stroke_color` (VARCHAR), `fill_color` (VARCHAR), `stroke_width` (DOUBLE), `points` (JSONB), `text_content` (VARCHAR(1000)), `font_size` (INTEGER), `src` (VARCHAR), `created_by` (UUID), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
3. THE Server SHALL enforce a foreign key constraint from `shapes.board_id` to `boards.id` with `ON DELETE CASCADE`.
4. THE Server SHALL create an index on `shapes.board_id` to support efficient shape retrieval by board.

---

### Requirement 18: WebSocket Message Protocol

**User Story:** As a developer, I want a consistent message envelope for all WebSocket events, so that clients and servers can reliably parse and route messages.

#### Acceptance Criteria

1. THE Server SHALL require every inbound WebSocket message to include the fields: `boardId` (UUID string), `userId` (UUID string), `timestamp` (ISO-8601 UTC string), and `revision` (non-negative integer).
2. IF an inbound message is missing any required envelope field, THEN THE Server SHALL reject the message and send an error response to the originating Client without broadcasting.
3. THE Server SHALL include `boardId`, `userId`, `timestamp`, and `revision` in every outbound broadcast message.
4. THE Server SHALL use STOMP destination `/topic/board/{boardId}` for all broadcast messages to Room subscribers.
5. THE Client SHALL subscribe to `/topic/board/{boardId}` upon connecting to a Room.
6. THE Client SHALL send messages to the STOMP destination `/app/board/{boardId}`.

---

### Requirement 19: CI/CD Pipeline

**User Story:** As a developer, I want a GitHub Actions CI/CD pipeline, so that every push is automatically built and tested.

#### Acceptance Criteria

1. THE CI_Pipeline SHALL trigger on every push to any branch and on every pull request targeting the `main` branch.
2. WHEN triggered, THE CI_Pipeline SHALL build the Spring Boot backend using `./mvnw verify` and fail the pipeline if the build or any test fails.
3. WHEN triggered, THE CI_Pipeline SHALL install frontend dependencies using `npm ci` and run the frontend linter using `npm run lint`, failing the pipeline if the linter reports errors.
4. WHEN triggered, THE CI_Pipeline SHALL build the frontend production bundle using `npm run build` and fail the pipeline if the build fails.
5. THE CI_Pipeline SHALL run backend and frontend jobs in parallel to minimise total pipeline duration.
6. THE CI_Pipeline SHALL cache Maven dependencies (`.m2` repository) and npm dependencies (`node_modules`) between runs to reduce build time.
7. WHEN all jobs pass, THE CI_Pipeline SHALL report a green status check on the commit or pull request.

---

### Requirement 20: Git Workflow

**User Story:** As a developer, I want a professional git workflow, so that the project history is clean and reviewable.

#### Acceptance Criteria

1. THE development workflow SHALL use feature branches created from `main` for all new work.
2. THE development workflow SHALL use conventional commit messages following the format `<type>(<scope>): <description>` where `type` is one of `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`.
3. WHEN a feature is complete, THE development workflow SHALL merge it to `main` via a pull request on the remote repository at `https://github.com/Adarsh-Melath/deadly.io.git`.
4. THE `main` branch SHALL only receive commits via merged pull requests; direct pushes to `main` SHALL be avoided.
