const GAS_URL = "https://script.google.com/macros/s/AKfycbwxnQh7V2htRzjoZ32fveITzwYXh7hSZknC6ElnIBMDQ99NjYOk02fePrNrdAURCdZh/exec";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const canvasSig = document.getElementById("signature");
const signaturePad = new SignaturePad(canvasSig);

let pdfViewport = null;
let pdfScale = 1;
// Predvolená poloha, ak by nikto neklikol
let pdfPos = { x: 50, y: 50 };

// 1. Náhľad a získanie mierky PDF
async function loadPdfPreview() {
    const file = document.getElementById('pdfFile').files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    
    const canvasPreview = document.getElementById('pdfPreviewCanvas');
    const context = canvasPreview.getContext('2d');
    
    // Získame rozmery PDF strany
    pdfViewport = page.getViewport({scale: 1.0}); 
    
    // Vykreslíme náhľad (prispôsobený šírke displeja)
    const displayScale = canvasPreview.parentNode.clientWidth / pdfViewport.width;
    const visualViewport = page.getViewport({scale: displayScale});
    
    canvasPreview.width = visualViewport.width;
    canvasPreview.height = visualViewport.height;

    await page.render({canvasContext: context, viewport: visualViewport}).promise;

    // Kliknutie do náhľadu
    canvasPreview.onclick = (e) => {
        const rect = canvasPreview.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // PREPOČET: pixely na PDF body
        pdfPos.x = (x / visualViewport.width) * pdfViewport.width;
        // PDF má 0 vľavo DOLE, preto musíme Y otočiť
        pdfPos.y = pdfViewport.height - ((y / visualViewport.height) * pdfViewport.height);

        const marker = document.getElementById('signatureMarker');
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
        marker.style.display = 'block';
    };
}

function clearSignature() { signaturePad.clear(); }

// 2. Podpísanie (pôvodná funkčná metóda s novými súradnicami)
async function signPdf() {
    const pdfFileInput = document.getElementById("pdfFile");
    const name = document.getElementById("signerName").value;
    const targetEmail = document.getElementById("targetEmail").value;

    if (!pdfFileInput.files[0] || signaturePad.isEmpty()) return alert("Chýba PDF alebo podpis!");

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Odosielam...";

    try {
        const pdfBytes = await pdfFileInput.files[0].arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const firstPage = pdfDoc.getPages()[0];

        const pngData = signaturePad.toDataURL("image/png");
        const pngImage = await pdfDoc.embedPng(pngData);

        // Použitie prepočítaných súradníc pdfPos
        firstPage.drawImage(pngImage, {
            x: pdfPos.x,
            y: pdfPos.y - 40, // mierny posun, aby bol podpis pod textom
            width: 130,
            height: 60
        });

        firstPage.drawText(name, {
            x: pdfPos.x,
            y: pdfPos.y + 25,
            size: 10
        });

        const signedPdfBytes = await pdfDoc.save();
        const base64 = btoa(new Uint8Array(signedPdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                pdf: base64,
                filename: `Vykaz_${name.replace(/\s+/g, '_')}.pdf`,
                toEmail: targetEmail,
                signer: name
            })
        });

        alert("Hotovo! Výkaz bol odoslaný.");
        location.reload();
    } catch (err) {
        alert("Chyba: " + err.message);
        submitBtn.disabled = false;
    }
}
