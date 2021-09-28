/* eslint-disable no-undef */
import Webpack from 'webpack';
import CopyPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import Semver from 'semver';
import VueLoaderPlugin from 'vue-loader/lib/plugin.js';
import { minify } from 'terser';
import { execSync, exec } from 'child_process';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const VERSION = Semver.parse(process.env.npm_package_version);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname)

const commit_hash = execSync('git rev-parse HEAD').toString().trim();
const PRODUCTION = process.env.NODE_ENV === 'production';
const ENTRY_POINTS = {
	bridge: './src/bridge.js',
	player: './src/player.js',
	avalon: './src/main.js',
	clips: './src/clips.js'
};

const baseConfig = {
	output: {
		chunkFilename: '[name].[chunkhash].js',
		path: `${rootDir}/dist`,
		uniqueName: 'ffzWebpackJsonp',
		crossOriginLoading: 'anonymous'
	},

	resolve: {
		extensions: ['.js', '.jsx'],
		alias: {
			res: `${rootDir}/res/`,
			styles: `${rootDir}/styles/`,
			root: `${rootDir}`,
			src: `${rootDir}/src/`,
			utilities: `${rootDir}/src/utilities/`,
			site: `${rootDir}/src/sites/twitch-twilight/`
		}
	},

	externals: [
		function({context, request}, callback) {
			if ( request === 'vue' && ! /utilities/.test(context) )
				return callback(null, 'root ffzVue');
			callback();
		}
	],

	optimization: {
		splitChunks: {
			chunks(chunk) {
				return ! Object.keys(ENTRY_POINTS).includes(chunk.name);
			},
			cacheGroups: {
				vendors: false
			}
		}
	},

	plugins: [
		new VueLoaderPlugin(),
		new Webpack.DefinePlugin({
			__version_major__: VERSION.major,
			__version_minor__: VERSION.minor,
			__version_patch__: VERSION.patch,
			__version_prerelease__: VERSION.prerelease
		}),
		new MiniCssExtractPlugin()
	],

	module: {
		rules: [{
			test: /\.s?css$/,
			use: [{
				loader: 'file-loader',
				options: {
					name: PRODUCTION ? '[name].[hash].css' : '[name].css'
				}
			}, 
			MiniCssExtractPlugin.loader,
			{
				loader: 'css-loader',
				options: {
					sourceMap: true
				}
			}, {
				loader: 'sass-loader',
				options: {
					sourceMap: true
				}
			}]
		},
		{
			test: /\.json$/,
			include: /src/,
			type: 'javascript/auto',
			loader: 'file-loader',
			options: {
				name: PRODUCTION ? '[name].[hash].json' : '[name].json'
			}
		},
		{
			test: /\.js$/,
			exclude: /node_modules/,
			loader: 'babel-loader',
			options: {
				cacheDirectory: true
			}
		},
		{
			test: /\.jsx$/,
			exclude: /node_modules/,
			loader: 'babel-loader',
			options: {
				cacheDirectory: true,
				plugins: [
					['@babel/plugin-transform-react-jsx', {
						pragma: 'createElement'
					}]
				]
			}
		},
		{
			test: /\.(graphql|gql)$/,
			exclude: /node_modules/,
			loader: 'graphql-tag/loader'
		},
		{
			test: /\.(?:otf|eot|ttf|woff|woff2)$/,
			use: [{
				loader: 'file-loader',
				options: {
					name: PRODUCTION ? '[name].[hash].[ext]' : '[name].[ext]'
				}
			}]
		},
		{
			test: /\.md$/,
			loader: 'raw-loader'
		},
		{
			test: /\.svg$/,
			loader: 'raw-loader'
		},
		{
			test: /\.vue$/,
			loader: 'vue-loader'
		}]
	}
}

const prod = {
	name: 'prod',
	mode: 'production',
	devtool: 'source-map',

	entry: ENTRY_POINTS,

	output: {
		...baseConfig.output,
		publicPath: '//cdn.frankerfacez.com/static/',
		filename: '[name].[hash].js'
	},

	resolve: {
		...baseConfig.resolve
	},

	externals: [
		...baseConfig.externals
	],

	optimization: {
		...baseConfig.optimization,
		concatenateModules: false,
		minimizer: [
			new TerserPlugin({
				// sourceMap: true,
				terserOptions: {
					keep_classnames: true,
					keep_fnames: true
				}
			})
		]
	},

	plugins: [
		...baseConfig.plugins,
		new CleanWebpackPlugin(),
		new Webpack.DefinePlugin({
			__git_commit__: JSON.stringify(commit_hash)
		}),
		new CopyPlugin(
			{
				patterns: [{
					from: './src/entry.js',
					to: 'script.min.js',
					transform: content => {
						const text = content.toString('utf8');
						const minified = minify(text);
						// eslint-disable-next-line no-undef
						return (minified && minified.code) ? Buffer.from(minified.code) : content;
					}
				}]
			}
		),
		new WebpackManifestPlugin({
			publicPath: '',
			map: data => {
				if ( data.name.endsWith('.scss') )
					data.name = `${data.name.substr(0,data.name.length - 5)}.css`;

				return data;
			}
		})
	],

	module: {
		...baseConfig.module
	},
}

const webDev = {
	name: 'webDev',
	mode: 'development',
	devtool: 'inline-source-map',

	entry: ENTRY_POINTS,
	
	output: {
		...baseConfig.output,
		publicPath: '//localhost:8000/script/',
		filename: '[name].js',
		crossOriginLoading: 'anonymous'
	},

	resolve: {
		...baseConfig.resolve
	},

	externals: [
		...baseConfig.externals
	],
	
	optimization: {
		...baseConfig.optimization
	},

	plugins: [
		...baseConfig.plugins,
		new CopyPlugin(
			{
				patterns: [{
					from: './src/entry.js',
					to: 'script.js'
				}]
			}
		),
		new Webpack.DefinePlugin({
			__git_commit__: null
		})
	],

	module: {
		...baseConfig.module
	},
}

const webDevProd = {
	name: 'webDevProd',
	mode: 'development',
	
	entry: ENTRY_POINTS,

	output: {
		...baseConfig.output,
		publicPath: '//localhost:8000/script/',
		filename: '[name].js',
		crossOriginLoading: 'anonymous'
	},

	resolve: {
		...baseConfig.resolve
	},

	externals: [
		...baseConfig.externals
	],
	
	optimization: {
		...baseConfig.optimization
	},

	plugins: [
		...baseConfig.plugins,
		new CopyPlugin(
			{
				patterns: [{
					from: './src/entry.js',
					to: 'script.js'
				}]
			}
		),
		new Webpack.DefinePlugin({
			__git_commit__: null
		})
	],

	module: {
		...baseConfig.module
	},

	devServer: {
		https: true,
		port: 8000,
		compress: true,

		allowedHosts: [
			'.twitch.tv',
			'.frankerfacez.com'
		],

		static: {
			directory: join(__dirname, 'dev_cdn'),
			publicPath: '/script/'
		},

		proxy: {
			'**': {
				target: 'https://cdn.frankerfacez.com/',
				changeOrigin: true
			}
		},

		onBeforeSetupMiddleware (devServer)  {
			// Because the headers config option is broken.
			devServer.app.get('/*', (_req, res, next) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				next();
			});

			devServer.app.get('/update_font', (req, res) => {
				const proc = exec('npm run font:save');

				proc.stdout.on('data', data => {
					console.log('FONT>>', data);
				});

				proc.stderr.on('data', data => {
					console.error('FONT>>', data);
				});

				proc.on('close', code => {
					console.log('FONT>> Exited with code', code);
					res.redirect(req.headers.referer);
				});
			});

			devServer.app.get('/dev_server', (_req, res) => {
				res.json({
					path: process.cwd(),
					version: 2
				})
			});
		}

		
		// onBeforeSetupMiddleware (app) {
		// 	// Because the headers config option is broken.
		// 	app.get('/*', (req, res, next) => {
		// 		res.setHeader('Access-Control-Allow-Origin', '*');
		// 		next();
		// 	});

		// 	app.get('/update_font', (req, res) => {
		// 		const proc = exec('npm run font:save');

		// 		proc.stdout.on('data', data => {
		// 			console.log('FONT>>', data);
		// 		});

		// 		proc.stderr.on('data', data => {
		// 			console.error('FONT>>', data);
		// 		});

		// 		proc.on('close', code => {
		// 			console.log('FONT>> Exited with code', code);
		// 			res.redirect(req.headers.referer);
		// 		});
		// 	});

		// 	app.get('/dev_server', (req, res) => {
		// 		res.json({
		// 			path: process.cwd(),
		// 			version: 2
		// 		})
		// 	});
		// }
	}
}

export default [ prod, webDev, webDevProd ]