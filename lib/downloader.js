// =================================================================
// PUSTAKA INTI: LOGIKA DOWNLOADER ('yt')
// File ini berisi semua fungsi inti untuk berkomunikasi dengan API eksternal.
// =================================================================

export const yt = {
    get ytapiHeaders() {
        return {
            'accept-encoding': 'gzip, deflate, br, zstd',
            "content-type": "application/json",
            "origin": "https://api.ytapi.cc",
            "referer": "https://api.ytapi.cc/",
        }
    },
    validateString(description, string) {
        if (typeof (string) !== "string" || string?.trim()?.length === 0) {
            throw Error(`${description} harus string dan gak boleh kosong!`)
        }
    },
    validateFormat(userFormat) {
        const validQuality = ["64kbps", "128kbps", "192kbps", "256kbps", "320kbps", "360p", "480p", "720p", "1080p"];
        if (!validQuality.includes(userFormat)) throw Error(`Format "${userFormat}" tidak valid! Pilih dari: ${validQuality.join(`, `)}`)
    },
    async hit(hitDescription, url, options, returnType = "text") {
        try {
            const response = await fetch(url, options)
            if (!response.ok) throw Error(`${response.status} ${response.statusText} ${(await response.text() || `(respond body kosong)`).substring(0, 100)}...`)
            try {
                if (returnType === "text") return { data: await response.text(), response }
                if (returnType === "json") return { data: await response.json(), response }
                throw Error(`invalid param return type. pilih text/json`)
            } catch (error) {
                throw Error(`Gagal mengubah response menjadi ${returnType}: ${error.message}`)
            }
        } catch (error) {
            throw Error(`Gagal saat hit ${hitDescription}: ${error.message}`)
        }
    },
    async info(ytId, displayId) {
        const taskName = `${displayId}-cek info`;
        console.time(taskName);
        const url = `https://dd-n01.yt2api.com/api/v4/info/${ytId}`;
        const headers = { ...this.ytapiHeaders };
        const { data, response } = await this.hit(`info`, url, { headers }, `json`);
        const authorization = response.headers.get('authorization');
        const cookie = response.headers.getSetCookie().map(v => v.split('; ')[0]).join('; ');
        if (data.error) throw Error(data.message);
        const result = { ...data, authorization, cookie };
        console.timeEnd(taskName);
        return result;
    },
    async convert(infoResult, yourFormat, displayId) {
        const taskName = `${displayId}-convert`;
        console.time(taskName);
        const { authorization, cookie } = infoResult;
        const handleFormat = (infoResult, userFormat) => {
            this.validateFormat(userFormat);
            if (/kbps/.test(userFormat)) {
                const availableAudioFormat = infoResult.formats.audio.mp3.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
                const find = availableAudioFormat.find(v => parseInt(v?.quality) == parseInt(userFormat));
                if (find) return find;
                const fallbackFormat = availableAudioFormat[0];
                console.log(`Format audio ${userFormat} tidak ditemukan, fallback ke ${fallbackFormat.quality}kbps`);
                return fallbackFormat;
            }
            if (/p/.test(userFormat)) {
                const availableVideoFormat = infoResult.formats.video.mp4.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
                const find = availableVideoFormat.find(v => parseInt(v?.quality) == parseInt(userFormat));
                if (find) return find;
                const fallbackFormat = availableVideoFormat[0];
                console.log(`Format video ${userFormat} tidak ditemukan, fallback ke ${fallbackFormat.quality}p`);
                return fallbackFormat;
            }
            throw Error(`Format input tidak dikenali.`);
        }
        const finalFormat = handleFormat(infoResult, yourFormat);
        const url = `https://dd-n01.yt2api.com/api/v4/convert`;
        const headers = { authorization, cookie, ...this.ytapiHeaders };
        const body = JSON.stringify({ token: finalFormat.token });
        const { data } = await this.hit(`convert`, url, { headers, body, 'method': 'post' }, `json`);
        console.timeEnd(taskName);
        return data;
    },
    async progress(convertResult, infoResult, displayId) {
        const taskName = `${displayId}-cek progress`;
        console.time(taskName);
        const { id } = convertResult;
        const { cookie, authorization } = infoResult;
        const delay = (ms) => new Promise(re => setTimeout(re, ms));
        const headers = { cookie, authorization, ...this.ytapiHeaders };
        const url = `https://dd-n01.yt2api.com/api/v4/status/${id}`;
        let wolep;
        const maxRetries = 20; // Max retries to prevent infinite loops (20 * 5s = 100s)
        for (let i = 0; i < maxRetries; i++) {
            wolep = await this.hit(`progress`, url, { headers }, `json`);
            console.log(`${displayId}: ${wolep.data.progressStep} ${wolep.data.progress}%`);
            if (wolep.data.download) {
                console.timeEnd(taskName);
                return wolep.data;
            }
            if (wolep.data.status !== 'active') break;
            await delay(5000);
        }
        console.timeEnd(taskName);
        throw Error(`Gagal cek progress. Status akhir: ${wolep?.data?.status}. JSON: ${JSON.stringify(wolep?.data, null, 2)}`);
    },
    async download(youtubeId, userFormat) {
        this.validateString(`youtube id`, youtubeId);
        this.validateFormat(userFormat);
        const generateRandom = () => Math.random().toString(36).substring(2, 6);
        const displayId = generateRandom();
        console.log(`[NEW TASK] ${displayId} | Format: ${userFormat}`);
        const infoResult = await this.info(youtubeId, displayId);
        const convertResult = await this.convert(infoResult, userFormat, displayId);
        const result = await this.progress(convertResult, infoResult, displayId);
        console.log(`[TASK COMPLETED] ${displayId}`);
        return result;
    }
};

/**
 * Mengekstrak YouTube video ID dari berbagai format URL.
 * @param {string} url - URL YouTube.
 * @returns {string|null} - Video ID atau null jika tidak ditemukan.
 */
export function extractYouTubeId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}