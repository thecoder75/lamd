# LiveMe Account Monitor Daemon

![issues](https://img.shields.io/github/issues-raw/thecoder75/lamd.svg?style=flat-square)
![All Downloads](https://img.shields.io/github/downloads/thecoder75/lamd/total.svg?style=flat-square&label=All+Releases+Downloaded)
![Latest Downloads](https://img.shields.io/github/downloads/thecoder75/lamd/latest/total.svg?style=flat-square&label=Latest+Release+Downloaded)

## What Is LiveMe Account Monitor Daemon?
This is a stand-alone application designed to run in the background and monitor Live.me Social accounts and automatically download new replays as they are detected.

* * *

## Download Prebuilt Releases

Downloads can be found on the [releases](https://github.com/thecoder75/lamd/releases) page.

#### Supported OS/Platforms
- Microsoft Windows 7 or higher (32-bit or 64-bit)
- Ubuntu-based Linux and Debian Distributions (32-bit or 64-bit)

***macOS is no longer supported.***

* * *

## Configuration
When you first run it, it will create a local `config.json` file which will hold the basic operating configuration.  Information on monitored accounts will be stored in the `accounts.json` file.

* * *

## Commands
**These are the support commands when the daemon is running.**

#### Add Account
**Syntax:** `http://localhost:8280/add-account/[liveme-userid]`

#### Remove Account
**Syntax:** `http://localhost:8280/remove-account/[liveme-userid]`

#### List Accounts
**Syntax:** `http://localhost:8280/list-accounts`

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

## License
This project is licensed under the GPL-3 License - see the [LICENSE](LICENSE) file for details
