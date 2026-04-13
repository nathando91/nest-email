// Function to convert Base32 string to Uint8Array
function base32ToBuffer(base32) {
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (let i = 0; i < base32.length; i++) {
        const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
        if (val === -1) continue; // Skip padding or invalid characters
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        if (i + 8 <= bits.length) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }
    }
    return new Uint8Array(bytes);
}

// Function to generate a 6-digit TOTP code
async function generateTOTP(secretBase32) {
    try {
        const keyBytes = base32ToBuffer(secretBase32);
        
        // Time step (30 seconds window)
        const timeStep = Math.floor(Date.now() / 1000 / 30);
        
        // Create an 8-byte buffer for the time step
        const timeBuffer = new ArrayBuffer(8);
        const timeView = new DataView(timeBuffer);
        timeView.setUint32(4, timeStep, false);
        
        // Import the key using Web Crypto API
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        
        // Sign the time step with HMAC-SHA-1
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
        const hmacResult = new Uint8Array(signature);
        
        // Extract the dynamic binary code
        const offset = hmacResult[hmacResult.length - 1] & 0x0f;
        const code = (
            ((hmacResult[offset] & 0x7f) << 24) |
            ((hmacResult[offset + 1] & 0xff) << 16) |
            ((hmacResult[offset + 2] & 0xff) << 8) |
            (hmacResult[offset + 3] & 0xff)
        );
        
        // Modulo 10^6 for a 6-digit code
        const totp = (code % 1000000).toString().padStart(6, '0');
        return totp;
    } catch (e) {
        console.error("Error generating TOTP: ", e);
        return "";
    }
}
