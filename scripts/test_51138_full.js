#!/usr/bin/env node
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const KEY = 'origin…'; // full key

const r2 = new S3Client({
  endpoint: 'https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com',
  region: 'auto',
  credentials: { accessKeyId: 'b821d56d29d9a2c716f783fc481e2f75', secretAccessKey: '3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f' },
});

async function main() {
  console.log('Fetching:', KEY);
  const resp = await r2.send(new GetObjectCommand({ Bucket: 'wildphoto-storage', Key: KEY }));
  const chunks = [];
  for await (const chunk of resp.Body) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  console.log('Downloaded:', buf.length, 'bytes, magic:', buf.slice(0,4).toString('hex'));
  
  if (buf.slice(0,4).toString('hex') === '00051607') {
    console.log('AppleDouble format');
    const numEntries = buf.readUInt16BE(0x1C);
    console.log('Entries:', numEntries);
    for (let i = 0; i < numEntries; i++) {
      const off = 0x1E + i * 12;
      const ftype = buf.readUInt32BE(off);
      const offset = buf.readUInt32BE(off+4);
      const length = buf.readUInt32BE(off+8);
      console.log('  Entry', i, ': 0x'+ftype.toString(16), 'offset='+offset, 'len='+length);
      if (ftype === 0x00020000 && length > 0 && offset + length <= buf.length) {
        const df = buf.slice(offset, offset+length);
        console.log('  DATA fork found! size=', df.length, 'header=', df.slice(0,8).toString('hex'));
        try {
          const meta = await sharp(df).metadata();
          console.log('  Sharp OK on data fork!', meta);
        } catch(e) {
          console.log('  Sharp fail on data fork:', e.message);
        }
        break;
      }
    }
  } else {
    console.log('Raw format');
    try {
      const meta = await sharp(buf).metadata();
      console.log('Sharp OK:', meta);
    } catch(e) {
      console.log('Sharp fail:', e.message);
    }
  }
}
main().catch(console.error);