const canvas = document.getElementById("signature");
const signaturePad = new SignaturePad(canvas);
const GAS_URL = "https://script.google.com/macros/s/AKfycbxCosNNhDrcZOkRHQoz9w3aFwe2_4x25DPKCXKHnghKPtY3hmnO9-ukHI5UXs1CzX-l/exec"; 

// Načítanie klientov z Raynetu cez GAS pri štarte
window.onload = async () => {
    try {
        const response = await fetch(`${GAS_URL}?action=getClients`);
        const clients = await response.json();
        const select = document.getElementById("raynetClient");
        select.innerHTML = "";
        clients.forEach(c => {
            let opt = document.createElement("option");
            opt.value = c.id;
            opt.text = c.name;
            select.add(opt);
        });
    } catch (e) {
        console.error("Chyba pri načítaní klientov", e);
    }
};

function clearSignature() { signaturePad.clear(); }
// ... (začiatok zostáva rovnaký ako v predchádzajúcom kóde)

async function signPdf() {
    const pdfFile = document.getElementById("pdfFile").files[0];
    const targetEmail = document.getElementById("targetEmail").value;
    const clientId = document.getElementById("raynetClient").value;
    const clientName = document.getElementById("raynetClient").options[document.getElementById("raynetClient").selectedIndex].text;

    if (!pdfFile || signaturePad.isEmpty() || !targetEmail) {
        alert("Chýba PDF, podpis alebo e-mail príjemcu!");
        return;
    }

    document.getElementById("submitBtn").disabled = true;
    document.getElementById("submitBtn").innerText = "Spracovávam...";

    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPages()[0];
    
    const pngData = signaturePad.toDataURL("image/png");
    const pngImage = await pdfDoc.embedPng(pngData);

    const name = document.getElementById("name").value;
    const role = document.getElementById("role").value;

    page.drawText(`${name} (${role})`, { x: 50, y: 70, size: 10 });
    page.drawImage(pngImage, { x: 50, y: 80, width: 150, height: 60 });

    const signedPdf = await pdfDoc.save();
    
    // Odoslanie na GAS vrátane cieľového e-mailu
    await sendToGAS(signedPdf, clientId, clientName, name, targetEmail);
    
    alert("Výkaz úspešne odoslaný zákazníkovi a uložený do Raynetu.");
    location.reload();
}

async function sendToGAS(pdfBytes, clientId, clientName, signerName, targetEmail) {
    const base64 = btoa(new Uint8Array(pdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), ''));

    await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
            pdf: base64,
            filename: `Vykaz_${clientName}.pdf`,
            clientId: clientId,
            clientName: clientName,
            signer: signerName,
            toEmail: targetEmail // Nové pole
        })
    });
}