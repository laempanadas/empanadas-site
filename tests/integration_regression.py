"""Local integration guard. Run: python3 tests/integration_regression.py"""
import json
import re
import subprocess
import unittest
import xml.etree.ElementTree as ET
from collections import Counter
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c0647aa'
HOST = 'https://www.laempanadas.com.br'

def original(name):
    return subprocess.check_output(['git', 'show', f'{BASE}:{name}'], cwd=ROOT, text=True)

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

def html_files():
    return sorted(p for p in ROOT.rglob('*.html') if 'node_modules' not in p.parts and '.git' not in p.parts)

def local_image(url, page):
    parsed = urlsplit(unescape(url))
    if '{{' in url or parsed.scheme == 'data':
        return None
    if parsed.netloc and parsed.netloc not in ('www.laempanadas.com.br', 'laempanadas.com.br'):
        return None
    return (ROOT / unquote(parsed.path).lstrip('/')) if parsed.netloc or parsed.path.startswith('/') else page.parent / unquote(parsed.path)

class Integration(unittest.TestCase):
    def test_menu_ids_and_images(self):
        menu = json.loads((ROOT / 'assets/js/cardapio.json').read_text())['itens']
        before = json.loads(original('assets/js/cardapio.json'))['itens']
        ids = [x['id'] for x in menu]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(ids, [x['id'] for x in before])
        for item in menu:
            with self.subTest(item=item['id']):
                image = local_image(item['imagem'], ROOT / 'index.html')
                if image:
                    self.assertTrue(image.is_file(), str(image.relative_to(ROOT)))
        controls = [a['data-item-id'] for _, a in Page((ROOT / 'index.html').read_text()).tags if 'data-item-id' in a]
        self.assertEqual(Counter(controls), Counter(ids))

    def test_all_html_images(self):
        for path in html_files():
            for tag, a in Page(path.read_text()).tags:
                refs = []
                if tag == 'img':
                    refs.append(a.get('src', ''))
                if tag == 'link' and a.get('as') == 'image':
                    refs.append(a.get('href', ''))
                if tag == 'meta' and (a.get('property') == 'og:image' or a.get('name') == 'twitter:image'):
                    refs.append(a.get('content', ''))
                for ref in refs:
                    image = local_image(ref, path)
                    if image:
                        with self.subTest(page=str(path.relative_to(ROOT)), image=ref):
                            self.assertTrue(image.is_file(), f'Missing: {image.relative_to(ROOT)}')

    def test_product_urls_and_metadata(self):
        names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE], cwd=ROOT, text=True).splitlines()
        products = [n for n in names if n.startswith('produtos/') and n.endswith('.html')]
        self.assertEqual(sorted(products), sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'produtos').glob('*.html')))
        for name in products + [Path(n).name for n in products] + ['index.html']:
            with self.subTest(page=name):
                before = Page(original(name)).tags
                after = Page((ROOT / name).read_text()).tags
                canon = lambda tags: [a['href'] for t,a in tags if t == 'link' and a.get('rel') == 'canonical']
                self.assertEqual(canon(before), canon(after))
                self.assertTrue(all(u.startswith(HOST + '/') for u in canon(after)))
                self.assertNotIn('https://laempanadas.com.br', (ROOT / name).read_text())
        self.assertEqual(original('sitemap.xml'), (ROOT / 'sitemap.xml').read_text())
        self.assertEqual(original('robots.txt'), (ROOT / 'robots.txt').read_text())

    def test_generated_pages_only_replace_images(self):
        before = json.loads(original('assets/js/cardapio.json'))['itens']
        current = json.loads((ROOT / 'assets/js/cardapio.json').read_text())['itens']
        products = sorted((ROOT / 'produtos').glob('*.html'))
        checked = 0
        for path in products:
            for target in (path, ROOT / path.name):
                name = str(target.relative_to(ROOT))
                old_text = original(name)
                expected = old_text
                for old, new in zip(before, current):
                    if f'data-item-id="{old["id"]}"' in old_text:
                        old_url = old['imagem'] if old['imagem'].startswith('http') else HOST + '/' + old['imagem']
                        new_url = new['imagem'] if new['imagem'].startswith('http') else HOST + '/' + new['imagem']
                        expected = expected.replace(old_url, new_url)
                        break
                with self.subTest(page=name):
                    self.assertEqual(expected, target.read_text())
                checked += 1
        print(f'Validated image-only changes and unchanged URLs/content in {checked} generated pages')

    def test_jsonld_xml_and_js(self):
        blocks = scripts = 0
        for path in html_files():
            text = path.read_text()
            for attrs, body in re.findall(r'<script\b([^>]*)>(.*?)</script>', text, re.S | re.I):
                if 'application/ld+json' in attrs:
                    json.loads(body)
                    blocks += 1
                    for ref in re.findall(r'"(?:image|contentUrl)"\s*:\s*"([^"]+)"', body):
                        image = local_image(ref, path)
                        if image:
                            self.assertTrue(image.is_file(), f'{path.name}: {ref}')
                elif 'src=' not in attrs:
                    result = subprocess.run(['node', '--check'], input=body, text=True, capture_output=True)
                    self.assertEqual(result.returncode, 0, f'{path}: {result.stderr}')
                    scripts += 1
        for path in ROOT.rglob('*.xml'):
            if 'node_modules' not in path.parts:
                ET.parse(path)
        files = [p for p in ROOT.rglob('*.js') if 'node_modules' not in p.parts and '.git' not in p.parts]
        for path in files:
            result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        print(f'Validated {len(html_files())} HTML, {blocks} JSON-LD, {scripts} inline JS, {len(files)} JS files')

    def test_preview_and_palette_preserved(self):
        preview = subprocess.check_output(['git', 'show', 'origin/feat/footer-cardapio-faq:preview-cores.html'], cwd=ROOT)
        self.assertEqual(preview, (ROOT / 'preview-cores.html').read_bytes())
        self.assertNotIn('preview-cores', (ROOT / 'index.html').read_text())
        css = (ROOT / 'assets/css/input.css').read_text()
        for token in ('--page: #FFF8F2', '--primaria: #C2410C', '--footer: #7C2D12', '--subfooter: #6A250F'):
            self.assertIn(token, css)

if __name__ == '__main__':
    unittest.main(verbosity=2)
