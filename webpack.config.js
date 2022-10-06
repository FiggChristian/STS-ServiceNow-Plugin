const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const config = [
  (env, argv) => ({
    mode: argv.mode,
    devtool:
      argv.mode === "development" ? "cheap-module-source-map" : "source-map",
    entry: {
      index: "./src/index.ts",
      background: "./src/background.ts",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.scss$/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                importLoaders: 1,
              },
            },
            "postcss-loader",
            "sass-loader",
          ],
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js"],
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            context: "./src",
            from: "./manifest.json",
            to: "./",
          },
          {
            context: "./src",
            from: "./**/*.png",
            to: "./",
          },
        ],
      }),
    ],
  }),
];

module.exports = config;
