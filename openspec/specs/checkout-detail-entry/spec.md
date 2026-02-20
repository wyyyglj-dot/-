## ADDED Requirements

### Requirement: Checkout page displays detail entry button
The system SHALL add a "查看详情" button to the Checkout page that opens the OrderDetailModal component with the current session data.

**Constraints**:
- Button placement: below the payment amount display, above payment method selection
- SHALL reuse the same OrderDetailModal component used by TableCard
- Modal SHALL open in editable mode (not readonly) since session is PENDING_CHECKOUT

#### Scenario: View details from checkout page
- **WHEN** user clicks "查看详情" on the Checkout page
- **THEN** the OrderDetailModal SHALL open showing all ticket items for the current session

#### Scenario: Edit items from checkout page triggers auto-revert
- **WHEN** user modifies an item via the detail modal on the Checkout page
- **THEN** the session SHALL revert to DINING (per R4)
- **AND** the Checkout page SHALL detect the status change and navigate back or show updated state

#### Scenario: Delete order from checkout page
- **WHEN** user force-deletes the session via the detail modal on the Checkout page
- **THEN** the Checkout page SHALL navigate back to the table map (session no longer exists)

### Requirement: Checkout page reacts to session state changes
The system SHALL handle the case where the session is modified or deleted while the Checkout page is open.

**PBT Invariant (Consistency)**: `∀ checkout page: displayed amount = GET /sessions/:id → total_cents at render time`

#### Scenario: Session reverted to DINING while on checkout page
- **WHEN** another client modifies the order (causing revert to DINING) while Checkout page is open
- **THEN** the Checkout page SHALL receive SSE `table.updated` event and refresh session data or redirect

#### Scenario: Session force-deleted while on checkout page
- **WHEN** another client force-deletes the session while Checkout page is open
- **THEN** the Checkout page SHALL receive SSE `session.deleted` event and navigate to table map
