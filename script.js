const GAS_URL = "https://script.google.com/macros/s/AKfycbwxnQh7V2htRzjoZ32fveITzwYXh7hSZknC6ElnIBMDQ99NjYOk02fePrNrdAURCdZh/exec";

// Inicializácia PDF.js workera
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const canvasSig = document.getElementById("signature");
const signaturePad = new SignaturePad(canvasSig, {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    penColor: 'black'
});

let selectedPoint = { x: 50, y: 150 };
let pdfViewport = null;

// Úprava veľkosti canvasu
function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvasSig.width = canvasSig.offsetWidth * ratio;
    canvasSig.height = canvasSig.offsetHeight * ratio;
    canvasSig.getContext("2d").scale(ratio, ratio);
    signaturePad.clear();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// 1. Zobrazenie náhľadu
async function loadPdfPreview() {
    const fileInput = document.getElementById('pdfFile');
    const file = fileInput.files[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({data: new Uint8Array(buffer)});
    const pdf = await loadingTask.promise;
    
    const page = await pdf.getPage(1);
    const canvasPreview = document.getElementById('pdfPreviewCanvas');
    const context = canvasPreview.getContext('2d');
    
    pdfViewport = page.getViewport({scale: 1.5});
    canvasPreview.height = pdfViewport.height;
    canvasPreview.width = pdfViewport.width;

    await page.render({canvasContext: context, viewport: pdfViewport}).promise;

    const handlePointer = (e) => {
        const rect = canvasPreview.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const scaleX = canvasPreview.width / rect.width;
        const scaleY = canvasPreview.height / rect.height;

        const clickX = (clientX - rect.left) * scaleX;
        const clickY = (clientY - rect.top) * scaleY;

        selectedPoint.x = clickX / (pdfViewport.scale / 1.0);
        selectedPoint.y = (pdfViewport.height - clickY) / (pdfViewport.scale / 1.0); 

        const marker = document.getElementById('signatureMarker');
        marker.style.left = (clientX - rect.left + canvasPreview.offsetLeft) + 'px';
        marker.style.top = (clientY - rect.top + canvasPreview.offsetTop) + 'px';
        marker.style.display = 'block';
    };

    canvasPreview.onmousedown = handlePointer;
    canvasPreview.ontouchstart = handlePointer;
}

function clearSignature() { signaturePad.clear(); }

// 2. Podpísanie a odoslanie
async function signPdf() {
    const fileInput = document.getElementById('pdfFile');
    if (!fileInput.files[0] || signaturePad.isEmpty()) {
        alert("Nahrajte PDF a kliknite na miesto v náhľade!");
        return;
    }

    const name = document.getElementById("signerName").value;
    const targetEmail = document.getElementById("targetEmail").value;
    if(!name || !targetEmail) return alert("Vyplňte meno a e-mail!");

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Spracovávam...";

    try {
        // ZÍSKAME ČERSTVÉ DÁTA PRIAMO Z INPUTU (rieši chybu Header Not Found)
        const file = fileInput.files[0];
        const freshBuffer = await file.arrayBuffer();
        
        const pdfDoc = await PDFLib.PDFDocument.load(freshBuffer);
        const firstPage = pdfDoc.getPages()[0];

        const pngData = signaturePad.toDataURL("image/png");
        const pngImage = await pdfDoc.embedPng(pngData);

        // Vloženie podpisu
        firstPage.drawImage(pngImage, {
            x: selectedPoint.x,
            y: selectedPoint.y - 30,
            width: 120,
            height: 50
        });
        
        const dateStr = new Date().toLocaleString('sk-SK');
        firstPage.drawText(`${name} (${dateStr})`, { x: selectedPoint.x, y: selectedPoint.y + 25, size: 9 });

        const signedPdfBytes = await pdfDoc.save();
        
        // Base64 prevod
        const binary = new Uint8Array(signedPdfBytes);
        let base64 = "";
        for (let i = 0; i < binary.length; i++) {
            base64 += String.fromCharCode(binary[i]);
        }
        const base64Final = btoa(base64);

        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                pdf: base64Final,
                filename: `Vykaz_${name.replace(/\s+/g, '_')}.pdf`,
                toEmail: targetEmail,
                signer: name
            })
        });

        alert("Výkaz bol úspešne odoslaný!");
        location.reload();
    } catch (err) {
        console.error(err);
        alert("Chyba: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = "Podpísať a Odoslať";
    }
}
