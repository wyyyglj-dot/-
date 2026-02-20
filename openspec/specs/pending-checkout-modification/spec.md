## ADDED Requirements

### Requirement: Allow ticket item modification in PENDING_CHECKOUT status
The system SHALL allow `PATCH /ticket-items/:id` to succeed when the session is in PENDING_CHECKOUT status, automatically reverting the session to DINING within the same DB transaction.

**Constraints**:
- Revert + mutation MUST be atomic (single DB transaction)
- If mutation fails (validation/concurrency), session status MUST remain PENDING_CHECKOUT (rollback)
- All existing quantity validation rules SHALL still apply

**PBT Invariant (Atomicity)**: `∀ patch in PENDING_CHECKOUT: (revert + mutation succeed together) ∨ (both rollback, status stays PENDING_CHECKOUT)`
**PBT Invariant (State Transition)**: `∀ successful patch from PENDING_CHECKOUT: session.status = 'DINING'`
**Falsification**: Patch with invalid qty from PENDING_CHECKOUT, verify status unchanged.

#### Scenario: Modify item quantity in PENDING_CHECKOUT
- **WHEN** user modifies an item's qty_ordered while session is PENDING_CHECKOUT
- **THEN** the session SHALL revert to DINING and the item SHALL be updated
- **AND** SSE SHALL broadcast `table.updated` with `status: 'dining'`

#### Scenario: Failed modification preserves PENDING_CHECKOUT
- **WHEN** user attempts an invalid modification (qty below minimum) while PENDING_CHECKOUT
- **THEN** the session SHALL remain in PENDING_CHECKOUT status
- **AND** the system SHALL return the appropriate error (409 INVALID_QTY)

#### Scenario: Reject modification for CLOSED sessions
- **WHEN** user attempts to modify an item in a CLOSED session
- **THEN** the system SHALL return 409 SESSION_CLOSED error

### Requirement: Allow ticket creation in PENDING_CHECKOUT status
The system SHALL allow `POST /sessions/:id/tickets` to succeed when the session is in PENDING_CHECKOUT status, automatically reverting the session to DINING within the same DB transaction.

**PBT Invariant (Atomicity)**: Same as ticket item modification — atomic revert + create.

#### Scenario: Create ticket in PENDING_CHECKOUT
- **WHEN** user submits a new ticket (加菜) while session is PENDING_CHECKOUT
- **THEN** the session SHALL revert to DINING and the ticket SHALL be created
- **AND** SSE SHALL broadcast `ticket.created` and `table.updated`

#### Scenario: Failed ticket creation preserves PENDING_CHECKOUT
- **WHEN** user submits an invalid ticket (empty items) while PENDING_CHECKOUT
- **THEN** the session SHALL remain in PENDING_CHECKOUT status

### Requirement: Hardened checkout precondition
The system SHALL enforce `session.status = 'PENDING_CHECKOUT'` as a precondition in the checkout transaction. If the session has been reverted to DINING (by auto-revert), checkout SHALL fail with 409.

**PBT Invariant (Mutual Exclusion)**: `∀ t: ¬(checkout(session) succeeds ∧ session.status = 'DINING' at commit time)`
**Falsification**: Revert session to DINING, attempt checkout, verify 409.

#### Scenario: Checkout succeeds from PENDING_CHECKOUT
- **WHEN** session is in PENDING_CHECKOUT and user initiates checkout
- **THEN** checkout SHALL succeed normally

#### Scenario: Checkout fails after auto-revert
- **WHEN** session was reverted to DINING (by another client's modification) and user initiates checkout
- **THEN** the system SHALL return 409 with code `SESSION_NOT_PENDING_CHECKOUT`
- **AND** the frontend SHALL display "订单已被修改，请重新确认"

#### Scenario: Race between checkout and modification
- **WHEN** client A modifies an item (triggering revert) while client B submits checkout simultaneously
- **THEN** exactly one SHALL succeed: either the modification (session → DINING, checkout fails) or the checkout (session → CLOSED, modification fails on CLOSED check)

### Requirement: Backend API parameter backward compatibility
The system SHALL accept both `qty`/`void_qty` (legacy) and `qty_ordered`/`qty_voided` (new) parameter names in `PATCH /ticket-items/:id`, with new names taking priority.

**Mapping**: `qty = body.qty ?? body.qty_ordered`, `void_qty = body.void_qty ?? body.qty_voided`

**PBT Invariant (Equivalence)**: `PATCH {qty: 5} ≡ PATCH {qty_ordered: 5}` (same result)
**Falsification**: Send both naming variants with same value, verify identical outcomes.

#### Scenario: Legacy parameter names work
- **WHEN** client sends `{ qty: 5 }` to PATCH /ticket-items/:id
- **THEN** the system SHALL update qty_ordered to 5

#### Scenario: New parameter names work
- **WHEN** client sends `{ qty_ordered: 5 }` to PATCH /ticket-items/:id
- **THEN** the system SHALL update qty_ordered to 5

#### Scenario: New names take priority over legacy
- **WHEN** client sends `{ qty: 3, qty_ordered: 5 }` to PATCH /ticket-items/:id
- **THEN** the system SHALL use qty_ordered=5 (new name priority)
