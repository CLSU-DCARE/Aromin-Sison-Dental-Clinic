<?php
// Deprecated to prevent provisioning extra receptionist login accounts.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
fwrite(STDERR, "Use database/bootstrap_staff.php to provision the two shared staff accounts.\n");
exit(1);
