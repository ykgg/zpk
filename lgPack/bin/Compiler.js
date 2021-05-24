const path = require('path');
const ejs = require('ejs')
const fs = require('fs');
const parser = require('@babel/parser');
const types = require('@babel/types');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;

class Compiler {
    constructor(config) {
        this.config = config;
        this.context = process.cwd();
        this.entryId = config.entry;
        this.entries = [];
        this.modules = {}  // 保存模块id与它对应的内容信息
    }


    /**
     * 接收一个模块的源代码，将其里面的require和相对路径进行替换
     * @param {*} code 字符串，需要解析的源代码内容
     */
    parse(code, parentDir) {

        let dependenciesModule = []

        // 01 利用babel将字符串类型的源码转换成 ast 语法树
        let ast = parser.parse(code);
        // 02 遍历语法树节点，进行内容的替换和信息的保存
        traverse(ast, {
            CallExpression: (nodePath) => {
                let node = nodePath.node;
                if (node.callee.name === 'require') {
                    // 1 将require替换为__webpack_require__
                    let depModule = node.arguments[0].value
                    depModule = "./" + path.posix.join(parentDir, depModule)
                    let extName = path.extname(depModule) === '.js' ? "" : '.js'
                    depModule += extName

                    // 上述处理完成的 depModule 很有用，就是我们将来需要递归加载的依赖项，因此我们需要将它保存起来
                    // 为了在下次递归调用的时候可以进行使用
                    dependenciesModule.push(depModule)

                    // 2 将require的值替换成 ./src/a.js  ./src/lg/b.js
                    node.callee.name = "__webpack_require__"
                    node.arguments = [types.stringLiteral(depModule)]
                }
            }
        });

        // 03 将第二步骤处理好的语法树再转换成可执行的 code
        let sourceCode = generator(ast).code
        console.log(sourceCode)

        // 04
        return { dependenciesModule, sourceCode }

    }



    /**
     * 将当前被打包模块及其依赖的模块串起来，生成一个chunk
     * @param {*} modulePath 表示当前被打包模块的绝对路径，用于获取模块的内容
     * @param {*} isEntry 表示当前被打包模块是否为主entry
     */
    buildModule(modulePath, isEntry) {
        // 01 获取当前被打包模块的相对路径 （./src/index.js）
        let moduleId = './' + path.posix.relative(this.context, modulePath);

        // 02 判断当前是否是主入口id，如果是则单独将它保存起来 （用于判断什么时候结束递归）
        if (isEntry) {
            this.entries.push(moduleId);
        }

        // 03 读取当前被打包模块的所有内容 （便于内容替换和保存信息）

        let source = fs.readFileSync(modulePath, 'utf8');
        // 04 完成内容解析【替换--再还回至code】
        let { sourceCode, dependenciesModule } = this.parse(source, path.dirname(moduleId))

        // 05 依据第一步和第四步的结果，组装 {key: value}结构
        this.modules[moduleId] = sourceCode

        // 06 递归调用上述的操作，完成一个chunk里所有的 module 的打包 
        dependenciesModule.forEach(dep => {
            this.buildModule(path.posix.join(this.context, dep), false)
        })

    }

    /**
     * 将打包后的内容组装之后输出至磁盘文件
     */
    emitFile() {
        // 01 确定将来最终输出的文件路径
        let finalPath = path.join(this.config.output.path, this.config.output.filename)

        // 02 依据当前路径是否存在来决定是否创建
        let outputPath = path.dirname(finalPath)
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true })
        }

        // 03 读取模板内容
        let tempCode = fs.readFileSync(path.resolve(__dirname, 'main.ejs'), 'utf-8')

        // 04 渲染数据
        let retCode = ejs.render(tempCode, { entryModuleId: this.entryId, modules: this.modules })

        // 05 写入磁盘
        fs.writeFileSync(finalPath, retCode)
    }

    run() {
        // 1 根据配置文件中的entry入口来打包它和它所依赖的模块，生成一个chunk
        // .posix 用来统一不同平台下的分隔符 
        let modulePath = path.posix.join(this.context, this.entryId)

        // 第一次调用的时候必然是主入口，因此肯定是 true 
        this.buildModule(modulePath, true)

        // 2 将上述的chunk写入到磁盘中
        this.emitFile()

    }
}

module.exports = Compiler;

// 用来统一不同平台下的分隔符