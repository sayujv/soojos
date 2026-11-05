"""Render Gujarati text to speech with espeak-ng (via the espeakng-loader wheel).

Usage: python3 speak_gu.py jobs.json out_dir
jobs.json = [{"id": "...", "g": "ગુજરાતી"}...]; writes out_dir/<id>.mp3 (mono, 22 kHz, ~32 kbps).
espeak-ng is formant synthesis: robotic, but it reads Gujarati script with Gujarati phonology,
which beats an English voice guessing at a romanisation.
"""
import ctypes, json, os, subprocess, sys, wave, hashlib
import espeakng_loader as L

lib = ctypes.cdll.LoadLibrary(L.get_library_path())
SYNTH_CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
lib.espeak_ng_InitializePath(L.get_data_path().encode())
assert lib.espeak_ng_Initialize(None) == 0, 'init failed'
assert lib.espeak_ng_InitializeOutput(1, 0, None) == 0, 'output init failed'  # 1 = SYNCHRONOUS
rate = lib.espeak_ng_GetSampleRate()
assert lib.espeak_SetVoiceByName(b'gu') == 0, 'no gu voice'
lib.espeak_SetParameter(1, 150, 0)   # espeakRATE words/min (slower than default 175)
lib.espeak_SetParameter(3, 45, 0)    # espeakPITCH
buf = []
@SYNTH_CB
def cb(wav, n, events):
    if n > 0: buf.append(ctypes.string_at(wav, n * 2))
    return 0
lib.espeak_SetSynthCallback(cb)

def render(text, path):
    buf.clear()
    b = text.encode('utf-8') + b'\0'
    lib.espeak_Synth(b, len(b), 0, 0, 0, 1, None, None)  # 1 = espeakCHARS_UTF8
    lib.espeak_Synchronize()
    tmp = path + '.wav'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(b''.join(buf))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,apad=pad_dur=0.15', '-ac', '1', '-ar', '22050', '-b:a', '32k', path], check=True)
    os.remove(tmp)

if __name__ == '__main__':
    jobs = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
    manifest = {}
    for j in jobs:
        h = hashlib.sha1(j['g'].encode()).hexdigest()[:10]   # content-addressed: same text, same file
        fn = h + '.mp3'
        if not os.path.exists(os.path.join(out, fn)): render(j['g'], os.path.join(out, fn))
        manifest[j['g']] = fn
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w'), ensure_ascii=False)
    print(len(jobs), 'jobs ->', len(set(manifest.values())), 'files')
