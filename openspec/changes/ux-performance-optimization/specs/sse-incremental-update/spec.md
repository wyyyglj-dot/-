# sse-incremental-update: SSE 事件增量更新

## ADDED Requirements

### Requirement: Incremental serving queue update via SSE

The system SHALL update the local serving queue incrementally when receiving `serving.updated` SSE events with `served_delta > 0` (serve operation). Items with `pending_qty <= 0` SHALL be removed; otherwise their `quantity` field SHALL be updated to match `pending_qty`.

#### Scenario: Item fully served via SSE
- **WHEN** SSE `serving.updated` event arrives with `{item_id: 42, served_delta: 1, pending_qty: 0}`
- **THEN** item with `item_id=42` is removed from the local serving queue without API refetch

#### Scenario: Item partially served via SSE
- **WHEN** SSE `serving.updated` event arrives with `{item_id: 42, served_delta: 1, pending_qty: 2}`
- **THEN** item with `item_id=42` has its `quantity` updated to `2` in the local serving queue

#### Scenario: Unserve operation triggers debounced refetch
- **WHEN** SSE `serving.updated` event arrives with `served_delta < 0` (unserve) and the item is not in the current queue
- **THEN** a debounced refetch (500ms) is triggered to reload the full serving queue

### Requirement: Incremental table update via SSE

The system SHALL carry a complete `TableSummary` object in ALL `table.updated` SSE event payloads. The frontend SHALL use `updateTableLocally()` to replace the matching table entry without full refetch.

#### Scenario: Table status change via SSE
- **WHEN** SSE `table.updated` event arrives with a full `TableSummary` payload
- **THEN** the local tables array is updated in-place for the matching `table.id`, no API call is made

#### Scenario: New table created via SSE
- **WHEN** SSE `table.updated` event arrives with a `TableSummary` whose `id` does not exist locally
- **THEN** the new table is appended to the local tables array

### Requirement: Unified table.updated payload

ALL backend `sseHub.broadcast('table.updated', ...)` call sites SHALL include a complete `TableSummary` object obtained via `repo.getTableSummary(tableId)`. The payload format SHALL be `{ table: TableSummary }`.

#### Scenario: Serve operation broadcasts table summary
- **WHEN** `serveTicketItem()` completes and broadcasts `table.updated`
- **THEN** the payload contains `{ table: TableSummary }` with current status, total_cents, dishes, and unserved_count

#### Scenario: Checkout broadcasts table summary
- **WHEN** `checkoutSession()` completes and broadcasts `table.updated`
- **THEN** the payload contains `{ table: TableSummary }` with `status: 'idle'` and zeroed amounts

### Requirement: Ticket created fallback to debounced refetch

The `ticket.created` SSE event SHALL trigger a debounced serving queue refetch (500ms delay) since new ticket items require full data not available in the event payload.

#### Scenario: New ticket triggers debounced refetch
- **WHEN** SSE `ticket.created` event arrives
- **THEN** a serving queue refetch is scheduled after 500ms; multiple events within the window are coalesced into one refetch

### Requirement: Session deleted local cleanup

The `session.deleted` SSE event SHALL trigger local removal of all serving queue items matching the deleted `session_id`, without API refetch.

#### Scenario: Session deleted removes queue items
- **WHEN** SSE `session.deleted` event arrives with `{session_id: 5}`
- **THEN** all items in the serving queue with `session_id=5` are removed locally

### Requirement: Stats and menu events unchanged

The `checkout.completed` and `session.opened` handlers in Stats views, and the `menu.updated` handler in App.vue, SHALL continue using full refetch (these are infrequent operations where incremental update adds complexity without meaningful benefit).

#### Scenario: Stats page refreshes on checkout
- **WHEN** SSE `checkout.completed` event arrives while Stats page is active
- **THEN** the stats dashboard data is fully refreshed via API call

## PBT Properties

### INCREMENTAL_UPDATE_IDEMPOTENT
- **Invariant**: Applying the same SSE `serving.updated` event twice produces the same queue state as applying it once
- **Falsification**: Replay event N times, assert queue state equals single-application state

### TABLE_SUMMARY_COMPLETENESS
- **Invariant**: Every `table.updated` SSE payload contains all fields of `TableSummary` (id, table_no, sort_order, is_enabled, status, session_id, total_cents, dishes, unserved_count)
- **Falsification**: Intercept all broadcast calls, validate payload against TableSummary schema

### DEBOUNCE_COALESCING
- **Invariant**: N `ticket.created` events within 500ms result in exactly 1 API refetch call
- **Falsification**: Fire 10 events in 100ms, count API calls after 600ms, assert == 1

### LOCAL_REMOVAL_CONSISTENCY
- **Invariant**: After `session.deleted` local cleanup, no items with the deleted session_id remain in the queue
- **Falsification**: Generate queue with mixed session_ids, delete one, assert filter completeness
