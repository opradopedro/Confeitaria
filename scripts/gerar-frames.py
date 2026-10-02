#!/usr/bin/env python3
"""Gera os frames da animação "bolo desconstruído" a partir de img/bolo-maracuja/montagem.mp4.

Uso:  python3 scripts/gerar-frames.py [--frames 120] [--limiar 0.25]

Passos:
  1. Mede o movimento quadro a quadro e corta os trechos parados no início e no fim.
  2. Escolhe --frames quadros igualmente espaçados pelo MOVIMENTO ACUMULADO (e não pelo
     tempo): o vídeo desacelera no meio, e assim cada trecho de rolagem move as camadas
     na mesma medida — a animação não "trava".
  3. Mede a cor real do fundo (mediana das bordas) e normaliza o fundo de cada quadro
     para essa cor (o vídeo tem vinheta/degradê), esfumando as bordas na mesma cor.
  4. Salva img/bolo-maracuja/frames/frame-001.webp… (720×1280), frames-mobile/ (720×1280, compressão um pouco maior)
     e explodido-poster.webp (explodido.jpg alinhado e com o mesmo fundo, para o carregamento).

Requer: ffmpeg, Pillow e numpy (pip install pillow numpy).
"""
import argparse
import glob
import os
import shutil
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageChops, ImageStat

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA = os.path.join(RAIZ, 'img', 'bolo-maracuja')
VIDEO = os.path.join(PASTA, 'montagem.mp4')
SAIDA = os.path.join(PASTA, 'frames')
SAIDA_MOBILE = os.path.join(PASTA, 'frames-mobile')
TAM = (720, 1280)
TAM_MOBILE = (720, 1280)  # resolução cheia do vídeo (o celular estica a imagem; menor fica borrado)


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def _base(x, y, d=3):
    return np.stack([x ** i * y ** j for i in range(d + 1) for j in range(d + 1 - i)], -1)


def _coords(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return (xs + 0.5) / w, (ys + 0.5) / h


def mascara_fundo(x, y):
    """Áreas só de fundo: fora do bolo/boleira (centro) e fora da sombra da boleira."""
    bolo = (x > 0.15) & (x < 0.85) & (y > 0.12) & (y < 0.92)
    sombra = (x > 0.5) & (y > 0.72)
    return ~bolo & ~sombra


def coef_fundo(img):
    small = np.asarray(img.convert('RGB').resize((180, 320), Image.BILINEAR), float)
    x, y = _coords(180, 320)
    m = mascara_fundo(x, y)
    A = _base(x[m], y[m])
    return np.stack([np.linalg.lstsq(A, small[..., c][m], rcond=None)[0] for c in range(3)])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', type=int, default=120)
    ap.add_argument('--limiar', type=float, default=0.25, help='movimento mínimo para não ser "parado"')
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        cinza, cor = os.path.join(tmp, 'g'), os.path.join(tmp, 'c')
        os.makedirs(cinza)
        os.makedirs(cor)
        ffmpeg('-i', VIDEO, '-vf', 'scale=90:-1,format=gray', os.path.join(cinza, '%04d.png'))
        ffmpeg('-i', VIDEO, os.path.join(cor, '%04d.png'))
        gs = sorted(glob.glob(os.path.join(cinza, '*.png')))
        quadros = sorted(glob.glob(os.path.join(cor, '*.png')))

        # 1. movimento quadro a quadro e corte do início/fim parados
        d = [ImageStat.Stat(ImageChops.difference(Image.open(a), Image.open(b))).mean[0] for a, b in zip(gs, gs[1:])]
        s = [sum(d[max(0, k - 1):k + 2]) / len(d[max(0, k - 1):k + 2]) for k in range(len(d))]
        mov = [k for k, v in enumerate(s) if v > args.limiar]
        ini, fim = mov[0], mov[-1] + 1
        print(f'{len(quadros)} quadros no vídeo; mantém {ini}–{fim} (corta {ini} no início e {len(quadros) - 1 - fim} no fim)')

        # 2. frames igualmente espaçados pelo movimento acumulado (ruído de ~0,1 descontado)
        passo = np.maximum(np.array(d[ini:fim]) - 0.1, 0.01)
        acum = np.concatenate([[0], np.cumsum(passo)])
        N = args.frames
        alvos = np.linspace(0, acum[-1], N)
        escolhidos = [ini + int(np.argmin(np.abs(acum - a))) for a in alvos]

        # 3. cor real do fundo e normalização
        amostras = []
        for i in (escolhidos[0], escolhidos[N // 2], escolhidos[-1]):
            a = np.asarray(Image.open(quadros[i]).convert('RGB').resize((180, 320)), float)
            x, y = _coords(180, 320)
            amostras.append(a[mascara_fundo(x, y)])
        fundo = np.round(np.median(np.concatenate(amostras), 0))
        hexa = '#%02X%02X%02X' % tuple(fundo.astype(int))
        print(f'Cor real do fundo (mediana das bordas): {hexa}')

        W, H = Image.open(quadros[0]).size
        X, Y = _coords(W, H)
        B = _base(X, Y)

        def rampa(v, a):
            t = np.clip(v / a, 0, 1)
            return t * t * (3 - 2 * t)

        borda = (rampa(X, 0.12) * rampa(1 - X, 0.12) * rampa(Y, 0.08) * rampa(1 - Y, 0.12))
        # a sombra da boleira (abaixo do prato, à direita) some aos poucos em vez de ser cortada na borda
        abaixo_do_prato = rampa(Y - 0.76, 0.05)
        sombra_some = 1 - rampa(X - 0.64, 0.22)
        borda = (borda * (1 - abaixo_do_prato * (1 - sombra_some)))[..., None]

        def normalizar(img, coefs):
            modelo = np.stack([B @ c for c in coefs], -1)
            im = np.asarray(img.convert('RGB'), float) * (fundo / modelo)
            im = im * borda + fundo * (1 - borda)
            return Image.fromarray(np.clip(im + 0.5, 0, 255).astype('uint8'))

        coefs = np.array([coef_fundo(Image.open(quadros[i])) for i in escolhidos])
        suav = np.array([coefs[max(0, k - 3):k + 4].mean(0) for k in range(N)])  # sem "piscar"

        for p in (SAIDA, SAIDA_MOBILE):
            shutil.rmtree(p, ignore_errors=True)
            os.makedirs(p)
        for k, i in enumerate(escolhidos):
            img = normalizar(Image.open(quadros[i]), suav[k])
            nome = f'frame-{k + 1:03d}.webp'
            img.resize(TAM, Image.LANCZOS).save(os.path.join(SAIDA, nome), 'WEBP', quality=88, method=6)
            img.resize(TAM_MOBILE, Image.LANCZOS).save(os.path.join(SAIDA_MOBILE, nome), 'WEBP', quality=82, method=6)

        # 4. poster: explodido.jpg alinhado ao 1º quadro e com o mesmo fundo
        exp = Image.open(os.path.join(PASTA, 'explodido.jpg')).convert('RGB')
        exp = exp.resize((W, round(exp.size[1] * W / exp.size[0])), Image.LANCZOS)
        ref = Image.open(quadros[escolhidos[0]]).convert('RGB').resize((90, 160))
        dy = min(range(exp.size[1] - H + 1),
                 key=lambda t: sum(ImageStat.Stat(ImageChops.difference(exp.crop((0, t, W, t + H)).resize((90, 160)), ref)).mean))
        poster = normalizar(exp.crop((0, dy, W, dy + H)), suav[0])
        poster.resize(TAM, Image.LANCZOS).save(os.path.join(PASTA, 'explodido-poster.webp'), 'WEBP', quality=85, method=6)

    print(f'{N} frames salvos. Use {hexa} como fundo da seção (styles.css e js/bolo.js).')


if __name__ == '__main__':
    main()
