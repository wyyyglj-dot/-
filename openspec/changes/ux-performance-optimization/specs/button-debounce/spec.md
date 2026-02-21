# button-debounce: 操作按钮防重复点击

## ADDED Requirements

### Requirement: Optimistic removal prevents duplicate serve

The serving queue "已上菜" button SHALL be naturally protected from double-click by the optimistic removal mechanism: once clicked, the item is immediately removed from the DOM, making a second click impossible.

#### Scenario: Serve button disappears on click
- **WHEN** user clicks "已上菜" on a serving queue item
- **THEN** the item is removed from the list immediately, preventing any subsequent click on the same item

### Requirement: Action lock composable for non-optimistic buttons

The system SHALL provide a `useActionLock()` Vue composable that returns `{ locked: Ref<boolean>, execute: (fn: () => Promise<void>) => Promise<void> }`. While `locked` is true, the button SHALL be disabled (no loading spinner). The lock releases when the async operation completes or fails.

#### Scenario: Unserve button locked during operation
- **WHEN** user clicks "恢复" button on a served item
- **THEN** the button becomes disabled immediately, the API call executes, and the button re-enables after completion

#### Scenario: Double-click on locked button
- **WHEN** user clicks "恢复" button twice rapidly
- **THEN** only one API request is sent; the second click is ignored due to disabled state

#### Scenario: Checkout button locked during operation
- **WHEN** user clicks "结账" button in Checkout view
- **THEN** the button becomes disabled, checkout API executes, button re-enables on completion or failure

#### Scenario: Submit order button locked during operation
- **WHEN** user clicks "提交订单" in MobileOrdering view
- **THEN** the button becomes disabled until the order submission completes

### Requirement: No global loading overlay

The system SHALL NOT display any global loading overlay or full-screen spinner for button operations. All loading feedback SHALL be button-level only (disabled state).

#### Scenario: No overlay during serve
- **WHEN** any operation button is clicked
- **THEN** no full-screen or section-level loading overlay appears

## PBT Properties

### ACTION_LOCK_MUTUAL_EXCLUSION
- **Invariant**: While `locked` is true, calling `execute()` again is a no-op (returns immediately without invoking the function)
- **Falsification**: Call execute() twice concurrently, count function invocations, assert == 1

### ACTION_LOCK_ALWAYS_RELEASES
- **Invariant**: After execute() resolves or rejects, `locked` is always false
- **Falsification**: Generate random async functions (some throw, some resolve), assert locked == false after each
