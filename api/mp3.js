import { yt, extractYouTubeId } from '../lib/downloader.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    // Langkah Diagnosis: Log URL mentah yang diterima Vercel
    console.log(`[MP3] Raw request URL received: ${req.url}`);

    let { url, quality = '128kbps' } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, message: 'Parameter "url" wajib diisi.' });
    }

    // Langkah Perbaikan: Lakukan decode pada URL untuk mengatasi masalah encoding
    try {
        url = decodeURIComponent(url);
    } catch (e) {
        console.error("Gagal melakukan decode pada URL:", e);
        return res.status(400).json({ success: false, message: 'Parameter URL tidak ter-encode dengan benar.' });
    }

    if (!/kbps/.test(quality)) {
        return res.status(400).json({ success: false, message: `Format quality "${quality}" tidak valid untuk MP3. Gunakan: 64kbps, 128kbps, dll.` });
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
        // Jika masih gagal, log URL yang sudah di-decode untuk analisis
        console.error(`[MP3] Gagal extract ID dari URL yang sudah di-decode: ${url}`);
        return res.status(400).json({ success: false, message: 'URL YouTube tidak valid atau format tidak didukung.' });
    }
    
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    
    try {
        console.log(`[MP3] Menerima permintaan untuk Video ID: ${videoId} dengan kualitas: ${quality}`);
        const result = await yt.download(videoId, quality);

        return res.status(200).json({
            success: true,
            title: result.title,
            videoId: result.videoId,
            thumbnail: thumbnailUrl,
            format: result.ext,
            quality: `${result.quality}kbps`,
            downloadUrl: result.download,
        });

    } catch (error) {
        console.error("[MP3] API Handler Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan internal pada server.',
        });
    }
}
