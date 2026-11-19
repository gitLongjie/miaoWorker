/** Type declarations for the packaged-smoke harness. */

/**
 * Delete the outside-repo smoke copy. A locked directory is reported and left in place.
 * @param copyRoot - the temporary app copy.
 * @param remove - directory removal; tests pass a stand-in.
 */
export function removeSmokeCopy(copyRoot: string, remove?: (copyRoot: string) => void): void
