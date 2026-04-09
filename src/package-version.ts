declare const __PACKAGE_VERSION__: string;

/**
 * Returns the package version injected at build time.
 *
 * @returns Current package version string.
 */
export function getPackageVersion(): string {
  return __PACKAGE_VERSION__;
}
