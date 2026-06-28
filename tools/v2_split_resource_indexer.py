#!/usr/bin/env python3
"""
Legend Of Indle V2 — Split Resource Vault Indexer

Lê res.zip(1).001..013 sem extrair o pacote inteiro e gera um manifesto JSON.
Uso local:
  python tools/v2_split_resource_indexer.py --parts "../res.zip(1).001" "../res.zip(1).002" ... --out docs/imported/res_manifest_local.json

Observação: este utilitário indexa/analisa o vault enviado como referência técnica. O jogo V2 recria UI, sistemas e visual em HTML5/Canvas.
"""
import argparse
import bisect
import json
import os
import struct
from collections import Counter

EOCD64 = b"PK\x06\x06"
CDSIG = b"PK\x01\x02"
LOCSIG = b"PK\x03\x04"


def parse_zip64_extra(extra, comp_size, uncomp_size, offset, disk):
    pos = 0
    while pos + 4 <= len(extra):
        header_id, size = struct.unpack('<HH', extra[pos:pos + 4])
        pos += 4
        payload = extra[pos:pos + size]
        pos += size
        if header_id == 0x0001:
            q = 0
            if uncomp_size == 0xFFFFFFFF and q + 8 <= len(payload):
                uncomp_size = struct.unpack('<Q', payload[q:q + 8])[0]; q += 8
            if comp_size == 0xFFFFFFFF and q + 8 <= len(payload):
                comp_size = struct.unpack('<Q', payload[q:q + 8])[0]; q += 8
            if offset == 0xFFFFFFFF and q + 8 <= len(payload):
                offset = struct.unpack('<Q', payload[q:q + 8])[0]; q += 8
            if disk == 0xFFFF and q + 4 <= len(payload):
                disk = struct.unpack('<I', payload[q:q + 4])[0]
    return comp_size, uncomp_size, offset, disk


def read_global(parts, starts, sizes, offset, length):
    out = bytearray()
    pos = offset
    remaining = length
    while remaining > 0:
        idx = bisect.bisect_right(starts, pos) - 1
        if idx < 0 or idx >= len(parts):
            raise ValueError(f'Offset fora das partes: {pos}')
        rel = pos - starts[idx]
        take = min(remaining, sizes[idx] - rel)
        with open(parts[idx], 'rb') as f:
            f.seek(rel)
            out.extend(f.read(take))
        pos += take
        remaining -= take
    return bytes(out)


def magic_name(header):
    if header.startswith((b'FWS', b'CWS', b'ZWS')): return 'swf'
    if header.startswith(b'\x89PNG'): return 'png'
    if header.startswith(b'\xff\xd8'): return 'jpg'
    if header.startswith(b'GIF'): return 'gif'
    if header.startswith(b'PK\x03\x04'): return 'zip'
    if header[:1] in (b'{', b'['): return 'json_text'
    if header.startswith((b'\x78\x9c', b'\x78\xda')): return 'zlib'
    return 'binary_or_custom'


def build_manifest(parts, sample_limit=500):
    sizes = [os.path.getsize(p) for p in parts]
    starts = []
    total = 0
    for size in sizes:
        starts.append(total)
        total += size

    final = parts[-1]
    final_size = sizes[-1]
    with open(final, 'rb') as f:
        f.seek(max(0, final_size - 4096))
        tail = f.read()
    idx = tail.rfind(EOCD64)
    if idx < 0:
        raise RuntimeError('ZIP64 EOCD não encontrado. Verifique se a última parte foi informada.')
    base = final_size - len(tail)
    eocd = tail[idx:idx + 56]
    _, size_rec, version_made, version_needed, disk, cd_start_disk, entries_disk, entries_total, cd_size, cd_offset = struct.unpack('<4sQHHIIQQQQ', eocd)
    cd_offset_in_final = cd_offset - starts[-1]
    if cd_offset_in_final < 0:
        raise RuntimeError('Diretório central começa antes da última parte; este indexador espera o diretório central na parte final.')

    with open(final, 'rb') as f:
        f.seek(cd_offset_in_final)
        central = f.read(cd_size)

    entries = []
    pos = 0
    while pos + 46 <= len(central) and central[pos:pos + 4] == CDSIG:
        fields = struct.unpack('<4sHHHHHHIIIHHHHHII', central[pos:pos + 46])
        _, ver_made, ver_need, flag, method, mtime, mdate, crc, comp_size, uncomp_size, name_len, extra_len, comment_len, disk_start, int_attr, ext_attr, local_offset = fields
        name = central[pos + 46:pos + 46 + name_len].decode('utf-8', 'replace')
        extra = central[pos + 46 + name_len:pos + 46 + name_len + extra_len]
        comp_size, uncomp_size, local_offset, disk_start = parse_zip64_extra(extra, comp_size, uncomp_size, local_offset, disk_start)
        entries.append({
            'name': name,
            'compressed_size': comp_size,
            'uncompressed_size': uncomp_size,
            'method': method,
            'offset': local_offset,
            'crc': crc
        })
        pos += 46 + name_len + extra_len + comment_len

    magic = Counter()
    for entry in entries[:sample_limit]:
        try:
            hdr = read_global(parts, starts, sizes, entry['offset'], 30)
            if hdr[:4] != LOCSIG:
                magic['bad_local_header'] += 1
                continue
            _, vneed, flag, method, mtime, mdate, crc, cs, us, name_len, extra_len = struct.unpack('<4sHHHHHIIIHH', hdr)
            data_offset = entry['offset'] + 30 + name_len + extra_len
            header = read_global(parts, starts, sizes, data_offset, min(16, entry['compressed_size']))
            magic[magic_name(header)] += 1
        except Exception:
            magic['read_error'] += 1

    return {
        'parts': len(parts),
        'archive_bytes': total,
        'entries': len(entries),
        'zip64': {
            'entries_total': entries_total,
            'central_directory_size': cd_size,
            'central_directory_offset': cd_offset,
            'version_needed': version_needed,
        },
        'methods': dict(Counter(str(e['method']) for e in entries)),
        'magic_sample': dict(magic),
        'first_entries': entries[:100],
        'largest_entries': sorted(entries, key=lambda e: e['uncompressed_size'], reverse=True)[:100],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--parts', nargs='+', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    manifest = build_manifest(args.parts)
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Manifesto gerado: {args.out}")


if __name__ == '__main__':
    main()
