// Configuração da confeitaria — troque pelo número real do WhatsApp (DDI + DDD + número, só dígitos).
const AMORINO = {
  whatsapp: '5511999999999',
  instagram: 'https://www.instagram.com/amorinoconfeitaria_/',
};

function whatsappUrl(message) {
  return `https://wa.me/${AMORINO.whatsapp}?text=${encodeURIComponent(message)}`;
}

// Links de WhatsApp espalhados pela página
document.querySelectorAll('.js-whatsapp').forEach((a) => {
  a.href = whatsappUrl(a.dataset.msg || 'Oi, Amorino! Vim pelo site e queria fazer uma encomenda 🤍');
  a.target = '_blank';
  a.rel = 'noopener';
});

document.getElementById('year').textContent = new Date().getFullYear();

// Borda de "chocolate escorrendo" dos títulos (gerada para ficar sempre contínua)
(function buildDrips() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  document.querySelectorAll('svg.drip path').forEach((path) => {
    let x = 0;
    let d = 'M0 0 L0 22 ';
    while (x < 1200) {
      const gap = 30 + rand() * 50;
      const w = 34 + rand() * 30;
      const len = 30 + rand() * 75;
      const x1 = Math.min(x + gap, 1200);
      d += `C${x + gap * 0.5} 22 ${x1 - 6} 26 ${x1} 34 `;
      if (x1 >= 1200) break;
      const x2 = x1 + w;
      d += `C${x1 + 4} ${len} ${x1 + 2} ${len + 12} ${x1 + w / 2} ${len + 12} `;
      d += `C${x2 - 2} ${len + 12} ${x2 - 4} ${len} ${x2} 34 `;
      d += `C${x2 + 6} 26 ${x2 + 10} 22 ${x2 + 18} 22 `;
      x = x2 + 18;
    }
    d += 'L1200 22 L1200 0 Z';
    path.setAttribute('d', d);
  });
})();

// Montador de pedido
(function orderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;
  const recheio = form.querySelector('#recheio');
  const massa = form.querySelector('#massa');
  const geleiaWrap = form.querySelector('#geleia-wrap');
  const geleia = form.querySelector('#geleia');
  const total = form.querySelector('#total');
  const data = form.querySelector('#data');

  const today = new Date();
  today.setDate(today.getDate() + 2);
  data.min = today.toISOString().slice(0, 10);

  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function state() {
    const size = form.querySelector('input[name="size"]:checked');
    const opt = recheio.selectedOptions[0];
    const isRV = opt.dataset.rv === '1';
    const kg = parseFloat(size.value);
    const perKg = parseFloat(opt.dataset.price) + (isRV && geleia.checked ? 15 : 0);
    return { size, opt, isRV, kg, perKg, value: kg * perKg };
  }

  function update() {
    const s = state();
    geleiaWrap.hidden = !s.isRV;
    massa.disabled = s.isRV;
    total.textContent = brl(s.value);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = state();
    const nome = form.nome.value.trim();
    const lines = [
      `Oi, Amorino! ${nome ? `Aqui é ${nome}. ` : ''}Quero encomendar um bolo 🤍`,
      '',
      `• Tamanho: ${s.size.dataset.label}`,
      `• Massa: ${s.isRV ? 'Red Velvet' : massa.value}`,
      `• Recheio: ${s.opt.textContent.replace('Red Velvet · ', '')}${s.isRV && geleia.checked ? ' + geleia' : ''}`,
    ];
    if (data.value) {
      const [y, m, d] = data.value.split('-');
      lines.push(`• Data: ${d}/${m}/${y}`);
    }
    if (form.tema.value.trim()) lines.push(`• Tema/decoração: ${form.tema.value.trim()}`);
    lines.push('', `Estimativa do site: ${brl(s.value)} (sem decoração)`);
    window.open(whatsappUrl(lines.join('\n')), '_blank', 'noopener');
  });
})();

// Se o módulo 3D nem começar (CDN bloqueado, navegador antigo), mostra a versão simples.
setTimeout(() => {
  const loader = document.getElementById('loader');
  if (loader && !window.__amorinoCake && !loader.classList.contains('is-done')) {
    document.documentElement.classList.add('no-webgl');
    loader.classList.add('is-done');
  }
}, 15000);
