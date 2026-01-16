// --- KONFIGURÁCIA ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbyKSCjBUyfAuvkupBgUWoAZAeqIsxUATnQitpEk-Xgkf6fQya7AVjF5Kv59DqvhzoOY/exec"; 

const canvas = document.getElementById("signature");
const signaturePad = new SignaturePad(canvas);

// --- 1. RESPONSIVITA CANVASU (aby podpis na mobile sedel presne pod prstom) ---
function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear(); 
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- 2. NAČÍTANIE KLIENTOV Z RAYNETU (pri štarte aplikácie) ---
window.onload = async () => {
    try {
        const response = await fetch(`${GAS_URL}?action=getClients`, {
            method: 'GET',
            mode: 'cors',
            redirect: 'follow'
        });

        if (!response.ok) throw new Error('Nepodarilo sa spojiť so serverom');

        let clients = await response.json();
        const select = document.getElementById("raynetClient");
        select.innerHTML = "";

        if (clients.length === 0) {
            select.add(new Option("Žiadni klienti nenájdení", ""));
            return;
        }

        // Zoradenie klientov abecedne pre lepšiu prehľadnosť
        clients.sort((a, b) => a.name.localeCompare(b.name));

        clients.forEach(c => {
            let opt = document.createElement("option");
            opt.value = c.id;
            opt.text = c.name;
            select.add(opt);
        });
    } catch (e) { 
        console.error("Chyba:", e);
        document.getElementById("raynetClient").innerHTML = "<option>Chyba načítania (skontrolujte pripojenie)</option>";
    }
};

function clearSignature() { 
    signaturePad.clear(); 
}

// --- 3. HLAVNÁ FUNKCIA: SPRACOVANIE PDF A ODOSLANIE ---
async function signPdf() {
    const pdfFileInput = document.getElementById("pdfFile");
    const targetEmail = document.getElementById("targetEmail").value;
    const clientId = document.getElementById("raynetClient").value;
    const clientName = document.getElementById("raynetClient").options[document.getElementById("raynetClient").selectedIndex].text;
    const name = document.getElementById("name").value;
    const role = document.getElementById("role").value;

    // Validácia vstupov
    if (!pdfFileInput.files[0] || signaturePad.isEmpty() || !targetEmail || !name) {
        alert("Prosím vyplňte všetky údaje: Meno, E-mail zákazníka, nahrajte PDF a pridajte podpis.");
        return;
    }

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Spracovávam a odosielam...";

    try {
        const pdfFile = pdfFileInput.files[0];
        const pdfBytes = await pdfFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        
        // Získame prvú stranu dokumentu
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        // Príprava obrázka podpisu
        const pngData = signaturePad.toDataURL("image/png");
        const pngImage = await pdfDoc.embedPng(pngData);

        // Vloženie textu a podpisu na spodnú časť prvej strany
        // Súradnice [50, 70] sú v bodoch (cca vľavo dole)
        firstPage.drawText(`${name} (${role})`, { 
            x: 50, 
            y: 70, 
            size: 11,
            color: PDFLib.rgb(0, 0, 0)
        });
        
        firstPage.drawImage(pngImage, { 
            x: 50, 
            y: 80, 
            width: 150, 
            height: 60 
        });

        const signedPdfBytes = await pdfDoc.save();
        
        // Odoslanie upraveného PDF do Google Apps Script
        await sendToGAS(signedPdfBytes, clientId, clientName, name, targetEmail);
        
        alert("Výkaz bol úspešne odoslaný zákazníkovi a uložený do Raynetu.");
        location.reload(); 

    } catch (err) {
        console.error("Chyba pri spracovaní:", err);
        alert("Nastala chyba pri generovaní PDF. Skúste to znova.");
        submitBtn.disabled = false;
        submitBtn.innerText = "Podpísať, Odoslať a Uložiť";
    }
}

// --- 4. ODOSLANIE DÁT DO GOOGLE APPS SCRIPT ---
async function sendToGAS(pdfBytes, clientId, clientName, signerName, targetEmail) {
    // Prevod binárnych dát PDF do Base64 pre prenos cez JSON
    const base64 = btoa(
        new Uint8Array(pdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const payload = JSON.stringify({
        pdf: base64,
        filename: `Vykaz_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
        clientId: clientId,
        clientName: clientName,
        signer: signerName,
        toEmail: targetEmail
    });

    // POST požiadavka na GAS (režim no-cors je nutný kvôli CORS politike Google Scriptu)
    await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: payload
    });
}
