let Compiler = require('./Compiler');

const webpack = (config) => {
    const compiler = new Compiler(config);
    return compiler;
}

module.exports = webpack;