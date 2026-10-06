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

// Parse YAML front-matter and body content from Markdown string
function parseMarkdownFrontMatter(text) {
    const getField = (field) => {
        const regex = new RegExp(`${field}:\\s*["']?(.*?)["']?\\s*$`, 'm');
        const match = text.match(regex);
        return match ? match[1].trim() : "";
    };

    // Extract body (everything after the second '---' separator)
    const parts = text.split('---');
    let bodyContent = "";
    if (parts.length >= 3) {
        bodyContent = parts.slice(2).join('---').trim();
    }

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
        excerpt: getField("excerpt") || "",
        body: bodyContent
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

    projectsToDisplay.forEach((project, index) => {
        const card = document.createElement('div');
        card.className = 'project-card';
        
        const metaText = project.author 
            ? `${project.author} • ${project.category}` 
            : project.category;

        // Render project details with expandable body section
        card.innerHTML = `
            <div class="image-container">
                <img src="${project.image || 'https://via.placeholder.com/600x400'}" alt="${project.title}" loading="lazy">
            </div>
            <div class="meta">${metaText}</div>
            <h2 class="project-title">${project.title}</h2>
            <p class="excerpt">${project.excerpt}</p>
            
            ${project.body ? `
                <button class="toggle-btn" onclick="toggleDetails(${index})">Read Full Details</button>
                <div id="details-${index}" class="full-details" style="display: none; margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    ${formatMarkdownBody(project.body)}
                </div>
            ` : ''}
        `;
        grid.appendChild(card);
    });
}

// Toggle full project description visibility
function toggleDetails(index) {
    const detailsDiv = document.getElementById(`details-${index}`);
    const btn = detailsDiv.previousElementSibling;
    
    if (detailsDiv.style.display === "none") {
        detailsDiv.style.display = "block";
        btn.innerText = "Hide Details";
    } else {
        detailsDiv.style.display = "none";
        btn.innerText = "Read Full Details";
    }
}

// Simple helper to convert line breaks and basic formatting in Markdown body
function formatMarkdownBody(bodyText) {
    return bodyText
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

// Filter projects by category on button click
function filterProjects(category, btnElement) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    if (category === 'ALL') {
        renderProjects(allProjects);
    } else {
        const filtered = allProjects.filter(p => p.category.toUpperCase().includes(category.toUpperCase()));
        renderProjects(filtered);
    }
}

// Render status / error messages in the grid
function renderMessage(message) {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = `<p class="loading-text">${message}</p>`;
}
