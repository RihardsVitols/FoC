// Configuration
const username = "RihardsVitols";
const repo = "FoC";

let allProjects = [];      
let filteredProjects = []; 
let visibleCount = 0;      

const INITIAL_LOAD = 9;   
const BATCH_LOAD = 3;     

let observer; 

document.addEventListener("DOMContentLoaded", () => {
    setupIntersectionObserver();
    fetchProjects();
    
    // Bind Fancybox 5 with isolated items and disabled navigation arrows
    Fancybox.bind("[data-fancybox]", {
        infinite: false,
        Navigation: false,
        iframe: {
            preload: false,
            attr: {
                scrolling: "auto"
            }
        }
    });
});

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

// Render PDF Screenshot Cover on Card Grid
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

// Render 3D Model Card Thumbnail & Interactive Fancybox Lightbox
function render3DModelCard(modelUrl, coverImgUrl, title, index) {
    if (!modelUrl) return "";

    const previewImage = coverImgUrl || 'images/default-3d-cover.png';

    // Injects interactive Google <model-viewer> into Fancybox popup
    const modelHTML = `
        <div class="fancybox-3d-wrapper">
            <model-viewer src="${modelUrl}" alt="${title}" camera-controls auto-rotate shadow-intensity="1" ar></model-viewer>
        </div>`;

    return `
        <div class="image-container">
            <a href="javascript:;" data-fancybox="project-${index}" data-src='${modelHTML}' data-caption="${title}">
                <img src="${previewImage}" alt="${title}" loading="lazy">
                <span class="badge-3d">📦 3D Model</span>
            </a>
        </div>`;
}

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

        let mediaHTML = "";
        if (project.image) {
            mediaHTML = `
