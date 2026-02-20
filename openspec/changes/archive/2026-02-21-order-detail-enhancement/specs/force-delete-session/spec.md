## ADDED Requirements

### Requirement: Force delete session with cascading hard delete
The system SHALL provide `DELETE /sessions/:sessionId/force` API that physically deletes a session and ALL associated data (payment, ticket items, tickets, session record) in a single atomic transaction.

**Constraints**:
- SHALL work for ANY session status (DINING, PENDING_CHECKOUT, CLOSED)
- Delete order MUST be: payment → order_ticket_item → order_ticket → table_session (FK-safe)
- Table SHALL revert to idle state after deletion
- SSE events SHALL be emitted ONLY after successful DB commit

**PBT Invariant (Completeness)**: `∀ force_delete(session_id): SELECT COUNT(*) FROM order_ticket_item WHERE ticket_id IN (SELECT id FROM order_ticket WHERE session_id=?) = 0 ∧ SELECT COUNT(*) FROM order_ticket WHERE session_id=? = 0 ∧ SELECT COUNT(*) FROM payment WHERE session_id=? = 0 ∧ SELECT COUNT(*) FROM table_session WHERE id=? = 0`
**PBT Invariant (Idempotency)**: `force_delete(id) → 200; force_delete(id) → 404`
**PBT Invariant (Table State)**: `∀ force_delete: table.active_session = NULL (idle)`
**Falsification**: Create session with tickets/items/payment, force delete, verify zero residual records.

#### Scenario: Force delete DINING session with orders
- **WHEN** user force-deletes a DINING session that has 2 tickets with 5 items total
- **THEN** all 5 items, 2 tickets, and the session SHALL be physically deleted
- **AND** the table SHALL have no active session (idle)
- **AND** SSE SHALL broadcast `session.deleted` and `table.updated` events

#### Scenario: Force delete CLOSED session with payment
- **WHEN** user force-deletes a CLOSED session that has a payment record
- **THEN** the payment, all items, all tickets, and the session SHALL be physically deleted
- **AND** the table SHALL revert to idle

#### Scenario: Force delete non-existent session
- **WHEN** user attempts to force-delete a session that does not exist
- **THEN** the system SHALL return 404 Not Found

#### Scenario: Concurrent serve during force delete
- **WHEN** a serve operation is in progress while force delete executes
- **THEN** the force delete transaction SHALL be authoritative (atomic)
- **AND** the serve operation SHALL receive NOT_FOUND or CONCURRENT_MODIFICATION error

### Requirement: Frontend confirmation for force delete
The system SHALL display a confirmation dialog before executing force delete with the message: "将删除所有数据（含结账记录），不可恢复。确认删除？"

#### Scenario: User confirms deletion
- **WHEN** user clicks "删除订单" and confirms in the dialog
- **THEN** the system SHALL call `DELETE /sessions/:id/force` and close the modal

#### Scenario: User cancels deletion
- **WHEN** user clicks "删除订单" but cancels in the dialog
- **THEN** no API call SHALL be made and the modal SHALL remain open

### Requirement: SSE session.deleted event
The system SHALL broadcast a `session.deleted` SSE event after successful force deletion.

**Payload**: `{ session_id: number, table_id: number }`

**PBT Invariant (Ordering)**: `session.deleted event timestamp > DB commit timestamp`

#### Scenario: Serving page receives session.deleted
- **WHEN** a session is force-deleted
- **THEN** the Serving page SHALL remove all queue items belonging to that session

#### Scenario: TableMap receives session.deleted
- **WHEN** a session is force-deleted
- **THEN** the TableMap/MobileHome SHALL refresh the affected table to show idle status
