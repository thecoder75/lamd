/*
        Basic ANSI Terminal Class
*/

const ESC = '\x1b'

class Terminal {
    clear() {
        process.stdout.write(`${ESC}[2J`)
    }
    
    goto(x,y) {
        process.stdout.write(`${ESC}[${y};${x}H`)
    }

}

module.exports = Terminal
