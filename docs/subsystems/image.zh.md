# 图片生成

[English](image.md) | 中文

图片生成能力缝——在同一个 `ctx.image` 服务上的[能力缝](../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.zh.md)。服务定义（[dsh-image](../../packages/image/image)）、服务提供方（[dsh-llm-deepagens](../../packages/llm/llm-deepagens) 中的 Deepagens 网关路由，在设置了 `imageModel` 后可用）、以及消费者（[dsh-tool-image](../../packages/image/tool-image)，即 `generate_image` 工具）。图片生成是 agent-loop 主轴之外的可选能力。

来源：[`packages/image/image/src/types.ts`](../../packages/image/image/src/types.ts)

## 请求与结果

每次调用发送一条视觉描述，返回一张编码后的图片。尺寸、质量、数量与参考图编辑在本词汇之外，直到有消费者与后端需要它们。

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

## 提供方协议

提供方按 id 注册。选择时调用 `available()` 且不做网络访问；只有被选中的提供方会运行 `generate()`。重复 id 在注册时失败。执行时，已配置且已注册可用的 id 优先；未配置 id 时，必须恰好有一个可用提供方。

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

## 错误

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

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
