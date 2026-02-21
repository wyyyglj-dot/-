# optimistic-serving: 上菜队列乐观更新

## ADDED Requirements

### Requirement: Optimistic removal on serve

The system SHALL immediately remove the served item from the local serving queue upon user click, before the API response returns. The API request SHALL be sent in the background. No loading spinner SHALL be displayed on the serve button.

#### Scenario: Successful optimistic serve
- **WHEN** user clicks "已上菜" button for item X
- **THEN** item X is immediately removed from the local serving queue array, API `POST /ticket-items/:id/serve` is sent in background, and a success toast is NOT shown (silent success)

#### Scenario: Failed optimistic serve with rollback
- **WHEN** user clicks "已上菜" for item X and the API returns an error
- **THEN** item X is restored to its original position in the serving queue, an error toast "上菜失败，已恢复" is displayed, and a full refetch is triggered after 3 seconds to sync state

#### Scenario: Rapid consecutive serves
- **WHEN** user clicks "已上菜" on items A, B, C within 1 second
- **THEN** all three items are immediately removed from the queue independently, three parallel API requests are sent, and any individual failure only rolls back that specific item

### Requirement: SSE debounce after local operation

The system SHALL ignore SSE-triggered serving queue refetches for 2 seconds after any local optimistic operation. This prevents the SSE `serving.updated` event from causing a full refetch that would flash items back into the queue.

#### Scenario: SSE event during debounce window
- **WHEN** user serves item X (local removal) and an SSE `serving.updated` event arrives within 2 seconds
- **THEN** the SSE handler skips the refetch, preserving the optimistic local state

#### Scenario: SSE event after debounce window
- **WHEN** user serves item X and an SSE `serving.updated` event arrives after 2 seconds
- **THEN** the SSE handler processes the event normally (incremental update per sse-incremental-update spec)

## PBT Properties

### OPTIMISTIC_REMOVE_BEFORE_API
- **Invariant**: After markServed() call, the item MUST be absent from servingQueue before the API promise resolves
- **Falsification**: Mock API with 5s delay, assert item removed from array within 10ms of call

### ROLLBACK_RESTORES_EXACT_STATE
- **Invariant**: On API failure, the queue state equals the pre-operation state (item restored, order preserved)
- **Falsification**: Generate random queue states, simulate failure, assert deep equality with snapshot

### DEBOUNCE_WINDOW_MONOTONIC
- **Invariant**: The debounce timestamp only increases; concurrent operations extend the window
- **Falsification**: Rapid fire N operations, assert each _localOpTimestamp >= previous

### IDEMPOTENCY_DOUBLE_SERVE
- **Invariant**: Clicking serve twice on the same item (before removal animation completes) sends at most one API request
- **Falsification**: Simulate double-click within 50ms, count API calls, assert <= 1
