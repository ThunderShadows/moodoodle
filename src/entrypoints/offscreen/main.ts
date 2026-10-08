// Hidden extension page that runs the on-device image model (service workers can't load the ONNX runtime).
import { browser } from 'wxt/browser';
import { env, pipeline, RawImage } from '@huggingface/transformers';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import { openImageStore } from '@/lib/db';
import { clsEmbedding } from '@/lib/embedder';
import type { OffscreenMessage } from '@/lib/types';

// Everything is bundled: no model or runtime is ever fetched from the internet.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = browser.runtime.getURL('/models/' as '/offscreen.html');
env.backends.onnx.wasm!.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };
env.backends.onnx.wasm!.numThreads = 1;

const store = openImageStore();
type Extractor = (image: RawImage) => Promise<{ dims: number[]; data: Float32Array }>;
let extractor: Promise<Extractor> | undefined;

function model(): Promise<Extractor> {
  extractor ??= pipeline('image-feature-extraction', 'Xenova/dinov2-small', { dtype: 'q8', device: 'wasm' }) as unknown as Promise<Extractor>;
  return extractor;
}

async function embed(image: RawImage): Promise<Float32Array> {
  return clsEmbedding(await (await model())(image));
}

browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  const msg = raw as OffscreenMessage;
  if (msg?.target !== 'offscreen') return false;
  (async () => {
    if (msg.type === 'embed-image') {
      const kept = (await store.list()).find((i) => i.id === msg.id);
      if (kept?.credit.noAI) return { ok: true }; // never store a fingerprint for NoAI images
      const blob = await store.getThumb(msg.id);
      if (!blob) throw new Error('image not found');
      await store.setEmbedding(msg.id, await embed(await RawImage.fromBlob(blob)));
      return { ok: true };
    }
    const vec = await embed(await RawImage.fromURL(msg.url));
    return { ok: true, vec: Array.from(vec) };
  })().then(sendResponse, (e: unknown) => sendResponse({ ok: false, error: String(e) }));
  return true;
});
