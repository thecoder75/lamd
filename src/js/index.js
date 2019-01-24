const { BrowserWindow, remote, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const appSettings = remote.getGlobal('appSettings')
const LiveMe = remote.getGlobal('LiveMe')

let bookmarks = []
let bookmark_index = 0
let bookmarks_loading = false

let minuteTicks = 29
let secondTicks = 45

let isOnline = false
let scan_active = false


$(function(){

    ipcRenderer.on('download-add', (event, arg) => {
        if ($('#download-' + arg.vid).length > 0) return
        $('#main').append(`
        <div class="download" id="download-${arg.vid}">
            <div class="filename">${arg.vid}</div>
            <div class="progress-bar">
                <div class="bar" style="width: 0%"></div>
            </div>
            <div class="status">Queued</div>
            <div onClick="cancelDownload('${arg.vid}')" class="cancel">
                <svg class="cancel" viewBox="0 0 20 20">
                    <path d="M10.185,1.417c-4.741,0-8.583,3.842-8.583,8.583c0,4.74,3.842,8.582,8.583,8.582S18.768,14.74,18.768,10C18.768,5.259,14.926,1.417,10.185,1.417 M10.185,17.68c-4.235,0-7.679-3.445-7.679-7.68c0-4.235,3.444-7.679,7.679-7.679S17.864,5.765,17.864,10C17.864,14.234,14.42,17.68,10.185,17.68 M10.824,10l2.842-2.844c0.178-0.176,0.178-0.46,0-0.637c-0.177-0.178-0.461-0.178-0.637,0l-2.844,2.841L7.341,6.52c-0.176-0.178-0.46-0.178-0.637,0c-0.178,0.176-0.178,0.461,0,0.637L9.546,10l-2.841,2.844c-0.178,0.176-0.178,0.461,0,0.637c0.178,0.178,0.459,0.178,0.637,0l2.844-2.841l2.844,2.841c0.178,0.178,0.459,0.178,0.637,0c0.178-0.176,0.178-0.461,0-0.637L10.824,10z"></path>
                </svg>
            </div>
        </div>
        `)
    })

    ipcRenderer.on('download-start', (event, arg) => {
        if ($('#download-' + arg.videoid).length < 1) return

        $('#download-' + arg.videoid).addClass('active')
        $('#download-' + arg.videoid + ' .status').html('Starting download..')
        $('#download-' + arg.videoid + ' .filename').html(arg.filename)
        $('#download-' + arg.videoid + ' .cancel').remove()
    })

    ipcRenderer.on('download-progress', (event, arg) => {
        if ($('#download-' + arg.videoid).length < 1) return

        $('#download-' + arg.videoid + ' .status').html(arg.state)
        $('#download-' + arg.videoid + ' .progress-bar .bar').css('width', arg.percent + '%')
    })

    ipcRenderer.on('download-complete', (event, arg) => {
        if ($('#download-' + arg.videoid).length < 1) return
        $('#download-' + arg.videoid).remove()
    })

    ipcRenderer.on('download-error', (event, arg) => {
        if ($('#download-' + arg.videoid).length < 1) return
        $('#download-' + arg.videoid + ' .status').html('Download Error<span></span>')
        $('#download-' + arg.videoid).append(`<div onClick="cancelDownload('${arg.videoid}')" class="cancel">&#x2715;</div>`)
    })

    if (fs.existsSync(path.join(appSettings.path, 'bookmarks.json'))) {
        loadBookmarks()
        fs.watch(path.join(appSettings.path, 'bookmarks.json'), () => {
            if (bookmarks_loading) return;
            bookmarks_loading = true;
            loadBookmarks()
        })
    }        

    setTimeout(() => {
        if (appSettings.auth !== undefined) {
            LiveMe.setAuthDetails(appSettings.auth.email.trim(), appSettings.auth.password.trim())
            $('#statusbar svg').addClass('online')
            isOnline = true
        }
    }, 500)

    setInterval(() => {

        if (!isOnline) return;

        secondTicks++

        let t1 = 29 - minuteTicks
        let t2 = 60 - secondTicks
        if (t1 < 10) t1 = '0' + t1
        if (t2 < 10) t2 = '0' + t2
        
        if (!scan_active && (minuteTicks > 20)) {
            $('#statusbar h1').html(`Next scan in ${t1}:${t2}`)
        }
    
        if (secondTicks > 59) {
            secondTicks = 0
            minuteTicks++
    
            if (minuteTicks > 29) {
                minuteTicks = 0;
    
                if (isOnline) {
                    scan_active = true
                    beginBookmarkScan()
                }
            }
        }
        }, 1000)

})

function cancelDownload(i) {
    ipcRenderer.send('cancel-download', { videoid: i })
    $('#download-' + i).remove()
}




function loadBookmarks() {
    if (fs.existsSync(path.join(appSettings.path, 'bookmarks.json'))) {
        $('#statusbar h1').html('Loading bookmarks...')
        fs.readFile(path.join(appSettings.path, 'bookmarks.json'), 'utf8', function(err, data) {
            if (err) {
                bookmarks = []
            } else {
                bookmarks = JSON.parse(data)
                if (bookmarks.length == 0) return
                bookmark_index = 0;
                $('#statusbar h1').html('Loading bookmarks...')
                setTimeout(() => {
                    $('#statusbar h1').html(bookmarks.length + ' bookmarks loaded.')
                }, 1000)
            }
        })
    }    
}




function beginBookmarkScan() {

    if (bookmarks[bookmark_index] != undefined) {
        if (bookmarks[bookmark_index].lamd != undefined) {
            if (bookmarks[bookmark_index].lamd.monitored == true) {
                let t = Math.round((bookmark_index / bookmarks.length) * 100) + '%'
                $('#statusbar h1').html(`Scanning ${bookmarks[bookmark_index].nickname} (${bookmarks[bookmark_index].uid}) ${t}`)
                scanForNewReplays(bookmark_index)
            }
        } else {
            bookmarks[bookmark_index].lamd = {
                monitored: false,
                last_checked: 0
            }
        }
    } else {
        $('statusbar h1').html(`Bookmark scan complete.`)
        
        /*
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
        }, 25)
    } else {
        bookmark_index = 0;
        $('#statusbar h1').html(``)
    }


}


function scanForNewReplays(index) {

    if (bookmarks[index] == undefined) return

    LiveMe.getUserReplays(bookmarks[index].uid, 1, 10).then(replays => {

        if (replays == undefined) return
        if (replays.length < 1) return

        let ii = 0
        let count = 0
        let userid = replays[0].userid
        let last_scanned = 0
        let dt = Math.floor((new Date()).getTime() / 1000)

        last_scanned = bookmarks[index].lamd.last_checked
        bookmarks[index].lamd.last_checked = dt

        var replay_count = 0
        for (ii = 0; ii < replays.length; ii++) {
            if ((replays[ii].vtime - last_scanned) > 0) {
                ipcRenderer.send('add-download', { videoid: replays[ii].vid })                    
            }
        }
    })
}
