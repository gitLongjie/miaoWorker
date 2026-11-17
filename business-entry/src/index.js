/**
 * Host loader entry for the browser-only business-entry plugin.
 *
 * Keep this Host `apply` empty on the Desktop root-plane overlay: any
 * package-level or nested `inject: ['connection']` here waits for a service
 * provided deeper in the web profile and hangs packaged smoke before a
 * verdict is written (Desktop publish #21–#23). Workbench Fetch routes that
 * call `dsh-video-downloader` must mount under a connection-scoped Loader
 * row, not this overlay insert.
 */

/** Provides no host-side behavior on the root overlay. */
export function apply() {}
