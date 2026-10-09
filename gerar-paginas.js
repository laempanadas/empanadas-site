const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;

const CARDAPIO_PATH = path.join(__dirname, 'assets', 'js', 'cardapio.json');
const TEMPLATE_PATH = path.join(__dirname, 'produto-template.html');
const OUTPUT_DIR = path.join(__dirname, 'produtos');
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');

const CATEGORIAS = {
  salgada: { nome: 'Empanadas Salgadas', slug: 'empanadas-salgadas' },
  doce: { nome: 'Empanadas Doces', slug: 'empanadas-doces' },
  combo: { nome: 'Combos', slug: 'combos' },
  bebida: { nome: 'Bebidas', slug: 'bebidas' },
  vinho: { nome: 'Vinhos', slug: 'vinhos' }
};

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('Iniciando geração de páginas de produto...');
  
  const template = await fsPromises.readFile(TEMPLATE_PATH, 'utf-8');
  const cardapio = JSON.parse(await fsPromises.readFile(CARDAPIO_PATH, 'utf-8'));
  
  await fsPromises.mkdir(OUTPUT_DIR, { recursive: true });
  
  const urls = [];
  let processados = 0;
  let erros = 0;
  
  for (const item of cardapio.itens) {
    try {
      const categoria = CATEGORIAS[item.categoriaId] || { nome: 'Outros', slug: 'outros' };
      const slugProduto = slugify(item.nome) + '-' + item.id;
      const canonicalUrl = 'https://www.laempanadas.com.br/produtos/' + slugProduto + '.html';
      const imagemUrl = item.imagem.startsWith('http') ? item.imagem : 'https://www.laempanadas.com.br/' + item.imagem;
      
      let html = template
        .replace(/\{\{PRODUTO_NOME\}\}/g, item.nome)
        .replace(/\{\{PRODUTO_NOME_ENCODED\}\}/g, encodeURIComponent(item.nome))
        .replace(/\{\{PRODUTO_DESCRICAO\}\}/g, item.descricao)
        .replace(/\{\{PRODUTO_DESCRICAO_SEO\}\}/g, item.descricao)
        .replace(/\{\{PRODUTO_ID\}\}/g, item.id)
        .replace(/\{\{CATEGORIA_NOME\}\}/g, categoria.nome)
        .replace(/\{\{CATEGORIA_SLUG\}\}/g, categoria.slug)
        .replace(/\{\{CATEGORIA_SLUG_LOWER\}\}/g, categoria.slug.toLowerCase())
        .replace(/\{\{PRECO_NUMERICO\}\}/g, item.preco.toFixed(2).replace('.', ','))
        .replace(/\{\{PRECO_NUMERICO_PONTO\}\}/g, item.preco.toFixed(2))
        .replace(/\{\{PRECO_FORMATADO\}\}/g, item.preco.toFixed(2).replace('.', ','))
        .replace(/\{\{IMAGEM_URL\}\}/g, imagemUrl)
        .replace(/\{\{CANONICAL_URL\}\}/g, canonicalUrl)
        .replace(/\{\{INGREDIENTES\}\}/g, item.descricao)
        .replace(/\{\{CALORIAS\}\}/g, String(Math.round(320)))
        .replace(/\{\{PROTEINAS\}\}/g, '12')
        .replace(/\{\{CARBOIDRATOS\}\}/g, '28')
        .replace(/\{\{GORDURAS\}\}/g, '18')
        .replace(/\{\{FIBRAS\}\}/g, '2')
        .replace(/\{\{SODIO\}\}/g, '380');
      
      const outputPathProdutos = path.join(OUTPUT_DIR, slugProduto + '.html');
      const outputPathRoot = path.join(__dirname, slugProduto + '.html');
      
      await fsPromises.writeFile(outputPathProdutos, html, 'utf-8');
      await fsPromises.writeFile(outputPathRoot, html, 'utf-8');
      
      urls.push({
        url: canonicalUrl,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: '0.9'
      });
      
      processados++;
      if (processados % 10 === 0) {
        console.log('  ' + processados + ' produtos processados...');
      }
    } catch (err) {
      console.error('Erro ao processar ' + item.id + ':', err.message);
      erros++;
    }
  }
  
  const hoje = new Date().toISOString().split('T')[0];
  
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  sitemap += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
  sitemap += '  <url>\n';
  sitemap += '    <loc>https://www.laempanadas.com.br/</loc>\n';
  sitemap += '    <lastmod>' + hoje + '</lastmod>\n';
  sitemap += '    <changefreq>daily</changefreq>\n';
  sitemap += '    <priority>1.0</priority>\n';
  sitemap += '  </url>\n';
  sitemap += '  <url>\n';
  sitemap += '    <loc>https://www.laempanadas.com.br/politica.html</loc>\n';
  sitemap += '    <lastmod>' + hoje + '</lastmod>\n';
  sitemap += '    <changefreq>monthly</changefreq>\n';
  sitemap += '    <priority>0.5</priority>\n';
  sitemap += '  </url>\n';
  sitemap += '  <url>\n';
  sitemap += '    <loc>https://www.laempanadas.com.br/termos.html</loc>\n';
  sitemap += '    <lastmod>' + hoje + '</lastmod>\n';
  sitemap += '    <changefreq>monthly</changefreq>\n';
  sitemap += '    <priority>0.5</priority>\n';
  sitemap += '  </url>\n';
  sitemap += '  <url>\n';
  sitemap += '    <loc>https://www.laempanadas.com.br/exclusao.html</loc>\n';
  sitemap += '    <lastmod>' + hoje + '</lastmod>\n';
  sitemap += '    <changefreq>monthly</changefreq>\n';
  sitemap += '    <priority>0.5</priority>\n';
  sitemap += '  </url>\n';
  sitemap += '  <url>\n';
  sitemap += '    <loc>https://www.laempanadas.com.br/#cardapio</loc>\n';
  sitemap += '    <lastmod>' + hoje + '</lastmod>\n';
  sitemap += '    <changefreq>weekly</changefreq>\n';
  sitemap += '    <priority>0.8</priority>\n';
  sitemap += '  </url>\n';
  sitemap += '  <url>\n';
  sitemap += '    <loc>https://www.laempanadas.com.br/produtos</loc>\n';
  sitemap += '    <lastmod>' + hoje + '</lastmod>\n';
  sitemap += '    <changefreq>weekly</changefreq>\n';
  sitemap += '    <priority>0.8</priority>\n';
  sitemap += '  </url>\n';
  
  for (const u of urls) {
    sitemap += '  <url>\n';
    sitemap += '    <loc>' + u.url + '</loc>\n';
    sitemap += '    <lastmod>' + u.lastmod + '</lastmod>\n';
    sitemap += '    <changefreq>' + u.changefreq + '</changefreq>\n';
    sitemap += '    <priority>' + u.priority + '</priority>\n';
    sitemap += '  </url>\n';
  }
  
  sitemap += '</urlset>\n';
  
  await fsPromises.writeFile(SITEMAP_PATH, sitemap, 'utf-8');
  
  console.log('\nConcluído com sucesso!');
  console.log('   Produtos processados: ' + processados);
  console.log('   Erros: ' + erros);
  console.log('   URLs no sitemap: ' + (urls.length + 6));
  console.log('Sitemap salvo em: ' + SITEMAP_PATH);
}

main().catch(console.error);
