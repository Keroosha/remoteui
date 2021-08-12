const webpack = require("webpack");
const path = require("path");

const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const {TsconfigPathsPlugin} = require("tsconfig-paths-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const tsImportPluginFactory = require("ts-import-plugin");
const prod = true;

class Printer {
    apply(compiler) {
        compiler.hooks.afterEmit.tap("Printer", () => console.log("Build completed at " + new Date().toString()));
        compiler.hooks.watchRun.tap("Printer", () => console.log("Watch triggered at " + new Date().toString()));
    }
}

const config = {
    entry: {
        bundle: "./src/index.ts",
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        publicPath: "/",
        filename: "index.js",
    },
    performance: { hints: false },
    mode: prod ? "production" : "development",
    stats: {
        // https://github.com/visionmedia/superagent/issues/1615
        // Until closed we suppress any warnings by typescript typechecker on superagent
        warningsFilter: ["./node_modules/superagent/"],
    },
    module: {
        rules: [
            {
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader",
                exclude: [
                    path.resolve(__dirname, "node_modules/mobx-state-router"),
                    path.resolve(__dirname, "node_modules/react-list-drag-and-drop"),
                    path.resolve(__dirname, "node_modules/react-table"),
                ],
            },
            {
                oneOf: [
                    {
                        test: /\.(ts|tsx)$/,
                        exclude: /node_modules/,
                        loader: "ts-loader",
                        options: {
                            getCustomTransformers: () => ({
                                before: [tsImportPluginFactory([])],
                            }),
                        },
                    },
                    {
                        // css-modules config
                        test: /\.module\.css$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            {
                                loader: "css-loader",
                                options: {
                                    modules: {
                                        exportLocalsConvention: "camelCase",
                                    },
                                },
                            },
                            {
                                loader: "postcss-loader",
                            },
                        ],
                    },
                    {
                        test: /\.css$/,
                        use: [MiniCssExtractPlugin.loader, "css-loader", { loader: "postcss-loader" }],
                    },
                    {
                        test: /\.(jpg|png)$/,
                        use: {
                            loader: "url-loader",
                            options: {
                                limit: 25000,
                            },
                        },
                    },
                    {
                        test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
                        use: [
                            {
                                loader: "file-loader",
                                options: {
                                    name: "[name].[ext]",
                                    outputPath: "fonts/", // where the fonts will go
                                },
                            },
                        ],
                    },
                    {
                        loader: require.resolve("file-loader"),
                        exclude: [/\.(js|jsx|mjs|tsx|ts)$/, /\.html$/, /\.json$/],
                        options: {
                            name: "assets/[name].[hash:8].[ext]",
                        },
                    },
                ],
            },
        ],
    },
    optimization: {
        usedExports: true,
        minimize: prod,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    parse: {
                        // We want terser to parse ecma 8 code. However, we don't want it
                        // to apply any minification steps that turns valid ecma 5 code
                        // into invalid ecma 5 code. This is why the 'compress' and 'output'
                        // sections only apply transformations that are ecma 5 safe
                        // https://github.com/facebook/create-react-app/pull/4234
                        ecma: 8,
                    },
                    compress: {
                        ecma: 5,
                        warnings: false,
                        // Disabled because of an issue with Uglify breaking seemingly valid code:
                        // https://github.com/facebook/create-react-app/issues/2376
                        // Pending further investigation:
                        // https://github.com/mishoo/UglifyJS2/issues/2011
                        comparisons: false,
                        // Disabled because of an issue with Terser breaking valid code:
                        // https://github.com/facebook/create-react-app/issues/5250
                        // Pending further investigation:
                        // https://github.com/terser-js/terser/issues/120
                        inline: 2,
                    },
                    mangle: {
                        safari10: true,
                    },
                    // Added for profiling in devtools
                    keep_classnames: prod,
                    keep_fnames: prod,
                    output: {
                        ecma: 5,
                        comments: false,
                        // Turned on because emoji and regex is not minified properly using default
                        // https://github.com/facebook/create-react-app/issues/2488
                        ascii_only: true,
                    },
                },
                // sourceMap: prod,
            }),
        ],
    },
    devtool: "source-map",
    resolve: {
        modules: [path.resolve(__dirname, "node_modules")],
        plugins: [new TsconfigPathsPlugin({ configFile: "./tsconfig.json", logLevel: "info" })],
        extensions: [".ts", ".tsx", ".js", ".json"],
        alias: {
            src: path.resolve(__dirname, "src"),
        },
    },
    plugins: [
        // new Printer(),
        new webpack.IgnorePlugin({
            checkResource(resource) {
                // Someone is referencing 'mobx.js' instead of 'mobx.min.js',
                // so we just strip out that include line to prevent mobx from
                // being included multiple times into the bundle.
                return prod && resource.endsWith("mobx.js");
            },
        }),
        new CleanWebpackPlugin({
            cleanOnceBeforeBuildPatterns: [path.resolve(__dirname, "dist")]
        }),
        new MiniCssExtractPlugin({
            filename: "[name].[chunkhash]h" + ".css",
            chunkFilename: "[id].[chunkhash].css",
        }),
    ]
};
module.exports = config;
