# LiveMe Account Monitor Daemon

![issues](https://img.shields.io/github/issues-raw/thecoder75/lamd.svg?style=flat-square)
![All Downloads](https://img.shields.io/github/downloads/thecoder75/lamd/total.svg?style=flat-square&label=All+Releases+Downloaded)
![Latest Downloads](https://img.shields.io/github/downloads/thecoder75/lamd/latest/total.svg?style=flat-square&label=Latest+Release+Downloaded)

## **Lewdninja is now actively maintaining this, go to his repo for updates:  https://github.com/Lewdninja/lamd**


## What Is LiveMe Account Monitor Daemon?
This is a stand-alone application designed to run in the background and monitor Live.me Social accounts and automatically download new replays as they are detected.

* * *

## Download Prebuilt Releases

Downloads can be found on the [releases](https://github.com/thecoder75/lamd/releases) page.

### Supported OS/Platforms
- Microsoft Windows 7 or higher (32-bit or 64-bit)
- Ubuntu-based Linux and Debian Distributions (32-bit or 64-bit)
- macOS 10.12 or higher (64-bit only)



### Using either internal downloader or FFMPEG Installation Notes
***Please note that you must have FFMPEG already installed on your computer or located in the same place as LAMD for downloading to work.***

You can now specify whether you want to use FFMPEG for downloading or the older (and faster) stream downloader.  

#### Windows
[Download](http://www.ffmpeg.org) and install FFMPEG into your `C:\Windows` folder.

#### MacOS 
[Download](http://www.ffmpeg.org) and install FFMPEG into a folder that is accessible in your path on your computer.  

#### Linux
You can either [download](http://www.ffmpeg.org) a static build or install the version maintained by your distribution using either `sudo apt install ffmpeg` or `sudo yum install ffmpeg`.

* * *

## Configuration
The app will use internal defaults if no `config.json` file is found.  To write out the default `config.json` file, you can start the program with the `--writecfg` parameter.  Information on monitored accounts will be stored in the `accounts.json` file.

### Example `config.json` file
```javascript
{
  "downloaderFFMPEG": false,
  "downloadPath": "/home/user/Downloads",
  "downloadChunks": 25,
  "downloadTemplate": "%%replayid%%",
  "loopCycle": 15,
  "localPort": 8280,
  "console_output": true
}
```

#### downloaderFFMPEG
Set to true to use FFMPEG for downloading, false to use the internal stream downloader.  Default is `true`.

#### downloadPath
Set to where you want the downloaded replays stored.  Default is the current users's Downloads folder.

#### downloadChunks
Only used when using the internal downloader, specifies how many chunks or segments to download at a time.  Valid range is 2 to 250, default is `10`.

#### downloadTemplate
Specifies how you want the replay files named.  Default is `%%replayid%%`.

| Tag                   | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `%%broadcaster%%`     | Broadcaster's Nickname                                             |
| `%%longid%%`          | Broadcaster's Long User ID Number                                  |
| `%%replayid%%`        | Video ID of the replay                                             |
| `%%replayviews%%`     | Number of views                                                    |
| `%%replaylikes%%`     | Number of likes                                                    |
| `%%replayshares%%`    | Number of shares                                                   |
| `%%replaytitle%%`     | Title of the replay (**WARNING:** Most replays have no title!)     |
| `%%replayduration%%`  | Duration of the replay in HH:MM:SS                                 |
| `%%replaydatepacked%%`| Date the replay was originally recorded in YYYYMMDD format         |
| `%%replaydateus%%`    | Date the replay was originally recorded in MM-DD-YYYY format       |
| `%%replaydateeu%%`    | Date the replay was originally recorded in DD-MM-YYYY format       |

#### loopCycle
How many minutes between new replay scans.  Valid range is 15 to 360, default is `30`.

#### localPort
Local port to listen for connections on.  Default is `8280`.

#### console_output
Whether to enable or disable the pretty console output.  Default is `true`.


* * *

## Commands
**These are the support commands when the daemon is running.**

#### Add Account
**Syntax:** `http://localhost:8280/add-account/[liveme-userid]`

**Response:** JSON data indicating if account was added or not.

#### Check Account
**Syntax:** `http://localhost:8280/check-account/[liveme-userid]`

**Response:** JSON data indicating if account is already in the watch list or not.

#### Remove Account
**Syntax:** `http://localhost:8280/remove-account/[liveme-userid]`

**Response:** JSON data indicating if account was removed.

#### List Accounts
**Syntax:** `http://localhost:8280/list-accounts`

**Response:** JSON data with list of all accounts currently in the watch list.

#### Manually Add Replay
**Syntax:** `http://localhost:8280/add-download/[video-id]`

**Response:** JSON data indicating the replay was added for download.

#### Shutdown Daemon
**Syntax:** `http://localhost:8280/shutdown`

* * *

## Built With
* [NodeJS](http://nodejs.org)
* [LiveMe-API](https://thecoder75.github.io/liveme-api)

## Contributing
If you find any bugs or would like to help add features or additional functions, please create a pull request for review.  

## Contributors
* [thecoder75](https://github.com/thecoder75)
* [zp](https://github.com/zp)

## License
This project is licensed under the GPL-3 License - see the [LICENSE](LICENSE) file for details
