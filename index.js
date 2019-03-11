/*

    LiveMe Account Monitor Daemon v2.0

*/

const { app, BrowserWindow, ipcMain } = require('electron')

const fs = require('fs')
const path = require('path')
const request = require('request')
const LivemeAPI = require('./livemeapi')
const LiveMe = new LivemeAPI({})
const concat = require('concat-files')
const async = require('async')
const pjson = require('./package.json')

let op = process.platform == 'win32' ? process.env.APPDATA : process.env.HOME + (process.platform == 'darwin' ? '/Library/Preferences' : '/.config')
let download_list = []
let mainWindow = null
let appSettings = JSON.parse(fs.readFileSync(path.join(op, 'liveme-pro-tools/Settings')))

function createWindow() {
    mainWindow = new BrowserWindow({
        title: 'LAMD v' + pjson.version,
        icon: path.join(__dirname, 'appicon.png'),
        width: 480,
        height: 640,
        minWidth: 480,
        maxWidth: 480,
        minHeight: 640,
        maxHeight: 1200,
        autoHideMenuBar: true,
        disableAutoHideCursor: true,
        titleBarStyle: 'default',
        fullscreen: false,
        maximizable: false,
        frame: true,
        show: false,
        backgroundColor: '#000000',
        webPreferences: {
            webSecurity: true,
            textAreasAreResizable: false,
            plugins: true
        }
    })

    /**
     * Configure our window contents and callbacks
     */
    mainWindow.loadURL(`file://${__dirname}/src/index.html`)
    mainWindow
        .on('open', () => {

        })
        .on('close', () => {
            mainWindow.webContents.session.clearCache(() => {
                // Purge the cache to help avoid eating up space on the drive
            })

            mainWindow = null

        })
    
    appSettings.path = op

    global.appSettings = appSettings
    global.LiveMe = LiveMe

    setTimeout(() => {
        mainWindow.show()
    }, 250)
}


app.on('ready', () => {
    createWindow()
})

app.on('window-all-closed', () => {
    app.quit()
})

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
})






const dlQueue = async.queue((task, done) => {

    LiveMe.getVideoInfo(task).then(video => {
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
        video._filename = filename

        mainWindow.webContents.send('download-start', {
            videoid: task,
            filename: filename
        })

        request(video.hlsvideosource, (err, res, body) => {
            if (err || !body) {
                fs.writeFileSync(`${appSettings.downloads.path}/${filename}-error.log`, JSON.stringify(err, null, 2))
                return done({ videoid: task, error: err || 'Failed to fetch m3u8 file.' })
            }

            let concatList = []
            const tsList = []
            body.split('\n').forEach(line => {
                if (line.indexOf('.ts') !== -1) {
                    const tsName = line.split('?')[0].replace('/', '_')
                    let tsPath = `${appSettings.downloads.path}/lamd_temp/${video.vid}_${tsName}`

                    if (process.platform == 'win32') {
                        tsPath = tsPath.replace(/\\/g, '/');
                    }

                    if (concatList.indexOf(tsPath) === -1) {
                        concatList.push(tsPath)
                        tsList.push({ name: tsName, path: tsPath })
                    }
                }
            })
            
            if (!fs.existsSync(`${appSettings.downloads.path}/lamd_temp`)) {
                fs.mkdirSync(`${appSettings.downloads.path}/lamd_temp`)
            }
            fs.writeFileSync(`${appSettings.downloads.path}/lamd_temp/${video.vid}.txt`, concatList)

            let downloadedChunks = 0
            async.eachLimit(tsList, 4, (file, next) => {

                const stream = request(`${video.hlsvideosource.split('/').slice(0, -1).join('/')}/${file.name}`)
                    .on('error', err => {
                        fs.writeFileSync(`${appSettings.downloads.path}/${filename}-error.log`, JSON.stringify(err, null, 2))
                        return done({ videoid: task, error: err })
                    })
                    .pipe(
                        fs.createWriteStream(file.path)
                    )
                    // Events
                    stream.on('finish', () => {
                        downloadedChunks += 1

                        mainWindow.webContents.send('download-progress', {
                            videoid: task,
                            state: `Downloading stream chunks.. (${downloadedChunks}/${tsList.length})`,
                            percent: Math.round((downloadedChunks / tsList.length) * 100)
                        })

                        next()
                    })

            }, () => {
                let concatList = fs.readFileSync(appSettings.downloads.path + '/lamd_temp/' + video.vid + '.txt', 'utf-8')

                mainWindow.webContents.send('download-progress', {
                    videoid: task,
                    state: `Combining chunks, please wait...`,
                    percent: 0
                })

                concat(concatList.split(','), `${appSettings.downloads.path}/${filename}.ts`, (err) => {
                    if (err) {
                        mainWindow.webContents.send('download-progress', {
                            videoid: task,
                            state: `Error combining chunks`,
                            percent: 100
                        })
                        fs.writeFileSync(`${appSettings.downloads.path}/${filename}-error.log`, err)
                    }
                    mainWindow.webContents.send('download-complete', { videoid: task })
                })
                
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

                        fs.writeFileSync(`${appSettings.downloads.path}/${filename}-chat.txt`, dump)
                        mainWindow.webContents.send('download-complete', { videoid: task })
                    })
                }
                return done()

            })
                
        })

    })
}, +appSettings.lamd.concurrency || 3)


/*
    Add a download to the queue
*/
ipcMain.on('add-download', (event, arg) => {
    mainWindow.webContents.send('download-add', { vid: arg.videoid} )
    dlQueue.push(arg.videoid, err => {
        if (err) {
            mainWindow.webContents.send('download-error', err)
        }
    })
})
ipcMain.on('cancel-download', (event, arg) => {
    dlQueue.remove(function(task) {
        if (task.data === arg.videoid) {
            return true
        }
        return false
    })
})








/*

function main() {



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

    setTimeout(() => {
        tickThread()
    }, 1000)

}

function loadBookmarks() {
    if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
        // Configuration file was found

        if (fs.existsSync(path.join(op, 'bookmarks.json'))) {
            setTimeout(()=>{

                let t = '        Loading bookmarks...'
                terminal.color('bright-yellow')
                terminal.writexy(79 - t, 22, t)

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






function beginBookmarkScan() {

    if (bookmarks[bookmark_index] != undefined) {
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
            bookmarks[bookmark_index].lamd = {
                monitored: false,
                last_checked: 0
            }
        }
    } else {
        terminal.color('bright-blue')
        terminal.writexy(1,  4, '|                                                                              |')
        terminal.color('blue')
        terminal.writexy( 3, 4,'Status:')

        scan_active = false

        fs.writeFile(
            path.join(op, 'bookmarks.json'),
            JSON.stringify(bookmarks), 
            () => {
                
            }
        );
        
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


*/
