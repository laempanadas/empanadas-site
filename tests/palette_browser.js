// Run in browser console on the locally served homepage. Returns real DOM checks.
(() => {
  const results = [];
  const check = (name, ok, detail) => results.push({name, ok, detail});
  const rgb = color => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const luminance = color => rgb(color).map(x => {
    x /= 255;
    return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
  }).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a,b) => b-a);
    return (values[0] + .05) / (values[1] + .05);
  };
  for (const [selector, background] of [
    ['#cardapio-grid .card-body p', '#fff'],
    ['#cardapio-grid .text-terracotta-600', '#fff'],
    ['#cardapio-grid button[data-action="add"]', null],
    ['footer p', '#7C2D12'],
    ['footer dd', '#864024'],
    ['footer [data-status-funcionamento]', null],
    ['#bottom-bar .btn', null]
  ]) {
    const element = document.querySelector(selector);
    const style = getComputedStyle(element);
    const ratio = contrast(style.color, background || style.backgroundColor);
    check('AA contrast ' + selector, ratio >= 4.5, Number(ratio.toFixed(2)));
  }
  check('page option 1', getComputedStyle(document.body).backgroundColor === 'rgb(255, 248, 242)');
  check('footer option 1', getComputedStyle(document.querySelector('footer')).backgroundColor === 'rgb(124, 45, 18)');
  check('subfooter option 1', getComputedStyle(document.querySelector('footer > div:last-child')).backgroundColor === 'rgb(106, 37, 15)');
  check('no horizontal overflow', document.documentElement.scrollWidth <= innerWidth);
  return results;
})();
