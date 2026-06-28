import { state } from './state.js';
import { esc, parseMd } from './utils.js';

/* ==================== CONTENT BLOCKS ==================== */
export function renderContentBlock(block) {
    const el = document.createElement('div');
    switch (block.type) {
        case 'text':
            el.className = 'content-text';
            el.innerHTML = parseMd(block.content || '');
            break;
        case 'latex':
            el.className = 'content-latex';
            el.textContent = '$$' + (block.content || '') + '$$';
            break;
        case 'table': {
            el.className = 'content-table-wrapper';
            let h = '<table class="content-table">';
            if (block.headers) {
                h += '<thead><tr>' + block.headers.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead>';
            }
            if (block.rows) {
                h += '<tbody>' + block.rows.map((row) =>
                    '<tr>' + row.map((c) => '<td>' + esc(String(c)) + '</td>').join('') + '</tr>'
                ).join('') + '</tbody>';
            }
            h += '</table>';
            el.innerHTML = h;
            break;
        }
        case 'list': {
            const ul = document.createElement('ul');
            ul.className = 'content-list';
            (block.items || []).forEach((item) => {
                const li = document.createElement('li');
                li.innerHTML = parseMd(item);
                ul.appendChild(li);
            });
            el.appendChild(ul);
            break;
        }
        case 'image': {
            const img = document.createElement('img');
            img.src = block.src || '';
            img.alt = block.alt || '';
            img.style.maxWidth = '100%';
            img.style.borderRadius = 'var(--r-md)';
            img.style.margin = '12px 0';
            el.appendChild(img);
            break;
        }
        case 'mermaid': {
            el.className = 'content-mermaid';
            el.dataset.mermaidCode = block.content || '';
            el.textContent = 'Loading diagram...';
            break;
        }
        case 'chart': {
            el.className = 'content-chart';
            const canvas = document.createElement('canvas');
            canvas.id = 'chart-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            el.appendChild(canvas);
            el.dataset.chartConfig = JSON.stringify(block);
            break;
        }
        default:
            el.className = 'content-text';
            el.innerHTML = parseMd(block.content || JSON.stringify(block));
    }
    return el;
}

/* ==================== MATH ==================== */
export function renderAllMath(container) {
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true },
            ],
            throwOnError: false,
            trust: true,
        });
    }
}

/* ==================== MERMAID ==================== */
let mermaidCounter = 0;

export function initMermaid() {
    if (typeof mermaid !== 'undefined') {
        const theme = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'dark' : 'default';
        mermaid.initialize({ startOnLoad: false, theme: theme, securityLevel: 'loose' });
    }
}

export async function renderMermaidBlocks(container) {
    if (typeof mermaid === 'undefined') return;
    const blocks = container.querySelectorAll('.content-mermaid[data-mermaid-code]');
    for (const block of blocks) {
        const code = block.dataset.mermaidCode;
        if (!code) continue;
        try {
            mermaidCounter++;
            const id = 'mermaid-' + mermaidCounter;
            const { svg } = await mermaid.render(id, code);
            block.innerHTML = svg;
        } catch (e) {
            console.error('Mermaid render error:', e);
            block.innerHTML = '<em style="color:var(--error)">Erreur de diagramme</em>';
        }
    }
}

/* ==================== CHARTS ==================== */
export function renderCharts(container) {
    if (typeof Chart === 'undefined') return;
    // Destroy previous chart instances
    state.chartInstances.forEach((c) => c.destroy());
    state.chartInstances = [];

    const blocks = container.querySelectorAll('.content-chart[data-chart-config]');
    const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
    const textColor = isDark ? '#e8e8f0' : '#1a1a2e';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

    const defaultColors = ['#7b6cf6','#f472b6','#34d399','#fbbf24','#60a5fa','#fb7185','#a78bfa','#38bdf8'];

    blocks.forEach((block) => {
        try {
            const config = JSON.parse(block.dataset.chartConfig);
            const canvas = block.querySelector('canvas');
            if (!canvas) return;

            const datasets = (config.data && config.data.datasets || []).map((ds, i) => ({
                ...ds,
                backgroundColor: ds.backgroundColor || defaultColors[i % defaultColors.length] + '99',
                borderColor: ds.borderColor || defaultColors[i % defaultColors.length],
                borderWidth: ds.borderWidth || 2,
            }));

            const chart = new Chart(canvas, {
                type: config.chartType || 'bar',
                data: { labels: config.data.labels || [], datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { labels: { color: textColor, font: { family: 'Inter' } } },
                        title: config.title ? { display: true, text: config.title, color: textColor, font: { family: 'Inter', size: 14 } } : undefined,
                    },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { color: gridColor } },
                        y: { ticks: { color: textColor }, grid: { color: gridColor } },
                    },
                    ...(config.options || {}),
                },
            });
            state.chartInstances.push(chart);
        } catch (e) {
            console.error('Chart render error:', e);
            block.innerHTML = '<em style="color:var(--error)">Erreur de graphique</em>';
        }
    });
}
