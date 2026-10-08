from PIL import Image, ImageDraw
from pathlib import Path
out = Path(__file__).resolve().parents[1] / 'icons'
out.mkdir(exist_ok=True)
canvas = Image.new('RGB', (1024,1024), '#142033')
d = ImageDraw.Draw(canvas)
d.rounded_rectangle((290,202,734,822), radius=70, fill='#f5c65c')
d.rounded_rectangle((340,256,684,406), radius=28, fill='#142033')
d.line((396,354,448,302,500,354), fill='#f3f6fc', width=13)
d.line((546,314,630,314), fill='#f3f6fc', width=13)
d.line((546,350,630,350), fill='#f3f6fc', width=13)
for x in [350,454]:
    for y in [460,562,664]:
        d.rounded_rectangle((x,y,x+66,y+64),radius=15,fill='#142033')
d.rounded_rectangle((566,460,670,728),radius=23,fill='#142033')
d.line((588,595,648,595),fill='#f5c65c',width=13)
d.line((618,565,618,625),fill='#f5c65c',width=13)
for name, size in [('icon-192.png',192),('icon-512.png',512),('maskable-512.png',512),('favicon.png',32),('apple-touch-icon.png',180)]:
    canvas.resize((size,size),Image.Resampling.LANCZOS).save(out/name,'PNG')
print('Created 5 genuine PNG icons; maskable foreground stays within the central 80% circle.')
