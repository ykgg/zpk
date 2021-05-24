# zpk
## 简单模拟 webpack，实现打包流程

web前端工程工具
 node.js
 webpack

 看源码时 一些判断和定义先不管，先把主流程走通 （不懂的可先根据关键字猜）
  
打包器
 写写 node，前端的工具都离不开 node
 服务webpack， 内容前置 

 这里的webpack 与webpack-cli 版本有限制  我安装了webpack@5以上 运行npx webpack会报错
 "webpack": "4.46.0",
 "webpack-cli": "3.3.12"

1.起一个简单的配置运行 webpack 打包  （npx webpack）
2.梳理webpack打包时执行的文件  (node_modules/webpack/bin/webpack)
 执行 npx webpack 之后，在webpack内部一顿操作之后最终找到的是：webpack-cli/bin/cli.js

3. 为什么费事做做这些：
 因为我们是用原生的webpack执行打包工作，然后产生了dist目录
 现在我们想要做的是走自己的webpack.js 来实现一个打包功能

4. 对于cli工具来说都会有一个需要处理的逻辑：命令行参数，process.argv ,  我们一般会采用第三方的包
如:commander、yargs 等等


5. 对 webpack 打包来说，所谓的参数: config.js + 内置 + 命令行传入的

6. 在cli.js 中 【处理参数、将参数传递给具体的业务逻辑进行使用】
 01 引用yargs来处理配置参数
 02 先将 webpack.config.js 中的配置信息拿出来
 03 拿到基础的 options 之后，调用一个 processOptions 方法将它进行了处理，最终产出了一个 outputOptions
 此时 cli.js 的核心功能之一就算完成了。（拿参数）
 04 使用参数，compiler的对象，贯穿整个打包过程
 05 利用原生 webpack 的调用，传入处理后的 options , 返回了一个compiler, 用它来启动打包。
 06 由compiler 来调用 run 方法启动本次打包工作

 总结：
 01 拿到 webpack.config.js 中的配置信息
 02 导入原生的 webpack 调用这个方法 接收 config
 03 上传调用会返回一个compiler对象， 由它来调用 run 方法就可以启动打包了。




Part2 

01 上述的分析目的是为了服务于我自己写一个工具包 lgPack, 让它能跟原生的 webpack 一样的打包功能 （打包）

02 自定义一个 lgPack 包， 实现打包功能
  01 webpack 是一个函数
  02 这个函数调用之后返回一个对象 （因为它有一个run方法）

  03 自定义run方法走通之后，我们梳理出了打包需要的两大步骤
    01 打包自己和自己依赖的模块，生成一个chunk代码块
      分析原生 webpack 打包后的文件内容
      核心：将组装好的{key:value}结构，传给modules
      __webpack_require__方法是webpack内部定义的一个方法，用于实现不同模块的打包操作
      这个方法第一次被调用的时候传入的一定是 入口模块 id
      第一次调用的时候，如果缓存里没有加载过当前的模块，那么就会创建一个空对象叫 module 
      它里面有三个属性，
      其中： exports 就是一个空对象用于加载某个模块将来 exports  export 导出的内容
      i: 标识符
      l: 布尔值表示当前模块是否已加载过
    确定了 module 之后，就会查找当前模块 id 所对应的函数进行调用，此时会传入多个参数 
    最终我们要做的是打包器，而今晚我们想完成的就是参数的组装，至于说函数体内的 __webpack_require__ 方法我们拿来主义直接用
    

   /**
 * 01 原生 webpack 打包之后生成了一个匿名函数自调用，它接收一个参数，这个参数时一个对象
 * 02 特征
 *   2-1 它的键我们称之为模块id，本质上就是需要被打包的模块的相对路径
 *   2-2 它的值是一个函数，这个函数接收N（2 3）个参数，它的函数体就是当前被打包模块的内容
 *   2-3 对于那些导入了其他模块的被打包模块来说，其函数内容稍有不同（将import或require关键字转为了__webpack_require__方法，同时还将模块路径换成了相对路径）
 */

    02 将打包后的chunk利用文件系统写入磁盘中


part3 动手编写 

01 定义一个 buildModule 方法
  核心功能就是将入口 index.js 自己和它所依赖的 a b 都串在一起，所谓的串在一起，无非就是将它里面的 require 方法替换为 
  __webpack_require__ ，将 require 的值 替换为 './src/a.js' './src/lg/b.js' ,最后再把它们各自里面的内容读取
  出来，与刚才提到的相对路径组装成一个 key value 结构

  {
    './src/a.js': 'console.log("aaaaa")', 
    './src/b.js': 'console.log("bbbbb")', 
    ..... 
  }
  如果我们想要完成上述的操作，那么就需要准备几个东西：
    每个被打包模块的完整路径： 只有具备了完整路径，我们才能使用 fs 读内容
    每个被打包模块的相对路径 ：因为我们在组装键值对的时候用到的是相对路径 
    完成路径和文件操作的 fs 及 path 模块
