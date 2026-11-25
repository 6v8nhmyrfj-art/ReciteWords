# Offline ASR experiment (2026-11-25)

Installed separately at `/home/ubuntu/recitewords-asr` on the Tencent host.
This is an experiment, not a production recognition endpoint. Existing website
recognition and student data are unchanged.

Runtime: Python venv, `vosk==0.3.45`. Models are Apache-2.0 releases from
https://alphacephei.com/vosk/models :

| Model | Archive SHA256 |
| --- | --- |
| vosk-model-small-cn-0.22 | 3af8b0e7e0f835ae9d414ce5df580237a3cfb08d586c9fbbb0f7ff29ad5b14ba |
| vosk-model-small-en-us-0.15 | 30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498 |

Download ZIPs from the official model page, verify hashes and ZIP integrity,
then extract into `models/`. Install runtime with:

```sh
python3 -m venv venv
venv/bin/pip install vosk==0.3.45
venv/bin/python benchmark.py --models models --audio sample.wav
```

Use mono PCM16 WAV. Benchmark measures recognition after model loading, not
browser upload, transcription grading, database writes, or concurrent load.

## Measured result

On the 2 CPU / 4 GB Tencent instance, an English 0.438-second fixture took
0.386, 0.375 and 0.371 seconds. Both loaded models together peaked at 285.4 MiB
process RSS. Loading took 0.445 seconds (English) and 0.385 seconds (Chinese).

Accuracy failed this smoke test: the expected `apple` was recognized as `though`
in all three runs, despite high reported confidence. Do not use confidence alone
as a correctness or pronunciation score. Chinese loading and silence succeeded;
Chinese speech accuracy has not been evaluated.

Before integration, evaluate real student speech, uncommon words, silence and
incorrect answers; measure concurrent CPU/memory and end-to-end latency. Do not
constrain recognition to only the expected answer, which could falsely pass
incorrect speech. Keep production ASR unchanged until accuracy is acceptable.

Models have no per-request API charge; server resources and bandwidth still cost
money. No additional paid service was provisioned.
