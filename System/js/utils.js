export const $ = (id) => document.getElementById(id);

export function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

export function arrEq(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

export function showToast(msg, type) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast visible' + (type ? ' toast-' + type : '');
    clearTimeout(t._t);
    t._t = setTimeout(() => {
        t.classList.remove('visible');
        setTimeout(() => { t.className = 'toast hidden'; }, 300);
    }, 2500);
}

export function parseMd(text) {
    if (typeof marked !== 'undefined' && marked.parse) {
        marked.setOptions({ breaks: true, gfm: true });
        return marked.parse(text);
    }
    return text.replace(/\n/g, '<br>');
}
