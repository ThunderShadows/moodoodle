import { normalize } from './similar';

/** DINOv2's whole-image descriptor: the CLS token (first row) of last_hidden_state [1, tokens, hidden]. */
export function clsEmbedding(tensor: { dims: number[]; data: Float32Array }): Float32Array {
  const [batch, tokens, hidden] = tensor.dims;
  if (tensor.dims.length !== 3 || batch !== 1 || !tokens || !hidden) {
    throw new Error(`unexpected embedding shape [${tensor.dims.join(', ')}]`);
  }
  return normalize(tensor.data.slice(0, hidden));
}
