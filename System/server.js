const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the root directory
const projectRoot = path.join(__dirname, '..');
app.use(express.static(projectRoot));

const modulesFilePath = path.join(projectRoot, 'Modules', 'modules.json');

// Helper to normalize strings for folder names
function sanitizeFolderName(name) {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
}

// GET /api/modules
app.get('/api/modules', (req, res) => {
    try {
        if (!fs.existsSync(modulesFilePath)) {
            return res.json({ modules: [] });
        }
        
        const raw = fs.readFileSync(modulesFilePath, 'utf8');
        const data = JSON.parse(raw);
        const modules = data.modules || [];

        // Enrich with sourceCount and folder status
        for (let mod of modules) {
            mod.sourceCount = 0;
            mod.folderExists = false;
            mod.hasAgents = false;

            if (mod.folder) {
                const modPath = path.join(projectRoot, 'Modules', mod.folder);
                
                if (fs.existsSync(modPath)) {
                    mod.folderExists = true;
                    
                    const sourcePath = path.join(modPath, 'source');
                    if (fs.existsSync(sourcePath)) {
                        const files = fs.readdirSync(sourcePath, { withFileTypes: true });
                        const fileCount = files.filter(dirent => dirent.isFile()).length;
                        mod.sourceCount = fileCount;
                    }
                    
                    const agentsPath = path.join(modPath, '.agents', 'AGENTS.md');
                    if (fs.existsSync(agentsPath)) {
                        mod.hasAgents = true;
                    }
                }
            }
        }
        
        res.json({ modules });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to read modules' });
    }
});

// GET /api/music
app.get('/api/music', (req, res) => {
    try {
        const musicPath = path.join(projectRoot, 'Music');
        if (!fs.existsSync(musicPath)) {
            fs.mkdirSync(musicPath);
            return res.json({ songs: [] });
        }
        const files = fs.readdirSync(musicPath);
        const songs = files.filter(f => /\.(mp3|wav|ogg)$/i.test(f));
        res.json({ songs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to read music folder' });
    }
});

// POST /api/modules
app.post('/api/modules', (req, res) => {
    try {
        const { name, icon, info } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const folderName = sanitizeFolderName(name) || 'NouveauModule';
        let uniqueFolder = folderName;
        let counter = 1;

        // Make sure folder doesn't already exist
        while (fs.existsSync(path.join(projectRoot, 'Modules', uniqueFolder))) {
            uniqueFolder = `${folderName}${counter}`;
            counter++;
        }

        const id = uniqueFolder.toLowerCase();
        
        // Update modules.json
        let data = { modules: [] };
        if (fs.existsSync(modulesFilePath)) {
            data = JSON.parse(fs.readFileSync(modulesFilePath, 'utf8'));
        }
        
        const newModule = {
            id,
            name,
            icon: icon || '📘',
            folder: uniqueFolder
        };
        
        data.modules.push(newModule);
        fs.writeFileSync(modulesFilePath, JSON.stringify(data, null, 2), 'utf8');

        // Create folders
        const modPath = path.join(projectRoot, 'Modules', uniqueFolder);
        fs.mkdirSync(modPath, { recursive: true });
        
        const exercicesPath = path.join(modPath, 'exercices');
        const courPath = path.join(modPath, 'Cour');
        const sourcePath = path.join(modPath, 'source');
        
        fs.mkdirSync(exercicesPath, { recursive: true });
        fs.mkdirSync(courPath, { recursive: true });
        fs.mkdirSync(sourcePath, { recursive: true });

        // Create empty index.json files
        fs.writeFileSync(path.join(exercicesPath, 'index.json'), JSON.stringify({ exercises: [] }, null, 2), 'utf8');
        fs.writeFileSync(path.join(courPath, 'index.json'), JSON.stringify({ lessons: [] }, null, 2), 'utf8');

        // Copy .agents template to the new module
        const templateAgentsPath = path.join(__dirname, 'agent_templates', '.agents');
        const destAgentsPath = path.join(modPath, '.agents');
        if (fs.existsSync(templateAgentsPath)) {
            fs.cpSync(templateAgentsPath, destAgentsPath, { recursive: true });
        }

        // Write custom info.txt if provided
        if (info && info.trim().length > 0) {
            fs.writeFileSync(path.join(modPath, 'info.txt'), info.trim(), 'utf8');
        }

        res.json({ success: true, module: newModule });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create module' });
    }
});

// GET /api/update/check
app.get('/api/update/check', (req, res) => {
    // First, check if it's a git repo at all
    if (!fs.existsSync(path.join(projectRoot, '.git'))) {
        return res.json({ isRepo: false, updateAvailable: false });
    }

    exec('git fetch origin', { cwd: projectRoot }, (error) => {
        if (error) {
            return res.json({ isRepo: true, updateAvailable: false, error: 'Git fetch failed' });
        }
        exec('git status -sb', { cwd: projectRoot }, (err, stdout) => {
            if (err) {
                return res.json({ isRepo: true, updateAvailable: false, error: 'Git status failed' });
            }
            // Output looks like: ## main...origin/main [behind 1]
            if (stdout.includes('[behind')) {
                return res.json({ isRepo: true, updateAvailable: true });
            }
            res.json({ isRepo: true, updateAvailable: false });
        });
    });
});

// POST /api/update/apply
app.post('/api/update/apply', (req, res) => {
    exec('git pull origin main', { cwd: projectRoot }, (error, stdout) => {
        if (error) {
            return res.status(500).json({ error: 'Git pull failed', details: error.message });
        }
        
        // Auto-sync updated templates to all existing modules
        try {
            const templateAgentsPath = path.join(__dirname, 'agent_templates', '.agents');
            const modulesDir = path.join(projectRoot, 'Modules');
            if (fs.existsSync(templateAgentsPath) && fs.existsSync(modulesDir)) {
                const moduleFolders = fs.readdirSync(modulesDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                moduleFolders.forEach(folder => {
                    const destAgentsPath = path.join(modulesDir, folder, '.agents');
                    fs.cpSync(templateAgentsPath, destAgentsPath, { recursive: true, force: true });
                });
                console.log('Successfully synced agent templates to all modules.');
            }
        } catch(e) {
            console.error('Failed to sync agent templates during update', e);
        }

        res.json({ success: true, message: 'Update applied. Restarting server...' });
        
        // Let the response send, then exit with code 42 to trigger our start.bat loop
        setTimeout(() => {
            console.log('Update applied, exiting process with code 42 to trigger restart.');
            process.exit(42);
        }, 1000);
    });
});

// PUT /api/modules/:folder
app.put('/api/modules/:folder', (req, res) => {
    try {
        const { folder } = req.params;
        const { name, icon } = req.body;
        
        let data = JSON.parse(fs.readFileSync(modulesFilePath, 'utf8'));
        const moduleIndex = data.modules.findIndex(m => m.folder === folder);
        if (moduleIndex === -1) return res.status(404).json({ error: 'Module not found' });
        
        if (name) data.modules[moduleIndex].name = name;
        if (icon !== undefined) data.modules[moduleIndex].icon = icon;
        
        fs.writeFileSync(modulesFilePath, JSON.stringify(data, null, 2), 'utf8');
        res.json({ success: true, module: data.modules[moduleIndex] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update module' });
    }
});

// DELETE /api/modules/:folder
app.delete('/api/modules/:folder', (req, res) => {
    try {
        const { folder } = req.params;
        let data = JSON.parse(fs.readFileSync(modulesFilePath, 'utf8'));
        const initialLength = data.modules.length;
        data.modules = data.modules.filter(m => m.folder !== folder);
        
        if (data.modules.length === initialLength) {
            return res.status(404).json({ error: 'Module not found' });
        }
        
        fs.writeFileSync(modulesFilePath, JSON.stringify(data, null, 2), 'utf8');
        
        const modPath = path.join(projectRoot, 'Modules', folder);
        if (fs.existsSync(modPath)) {
            fs.rmSync(modPath, { recursive: true, force: true });
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete module' });
    }
});

// GET /api/progress
const progressFilePath = path.join(__dirname, 'progress.json');
app.get('/api/progress', (req, res) => {
    try {
        if (!fs.existsSync(progressFilePath)) {
            return res.json({});
        }
        const data = fs.readFileSync(progressFilePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to load progress' });
    }
});

// POST /api/progress
app.post('/api/progress', (req, res) => {
    try {
        fs.writeFileSync(progressFilePath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

// DELETE /api/modules/:folder/content/:type/:file
app.delete('/api/modules/:folder/content/:type/:file', (req, res) => {
    try {
        const { folder, type, file } = req.params;
        const validTypes = ['Cour', 'exercices'];
        if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

        const dirPath = path.join(projectRoot, 'Modules', folder, type);
        const filePath = path.join(dirPath, file);
        const indexPath = path.join(dirPath, 'index.json');

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        if (fs.existsSync(indexPath)) {
            let data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            const key = type === 'Cour' ? 'lessons' : 'exercises';
            if (data[key]) {
                data[key] = data[key].filter(item => item.file !== file);
                fs.writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf8');
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete content' });
    }
});

// GET /api/modules/:folder/info
app.get('/api/modules/:folder/info', (req, res) => {
    try {
        const infoPath = path.join(projectRoot, 'Modules', req.params.folder, 'info.txt');
        if (fs.existsSync(infoPath)) {
            const info = fs.readFileSync(infoPath, 'utf8');
            res.json({ info });
        } else {
            res.json({ info: '' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to read info' });
    }
});

// PUT /api/modules/:folder/info
app.put('/api/modules/:folder/info', (req, res) => {
    try {
        const { info } = req.body;
        const infoPath = path.join(projectRoot, 'Modules', req.params.folder, 'info.txt');
        if (info && info.trim().length > 0) {
            fs.writeFileSync(infoPath, info.trim(), 'utf8');
        } else {
            if (fs.existsSync(infoPath)) fs.unlinkSync(infoPath);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to write info' });
    }
});
// GET /api/settings
app.get('/api/settings', (req, res) => {
    try {
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({}); // default empty settings
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

// POST /api/settings
app.post('/api/settings', (req, res) => {
    try {
        const settingsPath = path.join(__dirname, 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 4), 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// GET /api/objectives
app.get('/api/objectives', (req, res) => {
    try {
        const obsPath = path.join(__dirname, 'objectives.json');
        if (fs.existsSync(obsPath)) {
            const data = fs.readFileSync(obsPath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json([]); // default empty array
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to read objectives' });
    }
});

// POST /api/objectives
app.post('/api/objectives', (req, res) => {
    try {
        const obsPath = path.join(__dirname, 'objectives.json');
        fs.writeFileSync(obsPath, JSON.stringify(req.body, null, 4), 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save objectives' });
    }
});

// --- HOT RELOADING (SSE) ---
let sseClients = [];

app.get('/api/sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);
    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
});

app.post('/api/refresh', (req, res) => {
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'refresh' })}\n\n`);
    });
    res.json({ success: true, notified: sseClients.length });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
