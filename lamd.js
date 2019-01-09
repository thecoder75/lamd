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

    let op = ''
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

    if (fs.existsSync(path.join(op, 'Settings'))) {
        // Configuration file was found
        process.stdout.write('LiveMe Pro Tools bookmarks file found, reading...\n')

        if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
            fs.readFile(path.join(op, 'bookmarks.json'), 'utf8', function(err, data) {
                if (err) {
                    bookmarks = []
                } else {
                    bookmarks = JSON.parse(data)
                    if (bookmarks.length == 0) return

                    process.stdout.write('\tLoaded ' + bookmarks.length + ' bookmarks into memory.\n')
                    setTimeout(() => {
                        beginBookmarkScan()
                    }, 15000)

                }
            })
        }

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








/*
        Bookmark Scan Loop
*/
function beginBookmarkScan() {

    if (bookmark_index < bookmarks.length) {
        setTimeout(() => {
            beginBookmarkScan()
        }, 50)
    }

    setImmediate(function(){
        if (bookmark_index < bookmarks.length) { 
            bookmark_index++
            scanForNewReplays(bookmark_index)
        }
    })
}

/*
        Replay Scan
*/
function scanForNewReplays(i) {

    if (bookmarks[i] == undefined) return;

    LiveMe.getUserReplays(bookmarks[i].userid, 1, 10).then(replays => {

        if (replays == undefined) return;
        if (replays.length < 1) return;

        var ii = 0, 
            count = 0, 
            userid = replays[0].userid,
            last_scanned = 0,
            dt = Math.floor((new Date()).getTime() / 1000);

        last_scanned = accounts[i].scanned;
        accounts[i].scanned = dt;
        
        fs.writeFile(
            'accounts.json', 
            JSON.stringify(accounts), 
            () => {}
        );
        

        var replay_count = 0;
        for (ii = 0; ii < replays.length; ii++) {

            // If we take the video time and subtract the last time we scanned and its
            // greater than zero then its new and needs to be added
            if ((replays[ii].vtime - last_scanned) > 0) {

                var add_replay = true;
                for (var j = 0; j < download_list.length; j++) {
                    if (download_list[j] == replays[ii].vid) add_replay = false;
                }
                if (add_replay == true) {
                    replay_count++;
                    download_list.push(replays[ii].vid);
                    fs.writeFile(
                        'queued.json', 
                        JSON.stringify(download_list), 
                        () => {
                            // Queue file was written
                        }
                    );
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








/*
        
        Download Handler

*/
function downloadFile() {

    if (downloadActive == true) return;
    if (download_list.length == 0) return;

    LiveMe.getVideoInfo(download_list[0]).then(video => {

        var dt = new Date(video.vtime * 1000), mm = dt.getMonth() + 1, dd = dt.getDate(), filename = '';

        filename = config.downloadTemplate
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
            .replace(/%%replaydateeu%%/g, ((dd < 10 ? '0' : '') + dd + '-' + (mm < 10 ? '0' : '') + mm + '-' + dt.getFullYear()));

        // Cleanup any illegal characters in the filename
        filename = filename.replace(/[/\\?%*:|"<>]/g, '-');
        filename = filename.replace(/([^a-z0-9\s]+)/gi, '-');
        filename = filename.replace(/[\u{0080}-\u{FFFF}]/gu, '');

        if (config.downloaderFFMPEG == true) { 

            filename += '.mp4';

            ffmpeg(video.hlsvideosource)
                .outputOptions([
                    '-c copy',
                    '-bsf:a aac_adtstoasc',
                    '-vsync 2',
                    '-movflags faststart'
                ])
                .output(config.downloadPath + '/' + filename)
                .on('end', function(stdout, stderr) {
                    if (config.console_output) process.stdout.write("\x1b[1;34mReplay \x1b[1;33m" + download_list[0] + " \x1b[1;34m- downloaded.                   \n");

                    download_list.shift();
                    downloadActive = false;

                    // Update current queue file
                    fs.writeFile(
                        'queued.json', 
                        JSON.stringify(download_list), 
                        () => {
                            
                        }
                    );

                    downloadFile();

                })
                .on('progress', function(progress) {

                    if (config.console_output) process.stdout.write("\x1b[1;34mReplay \x1b[1;33m" + download_list[0] + " \x1b[1;34m- \x1b[1;33m" + progress.percent.toFixed(2) + "%     \r");

                })
                .on('start', function(c) {
                    downloadActive = true;
                })
                .on('error', function(err, stdout, exterr) {
                    if (config.console_output) process.stdout.write("\x1b[1;34mReplay \x1b[1;33m" + download_list[0] + " \x1b[1;34m- \x1b[1;31mErrored \x1b[1;36m(\x1b[1;34mDetails: \x1b[1;37m"+err+"\x1b[1;36m)   \n");

                    errored_list.push(download_list[0]);
                    download_list.shift();
                    downloadActive = false;

                    // Update current queue file
                    fs.writeFile(
                        'queued.json', 
                        JSON.stringify(download_list), 
                        () => {
                            // Queue file was written
                        }
                    );

                    // Update errored file
                    fs.writeFile(
                        'errored.json', 
                        errored_list.join("\n"),
                        () => {
                            // Errored file was written
                        }
                    );

                    downloadFile();

                })
                .run();
            } else {
                filename += '.ts';

                m3u8stream(video, {
                    chunkReadahead: config.downloadChunks,
                    on_progress: (e) => {

                        var p = Math.floor((e.index / e.total) * 10000) / 100;
                        if (config.console_output) process.stdout.write("\x1b[1;34mReplay \x1b[1;33m" + download_list[0] + " \x1b[1;34m- \x1b[1;33m" + p + "%               \r");

                    }, 
                    on_complete: (e) => {
                        if (config.console_output) process.stdout.write("\x1b[1;34mReplay \x1b[1;33m" + download_list[0] + " \x1b[1;34m- downloaded.                   \n");

                        download_list.shift();
                        downloadActive = false;

                        // Update current queue file
                        fs.writeFile(
                            'queued.json', 
                            JSON.stringify(download_list), 
                            () => {
                                
                            }
                        );

                        downloadFile();
                    },
                    on_error: (e) => {

                        // We ignore the timeout errors to avoid issues.
                        if (e.error == 'Download timeout') return;

                        if (config.console_output) process.stdout.write("\x1b[1;34mReplay \x1b[1;33m" + download_list[0] + " \x1b[1;34m- \x1b[1;31mErrored \x1b[1;36m(\x1b[1;34mDetails: \x1b[1;37m"+err+"\x1b[1;36m)   \n");

                        errored_list.push(download_list[0]);
                        download_list.shift();
                        downloadActive = false;

                        // Update current queue file
                        fs.writeFile(
                            'queued.json', 
                            JSON.stringify(download_list), 
                            () => {
                                // Queue file was written
                            }
                        );

                        // Update errored file
                        fs.writeFile(
                            'errored.json', 
                            errored_list.join("\n"),
                            () => {
                                // Errored file was written
                            }
                        );

                        downloadFile();
                    }
                }).pipe(fs.createWriteStream(config.downloadPath + '/' + filename));

            }




    });

}