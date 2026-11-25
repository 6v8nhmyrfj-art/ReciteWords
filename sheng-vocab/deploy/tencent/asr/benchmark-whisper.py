#!/usr/bin/env python3
"""CPU-only, offline recognition benchmark; no expected-answer prompt."""
import argparse
import json
import resource
import time
import wave
from pathlib import Path

from faster_whisper import WhisperModel

p = argparse.ArgumentParser()
p.add_argument('--model', required=True)
p.add_argument('--audio-dir', required=True)
a = p.parse_args()
start = time.perf_counter()
model = WhisperModel(a.model, device='cpu', compute_type='int8',
                     cpu_threads=2, num_workers=1, local_files_only=True)
out = {'load_seconds': round(time.perf_counter()-start, 3), 'trials': []}
for name, language in [('speech-test.wav', 'en'),
                       ('asr-english-check.wav', 'en'),
                       ('asr-chinese-check.wav', 'zh')]:
    path = Path(a.audio_dir) / name
    with wave.open(str(path)) as audio:
        duration = audio.getnframes() / audio.getframerate()
    for repeat in range(2):
        start = time.perf_counter()
        segments, info = model.transcribe(str(path), language=language,
            beam_size=5, temperature=0, condition_on_previous_text=False,
            vad_filter=False)
        # Transcription is lazy: exhaust generator inside the timed region.
        text = ''.join(s.text for s in segments).strip()
        out['trials'].append({'file': name, 'repeat': repeat+1,
            'audio_seconds': round(duration, 3),
            'seconds': round(time.perf_counter()-start, 3), 'text': text})
out['peak_rss_mib'] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024, 1)
print(json.dumps(out, ensure_ascii=False, indent=2))
