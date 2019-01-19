/*

    LiveMe Account Monitor Daemon v2.0

*/

const os = require('os')
const fs = require('fs')
const path = require('path')
const request = require('request')
const LivemeAPI = require('./livemeapi')
const LiveMe = new LivemeAPI({})
const ffmpeg = require('fluent-ffmpeg')
const async = require('async')
const terminal = new(require('./terminal'))
const pjson = require('./package.json')

let op = ''
let bookmarks = []
let bookmark_index = 0
let bookmarks_loading = false
let minuteTicks = 29
let secondTicks = 45
let appSettings = {}
let isOnline = false
let active_downloads = {}
let download_list = []
let scan_active = false

main();

function main() {

    terminal.clear()

    terminal.color('bright-blue')
    terminal.writexy(1,  1, '+------------------------------------------------------------------------------+')
    terminal.writexy(1,  2, '|                                                                              |')
    terminal.writexy(1,  3, '+------------------------------------------------------------------------------+')
    terminal.writexy(1,  4, '|                                                                              |')
    terminal.writexy(1,  5, '|                                                                              |')
    terminal.writexy(1,  6, '|                                                                              |')
    terminal.writexy(1,  7, '|                                                                              |')
    terminal.writexy(1,  8, '|                                                                              |')
    terminal.writexy(1,  9, '|                                                                              |')
    terminal.writexy(1, 10, '|                                                                              |')
    terminal.writexy(1, 11, '|                                                                              |')
    terminal.writexy(1, 12, '|                                                                              |')
    terminal.writexy(1, 13, '|                                                                              |')
    terminal.writexy(1, 14, '|                                                                              |')
    terminal.writexy(1, 15, '|                                                                              |')
    terminal.writexy(1, 16, '|                                                                              |')
    terminal.writexy(1, 17, '|                                                                              |')
    terminal.writexy(1, 18, '|                                                                              |')
    terminal.writexy(1, 19, '|                                                                              |')
    terminal.writexy(1, 20, '|                                                                              |')
    terminal.writexy(1, 21, '|                                                                              |')
    terminal.writexy(1, 22, '|                                                                              |')
    terminal.writexy(1, 23, '+------------------------------------------------------------------------------+')
    terminal.writexy(1, 24, '|                                                                              |')
    terminal.writexy(1, 25, '+------------------------------------------------------------------------------+')

    terminal.color('bright-green')
    terminal.writexy(50, 2, 'LiveMe Account Monitor Daemon')
    terminal.writexy( 3, 24, 'v' + pjson.version)

    terminal.color('blue')
    terminal.writexy(59, 24, 'Press CTRL+C to quit.')
    terminal.writexy( 3, 4,'Status:')

    tickThread()

    op = ''
    if (process.platform == 'win32')
        op = process.env.APPDATA
    else if (process.platform == 'darwin')
        op = process.env.HOME + '/Library/Preferences'
    else
        op = process.env.HOME + '/.config'

    op += '/liveme-pro-tools'

    if (fs.existsSync(path.join(op, 'Settings'))) {
        // Configuration file was found

        appSettings = JSON.parse(fs.readFileSync(path.join(op, 'Settings')))

        if (appSettings.auth !== undefined) {
            LiveMe.setAuthDetails(appSettings.auth.email.trim(), appSettings.auth.password.trim())
            isOnline = true
            setTimeout(() => {
                terminal.color('bright-green')
                terminal.writexy(3,2,'Logged In')
            }, 1000)
        } else {
            terminal.color('bright-red')
            terminal.writexy(3,2,'Invalid Login')
        }
    } else {
        terminal.color('bright-red')
        terminal.writexy(5,13,'LMPT missing')
    }

    if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
        loadBookmarks()
        fs.watch(path.join(op, 'bookmarks.json'), () => {
            if (bookmarks_loading) return;
            bookmarks_loading = true;
            loadBookmarks()
        })
    }
    
}

async function tickThread() {
    setInterval(() => {
        if (active_downloads.length > 0) {
            let y = 0

            terminal.color('bright-green')
            terminal.writexy(3,22,'Downloading '+download_list.length+' replays')

            for (var vid in active_downloads) {
                
                let p = active_downloads[vid].progress + '%'
                terminal.color('white')
                terminal.writexy(2, 6 + y, vid)
                terminal.color('bright-yellow')
                terminal.writexy(78 - p, 6 + y, active_downloads[vid].status)
                terminal.color('bright-blue')
                terminal.writexy(2, 7 + y, active_downloads[vid].status)

                y += 3
            }
        }



        secondTicks++

        let t1 = 29 - minuteTicks
        let t2 = 60 - secondTicks
        if (t1 < 10) t1 = '0' + t1
        if (t2 < 10) t2 = '0' + t2
        
        if (!scan_active && (minuteTicks > 15)) {
            terminal.color('bright-cyan')
            terminal.writexy(12,4,`Next scan in ${t1}:${t2}`)
        }

        if (!scan_active && (minuteTicks < 16)) {
            terminal.color('bright-blue')
            terminal.writexy(1,  4, '|                                                                              |')
            terminal.color('blue')
            terminal.writexy( 3, 4,'Status:')
        }

        if (secondTicks > 59) {
            secondTicks = 0
            minuteTicks++

            terminal.color('bright-blue')
            terminal.writexy(1,  4, '|                                                                              |')
            terminal.color('blue')
            terminal.writexy( 3, 4,'Status:')

            if (minuteTicks > 29) {
                // We begin a scan process
                minuteTicks = 0;

                if (isOnline) {
                    scan_active = true
                    beginBookmarkScan()
                } else {
                    terminal.color('bright-blue')
                    terminal.writexy(1,  4, '|                                                                              |')
                    terminal.color('blue')
                    terminal.writexy( 3, 4,'Status:')
                }
            }
        }
    }, 1000)
}

function loadBookmarks() {
    if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
        // Configuration file was found

        if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
            setTimeout(()=>{

                terminal.color('bright-yellow')
                terminal.writexy(55,22,'Loading bookmarks...')

                fs.readFile(path.join(op, 'bookmarks.json'), 'utf8', function(err, data) {
                    if (err) {
                        bookmarks = []
                    } else {
                        bookmarks = JSON.parse(data)
                        if (bookmarks.length == 0) return
    
                        bookmark_index = 0;
    
                        setTimeout(() => {
                            let t = '       ' + bookmarks.length + ' bookmarks loaded.'
                            terminal.color('bright-magenta')
                            terminal.writexy(79 - t.length, 22, t)
                        }, 1000)                        
            
                    }
                    bookmarks_loading = false
                })
            }, 250)
        }

    }    
}






/*
        Bookmark Scan Loop
*/
function beginBookmarkScan() {

    if (bookmarks[bookmark_index].lamd != undefined) {
        if (bookmarks[bookmark_index].lamd.monitored == true) {
            terminal.color('bright-yellow')
            terminal.writexy(15,4,`Scanning bookmarks now (${bookmarks[bookmark_index].uid})...`)
            
            let t = Math.round((bookmark_index / bookmarks.length) * 100) + '%'
            terminal.color('bright-white')
            terminal.writexy( 78 - t.length, 4, t)

            scanForNewReplays(bookmark_index)
        }
    } else {
        terminal.color('bright-blue')
        terminal.writexy(1,  4, '|                                                                              |')
        terminal.color('blue')
        terminal.writexy( 3, 4,'Status:')

        scan_active = false

        /*
        DEBUG
        fs.writeFile(
            path.join(op, 'bookmarks.json'),
            JSON.stringify(bookmarks), 
            () => {
                
            }
        );
        */
    }

    bookmark_index++

    if (bookmark_index < bookmarks.length) {
        setTimeout(() => {
            beginBookmarkScan()
        }, 50)
    } else {
        bookmark_index = 0;
    }


}

/*
        Replay Scan
*/
function scanForNewReplays(i) {

    if (bookmarks[i] == undefined) return

    LiveMe.getUserReplays(bookmarks[i].uid, 1, 10).then(replays => {

        if (replays == undefined) return
        if (replays.length < 1) return

        let ii = 0
        let count = 0
        let userid = replays[0].userid
        let last_scanned = 0
        let dt = Math.floor((new Date()).getTime() / 1000)

        last_scanned = bookmarks[i].lamd.last_checked
        bookmarks[i].lamd.last_checked = dt

        var replay_count = 0
        for (ii = 0; ii < replays.length; ii++) {
            if ((replays[ii].vtime - last_scanned) > 0) {
                var add_replay = true;
                for (var j = 0; j < download_list.length; j++) {
                    if (download_list[j] == replays[ii].vid) add_replay = false
                }
                if (add_replay == true) {
                    download_list.push(replays[ii].vid)
                    dlQueue.push(replays[ii].vid, err => {

                    })
                }
            }
        }

    })

}




const dlQueue = async.queue((task, done) => {
    // Set custom FFMPEG path if defined
    if (appSettings.downloads.ffmpeg) ffmpeg.setFfmpegPath(appSettings.downloads.ffmpeg)

        // Get video info
    LiveMe.getVideoInfo(task).then(video => {
        const path = appSettings.downloads.path
        const dt = new Date(video.vtime * 1000)
        const mm = dt.getMonth() + 1
        const dd = dt.getDate()
        let ffmpegOpts = []

        let filename = appSettings.downloads.template
            .replace(/%%broadcaster%%/g, video.uname)
            .replace(/%%longid%%/g, video.userid)
            .replace(/%%replayid%%/g, video.vid)
            .replace(/%%replayviews%%/g, video.playnumber)
            .replace(/%%replaylikes%%/g, video.likenum)
            .replace(/%%replayshares%%/g, video.sharenum)
            .replace(/%%replaytitle%%/g, video.title ? video.title : 'untitled')
            .replace(/%%replayduration%%/g, video.videolength)
            .replace(/%%replaydatepacked%%/g, (dt.getFullYear() + (mm < 10 ? '0' : '') + mm + (dd < 10 ? '0' : '') + dd))
            .replace(/%%replaydateus%%/g, ((mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd + '-' + dt.getFullYear()))
            .replace(/%%replaydateeu%%/g, ((dd < 10 ? '0' : '') + dd + '-' + (mm < 10 ? '0' : '') + mm + '-' + dt.getFullYear()))

        filename = filename.replace(/[/\\?%*:|"<>]/g, '-')
        filename = filename.replace(/([^a-z0-9\s]+)/gi, '-')
        filename = filename.replace(/[\u{0080}-\u{FFFF}]/gu, '')
        filename += '.mp4'
        video._filename = filename

        active_downloads[task] = {
            progress: 0,
            status: 'Preparing to download'
        }

        switch (parseInt(appSettings.downloads.ffmpegquality)) {
            case 9: // AMD Hardware HEVC/H265 Encoder
                ffmpegOpts = [
                    '-c:v hevc_amf',
                    '-preset superfast',
                    '-b:v 300k',
                    '-r 15',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            case 8: // nVidia Hardware HEVC/H265 Encoder
                ffmpegOpts = [
                    '-c:v hevc_nvenc',
                    '-preset superfast',
                    '-b:v 300k',
                    '-r 15',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            case 7: // Intel Hardware HEVC/H265 Encoder
                ffmpegOpts = [
                    '-c:v hevc_qsv',
                    '-preset superfast',
                    '-b:v 300k',
                    '-r 15',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            case 6: // HEVC/H265 Encoder
                ffmpegOpts = [
                    '-c:v hevc',
                    '-preset superfast',
                    '-b:v 300k',
                    '-r 15',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            case 5: // AMD AMF Hardware Enabled - Experimental
                ffmpegOpts = [
                    '-c:v h264_amf',
                    '-preset none',
                    '-b:v 500k',
                    '-r 15',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            case 4: // nVidia Hardware Enabled - Experimental
                ffmpegOpts = [
                    '-c:v h264_nvenc',
                    '-preset none',
                    '-b:v 500k',
                    '-r 15',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            case 3: // Intel Hardware Enabled - Experimental
                ffmpegOpts = [
                    '-c:v h264_qsv',
                    '-preset none',
                    '-b:v 500k',
                    '-r 15',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            case 2: // Best
                ffmpegOpts = [
                    '-c:v h264',
                    '-preset fast',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            case 1: // Fast
                ffmpegOpts = [
                    '-c:v h264',
                    '-preset superfast',
                    '-q:v 0',
                    '-c:a copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break

            default: // None
                ffmpegOpts = [
                    '-c copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ]
                break
        }


        switch (appSettings.downloads.method) {
            case 'chunk':
                request(video.hlsvideosource, (err, res, body) => {
                    if (err || !body) {
                        fs.writeFileSync(`${path}/${filename}-error.log`, JSON.stringify(err, null, 2))
                        return done({ videoid: task, error: err || 'Failed to fetch m3u8 file.' })
                    }
                    // Separate ts names from m3u8
                    let concatList = ''
                    const tsList = []
                    body.split('\n').forEach(line => {
                            if (line.indexOf('.ts') !== -1) {
                                const tsName = line.split('?')[0]
                                let tsPath = `${path}/lamd_temp/${video.vid}_${tsName}`

                                if (process.platform == 'win32') {
                                    tsPath = tsPath.replace(/\\/g, '/');
                                }

                                // Check if TS has already been added to array
                                if (concatList.indexOf(tsPath) === -1) {
                                    // We'll use this later to merge downloaded chunks
                                    concatList += 'file ' + video.vid + '_' + tsName + '\n'
                                        // Push data to list
                                    tsList.push({ name: tsName, path: tsPath })
                                }
                            }
                        })
                        // remove last |
                        //concatList = concatList.slice(0, -1)
                        // Check if tmp dir exists
                    if (!fs.existsSync(`${path}/lamd_temp`)) {
                        // create temporary dir for ts files
                        fs.mkdirSync(`${path}/lamd_temp`)
                    }
                    fs.writeFileSync(`${path}/lamd_temp/${video.vid}.txt`, concatList)

                    // Download chunks
                    let downloadedChunks = 0

                    async.eachLimit(tsList, 4, (file, next) => {

                        const stream = request(`${video.hlsvideosource.split('/').slice(0, -1).join('/')}/${file.name}`)
                            .on('error', err => {
                                fs.writeFileSync(`${path}/${filename}-error.log`, JSON.stringify(err, null, 2))
                                return done({ videoid: task, error: err })
                            })
                            .pipe(
                                fs.createWriteStream(file.path)
                            )
                            // Events
                        stream.on('finish', () => {
                            downloadedChunks += 1
                            active_downloads[task].status = `Downloading ${downloadedChunks} of ${tsList.length}`
                            active_downloads[task].progress = Math.round((downloadedChunks / tsList.length) * 100)
                            next()

                        })

                    }, () => {
                        // Chunks downloaded
                        let cfile = path + '/lamd_temp/' + video.vid + '.txt'
                        ffmpeg()
                            .on('start', c => {

                                active_downloads[task].status = `Combining chunks and transcoding to MP4 format...`
                                active_downloads[task].progress = 100

                            })
                            .on('progress', function(progress) {
                                // FFMPEG doesn't always have this >.<
                                let p = progress.percent
                                if (p > 100) p = 100

                                active_downloads[task].status = `Combining chunks and transcoding to MP4 format...`
                                active_downloads[task].progress = p

                            })
                            .on('end', (stdout, stderr) => {
                                
                                for (let j = 0; j < download_list.length; j++) {
                                    if (download_list[j] === task) {
                                        download_list.splice(j, 1)
                                    }
                                }
                                delete active_downloads[task]
        
                                if (appSettings.downloads.saveMessageHistory == true) {
                                    LiveMe.getChatHistoryForVideo(video.msgfile)
                                    .then(raw => {
                                        let t = raw.split('\n')
                                        let dump = ''

                                        for (let i = 0; i < t.length - 1; i++) {
                                            try {
                                                let j = JSON.parse(t[i])
                                                let timeStamp = formatDuration(parseInt(j.timestamp) - startTime)
                    
                                                if (j.objectName === 'app:joinchatroommsgcontent') {
                                                } else if (j.objectName === 'app:leavechatrrommsgcontent') {
                                                } else if (j.objectName === 'app:praisemsgcontent') {
                                                } else if (j.objectName === 'RC:TxtMsg') {
                                                    dump += `[${timeStamp}] ${j.content.user.name}: ${j.content.content}`
                                                    dump += '\n';
                                                }
                                            } catch (err) {
                                                // Caught
                                                console.log(err)
                                            }
                                        }

                                        fs.writeFileSync(`${path}/${filename}-chat.txt`, dump)
                                    })
                                }

                                return done()
                            })
                            .on('error', (err) => {
                                fs.writeFileSync(`${path}/${filename}-error.log`, err)
                                for (let j = 0; j < download_list.length; j++) {
                                    if (download_list[j] === task) {
                                        download_list.splice(j, 1)
                                    }
                                }
                                delete active_downloads[task]
                                return done({ videoid: task, error: err })
                            })
                            .input(cfile.replace(/\\/g, '/'))
                            .inputFormat('concat')
                            .output(`${path}/${filename}`)
                            .inputOptions([
                                '-safe 0',
                                '-f concat'
                            ])
                            .outputOptions(ffmpegOpts)
                            .run()
                    })
                })
                break
            case 'ffmpeg':
                ffmpeg(video.hlsvideosource)
                    .outputOptions(ffmpegOpts)
                    .output(path + '/' + filename)
                    .on('end', function(stdout, stderr) {
                        for (let j = 0; j < download_list.length; j++) {
                            if (download_list[j] === task) {
                                download_list.splice(j, 1)
                            }
                        }
                        delete active_downloads[task]
                        return done()
                    })
                    .on('progress', function(progress) {
                        
                        if (!progress.percent) {
                            progress.percent = ((progress.targetSize * 1000) / +video.videosize) * 100
                        }
                        active_downloads[task].status = `Downloading...`
                        active_downloads[task].progress = progress.percent

                    })
                    .on('start', function(c) {

                        active_downloads[task].status = `Downloading...`
                        active_downloads[task].progress = 0

                    })
                    .on('error', function(err, stdout, stderr) {
                        fs.writeFileSync(`${path}/${filename}-error.log`, JSON.stringify([err, stdout, stderr], null, 2))
                        for (let j = 0; j < download_list.length; j++) {
                            if (download_list[j] === task) {
                                download_list.splice(j, 1)
                            }
                        }
                        delete active_downloads[task]
                        return done({ videoid: task, error: err })
                    })
                    .run()
                break
        }
    })
}, (appSettings.download === undefined ? 3 : (appSettings.downloads.parallel < 5) ? appSettings.downloads.parallel : 5))



/*
        
        Download Handler

*/
function downloadFile() {

    if (downloadActive == true) return;
    if (download_list.length == 0) return;

    dlQueue.push(arg.videoid, err => {
        if (err) {
            mainWindow.webContents.send('download-error', err)
        } else {
            mainWindow.webContents.send('download-complete', { videoid: arg.videoid })
        }
    })
}






function termClear() { process.stdout.write('\x1b[2J\x1b[1;1H') }
function termGotoXY(x,y) { process.stdout.write('\1xb['+y+';'+x+'H') }
