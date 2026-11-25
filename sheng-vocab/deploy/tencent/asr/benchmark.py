#!/usr/bin/env python3
"""Offline Vosk smoke test; does not expose an API or alter student records."""
import argparse,json,time,wave,resource
from pathlib import Path
import vosk
p=argparse.ArgumentParser();p.add_argument('--models',required=True);p.add_argument('--audio',required=True);a=p.parse_args()
vosk.SetLogLevel(-1)
with wave.open(a.audio) as w:
 assert w.getnchannels()==1 and w.getsampwidth()==2 and w.getcomptype()=='NONE','Mono PCM16 WAV required'
 rate=w.getframerate();frames=w.readframes(w.getnframes());duration=w.getnframes()/rate
out={'audio_seconds':round(duration,3),'sample_rate':rate,'trials':[],'models':{}}
models={}
for lang,name in [('en','vosk-model-small-en-us-0.15'),('zh','vosk-model-small-cn-0.22')]:
 t=time.perf_counter();models[lang]=vosk.Model(str(Path(a.models)/name));out['models'][lang]={'load_seconds':round(time.perf_counter()-t,3)}
for i in range(3):
 t=time.perf_counter();r=vosk.KaldiRecognizer(models['en'],rate);r.SetWords(True);r.AcceptWaveform(frames);result=json.loads(r.FinalResult())
 out['trials'].append({'seconds':round(time.perf_counter()-t,3),'text':result.get('text',''),'words':result.get('result',[])})
r=vosk.KaldiRecognizer(models['zh'],16000);r.AcceptWaveform(bytes(32000));out['chinese_silence_text']=json.loads(r.FinalResult()).get('text','')
out['peak_rss_mib']=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,1)
print(json.dumps(out,ensure_ascii=False,indent=2))
