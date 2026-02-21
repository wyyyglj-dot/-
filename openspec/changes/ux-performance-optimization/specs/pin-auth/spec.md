# pin-auth: Delta Spec for Security Settings + Token Cache

## ADDED Requirements

### Requirement: Change PIN API

The system SHALL provide `POST /api/v1/auth/change-pin` (authenticated) accepting `{ current_pin: string, new_pin: string }`. It SHALL verify `current_pin` via scrypt, validate `new_pin` (6-digit, not weak), hash with new random salt, update `admin_pin` row, and revoke all sessions except the current one.

#### Scenario: Successful PIN change
- **WHEN** authenticated user sends `{ current_pin: "123789", new_pin: "456012" }` with valid current PIN
- **THEN** PIN is updated, all other sessions are revoked, current session remains valid, response is `{ ok: true }`

#### Scenario: Wrong current PIN
- **WHEN** user sends `{ current_pin: "000001", new_pin: "456012" }` with incorrect current PIN
- **THEN** response is 401 with error code `INVALID_PIN`, PIN is not changed

#### Scenario: Weak new PIN rejected
- **WHEN** user sends `{ current_pin: "123789", new_pin: "123456" }` where new PIN is in weak list
- **THEN** response is 400 with error code `WEAK_PIN`, PIN is not changed

#### Scenario: Invalid new PIN format
- **WHEN** user sends `{ current_pin: "123789", new_pin: "12345" }` (5 digits)
- **THEN** response is 400 with error code `VALIDATION_ERROR`

### Requirement: Change security question API

The system SHALL provide `POST /api/v1/auth/change-security` (authenticated) accepting `{ current_pin: string, question: string, answer: string }`. It SHALL verify `current_pin`, then update `security_question` and `security_answer_hash` (scrypt) in `admin_pin` row.

#### Scenario: Successful security question change
- **WHEN** authenticated user sends valid `{ current_pin, question: "新问题", answer: "新答案" }`
- **THEN** security question and answer hash are updated, response is `{ ok: true }`

#### Scenario: Wrong PIN for security change
- **WHEN** user sends incorrect `current_pin`
- **THEN** response is 401 with error code `INVALID_PIN`, security question is not changed

#### Scenario: Empty question or answer rejected
- **WHEN** user sends `{ current_pin: "123789", question: "", answer: "答案" }`
- **THEN** response is 400 with error code `VALIDATION_ERROR`

### Requirement: Token validation cache

The auth middleware SHALL cache token validation results in an in-memory `Map<string, { valid: boolean, ts: number }>` keyed by SHA-256 hash. Cache TTL SHALL be 60 seconds. Maximum cache size SHALL be 1000 entries (evict oldest on overflow). Logout SHALL immediately remove the corresponding cache entry.

#### Scenario: Cached token skips DB query
- **WHEN** a token was validated successfully within the last 60 seconds
- **THEN** subsequent requests with the same token use the cached result without DB query

#### Scenario: Cache entry expires after TTL
- **WHEN** a cached token entry is older than 60 seconds
- **THEN** the next validation performs a fresh DB query and updates the cache

#### Scenario: Logout invalidates cache
- **WHEN** user logs out
- **THEN** the token's cache entry is immediately removed, next validation attempt hits DB and fails

#### Scenario: Cache size limit enforced
- **WHEN** cache contains 1000 entries and a new token is validated
- **THEN** the oldest entry (by timestamp) is evicted before inserting the new one

### Requirement: Cache cleanup interval

A `setInterval` (30 seconds) SHALL purge all cache entries where `Date.now() - ts > 60000`. The interval timer SHALL be unref'd to not prevent process exit.

#### Scenario: Periodic cleanup removes expired entries
- **WHEN** the 30-second cleanup interval fires
- **THEN** all entries with `ts` older than 60 seconds are removed from the cache

## MODIFIED Requirements

### Requirement: Change PIN session revocation

PIN 变更时撤销所有其他会话（仅保留当前会话）

- 会话绝对过期：`created_at + 30 天`
- 无空闲超时
- 登出端点：`POST /api/v1/auth/logout`（需认证），撤销当前 token
- 登出幂等：重复登出同一 token 不报错
- PIN 变更时撤销所有其他会话（仅保留当前会话）
- **NEW**: `POST /api/v1/auth/change-pin` 成功后，撤销所有 `token_hash != current_token_hash` 的会话
- **NEW**: Logout 操作 SHALL 同时清除 token 验证缓存中对应的条目

#### Scenario: PIN change revokes other sessions
- **WHEN** user changes PIN successfully from device A
- **THEN** all sessions except device A's current session are revoked (revoked_at set)

#### Scenario: Logout clears token cache
- **WHEN** user calls POST /api/v1/auth/logout
- **THEN** the token's SHA-256 hash is removed from the in-memory validation cache

## PBT Properties

### ROUNDTRIP_CHANGE_PIN
- **Invariant**: After change-pin(old, new), login(new) succeeds and login(old) fails
- **Falsification**: Generate (old, new) pairs, change PIN, verify both login outcomes

### CHANGE_PIN_REVOKES_OTHERS
- **Invariant**: After change-pin, all sessions except the requesting one have revoked_at set
- **Falsification**: Create N sessions, change PIN from session K, assert N-1 sessions revoked

### TOKEN_CACHE_TTL_BOUND
- **Invariant**: A cached entry is never used after 60 seconds from its creation timestamp
- **Falsification**: Insert entry, advance clock by 61s, assert cache miss

### TOKEN_CACHE_SIZE_BOUND
- **Invariant**: Cache size never exceeds 1000 entries
- **Falsification**: Insert 1500 unique tokens, assert cache.size <= 1000

### LOGOUT_CACHE_INVALIDATION
- **Invariant**: After logout, the token immediately fails validation even if within TTL
- **Falsification**: Login, validate (cached), logout, validate again, assert failure
