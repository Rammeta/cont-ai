const cp = require('child_process');

const certCache = new Map();

function buildCertInfoFromPsObject(cJson) {
  return {
    subject: cJson.Subject || cJson.CleanName || cJson.CommonName,
    commonName: cJson.CommonName,
    issuer: cJson.Issuer,
    validTo: cJson.ValidTo,
    validFrom: cJson.ValidFrom,
    daysRemaining: cJson.DaysRemaining,
    isExpired: cJson.IsExpired,
    hasPrivateKey: cJson.HasPrivateKey,
    certB64: cJson.CertB64,
    extractedCnpj: (cJson.CommonName && cJson.CommonName.match(/\d{11,14}/)) ? cJson.CommonName.match(/\d{11,14}/)[0] : ''
  };
}

function extractJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : JSON.parse(text);
}

function getCertFromStore(thumbprint) {
  return new Promise((resolve, reject) => {
    if (!thumbprint) return reject(new Error('Thumbprint não informado.'));
    const cleanThumb = thumbprint.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    if (certCache.has(cleanThumb)) {
      return resolve(certCache.get(cleanThumb));
    }

    const ps = `
$c = Get-ChildItem Cert:\\CurrentUser\\My, Cert:\\LocalMachine\\My -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq '${cleanThumb}' } | Select-Object -First 1
if (-not $c) {
    Write-Output "NOT_FOUND"
    exit 1
}
$der = $c.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$b64 = [Convert]::ToBase64String($der)
$now = Get-Date
$days = [Math]::Ceiling(($c.NotAfter - $now).TotalDays)
$isExp = $now -gt $c.NotAfter
$cn = if ($c.Subject -match 'CN=([^,]+)') { $matches[1].Trim() } else { $c.Subject }
$cleanName = $cn -replace ':\\d{11,14}$', '' -replace ' - \\d{11,14}$', ''
$iss = if ($c.Issuer -match 'CN=([^,]+)') { $matches[1].Trim() } else { $c.Issuer }

[PSCustomObject]@{
    Subject = $cleanName
    CommonName = $cn
    Issuer = $iss
    ValidTo = $c.NotAfter.ToString("o")
    ValidFrom = $c.NotBefore.ToString("o")
    DaysRemaining = $days
    IsExpired = $isExp
    HasPrivateKey = $c.HasPrivateKey
    CertB64 = $b64
} | ConvertTo-Json -Compress
`;
    const b64 = Buffer.from(ps, 'utf16le').toString('base64');
    cp.exec(`powershell -NoProfile -EncodedCommand ${b64}`, { timeout: 10000 }, (err, stdout) => {
      const out = stdout ? stdout.trim() : '';
      if (!out || out.includes('NOT_FOUND')) return reject(new Error('Certificado não encontrado no Repositório do Windows.'));
      try {
        const parsed = extractJson(out);
        const certInfo = buildCertInfoFromPsObject(parsed);
        certCache.set(cleanThumb, certInfo);
        resolve(certInfo);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function getCertFromStoreSync(thumbprint) {
  if (!thumbprint) throw new Error('Thumbprint não informado.');
  const cleanThumb = thumbprint.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
  if (certCache.has(cleanThumb)) {
    return certCache.get(cleanThumb);
  }

  const ps = `
$c = Get-ChildItem Cert:\\CurrentUser\\My, Cert:\\LocalMachine\\My -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq '${cleanThumb}' } | Select-Object -First 1
if (-not $c) {
    Write-Output "NOT_FOUND"
    exit 1
}
$der = $c.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$b64 = [Convert]::ToBase64String($der)
$now = Get-Date
$days = [Math]::Ceiling(($c.NotAfter - $now).TotalDays)
$isExp = $now -gt $c.NotAfter
$cn = if ($c.Subject -match 'CN=([^,]+)') { $matches[1].Trim() } else { $c.Subject }
$cleanName = $cn -replace ':\\d{11,14}$', '' -replace ' - \\d{11,14}$', ''
$iss = if ($c.Issuer -match 'CN=([^,]+)') { $matches[1].Trim() } else { $c.Issuer }

[PSCustomObject]@{
    Subject = $cleanName
    CommonName = $cn
    Issuer = $iss
    ValidTo = $c.NotAfter.ToString("o")
    ValidFrom = $c.NotBefore.ToString("o")
    DaysRemaining = $days
    IsExpired = $isExp
    HasPrivateKey = $c.HasPrivateKey
    CertB64 = $b64
} | ConvertTo-Json -Compress
`;
  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  try {
    const stdout = cp.execSync(`powershell -NoProfile -EncodedCommand ${b64}`, { timeout: 10000 }).toString();
    const out = stdout ? stdout.trim() : '';
    if (!out || out.includes('NOT_FOUND')) throw new Error('Certificado não encontrado no Repositório do Windows.');
    const parsed = extractJson(out);
    const certInfo = buildCertInfoFromPsObject(parsed);
    certCache.set(cleanThumb, certInfo);
    return certInfo;
  } catch (e) {
    throw new Error('Falha ao obter certificado do repositório Windows: ' + e.message);
  }
}

function sendSoapWithStoreCert(url, soapAction, soapXml, thumbprint, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const cleanThumb = thumbprint.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    const xmlB64 = Buffer.from(soapXml, 'utf8').toString('base64');
    const ps = `
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
$c = Get-ChildItem Cert:\\CurrentUser\\My, Cert:\\LocalMachine\\My -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq '${cleanThumb}' } | Select-Object -First 1
if (-not $c) {
    Write-Output "ERR_CERT_NOT_FOUND"
    exit 1
}

$xmlBytes = [Convert]::FromBase64String('${xmlB64}')
$req = [System.Net.HttpWebRequest]::Create('${url}')
$req.ClientCertificates.Add($c) | Out-Null
$req.Method = 'POST'
$req.ContentType = 'application/soap+xml; charset=utf-8; action="${soapAction}"'
$req.Accept = 'application/soap+xml, text/xml, */*'
$req.Timeout = ${timeoutMs}
$req.ContentLength = $xmlBytes.Length

try {
    $reqStream = $req.GetRequestStream()
    $reqStream.Write($xmlBytes, 0, $xmlBytes.Length)
    $reqStream.Close()

    $resp = $req.GetResponse()
    $respStream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($respStream, [System.Text.Encoding]::UTF8)
    $responseText = $reader.ReadToEnd()
    $reader.Close()
    $resp.Close()

    $resB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($responseText))
    Write-Output "SUCCESS:$resB64"
} catch [System.Net.WebException] {
    $we = $_.Exception
    if ($we.Response) {
        $errStream = $we.Response.GetResponseStream()
        $errReader = New-Object System.IO.StreamReader($errStream, [System.Text.Encoding]::UTF8)
        $errText = $errReader.ReadToEnd()
        $errReader.Close()
        Write-Output ("WEB_ERR:" + $errText)
    } else {
        Write-Output ("ERR:" + $we.Message)
    }
} catch {
    Write-Output ("ERR:" + $_.Exception.Message)
}
`;
    const b64 = Buffer.from(ps, 'utf16le').toString('base64');
    cp.exec(`powershell -NoProfile -EncodedCommand ${b64}`, { maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs + 10000 }, (err, stdout) => {
      const out = stdout ? stdout.trim() : '';
      if (out.startsWith('SUCCESS:')) {
        const rawRes = Buffer.from(out.slice(8), 'base64').toString('utf8');
        return resolve(rawRes);
      }
      if (out.startsWith('WEB_ERR:')) {
        return reject(new Error(`Erro na resposta da SEFAZ: ${out.slice(8)}`));
      }
      return reject(new Error(out.replace(/^ERR:/, '') || err?.message || 'Falha ao contatar SEFAZ com certificado do Windows.'));
    });
  });
}

function signXmlWithStoreCert(xml, tagToSign = 'infDPS', thumbprint) {
  return new Promise((resolve, reject) => {
    const cleanThumb = thumbprint.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    const psScript = `
[System.Reflection.Assembly]::LoadWithPartialName("System.Security") | Out-Null
$c = Get-ChildItem Cert:\\CurrentUser\\My, Cert:\\LocalMachine\\My -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq '${cleanThumb}' } | Select-Object -First 1
if (-not $c) {
    Write-Output "ERR_CERT_NOT_FOUND"
    exit 1
}

$xmlText = [System.Console]::In.ReadToEnd()
if (-not $xmlText) {
    Write-Output "ERR_EMPTY_INPUT"
    exit 1
}

$doc = New-Object System.Xml.XmlDocument
$doc.PreserveWhitespace = $true
$doc.LoadXml($xmlText)

try {
    $key = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($c)
    if (-not $key) { $key = $c.PrivateKey }

    $signedXml = New-Object System.Security.Cryptography.Xml.SignedXml($doc)
    $signedXml.SigningKey = $key
    $signedXml.SignedInfo.SignatureMethod = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"

    $idNode = if ('${tagToSign}') {
        $found = $doc.DocumentElement.SelectSingleNode("//*[local-name()='${tagToSign}']/@Id")
        if (-not $found) { $found = $doc.DocumentElement.SelectSingleNode("//*[local-name()='${tagToSign}']/@id") }
        $found
    } else { $null }

    $refUri = if ($idNode) { "#" + $idNode.Value } else { "" }

    $ref = New-Object System.Security.Cryptography.Xml.Reference($refUri)
    $ref.DigestMethod = "http://www.w3.org/2001/04/xmlenc#sha256"
    $env = New-Object System.Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform
    $ref.AddTransform($env)
    $c14n = New-Object System.Security.Cryptography.Xml.XmlDsigC14NTransform
    $ref.AddTransform($c14n)
    $signedXml.AddReference($ref)

    $keyInfo = New-Object System.Security.Cryptography.Xml.KeyInfo
    $keyInfo.AddClause((New-Object System.Security.Cryptography.Xml.KeyInfoX509Data($c)))
    $signedXml.KeyInfo = $keyInfo

    $signedXml.ComputeSignature()
    $xmlSig = $signedXml.GetXml()
    $doc.DocumentElement.AppendChild($doc.ImportNode($xmlSig, $true)) | Out-Null

    $resB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($doc.OuterXml))
    Write-Output ("SUCCESS:" + $resB64)
} catch {
    Write-Output ("EXCEPTION:" + $_.Exception.Message)
}
`;
    const proc = cp.spawn('powershell', ['-NoProfile', '-Command', psScript]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('error', err => {
      reject(new Error(`Falha ao iniciar processo PowerShell: ${err.message}`));
    });

    proc.on('close', code => {
      const lines = (stdout || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const successLine = lines.find(l => l.startsWith('SUCCESS:'));
      if (successLine) {
        const signedXml = Buffer.from(successLine.slice(8).trim(), 'base64').toString('utf8');
        return resolve(signedXml);
      }
      const errLine = lines.find(l => l.startsWith('EXCEPTION:') || l.startsWith('ERR:') || l.startsWith('ERR_CERT_NOT_FOUND'));
      return reject(new Error((errLine ? errLine : stdout) || stderr || `Processo PowerShell finalizado com código ${code}`));
    });

    proc.stdin.write(xml, 'utf8');
    proc.stdin.end();
  });
}

module.exports = {
  getCertFromStore,
  getCertFromStoreSync,
  sendSoapWithStoreCert,
  signXmlWithStoreCert
};
