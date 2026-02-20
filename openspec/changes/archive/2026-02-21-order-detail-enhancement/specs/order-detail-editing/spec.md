## ADDED Requirements

### Requirement: Order detail modal displays full ticket data
The system SHALL provide an OrderDetailModal component that fetches complete session data (tickets + items with IDs) via `GET /sessions/:id` when opened, displaying all items grouped by ticket with editable controls.

**PBT Invariant**: `∀ modal open: displayedItems = GET /sessions/:id → tickets.flatMap(t => t.items)`
**Falsification**: Open modal, compare displayed items against API response.

#### Scenario: Modal opens and loads session data
- **WHEN** user opens the detail modal for a session
- **THEN** the system SHALL call `GET /sessions/:sessionId` and display all ticket items with name, quantity, price, and status

#### Scenario: Loading state while fetching data
- **WHEN** the modal is opened and API call is in progress
- **THEN** the system SHALL display a loading indicator until data is received

### Requirement: Modify ticket item quantity
The system SHALL allow users to increase or decrease a ticket item's `qty_ordered` via `PATCH /ticket-items/:id` with `{ qty: N }` (or `{ qty_ordered: N }`).

**Constraints**:
- `qty_ordered` MUST NOT be less than `qty_served + qty_voided`
- The system SHALL NOT modify `ordered_at` (preserving serving queue order)

**PBT Invariant (Bounds)**: `∀ item: qty_ordered ≥ qty_served + qty_voided`
**PBT Invariant (Idempotency)**: `PATCH {qty: N} applied twice → same result as applied once`
**Falsification**: Generate random qty values including boundary (qty_served + qty_voided) and verify constraint holds.

#### Scenario: Increase item quantity
- **WHEN** user increases qty_ordered from 3 to 5 for an item with qty_served=1, qty_voided=0
- **THEN** the system SHALL update qty_ordered to 5 and the serving queue SHALL show 4 pending

#### Scenario: Decrease item quantity to minimum
- **WHEN** user decreases qty_ordered for an item with qty_served=2, qty_voided=1
- **THEN** the minimum allowed qty_ordered SHALL be 3 (= 2 + 1)

#### Scenario: Reject quantity below minimum
- **WHEN** user attempts to set qty_ordered below qty_served + qty_voided
- **THEN** the system SHALL return 409 INVALID_QTY error

#### Scenario: Concurrent modification detected
- **WHEN** two clients modify the same item simultaneously
- **THEN** the system SHALL return 409 CONCURRENT_MODIFICATION for the losing request

### Requirement: Delete single dish item via void
The system SHALL allow users to delete a single dish by voiding all pending quantity via `PATCH /ticket-items/:id` with `{ void_qty: pending }` where `pending = qty_ordered - qty_served - qty_voided`.

**PBT Invariant**: `∀ item after void: qty_ordered = qty_served + qty_voided (pending = 0)`
**Falsification**: Void item, verify pending quantity is exactly 0.

#### Scenario: Void all pending quantity for an item
- **WHEN** user deletes a dish item with qty_ordered=5, qty_served=2, qty_voided=0
- **THEN** the system SHALL send `{ void_qty: 3 }` and the item SHALL have pending=0

#### Scenario: Cannot void item with no pending quantity
- **WHEN** user attempts to delete an item where qty_ordered = qty_served + qty_voided
- **THEN** the system SHALL return 409 NO_PENDING_QTY error

### Requirement: OrderDetailModal is a reusable component
The system SHALL implement the detail modal as an independent `OrderDetailModal.vue` component with the following interface:

**Props**: `show: boolean`, `sessionId: number`, `tableNo: string`, `readonly?: boolean`
**Emits**: `update:show`, `session-deleted`, `item-updated`

Both TableCard.vue and Checkout.vue SHALL use this component.

**PBT Invariant (Round-trip)**: `open modal → close modal → open modal → same data displayed`

#### Scenario: TableCard uses OrderDetailModal
- **WHEN** user clicks "查看详情" on a TableCard
- **THEN** the OrderDetailModal SHALL open with the correct sessionId and tableNo

#### Scenario: Checkout page uses OrderDetailModal
- **WHEN** user clicks "查看详情" on the Checkout page
- **THEN** the same OrderDetailModal SHALL open with the current session data

#### Scenario: Readonly mode for closed sessions
- **WHEN** the modal is opened with `readonly=true`
- **THEN** all edit controls (quantity stepper, delete buttons) SHALL be hidden
