# Image Generation

English | [中文](image.zh.md)

The image-generation seam — a [capability seam](../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) on one `ctx.image` service. Service Definition ([dsh-image](../../packages/image/image)), Service Provider (the Deepagens gateway route in [dsh-llm-deepagens](../../packages/llm/llm-deepagens) once `imageModel` is set), and Consumer ([dsh-tool-image](../../packages/image/tool-image), the `generate_image` tool). Image is an optional capability outside the agent-loop spine.

Source: [`packages/image/image/src/types.ts`](../../packages/image/image/src/types.ts)

## Request and result

Each call sends one visual description and returns one encoded image. Size, quality, count, and reference-image editing are outside this vocabulary until a consumer and backend need them.

```ts type-equiv
/** What one image-generation backend is asked to draw. Each request produces one image. */
interface ImageGenerationRequest {
  /** The visual description sent to the backend unchanged. */
  readonly prompt: string
}
```

```ts type-equiv
/**
 * One generated image. `mediaType` is the type the provider detected from the bytes; consumers
 * that persist the image validate it against their own accepted types.
 */
interface GeneratedImage {
  /** Encoded image bytes. */
  readonly data: Uint8Array
  /** IANA media type of `data`, for example `image/png`. */
  readonly mediaType: string
  /** The backend model that produced the image, when the provider knows it. */
  readonly model?: string
}
```

## Provider protocol

Providers register by id. Selection calls `available()` without network access; only the selected provider runs `generate()`. Duplicate ids fail at registration. At execution time, a configured id that is registered and usable wins; without a configured id, exactly one usable provider is required.

```ts type-equiv
/**
 * One image-generation backend. The registry key is `id`; selection calls `available()`
 * without network access and `generate()` only on the selected provider.
 */
interface ImageGenerationProvider {
  readonly id: string
  /** Cheap local usability check, such as whether a model is configured; must not make network calls. */
  available(): boolean
  /**
   * Generate one image; honor `signal` for cancellation.
   * @param request - the visual description.
   * @param signal - cancellation for the backend request.
   * @returns the encoded image bytes and their media type.
   */
  generate(request: ImageGenerationRequest, signal?: AbortSignal): Promise<GeneratedImage>
}
```

## Errors

```ts type-equiv
/**
 * Structured failure codes of the image seam and its providers.
 * - `IMAGE_DUPLICATE_PROVIDER`: a provider id is already registered.
 * - `IMAGE_PROVIDER_CONFIGURED_MISSING`: the configured provider id is not registered.
 * - `IMAGE_PROVIDER_CONFIGURED_UNAVAILABLE`: the configured provider is registered but unusable.
 * - `IMAGE_PROVIDER_UNAVAILABLE`: no provider is configured and none is usable.
 * - `IMAGE_PROVIDER_AMBIGUOUS`: no provider is configured and several are usable.
 */
type ImageErrorCode =
  | 'IMAGE_DUPLICATE_PROVIDER'
  | 'IMAGE_PROVIDER_CONFIGURED_MISSING'
  | 'IMAGE_PROVIDER_CONFIGURED_UNAVAILABLE'
  | 'IMAGE_PROVIDER_UNAVAILABLE'
  | 'IMAGE_PROVIDER_AMBIGUOUS'
```

```ts type-equiv
/** Structured failure from the image seam; `code` is one of {@link ImageErrorCode}. */
class ImageError extends HarnessError {
  declare readonly code: ImageErrorCode
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctximage--imageruntime"></a>

### `ctx.image` — `ImageRuntime`

The image-generation service, registered as `ctx.image`.

Selection semantics (resolved at execution time, never order-dependent):

- A configured id that is registered and `available()` → that provider.
- A configured id not registered → `IMAGE_PROVIDER_CONFIGURED_MISSING`.
- A configured id registered but unavailable → `IMAGE_PROVIDER_CONFIGURED_UNAVAILABLE`.
- No id configured, exactly one usable provider → that provider.
- No id configured, several usable providers → `IMAGE_PROVIDER_AMBIGUOUS`.
- No id configured, no usable provider → `IMAGE_PROVIDER_UNAVAILABLE`.

```ts cordis-catalog
/**
 * Register an image provider. Throws {@link ImageError} `IMAGE_DUPLICATE_PROVIDER` if its id is
 * already registered. The registration is disposed with the calling fiber.
 * @param provider - the provider; its `id` is the registry key.
 * @returns the disposer that unregisters the provider.
 */
register(provider: ImageGenerationProvider): () => void

/**
 * Generate one image through the selected provider. Throws {@link ImageError} when no provider
 * can run; provider failures propagate unchanged.
 * @param request - the visual description.
 * @param signal - cancellation forwarded to the provider.
 * @returns the encoded image bytes and their media type.
 */
async generate(request: ImageGenerationRequest, signal?: AbortSignal): Promise<GeneratedImage>
```

Source: [`packages/image/image/src/index.ts`](../../packages/image/image/src/index.ts)
<!-- END GENERATED cordis-surface -->
