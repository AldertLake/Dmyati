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

export function parseMd(text, inline = false) {
    if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
        
        // Protect Math blocks from marked parsing (prevents escaping of LaTeX chars)
        const mathBlocks = [];
        let processedText = text.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g, (match) => {
            mathBlocks.push(match);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });
        
        let html = '';
        if (inline && marked.parseInline) {
            html = marked.parseInline(processedText);
        } else if (marked.parse) {
            html = marked.parse(processedText);
        } else {
            html = processedText.replace(/\n/g, '<br>');
        }
        
        // Wrap tables natively
        html = html.replace(/<table(.*?)>/g, '<div class="content-table-wrapper"><table class="content-table"$1>');
        html = html.replace(/<\/table>/g, '</table></div>');
        
        // Parse GitHub Alerts
        html = html.replace(/<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br>|\n|\s*)([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi, (match, type, contentP, contentRest) => {
            const t = type.toUpperCase();
            const content = (contentP + contentRest).trim();
            return `<div class="github-alert github-alert-${t.toLowerCase()}"><div class="github-alert-title">${t}</div><div class="github-alert-content">${content}</div></div>`;
        });
        
        // Restore Math blocks
        html = html.replace(/@@MATH_BLOCK_(\d+)@@/g, (match, i) => {
            return mathBlocks[i];
        });
        
        return html;
    }
    return text.replace(/\n/g, '<br>');
}
