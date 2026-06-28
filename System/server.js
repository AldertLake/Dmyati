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

// POST /api/modules
app.post('/api/modules', (req, res) => {
    try {
        const { name, icon } = req.body;
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
        res.json({ success: true, message: 'Update applied. Restarting server...' });
        
        // Let the response send, then exit with code 42 to trigger our start.bat loop
        setTimeout(() => {
            console.log('Update applied, exiting process with code 42 to trigger restart.');
            process.exit(42);
        }, 1000);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
