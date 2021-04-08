const fs = require('fs');
const handlebars = require('handlebars');
const handlebarsWax = require('handlebars-wax');
const handlebarsLayouts = require('handlebars-layouts');
const handlebarsHelpersPackage = require('handlebars-helpers');
const HTMLAsset = require('parcel-bundler/src/assets/HTMLAsset');
const handlebarsHelpers = handlebarsHelpersPackage();
const {loadUserConfig, parseSimpleLayout} = require('./utils');
const userConfig = loadUserConfig();
const glob = require('globby');


const config = Object.assign({}, {
	data: 'src/markup/data',
	decorators: 'src/markup/decorators',
	helpers: 'src/markup/helpers',
	layouts: 'src/markup/layouts',
	partials: 'src/markup/partials',
	"precompiled-src": 'src/partials/precompiled',
	"precompiled-dest": 'src/js/precompiled.js',
}, userConfig);
const helpersDep = glob.sync([
	`${config.helpers}/**/*.js`,
	`${config.data}/**/*.{json,js}`,
	`${config.decorators}/**/*.js`,
	`${config.layouts}/**/*.{hbs,handlebars,js}`,
	`${config.partials}/**/*.{hbs,handlebars,js}`,
]);
const dir = `./${config.data}`;

function gatherContentJson(dir) {
	return new Promise((res, rej) => {
		fs.readdir(dir, (err, files) => {
			if (err) {
				rej(err);
			}
			else {
				res(files);
			}
		});
	});
}

const mergeContentJson = files => {
	let data = {};
	files.forEach(file => {
		const content = require(`../../../${config.data}/${file}`);
		data = Object.assign({}, data, content);
	});
	return data;
};


function execShellCommand(cmd) {
	const exec = require('child_process').exec;
	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				console.warn(error);
			}
			resolve(stdout ? stdout : stderr);
		});
	});
}

function checkDirectoryForFiles() {
	return new Promise((res, rej) => {
		fs.readdir(dir, (err, files) => {
			if (err) {
				rej(err);
			}
			else {
				res(files);
			}
		});
	});
}

class HbsAsset extends HTMLAsset {
	constructor(name, pkg, options) {
		super(name, pkg, options);
		this.wax = handlebarsWax(handlebars)
			.helpers(handlebarsLayouts)
			.helpers(handlebarsHelpers)
			.helpers(`${config.helpers}/**/*.js`)
			.data(`${config.data}/**/*.{json,js}`)
			.decorators(`${config.decorators}/**/*.js`)
			.partials(`${config.layouts}/**/*.{hbs,handlebars,js}`)
			.partials(`${config.partials}/**/*.{hbs,handlebars,js}`);
	}

	processSingleDependency(path, opts) {
		if (path) {
			return super.processSingleDependency(path, opts);
		}
	}

	async parse(code) {

		const jsonContent = await gatherContentJson(`./${config.data}`).then(mergeContentJson);

		// process simple layout mapping that does not use handlebars-layouts. i.e {{!< base}}
		const {dependencies, content} = parseSimpleLayout(code, config);

		dependencies.forEach(path => this.addDependency(path, {
			includedInParent: true,
		}));

		helpersDep.forEach(path => this.addDependency(path, {
			includedInParent: true,
		}));


		// combine frontmatter data with NODE_ENV variable for use in the template
		const data = Object.assign({}, jsonContent, {NODE_ENV: process.env.NODE_ENV});

		// compile template into html markup and assign it to this.contents. super.generate() will use this variable.
		this.contents = this.wax.compile(content)(data);

		let dir = `./${config['precompiled-src']}`;

		checkDirectoryForFiles()
			.then(execShellCommand(`handlebars ./${config['precompiled-src']} -f ./src/js/precompiled/templates.js -e "hbs"`));

		// Return the compiled HTML
		return super.parse(this.contents);

	}
}

module.exports = HbsAsset;
