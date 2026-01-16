const GAS_URL = "https://script.google.com/macros/s/AKfycbwxnQh7V2htRzjoZ32fveITzwYXh7hSZknC6ElnIBMDQ99NjYOk02fePrNrdAURCdZh/exec";

const canvas = document.getElementById("signature");
const signaturePad = new SignaturePad(canvas);

// Responsivita canvasu
function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear(); 
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function clearSignature() { 
    signaturePad.clear(); 
}

async function signPdf() {
    const pdfFileInput = document.getElementById("pdfFile");
    const targetEmail = document.getElementById("targetEmail").value;
    const clientName = document.getElementById("clientName").value;
    const name = document.getElementById("signerName").value;
    const role = document.getElementById("role").value;

    if (!pdfFileInput.files[0] || signaturePad.isEmpty() || !targetEmail || !name || !clientName) {
        alert("Prosím vyplňte všetky polia, nahrajte PDF a pridajte podpis.");
        return;
    }

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Spracovávam a odosielam...";

    try {
        const pdfFile = pdfFileInput.files[0];
        const pdfBytes = await pdfFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const firstPage = pdfDoc.getPages()[0];
        
        // Príprava podpisu
        const pngData = signaturePad.toDataURL("image/png");
        const pngImage = await pdfDoc.embedPng(pngData);

        // Vloženie textu a podpisu (pozícia x=50, y=70)
        firstPage.drawText(`${name} - ${role}`, { x: 50, y: 70, size: 10 });
        firstPage.drawImage(pngImage, { x: 50, y: 80, width: 150, height: 60 });

        const signedPdfBytes = await pdfDoc.save();
        
        // Prevod do Base64
        const base64 = btoa(new Uint8Array(signedPdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        
        // Odoslanie do GAS (len pre mail)
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                pdf: base64,
                filename: `Vykaz_${clientName.replace(/\s+/g, '_')}.pdf`,
                clientName: clientName,
                signer: name,
                toEmail: targetEmail
            })
        });
        
        alert("Výkaz bol úspešne podpísaný a odoslaný na e-mail.");
        location.reload(); 

    } catch (err) {
        console.error(err);
        alert("Nastala chyba. Skontrolujte konzolu.");
        submitBtn.disabled = false;
        submitBtn.innerText = "Podpísať a Odoslať";
    }
}
