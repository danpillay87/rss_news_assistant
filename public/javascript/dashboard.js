// toggle nav bar
const bar = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.dashboard-sidebar');
const main = document.querySelector('.dashboard-main')
const overlay = document.querySelector('.overlay')

bar.addEventListener('click', () => {
    sidebar.classList.toggle('hide-sidebar');
    main.classList.toggle('extand-main');
    overlay.classList.toggle('show-overlay');
})
overlay.addEventListener('click', () => {
    sidebar.classList.remove('hide-sidebar');
    overlay.classList.remove('show-overlay')
})

// show modale
const modalButton = document.querySelectorAll('.modul-button');
const closemodal = document.querySelector('.modal__close');
const modal = document.querySelector('.modal__container');
const overlayr = document.querySelector('.modal-overlay');

modalButton.forEach(b => {
    b.addEventListener('click', function () {
        modal.classList.add('show-modal');
        overlayr.classList.add('show-modal-overlay');
    })
})
overlayr.addEventListener('click', () => {
    modal.classList.remove('show-modal');
    overlayr.classList.remove('show-modal-overlay')
    deleteImages();
})
closemodal.addEventListener('click', function () {
    modal.classList.remove('show-modal');
    overlayr.classList.remove('show-modal-overlay');
    deleteImages();
})

// ======== file upload ==============
let fileInput = document.getElementById("additionalFiles");
let fileList = document.getElementById("files-list");
let numOfFiles = document.querySelector(".num-of-files");

fileInput.addEventListener("change", () => {
    fileList.innerHTML = "";
    if (fileInput.files.length == 0) {
        numOfFiles.textContent = `No Files Chosen`;
    } else {
        numOfFiles.textContent = `File Selected`;
    }

    for (let i of fileInput.files) {
        let reader = new FileReader();
        let listItem = document.createElement("li");
        let fileName = i.name;
        let fileSize = (i.size / 1024).toFixed(1);
        listItem.innerHTML = `<p>${fileName}</p><p>${fileSize}KB</p>`;

        if (fileSize >= 1024) {
            fileSize = (fileSize / 1024).toFixed(1);
            listItem.innerHTML = `<p>${fileName}</p><p>${fileSize}MB</p>`;
        }

        fileList.appendChild(listItem);
    }
});

// ============== select ==============
const selected = document.querySelector('.selected');
const selectedP = document.querySelector('.selected p');
const optionsContainer = document.querySelector('.options-container');
const options = document.querySelectorAll('.option label')

selected.addEventListener('click', () => {
	optionsContainer.classList.toggle('activec');
})

options.forEach(o => {
	o.addEventListener('click', () => {
		selectedP.innerHTML = o.innerHTML;
		optionsContainer.classList.remove('activec');
	})
})
 
function truncateParagraphs(limit = 100) {
    // Select all paragraphs with the class 'address'
    const paragraphs = document.querySelectorAll('.address');
    
    // Loop through all selected paragraphs
    paragraphs.forEach(paragraph => {
        // Get the current text content of the paragraph
        const content = paragraph.textContent;
        
        // Truncate the content if it's longer than the limit
        const truncatedContent = content.length > limit ? content.substring(0, limit) + '...' : content;
        
        // Set the truncated content back on the paragraph
        paragraph.textContent = truncatedContent;
    });
}

// Call the function to truncate paragraphs
truncateParagraphs(110);