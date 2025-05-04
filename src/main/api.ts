import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import formidable from 'formidable';

const app = express();
const port = process.env.PORT || 1313;
const tmpDir = '/tmp';
const statusMap = new Map();

app.get('/healthcheck', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.post('/mbtiles', (req, res, next) => {
  console.log('Received /mbtiles POST request');
  const form = formidable({});

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error('Error parsing form:', err);
      next(err);
      return;
    }

    console.log('Form parsed successfully');
    const file = files.media;
    const filePath = Array.isArray(file) ? file[0].filepath : file.filepath;
    console.log('File path:', filePath);

    const fileHash = crypto.createHash('sha256').update(filePath).digest('hex');
    console.log('Generated file hash:', fileHash);

    const outputDir = path.join(tmpDir, fileHash);
    console.log('Output directory:', outputDir);

    // Simulate processing
    statusMap.set(fileHash, { status: 'running', filePath });
    console.log('Status set to running for file hash:', fileHash);

    // Simulate async processing
    setTimeout(() => {
      const zipPath = path.join(outputDir, 'result.zip');
      fs.writeFileSync(zipPath, 'dummy content'); // Replace with actual zipping logic
      statusMap.set(fileHash, { status: 'completed', filePath, zipPath });
      console.log('Processing completed for file hash:', fileHash);
    }, 5000);

    res.status(200).json({ id: fileHash });
    console.log('Response sent with file hash:', fileHash);
  });
});
// app.get('/', (req, res) => {
//   const { id } = req.query;
//   if (!id || typeof id !== 'string') {
//     res
//       .status(400)
//       .json({ error: 'Invalid or missing id parameter' });
//     return;
//   }

//   const status = statusMap.get(id);
//   if (!status) {
//     res
//       .status(404)
//       .json({ error: 'ID not found' });
//     return;
//   }

//   if (status.status === 'completed') {
//     res
//       .status(200)
//       .json({ status: status.status, downloadUrl: `/download/${id}` });
//   } else {
//     res
//       .status(200)
//       .json({ status: status.status });
//   }
// });

// app.get('/download/:id', (req, res) => {
//   const { id } = req.params;
//   const status = statusMap.get(id);

//   if (!status || status.status !== 'completed') {
//     res
//       .status(404)
//       .json({ error: 'File not found or not completed' });
//     return;
//   }

//   res.download(status.zipPath);
// });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
