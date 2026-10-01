# Amorino Confeitaria

Site da Amorino Confeitaria (São Caetano do Sul, SP). Um bolo de verdade é montado no centro da tela conforme o scroll: 4 discos de massa de chocolate intercalados com recheio rosa, branco e rosa. A animação é uma sequência de frames WebP (`img/bolo/frames/`, e `img/bolo/frames-mobile/` em telas pequenas) desenhada num `<canvas>` pelo `js/bolo.js`.

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
- `scripts/gerar-frames.py` — gera os frames a partir dos vídeos em `img/bolo/video/` (não usados pelo site)
- `js/site.js` — links de WhatsApp, botão de pular, copiar chave PIX e montador de pedido
- `img/` — logo e fotos extraídas do cardápio (WebP)

## Publicar atualizações (GitHub Pages)

Ao alterar `styles.css` ou os arquivos em `js/`, aumente o número `?v=` nos links do `index.html`
(ex.: `styles.css?v=3` → `styles.css?v=4`). Assim os navegadores baixam a versão nova em vez de usar a antiga do cache.

## Trocar a animação do bolo

1. Coloque os vídeos em ordem em `img/bolo/video/` (`trecho-1.mp4`, `trecho-2.mp4`, …).
2. Rode `python3 scripts/gerar-frames.py` (precisa de ffmpeg, Pillow e numpy). Ele corta os trechos parados
   no início e no fim de cada vídeo, junta tudo, extrai os frames e ajusta o fundo para `#EFDCC0`.
   O script imprime em que frames começa cada trecho.
3. Se a quantidade de frames mudar, ajuste `BOLO.frames` em `js/bolo.js`, e ajuste os `data-start`/`data-end`
   dos cartões no `index.html` para os novos trechos.
