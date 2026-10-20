# Security policy

## Supported versions

Security fixes apply to the latest released version of Lexicon. Older versions do not receive backports.

## Report a vulnerability

Do not file a public GitHub issue for a security problem.

Use GitHub private vulnerability reporting on this repository:

https://github.com/AashishH15/Lexicon/security/advisories/new

Include:

- The affected component (desktop app, local daemon, Chrome extension, or Firefox extension)
- The Lexicon version or git commit
- Steps to reproduce
- The impact (for example: token theft, local file read, or remote code execution)

Do not include user documents, API keys, or other secrets in the report.

You should receive an acknowledgement. If the report is valid, a fix will ship in a release and a GitHub Security Advisory will be published when it is safe to do so.

## Scope

Lexicon is local-first. Reports that matter most:

- Bypass of loopback authentication or CORS origin checks
- Leak of document text, API keys, or the daemon bearer token
- Path traversal or XXE in DOCX, EPUB, or zip import
- Cross-site scripting in extension UI injected into web pages
- Remote code execution in the desktop shell or sidecar processes

Out of scope:

- Issues that require physical access to an unlocked machine
- Denial of service against the local daemon from the same user
- Findings that need a user to install a malicious browser extension or unsigned binary
