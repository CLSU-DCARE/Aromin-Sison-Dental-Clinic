## [ERR-20260924-001] In-app browser unavailable

**Priority**: low
**Status**: pending
**Area**: tools

### Summary
The in-app browser could not be selected for visual dashboard verification.

### Error information
```
Browser is not available: iab
```

### Recommended resolution
Use CSS cascade checks when no in-app browser is attached, then repeat visual verification in a session with a browser preview available.

### Metadata
- Reproducible: environment-dependent

## [ERR-20260924-002] Docker CLI unavailable

**Priority**: low
**Status**: pending
**Area**: tools

### Summary
The local workspace cannot build the Railway Docker image because Docker is not installed.

### Error information
```
docker : The term 'docker' is not recognized as the name of a cmdlet
```

### Recommended resolution
Validate Docker builds in CI, Railway, or a development environment with Docker Desktop installed.

### Metadata
- Reproducible: environment-dependent

## [ERR-20260924-003] Git index write denied by workspace sandbox

**Priority**: low
**Status**: pending
**Area**: tools

### Summary
Git staging cannot run in the filesystem sandbox because it may not create `.git/index.lock`.

### Error information
```
fatal: Unable to create '.git/index.lock': Permission denied
```

### Recommended resolution
Run the scoped Git staging and commit command with the workspace's approved elevated permission.

### Metadata
- Reproducible: environment-dependent
