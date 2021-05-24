// 获取配置信息
const config = require('./webpack.config');

// 引用 webpack
// const webpack = require('webpack');// 原生的webpack
const webpack = require('./lgPack');

// 将config 传给 webpack，获取一个compiler
let compiler = webpack(config);

// 调用  compiler 的run，启动打包 （webpack 可以0配置使用）
compiler.run();