from datetime import date
from pathlib import Path
from calendar import monthrange
import html

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
import pdfplumber

OUT = Path('output/pdf')
OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('GanttRegular', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('GanttBold', 'C:/Windows/Fonts/arialbd.ttf'))

W, H = 842, 595
pdf_path = OUT / 'ParkFinder_Gantt_Chart_2026.pdf'
c = canvas.Canvas(str(pdf_path), pagesize=(W, H))
c.setTitle('Figure 1. Gantt Chart - ParkFinder Project Schedule 2026')
c.setAuthor('ParkFinder')
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']

def rect(x,y,w,h,fill,stroke=None,radius=0):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    c.setLineWidth(.5)
    c.roundRect(x,y,w,h,radius,fill=1,stroke=bool(stroke))
    svg.append(f'<rect x="{x}" y="{H-y-h}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke or "none"}"/>')

def text(x,y,value,size=9,color='#334155',bold=False,anchor='start'):
    font='GanttBold' if bold else 'GanttRegular'
    c.setFont(font,size);c.setFillColor(HexColor(color))
    if anchor=='middle': c.drawCentredString(x,y,value)
    elif anchor=='end': c.drawRightString(x,y,value)
    else: c.drawString(x,y,value)
    svg.append(f'<text x="{x}" y="{H-y}" font-family="Arial, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}" text-anchor="{anchor}">{html.escape(value)}</text>')

def line(x1,y1,x2,y2,color='#E2E8F0',width=.5,dashed=False):
    c.setStrokeColor(HexColor(color));c.setLineWidth(width)
    c.setDash([2,3] if dashed else [])
    c.line(x1,y1,x2,y2);c.setDash([])
    dash='stroke-dasharray="2 3"' if dashed else ''
    svg.append(f'<line x1="{x1}" y1="{H-y1}" x2="{x2}" y2="{H-y2}" stroke="{color}" stroke-width="{width}" {dash}/>')

def diamond(x,y,size=4.5):
    c.setFillColor(HexColor('#0F172A'));c.setStrokeColor(HexColor('#FFFFFF'));c.setLineWidth(.8)
    p=c.beginPath();p.moveTo(x,y+size);p.lineTo(x+size,y);p.lineTo(x,y-size);p.lineTo(x-size,y);p.close()
    c.drawPath(p,fill=1,stroke=1)
    points=f'{x},{H-y-size} {x+size},{H-y} {x},{H-y+size} {x-size},{H-y}'
    svg.append(f'<polygon points="{points}" fill="#0F172A" stroke="#FFFFFF" stroke-width=".8"/>')

colors=['#2563EB','#0F766E','#B45309']
rows=[
 ('phase','01  CONCEPT PRESENTATION',None,None,0),
 ('task','Initial research and topic refinement','2026-01-05','2026-02-27',0),
 ('task','Chapter 1: Introduction','2026-01-19','2026-03-20',0),
 ('task','Chapter 2: Related literature','2026-02-02','2026-04-10',0),
 ('task','Review and preparation: Chapters 1-2','2026-04-13','2026-04-29',0),
 ('milestone','Concept Presentation Defense','2026-04-30',None,0),
 ('phase','02  PROJECT PROPOSAL',None,None,1),
 ('task','System wireframe and interface planning','2026-05-01','2026-05-22',1),
 ('task','Chapter 3: Methodology','2026-05-04','2026-05-22',1),
 ('task','Revisions: Chapters 1-3','2026-05-18','2026-06-01',1),
 ('milestone','Project Proposal Defense','2026-06-02',None,1),
 ('phase','03  DEVELOPMENT AND FINAL DEFENSE',None,None,2),
 ('task','System development and integration','2026-06-03','2026-09-30',2),
 ('task','Testing, SUS evaluation, and refinement','2026-10-01','2026-11-13',2),
 ('task','Documentation: Chapters 4-5','2026-10-19','2026-11-20',2),
 ('task','Final revisions and presentation preparation','2026-11-23','2026-11-30',2),
 ('milestone','Final Defense','2026-12-01',None,2),
]

rect(0,0,W,H,'#FFFFFF')
text(32,554,'PARKFINDER PROJECT SCHEDULE',21,'#0F172A',True)
text(32,535,'Proposed activity timeline | January-December 2026',10,'#64748B')

for x,label,col in [(32,'Concept stage',colors[0]),(159,'Proposal stage',colors[1]),(284,'Development and final stage',colors[2])]:
    rect(x,510,13,7,col,radius=2)
    text(x+19,509,label,8)
diamond(507,514,4)
text(518,509,'Defense milestone',8)

L,R,TOP,ROW=276,810,473,20
BOTTOM=TOP-len(rows)*ROW
start,end=date(2026,1,1),date(2027,1,1)
def xpos(value):
    dt=date.fromisoformat(value) if isinstance(value,str) else value
    return L+(dt-start).days/(end-start).days*(R-L)

rect(32,TOP,W-64,22,'#0F172A')
text(43,TOP+7,'ACTIVITY / MILESTONE',8.5,'#FFFFFF',True)
for month in range(1,13):
    left=xpos(date(2026,month,1))
    right=xpos(date(2027,1,1) if month==12 else date(2026,month+1,1))
    text((left+right)/2,TOP+7,date(2026,month,1).strftime('%b').upper(),8,'#FFFFFF',True,'middle')

for i,(kind,label,begin,finish,group) in enumerate(rows):
    y=TOP-(i+1)*ROW
    if kind=='phase':
        rect(32,y,W-64,ROW,['#EFF6FF','#F0FDFA','#FFFBEB'][group])
    elif i%2:
        rect(32,y,W-64,ROW,'#F8FAFC')
    line(32,y,R,y)

for month in range(1,13):
    x=xpos(date(2026,month,1));line(x,BOTTOM,x,TOP,'#E2E8F0')
line(R,BOTTOM,R,TOP)
line(32,BOTTOM,32,TOP)
for deadline in ['2026-04-30','2026-06-02','2026-12-01']:
    x=xpos(deadline);line(x,BOTTOM,x,TOP,'#94A3B8',.6,True)

for i,(kind,label,begin,finish,group) in enumerate(rows):
    y=TOP-(i+1)*ROW
    size=8.4 if kind!='phase' else 8.2
    available=R-43 if kind=='phase' else L-55
    assert pdfmetrics.stringWidth(label,'GanttBold' if kind in ('phase','milestone') else 'GanttRegular',size)<available,label
    text(43,y+7,label,size,colors[group] if kind=='phase' else '#0F172A',kind in ('phase','milestone'))
    if kind=='task':
        x1=xpos(begin);x2=xpos(date.fromordinal(date.fromisoformat(finish).toordinal()+1))
        rect(x1,y+5,max(x2-x1,2),10,colors[group],radius=2)
    elif kind=='milestone':
        x=xpos(begin);diamond(x,y+10)
        label_date=date.fromisoformat(begin).strftime('%b %d, %Y').replace(' 0',' ')
        text(x+9,y+7,label_date,8,'#0F172A',True)

text(W/2,108,'Figure 1. Gantt Chart',11,'#0F172A',True,'middle')
text(32,85,'Defense dates: April 30, 2026 | June 2, 2026 | December 1, 2026.',8.4,'#334155')
text(32,70,'Activity dates and durations are proposed planning estimates, not a record of completed work.',8.4,'#64748B')
text(32,55,'All three defense dates are shown in 2026; the January start is an assumed planning baseline.',8.4,'#64748B')
c.showPage();c.save()
svg.append('</svg>')
(OUT/'ParkFinder_Gantt_Chart_2026.svg').write_text('\n'.join(svg),encoding='utf-8')
with pdfplumber.open(pdf_path) as pdf:
    assert len(pdf.pages)==1
    pdf.pages[0].to_image(resolution=190).save(str(OUT/'ParkFinder_Gantt_Chart_2026.png'))
    for word in pdf.pages[0].extract_words():
        assert word['x0']>=0 and word['x1']<=W+.2 and word['top']>=0 and word['bottom']<=H+.2,word
for file in OUT.glob('ParkFinder_Gantt_Chart_2026.*'):
    print(file.resolve())
