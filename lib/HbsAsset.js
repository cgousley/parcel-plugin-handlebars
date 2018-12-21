const handlebars = require('handlebars');
const handlebarsWax = require('handlebars-wax');
const handlebarsLayouts = require('handlebars-layouts');
const handlebarsHelpersPackage = require('handlebars-helpers');
const HTMLAsset = require('parcel-bundler/src/assets/HTMLAsset');
const handlebarsHelpers = handlebarsHelpersPackage();
const {loadUserConfig, parseSimpleLayout} = require('./utils');


var fs = require('fs');
let jsonConfig;

const userConfig = loadUserConfig();
const config = Object.assign({}, {
	data: 'src/markup/data',
	decorators: 'src/markup/decorators',
	helpers: 'src/markup/helpers',
	layouts: 'src/markup/layouts',
	partials: 'src/markup/partials',
}, userConfig);

const wax = handlebarsWax(handlebars)
	.helpers(handlebarsLayouts)
	.helpers(handlebarsHelpers)
	.helpers(`${config.helpers}/**/*.js`)
	.data(`${config.data}/**/*.{json,js}`)
	.decorators(`${config.decorators}/**/*.js`)
	.partials(`${config.layouts}/**/*.{hbs,handlebars,js}`)
	.partials(`${config.partials}/**/*.{hbs,handlebars,js}`);


let data = {};
const dir = './' + config.data;
fs.readdir(dir, (err, files) => {
	return new Promise((resolve, reject) => {
		if (err) {
			reject(err);
		}
		files.forEach(file => {
			let content = require(`../../../${config.data}/${file}`);
			data = Object.assign({}, data, content);
		});
		return resolve(data);
	}).then(data => {
		jsonConfig = data;
	});
})

class HbsAsset extends HTMLAsset {
	constructor(name, pkg, options) {
		super(name, pkg, options);
		this.wax = wax;
	}

	parse(code) {

		// process simple layout mapping that does not use handlebars-layouts. i.e {{!< base}}
		const content = parseSimpleLayout(code, config);

		// combine data with NODE_ENV variable for use in the template
		const data = Object.assign({}, jsonConfig, {NODE_ENV: process.env.NODE_ENV});

		// compile template into html markup and assign it to this.contents. super.generate() will use this variable.
		this.contents = this.wax.compile(content)(data);

		// Return the compiled HTML
		return super.parse(this.contents);
	}
}

module.exports = HbsAsset;