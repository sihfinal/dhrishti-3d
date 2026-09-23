from __future__ import annotations
import json
import struct
from typing import Any
import numpy as np

# Header Specification: 16 bytes fixed
# [0..3]:   Magic ASCII "SD3D"
# [4..5]:   Version (uint16) = 1
# [6..7]:   Format Type (uint16): 1 = Single 2D Slice, 2 = Scalar Stack, 3 = Currents (U+V) Stack
# [8..11]:  Metadata JSON Byte Length (uint32)
# [12..15]: Binary Payload Byte Length (uint32)
MAGIC: bytes = b"SD3D"
VERSION: int = 1
TYPE_SINGLE: int = 1
TYPE_STACK_SCALAR: int = 2
TYPE_STACK_CURRENTS: int = 3

def encode_binary_field_slice(field_dict: dict[str, Any]) -> bytes:
    """
    Encodes a single 2D model field slice into the SD3D binary transport format.
    Payload is row-major Little-Endian Float32 values with IEEE 754 NaN for missing/land values.
    """
    w = int(field_dict["width"])
    h = int(field_dict["height"])
    
    meta = {
        "variable": field_dict["variable"],
        "time": field_dict["time"],
        "depth": float(field_dict["depth"]),
        "lat_min": float(field_dict["lat_min"]),
        "lat_max": float(field_dict["lat_max"]),
        "lon_min": float(field_dict["lon_min"]),
        "lon_max": float(field_dict["lon_max"]),
        "width": w,
        "height": h,
        "latitudes": field_dict["latitudes"],
        "longitudes": field_dict["longitudes"],
        "min_value": field_dict["min_value"],
        "max_value": field_dict["max_value"],
        "unit": field_dict.get("unit", ""),
        "layout": "row-major",
        "dtype": "float32-le",
    }
    
    arr = np.array(field_dict["values"], dtype=np.float32)
    payload = arr.ravel().astype("<f4").tobytes()
    
    meta_json = json.dumps(meta, separators=(",", ":")).encode("utf-8")
    meta_len = len(meta_json)
    data_len = len(payload)
    
    pad_len = (4 - (16 + meta_len) % 4) % 4
    header = struct.pack("<4sHHII", MAGIC, VERSION, TYPE_SINGLE, meta_len, data_len)
    return header + meta_json + (b"\x00" * pad_len) + payload

def encode_binary_field_stack(stack_dict: dict[str, Any]) -> bytes:
    """
    Encodes a 3D multi-depth model field stack into the SD3D binary transport format.
    For scalar fields: Depths x Height x Width contiguous Little-Endian Float32.
    For currents: 2 x Depths x Height x Width (U stack followed by V stack).
    """
    is_currents = (stack_dict.get("variable") == "currents")
    var_name = stack_dict["variable"]
    w = int(stack_dict["width"])
    h = int(stack_dict["height"])
    
    meta = {
        "variable": var_name,
        "time": stack_dict["time"],
        "depths": stack_dict["depths"],
        "requested_depths": stack_dict["requested_depths"],
        "lat_min": float(stack_dict["lat_min"]),
        "lat_max": float(stack_dict["lat_max"]),
        "lon_min": float(stack_dict["lon_min"]),
        "lon_max": float(stack_dict["lon_max"]),
        "width": w,
        "height": h,
        "latitudes": stack_dict["latitudes"],
        "longitudes": stack_dict["longitudes"],
        "unit": stack_dict.get("unit", ""),
        "layout": "depth-major-row-major",
        "dtype": "float32-le",
    }
    
    if is_currents:
        fmt_type = TYPE_STACK_CURRENTS
        u_slices_meta = []
        u_arrays = []
        for s in stack_dict.get("u_slices", []):
            u_slices_meta.append({
                "depth": float(s["depth"]),
                "requested_depth": float(s["requested_depth"]),
                "actual_depth": float(s["actual_depth"]),
                "min_value": s.get("min_value"),
                "max_value": s.get("max_value"),
            })
            arr = np.array(s["values"], dtype=np.float32)
            u_arrays.append(arr)
            
        v_slices_meta = []
        v_arrays = []
        for s in stack_dict.get("v_slices", []):
            v_slices_meta.append({
                "depth": float(s["depth"]),
                "requested_depth": float(s["requested_depth"]),
                "actual_depth": float(s["actual_depth"]),
                "min_value": s.get("min_value"),
                "max_value": s.get("max_value"),
            })
            arr = np.array(s["values"], dtype=np.float32)
            v_arrays.append(arr)
            
        meta["u_slices"] = u_slices_meta
        meta["v_slices"] = v_slices_meta
        
        u_flat = np.concatenate([a.ravel() for a in u_arrays]) if u_arrays else np.empty(0, dtype=np.float32)
        v_flat = np.concatenate([a.ravel() for a in v_arrays]) if v_arrays else np.empty(0, dtype=np.float32)
        payload = np.concatenate([u_flat, v_flat]).astype("<f4").tobytes()
        
    else:
        fmt_type = TYPE_STACK_SCALAR
        slices_meta = []
        arrays = []
        for s in stack_dict.get("slices", []):
            slices_meta.append({
                "depth": float(s["depth"]),
                "requested_depth": float(s["requested_depth"]),
                "actual_depth": float(s["actual_depth"]),
                "min_value": s.get("min_value"),
                "max_value": s.get("max_value"),
            })
            arr = np.array(s["values"], dtype=np.float32)
            arrays.append(arr)
            
        meta["slices"] = slices_meta
        payload = np.concatenate([a.ravel() for a in arrays]).astype("<f4").tobytes() if arrays else b""

    meta_json = json.dumps(meta, separators=(",", ":")).encode("utf-8")
    meta_len = len(meta_json)
    data_len = len(payload)
    
    pad_len = (4 - (16 + meta_len) % 4) % 4
    header = struct.pack("<4sHHII", MAGIC, VERSION, fmt_type, meta_len, data_len)
    return header + meta_json + (b"\x00" * pad_len) + payload
