let currentCryptoKey = "dd";
let currentKeyIdentifier = 0;

function dumpData(buffer, max)
{
    const data = new Uint8Array(buffer);
    let bytes = '';
    for (let j = 0; j < data.length && j < max; j++)
        bytes += (data[j] < 16 ? '0' : '') + data[j].toString(16) + ' ';
    console.log(bytes.trim());
}

function dump(encodedFrame, direction, max = 16) {
    if (encodedFrame.type === "key")
        max = 48;
    const data = new Uint8Array(encodedFrame.data, max);
    console.log(performance.now().toFixed(2), direction,
        'len=' + encodedFrame.data.byteLength,
        'type=' + (encodedFrame.type || 'audio'),
        'ts=' + encodedFrame.timestamp,
    );

    dumpData(encodedFrame.data);
}

function hasFrameSPSPPS(encodedFrame)
{
    if (encodedFrame.type !== "key")
      return false;
    const view = new DataView(encodedFrame.data);
    return view.getInt8(0) === 0 && view.getInt8(1) === 0 && view.getInt8(2) === 0 && view.getInt8(3) === 1 && ((view.getInt8(4) & 0x1F) === 7);
}

function countRbspEscapingOccurences(data, offset)
{
    let count = 0;
    const view = new DataView(data);
    let numConsecutiveZeros = 0;
    for (let i = offset; i < data.byteLength; ++i) {
        const byte = view.getUint8(i);
        if (byte <= 3 && numConsecutiveZeros >= 2) {
            count++;
            numConsecutiveZeros = 0;
        }
        if (byte === 0)
            ++numConsecutiveZeros;
        else
            numConsecutiveZeros = 0;
    }
    return count;
}

function countRbspUnescapingOccurences(data, offset)
{
    let count = 0;
    const view = new DataView(data);
    if (data.byteLength < 3)
        return 0;
    for (let i = offset; i < data.byteLength - 3; ++i) {
        const byte1 = view.getUint8(i);
        const byte2 = view.getUint8(i + 1);
        const byte3 = view.getUint8(i + 2);
        if (byte1 === 0 && byte2 === 0 && byte3 === 3) {
            i += 2;
            count++;
        }
    }
    return count;
}

function toRbsp(data, offset)
{
    const count = countRbspEscapingOccurences(data, offset);
    if (!count)
        return data;

console.log("do escaping");

    const view = new DataView(data);
    const newData = new ArrayBuffer(data.byteLength + count);
    const newView = new DataView(newData);

    for (let i = 0; i < offset; ++i)
        newView.setUint8(i, view.getUint8(i));

    let counter = offset;
    let numConsecutiveZeros = 0;
    for (let i = offset; i < data.byteLength; ++i) {
        const byte = view.getUint8(i);
        if (byte <= 3 && numConsecutiveZeros >= 2) {
            numConsecutiveZeros = 0;
console.log("inserting escape at " + counter);
            newView.setUint8(counter++, 3);
        }
        newView.setUint8(counter++, byte);
        if (byte === 0)
            ++numConsecutiveZeros;
        else
            numConsecutiveZeros = 0;
    }

    return newData;
}

function fromRbsp(data, offset)
{
    const count = countRbspUnescapingOccurences(data, offset);
    if (!count)
        return data;

console.log("do unescaping");

    const view = new DataView(data);
    const newData = new ArrayBuffer(data.byteLength - count);
    const newView = new DataView(newData);

    let counter = 0;
    for (let i = 0; i < offset; ++i)
        newView.setUint8(counter++, view.getUint8(i));

    for (let i = offset; i < data.byteLength - 3; ++i) {
        const byte1 = view.getUint8(i);
        const byte2 = view.getUint8(i + 1);
        const byte3 = view.getUint8(i + 2);
        if (byte1 === 0 && byte2 === 0 && byte3 === 3) {
            newView.setUint8(counter++, byte1);
            newView.setUint8(counter++, byte2);
            // Skip next byte which is delimiter.
            i += 2;
console.log("removing escape at " + i);
        } else
            newView.setUint8(counter++, byte1);
    }
    for (let i = data.byteLength - 3; i < data.byteLength; ++i)
        newView.setUint8(counter++, view.getUint8(i));

    return newData;
}

function encryptFrameWithPrefix(encodedFrame, prefix)
{
    let length = encodedFrame.data.byteLength + prefix.length + 1 + 4; // 1 is for the key ID and last 4 is for the checksum.

    const view = new DataView(encodedFrame.data);

    const newData = new ArrayBuffer(length);
    const newView = new DataView(newData);

    let counter = 0;

    // Append prefix
    prefix.forEach(value => newView.setUint8(counter++, value));

    // Append keyIdentifier.
    newView.setUint8(counter++, currentKeyIdentifier % 0xff);

    // Append xor content
    for (let i = 0; i < encodedFrame.data.byteLength; ++i) {
      const keyByte = currentCryptoKey.charCodeAt(i % currentCryptoKey.length);
      newView.setInt8(counter++, view.getInt8(i) ^ keyByte);
    }
    // Append checksum
    newView.setUint32(counter, 0xDEADBEEF);

    encodedFrame.data = toRbsp(newData, prefix.length + 1);
}

function decryptFrameSkipPrefix(encodedFrame, prefixLength)
{
    const data = fromRbsp(encodedFrame.data, prefixLength + 1);
    let length = data.byteLength - prefixLength - 1 - 4; // 1 is for the key ID and last 4 is for the checksum.

    const view = new DataView(data);

    const newData = new ArrayBuffer(length);
    const newView = new DataView(newData);

    let counter = 0;
    // Skip prefix and key identifier.
    const start = prefixLength + 1;
    // Skip checksum
    const end = data.byteLength - 4;

    // xor content
    for (let i = start; i < end; ++i) {
        const keyByte = currentCryptoKey.charCodeAt(i % currentCryptoKey.length);
        newView.setInt8(counter++, view.getInt8(i) ^ keyByte);
    }

    const checksum = data.byteLength > 4 ? view.getUint32(data.byteLength - 4) : false;
    if (checksum !== 0xDEADBEEF) {
        console.log('Corrupted frame received, checksum ' + checksum.toString(16));
        return;
    }
 
    encodedFrame.data = newData;
}

// FIXME: We should generate the SPS/PPS information based on the width/height of the frame, but it does not seem implementations care much about that.
const prefixKeyFrameWithSPSPPS =   [0x00 ,0x00 ,0x00 ,0x01 ,0x27 ,0x64 ,0x00 ,0x1f ,0xac ,0x13 ,0x16 ,0x60 ,0x28 ,0x0f ,0x68 ,0x06 ,0xd0 ,0x44 ,0x23 ,0x34 ,0x00 ,0x00 ,0x00 ,0x01 ,0x28 ,0xd9 ,0x4b ,0x09 ,0xcb ,0x00 ,0x00 ,0x00 ,0x01 ,0x25, 0xb8]
const prefixKeyFrameWithoutSPSPPS = [0x00 ,0x00 ,0x00 ,0x01 ,0x25, 0xb8];
const prefixDeltaFrame = [0x00 ,0x00 ,0x00 ,0x01 ,0x21, 0xb8];

function encryptFrame(encodedFrame)
{
    if (encodedFrame.type === "delta") {
        encryptFrameWithPrefix(encodedFrame, prefixDeltaFrame);
        return;
    }
    if (hasFrameSPSPPS(encodedFrame)) {
       var data = encodedFrame.data;
       encryptFrameWithPrefix(encodedFrame, prefixKeyFrameWithSPSPPS);
        return;
    }
    encryptFrameWithPrefix(encodedFrame, prefixKeyFrameWithoutSPSPPS);
}

function decryptFrame(encodedFrame)
{
    if (encodedFrame.type === "delta") {
        decryptFrameSkipPrefix(encodedFrame, prefixDeltaFrame.length);
        return;
    }
    if (hasFrameSPSPPS(encodedFrame)) {
        decryptFrameSkipPrefix(encodedFrame, prefixKeyFrameWithSPSPPS.length);
        return;
    }
    decryptFrameSkipPrefix(encodedFrame, prefixKeyFrameWithoutSPSPPS.length);
}

function doTransform(readable, writable, side)
{
    const transform = new TransformStream({
        transform: (frame, controller) => {
            if (side === "sender")
                encryptFrame(frame);
            else
                decryptFrame(frame);
            controller.enqueue(frame);
        }
    });
    readable.pipeThrough(transform).pipeTo(writable);
}

if (self.RTCRtpScriptTransformer)
{
    class MyTransformer extends RTCRtpScriptTransformer {
        constructor() {
            super();
        }
        start(readable, writable, context)
        {
            doTransform(readable, writable, context.side);
        }
    };
    registerRTCRtpScriptTransformer("MyTransform", MyTransformer);
}

self.onmessage = async (event) => {
    const {side, readable, writable} = event.data;
    doTransform(readable, writable, side);
};
self.postMessage("registered");
