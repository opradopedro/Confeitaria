#!/usr/bin/env python3
"""Gera os frames da animação do bolo a partir dos vídeos em img/bolo/video/.

Uso:  python3 scripts/gerar-frames.py [--frames 150] [--limiar 0.25]

Passos:
  1. Para cada trecho-N.mp4 (em ordem), mede o movimento quadro a quadro e corta
     os segundos parados no início e no fim (para a animação não "travar").
  2. Junta os trechos cortados e escolhe --frames quadros igualmente espaçados.
  3. Ajusta o fundo para #EFDCC0 (normaliza o degradê/vinheta e o balanço de branco
     do vídeo, estimados nas laterais vazias de cada quadro) e esfuma as bordas nessa cor, para não haver emenda.
  4. Salva img/bolo/frames/frame-001.webp… (1280×720) e img/bolo/frames-mobile/ (854×480).

Requer: ffmpeg/ffprobe, Pillow e numpy (pip install pillow numpy).
"""
import argparse
import glob
import os
import re
import shutil
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageChops, ImageStat

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS = os.path.join(RAIZ, 'img', 'bolo', 'video')
SAIDA = os.path.join(RAIZ, 'img', 'bolo', 'frames')
SAIDA_MOBILE = os.path.join(RAIZ, 'img', 'bolo', 'frames-mobile')
FUNDO = np.array([0xEF, 0xDC, 0xC0], float)


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def cortes(video, tmp, limiar):
    """Primeiro e último quadro com movimento (média móvel da diferença > limiar)."""
    pasta = os.path.join(tmp, 'mov')
    shutil.rmtree(pasta, ignore_errors=True)
    os.makedirs(pasta)
    ffmpeg('-i', video, '-vf', 'scale=160:-1,format=gray', os.path.join(pasta, '%04d.png'))
    fs = sorted(glob.glob(os.path.join(pasta, '*.png')))
    d = [ImageStat.Stat(ImageChops.difference(Image.open(a), Image.open(b))).mean[0] for a, b in zip(fs, fs[1:])]
    s = [sum(d[max(0, k - 1):k + 2]) / len(d[max(0, k - 1):k + 2]) for k in range(len(d))]
    mov = [k for k, v in enumerate(s) if v > limiar]
    if not mov:
        return 0, len(fs) - 1
    return mov[0], mov[-1] + 1


def _base(x, y, d=3):
    return np.stack([x ** i * y ** j for i in range(d + 1) for j in range(d + 1 - i)], -1)


def coef_fundo(quadro):
    """Coeficientes de um polinômio de 3º grau (x, y) ajustado nas laterais vazias do quadro.
    Ignora o centro (bolo/boleira, camadas caindo) e a sombra da boleira no chão."""
    small = np.asarray(Image.open(quadro).convert('RGB').resize((320, 180), Image.BILINEAR), float)
    h, w, _ = small.shape
    ys, xs = np.mgrid[0:h, 0:w]
    x, y = xs / w, ys / h
    vazio = ~((x > 0.25) & (x < 0.75)) & ~((y > 0.62) & (x > 0.5))
    A = _base(x[vazio], y[vazio])
    return np.stack([np.linalg.lstsq(A, small[..., c][vazio], rcond=None)[0] for c in range(3)])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', type=int, default=150)
    ap.add_argument('--limiar', type=float, default=0.25, help='movimento mínimo para não ser "parado"')
    args = ap.parse_args()

    videos = sorted(glob.glob(os.path.join(VIDEOS, 'trecho-*.mp4')),
                    key=lambda p: int(re.search(r'(\d+)', os.path.basename(p)).group(1)))
    if not videos:
        raise SystemExit(f'Nenhum trecho-*.mp4 em {VIDEOS}')

    with tempfile.TemporaryDirectory() as tmp:
        lista, fins, total = [], [], 0
        for v in videos:
            ini, fim = cortes(v, tmp, args.limiar)
            out = os.path.join(tmp, os.path.basename(v))
            ffmpeg('-i', v, '-vf', f'trim=start_frame={ini}:end_frame={fim + 1},setpts=PTS-STARTPTS',
                   '-an', '-c:v', 'libx264', '-crf', '12', '-preset', 'veryfast', out)
            n = fim - ini + 1
            total += n
            fins.append(total)
            lista.append(f"file '{out}'")
            print(f'{os.path.basename(v)}: mantém quadros {ini}–{fim} ({n} quadros)')
        with open(os.path.join(tmp, 'lista.txt'), 'w') as f:
            f.write('\n'.join(lista))
        todos = os.path.join(tmp, 'todos.mp4')
        ffmpeg('-f', 'concat', '-safe', '0', '-i', os.path.join(tmp, 'lista.txt'), '-c', 'copy', todos)
        raw = os.path.join(tmp, 'raw')
        os.makedirs(raw)
        ffmpeg('-i', todos, os.path.join(raw, '%04d.png'))
        quadros = sorted(glob.glob(os.path.join(raw, '*.png')))
        total = len(quadros)

        W, H = Image.open(quadros[0]).size
        ys, xs = np.mgrid[0:H, 0:W]
        X, Y = (xs + 0.5) / W, (ys + 0.5) / H
        B = _base(X, Y)

        def rampa(v, a):
            t = np.clip(v / a, 0, 1)
            return t * t * (3 - 2 * t)

        borda = (rampa(X, 0.10) * rampa(1 - X, 0.10) * rampa(Y, 0.06) * rampa(1 - Y, 0.10))[..., None]

        # O vídeo muda o balanço de branco ao longo dos trechos: o fundo é estimado em
        # cada quadro e suavizado entre quadros vizinhos (evita "piscar").
        N = args.frames
        escolhidos = [round(k * (total - 1) / (N - 1)) for k in range(N)]
        coefs = np.array([coef_fundo(quadros[i]) for i in escolhidos])
        suav = np.array([coefs[max(0, k - 3):k + 4].mean(0) for k in range(N)])

        for pasta in (SAIDA, SAIDA_MOBILE):
            shutil.rmtree(pasta, ignore_errors=True)
            os.makedirs(pasta)
        for k, i in enumerate(escolhidos):
            modelo = np.stack([B @ c for c in suav[k]], -1)
            im = np.asarray(Image.open(quadros[i]).convert('RGB'), float) * (FUNDO / modelo)
            im = im * borda + FUNDO * (1 - borda)
            img = Image.fromarray(np.clip(im + 0.5, 0, 255).astype('uint8'))
            nome = f'frame-{k + 1:03d}.webp'
            img.resize((1280, 720), Image.LANCZOS).save(os.path.join(SAIDA, nome), 'WEBP', quality=80, method=6)
            img.resize((854, 480), Image.LANCZOS).save(os.path.join(SAIDA_MOBILE, nome), 'WEBP', quality=74, method=6)

    inicios = [1] + [round((f - 1) / (total - 1) * (N - 1)) + 1 for f in fins[:-1]]
    print(f'\n{N} frames salvos. Cada trecho começa no frame: {inicios}')
    print('Ajuste BOLO.frames em js/bolo.js e os data-start/data-end dos cartões no index.html se necessário.')


if __name__ == '__main__':
    main()
