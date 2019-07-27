# LiveMe Account Monitor Daemon (L.A.M.D.)
[![GNU AGPLv3](https://img.shields.io/github/license/thecoder75/lamd.svg)](LICENSE)
[![Current Release](https://img.shields.io/github/release/thecoder75/lamd.svg)](https://github.com/thecoder75/lamd/releases/latest)
[![Current Release Date](https://img.shields.io/github/release-date/thecoder75/lamd.svg)](https://github.com/thecoder75/lamd/releases/latest)
[![Last Commit Date](https://img.shields.io/github/last-commit/thecoder75/lamd.svg)](https://github.com/thecoder75/lamd/commits/master)
[![Active Issues](https://img.shields.io/github/issues/thecoder75/lamd.svg)](https://github.com/thecoder75/lamd/issues)
[![Gitter](https://badges.gitter.im/thecoderstoolbox/lamd-3xx.svg)](https://gitter.im/thecoderstoolbox/lamd-3xx?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

**A big thank you to all those who are now contributing to help make this tool even better!**

## LiveMe Account Monitor Daemon is at its end of life support from me.
**Since LiveMe is banning people for doing nothing now and making its own service no longer desirable, I've decided to end all development on the LiveMe Tools series.

* * *

### Getting Support or Assistance

Since Discord banned my account and killed the old chat server, I have now set up [Gitter](https://gitter.im/thecoderstoolbox/lamd-3xx) for discussion on the development and usage of L.A.M.D. Please use this for more general usage and installation questions as others on there will provide assistance also.

***FYI: I DO NOT RESPOND TO EMAILS ASKING FOR ASSISTANCE OR ANYTHING ELSE RELATED TO THIS OR ANY OTHER OF MY PROJECTS, SO DON'T WASTE YOUR TIME SENDING THEM!*** 

* * *

**This is a stand-alone application designed to run in the background and monitor Live.me Social accounts and automatically download new replays as they are detected.**

* * *

### Important Update!!!

**LAMD will no longer support its web interface and instead will rely on LiveMe Pro Tools (beginning 1.309 release) for configuration and monitored account list.  Be sure to have LiveMe Pro Tools v1.309 or higher installed and configured before using LAMD or it will not work!**

* * *

### Supported OS/Platforms
- Microsoft Windows 7 or higher (64-bit only)
- Ubuntu-based Linux and Debian Distributions (64-bit only)
- macOS 10.11 or higher (64-bit only)

## Downloads

### Prebuilt Releases
All Prebuilt downloads can be found on the [releases](https://github.com/thecoder75/lamd/releases) page.

* * *

### FFMPEG No Longer Required!!!
***All reliance on FFMPEG has been removed from this project.***

Replays are downloaded as .TS media files only.  This allows for downloading of over 10 replays at a time without straining the CPU.

* * *

## Configuration
LAMD will now use/access LiveMe Pro Tools v1.308 or higher configuration settings and use the same settings for its downloads and function handling. 

* * *

## Built With
* [NodeJS](http://nodejs.org)
* [ElectronJS](https://electronjs.org)
* LiveMe-API (Now integrated)

## Contributing
If you find any bugs or would like to help add features or additional functions, please create a pull request for review by the current contributors.

## Contributors
* [thecoder75](https://github.com/thecoder75)
* [zp](https://github.com/zp)

## License
This project is now licensed under the [GNU AGPLv3](LICENSE) License.
