# LiveMe Account Monitor Daemon (L.A.M.D.)

This is a stand-alone application designed to run in the background and monitor Live.me Social accounts and automatically download new replays as they are detected.

### Important Update!!!

**LAMD will no longer support its web interface and instead will rely on LiveMe Pro Tools (beginning 1.309 release) for configuration and monitored account list.  Be sure to have LiveMe Pro Tools v1.309 or higher installed and configured before using LAMD or it will not work!**

* * *

### Supported OS/Platforms
- Microsoft Windows 7 or higher (64-bit only)
- Ubuntu-based Linux and Debian Distributions (64-bit only)
- macOS 10.11 or higher (64-bit only)

## Downloads

### Prebuilt Releases
Latest Release: ![Downloads](https://img.shields.io/github/downloads/thecoder75/lamd/3.0.1/total.svg?style=flat-square&label=v3.0.1)

All Prebuilt downloads can be found on the [releases](https://github.com/thecoder75/lamd/releases) page.

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
This project is licensed under the GPL-3 License - see the [LICENSE](LICENSE) file for details
