import { keepv, extractYouTubeId, getYoutubeTitle } from '../lib/downloader.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

    let { url, quality = '720p' } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, message: 'Parameter "url" wajib diisi.' });
    }
    
    try {
        url = decodeURIComponent(url);
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Parameter URL tidak ter-encode dengan benar.' });
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
        return res.status(400).json({ success: false, message: 'URL YouTube tidak valid atau format tidak didukung.' });
    }
    
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    
    try {
        // Panggil kedua proses secara bersamaan untuk efisiensi
        const [result, title] = await Promise.all([
            keepv.download(url, quality, 'api-user'),
            getYoutubeTitle(url)
        ]);

        return res.status(200).json({
            success: true,
            title: title,
            videoId: videoId,
            thumbnail: thumbnailUrl,
            format: "mp4",
            quality: quality,
            downloadUrl: result.dlurl,
            source: "keepv.id"
        });

    } catch (error) {
        console.error("[MP4] API Handler Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan internal pada server.',
        });
    }
}
