let selectedPoint = { x: 50, y: 150, pageIndex: 0 };
let pdfDocLib = null;
let pdfFileBytes = null;

// NAČÍTANIE NÁHĽADU PDF
async function loadPdfPreview() {
    const file = document.getElementById('pdfFile').files[0];
    if (!file) return;

    pdfFileBytes = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({data: pdfFileBytes});
    const pdf = await loadingTask.promise;
    
    // Zobrazíme zatiaľ 1. stranu (možno neskôr pridať prepínač strán)
    const page = await pdf.getPage(1);
    const canvas = document.getElementById('pdfPreviewCanvas');
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({scale: 1.0});

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({canvasContext: context, viewport: viewport}).promise;

    // Kliknutie do náhľadu
    canvas.onclick = function(e) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Uložíme súradnice pre pdf-lib (Y je v PDF zdola nahor)
        selectedPoint.x = clickX;
        selectedPoint.y = viewport.height - clickY; 

        // Zobrazíme značku
        const marker = document.getElementById('signatureMarker');
        marker.style.left = clickX + 'px';
        marker.style.top = clickY + 'px';
        marker.style.display = 'block';
    };
}

async function signPdf() {
    if (!pdfFileBytes || signaturePad.isEmpty()) {
        alert("Nahrajte PDF a kliknite do náhľadu na miesto podpisu!");
        return;
    }

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Generujem...";

    try {
        const pdfDoc = await PDFLib.PDFDocument.load(pdfFileBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0]; // Tu môžeme neskôr doplniť výber strany

        const pngData = signaturePad.toDataURL("image/png");
        const pngImage = await pdfDoc.embedPng(pngData);

        // Vložíme podpis presne tam, kde technik klikol
        firstPage.drawImage(pngImage, {
            x: selectedPoint.x,
            y: selectedPoint.y - 40, // Posun, aby stred podpisu bol pod prstom
            width: 150,
            height: 60
        });

        const signedPdfBytes = await pdfDoc.save();
        const base64 = btoa(new Uint8Array(signedPdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        // ODOSLANIE
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                pdf: base64,
                filename: `Vykaz_BlueMed.pdf`,
                toEmail: document.getElementById("targetEmail").value,
                clientName: "BlueMed Servis"
            })
        });

        alert("Podpísané a odoslané!");
        location.reload();
    } catch (err) {
        console.error(err);
        alert("Chyba: " + err.message);
        submitBtn.disabled = false;
    }
}
