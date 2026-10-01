/* =========================================================================
   Amorino — bolo montado conforme o scroll, com frames reais (WebP).
   Os frames são gerados a partir dos vídeos em img/bolo/video/ pelo script
   scripts/gerar-frames.py. Para trocar a animação, gere novos frames e
   ajuste FRAMES abaixo (e os data-start/data-end dos cartões no index.html).
   ========================================================================= */
(function () {
  const BOLO = {
    frames: 150,                          // quantidade de frames em cada pasta
    pasta: 'img/bolo/frames',             // frames para telas grandes (1280×720)
    pastaMobile: 'img/bolo/frames-mobile',// frames para telas pequenas (854×480)
    inicio: 0.05,                         // progresso do scroll em que a animação começa…
    fim: 0.84,                            // …e termina (depois disso fica no bolo pronto)
    fundo: '#EFDCC0',                     // cor do fundo das imagens
  };

  const canvas = document.getElementById('cake-canvas');
  const stage = document.querySelector('.stage');
  const build = document.querySelector('.build');
  const loader = document.getElementById('loader');
  if (!canvas || !build) return;
  const ctx = canvas.getContext('2d');

  const mobile = window.matchMedia('(max-width: 820px)').matches;
  const pasta = mobile ? BOLO.pastaMobile : BOLO.pasta;
  const src = (i) => `${pasta}/frame-${String(i + 1).padStart(3, '0')}.webp`;

  /* ----------------------------- preload --------------------------------- */
  // Ordem de carregamento: primeiro e último, depois um a cada 8, 4, 2 e o resto —
  // assim dá para rolar cedo, mostrando o frame carregado mais próximo.
  const images = new Array(BOLO.frames);
  const ready = new Array(BOLO.frames).fill(false);
  const order = [];
  const seen = new Set();
  const push = (i) => { if (i >= 0 && i < BOLO.frames && !seen.has(i)) { seen.add(i); order.push(i); } };
  push(0); push(BOLO.frames - 1);
  for (const step of [8, 4, 2, 1]) for (let i = 0; i < BOLO.frames; i += step) push(i);

  let loading = 0;
  const MAX_PARALLEL = 6;
  function next() {
    while (loading < MAX_PARALLEL && order.length) {
      const i = order.shift();
      const img = new Image();
      img.decoding = 'async';
      loading++;
      img.onload = () => {
        loading--;
        ready[i] = true;
        if (i === 0) loader.classList.add('is-done');
        if (i === nearest(current)) draw(true);
        next();
      };
      img.onerror = () => { loading--; next(); };
      img.src = src(i);
      images[i] = img;
    }
  }
  next();

  function nearest(i) {
    if (ready[i]) return i;
    for (let d = 1; d < BOLO.frames; d++) {
      if (ready[i - d]) return i - d;
      if (ready[i + d]) return i + d;
    }
    return -1;
  }

  /* ----------------------------- desenho ---------------------------------- */
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    draw(true);
  }

  let drawn = -1;
  function draw(force) {
    const i = nearest(current);
    if (i < 0 || (!force && i === drawn)) return;
    drawn = i;
    const img = images[i];
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const portrait = W / H < 0.9;
    // Paisagem: o frame ocupa ~90% da altura (sobra espaço para os cartões laterais).
    // Retrato: o bolo (~36% da largura do frame) ocupa ~85% da tela, um pouco acima
    // do centro (os cartões ficam embaixo). As bordas dos frames já são #EFDCC0.
    const scale = portrait ? (W * 2.35) / iw : Math.max((H * 0.9) / ih, (W * 0.9) / iw);
    const dw = iw * scale, dh = ih * scale;
    const visibleH = window.innerHeight || H;
    const dx = (W - dw) / 2;
    const dy = portrait ? visibleH * 0.4 - dh * 0.5 : (H - dh) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BOLO.fundo;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ----------------------------- scroll ----------------------------------- */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  function progress() {
    const rect = build.getBoundingClientRect();
    const total = build.offsetHeight - window.innerHeight;
    return clamp01(-rect.top / Math.max(total, 1));
  }
  const frameAt = (p) => Math.round(clamp01((p - BOLO.inicio) / (BOLO.fim - BOLO.inicio)) * (BOLO.frames - 1));

  // Cartões de cada etapa, trilho lateral e cartão de abertura
  const steps = [...document.querySelectorAll('.step')];
  const hero = document.querySelector('.step--hero');
  const rail = document.querySelector('.rail');
  const railItems = [...document.querySelectorAll('.rail li')];
  function updateUI(p) {
    // o cartão de abertura sobe e some aos poucos conforme a rolagem
    const k = clamp01(p / 0.045);
    hero.style.opacity = String(1 - k);
    hero.style.transform = `translate(-50%, ${-k * 90}px)`;
    hero.style.visibility = k >= 1 ? 'hidden' : 'visible';
    for (const s of steps) {
      if (s === hero) continue;
      s.classList.toggle('is-active', p >= parseFloat(s.dataset.start) && p < parseFloat(s.dataset.end));
    }
    let cur = -1;
    railItems.forEach((li, i) => { if (p >= parseFloat(li.dataset.at)) cur = i; });
    railItems.forEach((li, i) => {
      li.classList.toggle('is-done', i < cur);
      li.classList.toggle('is-current', i === cur);
    });
    rail.classList.toggle('is-hidden', p < 0.04 || p > 0.9);
  }

  // Suaviza a rolagem e só redesenha quando o frame muda.
  let target = progress();
  let smooth = target;
  let current = frameAt(smooth);
  let ticking = false;
  function tick() {
    smooth += (target - smooth) * 0.2;
    if (Math.abs(target - smooth) < 0.0002) smooth = target;
    current = frameAt(smooth);
    draw(false);
    if (smooth !== target) requestAnimationFrame(tick);
    else ticking = false;
  }
  function onScroll() {
    target = progress();
    updateUI(target);
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  resize();
  updateUI(target);
})();
