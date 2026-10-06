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
                allProjects = projects;
                filteredProjects = [...allProjects]; // Default to all projects
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

    return {
        title: getField("title") || "Untitled Project",
        author: getField("author") || "",
        date: getField("date") || "",
        category: getField("category") || "Uncategorized",
        image: imagePath,
        video: getField("video") || "", // Extract video URL
        excerpt: getField("excerpt") || "",
        body: bodyContent
    };
}

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
                <video controls preload="metadata" style="width:100%; height:auto; border-radius:4px;">
                    <source src="${url}">
                    Your browser does not support HTML5 video.
                </video>
            </div>`;
    }

    return "";
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
function loadMoreProjects(countToLoad) {
    const grid = document.getElementById('portfolio-grid');
    const nextBatch = filteredProjects.slice(visibleCount, visibleCount + countToLoad);

    nextBatch.forEach((project) => {
        const index = visibleCount;
        const card = document.createElement('div');
        card.className = 'project-card';
        
        const metaText = project.author 
            ? `${project.author} • ${project.category}` 
            : project.category;

        const defaultImg = 'https://via.placeholder.com/600x400';
        const imgSrc = project.image || defaultImg;

        card.innerHTML = `
            ${project.image ? `
                <div class="image-container">
                    <img src="${project.image}" alt="${project.title}" loading="lazy" onclick="openImageModal('${project.image}')">
                </div>
            ` : ''}

            ${project.video ? renderVideoEmbed(project.video) : ''}
            
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
        visibleCount++;
    });

    // Re-attach or remove the scroll trigger sentinel
    updateSentinel();
}

// Set up Intersection Observer for infinite scrolling
function setupIntersectionObserver() {
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && visibleCount < filteredProjects.length) {
                loadMoreProjects(BATCH_LOAD);
            }
        });
    }, {
        rootMargin: '200px' // Trigger loading 200px before reaching the exact bottom
    });
}

// Add/move sentinel element to end of grid to trigger next load
function updateSentinel() {
    let sentinel = document.getElementById('scroll-sentinel');
    
    // Remove existing sentinel if present
    if (sentinel) {
        observer.unobserve(sentinel);
        sentinel.remove();
    }

    // If there are more projects left to load, create a new sentinel at the end
    if (visibleCount < filteredProjects.length) {
        sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.style.height = '10px';
        sentinel.style.width = '100%';
        document.getElementById('portfolio-grid').appendChild(sentinel);
        observer.observe(sentinel);
    }
}
// Open full-screen image overlay (and lock mobile background scroll)
function openImageModal(imageSrc) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modalImg.src = imageSrc;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevents scrolling background on mobile
}

// Close full-screen image overlay (and restore scroll)
function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
    document.body.style.overflow = 'auto'; // Restores normal page scrolling
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

// Helper to convert line breaks in Markdown body
function formatMarkdownBody(bodyText) {
    return bodyText
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

// Filter projects by category
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

// Render status / error messages in grid
function renderMessage(message) {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = `<p class="loading-text">${message}</p>`;
}
