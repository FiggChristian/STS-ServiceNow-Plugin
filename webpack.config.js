const handlebars = require("handlebars");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const constants = require("./src/constants.json");

const config = [
  (env, argv) => ({
    mode: argv.mode,
    devtool:
      argv.mode === "development" ? "cheap-module-source-map" : "source-map",
    entry: {
      ["index.user"]: "./src/index.user.ts",
      background: "./src/background.ts",
    },
    output: {
      publicPath: "",
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
          test: /\.html$/,
          use: [
            {
              loader: "html-loader",
              options: {
                preprocessor: (content, context) => {
                  try {
                    return handlebars.compile(content)({ constants });
                  } catch (e) {
                    context.emitError(e);
                    return content;
                  }
                },
              },
            },
          ],
        },
        {
          test: /\.scss$/,
          use: [
            {
              loader: "style-loader",
              options: {
                insert: (element) => {
                  var clones = [];
                  // Add a clone of the element to every parent window (but not the current one
                  // since the original `element` goes there).
                  for (
                    var currWindow = window.parent;
                    currWindow !== window;
                    currWindow = currWindow.parent
                  ) {
                    var clone = element.cloneNode(true);
                    clones.push(clone);
                    currWindow.document.head.appendChild(clone);
                    if (currWindow.parent === currWindow) break;
                  }
                  // Update the clones every time the original changes.
                  if (typeof window.MutationObserver !== "undefined") {
                    new MutationObserver(function () {
                      for (var i = 0; i < clones.length; i++) {
                        clones[i].textContent = element.textContent;
                      }
                    }).observe(element, {
                      childList: true,
                      subtree: true,
                      characterData: true,
                    });
                  }
                  window.document.head.appendChild(element);
                },
              },
            },
            {
              loader: "css-loader",
              options: {
                importLoaders: 1,
              },
            },
            "postcss-loader",
            "sass-loader",
            {
              loader: path.resolve("./prepend-sass-variables-loader.js"),
            },
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
