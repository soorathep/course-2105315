"""Add the instructor's recorded Thai voice to a 2105315 deck.

    python3 add_thai_recordings.py s01 /path/to/recordings/s01

The folder holds one raw recording per slide, named <slide-id>.th.<ext> (m4a, wav, mp3...).
For each one this script
  1. picks the channel: the mean of both, or the clean channel when one of them clips;
  2. removes rumble and steady background noise, trims silence at both ends, and sets the
     loudness to the English voice's level (-24 LUFS), mono 24 kHz MP3;
  3. places each caption break at the longest pause within 15 % of the slide's length from
     where the sentence lengths put it (at that point itself if there is no pause);
  4. writes narration/<session>/<slide-id>.th.mp3 and the "th" track in narration/<session>.json.
English tracks and other slides are left as they are. Then run publish.py.
"""
from pathlib import Path
import json
import subprocess
import sys
import tempfile

import numpy as np

HERE = Path(__file__).resolve().parent
TARGET_LUFS = -24
SR = 24000
CLIP, CLIP_COUNT = 0.98, 10


def pcm(path, channels, sr):
    raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', str(channels), '-ar', str(sr), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, channels)


def channel_filter(path):
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=channels', '-of', 'csv=p=0', str(path)],
                           capture_output=True, text=True, check=True).stdout.split()
    if int(probe[0]) < 2:
        return 'anull', 'mono'
    x = pcm(path, 2, 48000)
    clipped = [(np.abs(x[:, c]) > CLIP).sum() for c in (0, 1)]
    if clipped[0] > CLIP_COUNT and clipped[1] <= CLIP_COUNT:
        return 'pan=mono|c0=c1', 'right (left clips)'
    if clipped[1] > CLIP_COUNT and clipped[0] <= CLIP_COUNT:
        return 'pan=mono|c0=c0', 'left (right clips)'
    note = 'both (both clip)' if min(clipped) > CLIP_COUNT else 'both'
    return 'pan=mono|c0=0.5*c0+0.5*c1', note


def clean(src, dst):
    pan, note = channel_filter(src)
    trim = 'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.15'
    # Two passes: areverse and loudnorm in one filter graph can stall ffmpeg.
    with tempfile.TemporaryDirectory() as tmp:
        mid = Path(tmp) / 'mid.wav'
        chain = f'{pan},highpass=f=80,afftdn=nf=-40:nr=12,{trim},areverse,{trim},areverse'
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(src), '-af', chain, str(mid)], check=True)
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(mid), '-af', f'loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11',
                        '-ar', str(SR), '-ac', '1', '-b:a', '96k', str(dst)], check=True)
    return note


def cues_from_pauses(mp3, lengths):
    """Sentence cues: each break goes to the longest pause near where the text lengths put it."""
    x = pcm(mp3, 1, 16000)[:, 0]
    win = 800                                           # 50 ms
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + win] ** 2)) + 1e-9) for i in range(0, len(x) - win, win)])
    duration = len(x) / 16000
    n = len(lengths)
    if n == 1:
        return [[0.0, round(duration, 2)]], 'one sentence'
    quiet = db < np.percentile(db, 90) - 20
    gaps, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if i > 0 and j < len(quiet) and j - i >= 4:     # inner pause of at least 0.2 s
                gaps.append((i * 0.05, j * 0.05))
            i = j
        else:
            i += 1
    expected = np.cumsum(lengths)[:-1] / sum(lengths) * duration
    window = 0.15 * duration
    bounds, used, found = [], 0.0, 0
    for t in expected:
        near = [g for g in gaps if abs((g[0] + g[1]) / 2 - t) <= window and g[0] > used]
        if near:
            g = max(near, key=lambda g: g[1] - g[0])
            found += 1
        else:
            g = (max(t, used), max(t, used))
        bounds.append(g)
        used = g[1]
    edges = [0.0] + [c for g in bounds for c in g] + [duration]
    cues = [[round(edges[2 * k], 2), round(edges[2 * k + 1], 2)] for k in range(n)]
    return cues, f'pauses ({found} of {n - 1} breaks found)'


def main():
    session, folder = sys.argv[1], Path(sys.argv[2])
    spec = json.loads((HERE / f'{session}-narration.json').read_text())['slides']
    index_path = HERE / 'narration' / f'{session}.json'
    index = json.loads(index_path.read_text())
    out_dir = HERE / 'narration' / session
    for src in sorted(folder.iterdir()):
        slide_id = src.name.split('.th.')[0] if '.th.' in src.name else None
        if slide_id not in spec:
            continue
        dst = out_dir / f'{slide_id}.th.mp3'
        note = clean(src, dst)
        lengths = [len(s['th']) for s in spec[slide_id]]
        cues, how = cues_from_pauses(dst, lengths)
        index[slide_id]['th'] = {'audio': f'narration/{session}/{slide_id}.th.mp3', 'cues': cues}
        print(f'{slide_id}: {cues[-1][1]:.1f} s, channel {note}, cues by {how}')
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
