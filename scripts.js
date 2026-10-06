// Configuration
const username = "RihardsVitols";
const repo = "FoC";
let allProjects = [];

// Initialize fetch process when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    fetchProjects();
});

// Fetch project Markdown files from GitHub API
function fetchProjects() {
    fetch(`https://api.github.com/repos/${username}/${repo}/contents/content/projects`)
        .then(res => {
            if (!res.ok) throw new Error("No content directory found");
            return res.json();
        })
        .then(files => {
            const mdFiles = files.filter(f => f.name.endsWith('.md'));
            
            if (mdFiles.length === 0) {
                renderMessage("No published projects yet.");
                return;
            }

            const fetchPromises = mdFiles.map(file =>
                fetch(file.download_url)
                    .then(res => res.text())
                    .then(text => parseMarkdownFrontMatter(text))
            );

            return Promise.all(fetchPromises);
        })
        .then(projects => {
            if (projects) {
                allProjects = projects;
                renderProjects(allProjects);
            }
        })
        .catch(err => {
            console.error("Error loading projects:", err);
            renderMessage("No projects published in content/projects yet.");
        });
}

// Parse YAML front-matter key/value pairs from Markdown string
function parseMarkdownFrontMatter(text) {
    const getField = (field) => {
        const regex = new RegExp(`${field}:\\s*["']?(.*?)["']?\\s*$`, 'm');
        const match = text.match(regex);
        return match ? match[1].trim() : "";
    };

    let imagePath = getField("image");

    // Clean leading slash if present
    if (imagePath.startsWith('/')) {
        imagePath = imagePath.substring(1);
    }

    // Ensure full relative path for GitHub Pages subfolder (/FoC/)
    if (imagePath && !imagePath.startsWith('http')) {
        imagePath = `https://rihardsvitols.github.io/FoC/${imagePath}`;
    }

    return {
        title: getField("title") || "Untitled Project",
        author: getField("author") || "",
        date: getField("date") || "",
        category: getField("category") || "Uncategorized",
        image: imagePath,
        excerpt: getField("excerpt") || ""
    };
}
// Build and inject project cards into the DOM
function renderProjects(projectsToDisplay) {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = ''; 

    if (projectsToDisplay.length === 0) {
        renderMessage("No projects in this category.");
        return;
    }

    projectsToDisplay.forEach(project => {
        const card = document.createElement('a');
        card.href = "#";
        card.className = 'project-card';
        
        const metaText = project.author 
            ? `${project.author} •${project.category}` 
            : project.category;

        card.innerHTML = `
            <div class="image-container">
                <img src="${project.image \vert{}\vert{} 'https://via.placeholder.com/600x400'}" alt="${project.title}" loading="lazy
