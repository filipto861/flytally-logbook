/** Type-only contract for the adjacent ESM inventory validator.
 * No runtime imports, database connections or schema mutations.
 */
export type PostgresPartitionRegistryValidation = Readonly<{
  status: "PASS";
  files: number;
  tests: number;
  partitions: number;
  registrySha256: string;
  note: string;
}>;
export function validatePostgresPartitionRegistry(options?: Readonly<{
  registryPath?: string;
  directory?: string;
}>): PostgresPartitionRegistryValidation;
