-- Prevent race condition: only one non-CLOSED session per table
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_per_table
  ON table_session (table_id)
  WHERE status <> 'CLOSED';
