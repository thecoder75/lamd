## Change Log

#### v1.3.1
Added:
- Added new filename template tags for adding the date of the replay to the filename.

#### v1.3.0
Added:
- Changed console output to now be more useful in what is said.
- Added color to console output.
- Added ability to now use either the older stream downloader or FFMPEG for downloading.
- Added command line option `--writecfg` to write out a default configuration file.

Fixed:
- Changed how downloads are triggered after completion to eliminate only one getting fetched.
- Downloads stop after only one download.

#### v1.2.1
Added:
- Changed format of error log.

Fixed:
- Tweaked FFMPEG settings and functions.

#### v1.2.0
Added:
- Added support to use FFMPEG instead of old stream downloader.

#### v1.1.7
Added:
- Added queued and errored list writing and reading so it'll resume previous download queue and log failed downloads.

Fixed:
- Updated config settings parameter handlers for new default allowance and to ensure a lesser chance of issues.
- Updated error handlers in `miniget.js`.

#### v1.1.6
Fixed:
- Fixed bug where last scan time was not stored causing duplicate downloads to occur.

#### v1.1.5
Fixed:
- Changed new replay detection to fix not all new replays getting detected.
- Fixed wording on startup to now state how many accounts loaded after they are loaded.

#### v1.1.4
Fixed:
- Removed bug that allowed multiple accounts to be added.
- Removed writing the config file on shutdown.  If its not there now at all, the program will use the defaults.
- Added ability to configure downloader chunks again to help avoid timeout issues.
- Added filename purifier to downloader to avoid illegal characters in filenames causing issues.

#### v1.1.3
Fixed:
- Fixed issue where settings and account files were getting wiped out.
- Updated downloader to match LiveMe Pro Tools downloader

#### v1.1.0
Added:
- Added support for adding replays to the download queue for downloading
- Added console output option
- Added `check-account` command for checking if account is in the watch list or not

Fixed:
- Fixed `add-account` command to check if it received an account id or something else for proper error handling

#### v1.0.2
***Removed macOS builds.***

#### v1.0.1
Fixed:
- Corrected wrong label in the internal server

#### v1.0.0
*Initial Release*

