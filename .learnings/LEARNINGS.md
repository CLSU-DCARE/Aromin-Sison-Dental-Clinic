## [LRN-20260924-001] Deployment volume mount obscures image upload protections

**Priority**: medium
**Status**: resolved
**Area**: infra

### Content
A container volume mounted over an application's upload directory hides any
`.htaccess` files shipped below that directory. Protect private upload paths
and runtime-only session storage in Apache's virtual-host configuration, not
only with files inside the mounted directory.

### Recommended fix
Add explicit server-level deny rules for private and hidden upload paths before
mounting persistent storage over the directory.

### Metadata
- Source: task_review
- Pattern-Key: mounted-directory-security

---
