"""CPU embeddings with bounded inference memory and the existing MiniLM vector space."""
from functools import lru_cache
from threading import Lock

MODEL = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache
def model_files():
    from huggingface_hub import hf_hub_download
    return (hf_hub_download(MODEL, "onnx/model.onnx"),
            hf_hub_download(MODEL, "tokenizer.json"))


class MiniLM:
    def __init__(self):
        import onnxruntime as ort
        from tokenizers import Tokenizer
        weights, tokenizer = model_files()
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.enable_cpu_mem_arena = False
        self.session = ort.InferenceSession(weights, sess_options=options, providers=["CPUExecutionProvider"])
        self.tokenizer = Tokenizer.from_file(tokenizer)
        self.tokenizer.enable_truncation(max_length=256)
        self.lock = Lock()

    def encode(self, texts, normalize_embeddings=True):
        import numpy as np
        vectors = []
        with self.lock:
            for text in texts:
                encoded = self.tokenizer.encode(text)
                inputs = {
                    "input_ids": np.asarray([encoded.ids], dtype=np.int64),
                    "attention_mask": np.asarray([encoded.attention_mask], dtype=np.int64),
                    "token_type_ids": np.asarray([encoded.type_ids], dtype=np.int64),
                }
                inputs = {field.name: inputs[field.name] for field in self.session.get_inputs()}
                tokens = self.session.run(None, inputs)[0]
                mask = inputs["attention_mask"][..., None]
                vector = (tokens * mask).sum(axis=1) / mask.sum(axis=1).clip(min=1)
                if normalize_embeddings:
                    vector /= np.linalg.norm(vector, axis=1, keepdims=True).clip(min=1e-12)
                vectors.append(vector[0])
        return np.asarray(vectors, dtype=np.float32)
