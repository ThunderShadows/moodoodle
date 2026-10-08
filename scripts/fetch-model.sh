#!/usr/bin/env bash
# Downloads the on-device image model (DINOv2-small, 8-bit, Apache-2.0) into public/models
# and verifies it. Run once after cloning: npm run fetch-model
set -euo pipefail
cd "$(dirname "$0")/.."
dir=public/models/Xenova/dinov2-small
base=https://huggingface.co/Xenova/dinov2-small/resolve/main
mkdir -p "$dir/onnx"
for f in config.json preprocessor_config.json onnx/model_quantized.onnx; do
  [ -s "$dir/$f" ] || curl -fL --retry 3 -o "$dir/$f" "$base/$f"
done
echo "3afdc8bc63b50558d6e5770f5b799bb82455c2311183a2de43803f343a29d917  $dir/onnx/model_quantized.onnx" | sha256sum -c -
