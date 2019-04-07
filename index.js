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




