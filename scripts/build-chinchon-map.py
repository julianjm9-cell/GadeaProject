"""Build the local town basemap from an OSM XML export (ODbL, attributed in UI).

Usage: python scripts/build-chinchon-map.py path/to/export.osm
Source bbox: -3.427,40.137,-3.4155,40.1435. No tiles or API keys at runtime.
"""
import sys
import xml.etree.ElementTree as ET
from html import escape
from pathlib import Path

WEST, SOUTH, EAST, NORTH = -3.4255, 40.1375, -3.4163, 40.1427
WIDTH, HEIGHT = 1200, 900


def point(lat, lon):
    return ((lon - WEST) / (EAST - WEST) * WIDTH, (NORTH - lat) / (NORTH - SOUTH) * HEIGHT)


def build(source):
    root = ET.parse(source).getroot()
    nodes = {node.get('id'): (float(node.get('lat')), float(node.get('lon'))) for node in root.findall('node')}
    buildings, parks, roads = [], [], []
    for way in root.findall('way'):
        tags = {tag.get('k'): tag.get('v') for tag in way.findall('tag')}
        pts = [point(*nodes[node.get('ref')]) for node in way.findall('nd') if node.get('ref') in nodes]
        if len(pts) < 2:
            continue
        path = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        if tags.get('building'):
            buildings.append(f'<path d="{path}Z"/>')
        if tags.get('leisure') in {'park', 'garden'} or tags.get('landuse') in {'grass', 'village_green'}:
            parks.append(f'<path d="{path}Z"/>')
        road = tags.get('highway')
        if road:
            width = 5 if road in {'footway', 'path', 'steps'} else 14 if road in {'tertiary', 'secondary'} else 10
            if tags.get('area') == 'yes':
                roads.append(f'<path d="{path}Z" fill="#f9eed8" stroke="#d1b997" stroke-width="2"/>')
            else:
                roads.append(f'<path d="{path}" fill="none" stroke="#bca58c" stroke-width="{width+2}"/><path d="{path}" fill="none" stroke="#fff5df" stroke-width="{width}"/>')
    labels = []
    for text, lat, lon, angle in [
        ('PLAZA MAYOR', 40.1402, -3.42253, 0),
        ('Calle de los Huertos', 40.13935, -3.42395, 0),
        ('Calle Grande', 40.14034, -3.4198, -8),
        ('Cuesta de Quiñones', 40.14087, -3.4204, -66),
        ('Calle Benito Hortelano', 40.14085, -3.4179, -20),
        ('Torre del Reloj', 40.1417, -3.4228, 0),
        ('Iglesia de la Asunción', 40.14136, -3.4221, 0),
        ('Castillo de los Condes', 40.1381, -3.4219, 0),
    ]:
        x, y = point(lat, lon)
        labels.append(f'<text x="{x:.1f}" y="{y:.1f}" transform="rotate({angle} {x:.1f} {y:.1f})">{escape(text)}</text>')
    content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
<title>Calles del centro de Chinchón</title><desc>Datos © OpenStreetMap contributors, ODbL. Exportación 18 de noviembre de 2026.</desc>
<rect width="{WIDTH}" height="{HEIGHT}" fill="#e9ddc5"/>
<g fill="#cad2b3">{''.join(parks)}</g>
<g fill="#d9c5a8" stroke="#c0aa8a" stroke-width="1">{''.join(buildings)}</g>
<g stroke-linejoin="round" stroke-linecap="round">{''.join(roads)}</g>
<g fill="#555c4c" stroke="#fff4db" stroke-width="4" paint-order="stroke" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="600">{''.join(labels)}</g>
<g fill="#52654a" font-family="system-ui,sans-serif" font-size="18"><text x="1140" y="50">N ↑</text></g>
</svg>'''
    target = Path(__file__).resolve().parents[1] / 'apps/gadeos/town-map.svg'
    target.write_text(content, encoding='utf-8')
    print(f'{target.name}: {len(content.encode())} bytes')


if __name__ == '__main__':
    build(sys.argv[1])
