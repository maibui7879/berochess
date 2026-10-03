# Backend Roadmap — Xiangqi Online Crowd

## 0. Mục tiêu

Xây dựng backend cho game cờ tướng online theo hướng:

- NestJS modular monolith
- TypeScript
- Data Mapper architecture
- TypeORM
- Supabase PostgreSQL làm database chính
- Redis cho realtime state/cache/queue
- Socket.IO cho realtime game
- LiveKit/WebRTC cho voice
- Xiangqi Engine độc lập và server-authoritative

Backend phụ trách:

- Authentication / user
- Match / room
- Luật và trạng thái cờ
- Multiplayer realtime
- Spectator
- Crowd Red / Black
- Vote / reaction
- Chat
- Commentary
- Rating / matchmaking
- Replay
- Moderation
- Anti-cheat

---

# 1. Tech Stack

## Backend

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Language | TypeScript | Backend |
| Framework | NestJS | API + business logic |
| ORM | TypeORM | Data Mapper / persistence |
| API | REST | CRUD/query |
| Realtime | Socket.IO | Game, spectator, chat, vote |
| DB | PostgreSQL | Persistent data |
| Managed DB | Supabase | Managed PostgreSQL/Auth/Storage |
| Cache | Redis | Presence, room state, vote, rate limit |
| Queue | BullMQ | Background jobs |
| Auth | JWT + Refresh Token hoặc Supabase Auth | Authentication |
| Password | Argon2 | Password hashing |
| Validation | class-validator | DTO validation |
| Docs | Swagger / OpenAPI | API documentation |
| Testing | Jest + Supertest | Unit/integration |
| Logging | Pino | Structured logging |
| Voice | LiveKit / WebRTC | Voice channels |
| Container | Docker | Local/dev/deploy |
| CI/CD | GitHub Actions | Test/build/deploy |
| Observability | Sentry + OpenTelemetry | Errors/tracing |

## Database strategy

```text
Supabase PostgreSQL
    ↓
TypeORM
    ↓
Repository Interface
    ↓
Application / Domain
```

Redis không thay thế PostgreSQL.

MongoDB Atlas chưa cần trong MVP. Chỉ thêm MongoDB khi có use case thực sự phù hợp như AI/document-heavy data.

---

# 2. Architecture — Data Mapper

Luồng chính:

```text
Controller / Gateway
        ↓
Application / Use Case
        ↓
Domain
        ↓
Repository Interface
        ↓
Infrastructure Repository
        ↓
TypeORM
        ↓
Supabase PostgreSQL
```

## 2.1. Architecture rules

- Không dùng Active Record.
- Không `extends BaseEntity`.
- Domain entity không tự query database.
- Domain không import TypeORM nếu có thể tránh.
- Repository interface thuộc domain/application.
- TypeORM repository implementation thuộc infrastructure.
- Transaction được quản lý ở application/infrastructure boundary.
- Business logic không nằm trong controller.
- Gateway chỉ xử lý transport/auth/dispatch, không chứa game rules.

Ví dụ:

```text
MatchService / UseCase
        ↓
MatchRepository interface
        ↓
TypeOrmMatchRepository
        ↓
TypeORM Repository
        ↓
PostgreSQL
```

---

# 3. Repository Structure

```text
apps/api/
└── src/
    ├── main.ts
    ├── app.module.ts
    │
    ├── common/
    ├── config/
    ├── database/
    │   ├── data-source.ts
    │   ├── migrations/
    │   └── subscribers/
    │
    └── modules/
        ├── auth/
        ├── users/
        ├── matches/
        ├── game/
        ├── spectator/
        ├── crowd/
        ├── chat/
        ├── commentary/
        ├── rating/
        ├── matchmaking/
        └── moderation/
```

Khuyến nghị module structure:

```text
matches/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   └── repositories/
│
├── application/
│   ├── use-cases/
│   └── dto/
│
├── infrastructure/
│   ├── persistence/
│   │   ├── entities/
│   │   └── repositories/
│   └── mappers/
│
└── presentation/
    ├── controllers/
    └── gateways/
```

Với project nhỏ có thể đơn giản hóa một chút, nhưng vẫn giữ ranh giới domain/application/infrastructure.

---

# 4. Phase 1 — Project Foundation

## Tasks

- [ ] Khởi tạo NestJS + TypeScript
- [ ] Cấu hình TypeORM
- [ ] Kết nối Supabase PostgreSQL
- [ ] Docker Compose cho local PostgreSQL/Redis nếu cần
- [ ] ESLint + Prettier
- [ ] Jest
- [ ] Swagger
- [ ] ConfigModule + environment validation
- [ ] Pino logging
- [ ] Global validation pipe
- [ ] Exception filter
- [ ] Request ID / correlation ID

## Environment

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
JWT_REFRESH_SECRET
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
```

---

# 5. Phase 2 — Database & Data Mapper

## 5.1. Core tables

```text
users
refresh_tokens

matches
match_players
match_spectators

game_states
moves

ratings
rating_history

chat_messages
crowd_votes
crowd_reactions
commentaries

reports
moderation_actions
```

## 5.2. User

```text
User
├── id
├── username
├── displayName
├── avatarUrl
├── status
├── createdAt
└── updatedAt
```

## 5.3. Match

```text
Match
├── id
├── mode
├── status
├── redPlayerId
├── blackPlayerId
├── ruleSet
├── startedAt
├── endedAt
├── winner
└── endReason
```

Mode:

```text
RANKED
CROWD_MATCH
CASUAL
```

## 5.4. Move

```text
Move
├── id
├── matchId
├── moveNumber
├── playerId
├── from
├── to
├── capturedPiece
├── notation
├── boardHash
└── createdAt
```

## 5.5. GameState

```text
GameState
├── matchId
├── turn
├── moveNumber
├── board
├── status
├── lastMove
└── updatedAt
```

`moves` là lịch sử bất biến. `game_states` là snapshot hiện tại để load nhanh.

## 5.6. TypeORM migrations

- [ ] Initial migration
- [ ] Foreign keys
- [ ] Unique constraints
- [ ] Indexes
- [ ] Enum strategy
- [ ] Seed development data
- [ ] Migration rollback test

Không dùng `synchronize: true` trong production.

---

# 6. Phase 3 — Authentication & Users

## REST

```http
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /users/me
PATCH /users/me
```

## Guards

```text
JwtAuthGuard
RolesGuard
WsAuthGuard
```

Roles:

```text
PLAYER
SPECTATOR
MODERATOR
ADMIN
```

(Bình luận viên là AI hệ thống, không còn role người dùng.)

Role phải được backend xác thực, không tin role từ client.

---

# 7. Phase 4 — Xiangqi Engine

Tách riêng:

```text
packages/
└── xiangqi-engine/
```

API tối thiểu:

```ts
createGame()
getLegalMoves()
validateMove()
applyMove()
isCheck()
isCheckmate()
isStalemate()
isGameOver()
```

## Movement rules

- [ ] King
- [ ] Advisor
- [ ] Elephant
- [ ] Horse
- [ ] Rook
- [ ] Cannon
- [ ] Pawn

Edge cases:

- [ ] Horse leg block
- [ ] Elephant eye block
- [ ] Elephant cannot cross river
- [ ] Cannon capture
- [ ] Flying General
- [ ] Palace restriction
- [ ] Self-check
- [ ] Check
- [ ] Checkmate
- [ ] Stalemate

## Competition rules

Tách thành rule layer:

```text
repetition
perpetual check
perpetual chase
no-capture rule
draw adjudication
```

RuleSet cần configurable.

```ts
RuleSet {
  repetition: ...
  perpetualCheck: ...
  perpetualChase: ...
  noCaptureLimit: ...
}
```

## Engine tests

```text
packages/xiangqi-engine/tests/
├── king.spec.ts
├── advisor.spec.ts
├── elephant.spec.ts
├── horse.spec.ts
├── rook.spec.ts
├── cannon.spec.ts
├── pawn.spec.ts
├── check.spec.ts
├── checkmate.spec.ts
├── repetition.spec.ts
└── edge-cases.spec.ts
```

---

# 8. Phase 5 — Match Management

## REST

```http
POST /matches
GET  /matches/:id
POST /matches/:id/join
POST /matches/:id/leave
POST /matches/:id/resign
```

Lifecycle:

```text
WAITING
   ↓
READY
   ↓
PLAYING
   ↓
FINISHED
```

End reasons:

```text
CHECKMATE
RESIGN
TIMEOUT
DRAW
DISCONNECT
FORFEIT
```

---

# 9. Phase 6 — WebSocket / Realtime Core

Gateway:

```text
GameGateway
```

Events:

```text
MATCH_JOIN
MATCH_LEAVE
GAME_STATE
MOVE_REQUEST
MOVE_PLAYED
PLAYER_READY
PLAYER_DISCONNECTED
PLAYER_RECONNECTED
GAME_CHECK
GAME_ENDED
```

Luồng:

```text
Client
  │
  │ MOVE_REQUEST
  ▼
Gateway
  │
  ▼
Game Use Case
  │
  ▼
Xiangqi Engine
  │
  ├── invalid → reject
  │
  └── valid
       │
       ├── persist move
       ├── update game state
       └── broadcast MOVE_PLAYED
```

Client không được quyết định:

```text
winner
turn
checkmate
board truth
```

---

# 10. Phase 7 — Server-Authoritative Game

Server giữ source of truth:

```text
currentBoard
currentTurn
moveNumber
gameStatus
lastMove
clock
```

Client chỉ gửi:

```json
{
  "matchId": "...",
  "from": "b0",
  "to": "c2"
}
```

Server xử lý theo thứ tự:

```text
1. Authenticate
2. Verify match membership
3. Verify player role
4. Verify turn
5. Validate move
6. Apply move
7. Check game state
8. Persist transaction
9. Broadcast event
```

Nên dùng transaction cho operation `apply move` + `persist move` + `update state`.

---

# 11. Phase 8 — Chess Clock

```text
MatchClock
├── redRemaining
├── blackRemaining
├── increment
├── activeColor
└── lastTickAt
```

Các preset:

```text
10 + 0
5 + 3
3 + 2
```

Server là nguồn thời gian chính.

Không dùng client timer để quyết định timeout.

---

# 12. Phase 9 — Spectator System

REST:

```http
GET /matches/:id/spectators
```

WebSocket:

```text
SPECTATOR_JOIN
SPECTATOR_LEAVE
SPECTATOR_TEAM_CHANGE
```

State:

```text
Spectator
├── userId
├── matchId
├── team
└── role
```

Team:

```text
NONE
RED
BLACK
```

---

# 13. Phase 10 — Crowd System

## Crowd vote

Events:

```text
VOTE_CREATED
VOTE_UPDATED
VOTE_CLOSED
```

Redis dùng cho aggregate realtime.

PostgreSQL lưu history cần thiết.

Nguyên tắc:

```text
Vote = suggestion
Vote != authoritative move
```

## Reaction

Ví dụ:

```text
🔥
👏
😮
😂
```

Rate-limit reaction để tránh spam.

---

# 14. Phase 11 — Chat

Channels:

```text
MATCH_CHAT
RED_CHAT
BLACK_CHAT
COMMENTARY
```

Message:

```text
ChatMessage
├── id
├── matchId
├── userId
├── channel
├── content
├── createdAt
└── deletedAt
```

Bắt buộc:

- [ ] Rate limit
- [ ] Spam protection
- [ ] Message length limit
- [ ] Mute
- [ ] Kick
- [ ] Ban
- [ ] Delete message

---

# 15. Phase 12 — Voice

Không stream audio qua Socket.IO.

Kiến trúc:

```text
NestJS
  ↓
authorize role/team
  ↓
LiveKit token
  ↓
WebRTC / SFU
```

Channels:

```text
RED_VOICE
BLACK_VOICE
COMMENTATOR
```

Backend quyết định room nào user được phép join.

---

# 16. Phase 13 — Commentary

Commentator là role riêng.

```text
COMMENTATOR
```

Có thể:

- text commentary
- voice commentary
- game analysis metadata

Events:

```text
COMMENTARY_CREATED
COMMENTARY_STARTED
COMMENTARY_ENDED
```

---

# 17. Phase 14 — Rating

Khuyến nghị:

```text
Glicko-2
```

Model:

```text
Rating
├── userId
├── rating
├── ratingDeviation
├── volatility
├── games
└── updatedAt
```

Tách loại rating:

```text
Competitive Rating
Crowd Rating
Prediction Rating
```

Ranked không cho spectator coaching tác động vào competitive rating.

---

# 18. Phase 15 — Matchmaking

REST/WebSocket:

```http
POST /matchmaking/join
POST /matchmaking/leave
```

Redis queues:

```text
queue:ranked
queue:casual
queue:crowd
```

Criteria:

```text
rating
rating deviation
region
ping
wait time
```

MVP có thể bắt đầu bằng rating window nhỏ rồi mở rộng theo wait time.

---

# 19. Phase 16 — Replay

```http
GET /matches/:id/replay
```

Replay lấy `moves` và reconstruct board bằng Xiangqi Engine.

```text
Initial Position
     ↓
Move 1
     ↓
Move 2
     ↓
Move 3
     ↓
...
Final Position
```

Sau này có thể lưu timeline:

```text
Move 12
├── reactions
├── crowd vote
└── commentary
```

---

# 20. Phase 17 — Event Model

Chuẩn hóa event types:

```text
MATCH_CREATED
MATCH_STARTED
MOVE_PLAYED
GAME_CHECK
GAME_ENDED
SPECTATOR_JOINED
SPECTATOR_LEFT
SPECTATOR_TEAM_CHANGED
VOTE_CREATED
VOTE_UPDATED
REACTION_SENT
CHAT_SENT
COMMENTARY_CREATED
```

Format:

```ts
GameEvent {
  id: string;
  type: GameEventType;
  matchId: string;
  userId?: string;
  payload: unknown;
  createdAt: Date;
}
```

Chưa cần Kafka ở MVP.

Use cases:

```text
Replay
Analytics
Moderation
Audit
Highlights
Notifications
```

---

# 21. Phase 18 — Anti-Cheat

MVP:

```text
server-authoritative rules
+
server-side clock
+
move validation
+
immutable move history
```

Kiểm tra:

```text
illegal move
impossible state
invalid turn
clock tampering
abnormal disconnects
multiple sessions
ranked spectator coaching
```

Ranked spectator:

```text
READ ONLY
NO DIRECT COACHING
OPTIONAL DELAY
```

Không cần AI move detection ở giai đoạn đầu.

---

# 22. Phase 19 — Moderation

```text
ModerationModule
├── reports
├── mute
├── kick
├── ban
├── message-delete
├── spectator-control
└── voice-control
```

Report target:

```text
PLAYER
SPECTATOR
CHAT_MESSAGE
VOICE
MATCH
```

---

# 23. Phase 20 — Security

## API

- [ ] Helmet
- [ ] CORS policy
- [ ] Rate limiting
- [ ] DTO validation
- [ ] JWT rotation/refresh strategy
- [ ] Password hashing with Argon2
- [ ] Secure secrets management

## WebSocket

Mỗi event cần kiểm tra:

```text
authenticated?
authorized?
match member?
correct role?
correct team?
correct turn?
```

Không nhận từ client:

```text
winner
rating
gameStatus
currentTurn
board truth
```

---

# 24. Phase 21 — Testing

## Unit tests

```text
Xiangqi Engine
Game Use Cases
Match
Rating
Matchmaking
Crowd Vote
Moderation
```

## Integration tests

```text
register → login
create match → join
join → move
move → save → broadcast
game → finish
```

## Realtime tests

Test đồng thời:

```text
Player A
Player B
Spectator 1
Spectator 2
```

Tất cả phải nhận cùng authoritative game event.

## Security tests

```text
spectator → MOVE_REQUEST
wrong turn → MOVE_REQUEST
foreign match access
fake commentator role
fake winner
fake rating
fake board state
```

---

# 25. Phase 22 — Observability

MVP:

```text
structured logs
requestId
matchId
userId
WebSocket connection logs
error tracking
```

Sau đó:

```text
Sentry
OpenTelemetry
Prometheus
Grafana
```

Metrics:

```text
active_matches
active_players
active_spectators
websocket_connections
moves_per_second
average_move_latency
matchmaking_wait_time
vote_events_per_second
chat_messages_per_second
```

---

# 26. Phase 23 — Performance & Scaling

## MVP

```text
1 NestJS
1 PostgreSQL / Supabase
1 Redis
1 LiveKit
```

## Scale

```text
Load Balancer
      │
 ┌────┼────┐
 ▼    ▼    ▼
API1 API2 API3
 │    │    │
 └────┼────┘
      ▼
    Redis
      │
 PostgreSQL
```

Khi chạy nhiều NestJS instances:

- [ ] Socket.IO Redis adapter
- [ ] Shared room/presence state
- [ ] Idempotency
- [ ] Distributed locking khi cần
- [ ] Background workers

Không dùng microservices/Kubernetes ở MVP.

---

# 27. Phase 24 — CI/CD

```text
push
 ↓
lint
 ↓
typecheck
 ↓
unit test
 ↓
integration test
 ↓
build
 ↓
docker build
 ↓
deploy
```

GitHub Actions là lựa chọn mặc định.

---

# 28. Phase 25 — Production Deployment

Gợi ý:

```text
Frontend
→ Vercel / Cloudflare

Backend
→ VPS / Render / Railway / Fly.io

Database
→ Supabase PostgreSQL

Redis
→ Managed Redis

Voice
→ LiveKit Cloud hoặc self-hosted
```

---

# 29. MVP Implementation Order

Không code tất cả module song song. Làm theo vertical slice:

## Milestone 1 — Local Game Backend

```text
NestJS
+
Xiangqi Engine
+
PostgreSQL
```

Mục tiêu:

```text
create game
make move
validate move
finish game
persist moves
```

## Milestone 2 — Multiplayer

```text
WebSocket
+
2 players
+
clock
+
reconnect
```

## Milestone 3 — Spectator

```text
join
observe
realtime board
```

## Milestone 4 — Crowd

```text
choose Red/Black
vote
reaction
```

## Milestone 5 — Social

```text
chat
commentary
moderation
```

## Milestone 6 — Competitive

```text
rating
matchmaking
ranked rules
anti-cheat
replay
```

## Milestone 7 — Voice

```text
LiveKit
Red Voice
Black Voice
Commentator
```

---

# 30. Priority

## P0 — Core

```text
[ ] auth
[ ] users
[ ] database
[ ] TypeORM Data Mapper
[ ] matches
[ ] game
[ ] xiangqi-engine
[ ] websocket
```

## P1 — Crowd MVP

```text
[ ] spectator
[ ] crowd
[ ] vote
[ ] chat
```

## P2 — Competitive

```text
[ ] clock
[ ] rating
[ ] matchmaking
[ ] replay
[ ] moderation
```

## P3 — Advanced

```text
[ ] commentary
[ ] voice
[ ] anti-cheat
[ ] event model
[ ] analytics
```

## P4 — Scale

```text
[ ] Redis adapter
[ ] horizontal scaling
[ ] observability
[ ] background workers
[ ] performance tuning
```

---

# 31. Definition of Done — MVP Backend

```text
[ ] User đăng ký / đăng nhập
[ ] Tạo match
[ ] Hai player join
[ ] Server tạo initial board
[ ] Player gửi move
[ ] Server validate move
[ ] Server reject illegal move
[ ] Server reject move ngoài lượt
[ ] Server persist move
[ ] Server broadcast MOVE_PLAYED
[ ] Reconnect lấy lại state
[ ] Check hoạt động
[ ] Checkmate kết thúc game
[ ] Resign kết thúc game
[ ] Timeout kết thúc game
[ ] Spectator join được
[ ] Spectator nhận realtime state
[ ] Spectator chọn Red / Black
[ ] Crowd vote hoạt động
[ ] Chat hoạt động
[ ] Basic moderation hoạt động
[ ] Replay lấy được toàn bộ moves
[ ] Ranked không cho spectator coaching
```

---

# 32. Target Architecture

```text
                    ┌─────────────────┐
                    │   React Client  │
                    └────────┬────────┘
                             │
                    REST / Socket.IO
                             │
                    ┌────────▼────────┐
                    │     NestJS      │
                    │                 │
                    │ Auth            │
                    │ Users           │
                    │ Matches         │
                    │ Game            │
                    │ Spectator       │
                    │ Crowd           │
                    │ Chat            │
                    │ Rating          │
                    │ Matchmaking     │
                    │ Moderation      │
                    └───────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       Xiangqi Engine      Redis      Supabase
          Rules/State    Cache/Queue   PostgreSQL
                                          │
                                       TypeORM

                    ┌─────────────┐
                    │   LiveKit   │
                    │    Voice    │
                    └─────────────┘
```

## Core principle

```text
Client = UI
Server = Truth
Database = Persistent Truth
Redis = Ephemeral / Coordination State
Xiangqi Engine = Game Rules
TypeORM = Persistence Mapper
```
