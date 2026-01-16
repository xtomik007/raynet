const GAS_URL = "https://script.google.com/macros/s/AKfycbwxnQh7V2htRzjoZ32fveITzwYXh7hSZknC6ElnIBMDQ99NjYOk02fePrNrdAURCdZh/exec";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const canvasSig = document.getElementById("signature");
const signaturePad = new SignaturePad(canvasSig, { backgroundColor: 'rgba(255, 255, 255, 0)', penColor: 'black' });

let selectedPoint = { x: 50, y: 150 };
let pdfViewport = null;

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
    const file = document.getElementById('pdfFile').files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const loadingTask = pdfjsLib.getDocument({data: typedarray});
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

            selectedPoint.x = clickX / 1.5; 
            selectedPoint.y = (pdfViewport.height - clickY) / 1.5; 

            const marker = document.getElementById('signatureMarker');
            marker.style.left = (clientX - rect.left + canvasPreview.offsetLeft) + 'px';
            marker.style.top = (clientY - rect.top + canvasPreview.offsetTop) + 'px';
            marker.style.display = 'block';
        };
        canvasPreview.onmousedown = handlePointer;
        canvasPreview.ontouchstart = handlePointer;
    };
    reader.readAsArrayBuffer(file);
}

function clearSignature() { signaturePad.clear(); }

// 2. Podpísanie a odoslanie
async function signPdf() {
    const file = document.getElementById('pdfFile').files[0];
    if (!file || signaturePad.isEmpty()) return alert("Chýba PDF alebo podpis!");

    const name = document.getElementById("signerName").value;
    const targetEmail = document.getElementById("targetEmail").value;
    if(!name || !targetEmail) return alert("Vyplňte meno a e-mail!");

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Odosielam...";

    const reader = new FileReader();
    reader.onload = async function() {
        try {
            const pdfDoc = await PDFLib.PDFDocument.load(this.result);
            const firstPage = pdfDoc.getPages()[0];

            const pngData = signaturePad.toDataURL("image/png");
            const pngImage = await pdfDoc.embedPng(pngData);

            firstPage.drawImage(pngImage, {
                x: selectedPoint.x,
                y: selectedPoint.y - 30,
                width: 120,
                height: 50
            });
            
            const dateStr = new Date().toLocaleString('sk-SK');
            firstPage.drawText(`${name} (${dateStr})`, { x: selectedPoint.x, y: selectedPoint.y + 25, size: 9 });

            const signedPdfBytes = await pdfDoc.save();
            
            // Konverzia na Base64
            const base64Final = btoa(String.fromCharCode.apply(null, new Uint8Array(signedPdfBytes)));

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

            alert("Výkaz odoslaný!");
            location.reload();
        } catch (err) {
            console.error(err);
            alert("Chyba: " + err.message);
            submitBtn.disabled = false;
        }
    };
    reader.readAsArrayBuffer(file);
}
