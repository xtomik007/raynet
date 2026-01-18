// Konfigurácia PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

let pdfDoc = null;
let currentPage = 1;
let signaturePad = null;
let selectedX = 0;
let selectedY = 0;
let pdfBytes = null; // Tu budeme držať pôvodný súbor

// 1. Inicializácia Signature Pad pri načítaní
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('signature');
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: 'rgb(0, 0, 128)' // Tmavomodrá BlueMed
    });

    // Prispôsobenie veľkosti canvasu podpisu
    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        signaturePad.clear();
    }
    window.onresize = resizeCanvas;
    resizeCanvas();
});

// 2. Otvorenie podpisového okna
function openSignature() {
    const name = document.getElementById('signerName').value;
    if (!name) {
        alert("Prosím zadajte meno zákazníka.");
        return;
    }
    document.getElementById('previewName').textContent = name;
    document.getElementById('previewTitle').textContent = document.getElementById('signerTitle').value;
    document.getElementById('sigPopup').style.display = 'flex';
}

function closeSignature() {
    document.getElementById('sigPopup').style.display = 'none';
}

function clearSig() {
    signaturePad.clear();
}

// 3. Potvrdenie podpisu a načítanie PDF
async function acceptSignature() {
    if (signaturePad.isEmpty()) {
        alert("Prosím podpíšte sa.");
        return;
    }

    const fileInput = document.getElementById('pdfFile');
    if (fileInput.files.length === 0) {
        alert("Prosím vyberte servisný výkaz (PDF).");
        return;
    }

    const file = fileInput.files[0];
    pdfBytes = await file.arrayBuffer();
    
    // Načítanie PDF pre náhľad (PDF.js)
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDoc = await loadingTask.promise;
    
    document.getElementById('pageCount').textContent = pdfDoc.numPages;
    document.getElementById('sigPopup').style.display = 'none';
    document.getElementById('mainForm').style.display = 'none';
    document.getElementById('placementStep').style.display = 'block';

    renderPage(1);
}

// 4. Vykreslenie strany PDF
async function renderPage(num) {
    currentPage = num;
    const page = await pdfDoc.getPage(num);
    const canvas = document.getElementById('pdfPreviewCanvas');
    const ctx = canvas.getContext('2d');

    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    
    document.getElementById('pageNum').textContent = num;
    document.getElementById('marker').style.display = 'none'; // Skryť marker pri zmene strany
}

// 5. Navigácia
function prevPage() {
    if (currentPage <= 1) return;
    renderPage(currentPage - 1);
}

function nextPage() {
    if (currentPage >= pdfDoc.numPages) return;
    renderPage(currentPage + 1);
}

// 6. Výber miesta podpisu (klik na canvas)
document.getElementById('pdfPreviewCanvas').addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Prepočet na percentá pre PDF-lib
    selectedX = x / rect.width;
    selectedY = 1 - (y / rect.height); // PDF-lib počíta zdola nahor

    // Zobrazenie markera
    const marker = document.getElementById('marker');
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
    marker.style.display = 'block';
});

// 7. Finálne vloženie podpisu a "odoslanie"
async function signAndSend() {
    if (document.getElementById('marker').style.display === 'none') {
        alert("Prosím ťuknite do dokumentu pre umiestnenie podpisu.");
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = "Spracovávam...";

    try {
        const { PDFDocument, rgb } = PDFLib;
        const pdfDocLib = await PDFDocument.load(pdfBytes);
        const pages = pdfDocLib.getPages();
        const targetPage = pages[currentPage - 1]; // Strana, ktorú sme nalistovali

        // Získanie podpisu ako obrázok
        const sigImageData = signaturePad.toDataURL('image/png');
        const sigImage = await pdfDocLib.embedPng(sigImageData);

        const { width, height } = targetPage.getSize();
        
        // Vloženie podpisu
        targetPage.drawImage(sigImage, {
            x: selectedX * width - 50,
            y: selectedY * height - 25,
            width: 100,
            height: 50,
        });

        // Vloženie mena pod podpis
        targetPage.drawText(document.getElementById('signerName').value, {
            x: selectedX * width - 50,
            y: selectedY * height - 40,
            size: 10,
            color: rgb(0, 0, 0.5),
        });

        const modifiedPdfBytes = await pdfDocLib.save();
        
        // Stiahnutie hotového PDF (ako simulácia odoslania)
        const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "podpisany_vykaz.pdf";
        a.click();

        alert("Výkaz bol úspešne podpísaný a stiahnutý.");
        location.reload(); // Reštart pre ďalší výkaz

    } catch (err) {
        console.error(err);
        alert("Chyba pri generovaní PDF.");
        btn.disabled = false;
        btn.textContent = "Dokončiť a Odoslať";
    }
}
