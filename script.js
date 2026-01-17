/**
 * BlueMed Singer - Kompletný Engine
 * Verzia: 2.0 (Január 2026)
 */

//const PHP_URL = "https://vas-server.sk/api/send_mail.php";
const GAS_URL = "https://script.google.com/macros/s/AKfycbwxnQh7V2htRzjoZ32fveITzwYXh7hSZknC6ElnIBMDQ99NjYOk02fePrNrdAURCdZh/exec";

// Inicializácia PDF.js workera
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const canvasSig = document.getElementById("signature");
const signaturePad = new SignaturePad(canvasSig);
let pdfPos = { x: 50, y: 50 };
let pdfDocPoints = { w: 0, h: 0 };

// --- 1. SYSTÉMOVÉ FUNKCIE (PWA & OFFLINE) ---

window.onload = () => {
    checkOfflineQueue();
    // Kontrola pre Share Target (zdieľanie súboru z mobilu)
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.has('pdfFile')) {
        console.log("PDF bolo prijaté cez systémové zdieľanie.");
    }
};

async function checkOfflineQueue() {
    let queue = JSON.parse(localStorage.getItem('pdf_queue') || '[]');
    if (queue.length > 0 && navigator.onLine) {
        document.getElementById('offlineNotify').innerText = "Synchronizujem uložené výkazy...";
        for (let item of queue) {
            await sendToServers(item);
        }
        localStorage.removeItem('pdf_queue');
        document.getElementById('offlineNotify').innerText = "Všetko úspešne synchronizované.";
        setTimeout(() => { document.getElementById('offlineNotify').innerText = ""; }, 3000);
    }
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- 2. OVLÁDANIE PODPISU (POPUP) ---

function openSignature() {
    const name = document.getElementById('signerName').value;
    const email = document.getElementById('targetEmail').value;
    const file = document.getElementById('pdfFile').files[0];

    if (name.length < 3) return alert("Zadajte meno zákazníka.");
    if (!validateEmail(email)) return alert("Zadajte platný e-mail.");
    if (!file) return alert("Najprv nahrajte alebo zdieľajte PDF výkaz.");

    document.getElementById('sigPopup').style.display = 'flex';
    resizeSigCanvas();
}

function resizeSigCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvasSig.width = canvasSig.offsetWidth * ratio;
    canvasSig.height = canvasSig.offsetHeight * ratio;
    canvasSig.getContext("2d").scale(ratio, ratio);
    signaturePad.clear();
}

function clearSig() { signaturePad.clear(); }
function closeSignature() { document.getElementById('sigPopup').style.display = 'none'; }

async function acceptSignature() {
    if (signaturePad.isEmpty()) return alert("Prosím, podpíšte sa.");
    document.getElementById('sigPopup').style.display = 'none';
    document.getElementById('mainForm').style.display = 'none';
    document.getElementById('placementStep').style.display = 'block';
    loadPreview();
}

// --- 3. PDF NÁHĽAD A UMIESTNENIE ---

async function loadPreview() {
    const file = document.getElementById('pdfFile').files[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const page = await pdf.getPage(1);
    
    const canvas = document.getElementById('pdfPreviewCanvas');
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({scale: 1.0});
    
    pdfDocPoints.w = viewport.width;
    pdfDocPoints.h = viewport.height;

    const displayScale = canvas.parentNode.clientWidth / viewport.width;
    const visualViewport = page.getViewport({scale: displayScale});
    
    canvas.width = visualViewport.width;
    canvas.height = visualViewport.height;

    await page.render({canvasContext: context, viewport: visualViewport}).promise;

    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Prepočet na body PDF (zdola nahor)
        pdfPos.x = (x / canvas.width) * pdfDocPoints.w;
        pdfPos.y = pdfDocPoints.h - ((y / canvas.height) * pdfDocPoints.h);

        const marker = document.getElementById('marker');
        marker.style.left = x + 'px';
        marker.style.top = y + 'px';
        marker.style.display = 'block';
    };
}

// --- 4. GENEROVANIE PDF A ODOSIELANIE ---

async function signAndSend() {
    if (document.getElementById('marker').style.display === 'none') {
        return alert("Ťuknite do PDF pre určenie miesta podpisu!");
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = "Spracúvam...";

    try {
        const file = document.getElementById('pdfFile').files[0];
        const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const page = pdfDoc.getPages()[0];
        
        // Získanie podpisu ako obrázka
        const pngImage = await pdfDoc.embedPng(signaturePad.toDataURL());
        
        // --- VYKRESLOVANIE SMEROM NADOL (PÄTA PODPISU) ---
        
        // 1. Podpis (60 bodov výška, začína na kliku a ide dole)
        page.drawImage(pngImage, { 
            x: pdfPos.x, 
            y: pdfPos.y - 60, 
            width: 120, 
            height: 60 
        });

        const name = document.getElementById('signerName').value;
        const title = document.getElementById('signerTitle').value;

        // 2. Meno (posun o 15 bodov pod podpis = 75 od kliku)
        const yLine1 = pdfPos.y - 75;
        page.drawText(name, { 
            x: pdfPos.x, 
            y: yLine1, 
            size: 10 
        });

        // 3. Funkcia (Riadkovanie 1.25 = 12.5 bodu pod menom)
        if (title) {
            page.drawText(title, { 
                x: pdfPos.x, 
                y: yLine1 - 12.5, 
                size: 9 
            });
        }

        // Príprava dát na odoslanie
        const payload = {
            pdf: await pdfDoc.saveAsBase64(),
            filename: `Vykaz_${name.replace(/\s+/g, '_')}.pdf`,
            toEmail: document.getElementById('targetEmail').value,
            signer: name
        };

        // Kontrola konektivity
        if (!navigator.onLine) {
            saveToOffline(payload);
        } else {
            await sendToServers(payload);
        }

        alert("Hotovo! Výkaz bol odoslaný (alebo uložený offline).");
        location.reload();

    } catch (e) {
        alert("Chyba pri spracovaní: " + e.message);
        submitBtn.disabled = false;
        submitBtn.innerText = "Skúsiť znova";
    }
}

function saveToOffline(payload) {
    let queue = JSON.parse(localStorage.getItem('pdf_queue') || '[]');
    queue.push(payload);
    localStorage.setItem('pdf_queue', JSON.stringify(queue));
}

async function sendToServers(payload) {
    try {
        // Primárny pokus: PHP Server
        const response = await fetch(PHP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error("PHP offline");
    } catch (e) {
        // Záložný pokus: Google Apps Script
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload)
        });
    }
}
