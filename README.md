# Amorino Confeitaria

Site da Amorino Confeitaria (São Caetano do Sul, SP). Na abertura, o Bolo de Maracujá aparece "desconstruído": as camadas (massa black, mousse de maracujá, calda com sementes) começam separadas e se juntam conforme o scroll. A animação é uma sequência de frames WebP (`img/bolo-maracuja/frames/`, e `img/bolo-maracuja/frames-mobile/` em telas pequenas) desenhada num `<canvas>` pelo `js/bolo.js`.

Há um botão discreto "pular animação" para ir direto ao cardápio.

O conteúdo e a identidade visual seguem o Cardápio Amorino 2026: como montar o bolo (peso, massa, recheio, decoração), recheios e preços por kg, galeria de fotos, brigadeiros, cone trufado e pão de mel, bolos de caixa (Surpresa de Uva e Delícia de Morango), marmitinhas, montador de pedido que envia a mensagem pronta no WhatsApp, como encomendar (passos, pagamento, PIX) e link para o Instagram.

## Rodar localmente

É um site estático (sem build). Qualquer servidor serve:

```sh
python3 -m http.server 8000
# abra http://localhost:8000
```

## Configurar

- **Número do WhatsApp:** `AMORINO.whatsapp` em `js/site.js` (só dígitos, com 55 + DDD).
- **Preços e sabores:** em `index.html` (seções do cardápio e opções do formulário, atributo `data-price`).

## Estrutura

- `index.html` — conteúdo da página
- `styles.css` — identidade visual (marrom chocolate, creme, rosa e listras)
- `js/bolo.js` — animação do bolo: preload dos frames e desenho no canvas conforme o scroll
- `scripts/gerar-frames.py` — gera os frames a partir de `img/bolo-maracuja/montagem.mp4` (o vídeo não é usado pelo site)
- `js/site.js` — links de WhatsApp, botão de pular, copiar chave PIX e montador de pedido
- `img/` — logo e fotos extraídas do cardápio (WebP)

## Publicar atualizações (GitHub Pages)

Ao alterar `styles.css` ou os arquivos em `js/`, aumente o número `?v=` nos links do `index.html`
(ex.: `styles.css?v=3` → `styles.css?v=4`). Assim os navegadores baixam a versão nova em vez de usar a antiga do cache.

## Trocar a animação do bolo

1. Substitua `img/bolo-maracuja/montagem.mp4` (vídeo vertical 9:16 das camadas se juntando) e
   `img/bolo-maracuja/explodido.jpg` (primeiro quadro, usado enquanto carrega).
2. Rode `python3 scripts/gerar-frames.py` (precisa de ffmpeg, Pillow e numpy). Ele corta os trechos parados,
   escolhe os frames pelo movimento (sem "travar" no meio), mede a cor do fundo e normaliza os frames para ela.
3. Se a cor do fundo impressa mudar, troque `#DABFAD` em `styles.css` (`.desc`) e `BOLO.fundo` em `js/bolo.js`.
   As alturas dos rótulos ficam nos `data-y0`/`data-y1` do `index.html`.
