"""Single-computer guardhouse prototype. Start with python app.py."""
import base64, io, json, re, secrets, sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from functools import wraps
import requests
from PIL import Image, ImageOps
from flask import Flask, request, session, redirect, url_for, render_template, abort, flash, send_file
from werkzeug.security import check_password_hash

ROOT = Path(__file__).resolve().parent
TZ = timezone(timedelta(hours=8))
def now(): return datetime.now(TZ).isoformat(timespec='seconds')
def plate(value): return re.sub('[^A-Z0-9]', '', value.upper())
def create_app(config=None, data_dir=None):
    cfg = config or json.loads((ROOT/'config.json').read_text())
    data = Path(data_dir or ROOT/'data'); data.mkdir(exist_ok=True)
    app = Flask(__name__)
    app.config.update(SECRET_KEY=cfg['secret_key'], MAX_CONTENT_LENGTH=6*1024*1024,
                      SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Strict')
    def db():
        c=sqlite3.connect(data/'gate.db'); c.row_factory=sqlite3.Row
        c.execute('PRAGMA foreign_keys=ON'); return c
    with db() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS residents(id INTEGER PRIMARY KEY,name TEXT NOT NULL,address TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS passes(plate TEXT PRIMARY KEY,resident_id INTEGER NOT NULL REFERENCES residents(id),expiry TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS scans(id TEXT PRIMARY KEY,photo BLOB,ocr TEXT,created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS visits(id INTEGER PRIMARY KEY,scan_id TEXT UNIQUE REFERENCES scans(id),plate TEXT NOT NULL,kind TEXT NOT NULL,driver TEXT,resident_id INTEGER REFERENCES residents(id),destination TEXT,purpose TEXT,id_photo BLOB,entry TEXT NOT NULL,exit TEXT,guard TEXT NOT NULL,exit_guard TEXT);
        CREATE UNIQUE INDEX IF NOT EXISTS one_inside ON visits(plate) WHERE exit IS NULL;
        ''')
    @app.before_request
    def secure():
        if request.host.split(':')[0] not in ('localhost','127.0.0.1'): abort(400)
        if 'csrf' not in session: session['csrf']=secrets.token_hex(24)
        if request.method=='POST' and not secrets.compare_digest(request.form.get('csrf',''),session['csrf']): abort(400,'Expired form. Refresh and try again.')
    @app.after_request
    def headers(response):
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['X-Frame-Options']='DENY'
        return response
    def auth(fn):
        @wraps(fn)
        def wrapped(*a,**kw):
            if not session.get('logged_in'): return redirect(url_for('login'))
            return fn(*a,**kw)
        return wrapped
    def photo(raw):
        if not raw or len(raw)>5*1024*1024: raise ValueError('Missing or oversized image.')
        im=Image.open(io.BytesIO(raw)); im.load()
        if im.width*im.height>16000000: raise ValueError('Image is too large.')
        im=ImageOps.exif_transpose(im).convert('RGB'); im.thumbnail((1600,1600))
        out=io.BytesIO(); im.save(out,'JPEG',quality=90); return out.getvalue()
    def status(p):
        with db() as c:
            row=c.execute('SELECT p.*,r.name,r.address FROM passes p JOIN residents r ON r.id=p.resident_id WHERE plate=?',(p,)).fetchone()
        active=bool(row and row['active'] and row['expiry']>=now()[:10])
        return row, active
    @app.route('/login',methods=['GET','POST'])
    def login():
        if request.method=='POST':
            if check_password_hash(cfg['password_hash'],request.form.get('password','')):
                session.clear(); session.update(logged_in=True,csrf=secrets.token_hex(24)); return redirect('/')
            flash('Incorrect password.')
        return render_template('login.html')
    @app.post('/logout')
    def logout(): session.clear(); return redirect('/login')
    @app.get('/')
    @auth
    def home():
        q=request.args.get('q','').strip()
        with db() as c:
            inside=c.execute('SELECT * FROM visits WHERE exit IS NULL AND plate LIKE ? ORDER BY entry DESC',('%'+plate(q)+'%',)).fetchall()
            history=c.execute('SELECT * FROM visits WHERE exit IS NOT NULL AND plate LIKE ? ORDER BY id DESC LIMIT 100',('%'+plate(q)+'%',)).fetchall()
        return render_template('home.html',inside=inside,history=history,q=q)
    @app.post('/scan')
    @auth
    def scan():
        try:
            if request.files.get('image') and request.files['image'].filename:
                raw=request.files['image'].read()
            elif request.form.get('manual')=='yes': raw=None
            else:
                # Only the administrator-configured camera URL is fetched.
                with requests.get(cfg['camera_url'].rstrip('/')+'/capture',headers={'X-Camera-Key':cfg['camera_key']},timeout=(4,12),stream=True,allow_redirects=False) as res:
                    res.raise_for_status(); chunks=[]; size=0
                    for chunk in res.iter_content(65536):
                        size+=len(chunk)
                        if size>5*1024*1024: raise ValueError('Camera response too large.')
                        chunks.append(chunk)
                    raw=b''.join(chunks)
            jpg=photo(raw) if raw else None
            detected=''
            if jpg:
                try:
                    import pytesseract
                    if cfg.get('tesseract_cmd'): pytesseract.pytesseract.tesseract_cmd=cfg['tesseract_cmd']
                    im=Image.open(io.BytesIO(jpg))
                    # A fixed central guide, not an automatic plate detector.
                    w,h=im.size; im=im.crop((int(w*.1),int(h*.35),int(w*.9),int(h*.65)))
                    im=ImageOps.autocontrast(ImageOps.grayscale(im)); im=im.resize((im.width*2,im.height*2))
                    detected=plate(pytesseract.image_to_string(im,config='--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',timeout=12))[:12]
                except Exception:
                    flash('OCR unavailable or timed out. Read the photo and enter the plate manually.')
            sid=secrets.token_hex(16)
            with db() as c: c.execute('INSERT INTO scans VALUES(?,?,?,?)',(sid,jpg,detected,now()))
            return redirect(url_for('review',sid=sid))
        except Exception:
            flash('Capture failed. Check camera IP, key, Wi-Fi and power; retry or use manual entry.')
            return redirect('/')
    @app.route('/review/<sid>',methods=['GET','POST'])
    @auth
    def review(sid):
        with db() as c:
            scan=c.execute('SELECT * FROM scans WHERE id=?',(sid,)).fetchone()
            residents=c.execute('SELECT * FROM residents ORDER BY name').fetchall()
        if not scan: abort(404)
        p=plate(request.form.get('plate',scan['ocr'] or ''))
        checked=request.method=='POST'
        match,active=status(p) if p else (None,False)
        if checked and not (3<=len(p)<=12):
            flash('Enter a plate containing 3–12 letters/numbers.'); checked=False
        return render_template('review.html',scan=scan,p=p,checked=checked,match=match,active=active,residents=residents)
    @app.post('/admit/<sid>')
    @auth
    def admit(sid):
        p=plate(request.form.get('plate','')); guard=request.form.get('guard','').strip()[:100]
        if not (3<=len(p)<=12) or not guard: abort(400,'Plate and guard name are required.')
        match,active=status(p)
        # Never trust a hidden form field to authorize a pass.
        if request.form.get('expected_kind') != ('pass' if active else 'visitor'):
            flash('Pass status changed. Check the plate again.'); return redirect(url_for('review',sid=sid))
        driver=request.form.get('driver','').strip()[:150]; purpose=request.form.get('purpose','').strip()[:300]
        id_photo=None
        with db() as c:
            if not c.execute('SELECT 1 FROM scans WHERE id=?',(sid,)).fetchone(): abort(404)
            if active:
                rid=match['resident_id']; dest=match['name']+' — '+match['address']
            else:
                resident=c.execute('SELECT * FROM residents WHERE id=?',(request.form.get('resident_id'),)).fetchone()
                if not resident or not driver or not purpose: abort(400,'Driver, purpose and registered destination are required.')
                rid=resident['id']; dest=resident['name']+' — '+resident['address']
                try:
                    encoded=request.form.get('id_image','')
                    if not encoded.startswith('data:image/jpeg;base64,'): raise ValueError()
                    id_photo=photo(base64.b64decode(encoded.split(',',1)[1],validate=True))
                except Exception: abort(400,'Capture a readable ID photo using the webcam first.')
            try:
                c.execute('INSERT INTO visits(scan_id,plate,kind,driver,resident_id,destination,purpose,id_photo,entry,guard) VALUES(?,?,?,?,?,?,?,?,?,?)',
                          (sid,p,'pass' if active else 'visitor',driver,rid,dest,purpose,id_photo,now(),guard))
            except sqlite3.IntegrityError:
                flash('Already recorded: this scan was used or this plate is still marked Inside.'); return redirect('/')
        flash('Entry saved.'); return redirect('/')
    @app.post('/exit/<int:vid>')
    @auth
    def leave(vid):
        guard=request.form.get('guard','').strip()[:100]
        if not guard: abort(400,'Guard name is required.')
        with db() as c:
            result=c.execute('UPDATE visits SET exit=?,exit_guard=? WHERE id=? AND exit IS NULL',(now(),guard,vid))
        flash('Exit saved.' if result.rowcount else 'Already exited or record not found.')
        return redirect('/')
    @app.get('/photo/<kind>/<ident>')
    @auth
    def image(kind,ident):
        with db() as c:
            if kind=='plate': r=c.execute('SELECT photo FROM scans WHERE id=?',(ident,)).fetchone()
            elif kind=='id': r=c.execute('SELECT id_photo FROM visits WHERE id=?',(ident,)).fetchone()
            else: abort(404)
        if not r or not r[0]: abort(404)
        return send_file(io.BytesIO(r[0]),mimetype='image/jpeg')
    @app.route('/registry',methods=['GET','POST'])
    @auth
    def registry():
        if request.method=='POST':
            if not check_password_hash(cfg['password_hash'],request.form.get('password','')): abort(403,'Re-enter the supervisor password to change the registry.')
            try:
                with db() as c:
                    if request.form.get('action')=='resident':
                        name=request.form.get('name','').strip()[:150]; address=request.form.get('address','').strip()[:200]
                        if not name or not address: raise ValueError()
                        c.execute('INSERT INTO residents(name,address) VALUES(?,?)',(name,address))
                    else:
                        p=plate(request.form.get('plate','')); expiry=request.form.get('expiry','')
                        datetime.strptime(expiry,'%Y-%m-%d')
                        if not 3<=len(p)<=12: raise ValueError()
                        c.execute('INSERT INTO passes VALUES(?,?,?,?) ON CONFLICT(plate) DO UPDATE SET resident_id=excluded.resident_id,expiry=excluded.expiry,active=excluded.active',
                                  (p,request.form['resident_id'],expiry,1 if request.form.get('active') else 0))
                flash('Registry saved.')
            except (ValueError,sqlite3.IntegrityError,KeyError): flash('Check all fields and select an existing resident.')
            return redirect('/registry')
        with db() as c:
            residents=c.execute('SELECT * FROM residents ORDER BY name').fetchall()
            passes=c.execute('SELECT p.*,r.name FROM passes p JOIN residents r ON r.id=p.resident_id ORDER BY plate').fetchall()
        return render_template('registry.html',residents=residents,passes=passes)
    return app
if __name__=='__main__':
    from waitress import serve
    if not (ROOT/'config.json').exists(): raise SystemExit('Run python configure.py first.')
    print('Open http://localhost:5000 — Ctrl+C to stop. Keep this terminal open.')
    serve(create_app(),host='127.0.0.1',port=5000,threads=4)
