# Amorino Confeitaria

Site da Amorino Confeitaria (São Caetano do Sul, SP). Um bolo 3D realista (Three.js) é montado no centro da tela conforme o scroll: massa, recheio rosa, massa, recheio branco, massa, chantilly passado com espátula, decoração (ganache, rosetas, morangos, granulado) e, por fim, a câmera se afasta e mostra o bolo pronto na mesa.

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
- `js/cake.js` — cena 3D e animação ligada ao scroll (texturas geradas proceduralmente, sem imagens)
- `js/site.js` — links de WhatsApp, botão de pular, copiar chave PIX e montador de pedido
- `img/` — logo e fotos extraídas do cardápio (WebP)
