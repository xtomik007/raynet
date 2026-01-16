// KONFIGURÁCIA - Použite váš posledný funkčný link
const GAS_URL = "https://script.google.com/macros/s/AKfycbwxnQh7V2htRzjoZ32fveITzwYXh7hSZknC6ElnIBMDQ99NjYOk02fePrNrdAURCdZh/exec"
const canvas = document.getElementById("signature");
const signaturePad = new SignaturePad(canvas);

// --- 1. RESPONSIVITA CANVASU ---
function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    signaturePad.clear(); 
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- 2. NAČÍTANIE KLIENTOV (JSONP METÓDA) ---
window.onload = () => {
    console.log("Štartujem načítanie klientov cez JSONP...");
    const script = document.createElement('script');
    // Pridáme parameter callback=handleClients, ktorý GAS spracuje
    script.src = `${GAS_URL}?action=getClients&callback=handleClients`;
    script.onerror = () => {
        console.error("Nepodarilo sa načítať skript z GAS.");
        document.getElementById("raynetClient").innerHTML = "<option>Chyba pripojenia</option>";
    };
    document.body.appendChild(script);
};

// Táto funkcia sa automaticky spustí, keď dorazia dáta z Google Scriptu
function handleClients(clients) {
    const select = document.getElementById("raynetClient");
    select.innerHTML = "";

    if (!clients || clients.length === 0) {
        select.add(new Option("Žiadni klienti nenájdení", ""));
        return;
    }

    // Abecedné zoradenie
    clients.sort((a, b) => a.name.localeCompare(b.name));

    clients.forEach(c => {
        let opt = document.createElement("option");
        opt.value = c.id;
        opt.text = c.name;
        select.add(opt);
    });
    console.log("Klienti úspešne načítaní.");
}

function clearSignature() { 
    signaturePad.clear(); 
}

// --- 3. PODPÍSANIE A ODOSLANIE (Metóda POST ostáva cez fetch s no-cors) ---
async function signPdf() {
    const pdfFileInput = document.getElementById("pdfFile");
    const targetEmail = document.getElementById("targetEmail").value;
    const clientId = document.getElementById("raynetClient").value;
    const clientName = document.getElementById("raynetClient").options[document.getElementById("raynetClient").selectedIndex].text;
    const name = document.getElementById("name").value;
    const role = document.getElementById("role").value;

    if (!pdfFileInput.files[0] || signaturePad.isEmpty() || !targetEmail || !name) {
        alert("Vyplňte všetky polia a pridajte podpis.");
        return;
    }

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.innerText = "Odosielam...";

    try {
        const pdfFile = pdfFileInput.files[0];
        const pdfBytes = await pdfFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        const firstPage = pdfDoc.getPages()[0];
        
        const pngData = signaturePad.toDataURL("image/png");
        const pngImage = await pdfDoc.embedPng(pngData);

        firstPage.drawText(`${name} (${role})`, { x: 50, y: 70, size: 10 });
        firstPage.drawImage(pngImage, { x: 50, y: 80, width: 150, height: 60 });

        const signedPdfBytes = await pdfDoc.save();
        
        // Odoslanie (POST nepotrebuje JSONP, tam mode: no-cors funguje)
        const base64 = btoa(new Uint8Array(signedPdfBytes).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify({
                pdf: base64,
                filename: `Vykaz_${clientName.replace(/\s+/g, '_')}.pdf`,
                clientId: clientId,
                clientName: clientName,
                signer: name,
                toEmail: targetEmail
            })
        });
        
        alert("Hotovo! Výkaz odoslaný.");
        location.reload(); 

    } catch (err) {
        console.error(err);
        alert("Chyba pri spracovaní.");
        submitBtn.disabled = false;
        submitBtn.innerText = "Podpísať a Odoslať";
    }
}
