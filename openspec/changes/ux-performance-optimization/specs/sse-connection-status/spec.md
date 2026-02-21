# sse-connection-status: SSE 连接状态指示器

## ADDED Requirements

### Requirement: Reactive SSE connection status

The `SSEClient` class SHALL expose a reactive `status` property of type `'connected' | 'reconnecting'`. Status SHALL be `'connected'` when EventSource is open and receiving data, and `'reconnecting'` when the connection is closed and a reconnect is pending or in progress.

#### Scenario: Initial connection succeeds
- **WHEN** SSEClient.connect() is called and EventSource opens successfully
- **THEN** status transitions to `'connected'`

#### Scenario: Connection drops
- **WHEN** EventSource fires onerror event
- **THEN** status transitions to `'reconnecting'` immediately

#### Scenario: Reconnection succeeds
- **WHEN** SSEClient reconnects after a drop and EventSource opens
- **THEN** status transitions back to `'connected'`

### Requirement: Status indicator in mobile navigation

The `MobileNav` component SHALL display a small colored dot (8px diameter) next to the app title or in the navigation bar. Green (`#22c55e`) for `connected`, red (`#ef4444`) for `reconnecting`. The dot SHALL have a subtle pulse animation when reconnecting.

#### Scenario: Green dot when connected
- **WHEN** SSE status is `'connected'`
- **THEN** MobileNav displays a green dot indicator

#### Scenario: Red pulsing dot when reconnecting
- **WHEN** SSE status is `'reconnecting'`
- **THEN** MobileNav displays a red dot with CSS pulse animation

### Requirement: Status indicator in PC sidebar

The `AppSidebar` component SHALL display the same colored dot indicator as MobileNav, positioned near the bottom of the sidebar or next to a "连接状态" label.

#### Scenario: Sidebar shows connection status
- **WHEN** SSE status changes
- **THEN** AppSidebar dot color updates to match current status

### Requirement: Auto-refresh on reconnection

When SSE status transitions from `'reconnecting'` to `'connected'`, the system SHALL trigger a full data refresh for the currently active page to ensure data consistency after the connection gap.

#### Scenario: Reconnection triggers data sync
- **WHEN** SSE reconnects successfully (status: reconnecting → connected)
- **THEN** the current page's data fetching functions are called (e.g., fetchServingQueue for Serving page, fetchTables for TableMap)

### Requirement: Infinite reconnection strategy

The SSEClient SHALL always attempt to reconnect (no maximum retry limit). Reconnection interval SHALL remain at 3 seconds. Status alternates between `'reconnecting'` and `'connected'` indefinitely.

#### Scenario: Persistent reconnection
- **WHEN** SSE connection fails 100 times consecutively
- **THEN** the client continues attempting reconnection every 3 seconds, status remains `'reconnecting'`

## PBT Properties

### STATUS_BINARY_STATE
- **Invariant**: SSEClient.status is always exactly `'connected'` or `'reconnecting'`, never undefined or any other value
- **Falsification**: Generate random connect/disconnect sequences, assert status is always one of two values

### RECONNECT_TRIGGERS_REFRESH
- **Invariant**: Every transition from `'reconnecting'` to `'connected'` triggers exactly one data refresh
- **Falsification**: Simulate N reconnection cycles, count refresh calls, assert == N

### STATUS_REFLECTS_EVENTSOURCE
- **Invariant**: status == 'connected' iff EventSource.readyState == OPEN
- **Falsification**: At any point, compare SSEClient.status with underlying EventSource.readyState
