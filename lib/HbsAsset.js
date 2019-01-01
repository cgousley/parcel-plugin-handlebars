const fs = require('fs');
const handlebars = require('handlebars');
const handlebarsWax = require('handlebars-wax');
const handlebarsLayouts = require('handlebars-layouts');
const handlebarsHelpersPackage = require('handlebars-helpers');
const HTMLAsset = require('parcel-bundler/src/assets/HTMLAsset');
const handlebarsHelpers = handlebarsHelpersPackage();
const { loadUserConfig, parseSimpleLayout } = require('./utils');
const userConfig = loadUserConfig();
const glob = require('globby');

const config = Object.assign({}, {
	data: 'src/markup/data',
	decorators: 'src/markup/decorators',
	helpers: 'src/markup/helpers',
	layouts: 'src/markup/layouts',
	partials: 'src/markup/partials',
}, userConfig);
const helpersDep = glob.sync([
	`${config.helpers}/**/*.js`,
	`${config.data}/**/*.{json,js}`,
	`${config.decorators}/**/*.js`,
	`${config.layouts}/**/*.{hbs,handlebars,js}`,
	`${config.partials}/**/*.{hbs,handlebars,js}`,
]);
const dir = `./${config.data}`;

function gatherContentJson() {
	return new Promise((res, rej) => {
		fs.readdir(dir, (err, files) => {
			if (err) {
				rej(err);
			} else {
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

		const jsonContent = await gatherContentJson().then(mergeContentJson);

		// process simple layout mapping that does not use handlebars-layouts. i.e {{!< base}}
		const { dependencies, content } = parseSimpleLayout(code, config);

		dependencies.forEach(path => this.addDependency(path, {
			includedInParent: true,
		}));

		helpersDep.forEach(path => this.addDependency(path, {
			includedInParent: true,
		}));


		// combine frontmatter data with NODE_ENV variable for use in the template
		const data = Object.assign({}, jsonContent, { NODE_ENV: process.env.NODE_ENV });

		// compile template into html markup and assign it to this.contents. super.generate() will use this variable.
		this.contents = this.wax.compile(content)(data);

		// Return the compiled HTML
		return super.parse(this.contents);
	}
}

module.exports = HbsAsset;
