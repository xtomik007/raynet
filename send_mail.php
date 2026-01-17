<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $pdfBinary = base64_decode($data['pdf']);
    $signer = preg_replace('/[^A-Za-z0-9]/', '_', $data['signer']);
    
    $dir = 'archiv/' . date('Y-m');
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    
    $filename = date('H-i') . "_" . $signer . ".pdf";
    file_put_contents($dir . '/' . $filename, $pdfBinary);
    
    // Tu vlož PHPMailer kód podľa predošlého príkladu
    echo json_encode(["status" => "ok"]);
}
?>
