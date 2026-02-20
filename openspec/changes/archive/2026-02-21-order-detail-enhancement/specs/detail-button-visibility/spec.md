## ADDED Requirements

### Requirement: Detail button visible when dishes exist
The system SHALL display the "查看详情" button on TableCard whenever the table has at least 1 dish item, regardless of dish count.

**Current behavior**: Button only shows when `dishes.length > 3`.
**New behavior**: Button shows when `dishes.length > 0`.

**PBT Invariant**: `∀ table: table.status ≠ 'idle' ∧ table.dishes.length ≥ 1 → detailButtonVisible(table) = true`
**Falsification**: Generate tables with dishes.length ∈ {1, 2, 3} and verify button is visible.

#### Scenario: Table with 1 dish shows detail button
- **WHEN** a table has exactly 1 dish item
- **THEN** the "查看详情" button SHALL be visible

#### Scenario: Table with 3 dishes shows detail button
- **WHEN** a table has exactly 3 dish items (previously hidden threshold)
- **THEN** the "查看详情" button SHALL be visible

#### Scenario: Idle table never shows detail button
- **WHEN** a table has status 'idle' (no active session)
- **THEN** the "查看详情" button SHALL NOT be visible regardless of any data
