#!/usr/bin/env python3
"""
Legend Of Indle — V94 Resource Inspector

Ferramenta local para analisar blobs no mesmo formato dos recursos enviados como referência:
- primeiro bloco DES-ECB de 8 bytes;
- fluxo zlib;
- possível SWF CWS/FWS após descompressão.

Uso:
    python tools/asa_resource_inspector.py caminho/para/pasta
    python tools/asa_resource_inspector.py arquivo1 arquivo2 --extract-swfs out_refs

Observação:
    Esta ferramenta é para análise local e referência técnica. Não é necessário para rodar o jogo.
"""
import argparse
import hashlib
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

DES_KEY = "6bc89fe7d5a0f35f"


def decrypt_first_8_with_openssl(raw: bytes) -> bytes:
    if len(raw) < 8:
        return raw
    openssl = shutil.which("openssl")
    if not openssl:
        raise RuntimeError("OpenSSL não encontrado no PATH.")
    with tempfile.TemporaryDirectory() as td:
        inp = Path(td) / "first8.bin"
        out = Path(td) / "dec8.bin"
        inp.write_bytes(raw[:8])
        cmd = [
            openssl, "enc", "-des-ecb", "-d", "-nopad", "-K", DES_KEY,
            "-provider", "legacy", "-provider", "default",
            "-in", str(inp), "-out", str(out)
        ]
        proc = subprocess.run(cmd, capture_output=True)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.decode("utf-8", "replace"))
        return out.read_bytes() + raw[8:]


def maybe_decompress(raw: bytes) -> bytes:
    patched = decrypt_first_8_with_openssl(raw)
    for wbits in (15, -15):
        try:
            return zlib.decompress(patched, wbits=wbits)
        except zlib.error:
            pass
    return patched


def swf_info(data: bytes) -> dict:
    info = {"signature": data[:3].decode("latin1", "replace") if len(data) >= 3 else "", "is_swf": False}
    if len(data) >= 8 and data[:3] in (b"FWS", b"CWS", b"ZWS"):
        info.update({
            "is_swf": True,
            "version": data[3],
            "declared_length": struct.unpack("<I", data[4:8])[0],
            "compressed": data[:3].decode("ascii") in ("CWS", "ZWS")
        })
    return info


def inspect_file(path: Path, extract_dir: Path | None = None) -> dict:
    raw = path.read_bytes()
    result = {
        "file": str(path),
        "size": len(raw),
        "md5": hashlib.md5(raw).hexdigest(),
        "raw_first16_hex": raw[:16].hex(" ")
    }
    try:
        decoded = maybe_decompress(raw)
        result["decoded_size"] = len(decoded)
        result["decoded_first16_hex"] = decoded[:16].hex(" ")
        result.update(swf_info(decoded))
        if extract_dir and result.get("is_swf"):
            extract_dir.mkdir(parents=True, exist_ok=True)
            out = extract_dir / (path.name + ".swf")
            out.write_bytes(decoded)
            result["extracted_to"] = str(out)
    except Exception as exc:
        result["error"] = str(exc)
    return result


def collect_paths(args: list[str]) -> list[Path]:
    paths = []
    for item in args:
        p = Path(item)
        if p.is_dir():
            paths.extend(x for x in p.iterdir() if x.is_file())
        elif p.is_file():
            paths.append(p)
    return paths


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--extract-swfs", default=None, help="pasta de saída opcional para SWFs decodificados")
    ap.add_argument("--json", action="store_true")
    ns = ap.parse_args()

    out_dir = Path(ns.extract_swfs) if ns.extract_swfs else None
    results = [inspect_file(p, out_dir) for p in collect_paths(ns.paths)]

    if ns.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        for r in results:
            print("=" * 72)
            print(r["file"])
            print(f"size={r.get('size')} decoded={r.get('decoded_size')} md5={r.get('md5')}")
            print(f"signature={r.get('signature')} swf={r.get('is_swf')} version={r.get('version')} declared={r.get('declared_length')}")
            if "extracted_to" in r:
                print(f"extracted_to={r['extracted_to']}")
            if "error" in r:
                print(f"error={r['error']}")


if __name__ == "__main__":
    main()
