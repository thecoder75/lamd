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

    color(c) {
        let cc = 37
        switch (c) {
            case 'black': 
                cc = '0;30'
                break
            case 'red': 
                cc = '0;31'
                break
            case 'green': 
                cc = '0;32'
                break
            case 'yellow': 
                cc = '0;33'
                break
            case 'blue': 
                cc = '0;34'
                break
            case 'magenta': 
                cc = '0;35'
                break
            case 'cyan': 
                cc = '0;36'
                break
            case 'white': 
                cc = '0;37'
                break
                
            case 'grey': 
                cc = '1;30'
                break
            case 'bright-red': 
                cc = '1;31'
                break
            case 'bright-green': 
                cc = '1;32'
                break
            case 'bright-yellow': 
                cc = '1;33'
                break
            case 'bright-blue': 
                cc = '1;34'
                break
            case 'bright-magenta': 
                cc = '1;35'
                break
            case 'bright-cyan': 
                cc = '1;36'
                break
            case 'bright-white': 
                cc = '1;37'
                break
                
        }
        process.stdout.write(`${ESC}[${cc}m`)
    }

    write(t) {
        process.stdout.write(t)
    }

    writexy(x,y,t) {
        process.stdout.write(`${ESC}[${y};${x}H${t}`)
    }
}

module.exports = Terminal
