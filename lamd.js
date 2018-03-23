/*
    LiveMe Monitor CLI
*/

const   os = require('os'),
        fs = require('fs'),
        http = require('http'),
        LiveMe = require('liveme-api'),
        m3u8stream = require('./modules/m3u8stream');               // We use a custom variation of this module

var     config = {
            downloadPath: os.homedir() + '/Downloads',
            downloadChunks: 5,
            downloadConcurrent: 3,
            downloadTemplate: '%%replayid%%',
            loopCycle: 30,
            localPort: 8280,
            console_output: true
        },
        
        accounts = [],
        account_index = 0,
        
        download_list = [],
        errored_list = [],
        activeDownloads = 0,
        
        minuteTick = 0,

        APIVERSION = '1.1';


main();

function main() {

    /*
        Load configuration file
    */
    if (fs.existsSync('config.json')) {
        fs.readFile('config.json', 'utf8', (err,data) => {
            if (!err) {
                config = JSON.parse(data);
                if (config.downloadChunks < 1) config.downloadChunks = 1;
                if (config.downloadChunks > 25) config.downloadChunks = 25;
                if (config.downloadConcurrent > 5) config.downloadConcurrent = 5;
                if (config.downloadConcurrent < 1) config.downloadConcurrent = 1;
                if (config.loopCycle > 120) config.loopCycle = 120;
                if (config.loopCycle < 15) config.loopCycle = 15;
                if ((config.console_output == undefined) || (config.console_output == null)) config.console_output = false;
            }
        });
    }

    if (config.console_output) {
        process.stdout.write("LiveMe Account Monitor Daemon (LAMD)\nhttps://thecoderstoolbox.com/lamd\n\n");
    }




    /*
        Load Account List
    */
    if (fs.existsSync('accounts.json')) {
        fs.readFile('accounts.json', 'utf8', (err,data) => {
            if (!err) {
                accounts = JSON.parse(data);

                if (config.console_output) {
                    process.stdout.write(accounts.length + " accounts loaded in.\n\n");
                }

            }
        });
    }


    if (fs.existsSync('errored.json')) {
        fs.readFile('errored.json', 'utf8', (err,data) => {
            if (!err) {
                errored_list = JSON.parse(data);

                if (config.console_output) {
                    process.stdout.write("Old errored list found, importing to add to it.\n\n");
                }

            }
        });
    }

    if (fs.existsSync('queued.json')) {
        fs.readFile('queued.json', 'utf8', (err,data) => {
            if (!err) {
                download_list = JSON.parse(data);

                if (config.console_output) {
                    process.stdout.write("Download queue file found, importing it.\n\n");
                }

                setTimeout(() => {
                    downloadFile();
                }, 1000);

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
                if (config.console_output) process.stdout.write("Beginning account scan for new replays.\n");
                accountScanLoop();
            });
        }
    }, 60000);

    /*
        Download Check Interval - Runs every second
    */
    setInterval(() => {
        downloadFile();
    }, 1000);


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
                    if (config.console_output) process.stdout.write("Added " + chunks[1] + " for monitoring.\n");
                } else {
                    response.message = 'Account already in list.';
                    response.code = 302;
                    if (config.console_output) process.stdout.write("Account " + chunks[1] + " already in database.\n");
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
                        if (config.console_output) process.stdout.write("Account " + chunks[1] + " removed from list.\n");
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
                    if (config.console_output) process.stdout.write("Replay " + chunks[1] + " added to download queue.\n");
                    download_list.push(chunks[1]);
                }
                break;


            case 'ping':
                if (config.console_output) process.stdout.write("PING.\n");
                response.message = 'Pong';
                response.code = 200;
                break;


            case 'shutdown':
                if (config.console_output) process.stdout.write("Shutting down and storing information...\n");

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
        }, 200);
    }

    setTimeout(function(){
        if (account_index < accounts.length) { account_index++; scanForNewReplays(account_index); }
    }, 50);
}

/*
    Replay Scan
*/
function scanForNewReplays(i) {

    if (accounts[i] == undefined) return;

    LiveMe.getUserReplays(accounts[i].userid, 1, 5).then(replays => {

        if (replays == undefined) return;
        if (replays.length < 1) return;

        var ii = 0, 
            count = 0, 
            userid = replays[0].userid,
            last_scanned = null,
            dt = Math.floor((new Date()).getTime() / 1000);

        for (ii = 0; ii < accounts.length; ii++) {
            if (accounts[ii] == userid) {
                last_scanned = accounts[ii].scanned;
                accounts[ii].scanned = dt;
            }
        }

        fs.writeFile(
            'accounts.json', 
            JSON.stringify(accounts), 
            () => {}
        );


        for (ii = 0; ii < replays.length; ii++) {
            if (replays[ii].vtime - last_scanned > 0) {
                if (config.console_output) process.stdout.write("UserID: " + userid + ", added replay " + replays[ii].vid + " to download queue.\n");
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

    });

}








/*
    Download Handler

    Checks first to see if there are any replays waiting to be downloaded
    then checks to see if there's any concurrent slots open then gets the
    info on the replay before sending to the stream download module.
*/
function downloadFile() {

    if (download_list.length == 0) return;
    if (activeDownloads >= config.downloadConcurrent ) return;

    activeDownloads++;

    LiveMe.getVideoInfo(download_list[0]).then(video => {

        var filename = config.downloadTemplate
                .replace(/%%broadcaster%%/g, video.uname)
                .replace(/%%longid%%/g, video.userid)
                .replace(/%%replayid%%/g, video.vid)
                .replace(/%%replayviews%%/g, video.playnumber)
                .replace(/%%replaylikes%%/g, video.likenum)
                .replace(/%%replayshares%%/g, video.sharenum)
                .replace(/%%replaytitle%%/g, video.title ? video.title : 'untitled')
                .replace(/%%replayduration%%/g, video.videolength);            

        // Cleanup any illegal characters in the filename
        filename = filename.replace(/[/\\?%*:|"<>]/g, '-');
        filename = filename.replace(/([^a-z0-9\s]+)/gi, '-');
        filename = filename.replace(/[\u{0080}-\u{FFFF}]/gu, '');

        filename += '.ts';
        download_list.shift();

        m3u8stream(video, {
            chunkReadahead: config.downloadChunks,
            on_progress: (e) => {
                /*
                    e.index = current chunk
                    e.total = total chunks
                */
            }, 
            on_complete: (e) => {
                fs.writeFile(
                    'queued.json', 
                    JSON.stringify(download_list), 
                    () => {
                        // Queue file was written
                    }
                );

                activeDownloads--;
                setImmediate(() => { downloadFile(); });
            },
            on_error: (e) => {
                errored_list.push(e.videoid);

                fs.writeFile(
                    'errored.json', 
                    JSON.stringify(errored_list), 
                    () => {
                        // Queue file was written
                    }
                );

                activeDownloads--;
                setImmediate(() => { downloadFile(); });
            }
        }).pipe(fs.createWriteStream(config.downloadPath + '/' + filename));
    });

}