# Security Spec — weblm-driver v0.1.1-driver-hardening

## Threat Model Boundary

The driver operates within a **single-host, trusted-caller** model. It is not a multi-tenant service. Security boundaries are:

- **Input boundary**: caller-supplied `prompt`, `systemPrompt`, `metadata`
- **Output boundary**: text extracted from the provider DOM
- **Execution boundary**: Playwright-managed Chromium process on the local machine

---

## Input Handling

### Prompt content (`GenerateInput.prompt`)

- Passed **verbatim** to the provider's input box via `page.fill()` (Playwright)
- `page.fill()` does NOT interpret HTML, JavaScript, or CSS — it sets the `value` property of the input element
- No escaping, sanitization, or validation is applied by the driver
- **Callers are responsible** for ensuring prompts are appropriate for the provider's terms of service

### Metadata (`GenerateInput.metadata`)

- Declared as `Readonly<Record<string, unknown>>`
- The driver **never reads, parses, or acts on** metadata fields
- Metadata is echoed unchanged to `GenerateOutput.metadata`
- No serialization to DOM or network occurs

### `systemPrompt`

- Passed to `PromptSubmitter.submit()` as an optional second argument
- Currently **not injected** into the DOM in v0.1.0 (reserved for future implementation)
- Callers should not rely on systemPrompt being honored in this version

---

## Credential and Session Handling

### Browser profile

- `DriverConfig.profileDir` points to a local filesystem directory containing browser cookies and localStorage
- The driver reads this directory via Playwright's `launchPersistentContext()` — it does **not copy, log, or transmit** the profile
- Callers must ensure `profileDir` is stored with appropriate filesystem permissions (0700 recommended)
- The driver does **not** store, cache, or manage credentials itself

### Authentication detection

- Session validity is inferred by DOM element presence (`loginIndicator` CSS selector)
- The driver does **not** extract or log any session token, cookie, or credential value
- If no valid session is detected during `init()`, `AuthenticationRequiredError` is thrown and the browser is not used further

---

## Output Handling

### DOM text extraction

- `page.$eval()` extracts `.textContent` from the output container element
- `textContent` returns plain text — no HTML, no scripts
- The driver does **not** execute `eval()`, `innerHTML`, or `outerHTML` on captured content

### `context` field in errors

- Some error constructors accept a `context?: Record<string, unknown>` parameter for caller-supplied diagnostic data
- The driver's own error construction does **not** populate `context` with DOM content, credentials, or session data

---

## Structured Logging (v0.1.1)

`DriverLogger` emits JSON-Lines records to `stderr` when `logLevel` is set.

**Fields never logged:**
- Full prompt text or model output
- Session cookies or auth tokens
- `profileDir` or any file paths
- Any `GenerateInput.metadata` field except `requestId` (if string-typed)

**Fields logged (when present):**
- `timestamp`, `level`, `event`, `sessionId`, `requestId`, `durationMs`,
  `errorCode`, `recoverable`, `action`, `selectorName`

Log output goes to `stderr` only (via `console.error`). No file logging, no
network transmission, no external sink.

---

## Process Isolation

- The Playwright browser runs as a **child process** of the Node.js runtime
- The browser is launched in a new context (`launchPersistentContext` or `newContext`), providing session isolation between driver instances
- `headless: true` (default) prevents UI rendering — no screen capture surface

---

## OWASP Alignment

| OWASP Top 10 | Status |
|---|---|
| A01 Broken Access Control | N/A — no access control layer (single-host, single-caller) |
| A02 Cryptographic Failures | N/A — no encryption logic; profile security is OS-level |
| A03 Injection | Mitigated — `page.fill()` does not interpret markup; no SQL/cmd |
| A04 Insecure Design | Mitigated — no auth storage, no multi-tenant surface |
| A05 Security Misconfiguration | Caller responsibility for `profileDir` permissions |
| A06 Vulnerable Components | `playwright`, `typescript` — keep updated; `npm audit` in CI |
| A07 Auth & Identity Failures | N/A — driver does not manage identities |
| A08 Software Integrity | No dynamic eval; no remote code execution surface in driver |
| A09 Logging & Monitoring | No credential data in error objects; `context` is caller-supplied |
| A10 SSRF | N/A — only navigates to `providerUrl` set at construction time |

---

## Known Risks

1. **Profile directory exposure** — If `profileDir` is readable by other users, session cookies are exposed. Enforce 0700 permissions.
2. **Prompt injection via generated text** — The driver echoes LLM output as plain text. If a caller re-feeds output as a new prompt without sanitization, prompt injection is possible at the caller level, not the driver level.
3. **`providerUrl` trust** — The driver navigates to whatever `providerUrl` is configured. Ensure it is not user-supplied without validation in the calling layer.
4. **`page.$eval` callback scope** — The callback passed to `$eval` runs in the Node.js process (not in the browser). Current callbacks only call `.textContent` — no user data is passed into the browser context.
