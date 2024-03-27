/**
 * Importer for JSON raw data.
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class Importer {
	
	_app = null;
	#options = null;
	
	constructor(app) {
		this._app = app;
	}
	
	/**
	 * Process the import
	 */
	async process() {
		throw new Error('This has to be reimplemented in child classes of Importer');
	}
	
	/**
	 * Returns the option definitions for the importer, if any.
	 * 
	 * Returns an array of objects (all attributes are mandatory):
	 * [
	 *     {
	 *         id: Unique ID for the option
	 *         type: checkbox is the only available type until now
	 *         text: label text for the option
	 *         defaultValue: default value for the option
	 *     }
	 * ]
	 */
	getOptionDefinitions() {
		return [];
	}
	
	/**
	 * Sets options on the instance. Accepts an array created with getOptionDefinitions(),
	 * enriched with value attributes.
	 */
	setOptions(options) {
		this.#options = options;
	}
	
	/**
	 * Returns the value of an option
	 */
	getOption(id) {
		var it = this.#options.find(function(item) { return item.id == id; });
		if (!it) throw new Error('Option ' + id + ' not found');
		
		return it.value ? it.value : false;
	}
}