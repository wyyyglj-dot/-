# response-compression: 后端响应压缩

## ADDED Requirements

### Requirement: Gzip/Brotli response compression

The Express server SHALL use the `compression` npm middleware to compress HTTP responses. Compression SHALL apply to responses larger than 1KB (1024 bytes). Supported encodings: gzip and deflate (brotli if supported by the compression package version).

#### Scenario: Large JSON response is compressed
- **WHEN** an API endpoint returns a JSON response > 1KB and the client sends `Accept-Encoding: gzip`
- **THEN** the response includes `Content-Encoding: gzip` header and the body is compressed

#### Scenario: Small response is not compressed
- **WHEN** an API endpoint returns a response <= 1KB
- **THEN** the response is sent uncompressed (no Content-Encoding header)

### Requirement: SSE routes excluded from compression

The SSE endpoint (`/api/v1/events`) SHALL NOT be compressed. The compression middleware SHALL use a filter function that returns `false` for requests where `req.headers.accept === 'text/event-stream'` or the route path matches the SSE endpoint.

#### Scenario: SSE connection not compressed
- **WHEN** a client connects to `/api/v1/events` for SSE
- **THEN** the response is streamed without compression, no Content-Encoding header

### Requirement: Middleware placement

The compression middleware SHALL be registered BEFORE route handlers but AFTER the SSE route registration, OR use a filter function to skip SSE. The filter approach is preferred for clarity.

#### Scenario: Compression active for all non-SSE routes
- **WHEN** any non-SSE API request is made with Accept-Encoding header
- **THEN** compression is applied if response exceeds threshold

## PBT Properties

### COMPRESSION_THRESHOLD_BOUND
- **Invariant**: Responses <= 1024 bytes are never compressed; responses > 1024 bytes with Accept-Encoding are always compressed
- **Falsification**: Generate responses of varying sizes, check Content-Encoding header presence

### SSE_NEVER_COMPRESSED
- **Invariant**: SSE endpoint responses never have Content-Encoding header regardless of Accept-Encoding
- **Falsification**: Connect to SSE with various Accept-Encoding values, assert no Content-Encoding in response
