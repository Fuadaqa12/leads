// Хранилища базы: локальный файл (для разработки) или секретный GitHub Gist (для бесплатного хостинга без диска).
// Оба отдают одинаковый мини-интерфейс: list({prefix}), get(key), put(obj), commit().
import fs from 'node:fs';
import path from 'node:path';

class MemoryKV {
  constructor(data = {}) { this.data = data; this.dirty = false; }
  async list({ prefix = '' } = {}) { return new Map(Object.entries(this.data).filter(([k]) => k.startsWith(prefix))); }
  async get(k) { return this.data[k]; }
  async put(obj) { Object.assign(this.data, obj); this.dirty = true; }
}

export class FileKV extends MemoryKV {
  constructor(file) {
    let data = {};
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* новая база */ }
    super(data);
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  async commit() {
    if (!this.dirty) return;
    this.dirty = false;
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data));
    fs.renameSync(this.file + '.tmp', this.file);
  }
}

const GIST_DESC = 'arena-haosa-db (база игры Арена Хаоса, не удалять)';
const FILE_NAME = 'arena-db.json';

export class GistKV extends MemoryKV {
  constructor(token) { super({}); this.token = token; this.id = null; this.busy = false; }

  async gh(method, url, body) {
    const r = await fetch('https://api.github.com' + url, {
      method,
      headers: { authorization: `Bearer ${this.token}`, accept: 'application/vnd.github+json', 'user-agent': 'arena-haosa', 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`GitHub ${method} ${url}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  // Ищем свой gist по описанию, если нет — создаём секретный
  async init() {
    for (let page = 1; page <= 10 && !this.id; page++) {
      const list = await this.gh('GET', `/gists?per_page=100&page=${page}`);
      const g = list.find(x => x.description === GIST_DESC);
      if (g) this.id = g.id;
      if (list.length < 100) break;
    }
    if (!this.id) {
      const g = await this.gh('POST', '/gists', { description: GIST_DESC, public: false, files: { [FILE_NAME]: { content: '{}' } } });
      this.id = g.id;
      console.log('Создал базу в секретном gist', this.id);
      return;
    }
    const g = await this.gh('GET', `/gists/${this.id}`);
    const f = g.files[FILE_NAME];
    let text = f?.content || '{}';
    if (f?.truncated) text = await (await fetch(f.raw_url)).text();
    this.data = JSON.parse(text || '{}');
    console.log('База загружена из gist, игроков:', Object.keys(this.data).filter(k => k.startsWith('p:')).length);
  }

  async commit() {
    if (!this.dirty || this.busy || !this.id) return;
    this.busy = true; this.dirty = false;
    try {
      await this.gh('PATCH', `/gists/${this.id}`, { files: { [FILE_NAME]: { content: JSON.stringify(this.data) } } });
    } catch (e) {
      this.dirty = true;
      console.error('Не смог сохранить базу:', e.message);
    } finally { this.busy = false; }
  }
}
