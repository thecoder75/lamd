/*
    LiveMe Monitor CLI
*/

const   os = require('os'),
        fs = require('fs'),
        path = require('path'),
        http = require('http'),
        LiveMe = require('liveme-api'),
        formatDuration = require('format-duration'),
        m3u8stream = require('./modules/m3u8stream');               // We use a custom variation of this module

var     config = {
            downloadPath: os.homedir() + '/Downloads',
            downloadConcurrent: 3,
            downloadTemplate: '%%replayid%%',
            loopCycle: 30,
            localPort: 8280            
        },
        accounts = [],
        account_index = 0,
        download_list = [],
        activeDownloads = 0,
        minuteTick = 0,
        APIVERSION = '1.0';


main();

function main() {

    /*
        Load configuration file
    */
    if (fs.existsSync('config.json')) {
        fs.readFile('config.json', 'utf8', (err,data) => {
            if (!err) {
                config = JSON.parse(data);
                if (config.downloadChunks > 5) config.downloadChunks = 5;
            }
        });
    }

    /*
        Load Account List
    */
    if (fs.existsSync('accounts.json')) {
        fs.readFile('accounts.json', 'utf8', (err,data) => {
            if (!err) {
                accounts = JSON.parse(data);
            }
        });
    }

    /*
        Start Timers
    */
    setInterval(() => {
        minuteTick++;
        if (minuteTick == config.loopCycle) {
            minuteTick = 0;
            setImmediate(() => { scanAccounts(); });
        }
    }, 60000);



    /*
        Start Web Server
    */
    http.createServer( (req, res) => {

        var chunks = req.url.substr(1).split('/'),
            response = {
                api_version: APIVERSION,
                message: '',
                data: null
            }


        switch (chunks[0]) {
            case 'add-account':
                accounts.push({
                    userid: chunks[1],
                    scanned: Math.floor((new Date()).getTime() / 1000)
                });

                fs.writeFile(
                    'accounts.json', 
                    JSON.stringify(accounts), 
                    () => {

                    }
                );

                response.message = 'Account added.';
                break;

            case 'remove-account':
                for (var i = 0; i < accounts.length; i++) {
                    if (accounts[i].userid == chunks[1]) {
                        accounts.splice(i, 1);
                        response.message = 'Account removed.';
                    }
                }

                fs.writeFile(
                    'accounts.json', 
                    JSON.stringify(accounts), 
                    () => {

                    }
                );

                response.message = 'Account not found in list.';
                break;

            case 'list-accounts':
                response.message = 'Accounts in list';
                response.data = [];
                for (var i = 0; i < accounts.length; i++) {
                    response.data.push(accounts[i].userid);
                }
                break;

            case 'shutdown':
                fs.writeFile(
                    'config.json', 
                    JSON.stringify(config, null, 2), 
                    () => {

                    }
                );

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



function scanAccounts() {

}
