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

// Parse YAML front-matter and body content from Markdown string safely
function parseMarkdownFrontMatter(text) {
    const getField = (field) => {
        const regex = new RegExp(`${field}:\\s*["']?(.*?)["']?\\s*$`, 'm');
        const match = text.match(regex);
        return match ? match[1].trim() : "";
    };

    const parts = text.split('---');
    let bodyContent = parts.length >= 3 ? parts.slice(2).join('---').trim() : "";

    // Image Path Formatting
    let imagePath = getField("image");
    if (imagePath) {
        if (imagePath.startsWith('/')) imagePath = imagePath.substring(1);
        if (!imagePath.startsWith('http')) {
            imagePath = `https://rihardsvitols.github.io/FoC/${imagePath}`;
        }
    }

    // PDF Path Formatting
    let pdfPath = getField("pdf");
    if (pdfPath) {
        if (pdfPath.startsWith('/')) pdfPath = pdfPath.substring(1);
        if (!pdfPath.startsWith('http')) {
            pdfPath = `https://rihardsvitols.github.io/FoC/${pdfPath}`;
        }
    }

    const rawDate = getField("date");
    const yearOnly = rawDate ? rawDate.substring(0, 4) : "";
    
    return {
        title: getField("title") || "Untitled Project",
        author: getField("author") || "",
        rawDate: rawDate,
        date: yearOnly,
        category: getField("category") || "Uncategorized",
        image: imagePath || "",
        video: getField("video") || "",
        pdf: pdfPath || "",
        excerpt: getField("excerpt") || "",
        body: bodyContent
    };
}

// Render Video Embed
function renderVideoEmbed(url) {
    if (!url) return "";

    const youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (youtubeMatch) {
        return `
            <div class="video-container">
                <iframe src="https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}" 
                        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen></iframe>
            </div>`;
    }

    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (vimeoMatch) {
        return `
            <div class="video-container">
                <iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" 
                        frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
            </div>`;
    }

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

// Render PDF Document Thumbnail (Clickable to Lightbox)
function renderPdfThumbnail(pdfUrl, title) {
    if (!pdfUrl) return "";

    return `
        <div class="pdf-container pdf-thumbnail" onclick="openPdfModal('${pdfUrl}')">
            <div class="pdf-card-preview">
                <span class="pdf-icon">📄</span>
                <span class="pdf-label">Click to Preview Document</span>
                <span class="pdf-sublabel">${title}</span>
            </div>
        </div>`;
}

// Reset grid view and load initial items
function resetAndRender() {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = '';
    visibleCount = 0;

    if (filteredProjects.length === 0) {
        renderMessage("No projects in this category.");
        return;
    }

    loadMoreProjects(INITIAL_LOAD);
}

// Append next batch of projects to grid
function loadMoreProjects(countToLoad) {
    const grid = document.getElementById('portfolio-grid');
    const nextBatch = filteredProjects.slice(visibleCount, visibleCount + countToLoad);

    nextBatch.forEach((project) => {
        const index = visibleCount;
        const card = document.createElement('div');
        card.className = 'project-card';
        
        const metaParts = [];
        if (project.author) metaParts.push(project.author);
        if (project.category) metaParts.push(project.category);
        if (project.date) metaParts.push(project.date);

        const metaText = metaParts.join(" • ");

        // Media display selection logic
        let mediaHTML = "";
        if (project.image) {
            mediaHTML = `
                <div class="image-container">
                    <img src="${project.image}" alt="${project.title}" loading="lazy" onclick="openImageModal('${project.image}')">
                </div>`;
        } else if (project.video) {
            mediaHTML = renderVideoEmbed(project.video);
        } else if (project.pdf) {
            mediaHTML = renderPdfThumbnail(project.pdf, project.title);
        }

        card.innerHTML = `
            ${mediaHTML}
            
            <div class="meta">${metaText}</div>
            <h2 class="project-title">${project.title}</h2>
            <p class="excerpt">${project.excerpt}</p>

            ${project.pdf && (project.image || project.video) ? `
                <button onclick="openPdfModal('${project.pdf}')" class="pdf-link-btn" style="background:none; border:none; padding:0; cursor:pointer; margin-top: 5px; font-size: 0.85rem; color: #0066cc; text-decoration: underline; display: inline-block;">📄 View Attached PDF</button>
            ` : ''}
            
            ${project.body ? `
                <button class="toggle-btn" onclick="toggleDetails(${index})">Read Full Details</button>
                <div id="details-${index}" class="full-details" style="display: none; margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    ${formatMarkdownBody(project.body)}
                </div>
            ` : ''}
        `;
        grid.appendChild(card);
        visibleCount++;
    });

    updateSentinel();
}

function setupIntersectionObserver() {
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && visibleCount < filteredProjects.length) {
                loadMoreProjects(BATCH_LOAD);
            }
        });
    }, {
        rootMargin: '200px'
    });
}

function updateSentinel() {
    let sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) {
        observer.unobserve(sentinel);
        sentinel.remove();
    }

    if (visibleCount < filteredProjects.length) {
        sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.style.height = '10px';
        sentinel.style.width = '100%';
        document.getElementById('portfolio-grid').appendChild(sentinel);
        observer.observe(sentinel);
    }
}

// Lightbox: Image Modal
function openImageModal(imageSrc) {
    const modal = document.getElementById('mediaModal');
    const container = document.getElementById('modalContentContainer');
    container.innerHTML = `<img src="${imageSrc}" alt="Full size project image">`;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Lightbox: PDF Document Modal
function openPdfModal(pdfUrl) {
    const modal = document.getElementById('mediaModal');
    const container = document.getElementById('modalContentContainer');
    container.innerHTML = `
        <iframe src="${pdfUrl}#toolbar=1" type="application/pdf" width="100%" height="100%" style="border:none; border-radius:6px; background:#fff;">
            <p>Your browser does not support inline PDFs. <a href="${pdfUrl}" target="_blank">Download PDF</a></p>
        </iframe>`;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Close Modal
function closeModal() {
    const modal = document.getElementById('mediaModal');
    const container = document.getElementById('modalContentContainer');
    modal.style.display = 'none';
    container.innerHTML = ''; // Stops iframe background memory usage
    document.body.style.overflow = 'auto';
}

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

function formatMarkdownBody(bodyText) {
    if (!bodyText) return "";

    return bodyText
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="project-link">$1</a>')
        .replace(/(^|[^"'])((https?:\/\/[^\s<]+))/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="project-link">$2</a>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

function filterProjects(category, btnElement) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    if (category === 'ALL') {
        filteredProjects = [...allProjects];
    } else {
        filteredProjects = allProjects.filter(p => p.category.toUpperCase().includes(category.toUpperCase()));
    }

    resetAndRender();
}

function renderMessage(message) {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = `<p class="loading-text">${message}</p>`;
}
