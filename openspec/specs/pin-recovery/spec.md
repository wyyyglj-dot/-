# pin-recovery: PIN 码恢复能力

## 概述

通过安全问题验证后重置 PIN，确保用户忘记 PIN 时能恢复访问。

## 需求

### REQ-RECOVERY-001: 安全问题设置

- 在 PIN 初始设置时同步设置（REQ-AUTH-001 的一部分）
- 用户自定义安全问题（自由文本，1-200 字符）
- 安全答案使用 scrypt 哈希存储（参数同 PIN：N=32768, r=8, p=1, dkLen=64）
- 答案验证大小写不敏感：验证前统一 `toLowerCase()` 再哈希比对

### REQ-RECOVERY-002: PIN 恢复流程

- 端点：`POST /api/v1/auth/recover` body: `{ answer: string, newPin: string }`
- 流程：验证安全答案 → 更新 PIN hash → 撤销所有现有会话 → 返回新 token
- 安全答案验证失败：返回 401，通用消息 "验证失败"
- 新 PIN 必须满足 REQ-AUTH-001 的格式和强度要求
- 整个恢复操作在单个 DB 事务中完成

### REQ-RECOVERY-003: 恢复后状态

- 所有现有会话被撤销（`revoked_at = datetime('now')`）
- 创建新会话并返回 token（用户无需再次登录）
- `admin_pin` 行更新：新 PIN hash + 新 salt + `updated_at`
- 安全问题和答案保持不变（恢复不修改安全问题）

## PBT 属性

### ROUNDTRIP_SECURITY_ANSWER_CASE_INSENSITIVE
- **不变量**: 答案 `a` 的任意大小写变体验证通过，内容不同（编辑距离≥1 排除纯大小写变化）的答案验证失败
- **伪造策略**: 随机字母答案 + 随机大小写变换验证通过；内容变异后验证失败

### INVARIANT_RECOVERY_REVOKES_ALL_SESSIONS
- **不变量**: 恢复成功后，所有先前会话无效，仅新创建的会话有效
- **伪造策略**: 创建 k 个会话，执行恢复，探测所有旧 token 均被拒绝

### IDEMPOTENCY_RECOVERY_RETRY
- **不变量**: 重复恢复调用（相同答案+新PIN）不会产生不一致状态
- **伪造策略**: 并发恢复调用后断言 `admin_pin` 仍为 1 行，会话状态一致
