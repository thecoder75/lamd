/*

    LiveMe Account Monitor Daemon v2.0

*/

const os = require('os')
const platform = require('platform')
const fs = require('fs')
const path = require('path')
const request = require('request')
const LivemeAPI = require('./livemeapi')
const LiveMe = new LivemeAPI({})
const ffmpeg = require('fluent-ffmpeg')
const async = require('async')

let op = ''
let bookmarks = []
let bookmark_index = 0
let download_list = []
let minuteTicks = 0
let appSettings = {}
let isOnline = false

main();

function main() {

    setInterval(() => {
        minuteTicks++;
        if (minuteTicks > 29) {
            // We begin a scan process
            minuteTicks = 0;

            if (isOnline) {
                beginBookmarkScan()
            }
        }
    }, 60000)

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
        process.stdout.write('LiveMe Pro Tools settings file found, reading...\n')
        appSettings = JSON.parse(fs.readFileSync(path.join(op, 'Settings')))
    }

    if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
        // Configuration file was found
        process.stdout.write('LiveMe Pro Tools bookmarks file found, reading...\n')

        loadBookmarks()
        fs.watch(path.join(op, 'bookmarks.json'), () => {
            loadBookmarks()
        })

        setTimeout(() => {
            beginBookmarkScan()
        }, 15000)
    }



    // Not sure if I'll keep this feature/function anymore
    if (fs.existsSync('queued.json')) {
        fs.readFile('queued.json', 'utf8', (err,data) => {
            if (!err) {
                download_list = JSON.parse(data)

                if (download_list.length > 0) {
                    if (config.console_output) process.stdout.write("\x1b[1;33mResuming existing download queue...\n")
                
                    setTimeout(() => {
                        downloadFile()
                    }, 5000)
                }
            }
        })
    }

    
}

function loadBookmarks() {
    if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
        // Configuration file was found
        process.stdout.write('LiveMe Pro Tools bookmarks file loaded.\n')

        if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
            fs.readFile(path.join(op, 'bookmarks.json'), 'utf8', function(err, data) {
                if (err) {
                    bookmarks = []
                } else {
                    bookmarks = JSON.parse(data)
                    if (bookmarks.length == 0) return

                    bookmark_index = 0;

                    process.stdout.write('\tRead in ' + bookmarks.length + ' bookmarks into memory.\n')

                }
            })
        }

    }    
}






/*
        Bookmark Scan Loop
*/
function beginBookmarkScan() {

    setTimeout(() => {
        if (bookmarks[bookmark_index].lamd.monitor == true) {
            scanForNewReplays(bookmark_index)
        }

        bookmark_index++
        if (bookmark_index > bookmarks.length) bookmark_index = 0

        beginBookmarkScan()
    }, 50)

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
        bookmarks[i].scanned = dt
        
        fs.writeFile(
            path.join(op, 'bookmarks.json'),
            JSON.stringify(bookmarks), 
            () => {

            }
        );
        

        var replay_count = 0
        for (ii = 0; ii < replays.length; ii++) {

            // If we take the video time and subtract the last time we scanned and its
            // greater than zero then its new and needs to be added
            if ((replays[ii].vtime - last_scanned) > 0) {

                var add_replay = true;
                for (var j = 0; j < download_list.length; j++) {
                    if (download_list[j] == replays[ii].vid) add_replay = false
                }
                if (add_replay == true) {
                    replay_count++
                    download_list.push(replays[ii].vid)
                    fs.writeFileSync('queued.json', JSON.stringify(download_list))
                }
            }
        }

        if (replay_count > 0) {
            if (config.console_output) process.stdout.write("\x1b[1;36mAdding \x1b[1;33m"+replay_count+" \x1b[1;36mreplays for \x1b[1;33m"+userid+"        \n");
            downloadFile();
        } else {
            if (config.console_output) process.stdout.write("\x1b[1;36mNo new replays found for \x1b[1;33m"+userid+"\x1b[1;36m.                            \n");
        }

    });

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

        mainWindow.webContents.send('download-start', {
            videoid: task,
            filename: filename
        })

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
                                let tsPath = `${path}/lpt_temp/${video.vid}_${tsName}`

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

                            /*
                            mainWindow.webContents.send('download-progress', {
                                videoid: task,
                                state: `Downloading stream chunks.. (${downloadedChunks}/${tsList.length})`,
                                percent: Math.round((downloadedChunks / tsList.length) * 100)
                            })
                            */
                            next()

                        })

                    }, () => {
                        // Chunks downloaded
                        let cfile = path + '/lpt_temp/' + video.vid + '.txt'
                        ffmpeg()
                            .on('start', c => {

                                /*
                                mainWindow.webContents.send('download-progress', {
                                    videoid: task,
                                    state: `Converting to MP4 file, please wait..`,
                                    percent: 0
                                })
                                */

                            })
                            .on('progress', function(progress) {
                                // FFMPEG doesn't always have this >.<
                                let p = progress.percent
                                if (p > 100) p = 100

                                /*
                                mainWindow.webContents.send('download-progress', {
                                    videoid: task,
                                    state: `Combining and converting to MP4 file, please wait...`,
                                    percent: p
                                })
                                */
                            })
                            .on('end', (stdout, stderr) => {
                                
                                if (appSettings.get('downloads.deltmp')) {
                                    tsList.forEach(file => fs.unlinkSync(file.path))
                                }

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
                        DataManager.addDownloaded(video.vid)
                        return done()
                    })
                    .on('progress', function(progress) {
                        
                        if (!progress.percent) {
                            progress.percent = ((progress.targetSize * 1000) / +video.videosize) * 100
                        }
                        /*
                        mainWindow.webContents.send('download-progress', {
                            videoid: task,
                            state: `Downloading (${Math.round(progress.percent)}%)`,
                            percent: progress.percent
                        })
                        */
                    })
                    .on('start', function(c) {
                        /*
                        mainWindow.webContents.send('download-start', {
                            videoid: task,
                            filename: filename
                        })
                        */

                    })
                    .on('error', function(err, stdout, stderr) {
                        fs.writeFileSync(`${path}/${filename}-error.log`, JSON.stringify([err, stdout, stderr], null, 2))
                        return done({ videoid: task, error: err })
                    })
                    .run()
                break
        }
    })
}, +appSettings.downloads.parallel || 3)



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
