#!/usr/bin/env node
/**
 * I2-B1: all executable host probes are DISABLED pending independent Windows
 * launcher identity, PS5.1 parse, and script-path trust review.
 *
 * Intentionally no child_process/fs/net imports, process spawn or raw env
 * logging. This file can only refuse, including --read-only-inventory.
 * An offline Windows PowerShell AST parse-only gate is separate.
 */
process.stderr.write(
  "I2-B1 host inventory execution DISABLED pending independent security review. " +
  "No PowerShell, PostgreSQL or SQL executed. RLS NOT RUN.\n"
);
process.exitCode=1;
