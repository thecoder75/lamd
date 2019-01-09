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

            }
        }
    }, 60000)

    let op = ''
    if (process.platform == 'win32')
        op = process.env.APPDATA
    else if (process.platform == 'darwin')
        op = process.env.HOME + 'Library/Preferences'
    else
        op = process.env.HOME + '.config'

    if (fs.existsSync(path.join(op, 'Settings'))) {
        // Configuration file was found
        process.stdout.write('LiveMe Pro Tools settings file found, reading...\n')
        appSettings = JSON.parse(fs.readFileSync(path.join(op, 'Settings')))

        console.log(JSON.stringify(appSettings, NULL, 2))

    }

    return;

    
    if (fs.existsSync('config.json')) {
        fs.readFile('config.json', 'utf8', (err,data) => {
            if (!err) {
                config = JSON.parse(data);

                // These options only come int play when using the stream downloader and not FFMPEG
                if ((config.downloaderFFMPEG == undefined) || (config.downloaderFFMPEG == null)) config.downloaderFFMPEG = true;
                if (config.downloadChunks < 2) config.downloadChunks = 2;
                if (config.downloadChunks > 250) config.downloadChunks = 250;

                if (config.loopCycle > 360) config.loopCycle = 360;
                if (config.loopCycle < 15) config.loopCycle = 15;

                if ((config.console_output == undefined) || (config.console_output == null)) config.console_output = false;
            }


            if (config.console_output) {
                process.stdout.write("\x1b[1;34mLiveMe Account Monitor Daemon (LAMD)\n\x1b[0;34mhttps://thecoderstoolbox.com/lamd\n");
                process.stdout.write("\x1b[1;30m------------------------------------------------------------------------------\n");
                process.stdout.write("\x1b[1;32m     Scan Interval:      \x1b[1;36m" + config.loopCycle + " \x1b[1;32mminutes\n\n");

                process.stdout.write("\x1b[1;32m     Download Path:      \x1b[1;36m" + config.downloadPath + "\n");
                process.stdout.write("\x1b[1;32m     Download Template:  \x1b[1;36m" + config.downloadTemplate + "\n\n");
                process.stdout.write("\x1b[1;32m     Download Engine:    \x1b[1;36m" + (config.downloaderFFMPEG ? 'FFMPEG' : 'Stream Downloader') + "\n");
                if (config.downloaderFFMPEG == false) {
                    process.stdout.write("\x1b[1;32m     Download Chunks:    \x1b[1;36m" + config.downloadChunks + "\x1b[1;32m at a time\n");    
                }
                process.stdout.write("\x1b[1;30m------------------------------------------------------------------------------\n");
                process.stdout.write("\x1b[0;37m");
            }


        });
    }

    for (var i = 0; i < process.argv.length; i++) {
        if (process.argv[i] == '--writecfg') {
            fs.writeFile(
                'config.json', 
                JSON.stringify(config, null, 2), 
                () => {}
            );            
        }
    }

    /*
            Load Account List
    */
    if (fs.existsSync('accounts.json')) {
        fs.readFile('accounts.json', 'utf8', (err,data) => {
            if (!err) {
                accounts = JSON.parse(data);

                if (config.console_output) {
                    process.stdout.write("\x1b[1;33m" + accounts.length + " \x1b[1;34maccounts loaded in.\n");
                }

            }
        });
    }

    if (fs.existsSync('queued.json')) {
        fs.readFile('queued.json', 'utf8', (err,data) => {
            if (!err) {
                download_list = JSON.parse(data);

                if (download_list.length > 0) {
                    if (config.console_output) process.stdout.write("\x1b[1;33mResuming existing download queue...\n");
                
                    setTimeout(() => {
                        downloadFile();
                    }, 5000);
                }
            }
        });
    }



    /*
            Replay Check Interval - Runs every minute
    */
    setInterval(() => {
        minuteTick++;
        if (minuteTick == config.loopCycle) {
            minuteTick = 0;
            setImmediate(() => { 
                account_index = 0;
                accountScanLoop();
            });
        }
    }, 60000);

    setTimeout(() => {
        account_index = 0;
        accountScanLoop();
    }, 5);

    
    /*
            Internal Web Server - Used for command interface
    */
    http.createServer( (req, res) => {

        var chunks = req.url.substr(1).split('/'),
            response = {
                api_version: APIVERSION,
                code: 500,
                message: '',
                data: null
            }


        switch (chunks[0]) {

            case 'add-user':
            case 'add-account':
                var add_this = true, i = 0, isnum = /^\d+$/.test(chunks[1]);

                for (i = 0; i < accounts.length; i++) {
                    if (accounts[i].userid == chunks[1]) { add_this = false; }
                }

                if (add_this && isnum) {
                    accounts.push({
                        userid: chunks[1],
                        scanned: Math.floor((new Date()).getTime() / 1000)
                    });

                    fs.writeFile(
                        'accounts.json', 
                        JSON.stringify(accounts), 
                        () => {}
                    );

                    response.message = 'Account added.';
                    response.code = 200;
                    if (config.console_output) process.stdout.write("\x1b1;36mAdded \x1b[1;33m" + chunks[1] + " \x1b[1;36mfor monitoring.\n");
                } else {
                    response.message = 'Account already in list.';
                    response.code = 302;
                    if (config.console_output) process.stdout.write("\x1b[1;31mAccount \x1b[1;33m" + chunks[1] + " \x1b[1;31malready in database.\n");
                }
                break;


            case 'check-user':
            case 'check-account':
                var is_present = false;

                for (var i = 0; i < accounts.length; i++) {
                    if (accounts[i].userid == chunks[1]) { is_present = true; }
                }

                response.message = is_present ? 'Account is in the list.' : 'Account not found in the list.';
                response.data = [];
                response.code = is_present ? 200 : 404;
                break;


            case 'remove-user':
            case 'remove-account':
                response.message = 'Account not in the list.';
                response.code = 404;

                for (var i = 0; i < accounts.length; i++) {
                    if (accounts[i].userid == chunks[1]) {
                        accounts.splice(i, 1);
                        response.message = 'Account removed.';
                        response.code = 200;
                        if (config.console_output) process.stdout.write("\x1b[1;36mAccount \x1b[1;33m" + chunks[1] + " \x1b[1;36mremoved from list.\n");
                    }
                }

                fs.writeFile(
                    'accounts.json', 
                    JSON.stringify(accounts), 
                    () => {}
                );
                break;


            case 'list-users':
            case 'list-accounts':
                response.message = 'Accounts in list';
                response.code = 200;
                response.data = [];
                for (var i = 0; i < accounts.length; i++) {
                    response.data.push(accounts[i].userid);
                }
                break;


            case 'add-replay':
            case 'add-download':
                response.message = 'Replay added to queue.';
                response.code = 200;
                response.data = [];
                var isnum = /^\d+$/.test(chunks[1]);
                if (isnum) {
                    if (config.console_output) process.stdout.write("\x1b[1;36mReplay \x1b[1;33m" + chunks[1] + " \x1b[1;36m- added to queue.  \r");
                    download_list.push(chunks[1]);
                    downloadFile();
                }
                break;


            case 'ping':
                response.message = 'Pong';
                response.code = 200;
                break;


            case 'shutdown':
                if (config.console_output) process.stdout.write("\x1b[1;31mShutting down and storing information...\n");

                setTimeout(() => {
                    process.exit(0);    
                }, 250);
                
                break;


            default:
                response.message = 'Invalid command.';
                break;

        }

        res.writeHead(200, { 'Content-Type': 'text/javascript'});
        res.write(JSON.stringify(response, null, 2));
        res.end();

    }).listen(config.localPort);   
}








/*
        Account Scan Loop
*/
function accountScanLoop() {

    if (account_index < accounts.length) {
        setTimeout(() => {
            accountScanLoop();
        }, 250);
    }

    setImmediate(function(){
        if (account_index < accounts.length) { account_index++; scanForNewReplays(account_index); }
    });
}

/*
        Replay Scan
*/
function scanForNewReplays(i) {

    if (accounts[i] == undefined) return;

    LiveMe.getUserReplays(accounts[i].userid, 1, 10).then(replays => {

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