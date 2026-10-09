// Configuration
const username = "RihardsVitols";
const repo = "FoC";

let allProjects = [];      
let filteredProjects = []; 
let visibleCount = 0;      
let isLoading = false; // Guard flag to prevent duplicate batch triggers

const INITIAL_LOAD = 9;   
const BATCH_LOAD = 3;     

let observer = null; 

document.addEventListener("DOMContentLoaded", () => {
    setupIntersectionObserver();
    fetchProjects();
    
    // Bind Fancybox 5 with isolated items and disabled navigation arrows
    if (typeof Fancybox !== "undefined") {
        Fancybox.bind("[data-fancybox]", {
            infinite: false,
            Navigation: false,
            iframe: {
                preload: false,
                attr: {
                    scrolling: "auto"
                }
            },
            on: {
                done: (fancybox, slide) => {
                    // Forces model-viewer to re-evaluate dimensions once lightbox transition completes
                    const viewer = slide.el.querySelector("model-viewer");
                    if (viewer && typeof viewer.dismissPoster === "function") {
                        viewer.dismissPoster();
                    }
                }
            }
        });
    }
});

function fetchProjects() {
    console.log("Fetching projects from GitHub...");
    fetch(`https://api.github.com/repos/${username}/${repo}/contents/content/projects`)
        .then(res => {
            if (!res.ok) throw new Error(`GitHub API Error (${res.status})`);
            return res.json();
        })
        .then(files => {
            if (!Array.isArray(files)) {
                renderMessage("Unable to load project directory.");
                return;
            }

            const mdFiles = files.filter(f => f.name.endsWith('.md'));
            
            if (mdFiles.length === 0) {
                renderMessage("No published projects found.");
                return;
            }

            const fetchPromises = mdFiles.map(file =>
                fetch(file.download_url)
                    .then(res => res.text())
                    .then(text => parseMarkdownFrontMatter(text))
                    .catch(err => {
                        console.error("Failed to load project file:", err);
                        return null;
                    })
            );

            return Promise.all(fetchPromises);
        })
        .then(projects => {
            if (projects) {
                const validProjects = projects.filter(p => p !== null);
                allProjects = validProjects.sort((a, b) => {
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
            renderMessage(`Error loading projects: ${err.message}`);
        });
}

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

    // PDF Cover Screenshot Path Formatting
    let pdfCoverPath = getField("pdf_cover");
    if (pdfCoverPath) {
        if (pdfCoverPath.startsWith('/')) pdfCoverPath = pdfCoverPath.substring(1);
        if (!pdfCoverPath.startsWith('http')) {
            pdfCoverPath = `https://rihardsvitols.github.io/FoC/${pdfCoverPath}`;
        }
    }

    // 3D Model Path Formatting (.glb / .gltf)
    let model3dPath = getField("model_3d");
    if (model3dPath) {
        if (model3dPath.startsWith('/')) model3dPath = model3dPath.substring(1);
        if (!model3dPath.startsWith('http')) {
            model3dPath = `https://rihardsvitols.github.io/FoC/${model3dPath}`;
        }
    }

    // 3D Model Cover Screenshot Path Formatting
    let modelCoverPath = getField("model_cover");
    if (modelCoverPath) {
        if (modelCoverPath.startsWith('/')) modelCoverPath = modelCoverPath.substring(1);
        if (!modelCoverPath.startsWith('http')) {
            modelCoverPath = `https://rihardsvitols.github.io/FoC/${modelCoverPath}`;
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
        pdfCover: pdfCoverPath || "",
        model3d: model3dPath || "",
        modelCover: modelCoverPath || "",
        excerpt: getField("excerpt") || "",
        body: bodyContent
    };
}

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

function renderPdfThumbnail(pdfUrl, coverImgUrl, title, index) {
    if (!pdfUrl) return "";

    const previewImage = coverImgUrl || 'images/default-pdf-cover.png';

    return `
        <div class="image-container">
            <a href="${pdfUrl}" data-fancybox="project-${index}" data-type="pdf" data-caption="${title}">
                <img src="${previewImage}" alt="${title}" loading="lazy">
            </a>
        </div>`;
}

function render3DModelCard(modelUrl, coverImgUrl, title, index) {
    if (!modelUrl) return "";

    const previewImage = coverImgUrl || 'images/default-3d-cover.png';

    const modelHTML = `
        <div class="fancybox-3d-wrapper">
            <model-viewer src="${modelUrl}" alt="${title}" camera-controls auto-rotate shadow-intensity="1" bounds="tight" style="width:100%; height:100%;"></model-viewer>
        </div>`;

    return `
        <div class="image-container">
            <a href="javascript:;" data-fancybox="project-${index}" data-type="html" data-src='${modelHTML}' data-caption="${title}">
                <img src="${previewImage}" alt="${title}" loading="lazy">
                <span class="badge-3d">📦 3D Model</span>
            </a>
        </div>`;
}

function resetAndRender() {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;
    grid.innerHTML = '';
    visibleCount = 0;

    if (filteredProjects.length === 0) {
        renderMessage("No projects in this category.");
        return;
    }

    loadMoreProjects(INITIAL_LOAD);
}

function loadMoreProjects(countToLoad) {
    if (isLoading) return;
    isLoading = true;

    const grid = document.getElementById('portfolio-grid');
    if (!grid) {
        isLoading = false;
        return;
    }

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

        let mediaHTML = "";
        // Priority order: 3D Model > Video > Image > PDF
        if (project.model3d) {
            mediaHTML = render3DModelCard(project.model3d, project.modelCover || project.image, project.title, index);
        } else if (project.video) {
            mediaHTML = renderVideoEmbed(project.video);
        } else if (project.image) {
            mediaHTML = `
                <div class="image-container">
                    <a href="${project.image}" data-fancybox="project-${index}" data-caption="${project.title}">
                        <img src="${project.image}" alt="${project.title}" loading="lazy">
                    </a>
                </div>`;
        } else if (project.pdf) {
            mediaHTML = renderPdfThumbnail(project.pdf, project.pdfCover, project.title, index);
        }

        card.innerHTML = `
            ${mediaHTML}
            
            <div class="meta">${metaText}</div>
            <h2 class="project-title">${project.title}</h2>
            <p class="excerpt">${project.excerpt}</p>

            ${project.pdf && (project.image || project.video || project.model3d) ? `
                <a href="${project.pdf}" data-fancybox="project-${index}" data-type="pdf" data-caption="${project.title}" class="pdf-link-btn">📄 View Attached PDF</a>
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

    isLoading = false;
    updateSentinel();
}

function setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && visibleCount < filteredProjects.length && !isLoading) {
                    loadMoreProjects(BATCH_LOAD);
                }
            });
        }, {
            rootMargin: '50px'
        });
    }
}

function updateSentinel() {
    let sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) {
        if (observer) observer.unobserve(sentinel);
        sentinel.remove();
    }

    if (visibleCount < filteredProjects.length) {
        sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.style.height = '20px';
        sentinel.style.width = '100%';
        sentinel.style.clear = 'both';

        const grid = document.getElementById('portfolio-grid');
        if (grid && grid.parentNode) {
            grid.parentNode.insertBefore(sentinel, grid.nextSibling);
            if (observer) observer.observe(sentinel);
        }
    }
}

function toggleDetails(index) {
    const detailsDiv = document.getElementById(`details-${index}`);
    if (!detailsDiv) return;
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
    if (btnElement) btnElement.classList.add('active');

    if (category === 'ALL') {
        filteredProjects = [...allProjects];
    } else {
        filteredProjects = allProjects.filter(p => p.category.toUpperCase().includes(category.toUpperCase()));
    }

    resetAndRender();
}

function renderMessage(message) {
    const grid = document.getElementById('portfolio-grid');
    if (grid) {
        grid.innerHTML = `<p class="loading-text">${message}</p>`;
    }
}
