/*
    LiveMe Monitor CLI
*/

const   os = require('os'),
        fs = require('fs'),
        http = require('http'),
        LiveMe = require('liveme-api'),
        ffmpeg = require('fluent-ffmpeg');

var     config = {
            downloadPath: os.homedir() + '/Downloads',
            downloadTemplate: '%%replayid%%',
            loopCycle: 30,
            localPort: 8280,
            console_output: true
        },
        
        accounts = [],
        account_index = 0,
        
        download_list = [],
        errored_list = [],
        downloadActive = false,
        
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

        if (config.console_output) process.stdout.write("UserID: " + userid + "\n");
        for (ii = 0; ii < replays.length; ii++) {

            // If we take the video time and subtract the last time we scanned and its
            // greater than zero then its new and needs to be added
            if ((replays[ii].vtime - last_scanned) > 0) {

                if (config.console_output) process.stdout.write("\t" + replays[ii].vid + " added to queue.\n");
                
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

        if (download_list.length > 0) 
            setTimeout(() => {
                downloadFile();
            }, 250);

    });

}








/*
        
        Download Handler

*/
function downloadFile() {

    if (downloadActive == true) return;
    if (download_list.length == 0) return;


    // Update current queue file
    fs.writeFile(
        'queued.json', 
        JSON.stringify(download_list), 
        () => {
            // Queue file was written
        }
    );

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
                if (config.console_output) process.stdout.write(download_list[0] + " - downloaded successfully. \n");

                download_list.shift();
                download_active = false;
                setTimeout(() => {
                    downloadFile();
                }, 250);

            })
            .on('progress', function(progress) {

                if (config.console_output) process.stdout.write(download_list[0] + " - " + (progress.percent.toFixed(0)) + "% downloaded     \r");

            })
            .on('start', function(c) {
                downloadActive = true;
            })
            .on('error', function(err, stdout, etderr) {
                if (config.console_output) process.stdout.write(download_list[0] + " - errored     \n");

                errored_list.push(download_list[0]);
                download_list.shift();
                download_active = false;

                // Update errored file
                fs.writeFile(
                    'errored.json', 
                    JSON.stringify(errored_list), 
                    () => {
                        // Queue file was written
                    }
                );

                setTimeout(() => {
                    downloadFile();
                }, 250);


            })
            .run();

    });

}