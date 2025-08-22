// =================================================================
// PUSTAKA INTI: LOGIKA DOWNLOADER ('keepv')
// =================================================================

export const keepv = {
    tools: {
        generateHex: (length = 10, config = { prefix: "" }) => {
            const charSet = "0123456789abcdef"
            const charSetArr = charSet.split("")
            const getRandom = (array) => array[Math.floor(Math.random() * array.length)]
            const randomString = Array.from({ length }, _ => getRandom(charSetArr)).join("")
            return config.prefix + randomString
        },
        generateTokenValidTo: () => (Date.now() + (1000 * 60 * 20)).toString().substring(0, 10),
        mintaJson: async (description, url, options) => {
            try {
                const response = await fetch(url, options)
                if (!response.ok) throw Error(`${response.status} ${response.statusText}\n${await response.text() || '(empty content)'}`)
                const json = await response.json()
                return json
            } catch (err) {
                // Hapus header accept-encoding jika terjadi error parsing JSON
                if (err instanceof SyntaxError && options.headers['accept-encoding']) {
                    console.warn("Gagal parsing JSON, mencoba lagi tanpa accept-encoding...");
                    const newOptions = { ...options };
                    delete newOptions.headers['accept-encoding'];
                    return await keepv.tools.mintaJson(description, url, newOptions);
                }
                throw Error(`gagal mintaJson ${description} -> ${err.message}`)
            }
        },
        validateString: (description, theVariable) => {
            if (typeof (theVariable) !== "string" || theVariable?.trim()?.length === 0) {
                throw Error(`variabel ${description} harus string dan gak boleh kosong`)
            }
        },
        delay: async (ms) => new Promise(re => setTimeout(re, ms)),
        handleFormat: (desireFormat) => {
            const validParam = ["audio", "240p", "360p", "480p", "720p", "1080p", "best_video"]
            if (!validParam.includes(desireFormat)) throw Error(`${desireFormat} is invalid format. just pick one of these: ${validParam.join(", ")}`)
            let result
            result = desireFormat.match(/^(\d+)p/)?.[1]
            if (!result) {
                desireFormat === validParam[0] ? result = desireFormat : result = "10000"
            }
            return result
        }
    },
    konstanta: {
        origin: "https://keepv.id",
        baseHeaders: {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            // "accept-encoding": "gzip, deflate, br, zstd", // Dihapus sementara untuk menghindari error JSON
            "accept-language": "en-GB,en;q=0.9,en-US;q=0.8",
            "cache-control": "no-cache",
            "connection": "keep-alive",
            "host": "keepv.id",
            "pragma": "no-cache",
            "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Microsoft Edge\";v=\"138\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "upgrade-insecure-requests": "1",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"
        }
    },
    async getCookieAndRedirectUrl(origin, baseHeaders) {
        try {
            const headers = { ...baseHeaders }
            const r = await fetch(origin, { headers })
            if (!r.ok) throw Error(`${r.status} ${r.statusText}\n${await r.text() || `(kosong respond nyah)`}`)
            const h = r.headers
            const cookies = h.getSetCookie()
            const cookie = cookies?.[0]?.split("; ")?.[0]
            if (!cookie) throw Error(`Kuki tidak ditemukan saat fetch awal.`)
            return { cookie, urlRedirect: r.url }
        } catch (error) {
            throw Error(`function getCookie gagal. ${error.message}`)
        }
    },
    async validateCookie(resultGetCookieAndRedirectUrl, origin, youtubeUrl, baseHeaders, format) {
        const { cookie, urlRedirect } = resultGetCookieAndRedirectUrl
        const headers = { cookie, referer: urlRedirect, ...baseHeaders }
        const pathname = format === "audio" ? "button" : "vidbutton"
        const url = `${origin}/${pathname}/?url=${youtubeUrl}`
        const r = await fetch(url, { headers })
        if (!r.ok) throw Error(`${r.status} ${r.statusText}\n${await r.text() || `(respond nya kosong :v)`}`)
        return { cookie, referer: url }
    },
    async convert(resultValidateCookie, origin, youtubeUrl, baseHeaders, format) {
        const { cookie, referer } = resultValidateCookie
        const headers = {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            cookie, referer, origin, "x-requested-with": "XMLHttpRequest", ...baseHeaders
        }
        delete headers["upgrade-insecure-requests"]
        const payload = {
            url: youtubeUrl, convert: "gogogo", token_id: this.tools.generateHex(64, { prefix: "t_" }),
            token_validto: this.tools.generateTokenValidTo(),
        }
        if (format !== "audio") payload.height = format
        const body = new URLSearchParams(payload)
        const pathname = format === "audio" ? "convert" : "vidconvert"
        const url = `${origin}/${pathname}/`
        const result = await this.tools.mintaJson(`convert`, url, { headers, body, "method": "post" })
        if (result.error) throw Error(`Gagal convert dari server: ${result.error}`)
        if (!result.jobid) throw Error(`job id tidak ditemukan setelah proses convert.`)
        return result
    },
    async checkJob(resultValidateCookie, resultConvert, origin, baseHeaders, format, identifier) {
        const { cookie, referer } = resultValidateCookie
        const { jobid } = resultConvert
        const headers = { cookie, referer, "x-requested-with": "XMLHttpRequest", ...baseHeaders }
        delete headers["upgrade-insecure-requests"]
        const usp = new URLSearchParams({ jobid, time: Date.now() })
        const pathname = format === "audio" ? "convert" : "vidconvert"
        const url = new URL(`${origin}/${pathname}/`)
        url.search = usp
        const MAX_FETCH_ATTEMPT = 60
        const FETCH_INTERVAL = 5000
        let fetchCount = 0
        let data = {}
        do {
            fetchCount++
            const r = await fetch(url, { headers })
            data = await r.json()
            if (data.dlurl) return data
            if (data.error) throw Error(`Error saat cek job: ${JSON.stringify(data, null, 2)}`)
            let pesan = data.retry;
            if (pesan && pesan.startsWith("Downloading audio data")) {
                const temp = pesan.match(/^(.+?)<(?:.+?)valuenow=\"(.+?)\"/)
                pesan = `${temp?.[1]} ${temp?.[2]}%`
            } else if (pesan) {
                pesan = pesan.match(/^(.+?)</)?.[1]
            }
            console.log(`${identifier} check job... ${pesan || 'Menunggu respon...'}`)
            await this.tools.delay(FETCH_INTERVAL)
        } while (fetchCount < MAX_FETCH_ATTEMPT && data.retry)
        throw Error(`Mencapai batas maksimal percobaan. Proses memakan waktu terlalu lama.`)
    },
    async download(youtubeUrl, userFormat = "audio", owner = "") {
        this.tools.validateString(`youtube url`, youtubeUrl)
        const format = this.tools.handleFormat(userFormat)
        const identifier = this.tools.generateHex(4, { prefix: owner.trim().length ? `${owner.trim()}-` : owner.trim() })
        console.log(`[STARTING TASK] ${identifier} | Format: ${userFormat}`)
        const origin = this.konstanta.origin
        const headers = this.konstanta.baseHeaders
        const resultGCARU = await this.getCookieAndRedirectUrl(origin, headers)
        const resultVC = await this.validateCookie(resultGCARU, origin, youtubeUrl, headers, format)
        const resultConvert = await this.convert(resultVC, origin, youtubeUrl, headers, format)
        const result = await this.checkJob(resultVC, resultConvert, origin, headers, format, identifier)
        console.log(`[TASK COMPLETED] ${identifier}`)
        const type = userFormat == "audio" ? "audio" : "video"
        return { ...result, identifier, type, format: userFormat }
    }
};

/**
 * Mengekstrak YouTube video ID dari berbagai format URL.
 */
export function extractYouTubeId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * Mendapatkan judul video dari YouTube menggunakan oEmbed API.
 */
export async function getYoutubeTitle(youtubeUrl) {
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`);
        if (!response.ok) return "Judul tidak ditemukan";
        const data = await response.json();
        return data.title || "Judul tidak ditemukan";
    } catch (error) {
        console.error("Gagal mendapatkan judul:", error);
        return "Judul tidak ditemukan";
    }
}
