# Implementation Plan: Collaborative Whiteboard (MVP V1)

## Overview

This implementation plan breaks down the collaborative whiteboard feature into discrete coding steps. The project uses a two-tier architecture:

- **Frontend**: React 19 + Vite + Zustand + react-konva for the drawing canvas
- **Backend**: Spring Boot 4 (Java 17) with STOMP/WebSocket, PostgreSQL for persistence

The plan follows a logical sequence: frontend setup → frontend UI → backend setup → backend services → integration testing → CI/CD → polish.

Tasks marked with `*` are optional and can be skipped for faster MVP delivery.

---

## Phase 1: Frontend Setup

### Setup Project Structure and Dependencies

- [ ] 1.1 Install required dependencies
  - Add `zustand`, `@stomp/stompjs`, `react-konva`, `konva` to package.json
  - Run `npm install` to install packages
  - _Requirements: 1.1, 2.6, 18.5_

- [ ] 1.2 Configure Vite and React
  - Verify `vite.config.js` is configured for React
  - Set up basic routing with `react-router-dom`
  - Create `src/App.jsx` with routes for `/` (HomePage) and `/board/:boardId` (BoardPage)
  - _Requirements: 2.1, 2.6_

- [ ] 1.3 Create folder structure
  - Create directories: `src/components/`, `src/store/`, `src/services/`, `src/types/`
  - Create `src/main.jsx` entry point
  - _Requirements: 18.5_

- [ ] 1.4 Set up testing framework
  - Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
  - Configure `vitest.config.js`
  - Create `src/test-utils/` for test helpers
  - _Requirements: 19.1, 19.2, 19.3, 19.4_

### Phase 1 Checkpoint

- [ ] 1.5 Ensure all tests pass
  - Run `npm run test` and verify no failures
  - Ask the user if questions arise.

---

## Phase 2: Frontend Whiteboard UI

### Core Store Implementation

- [ ] 2.1 Create Zustand store with initial state
  - Define `BoardStore` interface with all required fields (userId, boardId, shapes, revision, activeUsers, tool state)
  - Implement store with `create()` from zustand
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2.2 Implement userId persistence
  - Create `src/services/userIdService.ts` with `getUserId()` and `generateUserId()` functions
  - Use `localStorage` for persistence with session-scoped fallback
  - _Requirements: 1.1, 1.2, 1.4_

- [ ] 2.3 Implement store actions for snapshot and messages
  - Add `applySnapshot(snapshot)` action to replace local state
  - Add `applyMessage(msg)` action to handle all message types
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

### WebSocket Client

- [ ] 2.4 Create WebSocket client wrapper
  - Create `src/services/wsClient.ts` singleton
  - Implement `connect(boardId, userId)`, `disconnect()`, `send(message)` methods
  - Configure reconnect with exponential back-off
  - _Requirements: 2.6, 18.5, 18.6_

- [ ] 2.5 Implement message throttling
  - Create throttle helper for cursor moves (50ms) and text updates (50ms)
  - Implement `requestAnimationFrame` for stroke appends (≈16ms)
  - _Requirements: 12.1, 7.3_

### Whiteboard Canvas Components

- [ ] 2.6 Create Toolbar component
  - Implement tool selector (pen, rectangle, ellipse, text, image, select)
  - Add color pickers for stroke and fill colors
  - Add width slider for stroke width
  - _Requirements: 4.1, 5.1, 6.1, 7.1, 8.1, 9.1_

- [ ] 2.7 Create WhiteboardCanvas component
  - Set up Konva Stage and Layer
  - Implement pointer event handlers for drawing
  - Add selection and drag functionality
  - _Requirements: 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1_

- [ ] 2.8 Create ShapeRenderer component
  - Render all shape types (stroke, rectangle, ellipse, text, image)
  - Handle stroke rendering with Konva Line
  - Handle image rendering with Konva Image
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 2.9 Create CursorLayer component
  - Render remote cursors from `activeUsers` store
  - Display user ID label (first 8 characters)
  - Hide cursors inactive for >5000ms
  - _Requirements: 12.3, 12.4_

### Presence and UI

- [ ] 2.10 Create PresencePanel component
  - Display active user count
  - List user IDs (first 8 characters)
  - Update on USER_JOIN and USER_LEAVE messages
  - _Requirements: 13.3, 13.4_

- [ ] 2.11 Create ShareBar component
  - Display board URL in read-only input
  - Implement copy-to-clipboard functionality
  - _Requirements: 2.8_

### Phase 2 Checkpoint

- [ ] 2.12 Ensure all tests pass
  - Run `npm run test` and verify no failures
  - Ask the user if questions arise.

---

## Phase 3: Backend Setup

### Spring Boot Configuration

- [ ] 3.1 Configure Spring Boot project
  - Verify `pom.xml` has Spring Web, Spring WebSocket, Spring Data JPA, PostgreSQL dependencies
  - Configure Java 17 in `pom.xml`
  - _Requirements: 17.1, 17.2_

- [ ] 3.2 Create WebSocket configuration
  - Create `WebSocketConfig.java` with `@EnableWebSocketMessageBroker`
  - Register STOMP endpoint `/ws` with CORS and SockJS support
  - Configure simple in-memory broker for `/topic`
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 3.3 Create scheduler configuration
  - Create `SchedulerConfig.java` with `@EnableScheduling`
  - _Requirements: 15.2_

### Database Configuration

- [ ] 3.4 Configure PostgreSQL connection
  - Add `spring.datasource.url`, `spring.datasource.username`, `spring.datasource.password` to `application.properties`
  - Configure `spring.jpa.hibernate.ddl-auto=none` for Flyway
  - _Requirements: 17.1, 17.2_

- [ ] 3.5 Create Flyway migration
  - Create `src/main/resources/db/migration/V1__init.sql`
  - Implement `boards` and `shapes` table schema
  - Include `shape_type` enum and foreign key constraints
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

### Data Models and DTOs

- [ ] 3.6 Create JPA entities
  - Create `Board.java` entity with `@Entity`, `@Table`
  - Create `Shape.java` entity with all fields
  - Create `ShapeType.java` enum
  - _Requirements: 17.1, 17.2_

- [ ] 3.7 Create WebSocket message DTOs
  - Create `WsMessage.java` base envelope
  - Create inbound message types: `StrokeStartMessage`, `StrokeAppendMessage`, `StrokeEndMessage`, `CreateShapeMessage`, `UpdateShapeMessage`, `DeleteShapeMessage`, `TextUpdateMessage`, `CursorMoveMessage`
  - Create outbound message types: `BoardSnapshotMessage`, `UserJoinMessage`, `UserLeaveMessage`, `ErrorMessage`
  - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [ ] 3.8 Create repositories
  - Create `BoardRepository.java` with `JpaRepository<Board, UUID>`
  - Create `ShapeRepository.java` with `JpaRepository<Shape, UUID>`
  - _Requirements: 16.2_

### Phase 3 Checkpoint

- [ ] 3.9 Ensure all tests pass
  - Run `./mvnw verify` and verify no failures
  - Ask the user if questions arise.

---

## Phase 4: Backend Services

### Message Handler

- [ ] 4.1 Create BoardMessageHandler
  - Create `@Controller` with `@MessageMapping("/board/{boardId}")`
  - Parse inbound messages and dispatch by type
  - Send ERROR messages for validation failures
  - _Requirements: 18.1, 18.2, 18.3_

- [ ] 4.2 Implement message validation
  - Validate required envelope fields (boardId, userId, timestamp, revision)
  - Validate shape dimensions (width > 0, height > 0)
  - Validate text length (≤1000 chars)
  - _Requirements: 5.4, 6.4, 7.5, 11.1, 4.5_

### Board Service

- [ ] 4.3 Create BoardService
  - Implement `createBoard()` for POST /api/boards
  - Implement `getBoard(boardId)` for GET /api/boards/{boardId}
  - Implement `getShapes(boardId)` for GET /api/boards/{boardId}/shapes
  - _Requirements: 2.3, 2.4, 16.1, 16.2, 16.3, 16.4_

- [ ] 4.4 Implement snapshot assembly
  - Create `assembleSnapshot(boardId)` method
  - Fetch all shapes for board and include in BOARD_SNAPSHOT
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

### Shape Service

- [ ] 4.5 Create ShapeService
  - Implement `createShape()` with validation
  - Implement `updateShape()` with last-write-wins
  - Implement `deleteShape()`
  - _Requirements: 9.3, 10.2, 14.1, 14.2_

- [ ] 4.6 Implement shape limit enforcement
  - Check shape count before creation
  - Reject if count would exceed 1000
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 4.7 Implement stroke point limit
  - Track point count per in-progress stroke
  - Reject if count would exceed 5000
  - _Requirements: 4.5_

### Presence Service

- [ ] 4.8 Create PresenceService
  - Implement in-memory `ConcurrentHashMap<String, Set<String>>` for board users
  - Listen to `SessionSubscribeEvent` for joins
  - Listen to `SessionDisconnectEvent` for leaves
  - Broadcast USER_JOIN and USER_LEAVE messages
  - _Requirements: 12.1, 12.2, 13.1, 13.2_

### Autosave Service

- [ ] 4.9 Create AutosaveService
  - Implement `ConcurrentHashMap<String, AutosaveBuffer>` for dirty flags
  - Implement `markDirty(boardId)` for shape mutations
  - Implement `flushAll()` scheduled every 1000ms
  - Implement `flushOnDisconnect(boardId)` for immediate flush
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 4.10 Implement AutosaveBuffer
  - Create inner class `AutosaveBuffer` with dirty flag and pending mutations
  - Implement `flush()` to batch update shapes to database
  - Update `updated_at` timestamp on board
  - _Requirements: 15.1, 15.2, 15.5_

### Phase 4 Checkpoint

- [ ] 4.11 Ensure all tests pass
  - Run `./mvnw verify` and verify no failures
  - Ask the user if questions arise.

---

## Phase 5: Integration Testing

### Property-Based Tests

- [ ] 5.1 Write property test for Property 1: userId persistence
  - **Property 1: userId persistence across page loads**
  - **Validates: Requirements 1.1, 1.2**
  - Use fast-check to verify userId is read from localStorage on subsequent visits
  - _Requirements: 1.1, 1.2_

- [ ] 5.2 Write property test for Property 2: whitespace-only text rejection
  - **Property 2: Whitespace-only and empty text content is rejected**
  - **Validates: Requirements 7.5**
  - Use fast-check to generate whitespace-only strings and verify rejection
  - _Requirements: 7.5_

- [ ] 5.3 Write property test for Property 3: shape count cap
  - **Property 3: Shape count cap is enforced**
  - **Validates: Requirements 11.1**
  - Use fast-check to generate sequences of shape creation and verify cap at 1000
  - _Requirements: 11.1_

- [ ] 5.4 Write property test for Property 4: message envelope round-trip
  - **Property 4: Message envelope round-trip integrity**
  - **Validates: Requirements 18.1, 18.3**
  - Use fast-check to verify boardId, userId, timestamp, revision match in broadcast
  - _Requirements: 18.1, 18.3_

- [ ] 5.5 Write property test for Property 5: snapshot completeness
  - **Property 5: Snapshot completeness**
  - **Validates: Requirements 3.1, 3.2, 3.5**
  - Use fast-check to generate shape arrays and verify snapshot includes all fields
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 5.6 Write property test for Property 6: stroke point accumulation bound
  - **Property 6: Stroke point accumulation is bounded**
  - **Validates: Requirements 4.5**
  - Use fast-check to generate stroke append sequences and verify 5000 point cap
  - _Requirements: 4.5_

- [ ] 5.7 Write property test for Property 7: rectangle/ellipse dimension validation
  - **Property 7: Rectangle and ellipse dimension validation**
  - **Validates: Requirements 5.4, 6.4**
  - Use fast-check to generate invalid dimensions and verify rejection
  - _Requirements: 5.4, 6.4_

- [ ] 5.8 Write property test for Property 8: last-write-wins ordering
  - **Property 8: Last-write-wins ordering**
  - **Validates: Requirements 14.1, 14.2**
  - Use fast-check to generate concurrent update sequences and verify final state
  - _Requirements: 14.1, 14.2_

- [ ] 5.9 Write property test for Property 9: autosave buffer dirty-then-flush
  - **Property 9: Autosave buffer dirty-then-flush**
  - **Validates: Requirements 15.1, 15.2, 15.5**
  - Use fast-check to verify flush within 5000ms of mutation
  - _Requirements: 15.1, 15.2, 15.5_

- [ ] 5.10 Write property test for Property 10: DELETE_SHAPE removes from snapshots
  - **Property 10: DELETE_SHAPE removes shape from subsequent snapshots**
  - **Validates: Requirements 10.2, 10.3**
  - Use fast-check to verify deleted shape excluded from future snapshots
  - _Requirements: 10.2, 10.3_

### Unit and Integration Tests

- [ ] 5.11 Write unit tests for ShapeService validation
  - Test dimension validation (width > 0, height > 0)
  - Test text length validation (≤1000 chars)
  - Test shape limit (≤1000)
  - Test stroke point limit (≤5000)
  - _Requirements: 5.4, 6.4, 7.5, 11.1, 4.5_

- [ ] 5.12 Write unit tests for AutosaveService state machine
  - Test dirty flag setting
  - Test flush state transitions
  - Test immediate flush on disconnect
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 5.13 Write unit tests for PresenceService
  - Test join tracking
  - Test leave tracking
  - Test concurrent access
  - _Requirements: 12.1, 12.2, 13.1, 13.2_

- [ ] 5.14 Write integration tests for WebSocket flow
  - Test full flow: connect → snapshot → mutate → disconnect
  - Test REST endpoints with embedded H2 database
  - _Requirements: 2.3, 3.1, 4.1, 9.3, 10.2, 15.1_

### Phase 5 Checkpoint

- [ ] 5.15 Ensure all tests pass
  - Run `./mvnw verify` and `npm run test` and verify no failures
  - Ask the user if questions arise.

---

## Phase 6: CI/CD Pipeline

### GitHub Actions Workflow

- [ ] 6.1 Create CI workflow file
  - Create `.github/workflows/ci.yml`
  - Configure trigger on push and pull request to main
  - _Requirements: 19.1_

- [ ] 6.2 Configure backend test job
  - Run `./mvnw verify` with Maven wrapper
  - Cache `.m2` repository between runs
  - Fail on test failure
  - _Requirements: 19.2_

- [ ] 6.3 Configure frontend test job
  - Run `npm ci` with dependency caching
  - Run `npm run lint` and fail on errors
  - Run `npm run build` and fail on errors
  - Run `npx vitest --run` for tests
  - _Requirements: 19.3, 19.4, 19.5_

- [ ] 6.4 Configure parallel execution
  - Run backend and frontend jobs in parallel
  - Report green status check on success
  - _Requirements: 19.5, 19.7_

### Phase 6 Checkpoint

- [ ] 6.5 Ensure CI pipeline works
  - Push to a feature branch and verify CI runs
  - Verify green status check on successful run
  - Ask the user if questions arise.

---

## Phase 7: Documentation and Polish

### Documentation

- [ ] 7.1 Create README.md
  - Project overview and features
  - Getting started instructions
  - Technology stack
  - _Requirements: 19.6_

- [ ] 7.2 Create API documentation
  - Document REST endpoints: POST /api/boards, GET /api/boards/{boardId}, GET /api/boards/{boardId}/shapes
  - Document WebSocket message types and structure
  - _Requirements: 16.1, 16.2, 18.1, 18.2, 18.3, 18.4_

- [ ] 7.3 Create developer setup guide
  - Prerequisites (Java 17, Node.js 18+, PostgreSQL 14+)
  - Local development setup
  - Running tests
  - _Requirements: 19.6_

### Polish

- [ ] 7.4 Add error handling UI
  - Display WebSocket ERROR messages as dismissible toast
  - Show "Board not found" page for 404
  - Show "Reconnecting..." banner during disconnect
  - _Requirements: 15.4_

- [ ] 7.5 Add loading states
  - Show loading indicator during board creation
  - Show loading indicator during initial snapshot fetch
  - _Requirements: 2.4, 3.1_

- [ ] 7.6 Add responsive design
  - Ensure canvas resizes with window
  - Ensure UI adapts to mobile screens
  - _Requirements: 19.6_

### Final Checkpoint

- [ ] 7.7 Final review and cleanup
  - Run `./mvnw verify` and `npm run test` one final time
  - Verify all acceptance criteria are met
  - Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- CI/CD pipeline ensures code quality and prevents regressions
