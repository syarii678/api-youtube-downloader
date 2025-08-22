import { yt, extractYouTubeId } from '../lib/downloader.js';

export default async function handler(req, res) {
    // Atur header CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    const { url, quality = '720p' } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, message: 'Parameter "url" wajib diisi.' });
    }

    // Validasi bahwa quality adalah format video
    if (!/p/.test(quality)) {
        return res.status(400).json({ success: false, message: `Format quality "${quality}" tidak valid untuk MP4. Gunakan: 360p, 720p, dll.` });
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
        return res.status(400).json({ success: false, message: 'URL YouTube tidak valid atau format tidak didukung.' });
    }
    
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    
    try {
        console.log(`[MP4] Menerima permintaan untuk Video ID: ${videoId} dengan kualitas: ${quality}`);
        const result = await yt.download(videoId, quality);

        return res.status(200).json({
            success: true,
            title: result.title,
            videoId: result.videoId,
            thumbnail: thumbnailUrl,
            format: result.ext,
            quality: `${result.quality}p`,
            downloadUrl: result.download,
        });

    } catch (error) {
        console.error("[MP4] API Handler Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan internal pada server.',
        });
    }
}