// Configuration
const username = "RihardsVitols";
const repo = "FoC";

let allProjects = [];      // Stores all projects loaded from GitHub
let filteredProjects = []; // Stores projects matching the selected filter
let visibleCount = 0;      // Number of projects currently displayed

const INITIAL_LOAD = 9;   // First batch size
const BATCH_LOAD = 3;     // Number of projects to load on scroll

let observer; // IntersectionObserver instance

// Initialize fetch process when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    setupIntersectionObserver();
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
                // Sort projects by raw ISO date string: newest first
                allProjects = projects.sort((a, b) => {
                    const dateA = a.rawDate ? new Date(a.rawDate) : 0;
                    const dateB = b.rawDate ? new Date(b.rawDate) : 0;
                    return dateB - dateA;
                });
                filteredProjects = [...allProjects];
                resetAndRender();
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

    const parts = text.split('---');
    let bodyContent = parts.length >= 3 ? parts.slice(2).join('---').trim() : "";

    let imagePath = getField("image");
    if (imagePath.startsWith('/')) {
        imagePath = imagePath.substring(1);
    }
    if (imagePath && !imagePath.startsWith('http')) {
        imagePath = `https://rihardsvitols.github.io/FoC/${imagePath}`;
    }

    let pdfPath = getField("pdf");
    if (pdfPath.startsWith('/')) {
        pdfPath = pdfPath.substring(1);
    }
    if (pdfPath && !pdfPath.startsWith('http')) {
        pdfPath = `https://rihardsvitols.github.io/FoC/${pdfPath}`;
    }

    const rawDate = getField("date");
    const yearOnly = rawDate ? rawDate.substring(0, 4) : "";
    
    return {
        title: getField("title") || "Untitled Project",
        author: getField("author") || "",
        rawDate: rawDate,   // Kept for accurate chronological sorting
        date: yearOnly,     // Only 4-digit year for visual rendering
        category: getField("category") || "Uncategorized",
        image: imagePath,
        video: getField("video") || "",
        pdf: pdfPath,
        excerpt: getField("excerpt") || "",
        body: bodyContent
    };
}

// Render Video Embed
function renderVideoEmbed(url) {
    if (!url) return "";

    // YouTube link handling
    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (youtubeMatch) {
        return `
            <div class="video-container">
                <iframe src="https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}" 
                        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen></iframe>
            </div>`;
    }

    // Vimeo link handling
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (vimeoMatch) {
        return `
            <div class="video-container">
                <iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" 
                        frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
            </div>`;
    }

    // Direct MP4 video file handling
    if (url.match(/\.(mp4|webm|ogg)$/i)) {
        return `
            <div class="video-container">
                <video controls preload="metadata" style="width:100%; height:100%; border-radius:4px; object-fit: cover;">
                    <source src="${url}">
                    Your browser does not support HTML5 video.
                </video>
            </div>`;
    }

    return "";
}

// Render PDF Embedded Viewer
function renderPdfEmbed(pdfUrl) {
    if (!pdfUrl) return "";

    return `
        <div class="pdf-container">
            <iframe src="${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1" type="application/pdf" width="100%" height="100%">
                <p>Your browser does not support inline PDFs. <a href="${pdfUrl}" target="_blank">Download PDF</a></p>
            </iframe>
        </div>`;
}

// Reset grid view and load the initial 9 items
function resetAndRender() {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = '';
    visibleCount = 0;

    if (filteredProjects.length === 0) {
        renderMessage("No projects in this category.");
        return;
    }

    // Load initial batch of 9 projects
    loadMoreProjects(INITIAL_LOAD);
}

// Append the next batch of projects to the grid
function
