const PHP_URL = "https://vas-server.sk/api/send_mail.php";
const GAS_URL = "https://script.google.com/macros/s/AKfycbwxnQh7V2htRzjoZ32fveITzwYXh7hSZknC6ElnIBMDQ99NjYOk02fePrNrdAURCdZh/exec";

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const canvasSig = document.getElementById("signature");
const signaturePad = new SignaturePad(canvasSig);
let pdfPos = { x: 50, y: 50 };
let pdfDocPoints = { w: 0, h: 0 };

// --- POMOCNÉ FUNKCIE ---
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

// Kontrola offline fronty pri štarte
window.onload = () => { checkOfflineQueue(); };

async function checkOfflineQueue() {
    let queue = JSON.parse(localStorage.getItem('pdf_queue') || '[]');
    if (queue.length > 0 && navigator.onLine) {
        document.getElementById('offlineNotify').innerText = "Odosielam uložené výkazy...";
        for (let item of queue) { await sendToServers(item); }
        localStorage.removeItem('pdf_queue');
        document.getElementById('offlineNotify').innerText = "Synchronizované.";
        setTimeout(() => document.getElementById('offlineNotify').innerText = "", 3000);
    }
}

// --- OVLÁDANIE ---
function openSignature() {
    if (document.getElementById('signerName').value.length < 3) return alert("Meno zákazníka?");
    if (!validateEmail(document.getElementById('targetEmail').value)) return alert("Email zákazníka?");
    if (!document.getElementById('pdfFile').files[0]) return alert("Chýba PDF!");
    
    document.getElementById('sigPopup').style.display = 'flex';
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvasSig.width = canvasSig.offsetWidth * ratio;
    canvasSig.height = canvasSig.offsetHeight * ratio;
    canvasSig.getContext("2d").scale(ratio, ratio);
}

function clearSig() { signaturePad.clear(); }
function closeSignature() { document.getElementById('sigPopup').style.display = 'none'; }

async function acceptSignature() {
    if(signaturePad.isEmpty()) return alert("Chýba podpis!");
    document.getElementById('sigPopup').style.display = 'none';
    document.getElementById('mainForm').style.display = 'none';
    document.getElementById('placementStep').style.display = 'block';
    loadPreview();
}

async function loadPreview() {
    const file = document.getElementById('pdfFile').files[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const page = await pdf.getPage(1);
    const canvas = document.getElementById('pdfPreviewCanvas');
    const viewport = page.getViewport({scale: 1.0});
    pdfDocPoints.w = viewport.width; 
    pdfDocPoints.h = viewport.height;

    const displayScale = canvas.parentNode.clientWidth / viewport.width;
    const visualViewport = page.getViewport({scale: displayScale});
    canvas.width = visualViewport.width; canvas.height = visualViewport.height;
    await page.render({canvasContext: canvas.getContext('2d'), viewport: visualViewport}).promise;

    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // PDF súradnice (0,0 je vľavo dole)
        pdfPos.x = (x / canvas.width) * pdfDocPoints.w;
        pdfPos.y = pdfDocPoints.h - ((y / canvas.height) * pdfDocPoints.h);
        
        const marker = document.getElementById('marker');
        marker.style.left = x + 'px'; marker.style.top = y + 'px'; marker.style.display = 'block';
    };
}

// --- FINÁLNE GENEROVANIE ---
async function signAndSend() {
    const marker = document.getElementById('marker');
    if (marker.style.display === 'none') return alert("Ťuknite do PDF!");

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true; submitBtn.innerText = "Generujem PDF...";

    try {
        const file = document.getElementById('pdfFile').files[0];
        const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const page = pdfDoc.getPages()[0];
        const pngImage = await pdfDoc.embedPng(signaturePad.toDataURL());
        
        // 1. PODPIS (Vykreslí sa OD miesta kliku smerom DOLE)
        page.drawImage(pngImage, { 
            x: pdfPos.x, 
            y: pdfPos.y - 60, // Spodná hrana je 60 bodov pod klikom
            width: 120, height: 60 
        });

        const name = document.getElementById('signerName').value;
        const title = document.getElementById('signerTitle').value;

        // 2. MENO (75 bodov pod klikom = 15 bodov pod obrázkom)
        const yMeno = pdfPos.y - 75;
        page.drawText(name, { x: pdfPos.x, y: yMeno, size: 10 });

        // 3. FUNKCIA (o 1.25 riadku nižšie = 12.5 bodu)
        if (title) {
            page.drawText(title, { x: pdfPos.x, y: yMeno - 12.5, size: 9 });
        }

        const payload = {
            pdf: await pdfDoc.saveAsBase64(),
            filename: `Vykaz_${name.replace(/\s+/g, '_')}.pdf`,
            toEmail: document.getElementById('targetEmail').value,
            signer: name
        };

        if (!navigator.onLine) {
            let queue = JSON.parse(localStorage.getItem('pdf_queue') || '[]');
            queue.push(payload);
            localStorage.setItem('pdf_queue', JSON.stringify(queue));
            alert("Uložené offline!");
        } else {
            await sendToServers(payload);
        }
        alert("Odoslané!"); location.reload();
    } catch (e) { alert("Chyba: " + e.message); submitBtn.disabled = false; }
}

async function sendToServers(payload) {
    try {
        await fetch(PHP_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(5000)
        });
    } catch (e) {
        await fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
    }
}
